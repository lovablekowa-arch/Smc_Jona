import React, { useState, useRef, useMemo } from 'react';
import { SMCSignal, Candle, FVGInfo, IFVGInfo } from '../types';
import {
  Maximize2,
  Minimize2,
  Crosshair,
  Layers,
  Flame,
  CheckCircle2,
  Zap,
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Target,
  Sparkles,
} from 'lucide-react';

interface SMCInteractiveChartProps {
  signal: SMCSignal;
  initialExpanded?: boolean;
}

export const SMCInteractiveChart: React.FC<SMCInteractiveChartProps> = ({
  signal,
  initialExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [hoveredCandle, setHoveredCandle] = useState<{ candle: Candle; index: number; x: number; y: number } | null>(null);
  const [showMidline, setShowMidline] = useState(true);
  const [showPOC, setShowPOC] = useState(true);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const isBuy = signal.direction === 'BUY';
  const fvg: FVGInfo | undefined = signal.confluences.condition2_FVG_OB.recentUnmitigatedFVG;
  const ifvg: IFVGInfo | undefined = signal.confluences.condition2_FVG_OB.inversionFVG;
  const ob = signal.confluences.condition2_FVG_OB.orderBlock;
  const obstacle = signal.pathObstacleAnalysis?.primaryObstacle;

  // Use available candles or generate clean sequence reflecting the SMC impulse + retracement into FVG
  const candles: Candle[] = useMemo(() => {
    if (signal.candles && signal.candles.length >= 10) {
      return signal.candles;
    }
    // Generate 26 clean candles illustrating the setup
    const generated: Candle[] = [];
    const count = 26;
    const baseP = signal.currentPrice || signal.entryPrice;
    const isBull = signal.direction === 'BUY';
    const now = signal.timestamp || Date.now();
    const timeStep = 30 * 60 * 1000;
    const startTime = now - count * timeStep;
    let p = isBull ? baseP * 0.988 : baseP * 1.012;

    const fvgTarget = fvg ? (fvg.low + fvg.high) / 2 : (isBull ? baseP * 0.995 : baseP * 1.005);

    for (let i = 0; i < count; i++) {
      const open = p;
      let close = open;
      if (i < 10) {
        // Impulse departure creating the FVG
        close = isBull ? open + baseP * 0.0018 : open - baseP * 0.0018;
      } else if (i < 20) {
        // Clean retracement into the FVG gap
        close = open + (fvgTarget - open) * 0.28;
      } else if (i === 22) {
        // Touch of 50% CE / POC followed by immediate rejection candle
        close = isBull ? open + baseP * 0.0032 : open - baseP * 0.0032;
      } else {
        close = baseP;
      }
      const bodyMax = Math.max(open, close);
      const bodyMin = Math.min(open, close);
      const high = bodyMax + baseP * 0.0006;
      const low = bodyMin - baseP * 0.0006;
      p = close;
      generated.push({
        time: startTime + i * timeStep,
        open,
        high,
        low,
        close,
        volume: Math.floor(2000 + Math.random() * 3000),
      });
    }
    return generated;
  }, [signal.candles, signal.currentPrice, signal.entryPrice, signal.direction, signal.timestamp, fvg]);

  // Chart dimensions & scaling
  const height = isExpanded ? 360 : 225;
  const padding = { top: 32, right: 115, bottom: 28, left: 16 };

  // Calculate min and max price including all levels and FVG
  const priceExtent = useMemo(() => {
    let min = Math.min(...candles.map((c) => c.low));
    let max = Math.max(...candles.map((c) => c.high));

    // Include key levels so they are never clipped
    const levelsToInclude = [
      signal.entryPrice,
      signal.stopLoss,
      signal.tp1,
      signal.tp2,
      fvg?.high,
      fvg?.low,
      fvg?.pocPrice,
      ifvg?.high,
      ifvg?.low,
      ob?.high,
      ob?.low,
      obstacle?.priceLevel,
    ].filter((v): v is number => typeof v === 'number' && !isNaN(v) && v > 0);

    for (const lvl of levelsToInclude) {
      if (lvl < min) min = lvl;
      if (lvl > max) max = lvl;
    }

    // Add 6% buffer for clean margins
    const buffer = (max - min) * 0.06 || max * 0.01;
    return {
      min: min - buffer,
      max: max + buffer,
    };
  }, [candles, signal.entryPrice, signal.stopLoss, signal.tp1, signal.tp2, fvg, ifvg, ob, obstacle]);

  const priceRange = priceExtent.max - priceExtent.min || 1;

  // Coordinate helper: price to Y coordinate
  const getY = (price: number): number => {
    const usableHeight = height - padding.top - padding.bottom;
    const ratio = (price - priceExtent.min) / priceRange;
    return height - padding.bottom - ratio * usableHeight;
  };

  // Format price helper
  const formatP = (val: number | undefined): string => {
    if (val === undefined || val === null || isNaN(val)) return '';
    return val > 500 ? val.toFixed(2) : val > 5 ? val.toFixed(4) : val.toFixed(5);
  };

  const candleCount = candles.length;
  const svgWidth = 840; // ViewBox virtual width
  const plotWidth = svgWidth - padding.left - padding.right;
  const candleSlotWidth = plotWidth / Math.max(1, candleCount);
  const candleBodyWidth = Math.max(4, Math.min(16, candleSlotWidth * 0.65));

  const entryY = getY(signal.entryPrice);
  const slY = getY(signal.stopLoss);
  const tp1Y = getY(signal.tp1);
  const tp2Y = getY(signal.tp2);

  // FVG Calculations
  const fvgHigh = fvg ? Math.max(fvg.high, fvg.low) : 0;
  const fvgLow = fvg ? Math.min(fvg.high, fvg.low) : 0;
  const fvgMidline = fvg ? (fvgHigh + fvgLow) / 2 : 0;
  const fvgPoc = fvg?.pocPrice || (fvg ? (isBuy ? fvgLow + (fvgHigh - fvgLow) * 0.62 : fvgHigh - (fvgHigh - fvgLow) * 0.62) : 0);

  const fvgTopY = fvg ? getY(fvgHigh) : 0;
  const fvgBottomY = fvg ? getY(fvgLow) : 0;
  const fvgMidY = fvg ? getY(fvgMidline) : 0;
  const fvgPocY = fvgPoc ? getY(fvgPoc) : 0;
  const fvgHeight = Math.max(4, fvgBottomY - fvgTopY);

  // IFVG Calculations
  const ifvgTopY = ifvg ? getY(Math.max(ifvg.high, ifvg.low)) : 0;
  const ifvgBottomY = ifvg ? getY(Math.min(ifvg.high, ifvg.low)) : 0;
  const ifvgHeight = Math.max(4, ifvgBottomY - ifvgTopY);

  // Check if any recent candle touched the FVG
  const touchedCandle = useMemo(() => {
    if (!fvg) return null;
    for (let i = candles.length - 1; i >= Math.max(0, candles.length - 8); i--) {
      const c = candles[i];
      if (c.low <= fvgHigh && c.high >= fvgLow) {
        const x = padding.left + i * candleSlotWidth + candleSlotWidth / 2;
        const touchPrice = isBuy ? Math.max(c.low, fvgLow) : Math.min(c.high, fvgHigh);
        const y = getY(touchPrice);
        return { index: i, candle: c, x, y, touchPrice };
      }
    }
    return null;
  }, [candles, fvg, fvgHigh, fvgLow, isBuy, candleSlotWidth, padding.left]);

  const fvgFillPct = fvg?.fvgFillPercentage || (touchedCandle ? 50 : 0);
  const isHighProb = fvg?.highProbability !== false;

  return (
    <div
      id={`chart-container-${signal.id}`}
      className="mt-3.5 rounded-xl border border-slate-700/80 bg-slate-950/90 p-3.5 backdrop-blur-md shadow-2xl transition-all duration-300"
    >
      {/* Header Controls & High Probability FVG Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/90 pb-2.5 mb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-100">
            <Crosshair className="h-4 w-4 text-cyan-400" />
            <span>Graphique SMC &amp; Niveaux de Retracement</span>
          </div>

          <span className="rounded bg-slate-800/90 px-2 py-0.5 text-[10px] font-mono text-slate-300">
            {signal.pair} • 30M / 15M
          </span>

          {/* FVG Retracement Badge */}
          {fvg && (
            <span
              id={`badge-fvg-prob-${signal.id}`}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${
                isHighProb
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                  : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              }`}
            >
              <Flame className="h-3 w-3 text-amber-400 animate-pulse" />
              <span>FVG {fvg.timeframe} Haute Probabilité ({fvg.sizePercent}%)</span>
            </span>
          )}

          {ifvg && (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 border border-purple-500/40 px-2.5 py-0.5 text-[10px] font-medium text-purple-300">
              <Sparkles className="h-3 w-3 text-purple-400" />
              <span>IFVG Inversé ({ifvg.timeframe})</span>
            </span>
          )}
        </div>

        {/* Action Toggles */}
        <div className="flex items-center gap-2">
          {fvg && (
            <div className="hidden sm:flex items-center gap-1 text-[10px]">
              <button
                type="button"
                onClick={() => setShowMidline(!showMidline)}
                className={`rounded px-1.5 py-0.5 font-mono border transition-colors ${
                  showMidline
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
                title="Afficher/Masquer Médiane 50% CE"
              >
                50% CE
              </button>
              <button
                type="button"
                onClick={() => setShowPOC(!showPOC)}
                className={`rounded px-1.5 py-0.5 font-mono border transition-colors ${
                  showPOC
                    ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
                title="Afficher/Masquer POC Volume"
              >
                POC Vol
              </button>
            </div>
          )}

          <button
            id={`btn-toggle-chart-${signal.id}`}
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/70 px-2.5 py-1 text-[11px] font-medium text-slate-200 transition-colors"
            title={isExpanded ? 'Réduire' : 'Agrandir le graphique'}
          >
            {isExpanded ? (
              <>
                <Minimize2 className="h-3 w-3 text-slate-400" />
                <span>Réduire</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-3 w-3 text-cyan-400" />
                <span>Agrandir</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Retracement Status Highlight Alert Bar */}
      {fvg && (
        <div
          id={`fvg-retracement-bar-${signal.id}`}
          className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-900/90 border border-amber-500/30 px-3 py-1.5 text-[11px]"
        >
          <div className="flex items-center gap-2 text-slate-300">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span className="font-semibold text-amber-300">Retracement Récent dans le FVG :</span>
            <span className="text-slate-300">
              Zone <strong className="text-white font-mono">{formatP(fvgLow)}</strong> — <strong className="text-white font-mono">{formatP(fvgHigh)}</strong>
            </span>
            <span className="text-slate-400 hidden sm:inline">•</span>
            <span className="text-slate-300 hidden sm:inline">
              CE 50%: <strong className="text-amber-300 font-mono">{formatP(fvgMidline)}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono">
            {touchedCandle ? (
              <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Zone Touchée &amp; Validée</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-300">
                <Target className="h-3 w-3" />
                <span>Zone Cible de Retracement</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* SVG Candlestick & Levels Display */}
      <div className="relative w-full overflow-hidden rounded-lg bg-slate-900/95 border border-slate-800">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${height}`}
          className="w-full select-none"
          style={{ height: `${height}px` }}
          onMouseLeave={() => setHoveredCandle(null)}
        >
          <defs>
            {/* Bullish High-Probability FVG Area Gradient */}
            <linearGradient id={`fvg-bull-${signal.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.32" />
              <stop offset="50%" stopColor="#F59E0B" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.10" />
            </linearGradient>

            {/* Bearish High-Probability FVG Area Gradient */}
            <linearGradient id={`fvg-bear-${signal.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#EF4444" stopOpacity="0.32" />
              <stop offset="50%" stopColor="#F59E0B" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#EF4444" stopOpacity="0.10" />
            </linearGradient>

            {/* Inverted FVG Area Gradient */}
            <linearGradient id={`ifvg-grad-${signal.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.10" />
            </linearGradient>

            {/* Glow Filter for Retracement Touch Point */}
            <filter id={`glow-${signal.id}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Grid Lines */}
          <line
            x1={padding.left}
            y1={padding.top + (height - padding.top - padding.bottom) * 0.25}
            x2={svgWidth - padding.right}
            y2={padding.top + (height - padding.top - padding.bottom) * 0.25}
            stroke="#1E293B"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
          <line
            x1={padding.left}
            y1={padding.top + (height - padding.top - padding.bottom) * 0.5}
            x2={svgWidth - padding.right}
            y2={padding.top + (height - padding.top - padding.bottom) * 0.5}
            stroke="#1E293B"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
          <line
            x1={padding.left}
            y1={padding.top + (height - padding.top - padding.bottom) * 0.75}
            x2={svgWidth - padding.right}
            y2={padding.top + (height - padding.top - padding.bottom) * 0.75}
            stroke="#1E293B"
            strokeDasharray="3 3"
            strokeWidth="1"
          />

          {/* ══════════════════════════════════════════════════════════════════
              1. HIGH PROBABILITY RETRACEMENT FVG DISPLAY
             ══════════════════════════════════════════════════════════════════ */}
          {fvg && !ifvg && (
            <g id={`fvg-highlight-zone-${signal.id}`}>
              {/* FVG Fill Rectangle */}
              <rect
                x={padding.left}
                y={fvgTopY}
                width={plotWidth}
                height={fvgHeight}
                fill={fvg.type === 'BULLISH' ? `url(#fvg-bull-${signal.id})` : `url(#fvg-bear-${signal.id})`}
                stroke={fvg.type === 'BULLISH' ? '#10B981' : '#EF4444'}
                strokeWidth="1.2"
                strokeDasharray="5 3"
                strokeOpacity="0.85"
                rx="3"
              />

              {/* FVG High Top Boundary Line */}
              <line
                x1={padding.left}
                y1={fvgTopY}
                x2={svgWidth - padding.right}
                y2={fvgTopY}
                stroke={fvg.type === 'BULLISH' ? '#34D399' : '#F87171'}
                strokeWidth="1"
                strokeDasharray="3 2"
              />

              {/* FVG Low Bottom Boundary Line */}
              <line
                x1={padding.left}
                y1={fvgBottomY}
                x2={svgWidth - padding.right}
                y2={fvgBottomY}
                stroke={fvg.type === 'BULLISH' ? '#34D399' : '#F87171'}
                strokeWidth="1"
                strokeDasharray="3 2"
              />

              {/* 50% Consequent Encroachment (Midline) */}
              {showMidline && (
                <g id={`fvg-ce-midline-${signal.id}`}>
                  <line
                    x1={padding.left}
                    y1={fvgMidY}
                    x2={svgWidth - padding.right}
                    y2={fvgMidY}
                    stroke="#F59E0B"
                    strokeWidth="1.2"
                    strokeDasharray="4 2"
                  />
                  {/* CE 50% Right Margin Tag */}
                  <rect
                    x={svgWidth - padding.right + 4}
                    y={fvgMidY - 7}
                    width={96}
                    height={14}
                    fill="#78350F"
                    stroke="#F59E0B"
                    strokeWidth="0.8"
                    rx="3"
                  />
                  <text
                    x={svgWidth - padding.right + 7}
                    y={fvgMidY + 3.5}
                    fill="#FDE68A"
                    fontSize="8.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    ⚡ CE 50%: {formatP(fvgMidline)}
                  </text>
                </g>
              )}

              {/* POC Volume Node Line inside FVG */}
              {showPOC && fvgPoc > 0 && Math.abs(fvgPocY - fvgMidY) > 8 && (
                <g id={`fvg-poc-line-${signal.id}`}>
                  <line
                    x1={padding.left}
                    y1={fvgPocY}
                    x2={svgWidth - padding.right}
                    y2={fvgPocY}
                    stroke="#06B6D4"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <text
                    x={svgWidth - padding.right - 6}
                    y={fvgPocY - 3}
                    textAnchor="end"
                    fill="#67E8F9"
                    fontSize="8"
                    fontFamily="monospace"
                  >
                    POC Vol: {formatP(fvgPoc)}
                  </text>
                </g>
              )}

              {/* Internal Zone Label: High Probability Retracement */}
              <text
                x={padding.left + 8}
                y={fvgTopY + Math.min(fvgHeight - 5, 14)}
                fill={fvg.type === 'BULLISH' ? '#A7F3D0' : '#FECDD3'}
                fontSize="10"
                fontFamily="monospace"
                fontWeight="bold"
              >
                {`🔥 FVG ${fvg.timeframe} RETRACEMENT [${formatP(fvgLow)} - ${formatP(fvgHigh)}] • ${fvg.sizePercent}%`}
              </text>
            </g>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              2. INVERTED FVG (IFVG) DISPLAY
             ══════════════════════════════════════════════════════════════════ */}
          {ifvg && (
            <g id={`ifvg-zone-${signal.id}`}>
              <rect
                x={padding.left}
                y={ifvgTopY}
                width={plotWidth}
                height={ifvgHeight}
                fill={`url(#ifvg-grad-${signal.id})`}
                stroke="#A78BFA"
                strokeWidth="1.3"
                strokeDasharray="4 2"
                rx="3"
              />
              <text
                x={padding.left + 8}
                y={ifvgTopY + Math.min(ifvgHeight - 4, 14)}
                fill="#DDD6FE"
                fontSize="10"
                fontFamily="monospace"
                fontWeight="bold"
              >
                {`🔄 IFVG ${ifvg.timeframe} (${ifvg.role === 'INVERTED_SUPPORT' ? 'Support' : 'Résistance'})`}
              </text>
            </g>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              3. OBSTACLE LINE (If any on the path to TP)
             ══════════════════════════════════════════════════════════════════ */}
          {obstacle && (
            <g id={`obstacle-line-${signal.id}`}>
              <line
                x1={padding.left}
                y1={getY(obstacle.priceLevel)}
                x2={svgWidth - padding.right}
                y2={getY(obstacle.priceLevel)}
                stroke="#F59E0B"
                strokeWidth="1.2"
                strokeDasharray="2 2"
              />
              <text
                x={svgWidth - padding.right - 6}
                y={getY(obstacle.priceLevel) - 4}
                textAnchor="end"
                fill="#FCD34D"
                fontSize="9"
                fontFamily="monospace"
              >
                ⚠️ Obstacle: {obstacle.label}
              </text>
            </g>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              4. CANDLESTICK RENDERING WITH RETRACEMENT TOUCH MARKER
             ══════════════════════════════════════════════════════════════════ */}
          {candles.map((c, i) => {
            const isCandleBull = c.close >= c.open;
            const x = padding.left + i * candleSlotWidth + candleSlotWidth / 2;
            const openY = getY(c.open);
            const closeY = getY(c.close);
            const highY = getY(c.high);
            const lowY = getY(c.low);

            const candleColor = isCandleBull ? '#10B981' : '#EF4444';
            const bodyTop = Math.min(openY, closeY);
            const bodyHeight = Math.max(2, Math.abs(openY - closeY));

            return (
              <g
                key={`candle-${i}`}
                className="cursor-pointer transition-opacity hover:opacity-80"
                onMouseEnter={() => setHoveredCandle({ candle: c, index: i, x, y: bodyTop })}
              >
                {/* Candle Wick */}
                <line
                  x1={x}
                  y1={highY}
                  x2={x}
                  y2={lowY}
                  stroke={candleColor}
                  strokeWidth="1.2"
                />
                {/* Candle Body */}
                <rect
                  x={x - candleBodyWidth / 2}
                  y={bodyTop}
                  width={candleBodyWidth}
                  height={bodyHeight}
                  fill={candleColor}
                  rx="1"
                />
              </g>
            );
          })}

          {/* Retracement Touch Point Indicator (Pinpoint on the touch candle) */}
          {touchedCandle && (
            <g id={`retracement-touch-marker-${signal.id}`} filter={`url(#glow-${signal.id})`}>
              <circle
                cx={touchedCandle.x}
                cy={touchedCandle.y}
                r="4.5"
                fill="#F59E0B"
                stroke="#FFF"
                strokeWidth="1.5"
              />
              <circle
                cx={touchedCandle.x}
                cy={touchedCandle.y}
                r="8"
                fill="none"
                stroke="#F59E0B"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.8"
              />
            </g>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              5. HORIZONTAL SMC EXECUTION LINES (ENTRY, SL, TP1, TP2)
             ══════════════════════════════════════════════════════════════════ */}

          {/* 5.1 STOP LOSS (SL) Line */}
          <g id={`sl-line-${signal.id}`}>
            <line
              x1={padding.left}
              y1={slY}
              x2={svgWidth - padding.right}
              y2={slY}
              stroke="#F43F5E"
              strokeWidth="1.5"
              strokeDasharray="5 3"
            />
            <rect
              x={svgWidth - padding.right + 4}
              y={slY - 9}
              width={98}
              height={18}
              fill="#881337"
              stroke="#F43F5E"
              strokeWidth="1"
              rx="4"
            />
            <text
              x={svgWidth - padding.right + 8}
              y={slY + 3.5}
              fill="#FECDD3"
              fontSize="9"
              fontFamily="monospace"
              fontWeight="bold"
            >
              🛑 SL: {formatP(signal.stopLoss)}
            </text>
          </g>

          {/* 5.2 ENTRÉE (Entry) Line */}
          <g id={`entry-line-${signal.id}`}>
            <line
              x1={padding.left}
              y1={entryY}
              x2={svgWidth - padding.right}
              y2={entryY}
              stroke="#06B6D4"
              strokeWidth="1.8"
            />
            <rect
              x={svgWidth - padding.right + 4}
              y={entryY - 9}
              width={98}
              height={18}
              fill="#164E63"
              stroke="#06B6D4"
              strokeWidth="1"
              rx="4"
            />
            <text
              x={svgWidth - padding.right + 8}
              y={entryY + 3.5}
              fill="#CFFAFE"
              fontSize="9"
              fontFamily="monospace"
              fontWeight="bold"
            >
              🔹 IN: {formatP(signal.entryPrice)}
            </text>
          </g>

          {/* 5.3 TP1 Line */}
          <g id={`tp1-line-${signal.id}`}>
            <line
              x1={padding.left}
              y1={tp1Y}
              x2={svgWidth - padding.right}
              y2={tp1Y}
              stroke="#10B981"
              strokeWidth="1.4"
              strokeDasharray="4 2"
            />
            <rect
              x={svgWidth - padding.right + 4}
              y={tp1Y - 9}
              width={98}
              height={18}
              fill="#064E3B"
              stroke="#10B981"
              strokeWidth="1"
              rx="4"
            />
            <text
              x={svgWidth - padding.right + 8}
              y={tp1Y + 3.5}
              fill="#A7F3D0"
              fontSize="9"
              fontFamily="monospace"
              fontWeight="bold"
            >
              🎯 TP1: {formatP(signal.tp1)}
            </text>
          </g>

          {/* 5.4 TP2 Line */}
          <g id={`tp2-line-${signal.id}`}>
            <line
              x1={padding.left}
              y1={tp2Y}
              x2={svgWidth - padding.right}
              y2={tp2Y}
              stroke="#34D399"
              strokeWidth="1.6"
            />
            <rect
              x={svgWidth - padding.right + 4}
              y={tp2Y - 9}
              width={98}
              height={18}
              fill="#065F46"
              stroke="#34D399"
              strokeWidth="1"
              rx="4"
            />
            <text
              x={svgWidth - padding.right + 8}
              y={tp2Y + 3.5}
              fill="#D1FAE5"
              fontSize="9"
              fontFamily="monospace"
              fontWeight="bold"
            >
              ⭐️ TP2: {formatP(signal.tp2)}
            </text>
          </g>

          {/* Hover Crosshair Guide */}
          {hoveredCandle && (
            <line
              x1={hoveredCandle.x}
              y1={padding.top}
              x2={hoveredCandle.x}
              y2={height - padding.bottom}
              stroke="#94A3B8"
              strokeWidth="1"
              strokeDasharray="2 2"
              opacity="0.6"
            />
          )}
        </svg>

        {/* Hover Floating Tooltip */}
        {hoveredCandle && (
          <div className="pointer-events-none absolute top-2 left-3 rounded-md bg-slate-950/95 border border-slate-700/80 px-2.5 py-1.5 text-[11px] font-mono shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-3 text-slate-300">
              <span>O: <strong className="text-white">{formatP(hoveredCandle.candle.open)}</strong></span>
              <span>H: <strong className="text-emerald-400">{formatP(hoveredCandle.candle.high)}</strong></span>
              <span>L: <strong className="text-rose-400">{formatP(hoveredCandle.candle.low)}</strong></span>
              <span>C: <strong className="text-cyan-300">{formatP(hoveredCandle.candle.close)}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Execution & Retracement Summary Bar Under Chart */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5 text-cyan-300">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>Biais: <strong>{isBuy ? 'ACHAT (LONG)' : 'VENTE (SHORT)'}</strong></span>
          </span>
          {fvg && (
            <span className="text-amber-300 flex items-center gap-1">
              <Flame className="h-3 w-3" />
              <span>FVG {fvg.timeframe} : <strong>{formatP(fvgLow)}</strong> - <strong>{formatP(fvgHigh)}</strong></span>
            </span>
          )}
          <span className="text-slate-400">
            Risque: <strong className="text-rose-400">-{Math.abs(signal.entryPrice - signal.stopLoss).toFixed(4)} pts</strong>
          </span>
          <span className="text-slate-400">
            Gain TP2: <strong className="text-emerald-400">+{Math.abs(signal.tp2 - signal.entryPrice).toFixed(4)} pts</strong>
          </span>
        </div>
        <div className="text-slate-300">
          Ratio R:R: <strong className="text-emerald-400 font-bold">1 : {signal.riskRewardRatio}</strong>
        </div>
      </div>
    </div>
  );
};
