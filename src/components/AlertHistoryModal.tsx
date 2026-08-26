import React, { useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Filter,
  History,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { AlertHistoryItem } from '../types';

interface AlertHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: AlertHistoryItem[];
}

export const AlertHistoryModal: React.FC<AlertHistoryModalProps> = ({
  isOpen,
  onClose,
  history,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState<'ALL' | 'TODAY' | '24H' | '7D'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DELIVERED' | 'TRADE_TAKEN' | 'LOCAL'>('ALL');

  if (!isOpen) return null;

  const now = Date.now();
  const filteredHistory = history.filter((item) => {
    // Search filter
    if (
      searchTerm &&
      !item.pair.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !item.category.toLowerCase().includes(searchTerm.toLowerCase())
    ) {
      return false;
    }

    // Time filter
    if (timeFilter === 'TODAY') {
      const itemDate = new Date(item.timestamp).toDateString();
      const todayDate = new Date(now).toDateString();
      if (itemDate !== todayDate) return false;
    } else if (timeFilter === '24H') {
      if (now - item.timestamp > 24 * 60 * 60 * 1000) return false;
    } else if (timeFilter === '7D') {
      if (now - item.timestamp > 7 * 24 * 60 * 60 * 1000) return false;
    }

    // Status filter
    if (statusFilter === 'DELIVERED' && !item.telegramSent) return false;
    if (statusFilter === 'TRADE_TAKEN' && item.status !== 'TRADE_TAKEN') return false;
    if (statusFilter === 'LOCAL' && item.status !== 'LOCAL_ONLY') return false;

    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        id="alert-history-modal"
        className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-5 sm:p-6 text-zinc-100 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-100">
                Historique des Alertes & Signaux SMC
              </h2>
              <p className="text-xs text-zinc-400">
                {history.length} signaux enregistrés par le moteur de scan 24/7
              </p>
            </div>
          </div>
          <button
            id="close-history-modal-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="my-4 space-y-2.5 shrink-0">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                id="history-search-input"
                type="text"
                placeholder="Rechercher paire (ex: BTC, EUR, XAU, V75)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 pl-9 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
              />
            </div>

            {/* Time Filter Pills */}
            <div className="flex items-center space-x-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs">
              {(['ALL', 'TODAY', '24H', '7D'] as const).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTimeFilter(tf)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    timeFilter === tf
                      ? 'bg-zinc-800 text-zinc-100 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {tf === 'ALL' ? 'Tous' : tf === 'TODAY' ? "Aujourd'hui" : tf === '24H' ? '24h' : '7 jours'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {filteredHistory.length === 0 ? (
            <div className="py-12 text-center text-zinc-500">
              <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Aucune alerte trouvée pour ces filtres.</p>
            </div>
          ) : (
            filteredHistory.map((item) => {
              const isBuy = item.direction === 'BUY';
              const dateStr = new Date(item.timestamp).toLocaleString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
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
                          <span className="font-bold px-2 py-0.5 rounded text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-500/40 font-mono flex items-center gap-1">
                            <span>🎯</span> Retracement FVG
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
                            Trade Pris (Mute)
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-500">Local (Bot non configuré)</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-zinc-800 flex justify-end shrink-0">
          <button
            id="close-history-footer-btn"
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
