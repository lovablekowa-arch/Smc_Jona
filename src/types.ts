export type MarketCategory = 'CRYPTO' | 'FOREX' | 'COMMODITIES' | 'SYNTHETICS';

export type SignalDirection = 'BUY' | 'SELL';

export type ConfluenceGrade = 'SNIPER' | 'MEDIUM' | 'WATCHLIST';

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface RSIFilterInfo {
  rsi10_H1: number;
  rsi10_M30: number;
  isOverbought: boolean; // RSI > 70
  isOversold: boolean; // RSI < 30
  passed: boolean; // For BUY: <= 70, for SELL: >= 30
  summary: string;
}

export interface RetracementConfirmation {
  inFVGZone: boolean;
  pullbackFinished: boolean; // True when strong displacement candle re-enters trend
  strongCandleConfirmed: boolean;
  candleDescription: string;
  rejectionCandleBodySize: number; // in %
  displacementScore: number; // 0 to 100
}

export type MarketStructureType = 'HH/HL' | 'LH/LL' | 'ACCUMULATION_RANGE' | 'NEUTRAL_TRANSITION' | 'RANGING';

export interface StructureSwing {
  time: number;
  price: number;
  type: 'HIGH' | 'LOW';
  tag: 'HH' | 'HL' | 'LH' | 'LL' | 'EQH' | 'EQL';
}

export interface TimeframeTrend {
  timeframe: '1D' | '4H' | '1H' | '30M' | '15M' | '5M';
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  structure: MarketStructureType;
  isAccumulationRange?: boolean;
  structureLabel?: string; // e.g. "HH / HL (Tendance Haussière)" or "ACCUMULATION / RANGE (Compression)"
  recentSwings?: StructureSwing[];
  fvgPresent?: boolean;
  fvgType?: 'BULLISH' | 'BEARISH';
}

export interface FVGVolumeBin {
  price: number;
  volume: number;
  isPOC: boolean;
  ratio: number;
}

export interface FVGInfo {
  type: 'BULLISH' | 'BEARISH';
  timeframe: '15M' | '30M' | '1H' | '4H' | '1D';
  high: number;
  low: number;
  sizePercent: number;
  sizePoints: number;
  mitigated: boolean;
  ageHours: number;
  label: string; // e.g. "FVG 30M Récent 1.5h non mitigé (0.35%)"
  isRecent: boolean; // < 3 hours
  isAncient: boolean; // > 8 hours
  isSignificant: boolean;
  // FVG Setup Lifecycle & Filtering (MT5 Screenshot rules)
  setupStatus?: 'FRESH_UNMITIGATED' | 'TRADE_EN_COURS' | 'RETEST_DURING_TRADE' | 'TP_REACHED_EXCLUDED' | 'INVALIDATED_BREACHED';
  isTradeInProgress?: boolean;
  tpReachedAndExcluded?: boolean;
  isBreachedOrInvalidated?: boolean;
  // ChartPrime High Probability & Volume Profile properties
  stdevRatio?: number; // Ta.stdev normalization ratio (e.g. 1.85σ above historical avg)
  highProbability?: boolean; // True when stdevRatio >= filter & high volume
  pocPrice?: number; // Point of Control inside the FVG (highest volume level)
  pocVolume?: number;
  totalVolume?: number;
  volumeBins?: FVGVolumeBin[];
  // FVG Retracement & Tap-In tracking
  isPriceInsideFVG?: boolean; // True when current price is currently inside [low, high]
  fvgRetracementState?: 'INSIDE_GAP' | 'TESTING_POC' | 'APPROACHING' | 'OUTSIDE';
  fvgFillPercentage?: number; // 0 to 100% how deep price has retraced into gap
  distanceToFVGPercent?: number; // Distance in % from current price to FVG entry boundary
}

export interface IFVGInfo {
  type: 'BULLISH' | 'BEARISH'; // Current inverted bias (e.g. BULLISH if acting as support)
  originalType: 'BULLISH' | 'BEARISH';
  timeframe: '15M' | '30M' | '1H' | '4H' | '1D';
  high: number;
  low: number;
  sizePercent: number;
  sizePoints: number;
  ageHours: number;
  retested: boolean;
  role: 'INVERTED_SUPPORT' | 'INVERTED_RESISTANCE';
  label: string; // e.g. "IFVG 15M Inversé (Support - 0.42%)"
}

export interface OrderBlockInfo {
  type: 'BULLISH' | 'BEARISH';
  high: number;
  low: number;
  timeframe: string;
  volumeConfirmed: boolean;
}

export interface FibonacciZone {
  swingHigh: number;
  swingLow: number;
  equilibrium50: number;
  oteZoneStart: number; // 62%
  oteZoneEnd: number; // 79%
  currentZone: 'DISCOUNT' | 'PREMIUM' | 'EQUILIBRIUM';
  discountPercentage: number;
  isFavorable: boolean; // Discount for BUY, Premium for SELL
}

export interface LiquiditySweep {
  type: 'BSL_SWEEP' | 'SSL_SWEEP'; // Buy-Side Liquidity or Sell-Side Liquidity
  priceSwept: number;
  rejectionConfirmed: boolean;
  timestamp: number;
  description: string;
}

export interface RestingLiquidity {
  targetType: 'BSL' | 'SSL' | 'EQUAL_HIGHS' | 'EQUAL_LOWS';
  priceLevel: number;
  label: string; // e.g. "BSL Non Balayé (Cible TP1)"
  distancePercent: number;
}

export type TrendAlignmentStatus =
  | 'BULLISH_ALIGNED'
  | 'BEARISH_ALIGNED'
  | 'BULLISH_D1_H4_M30_RETRACEMENT'
  | 'BEARISH_D1_H4_M30_RETRACEMENT'
  | 'H4_DIRECTOR_D1_COUNTER'
  | 'CONFLICT_TRANSITION'
  | 'ACCUMULATION_RANGE_BLOCKED';

export interface SMCConfluenceDetails {
  // Condition 1: HTF Alignment (1D, 4H, 30M) - Pure Price Structure (HH/HL, LH/LL, ACCUMULATION/RANGE)
  condition1_HTFTrend: {
    satisfied: boolean;
    alignmentStatus: TrendAlignmentStatus;
    isH4DirectorException?: boolean;
    isAccumulationBlocked?: boolean;
    daily: TimeframeTrend;
    fourHour: TimeframeTrend;
    thirtyMin: TimeframeTrend;
    fifteenMin?: TimeframeTrend;
    fiveMin?: TimeframeTrend;
    m15M5RetracementInfo?: string;
    summary: string;
  };
  // Condition 2: FVG Suite H1, M30 & M15 (Filtrage de fraîcheur, alignement Multi-TF, réaction & statut Trade En Cours)
  condition2_FVG_OB: {
    satisfied: boolean;
    // Suite & Hiérarchie des Timeframes (H1/M30 Contexte majeur + M15 Confirmation Entrée)
    fvgH1?: FVGInfo; // FVG H1 (Setup & Contexte principal - Poids fort)
    fvgM30?: FVGInfo; // FVG M30 (Structure intermédiaire - Poids fort)
    fvgM15?: FVGInfo; // FVG M15 (Zone de précision d'entrée / POC)
    fvgSequenceM30M15Confirmed: boolean;
    isConfluentH1_M15?: boolean; // Alignement H1/M30 + M15
    entryConfirmationTimeframe: '15M' | '30M' | '1H';
    entryTapInStatus?: 'CONFIRMED_INSIDE' | 'TESTING_POC' | 'APPROACHING' | 'REJECTING_POC';

    // Cycle de vie du Trade & Règles d'exclusion MT5
    setupStatus?: 'FRESH_UNMITIGATED' | 'TRADE_EN_COURS' | 'RETEST_DURING_TRADE' | 'TP_REACHED_EXCLUDED' | 'INVALIDATED_BREACHED';
    targetRecentSwingTp1?: number; // Sommet/Creux récent servant de premier objectif TP
    originSwingSl?: number; // Origine de l'impulsion servant de SL

    // Confluences Macro Informatives (H4 et Daily)
    macroFvgH4?: FVGInfo;
    macroFvgDaily?: FVGInfo;
    macroFvgInformativeSummary?: string;

    // Backward-compatible fields
    recentUnmitigatedFVG?: FVGInfo;
    ancientMitigatedFVG?: FVGInfo;
    inversionFVG?: IFVGInfo;
    orderBlock?: OrderBlockInfo;
    minFvgThresholdPercent?: number;
    summary: string;
  };
  // Condition 3: Fibonacci Discount / Premium & Retracement Confirmation Candle & Internal Liquidity
  condition3_Fibonacci: {
    satisfied: boolean;
    fiboData: FibonacciZone;
    dealZoneType?: 'DISCOUNT' | 'PREMIUM';
    internalLiquiditySwept?: boolean;
    internalLiquidityDescription?: string;
    fiboRetracement50Level?: number;
    fiboRetracement618Level?: number;
    retracementConfirmation?: RetracementConfirmation;
    summary: string;
  };
  // Condition 4: Liquidity Sweep & Rejection
  condition4_LiquiditySweep: {
    satisfied: boolean;
    sweep?: LiquiditySweep;
    restingTargets: RestingLiquidity[];
    summary: string;
  };
  // Condition 5: RSI 10 Filter (H1 & M30)
  condition5_RSI10: {
    satisfied: boolean;
    rsiInfo: RSIFilterInfo;
    summary: string;
  };
}

export interface PathObstacle {
  type: 'BEARISH_FVG' | 'BULLISH_FVG' | 'BEARISH_OB' | 'BULLISH_OB' | 'VOLUME_POC' | 'RESISTANCE_WEAK_HIGH' | 'SUPPORT_WEAK_LOW';
  priceLevel: number;
  timeframe: string;
  label: string; // e.g. "Ancien FVG Baissier 30M" or "Order Block Vendeur H4"
  volumePOC?: number;
  volumeAmount?: string; // e.g. "4.594K"
  distancePercent: number; // % distance from entry
  blocksTarget: 'BEFORE_TP1' | 'BETWEEN_TP1_AND_TP2' | 'BEFORE_TP2';
  impactDescription: string; // e.g. "Zone de rejet et de blocage vendeur. Sécurisation ou TP anticipé recommandé."
}

export interface PathObstacleAnalysis {
  status: 'CLEAR_PATH' | 'OBSTACLE_DETECTED';
  hasObstacle: boolean;
  obstacles: PathObstacle[];
  primaryObstacle?: PathObstacle;
  clearanceScore: number; // 100 = Voie 100% libre, 40 = Obstacle majeur bloquant
  recommendedAction: 'TAKE_FULL_TP' | 'TAKE_EARLY_TP' | 'TIGHTEN_STOP_AT_OBSTACLE' | 'CLEAR_ROADMAP';
  recommendedExitPrice?: number; // Level where trader should secure profits / exit before obstacle
  roadmapSummary: string; // e.g. "⚠️ Obstacle à 1.3882 (Ancien FVG Baissier) : TP partiel conseillé à ce niveau avant TP2" OR "🟢 Chemin Ouvert : Voie 100% libre vers TP1 et TP2 (aucun FVG opposé bloquant)"
}

export interface SMCSignal {
  id: string;
  pair: string;
  symbol: string;
  category: MarketCategory;
  signalType: 'HIGH_PROBABILITY_TREND' | 'IFVG_RETEST_CHOCH';
  direction: SignalDirection;
  setupProgressStatus?: 'NOUVEAU_SIGNAL' | 'TRADE_EN_COURS' | 'RETEST_FVG' | 'TP1_ATTEINT_EXCLU' | 'INVALIDÉ_COMBLEMENT';
  internalLiquiditySwept?: boolean;
  isMultiTfConfluent?: boolean; // H1 + M15 / M30 + M15 aligned
  currentPrice: number;
  entryPrice: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  tp3?: number;
  riskRewardRatio: number;
  confluenceGrade: ConfluenceGrade;
  confluenceScore: number; // e.g. 100 for 4/4, 85 for 3/4, 65 for 2/4
  conditionsMetCount: number; // 2, 3, 4, or 5
  trendAlignmentStatus?: TrendAlignmentStatus;
  isH4DirectorException?: boolean;
  cascadeStatus?: 'CASCADE_ALL_PASSED' | 'STOPPED_CONDITION_1_STRUCTURE' | 'STOPPED_CONDITION_2_FVG' | 'STOPPED_CONDITION_3_FIBO' | 'STOPPED_CONDITION_4_SWEEP';
  confluences: SMCConfluenceDetails;
  pathObstacleAnalysis?: PathObstacleAnalysis;
  candles?: Candle[];
  timestamp: number;
  formattedTime: string;
  relativeTimeStr?: string; // e.g. "Il y a 6 min"
  isMissed?: boolean; // True if price has moved significantly away from entry towards TP or beyond SL
  missedReason?: string; // e.g. "Le prix a déjà couru 70% vers TP1 sans nous"
  isArchived?: boolean; // Manually or auto-archived
  archivedAt?: number;
  tradeTaken: boolean;
  tradeTakenAt?: number;
  mutedUntil?: number;
}

export interface PairInfo {
  id: string;
  symbol: string;
  name: string;
  category: MarketCategory;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  decimals: number;
  unit: string;
  lastUpdated: number;
}

export interface TelegramSettings {
  botToken: string;
  chatId: string;
  enabled: boolean;
  alertLevels: ConfluenceGrade[]; // e.g. ['SNIPER', 'MEDIUM', 'WATCHLIST']
  activeCategories: MarketCategory[];
  activePairs: string[]; // List of pair symbols or empty for all active categories
  targetTimeframes: string[]; // ['15M', '30M', '1H', '4H', '1D']
  minFvgSizePercent: number; // e.g. 0.15% min size threshold to be significant
  fvgGapFilterStdev: number; // e.g. 0.5σ (ChartPrime ta.stdev filter for high-probability gaps)
  fvgVolumeProfileBins: number; // e.g. 15 bins for intra-gap Volume Profile & POC
  notifyOnFVGTap: boolean; // Alert when price retraces and enters the FVG entry zone
  showIFVG: boolean; // Enable Inversion FVG detection and alerts
  fvgTimeframes: string[]; // e.g. ['15M', '30M']
  antiDuplicateHours: number; // Default 6 hours
  scanIntervalMinutes: number; // Default 10 minutes
  soundEnabled: boolean;
  lastScanTimestamp: number;
  mutedPairs: Record<string, number>; // pair -> un-mute timestamp
}

export interface AlertHistoryItem {
  id: string;
  timestamp: number;
  signalId: string;
  pair: string;
  category: MarketCategory;
  direction: SignalDirection;
  confluenceGrade: ConfluenceGrade;
  confluenceScore: number;
  entryPrice: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  riskRewardRatio: number;
  currentPrice?: number;
  tradeTakenAt?: number;
  tradeClosedAt?: number;
  outcome?: 'IN_PROGRESS' | 'WIN_TP1' | 'WIN_TP2' | 'LOSS_SL' | 'CLOSED_MANUAL';
  pnlPercent?: number;
  realizedRR?: number;
  highestReached?: number;
  lowestReached?: number;
  telegramSent: boolean;
  telegramError?: string;
  status: 'DELIVERED' | 'MUTED' | 'TRADE_TAKEN' | 'LOCAL_ONLY' | 'FAILED';
  alertType?: 'SIGNAL_CREATED' | 'FVG_TAP_IN';
  detailsSummary: string;
}
