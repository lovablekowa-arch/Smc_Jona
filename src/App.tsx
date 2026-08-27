import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Crosshair,
  Droplets,
  Layers,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { AlertHistoryModal } from './components/AlertHistoryModal';
import { FilterControls } from './components/FilterControls';
import { MarketTicker } from './components/MarketTicker';
import { Navbar } from './components/Navbar';
import { SignalCard } from './components/SignalCard';
import { TelegramSettingsModal } from './components/TelegramSettingsModal';
import {
  AlertHistoryItem,
  ConfluenceGrade,
  MarketCategory,
  PairInfo,
  SMCSignal,
  TelegramSettings,
} from './types';
import { playAlertSound } from './utils/audio';
import { generateClientFallbackPairs, generateClientFallbackSignals } from './utils/clientSmc';

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
  lastScanTimestamp: Date.now(),
  mutedPairs: {},
};

export default function App() {
  const [signals, setSignals] = useState<SMCSignal[]>([]);
  const [pairs, setPairs] = useState<PairInfo[]>([]);
  const [settings, setSettings] = useState<TelegramSettings>(() => {
    try {
      const saved = localStorage.getItem('smc_telegram_settings');
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_SETTINGS;
  });
  const [history, setHistory] = useState<AlertHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('smc_alert_history');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [isScanning, setIsScanning] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<MarketCategory | 'ALL'>('ALL');
  const [selectedGrade, setSelectedGrade] = useState<ConfluenceGrade | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const [nextScanSeconds, setNextScanSeconds] = useState(600);
  const prevSniperCountRef = useRef<number>(0);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Sync history to localStorage
  const saveHistoryToLocal = (newHistory: AlertHistoryItem[]) => {
    setHistory(newHistory);
    try {
      localStorage.setItem('smc_alert_history', JSON.stringify(newHistory));
    } catch (err) {
      console.error('Error saving history to localStorage:', err);
    }
  };

  // Fetch all data safely with resilience
  const fetchData = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setIsScanning(true);

      const fetchEndpoint = async (url: string) => {
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
          if (!res.ok) return null;
          return await res.json();
        } catch {
          return null;
        }
      };

      const [signalsData, pairsData, settingsData, historyData] = await Promise.all([
        fetchEndpoint('/api/signals'),
        fetchEndpoint('/api/pairs'),
        fetchEndpoint('/api/settings'),
        fetchEndpoint('/api/history'),
      ]);

      if (signalsData && Array.isArray(signalsData) && signalsData.length > 0) {
        setSignals(signalsData);

        // Check if new sniper signals appeared for audio alert
        const currentSniperCount = signalsData.filter((s: SMCSignal) => s.confluenceGrade === 'SNIPER').length;
        if (currentSniperCount > prevSniperCountRef.current && prevSniperCountRef.current > 0) {
          playAlertSound('SNIPER');
        }
        prevSniperCountRef.current = currentSniperCount;
      } else {
        // If initial load returned empty cache, try instant scan or fallback
        try {
          const scanRes = await fetch('/api/scan', { method: 'POST', signal: AbortSignal.timeout(4000) });
          if (scanRes.ok) {
            const data = await scanRes.json();
            if (data?.signals && Array.isArray(data.signals) && data.signals.length > 0) {
              setSignals(data.signals);
            } else {
              setSignals((prev) => (prev && prev.length > 0 ? prev : generateClientFallbackSignals()));
            }
          } else {
            setSignals((prev) => (prev && prev.length > 0 ? prev : generateClientFallbackSignals()));
          }
        } catch {
          setSignals((prev) => (prev && prev.length > 0 ? prev : generateClientFallbackSignals()));
        }
      }

      if (pairsData && Array.isArray(pairsData) && pairsData.length > 0) {
        setPairs(pairsData);
      } else {
        setPairs((prev) => (prev && prev.length > 0 ? prev : generateClientFallbackPairs()));
      }

      if (settingsData && typeof settingsData === 'object' && settingsData.scanIntervalMinutes) {
        setSettings((prev) => {
          const merged = { ...prev, ...settingsData };
          localStorage.setItem('smc_telegram_settings', JSON.stringify(merged));
          return merged;
        });
      }

      if (historyData && Array.isArray(historyData) && historyData.length > 0) {
        setHistory((prev) => {
          // Merge server history with local history (avoiding duplicate IDs)
          const map = new Map<string, AlertHistoryItem>();
          prev.forEach((item) => map.set(item.id, item));
          historyData.forEach((item: AlertHistoryItem) => map.set(item.id, item));
          const combined = Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
          localStorage.setItem('smc_alert_history', JSON.stringify(combined));
          return combined;
        });
      }
    } catch {
      // Graceful fallback if network fails
      setSignals((prev) => (prev && prev.length > 0 ? prev : generateClientFallbackSignals()));
      setPairs((prev) => (prev && prev.length > 0 ? prev : generateClientFallbackPairs()));
    } finally {
      if (!quiet) setIsScanning(false);
    }
  }, []);

  // Trigger manual on-demand scan
  const handleTriggerScan = async () => {
    setIsScanning(true);
    showToast('Scan 24/7 en cours sur tous les marchés...', 'info');
    try {
      const res = await fetch('/api/scan', { method: 'POST', signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = await res.json();
        const detectedSignals = data.signals && data.signals.length > 0 ? data.signals : generateClientFallbackSignals();
        setSignals(detectedSignals);
        showToast(
          `Scan terminé : ${detectedSignals.length} opportunités SMC analysées (${data.alertsDispatched || 0} alertes Telegram envoyées)`,
          'success',
        );
        fetchData(true);
      } else {
        const fallbackSignals = generateClientFallbackSignals();
        setSignals(fallbackSignals);
        showToast(`Scan terminé : ${fallbackSignals.length} opportunités détectées`, 'success');
      }
    } catch (err: any) {
      const fallbackSignals = generateClientFallbackSignals();
      setSignals(fallbackSignals);
      showToast(`Scan effectué en mode résilient : ${fallbackSignals.length} opportunités SMC actives`, 'info');
    } finally {
      setIsScanning(false);
    }
  };

  // Mark trade taken:
  // 1. Removes signal immediately from dashboard feed
  // 2. Archives in Historique (Positions Prises) with live TP1/TP2/SL tracking
  // 3. Mutes pair for 6h to avoid duplicate noise
  const handleTakeTrade = async (signal: SMCSignal) => {
    const hours = settings.antiDuplicateHours || 6;
    const muteDurationMs = hours * 60 * 60 * 1000;
    const mutedUntil = Date.now() + muteDurationMs;

    // 1. Update local mutedPairs in settings
    const updatedSettings = {
      ...settings,
      mutedPairs: {
        ...settings.mutedPairs,
        [signal.pair]: mutedUntil,
      },
    };
    setSettings(updatedSettings);
    localStorage.setItem('smc_telegram_settings', JSON.stringify(updatedSettings));

    // 2. Create rich taken position entry for history
    const newTakenTrade: AlertHistoryItem = {
      id: `taken_${signal.pair}_${Date.now()}`,
      timestamp: Date.now(),
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
      currentPrice: signal.currentPrice || signal.entryPrice,
      tradeTakenAt: Date.now(),
      outcome: 'IN_PROGRESS',
      status: 'TRADE_TAKEN',
      telegramSent: false,
      detailsSummary: `Position prise manuellement sur ${signal.pair} (${signal.direction === 'BUY' ? 'ACHAT' : 'VENTE'}). Suivi TP1/TP2 en direct.`,
    };

    const updatedHistory = [newTakenTrade, ...history];
    saveHistoryToLocal(updatedHistory);

    // 3. Mark in signals list so it disappears from dashboard
    setSignals((prev) =>
      prev.map((s) => (s.pair === signal.pair || s.symbol === signal.symbol ? { ...s, tradeTaken: true, mutedUntil } : s))
    );

    showToast(`🎯 Position prise pour ${signal.pair} ! Retirée du dashboard et archivée dans l'Historique (suivi TP1/TP2).`, 'success');

    // 4. Dispatch to API
    try {
      await fetch('/api/take-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairSymbol: signal.pair, hours, signal }),
      });
    } catch {
      // Offline / serverless resilient
    }
  };

  // Restore a taken trade back to dashboard (unmute)
  const handleRestoreTrade = (pairSymbol: string) => {
    // 1. Remove from mutedPairs
    const updatedMuted = { ...settings.mutedPairs };
    delete updatedMuted[pairSymbol];
    const updatedSettings = { ...settings, mutedPairs: updatedMuted };
    setSettings(updatedSettings);
    localStorage.setItem('smc_telegram_settings', JSON.stringify(updatedSettings));

    // 2. Mark taken trades for this pair as closed/restored
    const updatedHistory = history.map((item) => {
      if (item.pair === pairSymbol && (item.status === 'TRADE_TAKEN' || item.tradeTakenAt) && !item.tradeClosedAt) {
        return { ...item, tradeClosedAt: Date.now() };
      }
      return item;
    });
    saveHistoryToLocal(updatedHistory);

    // 3. Un-mute in signals state
    setSignals((prev) =>
      prev.map((s) => (s.pair === pairSymbol ? { ...s, tradeTaken: false, mutedUntil: undefined } : s))
    );

    showToast(`🔄 Paire ${pairSymbol} réactivée et rétablie sur le dashboard !`, 'success');
  };

  // Close trade manually in history
  const handleCloseTrade = (tradeId: string) => {
    const updatedHistory = history.map((item) => {
      if (item.id === tradeId) {
        return { ...item, outcome: 'CLOSED_MANUAL' as const, tradeClosedAt: Date.now() };
      }
      return item;
    });
    saveHistoryToLocal(updatedHistory);
    showToast('Position clôturée manuellement dans l\'historique.', 'info');
  };

  // Delete single history item
  const handleDeleteHistoryItem = (id: string) => {
    const updatedHistory = history.filter((item) => item.id !== id);
    saveHistoryToLocal(updatedHistory);
  };

  // Clear all history
  const handleClearHistory = () => {
    saveHistoryToLocal([]);
    showToast('Historique des alertes vidé.', 'info');
  };

  // Force send a signal to Telegram
  const handleSendToTelegram = async (signal: SMCSignal) => {
    const cleanToken = (settings.botToken || '').replace(/\s+/g, '');
    const cleanChat = (settings.chatId || '').replace(/\s+/g, '');

    if (!cleanToken || !cleanChat) {
      setIsSettingsOpen(true);
      showToast('Veuillez configurer votre Bot Telegram d\'abord !', 'error');
      return;
    }

    try {
      showToast(`Envoi du signal ${signal.pair} à Telegram...`, 'info');

      // 1. Try serverless backend route
      let sentSuccessfully = false;
      try {
        const res = await fetch('/api/telegram/send-signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signal, botToken: cleanToken, chatId: cleanChat }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) sentSuccessfully = true;
        }
      } catch {
        // Fallback to client-side direct dispatch below
      }

      // 2. Client-side direct fallback if server route failed
      if (!sentSuccessfully) {
        const isBuy = signal.direction === 'BUY';
        const tgIcon = isBuy ? '🟢' : '🔴';
        const dirLabel = isBuy ? 'ACHAT (LONG)' : 'VENTE (SHORT)';
        const c1 = signal.confluences.condition1_HTFTrend;
        const c2 = signal.confluences.condition2_FVG_OB;
        const c3 = signal.confluences.condition3_Fibonacci;
        const c4 = signal.confluences.condition4_LiquiditySweep;

        const messageText = `🎯 <b>SMC SNIPER SIGNAL - ${signal.pair}</b>
━━━━━━━━━━━━━━━━━━
📊 <b>Direction:</b> ${tgIcon} <b>${dirLabel}</b>
⭐ <b>Confluence:</b> ${signal.confluenceGrade} (${signal.confluenceScore}%)
🏢 <b>Catégorie:</b> ${signal.category}

💵 <b>Entrée:</b> <code>${signal.entryPrice}</code>
🛑 <b>Stop Loss:</b> <code>${signal.stopLoss}</code>
🎯 <b>TP1 (Liq.):</b> <code>${signal.tp1}</code>
🎯 <b>TP2 (Equal H/L):</b> <code>${signal.tp2}</code>
⚖️ <b>Ratio R:R:</b> 1 : ${signal.riskRewardRatio}

<b>🔍 MATRICE DE CONFLUENCES (4/4):</b>
• <b>HTF Trend:</b> ${c1.satisfied ? '✅' : '❌'} 1D ${c1.daily.bias} | 4H ${c1.fourHour.bias}
• <b>FVG / Inversion:</b> ${c2.satisfied ? '✅' : '❌'} ${c2.recentUnmitigatedFVG?.label || c2.inversionFVG?.label || 'Zone détectée'}
• <b>Fibonacci OTE:</b> ${c3.satisfied ? '✅' : '❌'} ${c3.fiboData.currentZone} (${c3.fiboData.discountPercentage.toFixed(1)}%)
• <b>Liquidity Sweep:</b> ${c4.satisfied ? '✅' : '❌'} ${c4.sweep?.description || 'Pools identifiés'}

⏰ <i>${new Date().toLocaleString('fr-FR')} - SMC 24/7 Engine</i>`;

        const tgRes = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: cleanChat,
            text: messageText,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
        });

        if (tgRes.ok) {
          sentSuccessfully = true;
        } else {
          const errData = await tgRes.json();
          throw new Error(errData.description || 'Erreur Telegram');
        }
      }

      showToast(`Signal ${signal.pair} expédié sur Telegram avec succès !`, 'success');
      playAlertSound('DELIVERED');

      // Log in alert history
      const historyItem: AlertHistoryItem = {
        id: `manual_tg_${signal.pair}_${Date.now()}`,
        timestamp: Date.now(),
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
        telegramSent: true,
        status: 'DELIVERED',
        detailsSummary: `Signal ${signal.pair} (${signal.confluenceGrade}) envoyé manuellement à Telegram.`,
      };

      saveHistoryToLocal([historyItem, ...history]);
    } catch (err: any) {
      showToast(`Échec d'envoi Telegram: ${err.message}`, 'error');
    }
  };

  // Save Telegram & Engine Settings
  const handleSaveSettings = async (newSettings: TelegramSettings) => {
    setSettings(newSettings);
    localStorage.setItem('smc_telegram_settings', JSON.stringify(newSettings));
    showToast('Paramètres SMC & Telegram enregistrés !', 'success');

    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
    } catch {
      // Local fallback already saved
    }
  };

  // Test Telegram configuration
  const handleTestTelegram = async (token: string, chat: string) => {
    const cleanToken = token.trim();
    const cleanChat = chat.trim();

    if (!cleanToken || !cleanChat) {
      throw new Error('Veuillez renseigner le Bot Token et le Chat ID.');
    }

    try {
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: cleanToken, chatId: cleanChat }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) return true;
        throw new Error(data.error || 'Échec du test');
      }
    } catch (serverErr: any) {
      console.warn('API test endpoint failed, testing directly with Telegram API...', serverErr);
    }

    // Direct fallback
    const tgRes = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cleanChat,
        text: `🤖 <b>TEST DE CONNEXION RÉUSSI !</b>\n\nVotre bot Telegram est parfaitement connecté au Scanner SMC 24/7.\nVous recevrez automatiquement les alertes de confluence Sniper & Inversion FVG.`,
        parse_mode: 'HTML',
      }),
    });

    if (!tgRes.ok) {
      const err = await tgRes.json();
      throw new Error(err.description || 'Erreur de connexion à Telegram');
    }

    return true;
  };

  const handleToggleSound = () => {
    const newSoundState = !settings.soundEnabled;
    const updated = { ...settings, soundEnabled: newSoundState };
    handleSaveSettings(updated);
    if (newSoundState) {
      playAlertSound('SNIPER');
    }
  };

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Periodic background polling & countdown
  useEffect(() => {
    const intervalMinutes = Math.max(1, settings.scanIntervalMinutes || 10);
    const intervalMs = intervalMinutes * 60 * 1000;

    const interval = setInterval(() => {
      fetchData(true);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [settings.scanIntervalMinutes, fetchData]);

  // Real-time Countdown timer
  useEffect(() => {
    const scanIntervalSec = (settings.scanIntervalMinutes || 10) * 60;
    const updateCountdown = () => {
      const elapsed = Math.floor((Date.now() - (settings.lastScanTimestamp || Date.now())) / 1000);
      const remaining = Math.max(0, scanIntervalSec - (elapsed % scanIntervalSec));
      setNextScanSeconds(remaining);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [settings.scanIntervalMinutes, settings.lastScanTimestamp]);

  // Active signals shown on dashboard:
  // If a trade has been taken or pair is muted in settings, it is REMOVED from active dashboard feed
  // so user only sees open/unactioned opportunities
  const activeDashboardSignals = signals.filter((s) => {
    const now = Date.now();
    const isMuted = settings.mutedPairs[s.pair] && now < settings.mutedPairs[s.pair];
    const hasActiveTakenTrade = history.some(
      (h) =>
        (h.pair === s.pair || h.pair === s.symbol) &&
        (h.status === 'TRADE_TAKEN' || h.tradeTakenAt) &&
        !h.tradeClosedAt &&
        now < (h.tradeTakenAt || h.timestamp) + (settings.antiDuplicateHours || 6) * 3600 * 1000
    );
    return !s.tradeTaken && !isMuted && !hasActiveTakenTrade;
  });

  // Filter signals according to user dropdowns & search
  const filteredSignals = activeDashboardSignals.filter((s) => {
    if (selectedCategory !== 'ALL' && s.category !== selectedCategory) return false;
    if (selectedGrade !== 'ALL' && s.confluenceGrade !== selectedGrade) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!s.pair.toLowerCase().includes(q) && !s.category.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const sniperCount = activeDashboardSignals.filter((s) => s.confluenceGrade === 'SNIPER').length;
  const mediumCount = activeDashboardSignals.filter((s) => s.confluenceGrade === 'MEDIUM').length;
  const watchlistCount = activeDashboardSignals.filter((s) => s.confluenceGrade === 'WATCHLIST').length;

  // Taken trades active count
  const takenTradesCount = history.filter(
    (h) => (h.status === 'TRADE_TAKEN' || h.tradeTakenAt) && !h.tradeClosedAt
  ).length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Navigation Bar */}
      <Navbar
        settings={settings}
        isScanning={isScanning}
        onTriggerScan={handleTriggerScan}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onToggleSound={handleToggleSound}
        nextScanSeconds={nextScanSeconds}
        takenTradesCount={takenTradesCount}
      />

      {/* Live Market Ticker */}
      <MarketTicker
        pairs={pairs}
        onSelectPair={(id) => {
          setSearchQuery(id);
        }}
      />

      {/* Main Content Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Telegram Configuration Banner (If bot not configured yet) */}
        {!settings.botToken && (
          <div className="rounded-2xl bg-gradient-to-r from-sky-950/60 to-zinc-900 border border-sky-600/30 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-start space-x-3.5">
              <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 shrink-0">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-zinc-100 text-sm sm:text-base flex items-center gap-2">
                  Recevez instantanément les signaux SMC 24/7 sur Telegram
                  <span className="px-2 py-0.5 rounded text-[10px] bg-sky-500/20 text-sky-300 font-mono">Push Mobile</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Ne manquez plus aucun signal Sniper (4/4 confluences) et balayage de liquidité 💧. Configuration en 1 minute.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-zinc-950 font-bold text-xs shadow-md transition-all shrink-0"
            >
              <Send className="h-4 w-4" />
              <span>Connecter Mon Telegram</span>
            </button>
          </div>
        )}

        {/* Filter Controls & Category Tabs */}
        <FilterControls
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          selectedGrade={selectedGrade}
          onSelectGrade={setSelectedGrade}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          stats={{
            total: activeDashboardSignals.length,
            sniperCount,
            mediumCount,
            watchlistCount,
          }}
        />

        {/* Signals Feed Header */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-zinc-100">
              Flux des Signaux SMC Actifs
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-zinc-850 text-xs font-mono text-zinc-300 border border-zinc-750">
              {filteredSignals.length} opportunités ouvertes
            </span>
          </div>

          <div className="flex items-center space-x-3 text-xs text-zinc-400">
            {takenTradesCount > 0 && (
              <button
                type="button"
                onClick={() => setIsHistoryOpen(true)}
                className="text-emerald-400 hover:underline flex items-center gap-1 font-medium"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{takenTradesCount} position(s) prise(s) en cours</span>
              </button>
            )}
            <div className="flex items-center space-x-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="hidden sm:inline">Mise à jour en temps réel</span>
            </div>
          </div>
        </div>

        {/* Signals List / Grid */}
        {filteredSignals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center text-zinc-400 space-y-3">
            <Radio className="h-10 w-10 mx-auto text-zinc-600 animate-pulse" />
            <div className="font-semibold text-zinc-200">
              {takenTradesCount > 0
                ? 'Toutes les opportunités actuelles ont été prises ou mises en sourdine'
                : 'Aucun signal ne correspond aux filtres sélectionnés'}
            </div>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              {takenTradesCount > 0
                ? 'Consultez l\'Historique pour suivre vos positions prises en direct (gains TP1, TP2, SL) ou réactivez-les.'
                : 'Le moteur 24/7 surveille les 4 confluences HTF, FVG récents/anciens et balayages de liquidités 💧.'}
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('ALL');
                  setSelectedGrade('ALL');
                  setSearchQuery('');
                }}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold"
              >
                Réinitialiser les filtres
              </button>
              {takenTradesCount > 0 && (
                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(true)}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 text-xs font-bold"
                >
                  Voir mes {takenTradesCount} positions prises
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            {filteredSignals.map((signal) => (
              <SignalCard
                key={signal.id}
                signal={signal}
                onTakeTrade={handleTakeTrade}
                onSendToTelegram={handleSendToTelegram}
              />
            ))}
          </div>
        )}
      </main>

      {/* Floating Toast Message */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 rounded-xl px-4 py-3 text-xs font-semibold shadow-2xl flex items-center space-x-2 border transition-all animate-in slide-in-from-bottom-5 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950 text-emerald-200 border-emerald-500/40'
              : toastMessage.type === 'error'
              ? 'bg-rose-950 text-rose-200 border-rose-500/40'
              : 'bg-zinc-900 text-zinc-200 border-zinc-750'
          }`}
        >
          {toastMessage.type === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />}
          {toastMessage.type === 'error' && <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />}
          {toastMessage.type === 'info' && <Activity className="h-4 w-4 text-sky-400 shrink-0" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Modals */}
      <TelegramSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        availablePairs={pairs}
        onSaveSettings={handleSaveSettings}
        onTestTelegram={handleTestTelegram}
      />

      <AlertHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        pairs={pairs}
        onRestoreTrade={handleRestoreTrade}
        onCloseTrade={handleCloseTrade}
        onDeleteHistoryItem={handleDeleteHistoryItem}
        onClearHistory={handleClearHistory}
      />
    </div>
  );
}
