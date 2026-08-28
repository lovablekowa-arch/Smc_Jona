import React from 'react';
import { Archive, Crosshair, Filter, Flame, Layers, RefreshCw, Search, Sparkles, Zap } from 'lucide-react';
import { ConfluenceGrade, MarketCategory } from '../types';

export type SignalViewMode = 'ALL' | 'HIGH_PROBABILITY' | 'IFVG' | 'ARCHIVED';

interface FilterControlsProps {
  selectedViewMode: SignalViewMode;
  onSelectViewMode: (mode: SignalViewMode) => void;
  selectedCategory: MarketCategory | 'ALL';
  onSelectCategory: (cat: MarketCategory | 'ALL') => void;
  selectedGrade: ConfluenceGrade | 'ALL';
  onSelectGrade: (grade: ConfluenceGrade | 'ALL') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  stats: {
    total: number;
    highProbCount: number;
    ifvgCount: number;
    archivedCount: number;
    sniperCount: number;
    mediumCount: number;
    watchlistCount: number;
  };
}

export const FilterControls: React.FC<FilterControlsProps> = ({
  selectedViewMode,
  onSelectViewMode,
  selectedCategory,
  onSelectCategory,
  selectedGrade,
  onSelectGrade,
  searchQuery,
  onSearchChange,
  stats,
}) => {
  return (
    <div className="space-y-3">
      {/* Top Main Mode Selector: High Probability / IFVG / All / Archives */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-zinc-900/90 border border-zinc-800">
        <button
          type="button"
          onClick={() => onSelectViewMode('ALL')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            selectedViewMode === 'ALL'
              ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5 text-zinc-300" />
          <span>Tous les Signaux ({stats.total})</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectViewMode('HIGH_PROBABILITY')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            selectedViewMode === 'HIGH_PROBABILITY'
              ? 'bg-amber-950 border border-amber-500/50 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
              : 'text-zinc-400 hover:text-amber-300 hover:bg-amber-950/30'
          }`}
        >
          <Flame className="h-3.5 w-3.5 text-amber-400" />
          <span>⭐ Haute Probabilité (1D+4H+M30) ({stats.highProbCount})</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectViewMode('IFVG')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            selectedViewMode === 'IFVG'
              ? 'bg-indigo-950 border border-indigo-500/50 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
              : 'text-zinc-400 hover:text-indigo-300 hover:bg-indigo-950/30'
          }`}
        >
          <RefreshCw className="h-3.5 w-3.5 text-indigo-400" />
          <span>🔄 Inversion FVG (IFVG & Retest) ({stats.ifvgCount})</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectViewMode('ARCHIVED')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ml-auto ${
            selectedViewMode === 'ARCHIVED'
              ? 'bg-zinc-800 border border-zinc-600 text-zinc-200 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
          }`}
        >
          <Archive className="h-3.5 w-3.5 text-zinc-400" />
          <span>📦 Archives & Ratés ({stats.archivedCount})</span>
        </button>
      </div>

      {/* Category Tabs & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Market Category Selector */}
        <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
          {[
            { id: 'ALL', label: '🌐 Tous les Marchés' },
            { id: 'SYNTHETICS' as MarketCategory, label: '⚡ Deriv Volatility (Priorité 1)' },
            { id: 'CRYPTO' as MarketCategory, label: '🪙 Crypto (Binance)' },
            { id: 'FOREX' as MarketCategory, label: '💱 Forex Inst.' },
            { id: 'COMMODITIES' as MarketCategory, label: '🥇 Matières (Or/Pétrole)' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectCategory(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === tab.id
                  ? 'bg-emerald-600 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            id="market-search-input"
            type="text"
            placeholder="Filtrer paire (BTC, EUR, XAU, V75)..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-xl bg-zinc-900/90 border border-zinc-800 pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
          />
        </div>
      </div>

      {/* Confluence Tier Filter & Counter Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-zinc-400 font-medium hidden sm:inline">
            Filtre Confluences :
          </span>

          <button
            type="button"
            onClick={() => onSelectGrade('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              selectedGrade === 'ALL'
                ? 'bg-zinc-800 border-zinc-600 text-zinc-100'
                : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Tous ({stats.total})
          </button>

          <button
            type="button"
            onClick={() => onSelectGrade('SNIPER')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
              selectedGrade === 'SNIPER'
                ? 'bg-emerald-950 border-emerald-500/50 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                : 'bg-zinc-900/50 border-zinc-800 text-emerald-400 hover:border-zinc-700'
            }`}
          >
            <Crosshair className="h-3.5 w-3.5 text-emerald-400" />
            <span>🎯 Sniper 5/5 ou 4/5 ({stats.sniperCount})</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectGrade('MEDIUM')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
              selectedGrade === 'MEDIUM'
                ? 'bg-amber-950 border-amber-500/50 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                : 'bg-zinc-900/50 border-zinc-800 text-amber-400 hover:border-zinc-700'
            }`}
          >
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            <span>⚡ Bon Setup 3/5 ({stats.mediumCount})</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectGrade('WATCHLIST')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
              selectedGrade === 'WATCHLIST'
                ? 'bg-sky-950 border-sky-500/50 text-sky-300'
                : 'bg-zinc-900/50 border-zinc-800 text-sky-400 hover:border-zinc-700'
            }`}
          >
            <span>👁️ Watchlist 2/5 ({stats.watchlistCount})</span>
          </button>
        </div>

        <div className="text-xs text-zinc-500 font-mono hidden md:block">
          Algorithme SMC 5 Confluences & RSI 10 💧
        </div>
      </div>
    </div>
  );
};
