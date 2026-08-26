import React from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { PairInfo } from '../types';

interface MarketTickerProps {
  pairs: PairInfo[];
  onSelectPair?: (symbol: string) => void;
}

export const MarketTicker: React.FC<MarketTickerProps> = ({ pairs, onSelectPair }) => {
  if (!pairs || pairs.length === 0) return null;

  return (
    <div className="border-b border-zinc-800/60 bg-zinc-950/60 overflow-hidden py-1.5 select-none">
      <div className="flex items-center space-x-6 animate-none overflow-x-auto no-scrollbar px-4">
        {pairs.map((p) => {
          const isUp = p.change24h >= 0;
          return (
            <div
              key={p.id}
              onClick={() => onSelectPair && onSelectPair(p.id)}
              className="inline-flex items-center space-x-2 text-xs shrink-0 cursor-pointer hover:bg-zinc-900/60 px-2 py-0.5 rounded transition-colors"
            >
              <span className="font-semibold text-zinc-300">{p.symbol}</span>
              <span className="font-mono text-zinc-100">
                {p.price > 1000 ? p.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : p.price.toFixed(p.decimals)}
              </span>
              <span
                className={`inline-flex items-center text-[10px] font-medium ${
                  isUp ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isUp ? <TrendingUp className="h-3 w-3 mr-0.5 inline" /> : <TrendingDown className="h-3 w-3 mr-0.5 inline" />}
                {isUp ? '+' : ''}{p.change24h.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
