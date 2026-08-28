import { MarketCategory, PairInfo } from '../src/types';

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const PAIRS_CATALOG: Array<{
  id: string;
  symbol: string;
  name: string;
  category: MarketCategory;
  decimals: number;
  unit: string;
  binanceSymbol?: string;
  basePrice: number;
}> = [
  // 1. INDICES SYNTHÉTIQUES DERIV VOLATILITY (PRIORITÉ ABSOLUE N°1)
  { id: 'V75', symbol: 'Volatility 75', name: 'Volatility 75 Index (V75)', category: 'SYNTHETICS', decimals: 2, unit: 'pts', basePrice: 485600.00 },
  { id: 'V75_1S', symbol: 'Volatility 75 (1s)', name: 'Volatility 75 (1s) Index', category: 'SYNTHETICS', decimals: 2, unit: 'pts', basePrice: 893400.00 },
  { id: 'V100', symbol: 'Volatility 100', name: 'Volatility 100 Index (V100)', category: 'SYNTHETICS', decimals: 2, unit: 'pts', basePrice: 2140.50 },
  { id: 'V100_1S', symbol: 'Volatility 100 (1s)', name: 'Volatility 100 (1s) Index', category: 'SYNTHETICS', decimals: 2, unit: 'pts', basePrice: 21450.00 },
  { id: 'V50', symbol: 'Volatility 50', name: 'Volatility 50 Index (V50)', category: 'SYNTHETICS', decimals: 3, unit: 'pts', basePrice: 388.40 },
  { id: 'V50_1S', symbol: 'Volatility 50 (1s)', name: 'Volatility 50 (1s) Index', category: 'SYNTHETICS', decimals: 3, unit: 'pts', basePrice: 785.60 },
  { id: 'V25', symbol: 'Volatility 25', name: 'Volatility 25 Index (V25)', category: 'SYNTHETICS', decimals: 3, unit: 'pts', basePrice: 2940.30 },
  { id: 'V25_1S', symbol: 'Volatility 25 (1s)', name: 'Volatility 25 (1s) Index', category: 'SYNTHETICS', decimals: 3, unit: 'pts', basePrice: 9840.20 },
  { id: 'V10', symbol: 'Volatility 10', name: 'Volatility 10 Index (V10)', category: 'SYNTHETICS', decimals: 3, unit: 'pts', basePrice: 6842.15 },
  { id: 'V10_1S', symbol: 'Volatility 10 (1s)', name: 'Volatility 10 (1s) Index', category: 'SYNTHETICS', decimals: 3, unit: 'pts', basePrice: 7920.30 },
  { id: 'CRASH1000', symbol: 'Crash 1000', name: 'Crash 1000 Index', category: 'SYNTHETICS', decimals: 2, unit: 'pts', basePrice: 5620.80 },
  { id: 'BOOM1000', symbol: 'Boom 1000', name: 'Boom 1000 Index', category: 'SYNTHETICS', decimals: 2, unit: 'pts', basePrice: 13420.50 },
  { id: 'STEP', symbol: 'Step Index', name: 'Step Index', category: 'SYNTHETICS', decimals: 2, unit: 'pts', basePrice: 8650.20 },
  { id: 'JUMP75', symbol: 'Jump 75', name: 'Jump 75 Index', category: 'SYNTHETICS', decimals: 2, unit: 'pts', basePrice: 365200.00 },

  // 2. CRYPTO-MONNAIES (PRIORITÉ N°2 - FLUX DIRECT BINANCE)
  { id: 'BTCUSDT', symbol: 'BTC/USDT', name: 'Bitcoin', category: 'CRYPTO', decimals: 2, unit: '$', binanceSymbol: 'BTCUSDT', basePrice: 94250.0 },
  { id: 'ETHUSDT', symbol: 'ETH/USDT', name: 'Ethereum', category: 'CRYPTO', decimals: 2, unit: '$', binanceSymbol: 'ETHUSDT', basePrice: 2840.5 },
  { id: 'SOLUSDT', symbol: 'SOL/USDT', name: 'Solana', category: 'CRYPTO', decimals: 2, unit: '$', binanceSymbol: 'SOLUSDT', basePrice: 198.2 },
  { id: 'BNBUSDT', symbol: 'BNB/USDT', name: 'BNB (Binance Coin)', category: 'CRYPTO', decimals: 2, unit: '$', binanceSymbol: 'BNBUSDT', basePrice: 654.8 },
  { id: 'XRPUSDT', symbol: 'XRP/USDT', name: 'Ripple XRP', category: 'CRYPTO', decimals: 4, unit: '$', binanceSymbol: 'XRPUSDT', basePrice: 2.4500 },

  // 3. MATIÈRES PREMIÈRES & FOREX INSTITUTIONNEL (PRIORITÉ N°3)
  { id: 'XAUUSD', symbol: 'XAU/USD', name: 'Or Spot (Gold)', category: 'COMMODITIES', decimals: 2, unit: '$', basePrice: 2715.40 },
  { id: 'EURUSD', symbol: 'EUR/USD', name: 'Euro / US Dollar', category: 'FOREX', decimals: 5, unit: '', basePrice: 1.08450 },
  { id: 'GBPUSD', symbol: 'GBP/USD', name: 'British Pound / US Dollar', category: 'FOREX', decimals: 5, unit: '', basePrice: 1.29820 },
  { id: 'USDJPY', symbol: 'USD/JPY', name: 'US Dollar / Japanese Yen', category: 'FOREX', decimals: 3, unit: '¥', basePrice: 153.420 },
  { id: 'GBPJPY', symbol: 'GBP/JPY', name: 'British Pound / Japanese Yen', category: 'FOREX', decimals: 3, unit: '¥', basePrice: 199.250 },
  { id: 'AUDUSD', symbol: 'AUD/USD', name: 'Australian Dollar / US Dollar', category: 'FOREX', decimals: 5, unit: '', basePrice: 0.65830 },
  { id: 'USDCAD', symbol: 'USD/CAD', name: 'US Dollar / Canadian Dollar', category: 'FOREX', decimals: 5, unit: '', basePrice: 1.38740 },
  { id: 'USDCHF', symbol: 'USD/CHF', name: 'US Dollar / Swiss Franc', category: 'FOREX', decimals: 5, unit: '', basePrice: 0.88410 },
  { id: 'XAGUSD', symbol: 'XAG/USD', name: 'Argent Spot (Silver)', category: 'COMMODITIES', decimals: 3, unit: '$', basePrice: 32.180 },
  { id: 'USOIL', symbol: 'USOIL', name: 'Pétrole Brut WTI', category: 'COMMODITIES', decimals: 2, unit: '$', basePrice: 71.85 },
];

const livePricesCache = new Map<string, PairInfo>();
const candleCache = new Map<string, Record<string, Candle[]>>();

// Fetch real crypto prices from Binance with fast timeout and fallback
async function fetchBinancePrices(): Promise<Record<string, { price: number; change24h: number; high: number; low: number }>> {
  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/24hr', { signal: AbortSignal.timeout(2500) });
    if (!res.ok) throw new Error('Binance HTTP ' + res.status);
    const data = await res.json() as Array<{ symbol: string; lastPrice: string; priceChangePercent: string; highPrice: string; lowPrice: string }>;
    
    const result: Record<string, { price: number; change24h: number; high: number; low: number }> = {};
    for (const item of data) {
      if (['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'].includes(item.symbol)) {
        result[item.symbol] = {
          price: parseFloat(item.lastPrice),
          change24h: parseFloat(item.priceChangePercent),
          high: parseFloat(item.highPrice),
          low: parseFloat(item.lowPrice),
        };
      }
    }
    return result;
  } catch {
    // Immediate safe fallback if network is blocked, rate limited, or on serverless
    return {};
  }
}

// Fetch real Binance klines with fast timeout & instant synthetic fallback
export async function fetchBinanceKlines(symbol: string, interval: '1d' | '4h' | '30m' | '15m' | '1h', limit = 60): Promise<Candle[]> {
  try {
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) throw new Error('Binance Klines HTTP ' + res.status);
    const data = await res.json() as any[];
    return data.map((d: any) => ({
      time: d[0],
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5]),
    }));
  } catch {
    return generateSyntheticCandles(symbol, interval, limit);
  }
}

// Deterministic & realistic market series generator for Forex / Commodities / Deriv Synthetics / Offline fallback
export function generateSyntheticCandles(pairId: string, timeframe: string, count = 60): Candle[] {
  const pair = PAIRS_CATALOG.find((p) => p.id === pairId) || PAIRS_CATALOG[0];
  const now = Date.now();
  let intervalMs = 15 * 60 * 1000;
  if (timeframe === '30m' || timeframe === '30M') intervalMs = 30 * 60 * 1000;
  if (timeframe === '1h' || timeframe === '1H') intervalMs = 60 * 60 * 1000;
  if (timeframe === '4h' || timeframe === '4H') intervalMs = 4 * 60 * 60 * 1000;
  if (timeframe === '1d' || timeframe === '1D') intervalMs = 24 * 60 * 60 * 1000;

  const candles: Candle[] = [];
  let currentPrice = pair.basePrice;

  // Volatility calibration based on asset type
  let vol = 0.003;
  if (pair.category === 'CRYPTO') vol = 0.012;
  if (pair.category === 'COMMODITIES') vol = 0.006;
  if (pair.category === 'SYNTHETICS') {
    if (pair.id.includes('100')) vol = 0.025;
    else if (pair.id.includes('75')) vol = 0.020;
    else if (pair.id.includes('50')) vol = 0.015;
    else vol = 0.008;
  }

  // Seed with pair hash for reproducible yet organic SMC price structures
  const hash = pairId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  let seed = hash * 9301 + 49297;
  function random() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  // Construct realistic market structure (Swings, Sweeps, Gaps)
  for (let i = count; i >= 0; i--) {
    const candleTime = now - i * intervalMs;
    const wave = Math.sin((candleTime / (intervalMs * 14)) + hash) * 0.018;
    const microTrend = Math.cos((candleTime / (intervalMs * 40))) * 0.035;
    const shock = (random() - 0.485) * vol;
    
    const delta = (wave * 0.2 + microTrend * 0.3 + shock) * currentPrice;
    const open = currentPrice;
    const close = open + delta;
    const high = Math.max(open, close) + Math.abs(delta) * (0.2 + random() * 0.7);
    const low = Math.min(open, close) - Math.abs(delta) * (0.2 + random() * 0.7);
    const volume = 1000 * (1 + random() * 4);

    candles.push({
      time: candleTime,
      open,
      high,
      low,
      close,
      volume,
    });

    currentPrice = close;
  }

  return candles;
}

// Update and get all live pairs with recent prices
export async function getAllLivePairs(): Promise<PairInfo[]> {
  const binanceData = await fetchBinancePrices();
  const now = Date.now();

  const pairs: PairInfo[] = PAIRS_CATALOG.map((p) => {
    let price = p.basePrice;
    let change24h = 0;
    let high24h = p.basePrice * 1.015;
    let low24h = p.basePrice * 0.985;

    if (p.binanceSymbol && binanceData[p.binanceSymbol]) {
      const b = binanceData[p.binanceSymbol];
      price = b.price;
      change24h = b.change24h;
      high24h = b.high;
      low24h = b.low;
    } else {
      // Dynamic live micro-oscillation for Forex / Commodities / Synthetics
      const cached = livePricesCache.get(p.id);
      const deltaPercent = (Math.sin(now / 15000 + p.id.length) * 0.002) + ((now % 7000) / 7000 - 0.5) * 0.0008;
      price = cached ? cached.price * (1 + deltaPercent * 0.1) : p.basePrice * (1 + deltaPercent);
      change24h = cached ? cached.change24h : (Math.sin(p.id.length) * 1.8);
      high24h = price * 1.012;
      low24h = price * 0.988;
    }

    const info: PairInfo = {
      id: p.id,
      symbol: p.symbol,
      name: p.name,
      category: p.category,
      price,
      change24h,
      high24h,
      low24h,
      decimals: p.decimals,
      unit: p.unit,
      lastUpdated: now,
    };

    livePricesCache.set(p.id, info);
    return info;
  });

  return pairs;
}
