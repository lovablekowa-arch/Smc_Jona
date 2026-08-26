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
  const [settings, setSettings] = useState<TelegramSettings>(DEFAULT_SETTINGS);
  const [history, setHistory] = useState<AlertHistoryItem[]>([]);
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
      } else if (!quiet && (!signals || signals.length === 0)) {
        // If initial load returned empty cache, trigger instant scan
        fetch('/api/scan', { method: 'POST' })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (data?.signals && Array.isArray(data.signals)) {
              setSignals(data.signals);
            }
          })
          .catch(() => {});
      }

      if (pairsData && Array.isArray(pairsData) && pairsData.length > 0) {
        setPairs(pairsData);
      }

      if (settingsData && typeof settingsData === 'object' && settingsData.scanIntervalMinutes) {
        setSettings((prev) => ({ ...prev, ...settingsData }));
      }

      if (historyData && Array.isArray(historyData)) {
        setHistory(historyData);
      }
    } catch {
      // Silent catch to prevent console error spam during dev restarts
    } finally {
      if (!quiet) setIsScanning(false);
    }
  }, []);

  // Trigger manual on-demand scan
  const handleTriggerScan = async () => {
    setIsScanning(true);
    showToast('Scan 24/7 en cours sur tous les marchés...', 'info');
    try {
      const res = await fetch('/api/scan', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSignals(data.signals || []);
        showToast(
          `Scan terminé : ${data.signals?.length || 0} paires analysées (${data.alertsDispatched || 0} alertes Telegram envoyées)`,
          'success',
        );
        fetchData(true);
      }
    } catch (err: any) {
      showToast('Erreur lors du scan: ' + err.message, 'error');
    } finally {
      setIsScanning(false);
    }
  };

  // Mark trade taken (mute pair for 6h)
  const handleTakeTrade = async (pairSymbol: string) => {
    try {
      const res = await fetch('/api/take-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairSymbol, hours: settings.antiDuplicateHours || 6 }),
      });
      if (res.ok) {
        showToast(`Trade pris pour ${pairSymbol} ! Paire mise en sourdine pendant ${settings.antiDuplicateHours || 6}h.`, 'success');
        fetchData(true);
      }
    } catch (err: any) {
      showToast('Erreur: ' + err.message, 'error');
    }
  };

  // Force send a signal to Telegram
  const handleSendToTelegram = async (signal: SMCSignal) => {
    if (!settings.botToken || !settings.chatId) {
      setIsSettingsOpen(true);
      showToast('Veuillez configurer votre Bot Telegram d\'abord !', 'error');
      return;
    }

    try {
      const res = await fetch('/api/telegram/send-signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signal }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Alerte détaillée pour ${signal.pair} envoyée sur Telegram !`, 'success');
        if (settings.soundEnabled) playAlertSound('MEDIUM');
        fetchData(true);
      } else {
        showToast(`Erreur Telegram: ${data.error}`, 'error');
      }
    } catch (err: any) {
      showToast('Erreur lors de l\'envoi: ' + err.message, 'error');
    }
  };

  // Save settings
  const handleSaveSettings = async (newSettings: Partial<TelegramSettings>) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      if (res.ok) {
        const saved = await res.json();
        setSettings(saved);
        showToast('Paramètres et configuration 24/7 sauvegardés avec succès !', 'success');
      }
    } catch (err: any) {
      showToast('Erreur lors de la sauvegarde: ' + err.message, 'error');
    }
  };

  // Test Telegram credentials
  const handleTestTelegram = async (botToken: string, chatId: string) => {
    const res = await fetch('/api/telegram/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botToken, chatId }),
    });
    return res.json();
  };

  // Toggle sound
  const handleToggleSound = () => {
    const newVal = !settings.soundEnabled;
    setSettings((prev) => ({ ...prev, soundEnabled: newVal }));
    handleSaveSettings({ soundEnabled: newVal });
    if (newVal) playAlertSound('TEST');
  };

  // Initial load
  useEffect(() => {
    fetchData();

    // Fast price poll every 8 seconds
    const interval = setInterval(() => {
      fetchData(true);
    }, 8000);

    return () => clearInterval(interval);
  }, [fetchData]);

  // Countdown timer for next scan
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

  // Filter signals
  const filteredSignals = signals.filter((s) => {
    if (selectedCategory !== 'ALL' && s.category !== selectedCategory) return false;
    if (selectedGrade !== 'ALL' && s.confluenceGrade !== selectedGrade) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!s.pair.toLowerCase().includes(q) && !s.category.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const sniperCount = signals.filter((s) => s.confluenceGrade === 'SNIPER').length;
  const mediumCount = signals.filter((s) => s.confluenceGrade === 'MEDIUM').length;
  const watchlistCount = signals.filter((s) => s.confluenceGrade === 'WATCHLIST').length;

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
            total: signals.length,
            sniperCount,
            mediumCount,
            watchlistCount,
          }}
        />

        {/* Signals Feed Header */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-zinc-100">
              Flux des Signaux SMC Détectés
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-zinc-850 text-xs font-mono text-zinc-300 border border-zinc-750">
              {filteredSignals.length} opportunités
            </span>
          </div>

          <div className="flex items-center space-x-2 text-xs text-zinc-400">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="hidden sm:inline">Mise à jour en temps réel</span>
          </div>
        </div>

        {/* Signals List / Grid */}
        {filteredSignals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center text-zinc-400 space-y-3">
            <Radio className="h-10 w-10 mx-auto text-zinc-600 animate-pulse" />
            <div className="font-semibold text-zinc-200">
              Aucun signal ne correspond aux filtres sélectionnés
            </div>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              Le moteur 24/7 surveille les 4 confluences HTF, FVG récents/anciens et balayages de liquidités 💧.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('ALL');
                setSelectedGrade('ALL');
                setSearchQuery('');
              }}
              className="mt-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold"
            >
              Réinitialiser les filtres
            </button>
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
      />
    </div>
  );
}
