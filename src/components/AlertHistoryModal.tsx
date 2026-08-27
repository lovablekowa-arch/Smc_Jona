import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  CheckSquare,
  Clock,
  ExternalLink,
  Filter,
  History,
  Percent,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Target,
  Trash2,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import { AlertHistoryItem, PairInfo } from '../types';

interface AlertHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: AlertHistoryItem[];
  pairs?: PairInfo[];
  onRestoreTrade?: (pairSymbol: string) => void;
  onCloseTrade?: (tradeId: string) => void;
  onDeleteHistoryItem?: (id: string) => void;
  onClearHistory?: () => void;
}

export const AlertHistoryModal: React.FC<AlertHistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  pairs = [],
  onRestoreTrade,
  onCloseTrade,
  onDeleteHistoryItem,
  onClearHistory,
}) => {
  const [activeTab, setActiveTab] = useState<'TAKEN_TRADES' | 'ALL_ALERTS'>('TAKEN_TRADES');
  const [searchTerm, setSearchTerm] = useState('');
  const [tradeFilter, setTradeFilter] = useState<'ALL' | 'IN_PROGRESS' | 'WIN' | 'LOSS'>('ALL');
  const [timeFilter, setTimeFilter] = useState<'ALL' | 'TODAY' | '24H' | '7D'>('ALL');

  // Pair price lookup map
  const pairPriceMap = useMemo(() => {
    const map: Record<string, number> = {};
    pairs.forEach((p) => {
      map[p.symbol] = p.price;
      map[p.id] = p.price;
    });
    return map;
  }, [pairs]);

  if (!isOpen) return null;

  const now = Date.now();

  // Helper to calculate real-time trade progress and outcome
  const getTradeAnalysis = (item: AlertHistoryItem) => {
    const currentPrice = pairPriceMap[item.pair] || item.currentPrice || item.entryPrice;
    const isBuy = item.direction === 'BUY';
    const entry = item.entryPrice || 1;
    const sl = item.stopLoss;
    const tp1 = item.tp1;
    const tp2 = item.tp2;

    let outcome: 'IN_PROGRESS' | 'WIN_TP1' | 'WIN_TP2' | 'LOSS_SL' | 'CLOSED_MANUAL' = item.outcome || 'IN_PROGRESS';
    let pnlPercent = 0;
    let rMultiple = 0;

    if (entry > 0) {
      if (isBuy) {
        pnlPercent = ((currentPrice - entry) / entry) * 100;
        const riskDistance = Math.abs(entry - sl);
        if (riskDistance > 0) {
          rMultiple = (currentPrice - entry) / riskDistance;
        }

        // Check target hits if not manually closed
        if (item.outcome !== 'CLOSED_MANUAL') {
          if (tp2 > 0 && currentPrice >= tp2) {
            outcome = 'WIN_TP2';
          } else if (tp1 > 0 && currentPrice >= tp1) {
            outcome = 'WIN_TP1';
          } else if (sl > 0 && currentPrice <= sl) {
            outcome = 'LOSS_SL';
          } else {
            outcome = 'IN_PROGRESS';
          }
        }
      } else {
        // SELL / SHORT
        pnlPercent = ((entry - currentPrice) / entry) * 100;
        const riskDistance = Math.abs(sl - entry);
        if (riskDistance > 0) {
          rMultiple = (entry - currentPrice) / riskDistance;
        }

        if (item.outcome !== 'CLOSED_MANUAL') {
          if (tp2 > 0 && currentPrice <= tp2) {
            outcome = 'WIN_TP2';
          } else if (tp1 > 0 && currentPrice <= tp1) {
            outcome = 'WIN_TP1';
          } else if (sl > 0 && currentPrice >= sl) {
            outcome = 'LOSS_SL';
          } else {
            outcome = 'IN_PROGRESS';
          }
        }
      }
    }

    // Progress bar calculation towards TP1 / TP2 or SL (0% to 100%)
    let progressPercent = 50;
    if (isBuy && tp1 > entry && sl < entry) {
      if (currentPrice >= entry) {
        const totalDist = tp2 > entry ? tp2 - entry : tp1 - entry;
        progressPercent = 50 + Math.min(50, ((currentPrice - entry) / totalDist) * 50);
      } else {
        const slDist = entry - sl;
        progressPercent = 50 - Math.min(50, ((entry - currentPrice) / slDist) * 50);
      }
    } else if (!isBuy && tp1 < entry && sl > entry) {
      if (currentPrice <= entry) {
        const totalDist = tp2 < entry ? entry - tp2 : entry - tp1;
        progressPercent = 50 + Math.min(50, ((entry - currentPrice) / totalDist) * 50);
      } else {
        const slDist = sl - entry;
        progressPercent = 50 - Math.min(50, ((currentPrice - entry) / slDist) * 50);
      }
    }

    return {
      currentPrice,
      outcome,
      pnlPercent,
      rMultiple,
      progressPercent: Math.max(0, Math.min(100, progressPercent)),
    };
  };

  // Filter taken trades vs general alerts
  const takenTrades = history.filter((h) => h.status === 'TRADE_TAKEN' || h.tradeTakenAt);

  // Taken trades stats
  const takenStats = takenTrades.reduce(
    (acc, item) => {
      const { outcome, pnlPercent } = getTradeAnalysis(item);
      acc.total += 1;
      if (outcome === 'WIN_TP1' || outcome === 'WIN_TP2') acc.wins += 1;
      else if (outcome === 'LOSS_SL') acc.losses += 1;
      else acc.inProgress += 1;
      acc.totalPnl += pnlPercent;
      return acc;
    },
    { total: 0, wins: 0, losses: 0, inProgress: 0, totalPnl: 0 }
  );

  const winRate = takenStats.total > 0 && (takenStats.wins + takenStats.losses > 0)
    ? Math.round((takenStats.wins / (takenStats.wins + takenStats.losses)) * 100)
    : 0;

  // Filtered taken trades
  const filteredTakenTrades = takenTrades.filter((item) => {
    if (searchTerm && !item.pair.toLowerCase().includes(searchTerm.toLowerCase()) && !item.category.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    const { outcome } = getTradeAnalysis(item);
    if (tradeFilter === 'IN_PROGRESS' && outcome !== 'IN_PROGRESS') return false;
    if (tradeFilter === 'WIN' && outcome !== 'WIN_TP1' && outcome !== 'WIN_TP2') return false;
    if (tradeFilter === 'LOSS' && outcome !== 'LOSS_SL') return false;
    return true;
  });

  // Filtered general history
  const filteredGeneralHistory = history.filter((item) => {
    if (searchTerm && !item.pair.toLowerCase().includes(searchTerm.toLowerCase()) && !item.category.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (timeFilter === 'TODAY') {
      const itemDate = new Date(item.timestamp).toDateString();
      if (itemDate !== new Date(now).toDateString()) return false;
    } else if (timeFilter === '24H') {
      if (now - item.timestamp > 24 * 3600 * 1000) return false;
    } else if (timeFilter === '7D') {
      if (now - item.timestamp > 7 * 24 * 3600 * 1000) return false;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        id="alert-history-modal"
        className="w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-4 sm:p-6 text-zinc-100 flex flex-col"
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-zinc-100 flex items-center gap-2">
                Historique & Suivi des Positions SMC
                <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-950 text-emerald-300 border border-emerald-500/30 font-mono">
                  {takenTrades.length} Positions Prises
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Calcul des résultats en direct (TP1, TP2, SL) & Journal des alertes 24/7
              </p>
            </div>
          </div>
          <button
            id="close-history-modal-btn"
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between gap-2 pt-3 pb-2 shrink-0 border-b border-zinc-800/80">
          <div className="flex items-center space-x-1 sm:space-x-2">
            <button
              type="button"
              onClick={() => setActiveTab('TAKEN_TRADES')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'TAKEN_TRADES'
                  ? 'bg-emerald-600 text-zinc-950 shadow-md'
                  : 'bg-zinc-950/60 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              <CheckSquare className="h-4 w-4" />
              <span>Positions Prises & Résultats ({takenTrades.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ALL_ALERTS')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'ALL_ALERTS'
                  ? 'bg-emerald-600 text-zinc-950 shadow-md'
                  : 'bg-zinc-950/60 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              <Activity className="h-4 w-4" />
              <span>Journal Alertes 24/7 ({history.length})</span>
            </button>
          </div>

          {onClearHistory && history.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Voulez-vous effacer tout l\'historique des alertes ?')) {
                  onClearHistory();
                }
              }}
              className="text-zinc-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors text-xs flex items-center gap-1"
              title="Vider l'historique"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Vider</span>
            </button>
          )}
        </div>

        {/* Tab 1: Taken Trades View */}
        {activeTab === 'TAKEN_TRADES' && (
          <div className="flex-1 flex flex-col overflow-hidden min-h-0 pt-3">
            {/* KPI Performance Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pb-3 shrink-0">
              <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800">
                <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Positions Prises</span>
                <span className="text-base font-bold font-mono text-zinc-100">{takenStats.total}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
                <span className="text-[10px] text-emerald-300 uppercase font-semibold block">Gagnées (TP1/TP2)</span>
                <span className="text-base font-bold font-mono text-emerald-400">{takenStats.wins}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/30">
                <span className="text-[10px] text-rose-300 uppercase font-semibold block">Perdues (SL)</span>
                <span className="text-base font-bold font-mono text-rose-400">{takenStats.losses}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-sky-950/40 border border-sky-500/30">
                <span className="text-[10px] text-sky-300 uppercase font-semibold block">En Cours</span>
                <span className="text-base font-bold font-mono text-sky-300">{takenStats.inProgress}</span>
              </div>
              <div className="col-span-2 sm:col-span-1 p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30">
                <span className="text-[10px] text-indigo-300 uppercase font-semibold block">Taux Réussite</span>
                <span className="text-base font-bold font-mono text-indigo-300">{winRate}%</span>
              </div>
            </div>

            {/* Filter Controls for Taken Trades */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 shrink-0">
              {/* Search */}
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Rechercher paire prise (ex: BTC, EUR, XAU)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
                />
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center space-x-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs">
                {[
                  { id: 'ALL', label: 'Toutes' },
                  { id: 'IN_PROGRESS', label: '⏳ En Cours' },
                  { id: 'WIN', label: '🟢 Gagnées' },
                  { id: 'LOSS', label: '🔴 Perdues' },
                ].map((btn) => (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => setTradeFilter(btn.id as any)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      tradeFilter === btn.id
                        ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Taken Trades List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {filteredTakenTrades.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 bg-zinc-950/40 rounded-xl border border-dashed border-zinc-800">
                  <CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-40 text-emerald-400" />
                  <p className="text-sm font-semibold text-zinc-300">Aucune position prise enregistrée</p>
                  <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                    Lorsque vous cliquez sur <strong>"Trade Pris (Sourdine 6h)"</strong> sur un signal du dashboard, il est automatiquement archivé ici pour suivre vos gains TP1, TP2 et SL en direct.
                  </p>
                </div>
              ) : (
                filteredTakenTrades.map((item) => {
                  const isBuy = item.direction === 'BUY';
                  const analysis = getTradeAnalysis(item);
                  const dateStr = new Date(item.tradeTakenAt || item.timestamp).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  // Format prices safely
                  const formatP = (p: number) =>
                    p > 500 ? p.toLocaleString('en-US', { minimumFractionDigits: 2 }) : p.toFixed(4);

                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        analysis.outcome === 'WIN_TP2'
                          ? 'bg-emerald-950/30 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.12)]'
                          : analysis.outcome === 'WIN_TP1'
                          ? 'bg-emerald-950/20 border-emerald-500/30'
                          : analysis.outcome === 'LOSS_SL'
                          ? 'bg-rose-950/20 border-rose-500/30'
                          : 'bg-zinc-950/80 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {/* Top Header of Taken Trade */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-zinc-800/80">
                        <div className="flex items-center space-x-2.5">
                          <span className="text-base font-bold text-zinc-100">{item.pair}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                            {item.category}
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

                        {/* Outcome & Result Badge */}
                        <div className="flex items-center space-x-2">
                          {analysis.outcome === 'WIN_TP2' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                              <Target className="h-3.5 w-3.5 text-emerald-400" />
                              🎯 TP2 ATTEINT (GAGNÉ MAXI)
                            </span>
                          )}

                          {analysis.outcome === 'WIN_TP1' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                              🟢 TP1 ATTEINT (GAGNÉ)
                            </span>
                          )}

                          {analysis.outcome === 'LOSS_SL' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-950 text-rose-300 border border-rose-500/40 text-xs font-bold">
                              <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                              🔴 SL TOUCHÉ (PERDU)
                            </span>
                          )}

                          {analysis.outcome === 'IN_PROGRESS' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-950/80 text-sky-300 border border-sky-500/40 text-xs font-bold animate-pulse">
                              <Activity className="h-3.5 w-3.5 text-sky-400" />
                              ⏳ EN COURS (PnL: {analysis.pnlPercent >= 0 ? '+' : ''}{analysis.pnlPercent.toFixed(2)}%)
                            </span>
                          )}

                          {analysis.outcome === 'CLOSED_MANUAL' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 text-xs font-medium">
                              ✖ Clôturé Manuellement
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Execution Details Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 my-2.5 bg-zinc-950/70 p-2.5 rounded-lg border border-zinc-800/80 text-xs">
                        <div>
                          <span className="text-[10px] text-zinc-400 block font-medium">Prix d'Entrée</span>
                          <span className="font-mono font-bold text-zinc-100">{formatP(item.entryPrice)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-sky-400 block font-medium">Prix Actuel</span>
                          <span className="font-mono font-bold text-sky-300">{formatP(analysis.currentPrice)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-rose-400 block font-medium">Stop Loss (SL)</span>
                          <span className="font-mono font-bold text-rose-400">{formatP(item.stopLoss)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-emerald-400 block font-medium">TP1 (Liq.)</span>
                          <span className="font-mono font-bold text-emerald-400">{formatP(item.tp1)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-emerald-400 block font-medium">TP2 (Equal H/L)</span>
                          <span className="font-mono font-bold text-emerald-400">{formatP(item.tp2)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-amber-400 block font-medium">Ratio R:R</span>
                          <span className="font-mono font-bold text-amber-300">1 : {item.riskRewardRatio}</span>
                        </div>
                      </div>

                      {/* Progress Bar towards Target vs SL */}
                      <div className="space-y-1 mb-2.5">
                        <div className="flex items-center justify-between text-[10px] text-zinc-400">
                          <span className="text-rose-400 font-mono">SL: {formatP(item.stopLoss)}</span>
                          <span className="text-zinc-300 font-medium">
                            Progression: {analysis.pnlPercent >= 0 ? '+' : ''}{analysis.pnlPercent.toFixed(2)}% ({analysis.rMultiple >= 0 ? '+' : ''}{analysis.rMultiple.toFixed(1)}R)
                          </span>
                          <span className="text-emerald-400 font-mono">TP2: {formatP(item.tp2)}</span>
                        </div>
                        <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden flex border border-zinc-800">
                          <div
                            className={`h-full transition-all ${
                              analysis.pnlPercent >= 0 ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-rose-500'
                            }`}
                            style={{ width: `${analysis.progressPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Footer Actions for this Taken Position */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/60 text-xs">
                        <span className="text-[11px] text-zinc-500 font-mono flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Pris le {dateStr}
                        </span>

                        <div className="flex items-center space-x-2">
                          {/* Restore back to dashboard */}
                          {onRestoreTrade && (
                            <button
                              type="button"
                              onClick={() => onRestoreTrade(item.pair)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors border border-zinc-700"
                              title="Réafficher ce signal sur le dashboard principal"
                            >
                              <RotateCcw className="h-3 w-3 text-zinc-400" />
                              <span>Rétablir sur Dashboard</span>
                            </button>
                          )}

                          {/* Close manual */}
                          {onCloseTrade && analysis.outcome === 'IN_PROGRESS' && (
                            <button
                              type="button"
                              onClick={() => onCloseTrade(item.id)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-xs font-medium transition-colors border border-zinc-700"
                              title="Marquer ce trade comme clôturé manuellement"
                            >
                              <CheckCircle2 className="h-3 w-3 text-amber-400" />
                              <span>Clôturer</span>
                            </button>
                          )}

                          {/* Delete */}
                          {onDeleteHistoryItem && (
                            <button
                              type="button"
                              onClick={() => onDeleteHistoryItem(item.id)}
                              className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                              title="Supprimer cette entrée"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 2: All 24/7 Scanner Alerts History */}
        {activeTab === 'ALL_ALERTS' && (
          <div className="flex-1 flex flex-col overflow-hidden min-h-0 pt-3">
            {/* Filter Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 shrink-0">
              {/* Search */}
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Filtrer les alertes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
                />
              </div>

              {/* Time Filter */}
              <div className="flex items-center space-x-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs">
                {(['ALL', 'TODAY', '24H', '7D'] as const).map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => setTimeFilter(tf)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      timeFilter === tf
                        ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {tf === 'ALL' ? 'Tous' : tf === 'TODAY' ? "Aujourd'hui" : tf === '24H' ? '24h' : '7j'}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredGeneralHistory.length === 0 ? (
                <div className="py-12 text-center text-zinc-500">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Aucune alerte enregistrée.</p>
                </div>
              ) : (
                filteredGeneralHistory.map((item) => {
                  const isBuy = item.direction === 'BUY';
                  const dateStr = new Date(item.timestamp).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 hover:border-zinc-700 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-start space-x-3">
                        <div
                          className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                            isBuy ? 'bg-emerald-950/80 text-emerald-400' : 'bg-rose-950/80 text-rose-400'
                          }`}
                        >
                          {isBuy ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-zinc-100 text-sm">{item.pair}</span>
                            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                              {item.category}
                            </span>
                            <span
                              className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                                item.confluenceGrade === 'SNIPER'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                                  : item.confluenceGrade === 'MEDIUM'
                                  ? 'bg-amber-950 text-amber-400 border border-amber-500/30'
                                  : 'bg-sky-950 text-sky-400 border border-sky-500/30'
                              }`}
                            >
                              {item.confluenceGrade} ({item.confluenceScore}%)
                            </span>
                            {item.alertType === 'FVG_TAP_IN' && (
                              <span className="font-bold px-2 py-0.5 rounded text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-500/40 font-mono">
                                🎯 Retracement FVG
                              </span>
                            )}
                          </div>
                          <p className="text-zinc-400 text-[11px] mt-0.5">{item.detailsSummary}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end space-x-3 border-t sm:border-t-0 border-zinc-800 pt-2 sm:pt-0">
                        <div className="text-left sm:text-right">
                          <span className="text-[11px] font-mono text-zinc-400 block">{dateStr}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {item.telegramSent ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-sky-400">
                                <Send className="h-3 w-3" />
                                Envoyé Telegram
                              </span>
                            ) : item.status === 'TRADE_TAKEN' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                                <CheckCircle2 className="h-3 w-3" />
                                Trade Pris
                              </span>
                            ) : (
                              <span className="text-[10px] text-zinc-500">Local (Moteur 24/7)</span>
                            )}
                          </div>
                        </div>

                        {onDeleteHistoryItem && (
                          <button
                            type="button"
                            onClick={() => onDeleteHistoryItem(item.id)}
                            className="p-1 text-zinc-600 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="pt-3 border-t border-zinc-800 flex justify-end shrink-0">
          <button
            id="close-history-footer-btn"
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
