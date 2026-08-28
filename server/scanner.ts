import fs from 'fs';
import path from 'path';
import { AlertHistoryItem, ConfluenceGrade, MarketCategory, SMCSignal, TelegramSettings } from '../src/types';
import { analyzeAllPairs } from './smcEngine';
import { formatTelegramFVGTapInMessage, formatTelegramSignalMessage, sanitizeBotToken, sanitizeChatId, sendTelegramMessage } from './telegram';

// Safe writable paths across container and serverless environments
const PRIMARY_SETTINGS_FILE = path.join(process.cwd(), 'data_settings.json');
const TMP_SETTINGS_FILE = path.join('/tmp', 'data_settings.json');

const PRIMARY_HISTORY_FILE = path.join(process.cwd(), 'data_history.json');
const TMP_HISTORY_FILE = path.join('/tmp', 'data_history.json');

// Read default credentials from environment if available or hardcoded defaults
const ENV_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.VITE_TELEGRAM_BOT_TOKEN || '8683387578:AAG9phaBO0p2lH4JKIlXHGHBlmZq2NBG7SY';
const ENV_CHAT_ID = process.env.TELEGRAM_CHAT_ID || process.env.VITE_TELEGRAM_CHAT_ID || '8755686322';

const DEFAULT_SETTINGS: TelegramSettings = {
  botToken: ENV_BOT_TOKEN,
  chatId: ENV_CHAT_ID,
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
  antiDuplicateHours: 2,
  scanIntervalMinutes: 5,
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

// Load persisted files safely
function loadPersistedData() {
  // Try primary then tmp
  for (const filePath of [PRIMARY_SETTINGS_FILE, TMP_SETTINGS_FILE]) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        currentSettings = {
          ...DEFAULT_SETTINGS,
          ...parsed,
          botToken: parsed.botToken || ENV_BOT_TOKEN || currentSettings.botToken,
          chatId: parsed.chatId || ENV_CHAT_ID || currentSettings.chatId,
        };
        console.log(`[SMC SCANNER] Settings loaded from ${filePath} (Bot configured: ${Boolean(currentSettings.botToken && currentSettings.chatId)})`);
        break;
      }
    } catch (err) {
      console.warn(`[SMC SCANNER] Could not read settings from ${filePath}:`, err);
    }
  }

  // History
  for (const filePath of [PRIMARY_HISTORY_FILE, TMP_HISTORY_FILE]) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        alertHistory = JSON.parse(raw);
        break;
      }
    } catch (err) {
      console.warn(`[SMC SCANNER] Could not read history from ${filePath}:`, err);
    }
  }
}

function saveSettings() {
  for (const filePath of [PRIMARY_SETTINGS_FILE, TMP_SETTINGS_FILE]) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(currentSettings, null, 2), 'utf-8');
    } catch (err) {
      // Ignored for read-only layers
    }
  }
}

function saveHistory() {
  if (alertHistory.length > 150) {
    alertHistory = alertHistory.slice(0, 150);
  }
  for (const filePath of [PRIMARY_HISTORY_FILE, TMP_HISTORY_FILE]) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(alertHistory, null, 2), 'utf-8');
    } catch (err) {
      // Ignored for read-only layers
    }
  }
}

export function getSettings(): TelegramSettings {
  return currentSettings;
}

export function updateSettings(newSettings: Partial<TelegramSettings>): TelegramSettings {
  const cleanToken = sanitizeBotToken(newSettings.botToken ?? currentSettings.botToken);
  const cleanChat = sanitizeChatId(newSettings.chatId ?? currentSettings.chatId);

  currentSettings = {
    ...currentSettings,
    ...newSettings,
    botToken: cleanToken,
    chatId: cleanChat,
  };

  saveSettings();
  restartBackgroundScanner();
  console.log(`[SMC SCANNER] Settings updated. Bot Token: ${cleanToken ? 'DEFINED' : 'EMPTY'}, Chat ID: ${cleanChat || 'EMPTY'}`);
  return currentSettings;
}

export function getHistory(): AlertHistoryItem[] {
  return alertHistory;
}

export function getLatestSignals(): SMCSignal[] {
  return latestSignalsCache;
}

export function muteTradePair(
  pairSymbol: string,
  hours = 6,
  signalData?: Partial<SMCSignal>
): { mutedUntil: number; pairSymbol: string } {
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

  // Log rich taken trade in history
  alertHistory.unshift({
    id: `trade_${pairSymbol}_${Date.now()}`,
    timestamp: Date.now(),
    signalId: signalData?.id || `trade_${pairSymbol}`,
    pair: pairSymbol,
    category: signalData?.category || 'CRYPTO',
    direction: signalData?.direction || 'BUY',
    confluenceGrade: signalData?.confluenceGrade || 'SNIPER',
    confluenceScore: signalData?.confluenceScore || 100,
    entryPrice: signalData?.entryPrice || 0,
    stopLoss: signalData?.stopLoss || 0,
    tp1: signalData?.tp1 || 0,
    tp2: signalData?.tp2 || 0,
    riskRewardRatio: signalData?.riskRewardRatio || 0,
    currentPrice: signalData?.currentPrice || signalData?.entryPrice || 0,
    tradeTakenAt: Date.now(),
    outcome: 'IN_PROGRESS',
    telegramSent: false,
    status: 'TRADE_TAKEN',
    detailsSummary: `Position prise (${signalData?.direction || 'ACHAT'}). Paire en sourdine ${hours}h. Suivi TP1/TP2 en direct.`,
  });
  saveHistory();

  return { mutedUntil, pairSymbol };
}

export function unmuteTradePair(pairSymbol: string): { success: boolean; pairSymbol: string } {
  delete currentSettings.mutedPairs[pairSymbol];
  saveSettings();

  latestSignalsCache = latestSignalsCache.map((s) => {
    if (s.pair === pairSymbol || s.symbol === pairSymbol) {
      return { ...s, tradeTaken: false, tradeTakenAt: undefined, mutedUntil: undefined };
    }
    return s;
  });

  return { success: true, pairSymbol };
}

export async function executeScan(
  isManual = false,
  customToken?: string,
  customChatId?: string
): Promise<{
  signals: SMCSignal[];
  alertsDispatched: number;
  telegramStatus: { enabled: boolean; configured: boolean; lastError?: string };
}> {
  console.log(`[SMC SCANNER] Executing scan (manual: ${isManual})...`);
  const now = Date.now();
  currentSettings.lastScanTimestamp = now;

  // Clean up expired mutes
  for (const [pair, unMuteTime] of Object.entries(currentSettings.mutedPairs)) {
    if (now >= unMuteTime) {
      delete currentSettings.mutedPairs[pair];
    }
  }

  // Determine active Telegram credentials
  const botToken = sanitizeBotToken(customToken || currentSettings.botToken || ENV_BOT_TOKEN);
  const chatId = sanitizeChatId(customChatId || currentSettings.chatId || ENV_CHAT_ID);
  const hasTelegram = Boolean(botToken && chatId && (currentSettings.enabled !== false));

  // If credentials were provided on request, update state
  if (customToken && customChatId) {
    currentSettings.botToken = botToken;
    currentSettings.chatId = chatId;
    saveSettings();
  }

  // 1. Analyze all pairs with SMC 5-confluences engine
  const rawSignals = await analyzeAllPairs(
    currentSettings.activePairs && currentSettings.activePairs.length > 0 ? currentSettings.activePairs : undefined,
    currentSettings.minFvgSizePercent || 0.15,
    currentSettings.fvgGapFilterStdev ?? 0.5,
    currentSettings.fvgVolumeProfileBins || 15
  );

  // 2. Attach mute & trade taken state
  const signals: SMCSignal[] = rawSignals.map((s) => {
    const isMuted = currentSettings.mutedPairs[s.pair] && now < currentSettings.mutedPairs[s.pair];
    return {
      ...s,
      tradeTaken: Boolean(isMuted),
      mutedUntil: currentSettings.mutedPairs[s.pair],
    };
  });

  latestSignalsCache = signals;
  let alertsDispatched = 0;
  let lastTelegramError: string | undefined;

  console.log(
    `[SMC SCANNER] Found ${signals.length} active opportunities. Telegram alerts enabled: ${hasTelegram} (Bot: ${botToken ? 'YES' : 'NO'}, Chat: ${chatId || 'NONE'})`
  );

  // 3. Process Telegram Alerts
  for (const signal of signals) {
    const isGradeAllowed = currentSettings.alertLevels.includes(signal.confluenceGrade);
    const isCategoryAllowed = currentSettings.activeCategories.includes(signal.category);
    const isMuted = currentSettings.mutedPairs[signal.pair] && now < currentSettings.mutedPairs[signal.pair];

    if (!isGradeAllowed || !isCategoryAllowed) {
      continue;
    }

    // Check anti-duplicate cooldown
    const lastSent = lastAlertSentTime[signal.pair] || 0;
    const cooldownMs = Math.max(1, currentSettings.antiDuplicateHours || 2) * 60 * 60 * 1000;
    const isCooldownActive = now - lastSent < cooldownMs && !isManual;

    if (isMuted) {
      continue;
    }

    // 3.1 Send standard SMC signal alert
    if (!isCooldownActive && !isMuted) {
      let telegramSent = false;
      let telegramError: string | undefined;

      if (hasTelegram) {
        const msg = formatTelegramSignalMessage(signal);
        const res = await sendTelegramMessage(botToken, chatId, msg);
        telegramSent = res.success;
        telegramError = res.error;
        if (telegramSent) {
          lastAlertSentTime[signal.pair] = now;
          alertsDispatched++;
        } else {
          lastTelegramError = telegramError;
        }
      }

      // Add to history
      alertHistory.unshift({
        id: `alert_${signal.id}_${now}`,
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
        status: telegramSent ? 'DELIVERED' : hasTelegram ? 'FAILED' : 'LOCAL_ONLY',
        alertType: 'SIGNAL_CREATED',
        detailsSummary: `${signal.conditionsMetCount}/5 Confluences | Entrée ${
          signal.entryPrice > 500 ? signal.entryPrice.toFixed(2) : signal.entryPrice.toFixed(4)
        } | TP1 ${signal.tp1 > 500 ? signal.tp1.toFixed(2) : signal.tp1.toFixed(4)}`,
      });
    }

    // 3.2 FVG Tap-In / Retracement Notification
    const recentFvg = signal.confluences.condition2_FVG_OB.recentUnmitigatedFVG;
    const shouldNotifyFVGTap = (currentSettings.notifyOnFVGTap ?? true) && recentFvg?.isPriceInsideFVG;

    if (shouldNotifyFVGTap && !isMuted && recentFvg) {
      const lastTapSent = lastFVGTapSentTime[signal.pair] || 0;
      const tapCooldownMs = 60 * 60 * 1000; // 1h cooldown
      const isTapCooldownActive = now - lastTapSent < tapCooldownMs && !isManual;

      if (!isTapCooldownActive) {
        let telegramSent = false;
        let telegramError: string | undefined;

        if (hasTelegram) {
          const tapMsg = formatTelegramFVGTapInMessage(signal, recentFvg);
          const res = await sendTelegramMessage(botToken, chatId, tapMsg);
          telegramSent = res.success;
          telegramError = res.error;
          if (telegramSent) {
            lastFVGTapSentTime[signal.pair] = now;
            alertsDispatched++;
          } else {
            lastTelegramError = telegramError;
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
          status: telegramSent ? 'DELIVERED' : hasTelegram ? 'FAILED' : 'LOCAL_ONLY',
          alertType: 'FVG_TAP_IN',
          detailsSummary: `🎯 RETRACEMENT DANS LE FVG (${recentFvg.timeframe} - ${recentFvg.fvgFillPercentage ?? 50}% comblé | POC: ${
            recentFvg.pocPrice ?? 'N/A'
          })`,
        });
      }
    }
  }

  saveHistory();
  saveSettings();

  return {
    signals,
    alertsDispatched,
    telegramStatus: {
      enabled: currentSettings.enabled !== false,
      configured: Boolean(botToken && chatId),
      lastError: lastTelegramError,
    },
  };
}

export function startBackgroundScanner() {
  loadPersistedData();
  const intervalMs = Math.max(1, currentSettings.scanIntervalMinutes || 5) * 60 * 1000;

  console.log(
    `[SMC SCANNER] Background 24/7 Scanner active. Scanning every ${currentSettings.scanIntervalMinutes || 5} min.`
  );

  // Initial immediate scan
  executeScan(false).catch((err) => console.error('[SMC SCANNER] Initial scan error:', err));

  if (scanTimer) clearInterval(scanTimer);
  scanTimer = setInterval(() => {
    executeScan(false).catch((err) => console.error('[SMC SCANNER] Scheduled scan error:', err));
  }, intervalMs);
}

export function restartBackgroundScanner() {
  if (scanTimer) clearInterval(scanTimer);
  const intervalMs = Math.max(1, currentSettings.scanIntervalMinutes || 5) * 60 * 1000;
  console.log(`[SMC SCANNER] Restarting background scanner with interval ${currentSettings.scanIntervalMinutes || 5} min.`);
  scanTimer = setInterval(() => {
    executeScan(false).catch((err) => console.error('[SMC SCANNER] Scheduled scan error:', err));
  }, intervalMs);
}
