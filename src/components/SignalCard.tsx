import React, { useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  CheckSquare,
  Clock,
  Copy,
  Droplets,
  Layers,
  Percent,
  Send,
  ShieldAlert,
  Target,
  Timer,
  Zap,
} from 'lucide-react';
import { SMCSignal } from '../types';

interface SignalCardProps {
  signal: SMCSignal;
  onTakeTrade: (signal: SMCSignal) => void;
  onSendToTelegram: (signal: SMCSignal) => void;
}

export const SignalCard: React.FC<SignalCardProps> = ({
  signal,
  onTakeTrade,
  onSendToTelegram,
}) => {
  const [copied, setCopied] = useState(false);
  const [sendingTelegram, setSendingTelegram] = useState(false);

  const isBuy = signal.direction === 'BUY';
  const c1 = signal.confluences.condition1_HTFTrend;
  const c2 = signal.confluences.condition2_FVG_OB;
  const c3 = signal.confluences.condition3_Fibonacci;
  const c4 = signal.confluences.condition4_LiquiditySweep;

  const handleCopy = () => {
    const text = `📊 SMC SIGNAL: ${signal.pair} (${signal.direction === 'BUY' ? 'ACHAT' : 'VENTE'})
🎯 Grade: ${signal.confluenceGrade} (${signal.conditionsMetCount}/4 Confluences)
🔹 Entrée: ${signal.entryPrice.toFixed(4)}
🛑 Stop Loss: ${signal.stopLoss.toFixed(4)}
🎯 TP1 (Resting Liquidity): ${signal.tp1.toFixed(4)}
🎯 TP2 (Resting Liquidity): ${signal.tp2.toFixed(4)}
⚖️ Ratio R:R: 1:${signal.riskRewardRatio}
💧 Sweep: ${c4.sweep?.description || 'Confirmé'}
🧊 FVG Récent: ${c2.recentUnmitigatedFVG?.label || 'Non mitigé'} ${c2.recentUnmitigatedFVG?.pocPrice ? `[POC: ${c2.recentUnmitigatedFVG.pocPrice}]` : ''}
🔄 IFVG Inversé: ${c2.inversionFVG?.label || 'Non actif'}
⏳ FVG Ancien: ${c2.ancientMitigatedFVG?.label || 'Déjà mitigé'}`;

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
      {/* Top Header: Pair, Direction, Grade & Time */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-800/80">
          <div className="flex items-center space-x-2.5">
            <span className="text-lg font-bold text-zinc-100 tracking-tight">{signal.pair}</span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
              {signal.category}
            </span>
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

        {/* Execution Price Matrix (Entry, SL, TP1, TP2, R:R) */}
        {c2.recentUnmitigatedFVG?.isPriceInsideFVG && (
          <div className="mb-2.5 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-950/80 via-emerald-950/80 to-amber-950/80 border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)] flex items-center justify-between animate-pulse">
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

        {/* 4 Confluence Checks Matrix */}
        <div className="space-y-2 mb-4">
          <div className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
            <span>Matrice des 4 Confluences SMC :</span>
            <span className="font-mono text-emerald-400 font-bold">
              {signal.conditionsMetCount} / 4 Réunies
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {/* Condition 1: HTF Trend (1D, 4H, 30M) */}
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
              <div>
                <div className="font-semibold text-zinc-200 flex items-center gap-1.5">
                  <span>1. Tendance HTF (1D / 4H / 30M)</span>
                  {c1.satisfied ? (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-900/60 text-emerald-300">
                      Alignée OK
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                      Partiel
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-tight">
                  Daily: {c1.daily.bias} | 4H: {c1.fourHour.bias} | 30M: {c1.thirtyMin.bias}
                </p>
              </div>
            </div>

            {/* Condition 2: FVG & OB (Recent vs Ancient Mitigated) & IFVG with ChartPrime Volume Profile */}
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
                <div className="font-semibold text-zinc-200 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span>2. FVG (15M / 30M) & Volume Profile</span>
                    {c2.recentUnmitigatedFVG?.highProbability && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/90 text-amber-300 border border-amber-500/40 font-mono font-bold tracking-tight">
                        HAUTE PROBABILITÉ ⭐
                      </span>
                    )}
                  </span>
                  {c2.recentUnmitigatedFVG && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-950/80 text-sky-300 border border-sky-500/30 font-mono">
                      {c2.recentUnmitigatedFVG.timeframe} • {c2.recentUnmitigatedFVG.sizePercent}%
                    </span>
                  )}
                </div>
                <div className="text-[11px] space-y-1.5 mt-1">
                  {c2.recentUnmitigatedFVG && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-emerald-400 font-medium">
                        <span>
                          • <strong className="text-emerald-300">FVG {c2.recentUnmitigatedFVG.timeframe}</strong> Récent ({c2.recentUnmitigatedFVG.ageHours}h) NON MITIGÉ
                        </span>
                        <div className="flex items-center gap-1">
                          {c2.recentUnmitigatedFVG.stdevRatio && (
                            <span className="text-[9px] px-1 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-500/30 font-mono">
                              σ {c2.recentUnmitigatedFVG.stdevRatio}
                            </span>
                          )}
                          <span className="text-[10px] px-1 rounded bg-emerald-900/60 text-emerald-300 font-mono">
                            +{c2.recentUnmitigatedFVG.sizePercent}%
                          </span>
                        </div>
                      </div>

                      {/* FVG Retracement & Tap-In Status */}
                      <div className="flex items-center justify-between text-[10px] bg-zinc-950/60 px-2 py-1 rounded border border-zinc-800/60">
                        <span className="text-zinc-300 flex items-center gap-1.5 font-medium">
                          {c2.recentUnmitigatedFVG.isPriceInsideFVG ? (
                            <>
                              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                              <span className="text-emerald-300 font-bold">Prix dans le FVG ({c2.recentUnmitigatedFVG.fvgFillPercentage ?? 50}% comblé)</span>
                            </>
                          ) : c2.recentUnmitigatedFVG.fvgRetracementState === 'APPROACHING' ? (
                            <>
                              <span className="h-2 w-2 rounded-full bg-sky-400" />
                              <span className="text-sky-300">En approche du FVG ({c2.recentUnmitigatedFVG.distanceToFVGPercent}% dist.)</span>
                            </>
                          ) : (
                            <>
                              <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                              <span className="text-zinc-400">En attente de retracement</span>
                            </>
                          )}
                        </span>
                        <span className="text-zinc-500 font-mono text-[9px]">
                          Zone: {c2.recentUnmitigatedFVG.low > 500 ? c2.recentUnmitigatedFVG.low.toFixed(1) : c2.recentUnmitigatedFVG.low.toFixed(4)} - {c2.recentUnmitigatedFVG.high > 500 ? c2.recentUnmitigatedFVG.high.toFixed(1) : c2.recentUnmitigatedFVG.high.toFixed(4)}
                        </span>
                      </div>

                      {/* Intra-Gap Volume Profile & POC (Point of Control) */}
                      {c2.recentUnmitigatedFVG.pocPrice && (
                        <div className="p-1.5 rounded bg-zinc-950/90 border border-zinc-800/80 space-y-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-amber-400 font-mono font-semibold flex items-center gap-1">
                              <span>📍 POC Intra-FVG:</span>
                              <span className="text-zinc-100 bg-amber-950/70 px-1 rounded border border-amber-500/30 font-bold">
                                {c2.recentUnmitigatedFVG.pocPrice}
                              </span>
                            </span>
                            <span className="text-zinc-400 font-mono text-[9px]">
                              Zone: {c2.recentUnmitigatedFVG.low > 500 ? c2.recentUnmitigatedFVG.low.toFixed(1) : c2.recentUnmitigatedFVG.low.toFixed(4)} - {c2.recentUnmitigatedFVG.high > 500 ? c2.recentUnmitigatedFVG.high.toFixed(1) : c2.recentUnmitigatedFVG.high.toFixed(4)}
                            </span>
                          </div>

                          {/* Mini Volume Profile Histogram (bins) */}
                          {c2.recentUnmitigatedFVG.volumeBins && (
                            <div className="flex items-end gap-0.5 h-3.5 w-full bg-zinc-900/80 rounded px-1 py-0.5 overflow-hidden">
                              {c2.recentUnmitigatedFVG.volumeBins.slice(0, 15).map((b, i) => (
                                <div
                                  key={i}
                                  title={`Prix: ${b.price} | Volume: ${b.volume} ${b.isPOC ? '(POC)' : ''}`}
                                  className={`flex-1 rounded-t transition-all ${
                                    b.isPOC
                                      ? 'bg-amber-400 h-full shadow-[0_0_4px_rgba(251,191,36,0.6)]'
                                      : signal.direction === 'BUY'
                                      ? 'bg-emerald-600/70'
                                      : 'bg-rose-600/70'
                                  }`}
                                  style={{ height: b.isPOC ? '100%' : `${Math.max(20, Math.round(b.ratio * 100))}%` }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
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

                  {c2.ancientMitigatedFVG && (
                    <p className="text-zinc-500 line-through text-[10px]">
                      • FVG {c2.ancientMitigatedFVG.timeframe} Ancien ({c2.ancientMitigatedFVG.ageHours}h) déjà mitigé (100% comblé)
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Condition 3: Fibonacci Discount / Premium */}
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
                <div className="font-semibold text-zinc-200 flex items-center gap-1.5">
                  <span>3. Fibonacci ({c3.fiboData.currentZone})</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                      c3.fiboData.isFavorable
                        ? 'bg-emerald-900/60 text-emerald-300'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {c3.fiboData.discountPercentage}%
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-tight">
                  {isBuy ? 'Zone Discount (< 50%)' : 'Zone Premium (> 50%)'} | OTE 62%-79%
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
        {/* Trade Taken Mute Button */}
        {signal.tradeTaken ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
            <CheckSquare className="h-3.5 w-3.5 text-emerald-400" />
            <span>Trade Pris (Sourdine 6h active)</span>
          </div>
        ) : (
          <button
            id={`take-trade-btn-${signal.symbol}`}
            type="button"
            onClick={() => onTakeTrade(signal)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors border border-zinc-700 hover:border-emerald-500/50"
            title="Prendre ce trade (archivera la position dans l'historique avec suivi PnL/TP/SL et retirera la paire du dashboard pendant 6h)"
          >
            <CheckSquare className="h-3.5 w-3.5 text-zinc-400" />
            <span>Trade Pris (Sourdine 6h)</span>
          </button>
        )}

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
