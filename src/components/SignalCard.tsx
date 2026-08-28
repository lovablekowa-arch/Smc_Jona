import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  CheckSquare,
  Clock,
  Compass,
  Copy,
  Droplets,
  Flame,
  HelpCircle,
  Layers,
  Milestone,
  Percent,
  RefreshCw,
  Route,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  Zap,
} from 'lucide-react';
import { SMCSignal } from '../types';
import { SMCInteractiveChart } from './SMCInteractiveChart';

interface SignalCardProps {
  signal: SMCSignal;
  onTakeTrade: (signal: SMCSignal) => void;
  onArchiveSignal?: (signal: SMCSignal) => void;
  onSendToTelegram: (signal: SMCSignal) => void;
}

export const SignalCard: React.FC<SignalCardProps> = ({
  signal,
  onTakeTrade,
  onArchiveSignal,
  onSendToTelegram,
}) => {
  const [copied, setCopied] = useState(false);
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [showObstaclesDetails, setShowObstaclesDetails] = useState(false);

  const isBuy = signal.direction === 'BUY';
  const c1 = signal.confluences.condition1_HTFTrend;
  const c2 = signal.confluences.condition2_FVG_OB;
  const c3 = signal.confluences.condition3_Fibonacci;
  const c4 = signal.confluences.condition4_LiquiditySweep;
  const c5 = signal.confluences.condition5_RSI10;
  const retracementConf = c3.retracementConfirmation;
  const obstacleData = signal.pathObstacleAnalysis;

  const handleCopy = () => {
    const obstacleInfo = obstacleData?.hasObstacle && obstacleData.primaryObstacle
      ? `\n⚠️ Obstacle détecté: ${obstacleData.primaryObstacle.label} à ${obstacleData.primaryObstacle.priceLevel} (Arrêt/TP partiel conseillé)`
      : `\n🟢 Chemin Ouvert: Voie libre vers TP1 et TP2`;

    const rsiText = c5?.rsiInfo
      ? `\n📊 RSI 10 (H1: ${c5.rsiInfo.rsi10_H1} | M30: ${c5.rsiInfo.rsi10_M30}) : ${c5.satisfied ? 'Validé ✅' : 'Non conforme ⚠️'}`
      : '';

    const retracementText = retracementConf
      ? `\n🔥 Confirmation Retracement: ${retracementConf.candleDescription}`
      : '';

    const text = `📊 SMC SIGNAL: ${signal.pair} (${signal.direction === 'BUY' ? 'ACHAT' : 'VENTE'})
🎯 Type: ${signal.signalType === 'IFVG_RETEST_CHOCH' ? 'Inversion FVG (IFVG & Retest)' : 'Haute Probabilité (Tendance 1D+4H+M30)'}
🎯 Grade: ${signal.confluenceGrade} (${signal.conditionsMetCount}/5 Confluences)
🔹 Entrée: ${signal.entryPrice.toFixed(4)}
🛑 Stop Loss: ${signal.stopLoss.toFixed(4)}
🎯 TP1 (Resting Liquidity): ${signal.tp1.toFixed(4)}
🎯 TP2 (Resting Liquidity): ${signal.tp2.toFixed(4)}
⚖️ Ratio R:R: 1:${signal.riskRewardRatio}${obstacleInfo}${rsiText}${retracementText}
💧 Sweep: ${c4.sweep?.description || 'Confirmé'}
🧊 FVG Récent: ${c2.recentUnmitigatedFVG?.label || 'Non mitigé'} ${c2.recentUnmitigatedFVG?.pocPrice ? `[POC: ${c2.recentUnmitigatedFVG.pocPrice}]` : ''}
🔄 IFVG Inversé: ${c2.inversionFVG?.label || 'Non actif'}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTelegramClick = async () => {
    setSendingTelegram(true);
    await onSendToTelegram(signal);
    setSendingTelegram(false);
  };

  // Grade styling
  const gradeStyles = {
    SNIPER: {
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      label: '🎯 SNIPER (95% - 100%)',
      glow: 'border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.08)]',
    },
    MEDIUM: {
      badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      label: '⚡ BON SETUP (75% - 90%)',
      glow: 'border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.08)]',
    },
    WATCHLIST: {
      badge: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
      label: '👁️ À SURVEILLER (60% - 70%)',
      glow: 'border-zinc-800 hover:border-zinc-700',
    },
  }[signal.confluenceGrade];

  return (
    <div
      id={`signal-card-${signal.symbol}`}
      className={`relative rounded-xl bg-zinc-900/90 border ${gradeStyles.glow} p-4 sm:p-5 transition-all flex flex-col justify-between`}
    >
      {/* Top Header: Pair, Signal Type, Direction, Grade & Time */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-800/80">
          <div className="flex items-center space-x-2 flex-wrap">
            <span className="text-lg font-bold text-zinc-100 tracking-tight">{signal.pair}</span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
              {signal.category}
            </span>

            {/* Signal Type & Trade Lifecycle Badge */}
            {signal.setupProgressStatus === 'TRADE_EN_COURS' ? (
              <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold bg-amber-950/90 text-amber-300 border border-amber-500/50 animate-pulse">
                <RefreshCw className="h-3 w-3" />
                TRADE EN COURS 🔄
              </span>
            ) : signal.setupProgressStatus === 'RETEST_FVG' ? (
              <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold bg-sky-950/90 text-sky-300 border border-sky-500/50">
                <Target className="h-3 w-3 text-sky-400" />
                RETEST FVG PENDANT TRADE 🎯
              </span>
            ) : signal.signalType === 'IFVG_RETEST_CHOCH' ? (
              <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold bg-indigo-950/90 text-indigo-300 border border-indigo-500/40">
                <RefreshCw className="h-3 w-3" />
                IFVG & CHoCH Retest 🔄
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold bg-amber-950/90 text-amber-300 border border-amber-500/40">
                <Flame className="h-3 w-3 text-amber-400" />
                Haute Probabilité (1D+4H+M30) ⭐
              </span>
            )}

            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${
                isBuy
                  ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-950/90 text-rose-300 border border-rose-500/30'
              }`}
            >
              {isBuy ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {isBuy ? 'ACHAT (LONG)' : 'VENTE (SHORT)'}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${gradeStyles.badge}`}>
              {gradeStyles.label}
            </span>
            <span className="text-[11px] text-zinc-500 font-mono flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {signal.formattedTime}
            </span>
          </div>
        </div>

        {/* Retracement Tap-in status / POC test banner */}
        {c2.recentUnmitigatedFVG?.isPriceInsideFVG && (
          <div className="mt-3 mb-2 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-950/80 via-emerald-950/80 to-amber-950/80 border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)] flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-2">
              <span className="text-sm">🎯</span>
              <div>
                <span className="text-xs font-bold text-amber-200 block">
                  {c2.recentUnmitigatedFVG.fvgRetracementState === 'TESTING_POC'
                    ? '🔥 EN TEST DU POC INTRA-FVG (Point d\'Entrée Institutionnel)'
                    : '⚡ RETRACEMENT EN COURS : Le prix est entré dans le FVG !'}
                </span>
                <span className="text-[10px] text-amber-300/80 font-mono">
                  Zone FVG: {c2.recentUnmitigatedFVG.low > 500 ? c2.recentUnmitigatedFVG.low.toFixed(1) : c2.recentUnmitigatedFVG.low.toFixed(4)} — {c2.recentUnmitigatedFVG.high > 500 ? c2.recentUnmitigatedFVG.high.toFixed(1) : c2.recentUnmitigatedFVG.high.toFixed(4)} ({c2.recentUnmitigatedFVG.fvgFillPercentage ?? 50}% comblé)
                </span>
              </div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-400 text-zinc-950 font-bold font-mono uppercase tracking-wider">
              Zone Active
            </span>
          </div>
        )}

        {/* 🗺️ SMC ROADMAP & OBSTACLES BANNER (Image 1 vs Image 2) */}
        {obstacleData && (
          <div
            className={`my-3 p-3 rounded-lg border transition-all ${
              obstacleData.hasObstacle
                ? 'bg-gradient-to-r from-purple-950/70 via-amber-950/50 to-zinc-950/80 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.12)]'
                : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                {obstacleData.hasObstacle ? (
                  <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5 animate-bounce" />
                ) : (
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold tracking-tight text-zinc-100 flex items-center gap-1.5">
                      {obstacleData.hasObstacle ? (
                        <span className="text-amber-300 font-extrabold uppercase">
                          ⚠️ Obstacle Détecté sur la Trajectoire (Image 1)
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-extrabold uppercase">
                          🟢 Chemin 100% Ouvert vers TP1 & TP2 (Image 2)
                        </span>
                      )}
                    </span>

                    {obstacleData.hasObstacle && obstacleData.primaryObstacle && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-purple-900/90 text-purple-200 border border-purple-400/40 font-mono font-bold">
                        {obstacleData.primaryObstacle.timeframe} • Vol: {obstacleData.primaryObstacle.volumeAmount || '4.594K'}
                      </span>
                    )}

                    {!obstacleData.hasObstacle && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-900/80 text-emerald-200 border border-emerald-500/40 font-mono font-bold">
                        Voie Libre 100%
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-zinc-300 mt-1 leading-snug">
                    {obstacleData.roadmapSummary}
                  </p>

                  {obstacleData.hasObstacle && obstacleData.primaryObstacle && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900/90 border border-purple-500/40 text-purple-300 font-mono">
                        <Milestone className="h-3.5 w-3.5 text-purple-400" />
                        <span className="text-zinc-400">Niveau Obstacle :</span>
                        <strong className="text-amber-300 font-bold text-xs">
                          {obstacleData.primaryObstacle.priceLevel > 500
                            ? obstacleData.primaryObstacle.priceLevel.toLocaleString('en-US', { minimumFractionDigits: 2 })
                            : obstacleData.primaryObstacle.priceLevel.toFixed(4)}
                        </strong>
                      </div>

                      <span className="text-[11px] text-amber-200 bg-amber-950/80 border border-amber-500/30 px-2 py-0.5 rounded font-medium">
                        🛑 Conseil : Sécuriser / TP partiel à ce niveau avant {obstacleData.primaryObstacle.blocksTarget === 'BEFORE_TP1' ? 'TP1' : 'TP2'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowObstaclesDetails(!showObstaclesDetails)}
                className="text-[10px] text-zinc-400 hover:text-zinc-200 underline shrink-0 mt-0.5"
              >
                {showObstaclesDetails ? 'Masquer détails' : 'Voir obstacles'}
              </button>
            </div>

            {/* Expandable Obstacles List & Volume Profiles */}
            {showObstaclesDetails && (
              <div className="mt-3 pt-2.5 border-t border-zinc-800/80 text-xs space-y-2">
                <div className="font-semibold text-zinc-300 flex items-center gap-1.5 text-[11px]">
                  <Route className="h-3.5 w-3.5 text-sky-400" />
                  <span>Cartographie Détaillée des Niveaux de Liquidité & Obstacles :</span>
                </div>

                {obstacleData.obstacles.length > 0 ? (
                  <div className="space-y-1.5">
                    {obstacleData.obstacles.map((obs, oIdx) => (
                      <div
                        key={oIdx}
                        className="p-2 rounded bg-zinc-900/90 border border-purple-500/30 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-purple-400 font-bold">#{oIdx + 1}</span>
                          <div>
                            <span className="font-semibold text-zinc-200 text-xs block">
                              {obs.label}
                            </span>
                            <span className="text-[10px] text-zinc-400">
                              {obs.impactDescription}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-mono font-bold text-amber-300 block">
                            {obs.priceLevel > 500 ? obs.priceLevel.toLocaleString('en-US', { minimumFractionDigits: 2 }) : obs.priceLevel.toFixed(4)}
                          </span>
                          {obs.volumeAmount && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 font-mono">
                              Vol: {obs.volumeAmount}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-emerald-300/90 italic bg-emerald-950/30 p-2 rounded border border-emerald-500/20">
                    Aucun FVG opposé, zone de rejet majeur ou Order Block institutionnel n'a été détecté entre votre entrée et TP2. La liquidité vers les sommets/creux est totalement accessible.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Execution Price Matrix (Entry, SL, TP1, TP2, R:R) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 my-3.5 bg-zinc-950/70 p-3 rounded-lg border border-zinc-800/70">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-0.5">
              Prix d'Entrée
            </span>
            <span className="text-sm sm:text-base font-bold font-mono text-zinc-100">
              {signal.entryPrice > 500 ? signal.entryPrice.toLocaleString('en-US', { minimumFractionDigits: 2 }) : signal.entryPrice.toFixed(4)}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-400 block mb-0.5">
              Stop Loss (SL)
            </span>
            <span className="text-sm sm:text-base font-bold font-mono text-rose-400">
              {signal.stopLoss > 500 ? signal.stopLoss.toLocaleString('en-US', { minimumFractionDigits: 2 }) : signal.stopLoss.toFixed(4)}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 block mb-0.5">
              TP1 (Resting Liq.)
            </span>
            <span className="text-sm sm:text-base font-bold font-mono text-emerald-400">
              {signal.tp1 > 500 ? signal.tp1.toLocaleString('en-US', { minimumFractionDigits: 2 }) : signal.tp1.toFixed(4)}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 block mb-0.5">
              TP2 (Equal H/L)
            </span>
            <span className="text-sm sm:text-base font-bold font-mono text-emerald-400">
              {signal.tp2 > 500 ? signal.tp2.toLocaleString('en-US', { minimumFractionDigits: 2 }) : signal.tp2.toFixed(4)}
            </span>
          </div>

          <div className="col-span-2 sm:col-span-1 border-t sm:border-t-0 sm:border-l border-zinc-800 pt-2 sm:pt-0 sm:pl-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-400 block mb-0.5">
              Ratio R:R
            </span>
            <span className="text-sm sm:text-base font-bold font-mono text-sky-300">
              1 : {signal.riskRewardRatio}
            </span>
          </div>
        </div>

        {/* 📈 Clean Interactive SMC Reacting Chart (Reacting FVG / IFVG / OB & Execution Lines) */}
        <SMCInteractiveChart signal={signal} />

        {/* 5 Confluence Checks Matrix */}
        <div className="space-y-2 my-4">
          <div className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>Matrice des 5 Confluences Haute Probabilité :</span>
            </span>
            <span className="font-mono text-emerald-400 font-bold">
              {signal.conditionsMetCount} / 5 Réunies
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {/* Condition 1: Pure Price Structure & HTF Trend */}
            <div
              className={`p-2.5 rounded-lg border flex items-start space-x-2 ${
                c1.satisfied
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                  : 'bg-zinc-950/40 border-zinc-800 text-zinc-400'
              }`}
            >
              <CheckCircle2
                className={`h-4 w-4 mt-0.5 shrink-0 ${
                  c1.satisfied ? 'text-emerald-400' : 'text-zinc-600'
                }`}
              />
              <div className="w-full">
                <div className="font-semibold text-zinc-200 flex items-center justify-between flex-wrap gap-1">
                  <span>1. Structure Pure &amp; Tendance Multi-TF</span>
                  {c1.satisfied ? (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-900/60 text-emerald-300 font-mono">
                      {c1.isH4DirectorException ? 'H4 DIRECTEUR ⚡' : 'STRUCTURE OK ✅'}
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-900/60 text-rose-300 font-mono">
                      {c1.isAccumulationBlocked ? 'ACCUMULATION 🛑' : 'NON ALIGNÉ ⛔'}
                    </span>
                  )}
                </div>
                
                {/* Timeframe Swings Grid */}
                <div className="grid grid-cols-3 gap-1 mt-1.5 text-[10px] font-mono">
                  <div className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 flex flex-col">
                    <span className="text-zinc-400">D1 :</span>
                    <span className={c1.daily?.bias === 'BULLISH' ? 'text-emerald-400 font-bold' : c1.daily?.bias === 'BEARISH' ? 'text-rose-400 font-bold' : 'text-amber-400'}>
                      {c1.daily?.structure || c1.daily?.bias}
                    </span>
                  </div>
                  <div className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 flex flex-col">
                    <span className="text-zinc-400">H4 :</span>
                    <span className={c1.fourHour?.bias === 'BULLISH' ? 'text-emerald-400 font-bold' : c1.fourHour?.bias === 'BEARISH' ? 'text-rose-400 font-bold' : 'text-amber-400'}>
                      {c1.fourHour?.structure || c1.fourHour?.bias}
                    </span>
                  </div>
                  <div className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 flex flex-col">
                    <span className="text-zinc-400">M30 :</span>
                    <span className={c1.thirtyMin?.bias === 'BULLISH' ? 'text-emerald-400 font-bold' : c1.thirtyMin?.bias === 'BEARISH' ? 'text-rose-400 font-bold' : 'text-amber-400'}>
                      {c1.thirtyMin?.structure || c1.thirtyMin?.bias}
                    </span>
                  </div>
                </div>

                {c1.m15M5RetracementInfo && (
                  <p className="text-[10px] text-zinc-400 mt-1 italic leading-tight">
                    {c1.m15M5RetracementInfo}
                  </p>
                )}
              </div>
            </div>

            {/* Condition 2: Suite FVG M30 & M15 (Alignement Strict Obligatoire) + Confirmation d'Entrée M15/M30 + Macro H4/Daily Informatifs */}
            <div
              className={`p-2.5 rounded-lg border flex items-start space-x-2 ${
                c2.satisfied
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                  : 'bg-zinc-950/40 border-zinc-800 text-zinc-400'
              }`}
            >
              <Layers
                className={`h-4 w-4 mt-0.5 shrink-0 ${
                  c2.satisfied ? 'text-emerald-400' : 'text-zinc-600'
                }`}
              />
              <div className="w-full">
                <div className="font-semibold text-zinc-200 flex items-center justify-between flex-wrap gap-1">
                  <span className="flex items-center gap-1.5 flex-wrap">
                    <span>2. Suite FVG (M30 &amp; M15) &amp; Entrée</span>
                    {c2.fvgSequenceM30M15Confirmed && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-900/80 text-emerald-200 border border-emerald-500/40 font-mono font-bold tracking-tight">
                        SUITE M30+M15 VALIDÉE ✅
                      </span>
                    )}
                    {c2.recentUnmitigatedFVG?.highProbability && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/90 text-amber-300 border border-amber-500/40 font-mono font-bold tracking-tight">
                        HAUTE PROBABILITÉ ⭐
                      </span>
                    )}
                  </span>

                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-950/80 text-sky-300 border border-sky-500/30 font-mono">
                    Entrée: {c2.entryConfirmationTimeframe || '15M'}
                  </span>
                </div>

                <div className="text-[11px] space-y-1.5 mt-1.5">
                  {/* FVG H1, M30 & M15 Sequence details */}
                  <div className="grid grid-cols-1 gap-1">
                    {c2.fvgH1 && (
                      <div className="flex items-center justify-between bg-purple-950/40 px-2 py-1 rounded border border-purple-500/30 text-purple-200">
                        <span className="flex items-center gap-1">
                          <strong className="text-purple-300 font-mono">FVG H1 (Contexte Majeur) :</strong>
                          <span className="text-zinc-300">
                            {c2.fvgH1.low > 500 ? c2.fvgH1.low.toLocaleString('en-US', { minimumFractionDigits: 1 }) : c2.fvgH1.low.toFixed(4)} — {c2.fvgH1.high > 500 ? c2.fvgH1.high.toLocaleString('en-US', { minimumFractionDigits: 1 }) : c2.fvgH1.high.toFixed(4)}
                          </span>
                        </span>
                        <span className="text-[10px] text-purple-300 font-mono">
                          {c2.fvgH1.sizePercent}% ({c2.fvgH1.ageHours}h)
                        </span>
                      </div>
                    )}

                    {c2.fvgM30 && (
                      <div className="flex items-center justify-between bg-zinc-900/80 px-2 py-1 rounded border border-zinc-800 text-zinc-300">
                        <span className="flex items-center gap-1">
                          <strong className="text-sky-400 font-mono">FVG M30 (Structure) :</strong>
                          <span className="text-zinc-300">
                            {c2.fvgM30.low > 500 ? c2.fvgM30.low.toLocaleString('en-US', { minimumFractionDigits: 1 }) : c2.fvgM30.low.toFixed(4)} — {c2.fvgM30.high > 500 ? c2.fvgM30.high.toLocaleString('en-US', { minimumFractionDigits: 1 }) : c2.fvgM30.high.toFixed(4)}
                          </span>
                        </span>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {c2.fvgM30.sizePercent}% ({c2.fvgM30.ageHours}h)
                        </span>
                      </div>
                    )}

                    {c2.fvgM15 && (
                      <div className="flex items-center justify-between bg-emerald-950/40 px-2 py-1 rounded border border-emerald-500/30 text-emerald-200">
                        <span className="flex items-center gap-1">
                          <strong className="text-emerald-300 font-mono">FVG M15 (Point d'Entrée &amp; POC) :</strong>
                          <span className="text-emerald-100">
                            {c2.fvgM15.low > 500 ? c2.fvgM15.low.toLocaleString('en-US', { minimumFractionDigits: 1 }) : c2.fvgM15.low.toFixed(4)} — {c2.fvgM15.high > 500 ? c2.fvgM15.high.toLocaleString('en-US', { minimumFractionDigits: 1 }) : c2.fvgM15.high.toFixed(4)}
                          </span>
                        </span>
                        <div className="flex items-center gap-1">
                          {c2.fvgM15.pocPrice && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-500/30 font-mono">
                              POC: {c2.fvgM15.pocPrice}
                            </span>
                          )}
                          <span className="text-[10px] text-emerald-300 font-mono">
                            {c2.fvgM15.sizePercent}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Informative Macro FVGs (H4 and Daily) */}
                  {(c2.macroFvgH4 || c2.macroFvgDaily || c2.macroFvgInformativeSummary) && (
                    <div className="p-1.5 rounded bg-zinc-950/80 border border-purple-500/20 text-[10px] text-purple-200/90 leading-tight">
                      <span className="font-semibold text-purple-300">💡 Confluence Macro (Informatif) : </span>
                      {c2.macroFvgH4 && (
                        <span>
                          FVG H4 ({c2.macroFvgH4.low > 500 ? c2.macroFvgH4.low.toLocaleString('en-US', { minimumFractionDigits: 1 }) : c2.macroFvgH4.low.toFixed(4)} - {c2.macroFvgH4.high > 500 ? c2.macroFvgH4.high.toLocaleString('en-US', { minimumFractionDigits: 1 }) : c2.macroFvgH4.high.toFixed(4)})
                        </span>
                      )}
                      {c2.macroFvgH4 && c2.macroFvgDaily && <span> + </span>}
                      {c2.macroFvgDaily && (
                        <span>
                          FVG Daily 1D ({c2.macroFvgDaily.low > 500 ? c2.macroFvgDaily.low.toLocaleString('en-US', { minimumFractionDigits: 1 }) : c2.macroFvgDaily.low.toFixed(4)} - {c2.macroFvgDaily.high > 500 ? c2.macroFvgDaily.high.toLocaleString('en-US', { minimumFractionDigits: 1 }) : c2.macroFvgDaily.high.toFixed(4)})
                        </span>
                      )}
                      <span className="text-zinc-400"> — renforcent le flux institutionnel global.</span>
                    </div>
                  )}

                  {c2.inversionFVG && (
                    <div className="flex items-center justify-between text-indigo-300 font-medium bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-500/30">
                      <span className="flex items-center gap-1">
                        <span>🔄</span>
                        <strong className="text-indigo-200">IFVG {c2.inversionFVG.timeframe}</strong> Inversé ({c2.inversionFVG.role === 'INVERTED_SUPPORT' ? 'Support' : 'Résistance'})
                      </span>
                      <span className="text-[10px] text-indigo-300 font-mono">
                        {c2.inversionFVG.sizePercent}% {c2.inversionFVG.retested ? '• Retesté' : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Condition 3: Retracement FVG & Bougie de Confirmation (Displacement Candle) & Internal Liquidity */}
            <div
              className={`p-2.5 rounded-lg border flex items-start space-x-2 ${
                c3.satisfied
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                  : 'bg-zinc-950/40 border-zinc-800 text-zinc-400'
              }`}
            >
              <Percent
                className={`h-4 w-4 mt-0.5 shrink-0 ${
                  c3.satisfied ? 'text-emerald-400' : 'text-zinc-600'
                }`}
              />
              <div>
                <div className="font-semibold text-zinc-200 flex items-center gap-1.5 flex-wrap">
                  <span>3. Retracement ({isBuy ? 'Discount < 50%' : 'Premium > 50%'})</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                      retracementConf?.strongCandleConfirmed
                        ? 'bg-emerald-900/60 text-emerald-300'
                        : 'bg-amber-900/40 text-amber-300'
                    }`}
                  >
                    {retracementConf?.strongCandleConfirmed ? 'Confirmé 🔥' : 'En Attente'}
                  </span>
                  {c3.internalLiquiditySwept && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-950/90 text-sky-300 border border-sky-500/30 font-mono">
                      💧 Liquidité Interne Balayée
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-300 mt-0.5 leading-tight">
                  {retracementConf?.candleDescription || c3.summary}
                </p>
              </div>
            </div>

            {/* Condition 4: Liquidity Sweep & Immediate Rejection */}
            <div
              className={`p-2.5 rounded-lg border flex items-start space-x-2 ${
                c4.satisfied
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                  : 'bg-zinc-950/40 border-zinc-800 text-zinc-400'
              }`}
            >
              <Droplets
                className={`h-4 w-4 mt-0.5 shrink-0 ${
                  c4.satisfied ? 'text-emerald-400' : 'text-zinc-600'
                }`}
              />
              <div>
                <div className="font-semibold text-zinc-200">
                  4. Balayage Liquidité Sweep 💧 & Rejet
                </div>
                <p className="text-[11px] text-zinc-300 mt-0.5 leading-tight">
                  {c4.sweep?.description || 'Sweep en attente'}
                </p>
              </div>
            </div>

            {/* Condition 5: RSI 10 Filter (H1 & M30) */}
            <div
              className={`col-span-1 sm:col-span-2 p-2.5 rounded-lg border flex items-start space-x-2 ${
                c5?.satisfied
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                  : 'bg-rose-950/20 border-rose-500/30 text-rose-200'
              }`}
            >
              <Activity
                className={`h-4 w-4 mt-0.5 shrink-0 ${
                  c5?.satisfied ? 'text-emerald-400' : 'text-rose-400'
                }`}
              />
              <div className="w-full">
                <div className="font-semibold text-zinc-200 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span>5. Filtre RSI 10 (H1 & M30)</span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      (Pas d'achat si &gt;70, Pas de vente si &lt;30)
                    </span>
                  </span>
                  {c5?.rsiInfo && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                      H1: <strong className="text-zinc-100">{c5.rsiInfo.rsi10_H1}</strong> | M30: <strong className="text-zinc-100">{c5.rsiInfo.rsi10_M30}</strong>
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-300 mt-0.5 leading-tight">
                  {c5?.rsiInfo?.summary || c5?.summary || 'Filtre RSI 10 actif'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Resting Liquidity Targets Display */}
        {c4.restingTargets.length > 0 && (
          <div className="mb-4 rounded-lg bg-zinc-950/60 border border-zinc-800/80 p-2.5 text-xs">
            <span className="font-semibold text-zinc-400 block mb-1.5 text-[11px] uppercase tracking-wider">
              🎯 Liquidités Non Balayées Restantes (Cibles TP) :
            </span>
            <div className="flex flex-wrap gap-2">
              {c4.restingTargets.map((t, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 rounded-md bg-zinc-900 border border-zinc-750 px-2.5 py-1 text-zinc-200 font-mono text-xs"
                >
                  <Target className="h-3 w-3 text-emerald-400" />
                  <span className="text-zinc-300">{t.label}:</span>
                  <span className="font-bold text-emerald-400">
                    {t.priceLevel > 500 ? t.priceLevel.toLocaleString('en-US', { minimumFractionDigits: 2 }) : t.priceLevel.toFixed(4)}
                  </span>
                  <span className="text-[10px] text-zinc-500">({t.distancePercent}%)</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-zinc-800/80">
        {/* Left Actions: Trade Taken & Archive/Missed */}
        <div className="flex items-center space-x-2">
          {signal.tradeTaken ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
              <CheckSquare className="h-3.5 w-3.5 text-emerald-400" />
              <span>Trade Pris (Sourdine 6h)</span>
            </div>
          ) : (
            <button
              id={`take-trade-btn-${signal.symbol}`}
              type="button"
              onClick={() => onTakeTrade(signal)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors border border-zinc-700 hover:border-emerald-500/50"
              title="Prendre ce trade (archivera la position dans l'historique et retirera la paire du dashboard pendant 6h)"
            >
              <CheckSquare className="h-3.5 w-3.5 text-zinc-400" />
              <span>Prendre Trade</span>
            </button>
          )}

          {/* Archive / Missed Signal button */}
          {onArchiveSignal && (
            <button
              id={`archive-signal-btn-${signal.symbol}`}
              type="button"
              onClick={() => onArchiveSignal(signal)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs border border-zinc-800 transition-colors"
              title="Archiver ce signal ou le marquer comme raté pour épurer le flux"
            >
              <Archive className="h-3 w-3" />
              <span>Archiver / Raté</span>
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Copy Order Details */}
          <button
            id={`copy-order-btn-${signal.symbol}`}
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-750 text-zinc-300 text-xs font-medium border border-zinc-700/60 transition-colors"
          >
            <Copy className="h-3 w-3 text-zinc-400" />
            <span>{copied ? 'Copié !' : 'Copier Ordre'}</span>
          </button>

          {/* Force Instant Send to Telegram */}
          <button
            id={`send-telegram-btn-${signal.symbol}`}
            type="button"
            onClick={handleTelegramClick}
            disabled={sendingTelegram}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-zinc-950 text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
          >
            <Send className="h-3 w-3" />
            <span>{sendingTelegram ? 'Envoi...' : 'Alerter Telegram'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
