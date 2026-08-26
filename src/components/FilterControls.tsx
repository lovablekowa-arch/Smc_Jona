import React from 'react';
import { Crosshair, Filter, Layers, Search, Sparkles, Zap } from 'lucide-react';
import { ConfluenceGrade, MarketCategory } from '../types';

interface FilterControlsProps {
  selectedCategory: MarketCategory | 'ALL';
  onSelectCategory: (cat: MarketCategory | 'ALL') => void;
  selectedGrade: ConfluenceGrade | 'ALL';
  onSelectGrade: (grade: ConfluenceGrade | 'ALL') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  stats: {
    total: number;
    sniperCount: number;
    mediumCount: number;
    watchlistCount: number;
  };
}

export const FilterControls: React.FC<FilterControlsProps> = ({
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
      {/* Category Tabs & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Market Category Selector */}
        <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
          {[
            { id: 'ALL', label: '🌐 Tous les Marchés' },
            { id: 'CRYPTO' as MarketCategory, label: '🪙 Crypto (Binance)' },
            { id: 'FOREX' as MarketCategory, label: '💱 Forex Inst.' },
            { id: 'COMMODITIES' as MarketCategory, label: '🥇 Matières (Or/Pétrole)' },
            { id: 'SYNTHETICS' as MarketCategory, label: '⚡ Deriv Synthetics' },
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
            <span>🎯 Sniper 4/4 ({stats.sniperCount})</span>
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
            <span>⚡ Bon Setup 3/4 ({stats.mediumCount})</span>
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
            <span>👁️ Watchlist 2/4 ({stats.watchlistCount})</span>
          </button>
        </div>

        <div className="text-xs text-zinc-500 font-mono hidden md:block">
          Algorithme SMC & Sweeps 💧
        </div>
      </div>
    </div>
  );
};
