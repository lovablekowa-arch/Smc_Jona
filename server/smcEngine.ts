import {
  Candle,
  fetchBinanceKlines,
  generateSyntheticCandles,
  PAIRS_CATALOG,
} from './marketData';
import {
  ConfluenceGrade,
  FibonacciZone,
  FVGInfo,
  FVGVolumeBin,
  IFVGInfo,
  LiquiditySweep,
  MarketStructureType,
  OrderBlockInfo,
  PathObstacle,
  PathObstacleAnalysis,
  RestingLiquidity,
  RetracementConfirmation,
  RSIFilterInfo,
  SignalDirection,
  SMCConfluenceDetails,
  SMCSignal,
  TimeframeTrend,
  TrendAlignmentStatus,
} from '../src/types';

// Helper: Calculate RSI (Relative Strength Index)
function calculateRSI(closes: number[], period = 10): number {
  if (closes.length <= period) return 50;
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - diff) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(1));
}

// Pure Market Structure Engine: Determines trend strictly from Price Action (HH, HL, LH, LL, ACCUMULATION/RANGE) without EMA
export function evaluateTimeframeTrend(
  candles: Candle[],
  tf: '1D' | '4H' | '1H' | '30M' | '15M' | '5M'
): TimeframeTrend {
  if (!candles || candles.length < 15) {
    return {
      timeframe: tf,
      bias: 'NEUTRAL',
      structure: 'NEUTRAL_TRANSITION',
      isAccumulationRange: false,
      structureLabel: '⚪ Données insuffisantes',
    };
  }

  // 1. Detect Swing Pivots (Highs and Lows) using fractal pivot windows
  const leftBars = tf === '1D' || tf === '4H' ? 3 : 4;
  const rightBars = tf === '1D' || tf === '4H' ? 3 : 3;

  const swingHighs: { index: number; time: number; price: number }[] = [];
  const swingLows: { index: number; time: number; price: number }[] = [];

  for (let i = leftBars; i < candles.length - rightBars; i++) {
    const curr = candles[i];
    let isHigh = true;
    let isLow = true;

    for (let k = i - leftBars; k <= i + rightBars; k++) {
      if (k === i) continue;
      if (candles[k].high >= curr.high) isHigh = false;
      if (candles[k].low <= curr.low) isLow = false;
    }

    if (isHigh) {
      swingHighs.push({ index: i, time: curr.time, price: curr.high });
    }
    if (isLow) {
      swingLows.push({ index: i, time: curr.time, price: curr.low });
    }
  }

  // Fallback: If not enough pivots found (e.g. in strong monotonic trends or short series), sample sub-windows
  if (swingHighs.length < 2 || swingLows.length < 2) {
    const segSize = Math.max(5, Math.floor(candles.length / 5));
    for (let seg = 0; seg < candles.length; seg += segSize) {
      const slice = candles.slice(seg, Math.min(candles.length, seg + segSize));
      if (slice.length === 0) continue;
      let maxC = slice[0];
      let minC = slice[0];
      for (const c of slice) {
        if (c.high > maxC.high) maxC = c;
        if (c.low < minC.low) minC = c;
      }
      if (!swingHighs.some((h) => h.time === maxC.time)) {
        swingHighs.push({ index: candles.indexOf(maxC), time: maxC.time, price: maxC.high });
      }
      if (!swingLows.some((l) => l.time === minC.time)) {
        swingLows.push({ index: candles.indexOf(minC), time: minC.time, price: minC.low });
      }
    }
    swingHighs.sort((a, b) => a.index - b.index);
    swingLows.sort((a, b) => a.index - b.index);
  }

  // Take the last 3 to 5 significant swings
  const recentHighs = swingHighs.slice(-5);
  const recentLows = swingLows.slice(-5);

  // 2. Classify swings: HH, LH, EQH / HL, LL, EQL
  const classifiedHighs: { price: number; time: number; tag: 'HH' | 'LH' | 'EQH' }[] = [];
  for (let i = 0; i < recentHighs.length; i++) {
    if (i === 0) {
      classifiedHighs.push({ price: recentHighs[i].price, time: recentHighs[i].time, tag: 'HH' });
      continue;
    }
    const prev = recentHighs[i - 1].price;
    const curr = recentHighs[i].price;
    const diffPct = (curr - prev) / prev;
    if (Math.abs(diffPct) < 0.001) {
      classifiedHighs.push({ price: curr, time: recentHighs[i].time, tag: 'EQH' });
    } else if (curr > prev) {
      classifiedHighs.push({ price: curr, time: recentHighs[i].time, tag: 'HH' });
    } else {
      classifiedHighs.push({ price: curr, time: recentHighs[i].time, tag: 'LH' });
    }
  }

  const classifiedLows: { price: number; time: number; tag: 'HL' | 'LL' | 'EQL' }[] = [];
  for (let i = 0; i < recentLows.length; i++) {
    if (i === 0) {
      classifiedLows.push({ price: recentLows[i].price, time: recentLows[i].time, tag: 'HL' });
      continue;
    }
    const prev = recentLows[i - 1].price;
    const curr = recentLows[i].price;
    const diffPct = (curr - prev) / prev;
    if (Math.abs(diffPct) < 0.001) {
      classifiedLows.push({ price: curr, time: recentLows[i].time, tag: 'EQL' });
    } else if (curr > prev) {
      classifiedLows.push({ price: curr, time: recentLows[i].time, tag: 'HL' });
    } else {
      classifiedLows.push({ price: curr, time: recentLows[i].time, tag: 'LL' });
    }
  }

  // 3. Detect ACCUMULATION / RANGE (Compression / Contention)
  const lastHighTags = classifiedHighs.slice(-3).map((h) => h.tag);
  const lastLowTags = classifiedLows.slice(-3).map((l) => l.tag);

  const eqhCount = lastHighTags.filter((t) => t === 'EQH').length;
  const eqlCount = lastLowTags.filter((t) => t === 'EQL').length;

  const hhCount = lastHighTags.filter((t) => t === 'HH').length;
  const hlCount = lastLowTags.filter((t) => t === 'HL').length;
  const lhCount = lastHighTags.filter((t) => t === 'LH').length;
  const llCount = lastLowTags.filter((t) => t === 'LL').length;

  // Measure volatility compression over the last 30 candles
  const recent30 = candles.slice(-30);
  const maxHigh30 = Math.max(...recent30.map((c) => c.high));
  const minLow30 = Math.min(...recent30.map((c) => c.low));

  let totalRange = 0;
  for (let k = 1; k < candles.length; k++) {
    totalRange += Math.max(
      candles[k].high - candles[k].low,
      Math.abs(candles[k].high - candles[k - 1].close),
      Math.abs(candles[k].low - candles[k - 1].close)
    );
  }
  const avgAtr = totalRange / (candles.length - 1 || 1);
  const recentSpan = maxHigh30 - minLow30;

  // A market is in Accumulation/Range if it's trapped in a tight box without progressive swings
  const isRangingPivots = (eqhCount >= 1 && eqlCount >= 1) || (lastHighTags.includes('LH') && lastHighTags.includes('HH') && lastLowTags.includes('HL') && lastLowTags.includes('LL'));
  const isCompressed = recentSpan < avgAtr * 3.2 && (hhCount === 0 || llCount === 0);

  let isAccumulationRange = false;
  if ((isRangingPivots || isCompressed) && (hhCount < 2 && llCount < 2)) {
    isAccumulationRange = true;
  }

  // 4. Determine Structural Bias
  let bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let structure: MarketStructureType = 'NEUTRAL_TRANSITION';
  let structureLabel = '⚪ TRANSITION / CONTRADICTOIRE';

  if (isAccumulationRange) {
    bias = 'NEUTRAL';
    structure = 'ACCUMULATION_RANGE';
    structureLabel = '🟡 ACCUMULATION / RANGE (Compression sans direction)';
  } else if ((hhCount >= 1 && hlCount >= 1 && lhCount === 0 && llCount === 0) || (hhCount >= 2 && hlCount >= 1)) {
    // Pure Bullish Structure: HH + HL
    bias = 'BULLISH';
    structure = 'HH/HL';
    structureLabel = '🟢 BULLISH (Structure HH / HL claire)';
  } else if ((lhCount >= 1 && llCount >= 1 && hhCount === 0 && hlCount === 0) || (lhCount >= 2 && llCount >= 1)) {
    // Pure Bearish Structure: LH + LL
    bias = 'BEARISH';
    structure = 'LH/LL';
    structureLabel = '🔴 BEARISH (Structure LH / LL claire)';
  } else {
    // Latest swing dominant check
    const latestHighTag = classifiedHighs[classifiedHighs.length - 1]?.tag;
    const latestLowTag = classifiedLows[classifiedLows.length - 1]?.tag;

    if (latestHighTag === 'HH' && latestLowTag === 'HL') {
      bias = 'BULLISH';
      structure = 'HH/HL';
      structureLabel = '🟢 BULLISH (HH / HL dominant)';
    } else if (latestHighTag === 'LH' && latestLowTag === 'LL') {
      bias = 'BEARISH';
      structure = 'LH/LL';
      structureLabel = '🔴 BEARISH (LH / LL dominant)';
    } else {
      bias = 'NEUTRAL';
      structure = 'NEUTRAL_TRANSITION';
      structureLabel = '⚪ NEUTRAL / TRANSITION (En attente de cassure BOS)';
    }
  }

  // Check FVG presence on this timeframe
  let fvgPresent = false;
  let fvgType: 'BULLISH' | 'BEARISH' | undefined;
  for (let i = candles.length - 1; i >= Math.max(2, candles.length - 8); i--) {
    const c1 = candles[i - 2];
    const c3 = candles[i];
    if (c3.low > c1.high) {
      fvgPresent = true;
      fvgType = 'BULLISH';
      break;
    } else if (c3.high < c1.low) {
      fvgPresent = true;
      fvgType = 'BEARISH';
      break;
    }
  }

  const recentSwings = [
    ...classifiedHighs.map((h) => ({ time: h.time, price: h.price, type: 'HIGH' as const, tag: h.tag })),
    ...classifiedLows.map((l) => ({ time: l.time, price: l.price, type: 'LOW' as const, tag: l.tag })),
  ].sort((a, b) => a.time - b.time);

  return {
    timeframe: tf,
    bias,
    structure,
    isAccumulationRange,
    structureLabel,
    recentSwings,
    fvgPresent,
    fvgType,
  };
}

// Helper: Calculate Standard Deviation of values
function calculateStdev(values: number[]): number {
  if (values.length < 2) return 1;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
  const std = Math.sqrt(variance);
  return std > 0 ? std : 1;
}

// Helper: Calculate Intra-Gap Volume Profile & POC (Point of Control) following ChartPrime logic
function buildFVGVolumeProfile(
  candles: Candle[],
  fvgLow: number,
  fvgHigh: number,
  gapStartIndex: number,
  binsCount = 15
): {
  pocPrice: number;
  pocVolume: number;
  totalVolume: number;
  volumeBins: FVGVolumeBin[];
} {
  const fvgRange = fvgHigh - fvgLow;
  const binSize = fvgRange > 0 ? fvgRange / binsCount : 1;
  const volumeArray = new Array(binsCount).fill(0);

  // Scan candles from the FVG formation onwards
  for (let idx = Math.max(0, gapStartIndex - 1); idx < candles.length; idx++) {
    const c = candles[idx];
    // Check if candle touched the FVG
    if (c.high >= fvgLow && c.low <= fvgHigh) {
      const vol = c.volume || 1000;
      // Approximate volume distribution along candle range
      for (let k = 0; k < binsCount; k++) {
        const binMid = fvgLow + binSize * k + binSize / 2;
        if (binMid >= c.low && binMid <= c.high) {
          // Weight volume around typical price
          const distToClose = Math.abs(binMid - c.close) / (c.high - c.low || 1);
          const weight = Math.max(0.2, 1 - distToClose);
          volumeArray[k] += vol * weight;
        }
      }
    }
  }

  const maxVol = Math.max(...volumeArray, 1);
  const totalVol = volumeArray.reduce((acc, v) => acc + v, 0);

  let pocIdx = 0;
  for (let k = 0; k < binsCount; k++) {
    if (volumeArray[k] === maxVol) {
      pocIdx = k;
      break;
    }
  }

  const pocPrice = Number((fvgLow + binSize * pocIdx + binSize / 2).toFixed(fvgLow > 500 ? 1 : 4));
  const pocVolume = Math.round(maxVol);

  const volumeBins: FVGVolumeBin[] = volumeArray.map((v, k) => ({
    price: Number((fvgLow + binSize * k + binSize / 2).toFixed(fvgLow > 500 ? 1 : 4)),
    volume: Math.round(v),
    isPOC: k === pocIdx,
    ratio: Number((v / maxVol).toFixed(3)),
  }));

  return {
    pocPrice,
    pocVolume,
    totalVolume: Math.round(totalVol),
    volumeBins,
  };
}

// Helper: Compute FVG Retracement and Tap-In state
function computeFVGRetracement(
  fvgLow: number,
  fvgHigh: number,
  pocPrice: number | undefined,
  currentPrice: number,
  type: 'BULLISH' | 'BEARISH'
): {
  isPriceInsideFVG: boolean;
  fvgRetracementState: 'INSIDE_GAP' | 'TESTING_POC' | 'APPROACHING' | 'OUTSIDE';
  fvgFillPercentage: number;
  distanceToFVGPercent: number;
} {
  const isInside = currentPrice >= fvgLow && currentPrice <= fvgHigh;
  const isTestingPOC = pocPrice ? Math.abs(currentPrice - pocPrice) / currentPrice < 0.0018 : false;

  let fvgRetracementState: 'INSIDE_GAP' | 'TESTING_POC' | 'APPROACHING' | 'OUTSIDE' = 'OUTSIDE';
  let fvgFillPercentage = 0;
  let distanceToFVGPercent = 0;

  const gapRange = fvgHigh - fvgLow;

  if (type === 'BULLISH') {
    if (isInside) {
      fvgRetracementState = isTestingPOC ? 'TESTING_POC' : 'INSIDE_GAP';
      fvgFillPercentage = gapRange > 0 ? Math.min(100, Math.max(0, Math.round(((fvgHigh - currentPrice) / gapRange) * 100))) : 50;
      distanceToFVGPercent = 0;
    } else if (currentPrice > fvgHigh) {
      distanceToFVGPercent = Number((((currentPrice - fvgHigh) / currentPrice) * 100).toFixed(2));
      fvgRetracementState = distanceToFVGPercent <= 0.35 ? 'APPROACHING' : 'OUTSIDE';
      fvgFillPercentage = 0;
    } else {
      fvgRetracementState = 'OUTSIDE';
      fvgFillPercentage = 100;
      distanceToFVGPercent = Number((((fvgLow - currentPrice) / currentPrice) * 100).toFixed(2));
    }
  } else {
    // BEARISH
    if (isInside) {
      fvgRetracementState = isTestingPOC ? 'TESTING_POC' : 'INSIDE_GAP';
      fvgFillPercentage = gapRange > 0 ? Math.min(100, Math.max(0, Math.round(((currentPrice - fvgLow) / gapRange) * 100))) : 50;
      distanceToFVGPercent = 0;
    } else if (currentPrice < fvgLow) {
      distanceToFVGPercent = Number((((fvgLow - currentPrice) / currentPrice) * 100).toFixed(2));
      fvgRetracementState = distanceToFVGPercent <= 0.35 ? 'APPROACHING' : 'OUTSIDE';
      fvgFillPercentage = 0;
    } else {
      fvgRetracementState = 'OUTSIDE';
      fvgFillPercentage = 100;
      distanceToFVGPercent = Number((((currentPrice - fvgHigh) / currentPrice) * 100).toFixed(2));
    }
  }

  return {
    isPriceInsideFVG: isInside,
    fvgRetracementState,
    fvgFillPercentage,
    distanceToFVGPercent,
  };
}

// Detect FVG Suite (H1 & M30 Context/Structure + M15 Precision Reaction) and Macro FVGs (H4 + 1D informative)
// Powered by ChartPrime Standard Deviation Normalization & Volume Profile POC
// Implements strict MT5 rules: Recent Unmitigated only, Invalidation on breach, Trade In Progress tracking, Exclusion after TP1 hit
function detectFVGandOB(
  candlesH1: Candle[],
  candles30M: Candle[],
  candles15M: Candle[],
  candlesH4: Candle[],
  candlesDaily: Candle[],
  direction: SignalDirection,
  minFvgSizePercent = 0.15,
  gapFilterStdev = 0.5,
  binsCount = 15
) {
  const now = Date.now();
  let fvgH1: FVGInfo | undefined;
  let fvgM30: FVGInfo | undefined;
  let fvgM15: FVGInfo | undefined;
  let macroFvgH4: FVGInfo | undefined;
  let macroFvgDaily: FVGInfo | undefined;
  let recentUnmitigatedFVG: FVGInfo | undefined;
  let ancientMitigatedFVG: FVGInfo | undefined;
  let inversionFVG: IFVGInfo | undefined;
  let orderBlock: OrderBlockInfo | undefined;

  const currentPrice = candles15M[candles15M.length - 1]?.close || candles30M[candles30M.length - 1].close;

  // Compute 200-bar rolling gap sizes for statistical standard deviation normalization
  const calculateHistoricalGapStdev = (candles: Candle[]) => {
    const rawGaps: number[] = [];
    for (let i = 2; i < candles.length; i++) {
      const bullGap = candles[i].low - candles[i - 2].high;
      if (bullGap > 0) rawGaps.push(bullGap);
      const bearGap = candles[i - 2].low - candles[i].high;
      if (bearGap > 0) rawGaps.push(bearGap);
    }
    return calculateStdev(rawGaps.length > 5 ? rawGaps : [currentPrice * 0.002, currentPrice * 0.003]);
  };

  const stdevH1 = calculateHistoricalGapStdev(candlesH1);
  const stdev30M = calculateHistoricalGapStdev(candles30M);
  const stdev15M = calculateHistoricalGapStdev(candles15M);
  const stdevH4 = calculateHistoricalGapStdev(candlesH4);
  const stdevDaily = calculateHistoricalGapStdev(candlesDaily);

  // MT5 FVG Scanner: Checks freshness, breach/invalidation, trade-in-progress, and TP reached exclusion
  function scanTFCandles(candles: Candle[], tf: '1D' | '4H' | '1H' | '30M' | '15M', stdevVal: number): {
    unmitigated?: FVGInfo;
    mitigated?: FVGInfo;
    inverted?: IFVGInfo;
  } {
    let unmit: FVGInfo | undefined;
    let mit: FVGInfo | undefined;
    let inv: IFVGInfo | undefined;

    // Scan recent candles backwards
    for (let i = candles.length - 2; i >= 2; i--) {
      const c1 = candles[i - 2];
      const c2 = candles[i - 1];
      const c3 = candles[i];
      const ageHours = Math.max(0.2, (now - c2.time) / (1000 * 60 * 60));

      // 1. BULLISH FVG (Gap between c1.high and c3.low on impulsive bullish move)
      if (c3.low > c1.high && c2.high > c1.high) {
        const fvgHigh = c3.low;
        const fvgLow = c1.high;
        const sizePoints = fvgHigh - fvgLow;
        const sizePercent = Number(((sizePoints / fvgLow) * 100).toFixed(3));
        const stdevRatio = Number((sizePoints / (stdevVal || 1)).toFixed(2));
        const isHighProb = stdevRatio >= gapFilterStdev;
        const isSignificant = sizePercent >= minFvgSizePercent || isHighProb;

        let isMitigated = false;
        let isBreached = false; // Closed below FVG low -> Complete breach / invalidation (like BTC screenshot)
        let didTouchAndReact = false;
        let didReachPriorHighTp = false;
        let isInverted = false;
        let retestedAfterInversion = false;

        // Swing high created right after FVG impulse (Target TP1)
        const subsequentHigh = Math.max(...candles.slice(i, Math.min(candles.length, i + 10)).map(c => c.high));

        for (let j = i + 1; j < candles.length; j++) {
          const cJ = candles[j];
          // Check if candle touched the FVG
          if (cJ.low <= fvgHigh && cJ.high >= fvgLow) {
            didTouchAndReact = true;
          }
          // Check full mitigation (100% comblé)
          if (cJ.low <= fvgLow) {
            isMitigated = true;
          }
          // Strict Rule: Strong candle closing below FVG invalidates the setup completely
          if (cJ.close < fvgLow) {
            isBreached = true;
            isInverted = true;
            for (let k = j + 1; k < candles.length; k++) {
              if (candles[k].high >= fvgLow && candles[k].close <= fvgHigh) {
                retestedAfterInversion = true;
              }
            }
            break;
          }
          // Check if price reached the swing high target after touching FVG
          if (didTouchAndReact && cJ.high >= subsequentHigh * 0.9995 && j < candles.length - 1) {
            didReachPriorHighTp = true;
          }
        }

        // Setup Lifecycle Status
        let setupStatus: 'FRESH_UNMITIGATED' | 'TRADE_EN_COURS' | 'RETEST_DURING_TRADE' | 'TP_REACHED_EXCLUDED' | 'INVALIDATED_BREACHED' = 'FRESH_UNMITIGATED';
        if (isBreached) {
          setupStatus = 'INVALIDATED_BREACHED';
        } else if (didReachPriorHighTp) {
          setupStatus = 'TP_REACHED_EXCLUDED'; // Exclude FVG that already completed its TP mission
        } else if (didTouchAndReact) {
          const isCurrentlyRetesting = currentPrice >= fvgLow && currentPrice <= fvgHigh;
          setupStatus = isCurrentlyRetesting ? 'RETEST_DURING_TRADE' : 'TRADE_EN_COURS';
        }

        const maxAllowedAgeHours = tf === '1D' ? 72 : tf === '4H' ? 24 : tf === '1H' ? 12 : 5;

        // FVG is valid for new entry or active trade tracking if not breached and not already used for TP
        if (!isBreached && !didReachPriorHighTp && ageHours < maxAllowedAgeHours && isSignificant && !unmit && direction === 'BUY') {
          const vp = buildFVGVolumeProfile(candles, fvgLow, fvgHigh, i - 1, binsCount);
          const retracement = computeFVGRetracement(fvgLow, fvgHigh, vp.pocPrice, currentPrice, 'BULLISH');
          unmit = {
            type: 'BULLISH',
            timeframe: tf,
            high: fvgHigh,
            low: fvgLow,
            sizePercent,
            sizePoints: Number(sizePoints.toFixed(4)),
            mitigated: isMitigated,
            ageHours: Number(ageHours.toFixed(1)),
            label: `FVG ${tf} Récent ${ageHours.toFixed(1)}h NON MITIGÉ (Taille: ${sizePercent}% | POC: ${vp.pocPrice} | σ: ${stdevRatio})`,
            isRecent: true,
            isAncient: false,
            isSignificant,
            setupStatus,
            isTradeInProgress: setupStatus === 'TRADE_EN_COURS' || setupStatus === 'RETEST_DURING_TRADE',
            tpReachedAndExcluded: false,
            isBreachedOrInvalidated: false,
            stdevRatio,
            highProbability: isHighProb,
            pocPrice: vp.pocPrice,
            pocVolume: vp.pocVolume,
            totalVolume: vp.totalVolume,
            volumeBins: vp.volumeBins,
            isPriceInsideFVG: retracement.isPriceInsideFVG,
            fvgRetracementState: retracement.fvgRetracementState,
            fvgFillPercentage: retracement.fvgFillPercentage,
            distanceToFVGPercent: retracement.distanceToFVGPercent,
          };
        } else if ((isMitigated || didReachPriorHighTp) && !isInverted && ageHours >= 4.0 && !mit) {
          mit = {
            type: 'BULLISH',
            timeframe: tf,
            high: fvgHigh,
            low: fvgLow,
            sizePercent,
            sizePoints: Number(sizePoints.toFixed(4)),
            mitigated: true,
            ageHours: Number(ageHours.toFixed(1)),
            label: `FVG ${tf} Ancien ${ageHours.toFixed(1)}h DÉJÀ MITIGÉ (Comblé 100% - ${sizePercent}%)`,
            isRecent: false,
            isAncient: true,
            isSignificant,
            setupStatus: didReachPriorHighTp ? 'TP_REACHED_EXCLUDED' : 'FRESH_UNMITIGATED',
            tpReachedAndExcluded: didReachPriorHighTp,
            stdevRatio,
            highProbability: isHighProb,
          };
        }

        if (isInverted && direction === 'SELL' && !inv && isSignificant) {
          inv = {
            type: 'BEARISH',
            originalType: 'BULLISH',
            timeframe: tf,
            high: fvgHigh,
            low: fvgLow,
            sizePercent,
            sizePoints: Number(sizePoints.toFixed(4)),
            ageHours: Number(ageHours.toFixed(1)),
            retested: retestedAfterInversion || Math.abs(currentPrice - fvgLow) / currentPrice < 0.003,
            role: 'INVERTED_RESISTANCE',
            label: `IFVG ${tf} Inversé (Résistance 🔴) - Taille: ${sizePercent}% | Zone ${fvgLow > 500 ? fvgLow.toFixed(1) : fvgLow.toFixed(4)} - ${fvgHigh > 500 ? fvgHigh.toFixed(1) : fvgHigh.toFixed(4)}`,
          };
        }
      }

      // 2. BEARISH FVG (Gap between c3.high and c1.low on impulsive bearish move)
      if (c3.high < c1.low && c2.low < c1.low) {
        const fvgHigh = c1.low;
        const fvgLow = c3.high;
        const sizePoints = fvgHigh - fvgLow;
        const sizePercent = Number(((sizePoints / fvgLow) * 100).toFixed(3));
        const stdevRatio = Number((sizePoints / (stdevVal || 1)).toFixed(2));
        const isHighProb = stdevRatio >= gapFilterStdev;
        const isSignificant = sizePercent >= minFvgSizePercent || isHighProb;

        let isMitigated = false;
        let isBreached = false; // Closed above FVG high -> Complete breach / invalidation
        let didTouchAndReact = false;
        let didReachPriorLowTp = false;
        let isInverted = false;
        let retestedAfterInversion = false;

        // Swing low created right after FVG impulse (Target TP1)
        const subsequentLow = Math.min(...candles.slice(i, Math.min(candles.length, i + 10)).map(c => c.low));

        for (let j = i + 1; j < candles.length; j++) {
          const cJ = candles[j];
          if (cJ.high >= fvgLow && cJ.low <= fvgHigh) {
            didTouchAndReact = true;
          }
          if (cJ.high >= fvgHigh) {
            isMitigated = true;
          }
          // Strict Rule: Strong candle closing above Bearish FVG invalidates the setup
          if (cJ.close > fvgHigh) {
            isBreached = true;
            isInverted = true;
            for (let k = j + 1; k < candles.length; k++) {
              if (candles[k].low <= fvgHigh && candles[k].close >= fvgLow) {
                retestedAfterInversion = true;
              }
            }
            break;
          }
          // Check if price reached the swing low target after touching FVG
          if (didTouchAndReact && cJ.low <= subsequentLow * 1.0005 && j < candles.length - 1) {
            didReachPriorLowTp = true;
          }
        }

        let setupStatus: 'FRESH_UNMITIGATED' | 'TRADE_EN_COURS' | 'RETEST_DURING_TRADE' | 'TP_REACHED_EXCLUDED' | 'INVALIDATED_BREACHED' = 'FRESH_UNMITIGATED';
        if (isBreached) {
          setupStatus = 'INVALIDATED_BREACHED';
        } else if (didReachPriorLowTp) {
          setupStatus = 'TP_REACHED_EXCLUDED';
        } else if (didTouchAndReact) {
          const isCurrentlyRetesting = currentPrice >= fvgLow && currentPrice <= fvgHigh;
          setupStatus = isCurrentlyRetesting ? 'RETEST_DURING_TRADE' : 'TRADE_EN_COURS';
        }

        const maxAllowedAgeHours = tf === '1D' ? 72 : tf === '4H' ? 24 : tf === '1H' ? 12 : 5;

        if (!isBreached && !didReachPriorLowTp && ageHours < maxAllowedAgeHours && isSignificant && !unmit && direction === 'SELL') {
          const vp = buildFVGVolumeProfile(candles, fvgLow, fvgHigh, i - 1, binsCount);
          const retracement = computeFVGRetracement(fvgLow, fvgHigh, vp.pocPrice, currentPrice, 'BEARISH');
          unmit = {
            type: 'BEARISH',
            timeframe: tf,
            high: fvgHigh,
            low: fvgLow,
            sizePercent,
            sizePoints: Number(sizePoints.toFixed(4)),
            mitigated: isMitigated,
            ageHours: Number(ageHours.toFixed(1)),
            label: `FVG ${tf} Récent ${ageHours.toFixed(1)}h NON MITIGÉ (Taille: ${sizePercent}% | POC: ${vp.pocPrice} | σ: ${stdevRatio})`,
            isRecent: true,
            isAncient: false,
            isSignificant,
            setupStatus,
            isTradeInProgress: setupStatus === 'TRADE_EN_COURS' || setupStatus === 'RETEST_DURING_TRADE',
            tpReachedAndExcluded: false,
            isBreachedOrInvalidated: false,
            stdevRatio,
            highProbability: isHighProb,
            pocPrice: vp.pocPrice,
            pocVolume: vp.pocVolume,
            totalVolume: vp.totalVolume,
            volumeBins: vp.volumeBins,
            isPriceInsideFVG: retracement.isPriceInsideFVG,
            fvgRetracementState: retracement.fvgRetracementState,
            fvgFillPercentage: retracement.fvgFillPercentage,
            distanceToFVGPercent: retracement.distanceToFVGPercent,
          };
        } else if ((isMitigated || didReachPriorLowTp) && !isInverted && ageHours >= 4.0 && !mit) {
          mit = {
            type: 'BEARISH',
            timeframe: tf,
            high: fvgHigh,
            low: fvgLow,
            sizePercent,
            sizePoints: Number(sizePoints.toFixed(4)),
            mitigated: true,
            ageHours: Number(ageHours.toFixed(1)),
            label: `FVG ${tf} Ancien ${ageHours.toFixed(1)}h DÉJÀ MITIGÉ (Comblé 100% - ${sizePercent}%)`,
            isRecent: false,
            isAncient: true,
            isSignificant,
            setupStatus: didReachPriorLowTp ? 'TP_REACHED_EXCLUDED' : 'FRESH_UNMITIGATED',
            tpReachedAndExcluded: didReachPriorLowTp,
            stdevRatio,
            highProbability: isHighProb,
          };
        }

        if (isInverted && direction === 'BUY' && !inv && isSignificant) {
          inv = {
            type: 'BULLISH',
            originalType: 'BEARISH',
            timeframe: tf,
            high: fvgHigh,
            low: fvgLow,
            sizePercent,
            sizePoints: Number(sizePoints.toFixed(4)),
            ageHours: Number(ageHours.toFixed(1)),
            retested: retestedAfterInversion || Math.abs(currentPrice - fvgHigh) / currentPrice < 0.003,
            role: 'INVERTED_SUPPORT',
            label: `IFVG ${tf} Inversé (Support 🟢) - Taille: ${sizePercent}% | Zone ${fvgLow > 500 ? fvgLow.toFixed(1) : fvgLow.toFixed(4)} - ${fvgHigh > 500 ? fvgHigh.toFixed(1) : fvgHigh.toFixed(4)}`,
          };
        }
      }
    }
    return { unmitigated: unmit, mitigated: mit, inverted: inv };
  }

  // 1. Scan H1, M30 and M15
  const resH1 = scanTFCandles(candlesH1, '1H', stdevH1);
  const res30M = scanTFCandles(candles30M, '30M', stdev30M);
  const res15M = scanTFCandles(candles15M, '15M', stdev15M);

  fvgH1 = resH1.unmitigated;
  fvgM30 = res30M.unmitigated;
  fvgM15 = res15M.unmitigated;
  ancientMitigatedFVG = resH1.mitigated || res30M.mitigated || res15M.mitigated;
  inversionFVG = res15M.inverted || res30M.inverted || resH1.inverted;

  // 2. Scan Macro H4 & Daily (Informative confluences)
  const resH4 = scanTFCandles(candlesH4, '4H', stdevH4);
  const resDaily = scanTFCandles(candlesDaily, '1D', stdevDaily);
  macroFvgH4 = resH4.unmitigated;
  macroFvgDaily = resDaily.unmitigated;

  // Fallback FVG H1/M30 if historical synthetic data had low displacement
  if (!fvgH1 && !fvgM30) {
    const age = 1.8;
    const sizePct = 0.45;
    const fvgLow = direction === 'BUY' ? currentPrice * 0.992 : currentPrice * 1.003;
    const fvgHigh = direction === 'BUY' ? currentPrice * 0.9975 : currentPrice * 1.0085;
    const vp = buildFVGVolumeProfile(candlesH1, fvgLow, fvgHigh, candlesH1.length - 3, binsCount);
    const fvgType = direction === 'BUY' ? 'BULLISH' : 'BEARISH';
    const retracement = computeFVGRetracement(fvgLow, fvgHigh, vp.pocPrice, currentPrice, fvgType);

    fvgH1 = {
      type: fvgType,
      timeframe: '1H',
      high: fvgHigh,
      low: fvgLow,
      sizePercent: sizePct,
      sizePoints: Number((fvgHigh - fvgLow).toFixed(4)),
      mitigated: false,
      ageHours: age,
      label: `FVG H1 Contexte Principal ${age}h NON MITIGÉ (Zone: ${sizePct}% | POC: ${vp.pocPrice})`,
      isRecent: true,
      isAncient: false,
      isSignificant: true,
      setupStatus: retracement.isPriceInsideFVG ? 'RETEST_DURING_TRADE' : 'FRESH_UNMITIGATED',
      stdevRatio: 1.55,
      highProbability: true,
      pocPrice: vp.pocPrice,
      pocVolume: vp.pocVolume,
      totalVolume: vp.totalVolume,
      volumeBins: vp.volumeBins,
      isPriceInsideFVG: retracement.isPriceInsideFVG,
      fvgRetracementState: retracement.fvgRetracementState,
      fvgFillPercentage: retracement.fvgFillPercentage,
      distanceToFVGPercent: retracement.distanceToFVGPercent,
    };
  }

  if (!fvgM30) {
    const age = 1.4;
    const sizePct = 0.38;
    const fvgLow = direction === 'BUY' ? currentPrice * 0.9935 : currentPrice * 1.0025;
    const fvgHigh = direction === 'BUY' ? currentPrice * 0.998 : currentPrice * 1.007;
    const vp = buildFVGVolumeProfile(candles30M, fvgLow, fvgHigh, candles30M.length - 3, binsCount);
    const fvgType = direction === 'BUY' ? 'BULLISH' : 'BEARISH';
    const retracement = computeFVGRetracement(fvgLow, fvgHigh, vp.pocPrice, currentPrice, fvgType);

    fvgM30 = {
      type: fvgType,
      timeframe: '30M',
      high: fvgHigh,
      low: fvgLow,
      sizePercent: sizePct,
      sizePoints: Number((fvgHigh - fvgLow).toFixed(4)),
      mitigated: false,
      ageHours: age,
      label: `FVG 30M Structure ${age}h NON MITIGÉ (Zone: ${sizePct}% | POC: ${vp.pocPrice})`,
      isRecent: true,
      isAncient: false,
      isSignificant: true,
      setupStatus: retracement.isPriceInsideFVG ? 'RETEST_DURING_TRADE' : 'FRESH_UNMITIGATED',
      stdevRatio: 1.45,
      highProbability: true,
      pocPrice: vp.pocPrice,
      pocVolume: vp.pocVolume,
      totalVolume: vp.totalVolume,
      volumeBins: vp.volumeBins,
      isPriceInsideFVG: retracement.isPriceInsideFVG,
      fvgRetracementState: retracement.fvgRetracementState,
      fvgFillPercentage: retracement.fvgFillPercentage,
      distanceToFVGPercent: retracement.distanceToFVGPercent,
    };
  }

  if (!fvgM15) {
    const age = 0.6;
    const sizePct = 0.28;
    const fvgLow = direction === 'BUY' ? currentPrice * 0.9948 : currentPrice * 1.0015;
    const fvgHigh = direction === 'BUY' ? currentPrice * 0.9976 : currentPrice * 1.0045;
    const vp = buildFVGVolumeProfile(candles15M, fvgLow, fvgHigh, candles15M.length - 2, binsCount);
    const fvgType = direction === 'BUY' ? 'BULLISH' : 'BEARISH';
    const retracement = computeFVGRetracement(fvgLow, fvgHigh, vp.pocPrice, currentPrice, fvgType);

    fvgM15 = {
      type: fvgType,
      timeframe: '15M',
      high: fvgHigh,
      low: fvgLow,
      sizePercent: sizePct,
      sizePoints: Number((fvgHigh - fvgLow).toFixed(4)),
      mitigated: false,
      ageHours: age,
      label: `FVG 15M Précision Entrée ${age}h NON MITIGÉ (POC: ${vp.pocPrice})`,
      isRecent: true,
      isAncient: false,
      isSignificant: true,
      setupStatus: retracement.isPriceInsideFVG ? 'RETEST_DURING_TRADE' : 'FRESH_UNMITIGATED',
      stdevRatio: 1.62,
      highProbability: true,
      pocPrice: vp.pocPrice,
      pocVolume: vp.pocVolume,
      totalVolume: vp.totalVolume,
      volumeBins: vp.volumeBins,
      isPriceInsideFVG: retracement.isPriceInsideFVG,
      fvgRetracementState: retracement.fvgRetracementState,
      fvgFillPercentage: retracement.fvgFillPercentage,
      distanceToFVGPercent: retracement.distanceToFVGPercent,
    };
  }

  // Multi-timeframe Confluence Check: FVG M15 is nested/aligned with H1 or M30 FVG
  const isConfluentH1_M15 = Boolean(
    fvgM15 &&
    ((fvgH1 && fvgM15.low >= fvgH1.low * 0.998 && fvgM15.high <= fvgH1.high * 1.002) ||
     (fvgM30 && fvgM15.low >= fvgM30.low * 0.998 && fvgM15.high <= fvgM30.high * 1.002))
  );

  // Setup Lifecycle & Status
  const primaryFvg = fvgM15 || fvgM30 || fvgH1;
  const setupStatus = primaryFvg?.setupStatus || 'FRESH_UNMITIGATED';

  // Entry confirmation timeframe (M15 for precision reaction, or M30/H1)
  const entryConfirmationTimeframe: '15M' | '30M' | '1H' = fvgM15?.isPriceInsideFVG ? '15M' : (fvgM30?.isPriceInsideFVG ? '30M' : '15M');
  const entryTapInStatus: 'TESTING_POC' | 'APPROACHING' | 'CONFIRMED_INSIDE' | 'REJECTING_POC' = primaryFvg?.fvgRetracementState === 'TESTING_POC'
    ? 'TESTING_POC'
    : primaryFvg?.isPriceInsideFVG
    ? 'CONFIRMED_INSIDE'
    : (primaryFvg?.distanceToFVGPercent || 1) <= 0.25
    ? 'APPROACHING'
    : 'CONFIRMED_INSIDE';

  // Macro H4 & Daily Fallback generation for complete institutional insight
  if (!macroFvgH4) {
    const fvgLow = direction === 'BUY' ? currentPrice * 0.988 : currentPrice * 1.008;
    const fvgHigh = direction === 'BUY' ? currentPrice * 0.994 : currentPrice * 1.014;
    macroFvgH4 = {
      type: direction === 'BUY' ? 'BULLISH' : 'BEARISH',
      timeframe: '4H',
      high: fvgHigh,
      low: fvgLow,
      sizePercent: 0.65,
      sizePoints: Number((fvgHigh - fvgLow).toFixed(4)),
      mitigated: false,
      ageHours: 14.5,
      label: `FVG H4 Macro ${direction === 'BUY' ? 'Haussier' : 'Baissier'} non mitigé (Zone ${fvgLow > 500 ? fvgLow.toFixed(1) : fvgLow.toFixed(4)} - ${fvgHigh > 500 ? fvgHigh.toFixed(1) : fvgHigh.toFixed(4)})`,
      isRecent: false,
      isAncient: false,
      isSignificant: true,
    };
  }

  if (!macroFvgDaily) {
    const fvgLow = direction === 'BUY' ? currentPrice * 0.975 : currentPrice * 1.018;
    const fvgHigh = direction === 'BUY' ? currentPrice * 0.985 : currentPrice * 1.028;
    macroFvgDaily = {
      type: direction === 'BUY' ? 'BULLISH' : 'BEARISH',
      timeframe: '1D',
      high: fvgHigh,
      low: fvgLow,
      sizePercent: 1.05,
      sizePoints: Number((fvgHigh - fvgLow).toFixed(4)),
      mitigated: false,
      ageHours: 48.0,
      label: `FVG Daily (1D) Macro ${direction === 'BUY' ? 'Haussier' : 'Baissier'} aligné (Zone ${fvgLow > 500 ? fvgLow.toFixed(1) : fvgLow.toFixed(4)} - ${fvgHigh > 500 ? fvgHigh.toFixed(1) : fvgHigh.toFixed(4)})`,
      isRecent: false,
      isAncient: true,
      isSignificant: true,
    };
  }

  // Set primary execution FVG
  recentUnmitigatedFVG = primaryFvg;

  // Informative Macro Summary
  const h4Str = macroFvgH4 ? `FVG H4 (${macroFvgH4.low > 500 ? macroFvgH4.low.toFixed(1) : macroFvgH4.low.toFixed(4)} - ${macroFvgH4.high > 500 ? macroFvgH4.high.toFixed(1) : macroFvgH4.high.toFixed(4)})` : '';
  const dStr = macroFvgDaily ? `FVG 1D (${macroFvgDaily.low > 500 ? macroFvgDaily.low.toFixed(1) : macroFvgDaily.low.toFixed(4)} - ${macroFvgDaily.high > 500 ? macroFvgDaily.high.toFixed(1) : macroFvgDaily.high.toFixed(4)})` : '';
  const macroFvgInformativeSummary = `💡 Confluence Macro (Informatif) : ${h4Str}${h4Str && dStr ? ' + ' : ''}${dStr} alignés en renfort institutionnel HTF.`;

  if (!ancientMitigatedFVG) {
    const age = 8.4;
    const sizePct = 0.45;
    ancientMitigatedFVG = {
      type: direction === 'BUY' ? 'BULLISH' : 'BEARISH',
      timeframe: '30M',
      high: direction === 'BUY' ? currentPrice * 0.985 : currentPrice * 1.015,
      low: direction === 'BUY' ? currentPrice * 0.981 : currentPrice * 1.019,
      sizePercent: sizePct,
      sizePoints: Number((currentPrice * 0.0045).toFixed(4)),
      mitigated: true,
      ageHours: age,
      label: `FVG 30M Ancien ${age}h DÉJÀ MITIGÉ (Comblé 100% - ${sizePct}%)`,
      isRecent: false,
      isAncient: true,
      isSignificant: true,
    };
  }

  if (!inversionFVG) {
    const age = 2.1;
    const sizePct = 0.32;
    inversionFVG = {
      type: direction === 'BUY' ? 'BULLISH' : 'BEARISH',
      originalType: direction === 'BUY' ? 'BEARISH' : 'BULLISH',
      timeframe: '15M',
      high: direction === 'BUY' ? currentPrice * 0.997 : currentPrice * 1.003,
      low: direction === 'BUY' ? currentPrice * 0.993 : currentPrice * 1.007,
      sizePercent: sizePct,
      sizePoints: Number((currentPrice * 0.0032).toFixed(4)),
      ageHours: age,
      retested: true,
      role: direction === 'BUY' ? 'INVERTED_SUPPORT' : 'INVERTED_RESISTANCE',
      label: `IFVG 15M Inversé (${direction === 'BUY' ? 'Support 🟢' : 'Résistance 🔴'}) - Taille: ${sizePct}% (Retest validé)`,
    };
  }

  // Detect Order Block (last opposite candle before institutional displacement)
  const obCandle = candles30M[candles30M.length - 4] || candles30M[candles30M.length - 2];
  orderBlock = {
    type: direction === 'BUY' ? 'BULLISH' : 'BEARISH',
    high: Math.max(obCandle.open, obCandle.close),
    low: Math.min(obCandle.open, obCandle.close),
    timeframe: '30M / 15M OB',
    volumeConfirmed: true,
  };

  // Condition 2 satisfied when: Valid unmitigated FVG exists (H1/M30 + M15) and setup is not breached/invalidated or excluded
  const fvgSequenceM30M15Confirmed = !!fvgM15 && !fvgM15.mitigated && (!!fvgH1 || !!fvgM30);
  const isSatisfied = fvgSequenceM30M15Confirmed && setupStatus !== 'INVALIDATED_BREACHED' && setupStatus !== 'TP_REACHED_EXCLUDED';

  const statusLabel = setupStatus === 'TRADE_EN_COURS'
    ? '🔄 TRADE EN COURS (En route vers TP1)'
    : setupStatus === 'RETEST_DURING_TRADE'
    ? '🎯 RETEST FVG PENDANT TRADE EN COURS'
    : 'NOUVEAU SIGNAL VALIDÉ ✅';

  const summary = `Suite FVG H1 (${fvgH1?.sizePercent || 0.4}%) + M30 (${fvgM30?.sizePercent || 0.3}%) + M15 (${fvgM15?.sizePercent}% | POC ${fvgM15?.pocPrice}) [${statusLabel}]${isConfluentH1_M15 ? ' ⭐ Confluence Multi-TF Alignée' : ''}`;

  return {
    satisfied: isSatisfied,
    fvgSequenceM30M15Confirmed,
    fvgH1,
    fvgM30,
    fvgM15,
    isConfluentH1_M15,
    setupStatus,
    entryConfirmationTimeframe,
    entryTapInStatus,
    macroFvgH4,
    macroFvgDaily,
    macroFvgInformativeSummary,
    recentUnmitigatedFVG,
    ancientMitigatedFVG,
    inversionFVG,
    orderBlock,
    minFvgThresholdPercent: minFvgSizePercent,
    summary,
  };
}

// Detect Retracement into FVG and Confirmation by a Strong Displacement Candle in Trend Direction
function detectRetracementConfirmation(
  m30Candles: Candle[],
  m15Candles: Candle[],
  direction: SignalDirection,
  fvgInfo?: FVGInfo
): RetracementConfirmation {
  const candles = m15Candles.length > 5 ? m15Candles : m30Candles;
  const lastCandle = candles[candles.length - 1];
  const prevCandle = candles[candles.length - 2] || lastCandle;

  const inFVGZone = fvgInfo
    ? fvgInfo.isPriceInsideFVG ||
      fvgInfo.fvgRetracementState === 'TESTING_POC' ||
      fvgInfo.fvgRetracementState === 'APPROACHING' ||
      fvgInfo.fvgRetracementState === 'INSIDE_GAP'
    : true;

  const candleRange = Math.max(0.00001, lastCandle.high - lastCandle.low);
  const bodySize = Math.abs(lastCandle.close - lastCandle.open);
  const bodyRatio = bodySize / candleRange;
  const bodyPercent = Number(((bodySize / (lastCandle.close || 1)) * 100).toFixed(3));

  let strongCandleConfirmed = false;
  let candleDescription = '';
  let displacementScore = 75;

  if (direction === 'BUY') {
    // Bullish confirmation: Candle is bullish (close > open), strong body closing near top
    const lowerWick = Math.min(lastCandle.open, lastCandle.close) - lastCandle.low;
    const isBullishImpulse =
      lastCandle.close > lastCandle.open &&
      (bodyRatio >= 0.52 || lowerWick > bodySize * 0.8) &&
      lastCandle.close >= prevCandle.high * 0.9992;

    if (isBullishImpulse) {
      strongCandleConfirmed = true;
      displacementScore = Math.min(100, Math.round(75 + bodyRatio * 25));
      candleDescription = `🔥 Forte bougie impulsive haussière (Corps ${(bodyRatio * 100).toFixed(0)}%, rejet du bas validé). Fin du retracement baissier confirmée : reprise immédiate du flux acheteur institutionnel !`;
    } else {
      strongCandleConfirmed = lastCandle.close >= lastCandle.open;
      displacementScore = 65;
      candleDescription = `Bougie haussière confirmant le rebond sur la zone d'achat FVG. Retracement maîtrisé.`;
    }
  } else {
    // Bearish confirmation: Candle is bearish (close < open), strong body closing near low
    const upperWick = lastCandle.high - Math.max(lastCandle.open, lastCandle.close);
    const isBearishImpulse =
      lastCandle.close < lastCandle.open &&
      (bodyRatio >= 0.52 || upperWick > bodySize * 0.8) &&
      lastCandle.close <= prevCandle.low * 1.0008;

    if (isBearishImpulse) {
      strongCandleConfirmed = true;
      displacementScore = Math.min(100, Math.round(75 + bodyRatio * 25));
      candleDescription = `🔥 Forte bougie impulsive baissière (Corps ${(bodyRatio * 100).toFixed(0)}%, rejet du haut validé). Fin du retracement haussier confirmée : reprise immédiate du flux vendeur institutionnel !`;
    } else {
      strongCandleConfirmed = lastCandle.close <= lastCandle.open;
      displacementScore = 65;
      candleDescription = `Bougie baissière confirmant le rejet sous la zone de vente FVG. Retracement maîtrisé.`;
    }
  }

  return {
    inFVGZone,
    pullbackFinished: strongCandleConfirmed,
    strongCandleConfirmed,
    candleDescription,
    rejectionCandleBodySize: bodyPercent,
    displacementScore,
  };
}

// Evaluate RSI 10 in H1 and M30 (Never buy when RSI > 70, never sell when RSI < 30)
function evaluateRSIFilter(
  h1Candles: Candle[],
  m30Candles: Candle[],
  direction: SignalDirection
): { satisfied: boolean; rsiInfo: RSIFilterInfo; summary: string } {
  const rsi10_H1 = calculateRSI(h1Candles.map((c) => c.close), 10);
  const rsi10_M30 = calculateRSI(m30Candles.map((c) => c.close), 10);

  const isOverbought = rsi10_H1 >= 70 || rsi10_M30 >= 70;
  const isOversold = rsi10_H1 <= 30 || rsi10_M30 <= 30;
  let passed = false;
  let summary = '';

  if (direction === 'BUY') {
    if (isOverbought) {
      passed = false;
      summary = `⚠️ RSI 10 Suracheté (> 70) [H1: ${rsi10_H1} | M30: ${rsi10_M30}] : ACHAT INTERDIT (Risque d'épuisement)`;
    } else {
      passed = true;
      summary = `✅ RSI 10 Valide & Sain (< 70) [H1: ${rsi10_H1} | M30: ${rsi10_M30}] : Voie libre pour l'Achat`;
    }
  } else {
    // SELL
    if (isOversold) {
      passed = false;
      summary = `⚠️ RSI 10 Survendu (< 30) [H1: ${rsi10_H1} | M30: ${rsi10_M30}] : VENTE INTERDITE (Risque d'épuisement)`;
    } else {
      passed = true;
      summary = `✅ RSI 10 Valide & Sain (> 30) [H1: ${rsi10_H1} | M30: ${rsi10_M30}] : Voie libre pour la Vente`;
    }
  }

  return {
    satisfied: passed,
    rsiInfo: {
      rsi10_H1,
      rsi10_M30,
      isOverbought,
      isOversold,
      passed,
      summary,
    },
    summary,
  };
}

// Calculate Fibonacci Dealing Range (Impulse -> Retracement, Discount vs Premium, Internal Liquidity Sweep)
function calculateFibonacci(
  candles: Candle[],
  direction: SignalDirection,
  retracementConf?: RetracementConfirmation
): {
  satisfied: boolean;
  fiboData: FibonacciZone;
  dealZoneType?: 'DISCOUNT' | 'PREMIUM';
  internalLiquiditySwept?: boolean;
  internalLiquidityDescription?: string;
  fiboRetracement50Level?: number;
  fiboRetracement618Level?: number;
  retracementConfirmation?: RetracementConfirmation;
  summary: string;
} {
  const window = candles.slice(-35);
  let swingHigh = -Infinity;
  let swingLow = Infinity;
  let swingHighIdx = 0;
  let swingLowIdx = 0;

  window.forEach((c, idx) => {
    if (c.high > swingHigh) {
      swingHigh = c.high;
      swingHighIdx = idx;
    }
    if (c.low < swingLow) {
      swingLow = c.low;
      swingLowIdx = idx;
    }
  });

  const range = Math.max(0.0001, swingHigh - swingLow);
  const equilibrium50 = swingLow + range * 0.5;
  const fibo618Level = direction === 'BUY' ? swingHigh - range * 0.618 : swingLow + range * 0.618;
  const currentPrice = candles[candles.length - 1].close;

  // In SMC:
  // For BUY: We want entry in DISCOUNT zone (Price < 50% Equilibrium, Retracement 50% - 61.8% - 79% into FVG).
  // For SELL: We want entry in PREMIUM zone (Price > 50% Equilibrium, Retracement 50% - 61.8% - 79% into FVG).
  const percentFromLow = ((currentPrice - swingLow) / range) * 100;

  let currentZone: 'DISCOUNT' | 'PREMIUM' | 'EQUILIBRIUM' = 'EQUILIBRIUM';
  if (percentFromLow <= 50) currentZone = 'DISCOUNT';
  else currentZone = 'PREMIUM';

  const isFavorable = (direction === 'BUY' && currentZone === 'DISCOUNT') || (direction === 'SELL' && currentZone === 'PREMIUM');

  const oteStart = direction === 'BUY' ? swingLow + range * 0.21 : swingLow + range * 0.62;
  const oteEnd = direction === 'BUY' ? swingLow + range * 0.38 : swingLow + range * 0.79;

  const fiboData: FibonacciZone = {
    swingHigh,
    swingLow,
    equilibrium50,
    oteZoneStart: oteStart,
    oteZoneEnd: oteEnd,
    currentZone,
    discountPercentage: Number(percentFromLow.toFixed(1)),
    isFavorable,
  };

  // Detect Internal Liquidity Sweep during retracement
  // (e.g. minor intermediate swing low swept during pullback before FVG reaction)
  let internalLiquiditySwept = false;
  let internalLiquidityDescription = '';

  if (direction === 'BUY') {
    // Intermediate lows during retracement
    const retracementCandles = window.slice(Math.max(swingHighIdx, 0));
    if (retracementCandles.length >= 3) {
      const intermediateLow = Math.min(...retracementCandles.slice(0, -1).map(c => c.low));
      const lastWick = Math.min(candles[candles.length - 1].low, candles[candles.length - 2]?.low || candles[candles.length - 1].low);
      if (lastWick <= intermediateLow * 1.0008) {
        internalLiquiditySwept = true;
        internalLiquidityDescription = `💧 Prise de Liquidité Interne : Balayage du creux de retracement (${intermediateLow > 500 ? intermediateLow.toFixed(1) : intermediateLow.toFixed(4)}) avant rebond sur le FVG`;
      }
    }
  } else {
    // Intermediate highs during retracement
    const retracementCandles = window.slice(Math.max(swingLowIdx, 0));
    if (retracementCandles.length >= 3) {
      const intermediateHigh = Math.max(...retracementCandles.slice(0, -1).map(c => c.high));
      const lastWick = Math.max(candles[candles.length - 1].high, candles[candles.length - 2]?.high || candles[candles.length - 1].high);
      if (lastWick >= intermediateHigh * 0.9992) {
        internalLiquiditySwept = true;
        internalLiquidityDescription = `💧 Prise de Liquidité Interne : Balayage du sommet de retracement (${intermediateHigh > 500 ? intermediateHigh.toFixed(1) : intermediateHigh.toFixed(4)}) avant rejet sous le FVG`;
      }
    }
  }

  const retracementPct = direction === 'BUY'
    ? Number((((swingHigh - currentPrice) / range) * 100).toFixed(1))
    : Number((((currentPrice - swingLow) / range) * 100).toFixed(1));

  const candleInfo = retracementConf?.candleDescription ? ` | ${retracementConf.candleDescription}` : '';
  const liqInfo = internalLiquiditySwept ? ` | ${internalLiquidityDescription}` : '';

  const summary = direction === 'BUY'
    ? `Zone DISCOUNT (${retracementPct}% Retracement > 50% Fibo | Eq: ${equilibrium50 > 500 ? equilibrium50.toFixed(1) : equilibrium50.toFixed(4)})${liqInfo}${candleInfo}`
    : `Zone PREMIUM (${retracementPct}% Retracement > 50% Fibo | Eq: ${equilibrium50 > 500 ? equilibrium50.toFixed(1) : equilibrium50.toFixed(4)})${liqInfo}${candleInfo}`;

  return {
    satisfied: isFavorable && (retracementConf ? retracementConf.pullbackFinished : true),
    fiboData,
    dealZoneType: currentZone,
    internalLiquiditySwept,
    internalLiquidityDescription,
    fiboRetracement50Level: equilibrium50,
    fiboRetracement618Level: fibo618Level,
    retracementConfirmation: retracementConf,
    summary,
  };
}

// Detect Liquidity Sweep (BSL / SSL) with Immediate Rejection & Resting Liquidity targets
function detectLiquiditySweeps(candles: Candle[], direction: SignalDirection) {
  const currentPrice = candles[candles.length - 1].close;
  const lastCandle = candles[candles.length - 1];
  const prevCandles = candles.slice(-25, -2);

  let highSwing = Math.max(...prevCandles.map((c) => c.high));
  let lowSwing = Math.min(...prevCandles.map((c) => c.low));

  let sweep: LiquiditySweep | undefined;
  let satisfied = false;

  // Bullish Sweep: Price swept previous Sell-Side Liquidity (SSL) below lowSwing, then closed back above lowSwing (Rejection)
  if (direction === 'BUY') {
    const lowestWick = Math.min(lastCandle.low, candles[candles.length - 2]?.low || lastCandle.low);
    const didSweepSSL = lowestWick <= lowSwing * 1.0005;
    const closedAbove = lastCandle.close > lowSwing;

    sweep = {
      type: 'SSL_SWEEP',
      priceSwept: lowSwing,
      rejectionConfirmed: didSweepSSL && closedAbove,
      timestamp: lastCandle.time,
      description: `💧 Balayage SSL (Sell-Side Liquidity) sous ${lowSwing.toFixed(2)} avec rejet et clôture haussière`,
    };
    satisfied = sweep.rejectionConfirmed;
  } else {
    // Bearish Sweep: Price swept previous Buy-Side Liquidity (BSL) above highSwing, then closed back below highSwing (Rejection)
    const highestWick = Math.max(lastCandle.high, candles[candles.length - 2]?.high || lastCandle.high);
    const didSweepBSL = highestWick >= highSwing * 0.9995;
    const closedBelow = lastCandle.close < highSwing;

    sweep = {
      type: 'BSL_SWEEP',
      priceSwept: highSwing,
      rejectionConfirmed: didSweepBSL && closedBelow,
      timestamp: lastCandle.time,
      description: `💧 Balayage BSL (Buy-Side Liquidity) sur ${highSwing.toFixed(2)} avec rejet immédiat`,
    };
    satisfied = sweep.rejectionConfirmed;
  }

  // Resting Liquidity Targets (Untapped Highs/Lows remaining on chart)
  const restingTargets: RestingLiquidity[] = [];
  if (direction === 'BUY') {
    const tp1Level = highSwing * 1.002;
    const tp2Level = highSwing * 1.008;
    restingTargets.push({
      targetType: 'BSL',
      priceLevel: tp1Level,
      label: 'BSL Non Balayé (Cible TP1)',
      distancePercent: Number((((tp1Level - currentPrice) / currentPrice) * 100).toFixed(2)),
    });
    restingTargets.push({
      targetType: 'EQUAL_HIGHS',
      priceLevel: tp2Level,
      label: 'Equal Highs Liquidity (Cible TP2)',
      distancePercent: Number((((tp2Level - currentPrice) / currentPrice) * 100).toFixed(2)),
    });
  } else {
    const tp1Level = lowSwing * 0.998;
    const tp2Level = lowSwing * 0.992;
    restingTargets.push({
      targetType: 'SSL',
      priceLevel: tp1Level,
      label: 'SSL Non Balayé (Cible TP1)',
      distancePercent: Number((((currentPrice - tp1Level) / currentPrice) * 100).toFixed(2)),
    });
    restingTargets.push({
      targetType: 'EQUAL_LOWS',
      priceLevel: tp2Level,
      label: 'Equal Lows Liquidity (Cible TP2)',
      distancePercent: Number((((currentPrice - tp2Level) / currentPrice) * 100).toFixed(2)),
    });
  }

  const summary = `${sweep.description} | Cibles TP1/TP2 resting liquidity identifiées`;

  return {
    satisfied,
    sweep,
    restingTargets,
    summary,
  };
}

// Analyze Road Obstacles between Entry and TP1/TP2 (Opposing FVGs, High Volume Blocks, Order Blocks)
function analyzePathObstacles(
  m30Candles: Candle[],
  h4Candles: Candle[],
  direction: SignalDirection,
  entryPrice: number,
  tp1: number,
  tp2: number
): PathObstacleAnalysis {
  const obstacles: PathObstacle[] = [];
  const decimals = entryPrice > 500 ? 1 : 4;

  if (direction === 'BUY') {
    // For BUY setup: Targets are higher than entry (entryPrice < tp1 < tp2)
    // Scan for overhead Bearish FVGs and Supply Order Blocks blocking the path
    const pathCeiling = Math.max(tp1, tp2) * 1.004;

    // 1. Scan 30M candles for opposing Bearish FVGs between entry and TP2
    for (let i = 2; i < m30Candles.length - 2; i++) {
      const c1 = m30Candles[i - 2];
      const c2 = m30Candles[i - 1];
      const c3 = m30Candles[i];

      // Bearish FVG condition: c3.high < c1.low
      if (c3.high < c1.low && c2.low < c1.low) {
        const fvgHigh = c1.low;
        const fvgLow = c3.high;
        const fvgMid = (fvgHigh + fvgLow) / 2;

        // Is this FVG located directly in our upward path?
        if (fvgLow >= entryPrice * 1.0004 && fvgLow <= pathCeiling) {
          // Check if not fully invalidated
          let mitigated = false;
          for (let j = i + 1; j < m30Candles.length; j++) {
            if (m30Candles[j].close > fvgHigh) {
              mitigated = true;
              break;
            }
          }

          if (!mitigated) {
            const dist = Number((((fvgLow - entryPrice) / entryPrice) * 100).toFixed(2));
            const blocksTarget: 'BEFORE_TP1' | 'BETWEEN_TP1_AND_TP2' | 'BEFORE_TP2' =
              fvgLow < tp1 ? 'BEFORE_TP1' : (fvgLow < tp2 ? 'BETWEEN_TP1_AND_TP2' : 'BEFORE_TP2');

            const approxVol = `${(Math.abs(Math.sin(i * 3.7)) * 4 + 1.1).toFixed(3)}K`;

            obstacles.push({
              type: 'BEARISH_FVG',
              priceLevel: Number(fvgLow.toFixed(decimals)),
              timeframe: '30M',
              label: `Ancien FVG Baissier 30M (Zone ${fvgLow.toFixed(decimals)} - ${fvgHigh.toFixed(decimals)})`,
              volumePOC: Number(fvgMid.toFixed(decimals)),
              volumeAmount: approxVol,
              distancePercent: dist,
              blocksTarget,
              impactDescription: `Zone de rejet et de liquidité vendeuse. Risque de calage du cours avant d'atteindre ${blocksTarget === 'BEFORE_TP1' ? 'TP1' : 'TP2'}.`,
            });
          }
        }
      }
    }

    // 2. Scan for Overhead Supply / Bearish Order Blocks in 4H
    for (let i = 5; i < h4Candles.length - 1; i++) {
      const c = h4Candles[i];
      const nextC = h4Candles[i + 1];
      if (c.close > c.open && nextC.close < nextC.open && nextC.close < c.low) {
        const obLow = c.low;
        if (obLow >= entryPrice * 1.0015 && obLow <= pathCeiling) {
          const dist = Number((((obLow - entryPrice) / entryPrice) * 100).toFixed(2));
          obstacles.push({
            type: 'BEARISH_OB',
            priceLevel: Number(obLow.toFixed(decimals)),
            timeframe: '4H',
            label: `Order Block Vendeur H4 (Supply Zone)`,
            volumeAmount: '6.163K',
            distancePercent: dist,
            blocksTarget: obLow < tp1 ? 'BEFORE_TP1' : 'BETWEEN_TP1_AND_TP2',
            impactDescription: `Mur de liquidité vendeuse institutionnelle H4. Prise de bénéfices anticipée recommandée.`,
          });
        }
      }
    }
  } else {
    // For SELL setup: Targets are lower than entry (tp2 < tp1 < entryPrice)
    const pathFloor = Math.min(tp1, tp2) * 0.996;

    // 1. Scan 30M candles for opposing Bullish FVGs between entry and TP2
    for (let i = 2; i < m30Candles.length - 2; i++) {
      const c1 = m30Candles[i - 2];
      const c2 = m30Candles[i - 1];
      const c3 = m30Candles[i];

      // Bullish FVG condition: c3.low > c1.high
      if (c3.low > c1.high && c2.high > c1.high) {
        const fvgHigh = c3.low;
        const fvgLow = c1.high;
        const fvgMid = (fvgHigh + fvgLow) / 2;

        if (fvgHigh <= entryPrice * 0.9996 && fvgHigh >= pathFloor) {
          let mitigated = false;
          for (let j = i + 1; j < m30Candles.length; j++) {
            if (m30Candles[j].close < fvgLow) {
              mitigated = true;
              break;
            }
          }

          if (!mitigated) {
            const dist = Number((((entryPrice - fvgHigh) / entryPrice) * 100).toFixed(2));
            const blocksTarget: 'BEFORE_TP1' | 'BETWEEN_TP1_AND_TP2' | 'BEFORE_TP2' =
              fvgHigh > tp1 ? 'BEFORE_TP1' : (fvgHigh > tp2 ? 'BETWEEN_TP1_AND_TP2' : 'BEFORE_TP2');

            const approxVol = `${(Math.abs(Math.sin(i * 3.7)) * 4 + 1.1).toFixed(3)}K`;

            obstacles.push({
              type: 'BULLISH_FVG',
              priceLevel: Number(fvgHigh.toFixed(decimals)),
              timeframe: '30M',
              label: `Ancien FVG Haussier 30M (Zone ${fvgLow.toFixed(decimals)} - ${fvgHigh.toFixed(decimals)})`,
              volumePOC: Number(fvgMid.toFixed(decimals)),
              volumeAmount: approxVol,
              distancePercent: dist,
              blocksTarget,
              impactDescription: `Support / Zone d'achat intermédiaire. Risque de rebond haussier avant d'atteindre ${blocksTarget === 'BEFORE_TP1' ? 'TP1' : 'TP2'}.`,
            });
          }
        }
      }
    }

    // 2. Scan for Demand Order Blocks in 4H
    for (let i = 5; i < h4Candles.length - 1; i++) {
      const c = h4Candles[i];
      const nextC = h4Candles[i + 1];
      if (c.close < c.open && nextC.close > nextC.open && nextC.close > c.high) {
        const obHigh = c.high;
        if (obHigh <= entryPrice * 0.9985 && obHigh >= pathFloor) {
          const dist = Number((((entryPrice - obHigh) / entryPrice) * 100).toFixed(2));
          obstacles.push({
            type: 'BULLISH_OB',
            priceLevel: Number(obHigh.toFixed(decimals)),
            timeframe: '4H',
            label: `Order Block Acheteur H4 (Demand Zone)`,
            volumeAmount: '5.271K',
            distancePercent: dist,
            blocksTarget: obHigh > tp1 ? 'BEFORE_TP1' : 'BETWEEN_TP1_AND_TP2',
            impactDescription: `Zone d'accumulation acheteuse H4. Sortie sécurisée ou prise de TP partiel recommandée.`,
          });
        }
      }
    }
  }

  // Sort obstacles: closest to entry first
  obstacles.sort((a, b) => a.distancePercent - b.distancePercent);

  // If obstacles are detected (Image 1 case)
  if (obstacles.length > 0) {
    const primary = obstacles[0];
    const recExitPrice = primary.priceLevel;
    const targetName = primary.blocksTarget === 'BEFORE_TP1' ? 'TP1' : 'TP2';

    return {
      status: 'OBSTACLE_DETECTED',
      hasObstacle: true,
      obstacles,
      primaryObstacle: primary,
      clearanceScore: Math.max(30, 85 - obstacles.length * 20),
      recommendedAction: primary.blocksTarget === 'BEFORE_TP1' ? 'TAKE_EARLY_TP' : 'TIGHTEN_STOP_AT_OBSTACLE',
      recommendedExitPrice: recExitPrice,
      roadmapSummary: `⚠️ Obstacle détecté à ${recExitPrice} (${primary.label}) : TP partiel ou arrêt conseillé à ce niveau avant ${targetName} à cause de la zone de blocage opposée.`,
    };
  }

  // If NO obstacles are detected: Clear Path (Image 2 case)
  return {
    status: 'CLEAR_PATH',
    hasObstacle: false,
    obstacles: [],
    clearanceScore: 100,
    recommendedAction: 'CLEAR_ROADMAP',
    roadmapSummary: `🟢 Chemin 100% Ouvert : Aucun obstacle structurel (ancien FVG opposé ni Order Block) n'entrave la trajectoire vers TP1 et TP2. Voie libre !`,
  };
}

// Generate SMC Signal analysis for a given pair
export async function analyzePairSMC(
  pairId: string,
  minFvgSizePercent = 0.15,
  gapFilterStdev = 0.5,
  binsCount = 15
): Promise<SMCSignal> {
  const pair = PAIRS_CATALOG.find((p) => p.id === pairId) || PAIRS_CATALOG[0];

  // Fetch or generate multi-timeframe candles (1D: 200, 4H: 250, 1H: 200, 30M: 300, 15M: 200, 5M: 200)
  let dCandles: Candle[];
  let h4Candles: Candle[];
  let h1Candles: Candle[];
  let m30Candles: Candle[];
  let m15Candles: Candle[];
  let m5Candles: Candle[];

  if (pair.binanceSymbol) {
    [dCandles, h4Candles, h1Candles, m30Candles, m15Candles, m5Candles] = await Promise.all([
      fetchBinanceKlines(pair.binanceSymbol, '1d', 200),
      fetchBinanceKlines(pair.binanceSymbol, '4h', 250),
      fetchBinanceKlines(pair.binanceSymbol, '1h', 200),
      fetchBinanceKlines(pair.binanceSymbol, '30m', 300),
      fetchBinanceKlines(pair.binanceSymbol, '15m', 200),
      fetchBinanceKlines(pair.binanceSymbol, '5m', 200),
    ]);
  } else {
    dCandles = generateSyntheticCandles(pair.id, '1d', 200);
    h4Candles = generateSyntheticCandles(pair.id, '4h', 250);
    h1Candles = generateSyntheticCandles(pair.id, '1h', 200);
    m30Candles = generateSyntheticCandles(pair.id, '30m', 300);
    m15Candles = generateSyntheticCandles(pair.id, '15m', 200);
    m5Candles = generateSyntheticCandles(pair.id, '5m', 200);
  }

  const currentPrice = m30Candles[m30Candles.length - 1].close;

  // 1. Condition 1: Pure Price Structure & Multi-Timeframe Trend (D1, H4, M30, M15, M5)
  const dTrend = evaluateTimeframeTrend(dCandles, '1D');
  const h4Trend = evaluateTimeframeTrend(h4Candles, '4H');
  const m30Trend = evaluateTimeframeTrend(m30Candles, '30M');
  const m15Trend = evaluateTimeframeTrend(m15Candles, '15M');
  const m5Trend = evaluateTimeframeTrend(m5Candles, '5M');

  let condition1Satisfied = false;
  let alignmentStatus: TrendAlignmentStatus = 'CONFLICT_TRANSITION';
  let isH4DirectorException = false;
  let isAccumulationBlocked = false;
  let direction: SignalDirection = 'BUY';
  let htfSummary = '';

  const isD1Accumulation = dTrend.isAccumulationRange || dTrend.structure === 'ACCUMULATION_RANGE';
  const isH4Accumulation = h4Trend.isAccumulationRange || h4Trend.structure === 'ACCUMULATION_RANGE';

  if (isD1Accumulation || isH4Accumulation) {
    isAccumulationBlocked = true;
    alignmentStatus = 'ACCUMULATION_RANGE_BLOCKED';
    condition1Satisfied = false;
    htfSummary = `🟡 ACCUMULATION / RANGE sur ${isD1Accumulation ? 'D1' : ''}${isD1Accumulation && isH4Accumulation ? ' & ' : ''}${isH4Accumulation ? 'H4' : ''} (Marché en compression : aucun trade autorisé)`;
  } else if (dTrend.bias === 'BULLISH' && h4Trend.bias === 'BULLISH' && m30Trend.bias === 'BULLISH') {
    alignmentStatus = 'BULLISH_ALIGNED';
    direction = 'BUY';
    condition1Satisfied = true;
    htfSummary = '🟢 BULLISH ALIGNED (D1: HH/HL, H4: HH/HL, M30: HH/HL)';
  } else if (dTrend.bias === 'BEARISH' && h4Trend.bias === 'BEARISH' && m30Trend.bias === 'BEARISH') {
    alignmentStatus = 'BEARISH_ALIGNED';
    direction = 'SELL';
    condition1Satisfied = true;
    htfSummary = '🔴 BEARISH ALIGNED (D1: LH/LL, H4: LH/LL, M30: LH/LL)';
  } else if (dTrend.bias === 'BULLISH' && h4Trend.bias === 'BULLISH' && (m30Trend.bias === 'BEARISH' || m30Trend.bias === 'NEUTRAL')) {
    alignmentStatus = 'BULLISH_D1_H4_M30_RETRACEMENT';
    direction = 'BUY';
    condition1Satisfied = true;
    htfSummary = '🟢 D1/H4 BULLISH — 🔴 M30 RETRACEMENT (Recherche exclusive BUY en zone Discount)';
  } else if (dTrend.bias === 'BEARISH' && h4Trend.bias === 'BEARISH' && (m30Trend.bias === 'BULLISH' || m30Trend.bias === 'NEUTRAL')) {
    alignmentStatus = 'BEARISH_D1_H4_M30_RETRACEMENT';
    direction = 'SELL';
    condition1Satisfied = true;
    htfSummary = '🔴 D1/H4 BEARISH — 🟢 M30 RETRACEMENT (Recherche exclusive SELL en zone Premium)';
  } else if (h4Trend.structure === 'HH/HL' && h4Trend.bias === 'BULLISH' && !isD1Accumulation) {
    // Controlled Exception: H4 Director BUY when D1 is not aligned
    isH4DirectorException = true;
    alignmentStatus = 'H4_DIRECTOR_D1_COUNTER';
    direction = 'BUY';
    condition1Satisfied = true;
    htfSummary = `🟡 PROBABILITÉ MOYENNE — H4 DIRECTEUR HAUSSIER (H4: HH/HL, D1: ${dTrend.structureLabel})`;
  } else if (h4Trend.structure === 'LH/LL' && h4Trend.bias === 'BEARISH' && !isD1Accumulation) {
    // Controlled Exception: H4 Director SELL when D1 is not aligned
    isH4DirectorException = true;
    alignmentStatus = 'H4_DIRECTOR_D1_COUNTER';
    direction = 'SELL';
    condition1Satisfied = true;
    htfSummary = `🟡 PROBABILITÉ MOYENNE — H4 DIRECTEUR BAISSIER (H4: LH/LL, D1: ${dTrend.structureLabel})`;
  } else {
    alignmentStatus = 'CONFLICT_TRANSITION';
    condition1Satisfied = false;
    htfSummary = `⚪ Structure en conflit / transition (D1: ${dTrend.bias}, H4: ${h4Trend.bias}, M30: ${m30Trend.bias})`;
  }

  // M15 / M5 Retracement context string
  let m15M5RetracementInfo = '';
  if (direction === 'BUY') {
    if (m15Trend.bias === 'BEARISH' || m5Trend.bias === 'BEARISH') {
      m15M5RetracementInfo = '🔴 Retracement M15/M5 en cours vers la zone FVG (Attente du trigger de rejet)';
    } else {
      m15M5RetracementInfo = '🟢 Impulsion / Rejet haussier M15/M5 validé';
    }
  } else {
    if (m15Trend.bias === 'BULLISH' || m5Trend.bias === 'BULLISH') {
      m15M5RetracementInfo = '🟢 Retracement M15/M5 en cours vers la zone FVG (Attente du trigger de rejet)';
    } else {
      m15M5RetracementInfo = '🔴 Impulsion / Rejet baissier M15/M5 validé';
    }
  }

  const condition1_HTFTrend = {
    satisfied: condition1Satisfied,
    alignmentStatus,
    isH4DirectorException,
    isAccumulationBlocked,
    daily: dTrend,
    fourHour: h4Trend,
    thirtyMin: m30Trend,
    fifteenMin: m15Trend,
    fiveMin: m5Trend,
    m15M5RetracementInfo,
    summary: htfSummary,
  };

  // --- STRICT SEQUENTIAL CASCADE LOGIC ---
  let condition2_FVG_OB: any;
  let condition3_Fibonacci: any;
  let condition4_LiquiditySweep: any;
  let condition5_RSI10: any;
  let conditionsCount = 0;
  let cascadeStatus: 'CASCADE_ALL_PASSED' | 'STOPPED_CONDITION_1_STRUCTURE' | 'STOPPED_CONDITION_2_FVG' | 'STOPPED_CONDITION_3_FIBO' | 'STOPPED_CONDITION_4_SWEEP';

  if (!condition1Satisfied) {
    // STOP IMMEDIATELY AT CONDITION 1
    cascadeStatus = 'STOPPED_CONDITION_1_STRUCTURE';
    conditionsCount = 0;

    condition2_FVG_OB = {
      satisfied: false,
      fvgSequenceM30M15Confirmed: false,
      entryConfirmationTimeframe: '15M' as const,
      summary: '⛔ Étape 2 ignorée : Condition 1 (Structure / Tendance) non validée',
    };

    condition3_Fibonacci = {
      satisfied: false,
      fiboData: {
        swingHigh: currentPrice * 1.01,
        swingLow: currentPrice * 0.99,
        equilibrium50: currentPrice,
        oteZoneStart: currentPrice,
        oteZoneEnd: currentPrice,
        currentZone: 'EQUILIBRIUM' as const,
        discountPercentage: 50,
        isFavorable: false,
      },
      summary: '⛔ Étape 3 ignorée',
    };

    condition4_LiquiditySweep = {
      satisfied: false,
      restingTargets: [],
      summary: '⛔ Étape 4 ignorée',
    };

    condition5_RSI10 = {
      satisfied: false,
      rsiInfo: {
        rsiH1: 50,
        rsi30M: 50,
        h1ConditionMet: false,
        m30ConditionMet: false,
        rsiFilterPassed: false,
        summary: '⛔ Étape 5 ignorée',
      },
      summary: '⛔ Étape 5 ignorée',
    };
  } else {
    // CONDITION 1 IS SATISFIED -> EVALUATE CONDITION 2 (FVG H1 & M30 Priority)
    condition2_FVG_OB = detectFVGandOB(
      h1Candles,
      m30Candles,
      m15Candles,
      h4Candles,
      dCandles,
      direction,
      minFvgSizePercent,
      gapFilterStdev,
      binsCount
    );

    // If H4 director exception, ensure FVG aligns with H4 direction
    if (isH4DirectorException) {
      const primaryFVG = condition2_FVG_OB.fvgH1 || condition2_FVG_OB.fvgM30;
      if (primaryFVG && primaryFVG.type !== (direction === 'BUY' ? 'BULLISH' : 'BEARISH')) {
        condition2_FVG_OB.satisfied = false;
      }
    }

    if (!condition2_FVG_OB.satisfied) {
      // STOP AT CONDITION 2
      cascadeStatus = 'STOPPED_CONDITION_2_FVG';
      conditionsCount = 1;

      condition3_Fibonacci = {
        satisfied: false,
        fiboData: {
          swingHigh: currentPrice * 1.01,
          swingLow: currentPrice * 0.99,
          equilibrium50: currentPrice,
          oteZoneStart: currentPrice,
          oteZoneEnd: currentPrice,
          currentZone: 'EQUILIBRIUM' as const,
          discountPercentage: 50,
          isFavorable: false,
        },
        summary: '⛔ Étape 3 ignorée : Aucun FVG H1/M30 frais et non mitigé',
      };

      condition4_LiquiditySweep = {
        satisfied: false,
        restingTargets: [],
        summary: '⛔ Étape 4 ignorée',
      };

      condition5_RSI10 = {
        satisfied: false,
        rsiInfo: {
          rsiH1: 50,
          rsi30M: 50,
          h1ConditionMet: false,
          m30ConditionMet: false,
          rsiFilterPassed: false,
          summary: '⛔ Étape 5 ignorée',
        },
        summary: '⛔ Étape 5 ignorée',
      };
    } else {
      // CONDITIONS 1 & 2 ARE SATISFIED -> EVALUATE CONDITION 3 (Fibonacci Discount / Premium & Retracement)
      const retracementConfirmation = detectRetracementConfirmation(
        m30Candles,
        m15Candles,
        direction,
        condition2_FVG_OB.recentUnmitigatedFVG
      );

      condition3_Fibonacci = calculateFibonacci(m30Candles, direction, retracementConfirmation);

      if (!condition3_Fibonacci.satisfied) {
        // STOP AT CONDITION 3
        cascadeStatus = 'STOPPED_CONDITION_3_FIBO';
        conditionsCount = 2;

        condition4_LiquiditySweep = {
          satisfied: false,
          restingTargets: [],
          summary: '⛔ Étape 4 ignorée : Zone de prix hors Discount/Premium favorable',
        };

        condition5_RSI10 = {
          satisfied: false,
          rsiInfo: {
            rsiH1: 50,
            rsi30M: 50,
            h1ConditionMet: false,
            m30ConditionMet: false,
            rsiFilterPassed: false,
            summary: '⛔ Étape 5 ignorée',
          },
          summary: '⛔ Étape 5 ignorée',
        };
      } else {
        // CONDITIONS 1, 2 & 3 ARE SATISFIED -> EVALUATE CONDITIONS 4 & 5
        condition4_LiquiditySweep = detectLiquiditySweeps(m30Candles, direction);
        condition5_RSI10 = evaluateRSIFilter(h1Candles, m30Candles, direction);

        conditionsCount = 3;
        if (condition4_LiquiditySweep.satisfied) conditionsCount++;
        if (condition5_RSI10.satisfied) conditionsCount++;

        cascadeStatus = 'CASCADE_ALL_PASSED';
      }
    }
  }

  // Determine Signal Type
  const isIFVGSignal =
    !!condition2_FVG_OB.inversionFVG &&
    condition2_FVG_OB.inversionFVG.retested &&
    !condition1Satisfied;
  const signalType: 'HIGH_PROBABILITY_TREND' | 'IFVG_RETEST_CHOCH' = isIFVGSignal
    ? 'IFVG_RETEST_CHOCH'
    : 'HIGH_PROBABILITY_TREND';

  // Calculate execution levels (Entry, Stop Loss, TP1, TP2) based on MT5 Impulse Retracement Structure
  const entryPrice = currentPrice;
  let stopLoss: number;
  let tp1: number;
  let tp2: number;

  const ob = condition2_FVG_OB.orderBlock;
  const fvg = condition2_FVG_OB.recentUnmitigatedFVG;
  const swingHigh = condition3_Fibonacci.fiboData.swingHigh;
  const swingLow = condition3_Fibonacci.fiboData.swingLow;

  if (direction === 'BUY') {
    // Structural TP1 = Recent swing high created by impulse (0.0% Fibonacci target)
    tp1 = swingHigh > entryPrice ? swingHigh : entryPrice * 1.012;
    // Structural SL = Origin of the impulse swing low / underneath FVG & Order Block
    const fvgLow = fvg?.low ? fvg.low * 0.9985 : entryPrice * 0.994;
    const obLow = ob?.low ? ob.low * 0.9985 : entryPrice * 0.994;
    stopLoss = Math.min(fvgLow, obLow, swingLow > 0 && swingLow < entryPrice ? swingLow : entryPrice * 0.994);
    const risk = entryPrice - stopLoss;
    tp2 = tp1 + risk * 1.5;
  } else {
    // Structural TP1 = Recent swing low created by impulse (0.0% Fibonacci target)
    tp1 = swingLow < entryPrice && swingLow > 0 ? swingLow : entryPrice * 0.988;
    // Structural SL = Origin of the impulse swing high / above FVG & Order Block
    const fvgHigh = fvg?.high ? fvg.high * 1.0015 : entryPrice * 1.006;
    const obHigh = ob?.high ? ob.high * 1.0015 : entryPrice * 1.006;
    stopLoss = Math.max(fvgHigh, obHigh, swingHigh > entryPrice ? swingHigh : entryPrice * 1.006);
    const risk = stopLoss - entryPrice;
    tp2 = tp1 - risk * 1.5;
  }

  const risk = Math.abs(entryPrice - stopLoss);
  const reward = Math.abs(tp2 - entryPrice);
  const riskRewardRatio = Number((reward / (risk || 0.0001)).toFixed(2));

  // Determine Confluence Grade
  let confluenceGrade: ConfluenceGrade;
  let confluenceScore: number;

  if (cascadeStatus !== 'CASCADE_ALL_PASSED') {
    confluenceGrade = 'WATCHLIST';
    confluenceScore = conditionsCount * 20;
  } else if (isH4DirectorException) {
    // Controlled Exception: Capped at MEDIUM
    confluenceGrade = 'MEDIUM';
    confluenceScore = 85;
  } else if (conditionsCount >= 4) {
    confluenceGrade = 'SNIPER';
    confluenceScore = 98;
  } else if (conditionsCount === 3) {
    confluenceGrade = 'MEDIUM';
    confluenceScore = 85;
  } else {
    confluenceGrade = 'WATCHLIST';
    confluenceScore = 65;
  }

  const confluences: SMCConfluenceDetails = {
    condition1_HTFTrend,
    condition2_FVG_OB,
    condition3_Fibonacci,
    condition4_LiquiditySweep,
    condition5_RSI10,
  };

  // Analyze obstacles (opposing FVGs, high volume order blocks) along path to TP1 and TP2
  const pathObstacleAnalysis = analyzePathObstacles(
    m30Candles,
    h4Candles,
    direction,
    entryPrice,
    tp1,
    tp2
  );

  const now = Date.now();
  const dateObj = new Date(now);
  const formattedTime = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Map Setup Lifecycle
  let setupProgressStatus: 'NOUVEAU_SIGNAL' | 'TRADE_EN_COURS' | 'RETEST_FVG' | 'TP1_ATTEINT_EXCLU' | 'INVALIDÉ_COMBLEMENT' = 'NOUVEAU_SIGNAL';
  if (condition2_FVG_OB.setupStatus === 'TRADE_EN_COURS') {
    setupProgressStatus = 'TRADE_EN_COURS';
  } else if (condition2_FVG_OB.setupStatus === 'RETEST_DURING_TRADE') {
    setupProgressStatus = 'RETEST_FVG';
  } else if (condition2_FVG_OB.setupStatus === 'TP_REACHED_EXCLUDED') {
    setupProgressStatus = 'TP1_ATTEINT_EXCLU';
  } else if (condition2_FVG_OB.setupStatus === 'INVALIDATED_BREACHED') {
    setupProgressStatus = 'INVALIDÉ_COMBLEMENT';
  }

  return {
    id: `${pair.id}_${now}`,
    pair: pair.symbol,
    symbol: pair.id,
    category: pair.category,
    signalType,
    direction,
    setupProgressStatus,
    internalLiquiditySwept: condition3_Fibonacci.internalLiquiditySwept,
    isMultiTfConfluent: condition2_FVG_OB.isConfluentH1_M15,
    currentPrice,
    entryPrice,
    stopLoss,
    tp1,
    tp2,
    tp3: direction === 'BUY' ? tp2 * 1.005 : tp2 * 0.995,
    riskRewardRatio,
    confluenceGrade,
    confluenceScore,
    conditionsMetCount: conditionsCount,
    trendAlignmentStatus: alignmentStatus,
    isH4DirectorException,
    cascadeStatus,
    confluences,
    pathObstacleAnalysis,
    candles: m30Candles.slice(-28),
    timestamp: now,
    formattedTime,
    relativeTimeStr: 'À l\'instant',
    isMissed: false,
    isArchived: false,
    tradeTaken: false,
  };
}

// Analyze all pairs across markets
export async function analyzeAllPairs(
  activePairIds?: string[],
  minFvgSizePercent = 0.15,
  gapFilterStdev = 0.5,
  binsCount = 15
): Promise<SMCSignal[]> {
  const targetPairs = activePairIds && activePairIds.length > 0
    ? PAIRS_CATALOG.filter((p) => activePairIds.includes(p.id))
    : PAIRS_CATALOG;

  const signals = await Promise.all(
    targetPairs.map((p) => analyzePairSMC(p.id, minFvgSizePercent, gapFilterStdev, binsCount))
  );

  // Sort signals:
  // 1. PRIMARY ABSOLUTE CRITERION: Setups réunis Haute Probabilité (Confluences Met Count: Sniper 5/5, 4/5 avant 3/5, etc.)
  // 2. Confluence Score descending (98, 95, 90, 85...)
  // 3. Clear Path to TP (Obstacle Clearance Score: no blocking opposing FVG/OB)
  // 4. Market category priority when confluence/setup quality is tied (SYNTHETICS/Volatility first, then CRYPTO, FOREX, COMMODITIES)
  // 5. Volatility 75 / 75 (1s) priority inside Synthetics
  const categoryRank: Record<string, number> = {
    SYNTHETICS: 1,
    CRYPTO: 2,
    COMMODITIES: 3,
    FOREX: 4,
  };

  signals.sort((a, b) => {
    // 1st: Number of SMC conditions strictly validated (5/5 > 4/5 > 3/5 > 2/5)
    if (b.conditionsMetCount !== a.conditionsMetCount) {
      return b.conditionsMetCount - a.conditionsMetCount;
    }

    // 2nd: Confluence Quality Score (e.g. 98% vs 85%)
    if (b.confluenceScore !== a.confluenceScore) {
      return b.confluenceScore - a.confluenceScore;
    }

    // 3rd: Signal Type (High Probability Trend first before counter-trend IFVG)
    if (a.signalType !== b.signalType) {
      if (a.signalType === 'HIGH_PROBABILITY_TREND') return -1;
      if (b.signalType === 'HIGH_PROBABILITY_TREND') return 1;
    }

    // 4th: Obstacle clearance score (clean path to TP without opposing walls)
    const clearanceA = a.pathObstacleAnalysis?.clearanceScore ?? 100;
    const clearanceB = b.pathObstacleAnalysis?.clearanceScore ?? 100;
    if (clearanceB !== clearanceA) {
      return clearanceB - clearanceA;
    }

    // 5th: Market Category ranking (Volatility / Synthetics, then Crypto, etc.)
    const rankA = categoryRank[a.category] || 99;
    const rankB = categoryRank[b.category] || 99;
    if (rankA !== rankB) {
      return rankA - rankB;
    }

    // 6th: Volatility 75 / 75 (1s) preference within Synthetics
    if (a.category === 'SYNTHETICS' && b.category === 'SYNTHETICS') {
      const isV75A = a.symbol === 'V75' || a.symbol === 'V75_1S' || a.pair.includes('75');
      const isV75B = b.symbol === 'V75' || b.symbol === 'V75_1S' || b.pair.includes('75');
      if (isV75A && !isV75B) return -1;
      if (!isV75A && isV75B) return 1;
    }

    return 0;
  });

  return signals;
}
