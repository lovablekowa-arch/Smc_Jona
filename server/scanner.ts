import fs from 'fs';
import path from 'path';
import { AlertHistoryItem, ConfluenceGrade, MarketCategory, SMCSignal, TelegramSettings } from '../src/types';
import { analyzeAllPairs } from './smcEngine';
import { formatTelegramFVGTapInMessage, formatTelegramSignalMessage, sendTelegramMessage } from './telegram';

const SETTINGS_FILE = path.join(process.cwd(), 'data_settings.json');
const HISTORY_FILE = path.join(process.cwd(), 'data_history.json');

const DEFAULT_SETTINGS: TelegramSettings = {
  botToken: '',
  chatId: '',
  enabled: true,
  alertLevels: ['SNIPER', 'MEDIUM', 'WATCHLIST'],
  activeCategories: ['CRYPTO', 'FOREX', 'COMMODITIES', 'SYNTHETICS'],
  activePairs: [],
  targetTimeframes: ['15M', '30M', '1H', '4H', '1D'],
  minFvgSizePercent: 0.15,
  fvgGapFilterStdev: 0.5,
  fvgVolumeProfileBins: 15,
  notifyOnFVGTap: true,
  showIFVG: true,
  fvgTimeframes: ['15M', '30M'],
  antiDuplicateHours: 6,
  scanIntervalMinutes: 10,
  soundEnabled: true,
  lastScanTimestamp: 0,
  mutedPairs: {},
};

let currentSettings: TelegramSettings = { ...DEFAULT_SETTINGS };
let alertHistory: AlertHistoryItem[] = [];
let lastAlertSentTime: Record<string, number> = {};
let lastFVGTapSentTime: Record<string, number> = {};
let latestSignalsCache: SMCSignal[] = [];
let scanTimer: NodeJS.Timeout | null = null;

// Load persisted files
function loadPersistedData() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      currentSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }

  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
      alertHistory = JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading history:', err);
  }
}

function saveSettings() {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(currentSettings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving settings:', err);
  }
}

function saveHistory() {
  try {
    // Keep max 150 entries
    if (alertHistory.length > 150) {
      alertHistory = alertHistory.slice(0, 150);
    }
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(alertHistory, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving history:', err);
  }
}

export function getSettings(): TelegramSettings {
  return currentSettings;
}

export function updateSettings(newSettings: Partial<TelegramSettings>): TelegramSettings {
  currentSettings = { ...currentSettings, ...newSettings };
  saveSettings();
  restartBackgroundScanner();
  return currentSettings;
}

export function getHistory(): AlertHistoryItem[] {
  return alertHistory;
}

export function getLatestSignals(): SMCSignal[] {
  return latestSignalsCache;
}

export function muteTradePair(pairSymbol: string, hours = 6): { mutedUntil: number; pairSymbol: string } {
  const muteDurationMs = hours * 60 * 60 * 1000;
  const mutedUntil = Date.now() + muteDurationMs;
  currentSettings.mutedPairs[pairSymbol] = mutedUntil;
  saveSettings();

  // Update in latest signals
  latestSignalsCache = latestSignalsCache.map((s) => {
    if (s.pair === pairSymbol || s.symbol === pairSymbol) {
      return { ...s, tradeTaken: true, tradeTakenAt: Date.now(), mutedUntil };
    }
    return s;
  });

  // Log in history
  alertHistory.unshift({
    id: `trade_${pairSymbol}_${Date.now()}`,
    timestamp: Date.now(),
    signalId: `trade_${pairSymbol}`,
    pair: pairSymbol,
    category: 'CRYPTO',
    direction: 'BUY',
    confluenceGrade: 'SNIPER',
    confluenceScore: 100,
    entryPrice: 0,
    stopLoss: 0,
    tp1: 0,
    tp2: 0,
    riskRewardRatio: 0,
    telegramSent: false,
    status: 'TRADE_TAKEN',
    detailsSummary: `Trade Pris ! Paire mise en sourdine anti-doublon pendant ${hours}h.`,
  });
  saveHistory();

  return { mutedUntil, pairSymbol };
}

export async function executeScan(isManual = false): Promise<{ signals: SMCSignal[]; alertsDispatched: number }> {
  console.log(`[SMC SCANNER] Executing scan (manual: ${isManual})...`);
  const now = Date.now();
  currentSettings.lastScanTimestamp = now;

  // Clean up expired mutes
  for (const [pair, unMuteTime] of Object.entries(currentSettings.mutedPairs)) {
    if (now >= unMuteTime) {
      delete currentSettings.mutedPairs[pair];
    }
  }

  // 1. Analyze all pairs with configured FVG minimum size threshold & ChartPrime volume profile filters
  const rawSignals = await analyzeAllPairs(
    currentSettings.activePairs.length > 0 ? currentSettings.activePairs : undefined,
    currentSettings.minFvgSizePercent || 0.15,
    currentSettings.fvgGapFilterStdev ?? 0.5,
    currentSettings.fvgVolumeProfileBins || 15
  );

  // 2. Attach mute & trade taken state
  const signals: SMCSignal[] = rawSignals.map((s) => {
    const isMuted = currentSettings.mutedPairs[s.pair] && now < currentSettings.mutedPairs[s.pair];
    return {
      ...s,
      tradeTaken: !!isMuted,
      mutedUntil: currentSettings.mutedPairs[s.pair],
    };
  });

  latestSignalsCache = signals;
  let alertsDispatched = 0;

  // 3. Process Telegram Alerts if enabled & credentials present
  const hasTelegram = currentSettings.botToken && currentSettings.chatId && currentSettings.enabled;

  for (const signal of signals) {
    const isGradeAllowed = currentSettings.alertLevels.includes(signal.confluenceGrade);
    const isCategoryAllowed = currentSettings.activeCategories.includes(signal.category);
    const isMuted = currentSettings.mutedPairs[signal.pair] && now < currentSettings.mutedPairs[signal.pair];

    if (!isGradeAllowed || !isCategoryAllowed) {
      continue;
    }

    // Check anti-duplicate cooldown (minimum 2 hours between identical alerts on same pair unless grade changed to SNIPER)
    const lastSent = lastAlertSentTime[signal.pair] || 0;
    const cooldownMs = (currentSettings.antiDuplicateHours || 4) * 60 * 60 * 1000;
    const isCooldownActive = now - lastSent < cooldownMs && !isManual;

    if (isMuted) {
      // Log as muted
      continue;
    }

    // 3.1 Send standard SMC signal alert
    if (!isCooldownActive && !isMuted) {
      let telegramSent = false;
      let telegramError: string | undefined;

      if (hasTelegram) {
        const msg = formatTelegramSignalMessage(signal);
        const res = await sendTelegramMessage(currentSettings.botToken, currentSettings.chatId, msg);
        telegramSent = res.success;
        telegramError = res.error;
        if (telegramSent) {
          lastAlertSentTime[signal.pair] = now;
          alertsDispatched++;
        }
      }

      // Add to history
      alertHistory.unshift({
        id: `alert_${signal.id}`,
        timestamp: now,
        signalId: signal.id,
        pair: signal.pair,
        category: signal.category,
        direction: signal.direction,
        confluenceGrade: signal.confluenceGrade,
        confluenceScore: signal.confluenceScore,
        entryPrice: signal.entryPrice,
        stopLoss: signal.stopLoss,
        tp1: signal.tp1,
        tp2: signal.tp2,
        riskRewardRatio: signal.riskRewardRatio,
        telegramSent,
        telegramError,
        status: telegramSent ? 'DELIVERED' : (hasTelegram ? 'FAILED' : 'LOCAL_ONLY'),
        alertType: 'SIGNAL_CREATED',
        detailsSummary: `${signal.conditionsMetCount}/4 Confluences | Entrée ${signal.entryPrice.toFixed(4)} | TP1 ${signal.tp1.toFixed(4)}`,
      });
    }

    // 3.2 FVG Tap-In / Retracement Notification
    const recentFvg = signal.confluences.condition2_FVG_OB.recentUnmitigatedFVG;
    const shouldNotifyFVGTap = (currentSettings.notifyOnFVGTap ?? true) && recentFvg?.isPriceInsideFVG;

    if (shouldNotifyFVGTap && !isMuted && recentFvg) {
      const lastTapSent = lastFVGTapSentTime[signal.pair] || 0;
      const tapCooldownMs = 90 * 60 * 1000; // 1h30 cooldown between FVG tap notifications on same pair
      const isTapCooldownActive = now - lastTapSent < tapCooldownMs && !isManual;

      if (!isTapCooldownActive) {
        let telegramSent = false;
        let telegramError: string | undefined;

        if (hasTelegram) {
          const tapMsg = formatTelegramFVGTapInMessage(signal, recentFvg);
          const res = await sendTelegramMessage(currentSettings.botToken, currentSettings.chatId, tapMsg);
          telegramSent = res.success;
          telegramError = res.error;
          if (telegramSent) {
            lastFVGTapSentTime[signal.pair] = now;
            alertsDispatched++;
          }
        }

        // Add to history
        alertHistory.unshift({
          id: `alert_tap_${signal.pair}_${now}`,
          timestamp: now,
          signalId: signal.id,
          pair: signal.pair,
          category: signal.category,
          direction: signal.direction,
          confluenceGrade: signal.confluenceGrade,
          confluenceScore: signal.confluenceScore,
          entryPrice: signal.entryPrice,
          stopLoss: signal.stopLoss,
          tp1: signal.tp1,
          tp2: signal.tp2,
          riskRewardRatio: signal.riskRewardRatio,
          telegramSent,
          telegramError,
          status: telegramSent ? 'DELIVERED' : (hasTelegram ? 'FAILED' : 'LOCAL_ONLY'),
          alertType: 'FVG_TAP_IN',
          detailsSummary: `🎯 RETRACEMENT DANS LE FVG (${recentFvg.timeframe} - ${recentFvg.fvgFillPercentage ?? 50}% comblé | POC: ${recentFvg.pocPrice ?? 'N/A'})`,
        });
      }
    }
  }

  saveHistory();
  saveSettings();
  return { signals, alertsDispatched };
}

export function startBackgroundScanner() {
  loadPersistedData();
  const intervalMs = Math.max(1, currentSettings.scanIntervalMinutes || 10) * 60 * 1000;

  console.log(`[SMC SCANNER] Background 24/7 Scanner started. Scanning every ${currentSettings.scanIntervalMinutes} minutes (${intervalMs}ms).`);

  // Initial immediate scan
  executeScan(false).catch((err) => console.error('[SMC SCANNER] Initial scan error:', err));

  if (scanTimer) clearInterval(scanTimer);
  scanTimer = setInterval(() => {
    executeScan(false).catch((err) => console.error('[SMC SCANNER] Scheduled scan error:', err));
  }, intervalMs);
}

export function restartBackgroundScanner() {
  if (scanTimer) clearInterval(scanTimer);
  const intervalMs = Math.max(1, currentSettings.scanIntervalMinutes || 10) * 60 * 1000;
  console.log(`[SMC SCANNER] Restarting background scanner with interval ${currentSettings.scanIntervalMinutes} minutes.`);
  scanTimer = setInterval(() => {
    executeScan(false).catch((err) => console.error('[SMC SCANNER] Scheduled scan error:', err));
  }, intervalMs);
}
