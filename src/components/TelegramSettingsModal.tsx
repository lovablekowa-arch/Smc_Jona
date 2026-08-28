import React, { useState } from 'react';
import {
  AlertCircle,
  BellRing,
  Bot,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Layers,
  Save,
  Send,
  ShieldCheck,
  Sliders,
  Smartphone,
  X,
  Zap,
} from 'lucide-react';
import { ConfluenceGrade, MarketCategory, PairInfo, TelegramSettings } from '../types';

interface TelegramSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TelegramSettings;
  availablePairs: PairInfo[];
  onSaveSettings: (newSettings: Partial<TelegramSettings>) => Promise<void>;
  onTestTelegram: (token: string, chatId: string) => Promise<{ success: boolean; error?: string }>;
}

export const TelegramSettingsModal: React.FC<TelegramSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  availablePairs,
  onSaveSettings,
  onTestTelegram,
}) => {
  const [botToken, setBotToken] = useState(settings.botToken || '');
  const [chatId, setChatId] = useState(settings.chatId || '');
  const [enabled, setEnabled] = useState(settings.enabled);
  const [alertLevels, setAlertLevels] = useState<ConfluenceGrade[]>(settings.alertLevels || ['SNIPER', 'MEDIUM', 'WATCHLIST']);
  const [activeCategories, setActiveCategories] = useState<MarketCategory[]>(settings.activeCategories || ['CRYPTO', 'FOREX', 'COMMODITIES', 'SYNTHETICS']);
  const [activePairs, setActivePairs] = useState<string[]>(settings.activePairs || []);
  const [targetTimeframes, setTargetTimeframes] = useState<string[]>(settings.targetTimeframes || ['15M', '30M', '1H', '4H', '1D']);
  const [minFvgSizePercent, setMinFvgSizePercent] = useState<number>(settings.minFvgSizePercent || 0.15);
  const [fvgGapFilterStdev, setFvgGapFilterStdev] = useState<number>(settings.fvgGapFilterStdev ?? 0.5);
  const [fvgVolumeProfileBins, setFvgVolumeProfileBins] = useState<number>(settings.fvgVolumeProfileBins || 15);
  const [notifyOnFVGTap, setNotifyOnFVGTap] = useState<boolean>(settings.notifyOnFVGTap ?? true);
  const [showIFVG, setShowIFVG] = useState<boolean>(settings.showIFVG ?? true);
  const [fvgTimeframes, setFvgTimeframes] = useState<string[]>(settings.fvgTimeframes || ['15M', '30M']);
  const [antiDuplicateHours, setAntiDuplicateHours] = useState(settings.antiDuplicateHours || 6);
  const [scanIntervalMinutes, setScanIntervalMinutes] = useState(settings.scanIntervalMinutes || 10);
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled ?? true);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const toggleLevel = (level: ConfluenceGrade) => {
    if (alertLevels.includes(level)) {
      if (alertLevels.length > 1) {
        setAlertLevels(alertLevels.filter((l) => l !== level));
      }
    } else {
      setAlertLevels([...alertLevels, level]);
    }
  };

  const toggleCategory = (cat: MarketCategory) => {
    if (activeCategories.includes(cat)) {
      if (activeCategories.length > 1) {
        setActiveCategories(activeCategories.filter((c) => c !== cat));
      }
    } else {
      setActiveCategories([...activeCategories, cat]);
    }
  };

  const toggleTimeframe = (tf: string) => {
    if (targetTimeframes.includes(tf)) {
      if (targetTimeframes.length > 1) {
        setTargetTimeframes(targetTimeframes.filter((t) => t !== tf));
      }
    } else {
      setTargetTimeframes([...targetTimeframes, tf]);
    }
  };

  const handleTest = async () => {
    const cleanToken = botToken.replace(/\s+/g, '');
    const cleanChat = chatId.replace(/\s+/g, '');
    if (!cleanToken || !cleanChat) {
      setTestResult({ success: false, message: 'Veuillez saisir votre Token Bot et Chat ID avant de tester.' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await onTestTelegram(cleanToken, cleanChat);
      if (res && res.success) {
        setTestResult({ success: true, message: 'Message test envoyé avec succès sur votre Telegram ! Vérifiez votre smartphone.' });
      } else {
        setTestResult({
          success: false,
          message: (res && res.error) || 'Échec de l\'envoi. Avez-vous cliqué sur /start dans Telegram avec votre Bot ?',
        });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err?.message || 'Erreur lors du test' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const cleanToken = botToken.replace(/\s+/g, '');
      const cleanChat = chatId.replace(/\s+/g, '');
      await onSaveSettings({
        botToken: cleanToken,
        chatId: cleanChat,
        enabled,
        alertLevels: alertLevels || ['SNIPER', 'MEDIUM', 'WATCHLIST'],
        activeCategories: activeCategories || ['CRYPTO', 'FOREX', 'COMMODITIES', 'SYNTHETICS'],
        activePairs: activePairs || [],
        targetTimeframes: targetTimeframes || ['15M', '30M', '1H', '4H', '1D'],
        minFvgSizePercent: Number(minFvgSizePercent) || 0.15,
        fvgGapFilterStdev: Number(fvgGapFilterStdev) || 0.5,
        fvgVolumeProfileBins: Number(fvgVolumeProfileBins) || 15,
        notifyOnFVGTap: Boolean(notifyOnFVGTap),
        showIFVG: Boolean(showIFVG),
        fvgTimeframes: fvgTimeframes || ['15M', '30M'],
        antiDuplicateHours: Number(antiDuplicateHours) || 6,
        scanIntervalMinutes: Number(scanIntervalMinutes) || 10,
        soundEnabled: Boolean(soundEnabled),
      });
      onClose();
    } catch (err: any) {
      console.error('Save settings error:', err);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        id="telegram-settings-modal"
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-5 sm:p-6 text-zinc-100 flex flex-col justify-between"
      >
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-zinc-100">
                  Alertes & Paramètres Telegram 24/7
                </h2>
                <p className="text-xs text-zinc-400">
                  Ne manquez aucun signal SMC instantané sur votre smartphone
                </p>
              </div>
            </div>
            <button
              id="close-settings-modal-btn"
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-5 my-5 text-sm">
            {/* 1. Bot Token & Chat ID */}
            <div className="rounded-xl bg-zinc-950/80 p-4 border border-zinc-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-zinc-200 flex items-center gap-2 text-xs uppercase tracking-wider">
                  <Bot className="h-4 w-4 text-sky-400" />
                  Identifiants Telegram Bot
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">Scan 24/7 actif :</span>
                  <input
                    id="telegram-enabled-toggle"
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="h-4 w-4 rounded accent-emerald-500 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  Telegram Bot Token (obtenu via @BotFather)
                </label>
                <input
                  id="telegram-bot-token-input"
                  type="text"
                  placeholder="Ex: 7123456789:AAFlm39..."
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-750 px-3 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  Telegram Chat ID (votre ID ou ID de groupe via @userinfobot)
                </label>
                <input
                  id="telegram-chat-id-input"
                  type="text"
                  placeholder="Ex: 123456789 ou -100123456789"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-750 px-3 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:border-sky-500 focus:outline-none"
                />
              </div>

              {/* Guide Accordion Helper */}
              <div className="rounded-lg bg-sky-950/20 border border-sky-600/30 p-2.5 text-[11px] text-sky-300/90 leading-relaxed">
                💡 <strong>Création en 1 minute :</strong>
                <ol className="list-decimal pl-4 mt-1 space-y-0.5 text-zinc-400">
                  <li>Ouvrez Telegram et cherchez <span className="text-sky-300 font-mono">@BotFather</span>, tapez <span className="text-sky-300 font-mono">/newbot</span> et suivez les instructions pour copier le <strong>Token</strong>.</li>
                  <li>Cherchez <span className="text-sky-300 font-mono">@userinfobot</span> sur Telegram, tapez <span className="text-sky-300 font-mono">/start</span> pour obtenir votre <strong>Chat ID</strong>.</li>
                  <li>Démarrez votre bot en appuyant sur <strong>DÉMARRER (/start)</strong> dans la conversation avec votre bot.</li>
                </ol>
              </div>

              {/* Test Button & Result */}
              <div className="pt-1">
                <button
                  id="test-telegram-btn"
                  type="button"
                  onClick={handleTest}
                  disabled={testing || !botToken || !chatId}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-zinc-950 py-2 text-xs font-semibold transition-all"
                >
                  <Send className={`h-3.5 w-3.5 ${testing ? 'animate-bounce' : ''}`} />
                  <span>{testing ? 'Test en cours...' : 'Tester l\'Alerte Immédiate sur Smartphone 📱'}</span>
                </button>

                {testResult && (
                  <div
                    className={`mt-2 p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                      testResult.success
                        ? 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/40 border border-rose-500/40 text-rose-300'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-rose-400" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Niveaux de Signaux à Recevoir */}
            <div className="space-y-2">
              <label className="font-semibold text-zinc-200 flex items-center gap-2 text-xs uppercase tracking-wider">
                <Zap className="h-4 w-4 text-emerald-400" />
                Niveaux de Confluences à Notifier
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'SNIPER' as ConfluenceGrade, label: '🎯 Sniper (5/5)', desc: '95% - 100% 5 confluences', color: 'emerald' },
                  { id: 'MEDIUM' as ConfluenceGrade, label: '⚡ Bon Setup (3/5 - 4/5)', desc: '75% - 90% confluence', color: 'amber' },
                  { id: 'WATCHLIST' as ConfluenceGrade, label: '👁️ À Surveiller (2/5)', desc: '60% - 70% watchlist', color: 'sky' },
                ].map((tier) => {
                  const active = alertLevels.includes(tier.id);
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => toggleLevel(tier.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        active
                          ? 'bg-zinc-800 border-zinc-600 text-zinc-100 shadow-sm'
                          : 'bg-zinc-950/50 border-zinc-850 text-zinc-500 hover:border-zinc-750'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs">{tier.label}</span>
                        {active && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                      </div>
                      <span className="text-[10px] text-zinc-400 block mt-0.5">{tier.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Marchés & Catégories Actives */}
            <div className="space-y-2">
              <label className="font-semibold text-zinc-200 flex items-center gap-2 text-xs uppercase tracking-wider">
                <Layers className="h-4 w-4 text-sky-400" />
                Marchés Surveillés
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'SYNTHETICS' as MarketCategory, label: '⚡ Synthetics', sub: 'Deriv Volatility (P1)' },
                  { id: 'CRYPTO' as MarketCategory, label: '🪙 Crypto', sub: 'Binance Direct' },
                  { id: 'FOREX' as MarketCategory, label: '💱 Forex', sub: 'Institutionnel' },
                  { id: 'COMMODITIES' as MarketCategory, label: '🥇 Matières', sub: 'Or, Argent, Pétrole' },
                ].map((cat) => {
                  const active = activeCategories.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        active
                          ? 'bg-zinc-800 border-zinc-600 text-zinc-100'
                          : 'bg-zinc-950/50 border-zinc-850 text-zinc-500 hover:border-zinc-750'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs">{cat.label}</span>
                        {active && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                      </div>
                      <span className="text-[10px] text-zinc-400 block mt-0.5">{cat.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Unités de Temps Ciblées */}
            <div className="space-y-2">
              <label className="font-semibold text-zinc-200 flex items-center gap-2 text-xs uppercase tracking-wider">
                <Clock className="h-4 w-4 text-amber-400" />
                Unités de Temps Tendance HTF
              </label>
              <div className="flex flex-wrap gap-2">
                {['15M', '30M', '1H', '4H', '1D'].map((tf) => {
                  const active = targetTimeframes.includes(tf);
                  return (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => toggleTimeframe(tf)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all ${
                        active
                          ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                      }`}
                    >
                      {tf} {active && '✓'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. Calibrage FVG & Inversion IFVG (Smart Money Concepts) */}
            <div className="space-y-3 p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-zinc-200 flex items-center gap-2 text-xs uppercase tracking-wider">
                  <Sliders className="h-4 w-4 text-indigo-400" />
                  Taille & Filtre FVG (Fair Value Gap)
                </label>
                <span className="text-xs px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-500/30 font-mono font-bold">
                  Seuil: {minFvgSizePercent}%
                </span>
              </div>

              {/* FVG Size presets */}
              <div>
                <span className="text-[11px] text-zinc-400 block mb-1.5">
                  Taille minimale considérable pour valider un FVG :
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { label: '0.08% (Scalp 15M)', val: 0.08 },
                    { label: '0.15% (Standard SMC ⭐)', val: 0.15 },
                    { label: '0.25% (Majeur)', val: 0.25 },
                    { label: '0.50% (Swing HTF)', val: 0.50 },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setMinFvgSizePercent(preset.val)}
                      className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium text-center transition-all ${
                        minFvgSizePercent === preset.val
                          ? 'bg-indigo-900/60 border-indigo-400 text-indigo-200 font-bold shadow-sm'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                {/* Custom input slider */}
                <div className="flex items-center gap-3 mt-2">
                  <input
                    type="range"
                    min="0.05"
                    max="1.0"
                    step="0.01"
                    value={minFvgSizePercent}
                    onChange={(e) => setMinFvgSizePercent(parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                  />
                  <input
                    type="number"
                    min="0.01"
                    max="2.0"
                    step="0.01"
                    value={minFvgSizePercent}
                    onChange={(e) => setMinFvgSizePercent(parseFloat(e.target.value) || 0.15)}
                    className="w-16 px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-xs font-mono text-center text-zinc-100"
                  />
                  <span className="text-xs text-zinc-400 font-mono">%</span>
                </div>
              </div>

              {/* FVG Timeframes Selection */}
              <div className="pt-2 border-t border-zinc-850">
                <span className="text-[11px] text-zinc-400 block mb-1">
                  Timeframes d'analyse FVG :
                </span>
                <div className="flex gap-2">
                  {['15M', '30M'].map((tf) => {
                    const active = fvgTimeframes.includes(tf);
                    return (
                      <button
                        key={tf}
                        type="button"
                        onClick={() => {
                          if (active && fvgTimeframes.length > 1) {
                            setFvgTimeframes(fvgTimeframes.filter((t) => t !== tf));
                          } else if (!active) {
                            setFvgTimeframes([...fvgTimeframes, tf]);
                          }
                        }}
                        className={`px-3 py-1 rounded-lg border text-xs font-mono font-bold transition-all ${
                          active
                            ? 'bg-indigo-950/80 border-indigo-500/50 text-indigo-300'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                        }`}
                      >
                        FVG {tf} {active && '✓'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ChartPrime High-Probability Statistical Filter (gap_filter) */}
              <div className="pt-2.5 border-t border-zinc-850 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-zinc-200 block">
                      Filtre Écart-Type (ChartPrime Statistical Filter) 📐
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      Normalisation par ta.stdev(200 bars) pour isoler les déséquilibres institutionnels.
                    </span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-500/30 font-mono font-bold">
                    σ ≥ {fvgGapFilterStdev}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: '0.30σ (Souple)', val: 0.30 },
                    { label: '0.50σ (ChartPrime ⭐)', val: 0.50 },
                    { label: '1.00σ (Strict / High Prob)', val: 1.00 },
                  ].map((p) => (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => setFvgGapFilterStdev(p.val)}
                      className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium text-center transition-all ${
                        fvgGapFilterStdev === p.val
                          ? 'bg-indigo-900/60 border-indigo-400 text-indigo-200 font-bold'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Volume Profile Intra-FVG & POC Resolution */}
              <div className="pt-2.5 border-t border-zinc-850 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-zinc-200 block">
                    Profil de Volume & Point of Control (POC) 📍
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    Calcul du niveau de liquidité institutionnelle maximale à l'intérieur du FVG.
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-zinc-400 font-mono">Tranches :</span>
                  <select
                    value={fvgVolumeProfileBins}
                    onChange={(e) => setFvgVolumeProfileBins(parseInt(e.target.value) || 15)}
                    className="px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-xs font-mono text-zinc-200"
                  >
                    <option value={10}>10 Bins</option>
                    <option value={15}>15 Bins (ChartPrime)</option>
                    <option value={20}>20 Bins</option>
                  </select>
                </div>
              </div>

              {/* FVG Retracement Notification Toggle */}
              <div className="pt-2 border-t border-zinc-850 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-amber-200 flex items-center gap-1.5">
                    <span>Alerte Retracement dans le FVG 🎯</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-500/40 font-mono">
                      RECOMMANDE
                    </span>
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    Envoie une notification Telegram dès que le prix pénètre dans la zone du FVG / teste le POC.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setNotifyOnFVGTap(!notifyOnFVGTap)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    notifyOnFVGTap ? 'bg-amber-600' : 'bg-zinc-800'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      notifyOnFVGTap ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* IFVG Toggle */}
              <div className="pt-2 border-t border-zinc-850 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-zinc-200 block">
                    Détection des Inversion FVG (IFVG) 🔄
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    Détecte les FVG transpercés dont le rôle s'inverse en Support/Résistance.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIFVG(!showIFVG)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    showIFVG ? 'bg-indigo-600' : 'bg-zinc-800'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      showIFVG ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* 6. Anti-doublons & Intervalle de Scan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="rounded-xl bg-zinc-950/80 p-3 border border-zinc-800">
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Sourdine "Trade Pris" (Anti-Doublon)
                </label>
                <div className="flex items-center gap-2">
                  <select
                    id="anti-duplicate-select"
                    value={antiDuplicateHours}
                    onChange={(e) => setAntiDuplicateHours(Number(e.target.value))}
                    className="w-full rounded-lg bg-zinc-900 border border-zinc-750 px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none"
                  >
                    <option value={2}>2 Heures</option>
                    <option value={4}>4 Heures</option>
                    <option value={6}>6 Heures (Recommandé)</option>
                    <option value={12}>12 Heures</option>
                    <option value={24}>24 Heures</option>
                  </select>
                </div>
                <span className="text-[10px] text-zinc-500 block mt-1">
                  Mute la paire après clic sur "Trade Pris".
                </span>
              </div>

              <div className="rounded-xl bg-zinc-950/80 p-3 border border-zinc-800">
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Fréquence de Scan 24/7
                </label>
                <div className="flex items-center gap-2">
                  <select
                    id="scan-interval-select"
                    value={scanIntervalMinutes}
                    onChange={(e) => setScanIntervalMinutes(Number(e.target.value))}
                    className="w-full rounded-lg bg-zinc-900 border border-zinc-750 px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none"
                  >
                    <option value={3}>Toutes les 3 minutes (Turbo)</option>
                    <option value={5}>Toutes les 5 minutes</option>
                    <option value={10}>Toutes les 10 minutes (Optimal)</option>
                    <option value={15}>Toutes les 15 minutes</option>
                    <option value={30}>Toutes les 30 minutes</option>
                  </select>
                </div>
                <span className="text-[10px] text-zinc-500 block mt-1">
                  Scan continu en arrière-plan sans interruption.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end space-x-2.5 pt-4 border-t border-zinc-800">
          <button
            id="cancel-settings-btn"
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors"
          >
            Fermer
          </button>
          <button
            id="save-settings-btn"
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 text-xs font-bold shadow-md transition-all disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Enregistrement...' : 'Sauvegarder les Paramètres'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
