import React from 'react';
import { Activity, Bell, History, Play, RefreshCw, Send, Settings, ShieldCheck, Volume2, VolumeX } from 'lucide-react';
import { TelegramSettings } from '../types';

interface NavbarProps {
  settings: TelegramSettings;
  isScanning: boolean;
  onTriggerScan: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onToggleSound: () => void;
  nextScanSeconds: number;
  takenTradesCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  settings,
  isScanning,
  onTriggerScan,
  onOpenSettings,
  onOpenHistory,
  onToggleSound,
  nextScanSeconds,
  takenTradesCount = 0,
}) => {
  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isTelegramConfigured = Boolean(settings.botToken && settings.chatId);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand & 24/7 Status */}
        <div className="flex items-center space-x-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-semibold text-zinc-100 tracking-tight text-base sm:text-lg">
                SMC <span className="text-emerald-400 font-bold">Liquidity</span> Signals
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/80 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/30">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                24/7 ACTIF
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 hidden sm:block">
              Moteur 4 Confluences HTF & Liquidité Sweeps 💧
            </p>
          </div>
        </div>

        {/* Center: Next Scan Countdown */}
        <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-300">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <RefreshCw className={`h-3.5 w-3.5 text-emerald-400 ${isScanning ? 'animate-spin' : ''}`} />
            <span>Prochain scan auto:</span>
          </div>
          <span className="font-mono font-semibold text-emerald-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
            {formatSeconds(nextScanSeconds)}
          </span>
          <span className="text-[10px] text-zinc-500">({settings.scanIntervalMinutes || 10}m)</span>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-2 sm:space-x-2.5">
          {/* Audio Alert Toggle */}
          <button
            id="audio-toggle-btn"
            type="button"
            onClick={onToggleSound}
            title={settings.soundEnabled ? 'Désactiver les alertes sonores' : 'Activer les alertes sonores'}
            className={`p-2 rounded-lg border transition-colors ${
              settings.soundEnabled
                ? 'bg-zinc-900 border-zinc-700 text-emerald-400 hover:bg-zinc-800'
                : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-zinc-400 hover:bg-zinc-900'
            }`}
          >
            {settings.soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>

          {/* Trigger Manual Scan */}
          <button
            id="manual-scan-btn"
            type="button"
            onClick={onTriggerScan}
            disabled={isScanning}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 px-3 py-2 text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isScanning ? 'Scan...' : 'Scanner'}</span>
          </button>

          {/* Alert History Button */}
          <button
            id="history-btn"
            type="button"
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 px-3 py-2 text-xs font-medium transition-colors"
          >
            <History className="h-3.5 w-3.5 text-zinc-400" />
            <span className="hidden sm:inline">Historique</span>
            {takenTradesCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/40 text-[10px] font-mono font-bold">
                {takenTradesCount}
              </span>
            )}
          </button>

          {/* Telegram Settings Button */}
          <button
            id="settings-btn"
            type="button"
            onClick={onOpenSettings}
            className={`relative flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
              isTelegramConfigured
                ? 'bg-sky-950/40 border-sky-600/40 text-sky-300 hover:bg-sky-900/40'
                : 'bg-amber-950/40 border-amber-600/40 text-amber-300 hover:bg-amber-900/40'
            }`}
          >
            <Send className="h-3.5 w-3.5 text-sky-400" />
            <span className="hidden sm:inline">Telegram</span>
            {!isTelegramConfigured && (
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping absolute -top-0.5 -right-0.5" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
