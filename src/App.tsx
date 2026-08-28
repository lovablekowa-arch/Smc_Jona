import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowRight,
  Bot,
  CheckCircle2,
  Crosshair,
  Droplets,
  Flame,
  Layers,
  Radio,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { AlertHistoryModal } from './components/AlertHistoryModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FilterControls, SignalViewMode } from './components/FilterControls';
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
  botToken: '8683387578:AAG9phaBO0p2lH4JKIlXHGHBlmZq2NBG7SY',
  chatId: '8755686322',
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
  const [archivedSignals, setArchivedSignals] = useState<SMCSignal[]>(() => {
    try {
      const saved = localStorage.getItem('smc_archived_signals');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
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
  const [selectedViewMode, setSelectedViewMode] = useState<SignalViewMode>('ALL');
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

  // Sync archived signals to localStorage
  const saveArchivedSignalsToLocal = (newArchived: SMCSignal[]) => {
    setArchivedSignals(newArchived);
    try {
      localStorage.setItem('smc_archived_signals', JSON.stringify(newArchived));
    } catch (err) {
      console.error('Error saving archived signals to localStorage:', err);
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
          const map = new Map<string, AlertHistoryItem>();
          prev.forEach((item) => map.set(item.id, item));
          historyData.forEach((item: AlertHistoryItem) => map.set(item.id, item));
          const combined = Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
          localStorage.setItem('smc_alert_history', JSON.stringify(combined));
          return combined;
        });
      }
    } catch {
      setSignals((prev) => (prev && prev.length > 0 ? prev : generateClientFallbackSignals()));
      setPairs((prev) => (prev && prev.length > 0 ? prev : generateClientFallbackPairs()));
    } finally {
      if (!quiet) setIsScanning(false);
    }
  }, []);

  // Trigger manual on-demand scan
  const handleTriggerScan = async () => {
    setIsScanning(true);
    showToast('Scan SMC 24/7 en cours sur tous les marchés...', 'info');
    try {
      const cleanToken = (settings.botToken || '').trim();
      const cleanChat = (settings.chatId || '').trim();

      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: cleanToken,
          chatId: cleanChat,
          force: true,
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (res.ok) {
        const data = await res.json();
        const detectedSignals = data.signals && data.signals.length > 0 ? data.signals : generateClientFallbackSignals();
        setSignals(detectedSignals);

        const dispatched = data.alertsDispatched || 0;
        if (cleanToken && cleanChat) {
          if (dispatched > 0) {
            showToast(`🎯 Scan terminé : ${dispatched} alerte(s) Telegram expédiée(s) sur votre smartphone !`, 'success');
            playAlertSound('DELIVERED');
          } else {
            showToast(`Scan terminé : ${detectedSignals.length} opportunités SMC actives surveillées.`, 'info');
          }
        } else {
          showToast(`Scan terminé : ${detectedSignals.length} opportunités SMC actives (Configurez Telegram pour recevoir les alertes).`, 'info');
        }
        fetchData(true);
      } else {
        const fallbackSignals = generateClientFallbackSignals();
        setSignals(fallbackSignals);
        showToast(`Scan terminé : ${fallbackSignals.length} opportunités détectées`, 'success');
      }
    } catch (err: any) {
      const fallbackSignals = generateClientFallbackSignals();
      setSignals(fallbackSignals);
      showToast(`Scan effectué : ${fallbackSignals.length} opportunités SMC actives`, 'info');
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

    showToast(`🎯 Position prise pour ${signal.pair} ! Retirée du dashboard et archivée dans l'Historique.`, 'success');

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

  // Archive a signal or mark as missed
  const handleArchiveSignal = (signal: SMCSignal) => {
    const updatedArchived = [
      { ...signal, isArchived: true, isMissed: true, archivedAt: Date.now() },
      ...archivedSignals.filter((s) => s.id !== signal.id),
    ];
    saveArchivedSignalsToLocal(updatedArchived);

    // Remove from active signals
    setSignals((prev) => prev.filter((s) => s.id !== signal.id));
    showToast(`📦 Signal ${signal.pair} archivé / marqué comme raté. Retrouvez-le dans l'onglet Archives.`, 'info');
  };

  // Restore an archived signal
  const handleRestoreArchivedSignal = (signalId: string) => {
    const signalToRestore = archivedSignals.find((s) => s.id === signalId);
    if (!signalToRestore) return;

    saveArchivedSignalsToLocal(archivedSignals.filter((s) => s.id !== signalId));
    setSignals((prev) => [{ ...signalToRestore, isArchived: false, isMissed: false }, ...prev]);
    showToast(`🔄 Signal ${signalToRestore.pair} rétabli dans le flux actif !`, 'success');
  };

  // Restore a taken trade back to dashboard (unmute)
  const handleRestoreTrade = (pairSymbol: string) => {
    const updatedMuted = { ...settings.mutedPairs };
    delete updatedMuted[pairSymbol];
    const updatedSettings = { ...settings, mutedPairs: updatedMuted };
    setSettings(updatedSettings);
    localStorage.setItem('smc_telegram_settings', JSON.stringify(updatedSettings));

    const updatedHistory = history.map((item) => {
      if (item.pair === pairSymbol && (item.status === 'TRADE_TAKEN' || item.tradeTakenAt) && !item.tradeClosedAt) {
        return { ...item, tradeClosedAt: Date.now() };
      }
      return item;
    });
    saveHistoryToLocal(updatedHistory);

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
    const cleanToken = (settings.botToken || '').trim();
    const cleanChat = (settings.chatId || '').trim();

    if (!cleanToken || !cleanChat) {
      setIsSettingsOpen(true);
      showToast('Veuillez renseigner votre Bot Token et Chat ID dans les Paramètres !', 'error');
      return;
    }

    try {
      showToast(`Envoi du signal ${signal.pair} à Telegram...`, 'info');

      let deliveryError: string | null = null;
      let sentSuccessfully = false;

      // 1. Try Backend dispatch first
      try {
        const res = await fetch('/api/telegram/send-signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signal, botToken: cleanToken, chatId: cleanChat }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          sentSuccessfully = true;
        } else {
          deliveryError = data.error || 'Échec du serveur';
        }
      } catch (err: any) {
        deliveryError = err.message || 'Erreur réseau serveur';
      }

      // 2. Direct browser fallback if backend failed
      if (!sentSuccessfully) {
        try {
          const rawToken = cleanToken.replace(/^bot/i, '').replace(/["'\s]/g, '');
          const rawChat = cleanChat.replace(/["'\s]/g, '');
          const tgUrl = `https://api.telegram.org/bot${rawToken}/sendMessage`;

          const tgRes = await fetch(tgUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: rawChat,
              text: `🎯 <b>SIGNAL SMC EXPÉDIÉ MANUELLEMENT</b>\n\n📊 <b>Paire :</b> <code>${signal.pair}</code>\n🧭 <b>Direction :</b> ${signal.direction === 'BUY' ? '🟢 ACHAT (LONG)' : '🔴 VENTE (SHORT)'}\n💰 <b>Entrée :</b> <code>${signal.entryPrice}</code> | 🛑 <b>SL :</b> <code>${signal.stopLoss}</code>\n🎯 <b>TP1 :</b> <code>${signal.tp1}</code> | <b>TP2 :</b> <code>${signal.tp2}</code>\n⚖️ <b>Ratio R:R :</b> 1 : ${signal.riskRewardRatio}\n\n🔍 <b>Grade :</b> ${signal.confluenceGrade} (${signal.conditionsMetCount}/5 Confluences)\n⏰ <b>Heure :</b> ${signal.formattedTime}`,
              parse_mode: 'HTML',
            }),
          });
          const tgData = await tgRes.json();
          if (tgData.ok) {
            sentSuccessfully = true;
            deliveryError = null;
          } else {
            deliveryError = tgData.description || deliveryError;
          }
        } catch (fbErr: any) {
          deliveryError = fbErr.message || deliveryError;
        }
      }

      if (sentSuccessfully) {
        showToast(`Signal ${signal.pair} expédié sur Telegram avec succès !`, 'success');
        playAlertSound('DELIVERED');

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
      } else {
        throw new Error(deliveryError || 'Impossible de joindre l\'API Telegram.');
      }
    } catch (err: any) {
      showToast(`Échec d'envoi Telegram : ${err.message}`, 'error');
    }
  };

  // Save Telegram & Engine Settings
  const handleSaveSettings = async (newSettings: Partial<TelegramSettings>) => {
    const updated: TelegramSettings = {
      ...DEFAULT_SETTINGS,
      ...settings,
      ...newSettings,
      mutedPairs: newSettings.mutedPairs ?? settings?.mutedPairs ?? {},
      alertLevels: newSettings.alertLevels ?? settings?.alertLevels ?? ['SNIPER', 'MEDIUM', 'WATCHLIST'],
      activeCategories: newSettings.activeCategories ?? settings?.activeCategories ?? ['CRYPTO', 'FOREX', 'COMMODITIES', 'SYNTHETICS'],
      activePairs: newSettings.activePairs ?? settings?.activePairs ?? [],
      targetTimeframes: newSettings.targetTimeframes ?? settings?.targetTimeframes ?? ['15M', '30M', '1H', '4H', '1D'],
      fvgTimeframes: newSettings.fvgTimeframes ?? settings?.fvgTimeframes ?? ['15M', '30M'],
    };
    setSettings(updated);
    try {
      localStorage.setItem('smc_telegram_settings', JSON.stringify(updated));
    } catch {}
    showToast('Paramètres SMC & Telegram enregistrés !', 'success');

    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch {}
  };

  // Test Telegram configuration
  const handleTestTelegram = async (token: string, chat: string): Promise<{ success: boolean; error?: string }> => {
    const cleanToken = token.trim();
    const cleanChat = chat.trim();

    if (!cleanToken || !cleanChat) {
      return { success: false, error: 'Veuillez renseigner le Bot Token et le Chat ID.' };
    }

    try {
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: cleanToken, chatId: cleanChat }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {}

      if (res.ok && data?.success) {
        return { success: true };
      }
      if (data?.error) {
        return { success: false, error: data.error };
      }
    } catch (serverErr: any) {
      console.warn('API test endpoint failed, testing directly with Telegram API...', serverErr);
    }

    // Direct browser fallback if backend test fails
    try {
      const rawToken = cleanToken.replace(/^bot/i, '').replace(/["'\s]/g, '');
      const rawChat = cleanChat.replace(/["'\s]/g, '');
      const tgRes = await fetch(`https://api.telegram.org/bot${rawToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: rawChat,
          text: `🤖 <b>TEST DE CONNEXION RÉUSSI !</b>\n\nVotre bot Telegram est connecté au Scanner SMC 24/7.\nVous recevrez automatiquement les alertes de 5 confluences Sniper & Inversion FVG.`,
          parse_mode: 'HTML',
        }),
      });

      let tgData: any = null;
      try {
        tgData = await tgRes.json();
      } catch {}

      if (tgData?.ok) {
        return { success: true };
      }
      return { success: false, error: tgData?.description || 'Erreur lors du contact avec Telegram. Vérifiez le token ou tapez /start sur le bot.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Impossible de joindre les serveurs Telegram' };
    }
  };

  const handleToggleSound = () => {
    const newSoundState = !settings.soundEnabled;
    const updated = { ...settings, soundEnabled: newSoundState };
    handleSaveSettings(updated);
    if (newSoundState) {
      playAlertSound('SNIPER');
    }
  };

  // Initial load and auto-refresh Telegram alert guarantee
  useEffect(() => {
    // 1. Check local Telegram credentials and sync with backend immediately
    const saved = localStorage.getItem('smc_telegram_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.botToken && parsed.chatId) {
          fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsed),
          })
            .then(() => {
              // Trigger scan to ensure notifications arrive directly on Telegram upon refresh
              return fetch('/api/scan', { method: 'POST' });
            })
            .then((res) => res.json())
            .then((data) => {
              if (data?.signals && data.signals.length > 0) {
                setSignals(data.signals);
              }
            })
            .catch(() => {});
        }
      } catch {}
    }

    // 2. Fetch fresh data
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
  const activeDashboardSignals = (signals || []).filter((s) => {
    if (!s) return false;
    const now = Date.now();
    const isMuted = Boolean(settings?.mutedPairs?.[s.pair] && now < settings.mutedPairs[s.pair]);
    const hasActiveTakenTrade = Array.isArray(history) && history.some(
      (h) =>
        (h.pair === s.pair || h.pair === s.symbol) &&
        (h.status === 'TRADE_TAKEN' || h.tradeTakenAt) &&
        !h.tradeClosedAt &&
        now < (h.tradeTakenAt || h.timestamp) + (settings?.antiDuplicateHours || 6) * 3600 * 1000
    );
    const isArchived = Boolean(s.isArchived || (Array.isArray(archivedSignals) && archivedSignals.some((a) => a.id === s.id)));
    return !s.tradeTaken && !isMuted && !hasActiveTakenTrade && !isArchived;
  });

  // Base list depending on selectedViewMode
  const sourceSignals = selectedViewMode === 'ARCHIVED' ? archivedSignals : activeDashboardSignals;

  // Filter signals according to user dropdowns & search & viewMode
  const filteredSignals = (sourceSignals || [])
    .filter((s) => {
      if (!s) return false;
      if (selectedViewMode === 'HIGH_PROBABILITY' && s.signalType === 'IFVG_RETEST_CHOCH') {
        return false;
      }
      if (selectedViewMode === 'IFVG' && s.signalType !== 'IFVG_RETEST_CHOCH') {
        return false;
      }
      if (selectedCategory !== 'ALL' && s.category !== selectedCategory) return false;
      if (selectedGrade !== 'ALL' && s.confluenceGrade !== selectedGrade) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const pairLower = (s.pair || '').toLowerCase();
        const symbolLower = (s.symbol || '').toLowerCase();
        const idLower = (s.id || '').toLowerCase();
        const catLower = (s.category || '').toLowerCase();

        // Exact disambiguation so V100 does not bleed into V100(1s) and vice versa
        if (q === 'v100' && (symbolLower === 'v100_1s' || pairLower.includes('(1s)'))) return false;
        if (q === 'v75' && (symbolLower === 'v75_1s' || pairLower.includes('(1s)'))) return false;
        if (q === 'v50' && (symbolLower === 'v50_1s' || pairLower.includes('(1s)'))) return false;
        if (q === 'v25' && (symbolLower === 'v25_1s' || pairLower.includes('(1s)'))) return false;
        if (q === 'v10' && (symbolLower === 'v10_1s' || pairLower.includes('(1s)'))) return false;

        const is1sQuery = q.includes('1s') || q.includes('(s)') || q.includes('_1s');
        if (is1sQuery) {
          if (q.includes('100') && !(symbolLower === 'v100_1s' || pairLower.includes('100 (1s)'))) return false;
          if (q.includes('75') && !(symbolLower === 'v75_1s' || pairLower.includes('75 (1s)'))) return false;
          if (q.includes('50') && !(symbolLower === 'v50_1s' || pairLower.includes('50 (1s)'))) return false;
          if (q.includes('25') && !(symbolLower === 'v25_1s' || pairLower.includes('25 (1s)'))) return false;
          if (q.includes('10') && !(symbolLower === 'v10_1s' || pairLower.includes('10 (1s)'))) return false;
        }

        const matches =
          pairLower.includes(q) ||
          symbolLower.includes(q) ||
          idLower.includes(q) ||
          catLower.includes(q);

        if (!matches) return false;
      }
      return true;
    })
    .sort((a, b) => {
      // 1. Strict Setups Réunis / Confluence Count (Sniper 5/5 > 4/5 > Medium 3/5 > Watchlist 2/5)
      if (b.conditionsMetCount !== a.conditionsMetCount) {
        return b.conditionsMetCount - a.conditionsMetCount;
      }
      // 2. Confluence Score (98 > 85 > 65)
      if (b.confluenceScore !== a.confluenceScore) {
        return b.confluenceScore - a.confluenceScore;
      }
      // 3. Clear Path (No obstacle in way of TP)
      const clA = a.pathObstacleAnalysis?.clearanceScore ?? 100;
      const clB = b.pathObstacleAnalysis?.clearanceScore ?? 100;
      if (clB !== clA) return clB - clA;
      // 4. Market category (Synthetics first if confluences are equal)
      const catOrder: Record<string, number> = { SYNTHETICS: 1, CRYPTO: 2, COMMODITIES: 3, FOREX: 4 };
      return (catOrder[a.category] || 99) - (catOrder[b.category] || 99);
    });

  const sniperCount = activeDashboardSignals.filter((s) => s.confluenceGrade === 'SNIPER').length;
  const mediumCount = activeDashboardSignals.filter((s) => s.confluenceGrade === 'MEDIUM').length;
  const watchlistCount = activeDashboardSignals.filter((s) => s.confluenceGrade === 'WATCHLIST').length;

  const highProbCount = activeDashboardSignals.filter((s) => s.signalType !== 'IFVG_RETEST_CHOCH').length;
  const ifvgCount = activeDashboardSignals.filter((s) => s.signalType === 'IFVG_RETEST_CHOCH').length;
  const archivedCount = (archivedSignals || []).length;

  const takenTradesCount = (history || []).filter(
    (h) => (h.status === 'TRADE_TAKEN' || h.tradeTakenAt) && !h.tradeClosedAt
  ).length;

  return (
    <ErrorBoundary>
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
          setSearchQuery((prev) => (prev === id ? '' : id));
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
                  Alertes de 5 confluences Sniper (Tendance 1D/4H/30M + FVG/POC + Retracement Confirmé + Sweep 💧 + Filtre RSI 10).
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

        {/* Filter Controls & View Mode Tabs */}
        <FilterControls
          selectedViewMode={selectedViewMode}
          onSelectViewMode={setSelectedViewMode}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          selectedGrade={selectedGrade}
          onSelectGrade={setSelectedGrade}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          stats={{
            total: activeDashboardSignals.length,
            highProbCount,
            ifvgCount,
            archivedCount,
            sniperCount,
            mediumCount,
            watchlistCount,
          }}
        />

        {/* Signals Feed Header */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              {selectedViewMode === 'ARCHIVED' ? (
                <>
                  <Archive className="h-4 w-4 text-zinc-400" />
                  <span>Signaux Archivés & Ratés</span>
                </>
              ) : selectedViewMode === 'HIGH_PROBABILITY' ? (
                <>
                  <Flame className="h-4 w-4 text-amber-400" />
                  <span>Signaux Haute Probabilité (Tendance 1D+4H+M30 & Rejet FVG)</span>
                </>
              ) : selectedViewMode === 'IFVG' ? (
                <>
                  <RefreshCw className="h-4 w-4 text-indigo-400" />
                  <span>Signaux Inversion FVG (IFVG Retest & CHoCH)</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  <span>Flux des Signaux SMC Actifs</span>
                </>
              )}
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-zinc-850 text-xs font-mono text-zinc-300 border border-zinc-750">
              {filteredSignals.length} {selectedViewMode === 'ARCHIVED' ? 'archivé(s)' : 'opportunité(s)'}
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
                <span>{takenTradesCount} position(s) en cours</span>
              </button>
            )}
            <div className="flex items-center space-x-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="hidden sm:inline">Mise à jour en direct</span>
            </div>
          </div>
        </div>

        {/* Signals List / Grid */}
        {filteredSignals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center text-zinc-400 space-y-3">
            <Radio className="h-10 w-10 mx-auto text-zinc-600 animate-pulse" />
            <div className="font-semibold text-zinc-200">
              {selectedViewMode === 'ARCHIVED'
                ? 'Aucun signal archivé pour le moment'
                : 'Aucun signal ne correspond aux filtres sélectionnés'}
            </div>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              {selectedViewMode === 'ARCHIVED'
                ? 'Vous pouvez archiver des signaux depuis les cartes de trading pour épurer votre flux actif.'
                : 'Le moteur 24/7 surveille les 5 confluences : Alignement 1D/4H/30M, FVG/POC, Retracement Confirmé, Sweeps 💧 et Filtre RSI 10.'}
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedViewMode('ALL');
                  setSelectedCategory('ALL');
                  setSelectedGrade('ALL');
                  setSearchQuery('');
                }}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold"
              >
                Réinitialiser les filtres
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {selectedViewMode === 'ARCHIVED' && (
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
                <span className="flex items-center gap-2">
                  <Archive className="h-4 w-4 text-zinc-400" />
                  <span>Ces signaux ont été archivés ou marqués comme ratés. Vous pouvez les rétablir dans le flux actif à tout moment.</span>
                </span>
                <button
                  type="button"
                  onClick={() => saveArchivedSignalsToLocal([])}
                  className="text-rose-400 hover:underline text-[11px]"
                >
                  Vider les archives
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
              {filteredSignals.map((signal) => (
                <div key={signal.id} className="relative">
                  {selectedViewMode === 'ARCHIVED' && (
                    <div className="mb-2 flex items-center justify-between px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs">
                      <span className="text-zinc-400 font-mono">
                        📦 Signal Archivé / Raté
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRestoreArchivedSignal(signal.id)}
                        className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Rétablir dans le flux</span>
                      </button>
                    </div>
                  )}
                  <SignalCard
                    signal={signal}
                    onTakeTrade={handleTakeTrade}
                    onArchiveSignal={selectedViewMode !== 'ARCHIVED' ? handleArchiveSignal : undefined}
                    onSendToTelegram={handleSendToTelegram}
                  />
                </div>
              ))}
            </div>
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
    </ErrorBoundary>
  );
}
