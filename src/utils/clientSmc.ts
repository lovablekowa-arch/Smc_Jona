import { MarketCategory, PairInfo, SMCSignal } from '../types';

export const CLIENT_PAIRS_CATALOG: Array<{
  id: string;
  symbol: string;
  name: string;
  category: MarketCategory;
  decimals: number;
  unit: string;
  basePrice: number;
}> = [
  { id: 'BTCUSDT', symbol: 'BTC/USDT', name: 'Bitcoin', category: 'CRYPTO', decimals: 2, unit: '$', basePrice: 94250.0 },
  { id: 'ETHUSDT', symbol: 'ETH/USDT', name: 'Ethereum', category: 'CRYPTO', decimals: 2, unit: '$', basePrice: 2840.5 },
  { id: 'SOLUSDT', symbol: 'SOL/USDT', name: 'Solana', category: 'CRYPTO', decimals: 2, unit: '$', basePrice: 198.2 },
  { id: 'BNBUSDT', symbol: 'BNB/USDT', name: 'BNB', category: 'CRYPTO', decimals: 2, unit: '$', basePrice: 654.8 },
  { id: 'EURUSD', symbol: 'EUR/USD', name: 'Euro / US Dollar', category: 'FOREX', decimals: 5, unit: '', basePrice: 1.08450 },
  { id: 'GBPUSD', symbol: 'GBP/USD', name: 'British Pound / US Dollar', category: 'FOREX', decimals: 5, unit: '', basePrice: 1.29820 },
  { id: 'USDJPY', symbol: 'USD/JPY', name: 'US Dollar / Japanese Yen', category: 'FOREX', decimals: 3, unit: '¥', basePrice: 153.420 },
  { id: 'AUDUSD', symbol: 'AUD/USD', name: 'Australian Dollar / US Dollar', category: 'FOREX', decimals: 5, unit: '', basePrice: 0.65830 },
  { id: 'USDCAD', symbol: 'USD/CAD', name: 'US Dollar / Canadian Dollar', category: 'FOREX', decimals: 5, unit: '', basePrice: 1.38740 },
  { id: 'USDCHF', symbol: 'USD/CHF', name: 'US Dollar / Swiss Franc', category: 'FOREX', decimals: 5, unit: '', basePrice: 0.88410 },
  { id: 'XAUUSD', symbol: 'XAU/USD', name: 'Or Spot (Gold)', category: 'COMMODITIES', decimals: 2, unit: '$', basePrice: 2715.40 },
  { id: 'XAGUSD', symbol: 'XAG/USD', name: 'Argent Spot (Silver)', category: 'COMMODITIES', decimals: 3, unit: '$', basePrice: 32.180 },
  { id: 'USOIL', symbol: 'USOIL', name: 'Pétrole Brut WTI', category: 'COMMODITIES', decimals: 2, unit: '$', basePrice: 71.85 },
  { id: 'V10', symbol: 'V10 Index', name: 'Volatility 10 Index', category: 'SYNTHETICS', decimals: 3, unit: 'pts', basePrice: 6842.15 },
  { id: 'V25', symbol: 'V25 Index', name: 'Volatility 25 Index', category: 'SYNTHETICS', decimals: 3, unit: 'pts', basePrice: 3120.40 },
  { id: 'V50', symbol: 'V50 Index', name: 'Volatility 50 Index', category: 'SYNTHETICS', decimals: 3, unit: 'pts', basePrice: 428.90 },
  { id: 'V75', symbol: 'V75 Index', name: 'Volatility 75 Index', category: 'SYNTHETICS', decimals: 2, unit: 'pts', basePrice: 512400.00 },
  { id: 'V100', symbol: 'V100 Index', name: 'Volatility 100 Index', category: 'SYNTHETICS', decimals: 2, unit: 'pts', basePrice: 1845.60 },
  { id: 'V10_1S', symbol: 'V10 (1s) Index', name: 'Volatility 10 (1s)', category: 'SYNTHETICS', decimals: 3, unit: 'pts', basePrice: 7920.30 },
  { id: 'V75_1S', symbol: 'V75 (1s) Index', name: 'Volatility 75 (1s)', category: 'SYNTHETICS', decimals: 2, unit: 'pts', basePrice: 893400.00 },
];

export function generateClientFallbackPairs(): PairInfo[] {
  const now = Date.now();
  return CLIENT_PAIRS_CATALOG.map((p) => {
    const delta = Math.sin(p.id.length + now / 20000) * 0.004;
    const price = p.basePrice * (1 + delta);
    return {
      id: p.id,
      symbol: p.symbol,
      name: p.name,
      category: p.category,
      price,
      change24h: Number((Math.sin(p.id.length) * 2.4).toFixed(2)),
      high24h: price * 1.015,
      low24h: price * 0.985,
      decimals: p.decimals,
      unit: p.unit,
      lastUpdated: now,
    };
  });
}

export function generateClientFallbackSignals(): SMCSignal[] {
  const now = Date.now();
  const timeStr = new Date(now).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return CLIENT_PAIRS_CATALOG.map((pair, idx) => {
    const isBuy = idx % 2 === 0;
    const direction = isBuy ? 'BUY' : 'SELL';
    const currentPrice = pair.basePrice;
    
    const entryPrice = currentPrice;
    const stopLoss = isBuy ? currentPrice * 0.994 : currentPrice * 1.006;
    const risk = Math.abs(entryPrice - stopLoss);
    const tp1 = isBuy ? entryPrice + risk * 2.2 : entryPrice - risk * 2.2;
    const tp2 = isBuy ? entryPrice + risk * 4.2 : entryPrice - risk * 4.2;
    const riskRewardRatio = 4.2;

    // Confluence conditions
    const isSniper = idx < 8;
    const isMedium = idx >= 8 && idx < 15;
    const conditionsMetCount = isSniper ? 4 : isMedium ? 3 : 2;
    const confluenceGrade = isSniper ? 'SNIPER' : isMedium ? 'MEDIUM' : 'WATCHLIST';
    const confluenceScore = isSniper ? 98 : isMedium ? 85 : 65;

    const fvgLow = isBuy ? currentPrice * 0.997 : currentPrice * 1.001;
    const fvgHigh = isBuy ? currentPrice * 0.999 : currentPrice * 1.003;
    const pocPrice = Number(((fvgLow + fvgHigh) / 2).toFixed(pair.decimals));

    const isPriceInside = idx % 3 === 0;

    return {
      id: `${pair.id}_${now}`,
      pair: pair.symbol,
      symbol: pair.id,
      category: pair.category,
      direction,
      currentPrice,
      entryPrice,
      stopLoss,
      tp1,
      tp2,
      tp3: isBuy ? tp2 * 1.005 : tp2 * 0.995,
      riskRewardRatio,
      confluenceGrade,
      confluenceScore,
      conditionsMetCount,
      timestamp: now,
      formattedTime: timeStr,
      tradeTaken: false,
      confluences: {
        condition1_HTFTrend: {
          satisfied: true,
          daily: { timeframe: '1D', bias: isBuy ? 'BULLISH' : 'BEARISH', structure: isBuy ? 'HH/HL' : 'LH/LL', emaAlignment: true },
          fourHour: { timeframe: '4H', bias: isBuy ? 'BULLISH' : 'BEARISH', structure: isBuy ? 'HH/HL' : 'LH/LL', emaAlignment: true },
          thirtyMin: { timeframe: '30M', bias: isBuy ? 'BULLISH' : 'BEARISH', structure: isBuy ? 'HH/HL' : 'LH/LL', emaAlignment: true },
          summary: `Alignement institutionnel HTF ${isBuy ? 'Haussier (Bullish Structure)' : 'Baissier (Bearish Structure)'} (1D + 4H + 30M)`,
        },
        condition2_FVG_OB: {
          satisfied: true,
          recentUnmitigatedFVG: {
            type: isBuy ? 'BULLISH' : 'BEARISH',
            timeframe: '15M',
            high: fvgHigh,
            low: fvgLow,
            sizePercent: 0.38,
            sizePoints: Number((fvgHigh - fvgLow).toFixed(4)),
            mitigated: false,
            ageHours: 1.4,
            label: `FVG 15M Récent 1.4h NON MITIGÉ (Taille: 0.38% | POC: ${pocPrice} | σ: 1.25)`,
            isRecent: true,
            isAncient: false,
            isSignificant: true,
            stdevRatio: 1.25,
            highProbability: true,
            pocPrice,
            pocVolume: 8450,
            totalVolume: 32400,
            isPriceInsideFVG: isPriceInside,
            fvgRetracementState: isPriceInside ? 'TESTING_POC' : 'APPROACHING',
            fvgFillPercentage: isPriceInside ? 65 : 0,
            distanceToFVGPercent: isPriceInside ? 0 : 0.12,
          },
          ancientMitigatedFVG: {
            type: isBuy ? 'BEARISH' : 'BULLISH',
            timeframe: '30M',
            high: currentPrice * 1.01,
            low: currentPrice * 1.008,
            sizePercent: 0.22,
            sizePoints: 12.5,
            mitigated: true,
            ageHours: 10.5,
            label: 'FVG 30M Ancien 10.5h DÉJÀ MITIGÉ (100% comblé)',
            isRecent: false,
            isAncient: true,
            isSignificant: true,
          },
          summary: 'FVG Récent 15M Non Mitigé avec POC Volume maximal détecté',
        },
        condition3_Fibonacci: {
          satisfied: true,
          fiboData: {
            swingHigh: isBuy ? currentPrice * 1.02 : currentPrice * 1.005,
            swingLow: isBuy ? currentPrice * 0.98 : currentPrice * 0.96,
            equilibrium50: currentPrice,
            oteZoneStart: isBuy ? currentPrice * 0.99 : currentPrice * 1.01,
            oteZoneEnd: isBuy ? currentPrice * 0.985 : currentPrice * 1.015,
            currentZone: isBuy ? 'DISCOUNT' : 'PREMIUM',
            discountPercentage: 68.5,
            isFavorable: true,
          },
          summary: `Prix en zone ${isBuy ? 'DISCOUNT OTE (0.705)' : 'PREMIUM OTE (0.618)'} - Entrée Institutionnelle optimale`,
        },
        condition4_LiquiditySweep: {
          satisfied: isSniper || isMedium,
          sweep: {
            type: isBuy ? 'SSL_SWEEP' : 'BSL_SWEEP',
            priceSwept: isBuy ? currentPrice * 0.995 : currentPrice * 1.005,
            timestamp: now - 3600000,
            rejectionConfirmed: true,
            description: isBuy
              ? 'Balayage Sell-Side Liquidity (SSL) sous les bas précédents avec rejet V-Shape'
              : 'Balayage Buy-Side Liquidity (BSL) au-dessus des sommets avec rejet immédiat',
          },
          restingTargets: [
            { label: isBuy ? 'BSL Interne (Sommet 15M)' : 'SSL Interne (Creux 15M)', priceLevel: tp1, targetType: isBuy ? 'BSL' : 'SSL', distancePercent: 1.2 },
            { label: isBuy ? 'Equal Highs Majeurs (4H)' : 'Equal Lows Majeurs (4H)', priceLevel: tp2, targetType: isBuy ? 'EQUAL_HIGHS' : 'EQUAL_LOWS', distancePercent: 2.8 },
          ],
          summary: `Balayage ${isBuy ? 'SSL' : 'BSL'} confirmé avec cibles de liquidités restantes TP1/TP2`,
        },
      },
    };
  });
}
