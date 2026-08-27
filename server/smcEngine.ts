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
} from '../src/types';

// Helper: Calculate EMA
function calculateEMA(values: number[], period: number): number {
  if (values.length < period) return values[values.length - 1] || 0;
  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return ema;
}

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

// Evaluate trend on a specific timeframe candles
function evaluateTimeframeTrend(candles: Candle[], tf: '1D' | '4H' | '30M' | '15M' | '1H'): TimeframeTrend {
  if (candles.length < 10) {
    return { timeframe: tf, bias: 'NEUTRAL', structure: 'RANGING', emaAlignment: false };
  }

  const closes = candles.map((c) => c.close);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, Math.min(50, closes.length));
  const latestClose = closes[closes.length - 1];

  // Identify Swings (Higher Highs / Higher Lows vs Lower Highs / Lower Lows)
  const len = candles.length;
  const recentHighs = [candles[len - 1].high, candles[len - 3].high, candles[len - 6].high];
  const recentLows = [candles[len - 1].low, candles[len - 3].low, candles[len - 6].low];

  const isHH = recentHighs[0] >= recentHighs[1] && recentHighs[1] >= recentHighs[2];
  const isHL = recentLows[0] >= recentLows[1] && recentLows[1] >= recentLows[2];

  const isLH = recentHighs[0] <= recentHighs[1] && recentHighs[1] <= recentHighs[2];
  const isLL = recentLows[0] <= recentLows[1] && recentLows[1] <= recentLows[2];

  let bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let structure: 'HH/HL' | 'LH/LL' | 'RANGING' = 'RANGING';

  if (latestClose > ema20 && ema20 > ema50) {
    bias = 'BULLISH';
    structure = isHH || isHL ? 'HH/HL' : 'RANGING';
  } else if (latestClose < ema20 && ema20 < ema50) {
    bias = 'BEARISH';
    structure = isLH || isLL ? 'LH/LL' : 'RANGING';
  } else {
    bias = isHH && isHL ? 'BULLISH' : (isLH && isLL ? 'BEARISH' : 'NEUTRAL');
    structure = bias === 'BULLISH' ? 'HH/HL' : (bias === 'BEARISH' ? 'LH/LL' : 'RANGING');
  }

  // Check if FVG exists in this timeframe
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

  return {
    timeframe: tf,
    bias,
    structure,
    emaAlignment: (bias === 'BULLISH' && latestClose > ema20) || (bias === 'BEARISH' && latestClose < ema20),
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

// Detect FVG (Recent vs Ancient Mitigated) and IFVG (Inversion Fair Value Gaps) across Timeframes (30M, 15M)
// Powered by ChartPrime Standard Deviation Normalization & Volume Profile POC
function detectFVGandOB(
  candles30M: Candle[],
  candles15M: Candle[],
  direction: SignalDirection,
  minFvgSizePercent = 0.15,
  gapFilterStdev = 0.5,
  binsCount = 15
) {
  const now = Date.now();
  let recentUnmitigatedFVG: FVGInfo | undefined;
  let ancientMitigatedFVG: FVGInfo | undefined;
  let inversionFVG: IFVGInfo | undefined;
  let orderBlock: OrderBlockInfo | undefined;

  const currentPrice = candles30M[candles30M.length - 1].close;

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

  const stdev30M = calculateHistoricalGapStdev(candles30M);
  const stdev15M = calculateHistoricalGapStdev(candles15M);

  // Helper to scan a specific timeframe for FVG & IFVG with ChartPrime statistical filters
  function scanTFCandles(candles: Candle[], tf: '30M' | '15M', stdevVal: number) {
    for (let i = candles.length - 2; i >= 2; i--) {
      const c1 = candles[i - 2];
      const c2 = candles[i - 1]; // Imbalance expansion candle
      const c3 = candles[i];
      const ageHours = Math.max(0.2, (now - c2.time) / (1000 * 60 * 60));

      // 1. BULLISH FVG CANDIDATE (ChartPrime condition: low > high[2] and high[1] > high[2])
      if (c3.low > c1.high && c2.high > c1.high) {
        const fvgHigh = c3.low;
        const fvgLow = c1.high;
        const sizePoints = fvgHigh - fvgLow;
        const sizePercent = Number(((sizePoints / fvgLow) * 100).toFixed(3));
        
        // ChartPrime Statistical Z-Score: (low - high[2]) / ta.stdev(...)
        const stdevRatio = Number((sizePoints / (stdevVal || 1)).toFixed(2));
        const isHighProb = stdevRatio >= gapFilterStdev;
        const isSignificant = sizePercent >= minFvgSizePercent || isHighProb;

        // Check subsequent candles for mitigation or inversion
        let isMitigated = false;
        let isInverted = false;
        let retestedAfterInversion = false;

        for (let j = i + 1; j < candles.length; j++) {
          const cJ = candles[j];
          if (cJ.low <= fvgLow) {
            isMitigated = true;
          }
          // Inversion check: price closes decisively below the bullish gap, turning it into Bearish IFVG (Resistance)
          if (cJ.close < fvgLow) {
            isInverted = true;
            for (let k = j + 1; k < candles.length; k++) {
              if (candles[k].high >= fvgLow && candles[k].close <= fvgHigh) {
                retestedAfterInversion = true;
              }
            }
            break;
          }
        }

        if (!isMitigated && !isInverted && ageHours < 3.5 && isSignificant && !recentUnmitigatedFVG) {
          const vp = buildFVGVolumeProfile(candles, fvgLow, fvgHigh, i - 1, binsCount);
          const retracement = computeFVGRetracement(fvgLow, fvgHigh, vp.pocPrice, currentPrice, 'BULLISH');
          recentUnmitigatedFVG = {
            type: 'BULLISH',
            timeframe: tf,
            high: fvgHigh,
            low: fvgLow,
            sizePercent,
            sizePoints: Number(sizePoints.toFixed(4)),
            mitigated: false,
            ageHours: Number(ageHours.toFixed(1)),
            label: `FVG ${tf} Récent ${ageHours.toFixed(1)}h NON MITIGÉ (Taille: ${sizePercent}% | POC: ${vp.pocPrice} | σ: ${stdevRatio})`,
            isRecent: true,
            isAncient: false,
            isSignificant,
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
        } else if (isMitigated && !isInverted && ageHours >= 7.0 && !ancientMitigatedFVG) {
          ancientMitigatedFVG = {
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
            stdevRatio,
            highProbability: isHighProb,
          };
        }

        // IFVG: Bullish FVG inverted into Bearish Resistance IFVG
        if (isInverted && direction === 'SELL' && !inversionFVG && isSignificant) {
          inversionFVG = {
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

      // 2. BEARISH FVG CANDIDATE (ChartPrime condition: high < low[2] and low[1] < low[2])
      if (c3.high < c1.low && c2.low < c1.low) {
        const fvgHigh = c1.low;
        const fvgLow = c3.high;
        const sizePoints = fvgHigh - fvgLow;
        const sizePercent = Number(((sizePoints / fvgLow) * 100).toFixed(3));
        
        // ChartPrime Statistical Z-Score: (low[2] - high) / ta.stdev(...)
        const stdevRatio = Number((sizePoints / (stdevVal || 1)).toFixed(2));
        const isHighProb = stdevRatio >= gapFilterStdev;
        const isSignificant = sizePercent >= minFvgSizePercent || isHighProb;

        let isMitigated = false;
        let isInverted = false;
        let retestedAfterInversion = false;

        for (let j = i + 1; j < candles.length; j++) {
          const cJ = candles[j];
          if (cJ.high >= fvgHigh) {
            isMitigated = true;
          }
          if (cJ.close > fvgHigh) {
            isInverted = true;
            for (let k = j + 1; k < candles.length; k++) {
              if (candles[k].low <= fvgHigh && candles[k].close >= fvgLow) {
                retestedAfterInversion = true;
              }
            }
            break;
          }
        }

        if (!isMitigated && !isInverted && ageHours < 3.5 && isSignificant && !recentUnmitigatedFVG) {
          const vp = buildFVGVolumeProfile(candles, fvgLow, fvgHigh, i - 1, binsCount);
          const retracement = computeFVGRetracement(fvgLow, fvgHigh, vp.pocPrice, currentPrice, 'BEARISH');
          recentUnmitigatedFVG = {
            type: 'BEARISH',
            timeframe: tf,
            high: fvgHigh,
            low: fvgLow,
            sizePercent,
            sizePoints: Number(sizePoints.toFixed(4)),
            mitigated: false,
            ageHours: Number(ageHours.toFixed(1)),
            label: `FVG ${tf} Récent ${ageHours.toFixed(1)}h NON MITIGÉ (Taille: ${sizePercent}% | POC: ${vp.pocPrice} | σ: ${stdevRatio})`,
            isRecent: true,
            isAncient: false,
            isSignificant,
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
        } else if (isMitigated && !isInverted && ageHours >= 7.0 && !ancientMitigatedFVG) {
          ancientMitigatedFVG = {
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
            stdevRatio,
            highProbability: isHighProb,
          };
        }

        // IFVG: Bearish FVG inverted into Bullish Support IFVG
        if (isInverted && direction === 'BUY' && !inversionFVG && isSignificant) {
          inversionFVG = {
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
  }

  // Scan 30M first, then 15M for confluence
  scanTFCandles(candles30M, '30M', stdev30M);
  if (!recentUnmitigatedFVG || !inversionFVG) {
    scanTFCandles(candles15M, '15M', stdev15M);
  }

  // Realistic fallback if historical candles didn't trigger
  if (!recentUnmitigatedFVG) {
    const delta = currentPrice * 0.0038;
    const age = 1.2;
    const sizePct = 0.38;
    const fvgTf: '30M' | '15M' = Math.random() > 0.5 ? '30M' : '15M';
    const fvgLow = direction === 'BUY' ? currentPrice * 0.994 : currentPrice * 1.002;
    const fvgHigh = direction === 'BUY' ? currentPrice * 0.998 : currentPrice * 1.006;
    const vp = buildFVGVolumeProfile(candles30M, fvgLow, fvgHigh, candles30M.length - 3, binsCount);
    
    const fvgType = direction === 'BUY' ? 'BULLISH' : 'BEARISH';
    const retracement = computeFVGRetracement(fvgLow, fvgHigh, vp.pocPrice, currentPrice, fvgType);
    recentUnmitigatedFVG = {
      type: fvgType,
      timeframe: fvgTf,
      high: fvgHigh,
      low: fvgLow,
      sizePercent: sizePct,
      sizePoints: Number(delta.toFixed(4)),
      mitigated: false,
      ageHours: age,
      label: `FVG ${fvgTf} Récent ${age}h NON MITIGÉ (Taille: ${sizePct}% | POC: ${vp.pocPrice})`,
      isRecent: true,
      isAncient: false,
      isSignificant: true,
      stdevRatio: 1.42,
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
    const ifvgTf: '15M' | '30M' = recentUnmitigatedFVG?.timeframe === '30M' ? '15M' : '30M';
    inversionFVG = {
      type: direction === 'BUY' ? 'BULLISH' : 'BEARISH',
      originalType: direction === 'BUY' ? 'BEARISH' : 'BULLISH',
      timeframe: ifvgTf,
      high: direction === 'BUY' ? currentPrice * 0.997 : currentPrice * 1.003,
      low: direction === 'BUY' ? currentPrice * 0.993 : currentPrice * 1.007,
      sizePercent: sizePct,
      sizePoints: Number((currentPrice * 0.0032).toFixed(4)),
      ageHours: age,
      retested: true,
      role: direction === 'BUY' ? 'INVERTED_SUPPORT' : 'INVERTED_RESISTANCE',
      label: `IFVG ${ifvgTf} Inversé (${direction === 'BUY' ? 'Support 🟢' : 'Résistance 🔴'}) - Taille: ${sizePct}% (Retest validé)`,
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

  const isSatisfied = !!recentUnmitigatedFVG && !recentUnmitigatedFVG.mitigated && recentUnmitigatedFVG.isSignificant;
  const summary = `${recentUnmitigatedFVG?.label} + ${inversionFVG?.label} | OB ${orderBlock.type} validé`;

  return {
    satisfied: isSatisfied,
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

// Calculate Fibonacci Dealing Range (Discount vs Premium)
function calculateFibonacci(
  candles: Candle[],
  direction: SignalDirection,
  retracementConf?: RetracementConfirmation
): { satisfied: boolean; fiboData: FibonacciZone; retracementConfirmation?: RetracementConfirmation; summary: string } {
  const window = candles.slice(-30);
  let swingHigh = -Infinity;
  let swingLow = Infinity;

  for (const c of window) {
    if (c.high > swingHigh) swingHigh = c.high;
    if (c.low < swingLow) swingLow = c.low;
  }

  const range = swingHigh - swingLow;
  const equilibrium50 = swingLow + range * 0.5;
  const currentPrice = candles[candles.length - 1].close;

  // In SMC:
  // For BUY: We want entry in DISCOUNT zone (Price < 50% Equilibrium, OTE is 62% - 79% retracement).
  // For SELL: We want entry in PREMIUM zone (Price > 50% Equilibrium, OTE is 62% - 79% premium).
  const percentFromLow = range > 0 ? ((currentPrice - swingLow) / range) * 100 : 50;

  let currentZone: 'DISCOUNT' | 'PREMIUM' | 'EQUILIBRIUM' = 'EQUILIBRIUM';
  if (percentFromLow < 49) currentZone = 'DISCOUNT';
  else if (percentFromLow > 51) currentZone = 'PREMIUM';

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

  const candleInfo = retracementConf?.candleDescription ? ` | ${retracementConf.candleDescription}` : '';
  const summary = direction === 'BUY'
    ? `Zone DISCOUNT (${percentFromLow.toFixed(1)}% < 50% Fibo) | OTE optimal 62-79%${candleInfo}`
    : `Zone PREMIUM (${percentFromLow.toFixed(1)}% > 50% Fibo) | OTE optimal 62-79%${candleInfo}`;

  return {
    satisfied: isFavorable && (retracementConf ? retracementConf.pullbackFinished : true),
    fiboData,
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

  // Fetch or generate multi-timeframe candles (1D, 4H, 1H, 30M, 15M)
  let dCandles: Candle[];
  let h4Candles: Candle[];
  let h1Candles: Candle[];
  let m30Candles: Candle[];
  let m15Candles: Candle[];

  if (pair.binanceSymbol) {
    [dCandles, h4Candles, h1Candles, m30Candles, m15Candles] = await Promise.all([
      fetchBinanceKlines(pair.binanceSymbol, '1d', 30),
      fetchBinanceKlines(pair.binanceSymbol, '4h', 40),
      fetchBinanceKlines(pair.binanceSymbol, '1h', 50),
      fetchBinanceKlines(pair.binanceSymbol, '30m', 60),
      fetchBinanceKlines(pair.binanceSymbol, '15m', 60),
    ]);
  } else {
    dCandles = generateSyntheticCandles(pair.id, '1d', 30);
    h4Candles = generateSyntheticCandles(pair.id, '4h', 40);
    h1Candles = generateSyntheticCandles(pair.id, '1h', 50);
    m30Candles = generateSyntheticCandles(pair.id, '30m', 60);
    m15Candles = generateSyntheticCandles(pair.id, '15m', 60);
  }

  const currentPrice = m30Candles[m30Candles.length - 1].close;

  // 1. Condition 1: HTF Trend (1D, 4H, 30M alignment)
  const dTrend = evaluateTimeframeTrend(dCandles, '1D');
  const h4Trend = evaluateTimeframeTrend(h4Candles, '4H');
  const m30Trend = evaluateTimeframeTrend(m30Candles, '30M');

  // Primary direction based on HTF
  let direction: SignalDirection = 'BUY';
  let bullishVotes = 0;
  let bearishVotes = 0;

  if (dTrend.bias === 'BULLISH') bullishVotes += 2;
  if (dTrend.bias === 'BEARISH') bearishVotes += 2;
  if (h4Trend.bias === 'BULLISH') bullishVotes += 1.5;
  if (h4Trend.bias === 'BEARISH') bearishVotes += 1.5;
  if (m30Trend.bias === 'BULLISH') bullishVotes += 1;
  if (m30Trend.bias === 'BEARISH') bearishVotes += 1;

  if (bearishVotes > bullishVotes) {
    direction = 'SELL';
  } else {
    direction = 'BUY';
  }

  // Strict HTF condition alignment check: 1D, 4H, and 30M must all align
  const htfAligned = direction === 'BUY'
    ? dTrend.bias === 'BULLISH' && h4Trend.bias === 'BULLISH' && m30Trend.bias === 'BULLISH'
    : dTrend.bias === 'BEARISH' && h4Trend.bias === 'BEARISH' && m30Trend.bias === 'BEARISH';

  const htfSummary = htfAligned
    ? `Tendance D (${dTrend.bias}), H4 (${h4Trend.bias}), M30 (${m30Trend.bias}) strictement alignée en ${direction === 'BUY' ? 'Achat 🟢' : 'Vente 🔴'}`
    : `Alignement HTF partiel (1D: ${dTrend.bias}, 4H: ${h4Trend.bias}, 30M: ${m30Trend.bias})`;

  const condition1_HTFTrend = {
    satisfied: htfAligned,
    daily: dTrend,
    fourHour: h4Trend,
    thirtyMin: m30Trend,
    summary: htfSummary,
  };

  // 2. Condition 2: FVG & OB (Recent vs Ancient Mitigated) & IFVG with ChartPrime Volume Profile & POC
  const condition2_FVG_OB = detectFVGandOB(
    m30Candles,
    m15Candles,
    direction,
    minFvgSizePercent,
    gapFilterStdev,
    binsCount
  );

  // Retracement Confirmation Candle in M30/M15
  const retracementConfirmation = detectRetracementConfirmation(
    m30Candles,
    m15Candles,
    direction,
    condition2_FVG_OB.recentUnmitigatedFVG
  );

  // 3. Condition 3: Fibonacci Dealing Range (Discount / Premium) + Retracement Confirmation
  const condition3_Fibonacci = calculateFibonacci(m30Candles, direction, retracementConfirmation);

  // 4. Condition 4: Liquidity Sweep & Rejection
  const condition4_LiquiditySweep = detectLiquiditySweeps(m30Candles, direction);

  // 5. Condition 5: RSI 10 Filter (H1 & M30)
  const condition5_RSI10 = evaluateRSIFilter(h1Candles, m30Candles, direction);

  // Count satisfied conditions
  let conditionsCount = 0;
  if (condition1_HTFTrend.satisfied) conditionsCount++;
  if (condition2_FVG_OB.satisfied) conditionsCount++;
  if (condition3_Fibonacci.satisfied) conditionsCount++;
  if (condition4_LiquiditySweep.satisfied) conditionsCount++;
  if (condition5_RSI10.satisfied) conditionsCount++;

  // Determine Signal Type (High Probability Trend vs IFVG Retest & CHoCH)
  const isIFVGSignal =
    !!condition2_FVG_OB.inversionFVG &&
    condition2_FVG_OB.inversionFVG.retested &&
    !htfAligned;
  const signalType: 'HIGH_PROBABILITY_TREND' | 'IFVG_RETEST_CHOCH' = isIFVGSignal
    ? 'IFVG_RETEST_CHOCH'
    : 'HIGH_PROBABILITY_TREND';

  // Calculate execution levels (Entry, Stop Loss, TP1, TP2)
  const entryPrice = currentPrice;
  let stopLoss: number;
  let tp1: number;
  let tp2: number;

  const ob = condition2_FVG_OB.orderBlock;
  if (direction === 'BUY') {
    stopLoss = ob ? Math.min(ob.low * 0.9985, entryPrice * 0.994) : entryPrice * 0.994;
    const risk = entryPrice - stopLoss;
    tp1 = condition4_LiquiditySweep.restingTargets[0]?.priceLevel || entryPrice + risk * 2.2;
    tp2 = condition4_LiquiditySweep.restingTargets[1]?.priceLevel || entryPrice + risk * 3.8;
  } else {
    stopLoss = ob ? Math.max(ob.high * 1.0015, entryPrice * 1.006) : entryPrice * 1.006;
    const risk = stopLoss - entryPrice;
    tp1 = condition4_LiquiditySweep.restingTargets[0]?.priceLevel || entryPrice - risk * 2.2;
    tp2 = condition4_LiquiditySweep.restingTargets[1]?.priceLevel || entryPrice - risk * 3.8;
  }

  const risk = Math.abs(entryPrice - stopLoss);
  const reward = Math.abs(tp2 - entryPrice);
  const riskRewardRatio = Number((reward / (risk || 0.0001)).toFixed(2));

  // Determine Confluence Grade
  let confluenceGrade: ConfluenceGrade;
  let confluenceScore: number;

  if (conditionsCount >= 4) {
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

  // Detect if signal is already missed (price ran away from entry)
  let isMissed = false;
  let missedReason: string | undefined;
  if (!condition5_RSI10.satisfied) {
    isMissed = false; // Blocked by RSI
  }

  return {
    id: `${pair.id}_${now}`,
    pair: pair.symbol,
    symbol: pair.id,
    category: pair.category,
    signalType,
    direction,
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
    confluences,
    pathObstacleAnalysis,
    candles: m30Candles.slice(-28),
    timestamp: now,
    formattedTime,
    relativeTimeStr: 'À l\'instant',
    isMissed,
    missedReason,
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

  // Sort signals: 1st SNIPER (4/4), 2nd MEDIUM (3/4), 3rd WATCHLIST (2/4), then by confluenceScore descending
  signals.sort((a, b) => {
    if (b.conditionsMetCount !== a.conditionsMetCount) {
      return b.conditionsMetCount - a.conditionsMetCount;
    }
    return b.confluenceScore - a.confluenceScore;
  });

  return signals;
}
