"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import {
    ArrowDownRight,
    ArrowUpRight,
    BarChart3,
    BrainCircuit,
    Check,
    Coffee,
    Info,
    LineChart,
    Loader2,
    Newspaper,
    Plus,
    RefreshCcw,
    Search,
    Sparkles,
    Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useGolem } from "@/components/GolemContext";
import { useI18n } from "@/components/I18nProvider";
import { useToast } from "@/components/ui/toast-provider";
import { apiUrl } from "@/lib/api";
import { apiGet, apiPost } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
    DASHBOARD_FEATURE_FLAGS_UPDATED_EVENT,
    SIDEBAR_NAV_HIDDEN_UPDATED_EVENT,
    STOCKS_FEATURE_ENABLED_STORAGE_KEY,
    isDashboardRouteHidden,
    readFeatureEnabled
} from "@/lib/dashboard-feature-flags";

type Market = "tw" | "us";
type MarketFilter = Market | "all";
type RangeKey = "1D" | "1M" | "3M" | "6M" | "1Y";

type StockQuote = {
    symbol: string;
    yahooSymbol: string;
    name: string;
    market: Market;
    currency: string;
    exchangeName?: string;
    exchangeTimezoneName?: string;
    price: number;
    previousClose: number;
    open: number | null;
    dayHigh: number | null;
    dayLow: number | null;
    fiftyTwoWeekHigh: number | null;
    fiftyTwoWeekLow: number | null;
    change: number;
    changePercent: number;
    volume: number;
    turnover: number;
    marketCap: number | null;
    trailingPE?: number | null;
    forwardPE?: number | null;
    priceToBook?: number | null;
    beta?: number | null;
    dividendYield?: number | null;
    dividendRate?: number | null;
    payoutRatio?: number | null;
    epsTrailingTwelveMonths?: number | null;
    epsForward?: number | null;
    recommendationKey?: string | null;
    targetMeanPrice?: number | null;
    numberOfAnalystOpinions?: number | null;
    sharesOutstanding?: number | null;
    sector: string;
    dataSource: string;
    lastUpdatedAt: string;
    dataQuality?: "live" | "stale-cache";
};

type HistoryPoint = {
    time: string;
    price: number;
    close: number;
    open: number | null;
    high: number | null;
    low: number | null;
    volume: number;
};

type StockIndicators = {
    sma5: number | null;
    sma20: number | null;
    rsi14: number | null;
    macd: number | null;
    macdSignal: number | null;
    macdHistogram: number | null;
    stochasticK: number | null;
    stochasticD: number | null;
    volatility: number | null;
    maxDrawdown: number | null;
    avgVolume20: number | null;
    volumeRatio: number | null;
    distanceToSma20Percent: number | null;
};

type SearchResult = {
    symbol: string;
    yahooSymbol: string;
    name: string;
    market: Market;
    exchange: string;
    type: string;
    sector?: string;
    dataSource: string;
};

type QuotesResponse = {
    quotes?: StockQuote[];
    errors?: Array<{ symbol: string; error: string }>;
    dataSource?: string;
    generatedAt?: string;
};

type HistoryResponse = {
    history?: {
        symbol: string;
        yahooSymbol: string;
        points: HistoryPoint[];
        indicators: StockIndicators;
        dataQuality?: "live" | "stale-cache";
    };
    dataSource?: string;
    generatedAt?: string;
};

type SearchResponse = {
    results?: SearchResult[];
};

type StockNewsItem = {
    title: string;
    url: string;
    snippet: string;
    source: string;
    publishedAt?: string;
};

type StockNews = {
    symbol: string;
    yahooSymbol: string;
    name: string;
    query: string;
    languagePriority: string;
    dateWindow: {
        since: string;
        until: string;
        days: number;
    };
    source: string;
    fetchedAt: string;
    results: StockNewsItem[];
};

type NewsResponse = {
    news?: StockNews;
};

type SnapshotRefreshResponse = {
    snapshot?: StockDashboardSnapshot;
};
type MostActiveItem = {
    symbol: string;
    yahooSymbol: string;
    name: string;
    volume: number;
    price: number | null;
    change: number | null;
    changePercent: number | null;
    previousClose: number | null;
    market: "tw" | "us";
    currency: string;
    source: string;
};
type MostActiveResponse = {
    success?: boolean;
    market?: "tw" | "us";
    items?: MostActiveItem[];
    generatedAt?: string;
};

type StockDashboardSnapshot = {
    source: string;
    dataStatus: string;
    marketFilter: MarketFilter;
    selectedRange: RangeKey;
    selected: StockQuote | null;
    indicators: StockIndicators | null;
    news: StockNews | null;
    watchlist: StockQuote[];
    breadth: {
        advancers: number;
        decliners: number;
        averageMove: number;
        totalTurnover: number;
        count: number;
    };
    quoteErrors: Array<{ symbol: string; error: string }>;
    generatedAt: string;
    savedAt?: string;
    refresh?: {
        trigger: string;
        status: string;
        previousSavedAt: string | null;
    };
};
type StockAnalysisMethodKey = "balanced" | "trend_following" | "mean_reversion" | "risk_control";
type AnalysisScope = "selected" | "watchlist";

const WATCHLIST_STORAGE_KEY = "golem-stock-watchlist-v1";
const SUPPORT_PROMPT_STORAGE_KEY = "golem-stock-support-prompt-snoozed-at-v1";
const DEFAULT_WATCHLIST = ["2330.TW", "0050.TW", "2454.TW", "AAPL", "NVDA", "TSM"];
const AUTO_REFRESH_MS = 60 * 1000;
const SUPPORT_PROMPT_INTERVAL_MS = 150 * 60 * 1000;
const SUPPORT_PROMPT_INITIAL_DELAY_MS = 45 * 1000;
const SUPPORT_URL = "https://buymeacoffee.com/arvincreator/e/534156";
const STOCKS_DASHBOARD_HREF = "/dashboard/stocks";
const SUPPORT_COPY_VARIANTS = [
    {
        zhTitle: "還在努力盯盤嗎？",
        zhBody: "記得喝杯咖啡提神，順便也給作者帶上一杯喔！",
        zhAction: "請作者喝咖啡",
        enTitle: "Still watching the tape?",
        enBody: "Grab a coffee to stay sharp, and maybe bring one for the author too.",
        enAction: "Buy a coffee",
    },
    {
        zhTitle: "作者的佛心打動不了你的慈悲嗎？",
        zhBody: "這個看板都努力幫你盯行情了，添點油香給作者，讓功能繼續長大。",
        zhAction: "添點油香",
        enTitle: "Did the author's generosity miss your soft spot?",
        enBody: "This board is keeping watch with you. A tiny tip keeps the features growing.",
        enAction: "Send a tip",
    },
    {
        zhTitle: "這裡有一位需要咖啡的開發者",
        zhBody: "作者不眠不休打磨這個程式，5 美金剛好能補一杯星巴克能量。",
        zhAction: "補一杯星巴克",
        enTitle: "Developer fuel is running low",
        enBody: "A few dollars can turn into one very useful cup of coffee and a few more fixes.",
        enAction: "Fuel development",
    },
    {
        zhTitle: "K 線會震盪，作者也會餓",
        zhBody: "如果這頁幫你少看錯一根線，請用一杯咖啡讓作者回血。",
        zhAction: "幫作者回血",
        enTitle: "Candles move. Developers fade.",
        enBody: "If this page saved you from one bad read, coffee is a noble exchange.",
        enAction: "Restore HP",
    },
    {
        zhTitle: "今天的行情很刺激嗎？",
        zhBody: "你的心跳交給市場，作者的咖啡因交給你。小額贊助一下，彼此都穩。",
        zhAction: "穩住作者",
        enTitle: "Markets feeling spicy today?",
        enBody: "Let the market handle your pulse. Let your coffee support handle the author.",
        enAction: "Keep it steady",
    },
    {
        zhTitle: "這個按鈕不是廣告，是補給站",
        zhBody: "一點點支持，就能讓作者繼續修 bug、加功能、跟 Yahoo API 交涉人生。",
        zhAction: "送補給",
        enTitle: "This button is a supply station",
        enBody: "A little support helps with bugs, features, and the long conversation with market APIs.",
        enAction: "Send supplies",
    },
    {
        zhTitle: "你負責看盤，我負責提醒",
        zhBody: "作者負責把工具變好。這個分工很美，只差一杯咖啡收尾。",
        zhAction: "完成分工",
        enTitle: "You watch. I remind.",
        enBody: "The author keeps improving the tool. A coffee would complete the workflow.",
        enAction: "Complete the loop",
    },
    {
        zhTitle: "如果這頁有讓你嘴角上揚",
        zhBody: "那就讓作者的咖啡杯也上揚一下。小額贊助，快樂互相流動。",
        zhAction: "讓咖啡杯上揚",
        enTitle: "If this page made you smile",
        enBody: "Let the author's coffee cup rise too. Tiny support, good vibes.",
        enAction: "Raise the cup",
    },
];
const TAIWAN_SYMBOL_RE = /^\d{4,6}[A-Z]{0,3}$/;
const TAIWAN_YAHOO_SYMBOL_RE = /^\d{4,6}[A-Z]{0,3}\.(TW|TWO)$/;
const SYMBOL_ALIASES: Record<string, string> = {
    TPEX: "^TWOII",
    OTC: "^TWOII",
    TAIEX: "^TWII",
    TWSE: "^TWII",
};
const RANGE_MAP: Record<RangeKey, { range: string; interval: string }> = {
    "1D": { range: "1d", interval: "5m" },
    "1M": { range: "1mo", interval: "1d" },
    "3M": { range: "3mo", interval: "1d" },
    "6M": { range: "6mo", interval: "1d" },
    "1Y": { range: "1y", interval: "1d" },
};
const STOCK_ANALYSIS_METHODS: Array<{
    key: StockAnalysisMethodKey;
    labelZh: string;
    labelEn: string;
    explainZh: string;
    explainEn: string;
    promptZh: string;
    promptEn: string;
}> = [
    {
        key: "balanced",
        labelZh: "平衡評估",
        labelEn: "Balanced",
        explainZh: "綜合趨勢、動能、量能與新聞，給出保守且可執行的建議。",
        explainEn: "Combines trend, momentum, volume, and news for a conservative actionable plan.",
        promptZh: "請做平衡型分析：先判斷趨勢，再看動能與量能，最後給出三種情境（偏多/中性/偏空）與對應行動。",
        promptEn: "Run a balanced analysis: trend first, then momentum/volume, then provide bullish/neutral/bearish scenarios with actions.",
    },
    {
        key: "trend_following",
        labelZh: "趨勢追蹤",
        labelEn: "Trend Following",
        explainZh: "以趨勢延續為主，重視均線結構、突破與回踩。",
        explainEn: "Focuses on continuation setups, MA structure, breakouts, and pullbacks.",
        promptZh: "請以趨勢追蹤角度分析：確認多空方向、關鍵突破位/失效位，給出順勢入場與出場條件。",
        promptEn: "Analyze with trend-following logic: direction, breakout/invalidation levels, and trend-continuation entry/exit criteria.",
    },
    {
        key: "mean_reversion",
        labelZh: "均值回歸",
        labelEn: "Mean Reversion",
        explainZh: "以超漲超跌回歸為主，重視 RSI、偏離均線與波動收斂。",
        explainEn: "Targets overextension pullbacks using RSI, MA deviation, and volatility compression.",
        promptZh: "請以均值回歸角度分析：判斷是否超漲/超跌，提出分批進出與失效條件。",
        promptEn: "Analyze for mean reversion: detect overbought/oversold states, then propose scaled entries/exits and invalidation.",
    },
    {
        key: "risk_control",
        labelZh: "風險控管",
        labelEn: "Risk Control",
        explainZh: "以資金保全優先，重點是倉位、停損與風險報酬比。",
        explainEn: "Capital preservation first, emphasizing sizing, stop-loss, and risk/reward.",
        promptZh: "請以風險控管為主：給出建議倉位%、停損區間、停利區間，並說明不進場的條件。",
        promptEn: "Prioritize risk control: propose position size %, stop/target zones, and clear no-trade conditions.",
    },
];

function normalizeSymbol(input: string) {
    const value = String(input || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!value) return "";
    if (SYMBOL_ALIASES[value]) return SYMBOL_ALIASES[value];
    if (TAIWAN_SYMBOL_RE.test(value)) return `${value}.TW`;
    if (TAIWAN_YAHOO_SYMBOL_RE.test(value)) return value;
    return value;
}

function displaySymbol(symbol: string) {
    return String(symbol || "").replace(/\.(TW|TWO)$/i, "");
}

function pickSupportCopyIndex(currentIndex = -1) {
    if (SUPPORT_COPY_VARIANTS.length <= 1) return 0;
    const nextIndex = Math.floor(Math.random() * SUPPORT_COPY_VARIANTS.length);
    return nextIndex === currentIndex ? (nextIndex + 1) % SUPPORT_COPY_VARIANTS.length : nextIndex;
}

function readStoredWatchlist() {
    if (typeof window === "undefined") return DEFAULT_WATCHLIST;
    try {
        const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
        if (!raw) return DEFAULT_WATCHLIST;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return DEFAULT_WATCHLIST;
        const values = parsed.map((item) => normalizeSymbol(String(item))).filter(Boolean);
        return values.length ? Array.from(new Set(values)).slice(0, 20) : DEFAULT_WATCHLIST;
    } catch {
        return DEFAULT_WATCHLIST;
    }
}

function formatNumber(value: number | null | undefined, locale: string, fractionDigits = 2) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return "--";
    return new Intl.NumberFormat(locale, {
        maximumFractionDigits: fractionDigits,
        minimumFractionDigits: numericValue % 1 === 0 ? 0 : Math.min(2, fractionDigits),
    }).format(numericValue);
}

function formatSignedNumber(value: number | null | undefined, locale: string, fractionDigits = 2) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return "--";
    const formatted = formatNumber(Math.abs(numericValue), locale, fractionDigits);
    if (numericValue > 0) return `+${formatted}`;
    if (numericValue < 0) return `-${formatted}`;
    return formatted;
}

function formatCompact(value: number | null | undefined, locale: string) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return "--";
    return new Intl.NumberFormat(locale, {
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(numericValue);
}

function toFiniteNumber(value: unknown) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : 0;
}

function getQuoteTone(value: number | null | undefined) {
    const numericValue = Number(value);
    if (numericValue > 0) return "text-emerald-600 dark:text-emerald-400";
    if (numericValue < 0) return "text-rose-600 dark:text-rose-400";
    return "text-muted-foreground";
}

function getLabelForPoint(point: HistoryPoint, range: RangeKey, localeCode: string) {
    const date = new Date(point.time);
    if (range === "1D") {
        return new Intl.DateTimeFormat(localeCode, { hour: "2-digit", minute: "2-digit" }).format(date);
    }
    return new Intl.DateTimeFormat(localeCode, { month: "2-digit", day: "2-digit" }).format(date);
}

function buildChartData(points: HistoryPoint[], range: RangeKey, localeCode: string) {
    return points.map((point) => ({
        ...point,
        label: getLabelForPoint(point, range, localeCode),
    }));
}

function getFreshnessLabel(value: string, localeCode: string) {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return "--";
    return new Intl.DateTimeFormat(localeCode, {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(parsed));
}

function getStockMethodLabel(method: StockAnalysisMethodKey, isEnglish: boolean) {
    const found = STOCK_ANALYSIS_METHODS.find((item) => item.key === method) || STOCK_ANALYSIS_METHODS[0];
    return isEnglish ? found.labelEn : found.labelZh;
}

function buildStockPromptTemplate(method: StockAnalysisMethodKey, isEnglish: boolean) {
    const found = STOCK_ANALYSIS_METHODS.find((item) => item.key === method) || STOCK_ANALYSIS_METHODS[0];
    return isEnglish ? found.promptEn : found.promptZh;
}

function calculateSmaAt(points: Array<{ close: number }>, index: number, period: number) {
    if (index + 1 < period) return null;
    const slice = points.slice(index + 1 - period, index + 1);
    return slice.reduce((sum, point) => sum + point.close, 0) / period;
}

function buildLinePath(
    points: Array<{ close: number }>,
    period: number,
    mapX: (index: number) => number,
    mapY: (value: number) => number
) {
    const commands: string[] = [];
    points.forEach((_, index) => {
        const value = calculateSmaAt(points, index, period);
        if (value === null) return;
        commands.push(`${commands.length ? "L" : "M"} ${mapX(index).toFixed(2)} ${mapY(value).toFixed(2)}`);
    });
    return commands.join(" ");
}

function CandlestickChart({
    data,
    currency,
    localeCode,
    isEnglish,
}: {
    data: Array<HistoryPoint & { label: string }>;
    currency: string;
    localeCode: string;
    isEnglish: boolean;
}) {
    const width = 1000;
    const height = 340;
    const padding = { top: 18, right: 74, bottom: 34, left: 18 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const safeData = data.filter((point) => Number.isFinite(point.close));

    if (!safeData.length) {
        return (
            <div className="flex h-full items-center justify-center rounded-lg border border-border bg-secondary/20 text-sm text-muted-foreground">
                {isEnglish ? "No chart data available." : "目前沒有可用的 K 線資料。"}
            </div>
        );
    }

    const highs = safeData.map((point) => Number(point.high ?? point.close));
    const lows = safeData.map((point) => Number(point.low ?? point.close));
    const maxPrice = Math.max(...highs);
    const minPrice = Math.min(...lows);
    const pricePadding = Math.max((maxPrice - minPrice) * 0.08, maxPrice * 0.002, 1);
    const yMax = maxPrice + pricePadding;
    const yMin = Math.max(0, minPrice - pricePadding);
    const candleStep = plotWidth / Math.max(1, safeData.length - 1);
    const candleWidth = Math.max(4, Math.min(16, candleStep * 0.58));
    const gridLines = Array.from({ length: 5 }, (_, index) => {
        const ratio = index / 4;
        const value = yMax - (yMax - yMin) * ratio;
        const y = padding.top + plotHeight * ratio;
        return { y, value };
    });

    const mapX = (index: number) => padding.left + index * candleStep;
    const mapY = (value: number) => padding.top + ((yMax - value) / Math.max(1, yMax - yMin)) * plotHeight;
    const sma5Path = buildLinePath(safeData, 5, mapX, mapY);
    const sma20Path = buildLinePath(safeData, 20, mapX, mapY);
    const last = safeData[safeData.length - 1];

    return (
        <div className="h-full rounded-lg border border-border bg-background">
            <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label={isEnglish ? "Candlestick chart" : "K 線圖"}>
                <rect x="0" y="0" width={width} height={height} fill="transparent" />
                {gridLines.map((line) => (
                    <g key={line.y}>
                        <line x1={padding.left} x2={width - padding.right + 10} y1={line.y} y2={line.y} className="stroke-border" strokeDasharray="4 6" />
                        <text x={width - padding.right + 18} y={line.y + 4} className="fill-muted-foreground text-[11px]">
                            {formatNumber(line.value, localeCode)}
                        </text>
                    </g>
                ))}
                {safeData.map((point, index) => {
                    const open = Number(point.open ?? point.close);
                    const close = Number(point.close);
                    const high = Number(point.high ?? Math.max(open, close));
                    const low = Number(point.low ?? Math.min(open, close));
                    const x = mapX(index);
                    const yHigh = mapY(high);
                    const yLow = mapY(low);
                    const yOpen = mapY(open);
                    const yClose = mapY(close);
                    const isUp = close >= open;
                    const color = isUp ? "#10b981" : "#ef4444";
                    const bodyY = Math.min(yOpen, yClose);
                    const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));

                    return (
                        <g key={`${point.time}-${index}`}>
                            <title>
                                {`${point.label} O:${formatNumber(open, localeCode)} H:${formatNumber(high, localeCode)} L:${formatNumber(low, localeCode)} C:${formatNumber(close, localeCode)} V:${formatCompact(point.volume, localeCode)}`}
                            </title>
                            <line x1={x} x2={x} y1={yHigh} y2={yLow} stroke={color} strokeWidth="2" />
                            <rect
                                x={x - candleWidth / 2}
                                y={bodyY}
                                width={candleWidth}
                                height={bodyHeight}
                                rx="1.5"
                                fill={isUp ? "rgba(16,185,129,0.22)" : "rgba(239,68,68,0.82)"}
                                stroke={color}
                                strokeWidth="2"
                            />
                        </g>
                    );
                })}
                {sma20Path && <path d={sma20Path} fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}
                {sma5Path && <path d={sma5Path} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
                <text x={padding.left} y={height - 12} className="fill-muted-foreground text-[11px]">
                    {safeData[0]?.label}
                </text>
                <text x={width - padding.right - 24} y={height - 12} textAnchor="end" className="fill-muted-foreground text-[11px]">
                    {safeData[safeData.length - 1]?.label}
                </text>
                <g transform={`translate(${padding.left}, 14)`}>
                    <circle cx="0" cy="0" r="4" fill="#f59e0b" />
                    <text x="10" y="4" className="fill-muted-foreground text-[11px]">SMA5</text>
                    <circle cx="64" cy="0" r="4" fill="#3b82f6" />
                    <text x="74" y="4" className="fill-muted-foreground text-[11px]">SMA20</text>
                    <text x="154" y="4" className="fill-muted-foreground text-[11px]">
                        {currency} {formatNumber(last.close, localeCode)}
                    </text>
                </g>
            </svg>
        </div>
    );
}

export default function StockAnalysisPage() {
    const { locale } = useI18n();
    const isEnglish = locale === "en";
    const localeCode = isEnglish ? "en-US" : "zh-TW";
    const toast = useToast();
    const { activeGolem } = useGolem();

    const [watchlist, setWatchlist] = useState<string[]>(() => readStoredWatchlist());
    const [quotes, setQuotes] = useState<StockQuote[]>([]);
    const [quoteErrors, setQuoteErrors] = useState<Array<{ symbol: string; error: string }>>([]);
    const [selectedMarket, setSelectedMarket] = useState<MarketFilter>("all");
    const [selectedSymbol, setSelectedSymbol] = useState(() => readStoredWatchlist()[0] || "2330.TW");
    const [range, setRange] = useState<RangeKey>("3M");
    const [historyPoints, setHistoryPoints] = useState<HistoryPoint[]>([]);
    const [indicators, setIndicators] = useState<StockIndicators | null>(null);
    const [news, setNews] = useState<StockNews | null>(null);
    const [query, setQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isLoadingQuotes, setIsLoadingQuotes] = useState(true);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [isLoadingNews, setIsLoadingNews] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isLoadingMostActive, setIsLoadingMostActive] = useState(false);
    const [sentSnapshot, setSentSnapshot] = useState(false);
    const [analysisMethod, setAnalysisMethod] = useState<StockAnalysisMethodKey>("balanced");
    const [analysisScope, setAnalysisScope] = useState<AnalysisScope>("selected");
    const [analysisPrompt, setAnalysisPrompt] = useState("");
    const [lastUpdatedAt, setLastUpdatedAt] = useState("");
    const [isMounted, setIsMounted] = useState(false);
    const [showSupportPrompt, setShowSupportPrompt] = useState(false);
    const [supportCopyIndex, setSupportCopyIndex] = useState(0);
    const [mostActiveItems, setMostActiveItems] = useState<MostActiveItem[]>([]);
    const [showAllMostActive, setShowAllMostActive] = useState(false);
    const [mostActiveMarket, setMostActiveMarket] = useState<"tw" | "us">("tw");
    const [mostActiveActions, setMostActiveActions] = useState<Record<string, "add" | "chart" | "ask" | "news">>({});
    const [isFeatureEnabled, setIsFeatureEnabled] = useState(true);
    const [isSidebarHidden, setIsSidebarHidden] = useState(false);
    const lastInteractionRefreshRef = useRef(0);
    const isRuntimeActive = isFeatureEnabled && !isSidebarHidden;

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        const syncRuntimeFlags = () => {
            setIsFeatureEnabled(readFeatureEnabled(STOCKS_FEATURE_ENABLED_STORAGE_KEY, true));
            setIsSidebarHidden(isDashboardRouteHidden(STOCKS_DASHBOARD_HREF));
        };
        syncRuntimeFlags();
        window.addEventListener(DASHBOARD_FEATURE_FLAGS_UPDATED_EVENT, syncRuntimeFlags);
        window.addEventListener(SIDEBAR_NAV_HIDDEN_UPDATED_EVENT, syncRuntimeFlags);
        window.addEventListener("storage", syncRuntimeFlags);
        return () => {
            window.removeEventListener(DASHBOARD_FEATURE_FLAGS_UPDATED_EVENT, syncRuntimeFlags);
            window.removeEventListener(SIDEBAR_NAV_HIDDEN_UPDATED_EVENT, syncRuntimeFlags);
            window.removeEventListener("storage", syncRuntimeFlags);
        };
    }, []);

    useEffect(() => {
        localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist));
    }, [watchlist]);

    useEffect(() => {
        if (!isMounted) return;
        if (showSupportPrompt) return;
        const readSnoozedAt = () => Number(localStorage.getItem(SUPPORT_PROMPT_STORAGE_KEY) || 0);
        const scheduleDelay = () => {
            const elapsed = Date.now() - readSnoozedAt();
            if (elapsed >= SUPPORT_PROMPT_INTERVAL_MS) return SUPPORT_PROMPT_INITIAL_DELAY_MS;
            return SUPPORT_PROMPT_INTERVAL_MS - elapsed;
        };
        const timer = window.setTimeout(() => {
            setSupportCopyIndex((prev) => pickSupportCopyIndex(prev));
            setShowSupportPrompt(true);
        }, scheduleDelay());
        return () => window.clearTimeout(timer);
    }, [isMounted, showSupportPrompt]);

    const loadQuotes = useCallback(async () => {
        if (!watchlist.length) return;
        setIsLoadingQuotes(true);
        try {
            const data = await apiGet<QuotesResponse>(apiUrl(`/api/stocks/quotes?symbols=${encodeURIComponent(watchlist.join(","))}`));
            const nextQuotes = Array.isArray(data.quotes) ? data.quotes : [];
            setQuotes(nextQuotes);
            setQuoteErrors(Array.isArray(data.errors) ? data.errors : []);
            setLastUpdatedAt(data.generatedAt || new Date().toISOString());
            if (nextQuotes.length && !nextQuotes.some((quote) => quote.yahooSymbol === selectedSymbol)) {
                setSelectedSymbol(nextQuotes[0].yahooSymbol);
            }
            return nextQuotes;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            toast.error(isEnglish ? "Failed to load quotes" : "讀取行情失敗", message);
            return [];
        } finally {
            setIsLoadingQuotes(false);
        }
    }, [isEnglish, selectedSymbol, toast, watchlist]);

    const loadHistory = useCallback(async (symbol: string, nextRange: RangeKey) => {
        const safeSymbol = normalizeSymbol(symbol);
        if (!safeSymbol) return;
        const rangeConfig = RANGE_MAP[nextRange];
        setIsLoadingHistory(true);
        try {
            const data = await apiGet<HistoryResponse>(
                apiUrl(`/api/stocks/history?symbol=${encodeURIComponent(safeSymbol)}&range=${rangeConfig.range}&interval=${rangeConfig.interval}`)
            );
            setHistoryPoints(Array.isArray(data.history?.points) ? data.history.points : []);
            setIndicators(data.history?.indicators || null);
            if (!data.history?.points?.length) {
                toast.warning(
                    isEnglish ? "No chart data" : "沒有走勢資料",
                    isEnglish ? "Yahoo Finance returned no valid OHLCV points for this symbol/range." : "Yahoo Finance 沒有回傳這個標的/區間可用的 OHLCV 資料。"
                );
            }
            return data.history || null;
        } catch (error) {
            setHistoryPoints([]);
            setIndicators(null);
            const message = error instanceof Error ? error.message : String(error);
            toast.warning(isEnglish ? "Failed to load chart" : "讀取走勢失敗", message);
            return null;
        } finally {
            setIsLoadingHistory(false);
        }
    }, [isEnglish, toast]);

    const loadMostActive = useCallback(async () => {
        setIsLoadingMostActive(true);
        try {
            const data = await apiGet<MostActiveResponse>(apiUrl(`/api/stocks/most-active?market=${mostActiveMarket}&limit=50`));
            setMostActiveItems(Array.isArray(data.items) ? data.items : []);
        } catch (error) {
            console.warn("[Stocks] Failed to load most active list:", error);
            setMostActiveItems([]);
        } finally {
            setIsLoadingMostActive(false);
        }
    }, [mostActiveMarket]);

    const refreshDashboard = useCallback(async () => {
        await Promise.all([
            loadQuotes(),
            loadHistory(selectedSymbol, range),
            loadMostActive(),
        ]);
    }, [loadHistory, loadMostActive, loadQuotes, range, selectedSymbol]);

    const loadNews = useCallback(async (quote: StockQuote | null) => {
        if (!quote?.yahooSymbol) {
            setNews(null);
            return null;
        }
        setIsLoadingNews(true);
        try {
            const data = await apiGet<NewsResponse>(
                apiUrl(`/api/stocks/news?symbol=${encodeURIComponent(quote.yahooSymbol)}&name=${encodeURIComponent(quote.name || quote.symbol)}`)
            );
            setNews(data.news || null);
            return data.news || null;
        } catch (error) {
            setNews(null);
            console.warn("[Stocks] Failed to load stock news:", error);
            return null;
        } finally {
            setIsLoadingNews(false);
        }
    }, []);

    useEffect(() => {
        if (!isRuntimeActive) return;
        loadQuotes();
    }, [isRuntimeActive, loadQuotes]);

    useEffect(() => {
        if (!isRuntimeActive) return;
        loadMostActive();
    }, [isRuntimeActive, loadMostActive]);

    const handleMostActiveAction = async (item: MostActiveItem) => {
        const action = mostActiveActions[item.yahooSymbol] || "add";
        if (action === "add") {
            addSymbol(item.yahooSymbol);
            return;
        }
        if (action === "chart") {
            setSelectedSymbol(item.yahooSymbol);
            if (!watchlist.includes(item.yahooSymbol)) {
                await loadHistory(item.yahooSymbol, range);
                await loadNews({
                    symbol: item.symbol,
                    yahooSymbol: item.yahooSymbol,
                    name: item.name,
                    market: item.market,
                    currency: item.currency || "TWD",
                    exchangeName: "",
                    exchangeTimezoneName: "Asia/Taipei",
                    price: Number(item.price || 0),
                    previousClose: Number(item.previousClose || 0),
                    open: null,
                    dayHigh: null,
                    dayLow: null,
                    fiftyTwoWeekHigh: null,
                    fiftyTwoWeekLow: null,
                    change: Number(item.change || 0),
                    changePercent: Number(item.changePercent || 0),
                    volume: Number(item.volume || 0),
                    turnover: Number(item.volume || 0) * Number(item.price || 0),
                    marketCap: null,
                    sector: item.market === "us" ? "US Equity" : "台股",
                    dataSource: item.source || "Most Active",
                    lastUpdatedAt: new Date().toISOString(),
                });
            }
            return;
        }
        if (action === "news") {
            addSymbol(item.yahooSymbol);
            const quote = quotes.find((q) => q.yahooSymbol === item.yahooSymbol) || null;
            if (quote) await loadNews(quote);
            return;
        }
        await handleAskGolem(item.yahooSymbol);
    };

    useEffect(() => {
        if (!isRuntimeActive) return;
        loadHistory(selectedSymbol, range);
    }, [isRuntimeActive, loadHistory, range, selectedSymbol]);

    useEffect(() => {
        if (!isRuntimeActive) return;
        const tick = () => {
            if (typeof document !== "undefined" && document.hidden) return;
            refreshDashboard();
        };
        const timer = window.setInterval(tick, AUTO_REFRESH_MS);
        const handleVisibilityChange = () => {
            if (!document.hidden) refreshDashboard();
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            window.clearInterval(timer);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [isRuntimeActive, refreshDashboard]);

    const refreshOnInteraction = useCallback(() => {
        if (!isRuntimeActive) return;
        const now = Date.now();
        if (now - lastInteractionRefreshRef.current < AUTO_REFRESH_MS) return;
        lastInteractionRefreshRef.current = now;
        refreshDashboard();
    }, [isRuntimeActive, refreshDashboard]);

    useEffect(() => {
        const safeQuery = query.trim();
        if (!safeQuery) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }
        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const data = await apiGet<SearchResponse>(apiUrl(`/api/stocks/search?q=${encodeURIComponent(safeQuery)}`));
                setSearchResults(Array.isArray(data.results) ? data.results : []);
            } catch {
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 280);
        return () => clearTimeout(timer);
    }, [query]);

    const visibleQuotes = useMemo(() => {
        return quotes.filter((quote) => selectedMarket === "all" || quote.market === selectedMarket);
    }, [quotes, selectedMarket]);

    const selectedQuote = useMemo(() => {
        return quotes.find((quote) => quote.yahooSymbol === selectedSymbol) ||
            quotes.find((quote) => quote.symbol === displaySymbol(selectedSymbol)) ||
            visibleQuotes[0] ||
            null;
    }, [quotes, selectedSymbol, visibleQuotes]);

    const searchPreview = useMemo(() => {
        const safeQuery = query.trim();
        if (!safeQuery) return null;
        const normalized = normalizeSymbol(safeQuery);
        return searchResults[0] || {
            symbol: displaySymbol(normalized),
            yahooSymbol: normalized,
            name: isSearching ? (isEnglish ? "Resolving from symbol directory..." : "正在從股票清單辨識...") : (isEnglish ? "No directory match yet" : "尚無清單匹配"),
            market: normalized.endsWith(".TW") || normalized.endsWith(".TWO") ? "tw" as Market : "us" as Market,
            exchange: "",
            type: "",
            dataSource: "input",
        };
    }, [isEnglish, isSearching, query, searchResults]);

    useEffect(() => {
        if (!isRuntimeActive) return;
        loadNews(selectedQuote);
    }, [isRuntimeActive, loadNews, selectedQuote]);

    const chartData = useMemo(() => buildChartData(historyPoints, range, localeCode), [historyPoints, localeCode, range]);

    const marketBreadth = useMemo(() => {
        const source = visibleQuotes.length ? visibleQuotes : quotes;
        const advancers = source.filter((quote) => quote.change > 0).length;
        const decliners = source.filter((quote) => quote.change < 0).length;
        const averageMove = source.reduce((sum, quote) => sum + quote.changePercent, 0) / Math.max(1, source.length);
        const totalTurnover = source.reduce((sum, quote) => sum + quote.turnover, 0);
        return { advancers, decliners, averageMove, totalTurnover, count: source.length };
    }, [quotes, visibleQuotes]);

    const snapshot = useMemo<StockDashboardSnapshot>(() => ({
        source: "dashboard-stock-analysis",
        dataStatus: "live-market-data",
        marketFilter: selectedMarket,
        selectedRange: range,
        selected: selectedQuote,
        indicators,
        news,
        watchlist: visibleQuotes,
        breadth: marketBreadth,
        quoteErrors,
        generatedAt: new Date().toISOString(),
    }), [indicators, marketBreadth, news, quoteErrors, range, selectedMarket, selectedQuote, visibleQuotes]);

    const selectedAnalysisMethod = useMemo(
        () => STOCK_ANALYSIS_METHODS.find((item) => item.key === analysisMethod) || STOCK_ANALYSIS_METHODS[0],
        [analysisMethod]
    );

    useEffect(() => {
        setAnalysisPrompt(buildStockPromptTemplate(analysisMethod, isEnglish));
    }, [analysisMethod, isEnglish]);

    useEffect(() => {
        if (!isRuntimeActive) return;
        if (!selectedQuote || !quotes.length) return;
        const timer = setTimeout(() => {
            apiPost(apiUrl("/api/stocks/snapshot"), { snapshot }).catch((error) => {
                console.warn("[Stocks] Failed to sync dashboard snapshot:", error);
            });
        }, 500);
        return () => clearTimeout(timer);
    }, [isRuntimeActive, quotes.length, selectedQuote, snapshot]);

    const addSymbol = (symbol: string) => {
        const safeSymbol = normalizeSymbol(symbol);
        if (!safeSymbol) return;
        setWatchlist((prev) => {
            if (prev.includes(safeSymbol)) return prev;
            return [safeSymbol, ...prev].slice(0, 20);
        });
        setSelectedSymbol(safeSymbol);
        setQuery("");
        setSearchResults([]);
    };

    const removeSymbol = (symbol: string) => {
        setWatchlist((prev) => {
            const next = prev.filter((item) => item !== symbol);
            if (selectedSymbol === symbol && next[0]) setSelectedSymbol(next[0]);
            return next.length ? next : DEFAULT_WATCHLIST;
        });
    };

    const handleAskGolem = async (targetSymbol?: string) => {
        if (!activeGolem) {
            toast.warning(
                isEnglish ? "No active Golem" : "沒有可用的 Golem",
                isEnglish ? "Please start or select a Golem first." : "請先啟動或選擇一個 Golem。"
            );
            return;
        }
        setIsSending(true);
        setSentSnapshot(false);
        try {
            const selectedForRequest = targetSymbol ? normalizeSymbol(targetSymbol) : selectedSymbol;
            if (targetSymbol) {
                setSelectedSymbol(selectedForRequest);
                await Promise.all([
                    loadQuotes(),
                    loadHistory(selectedForRequest, range),
                    loadMostActive(),
                ]);
            } else {
                await refreshDashboard();
            }
            const analysisSymbols = targetSymbol
                ? [selectedForRequest]
                : analysisScope === "selected"
                ? [selectedSymbol]
                : watchlist;
            let snapshotForGolem = snapshot;
            try {
                const refreshed = await apiPost<SnapshotRefreshResponse>(apiUrl("/api/stocks/snapshot/refresh"), {
                    snapshot,
                    symbols: analysisSymbols,
                    selectedSymbol: selectedForRequest,
                    selectedRange: range,
                    marketFilter: selectedMarket,
                    trigger: "dashboard-before-golem-analysis",
                });
                if (refreshed.snapshot) {
                    snapshotForGolem = refreshed.snapshot;
                    setLastUpdatedAt(refreshed.snapshot.generatedAt || new Date().toISOString());
                }
            } catch (refreshError) {
                const message = refreshError instanceof Error ? refreshError.message : String(refreshError);
                toast.warning(
                    isEnglish ? "Using current snapshot" : "使用目前快照",
                    isEnglish ? `Live refresh failed: ${message}` : `即時刷新失敗：${message}`
                );
            }
            const symbolsForPrompt = Array.from(new Set(analysisSymbols.map(normalizeSymbol).filter(Boolean)));
            const userPrompt = String(analysisPrompt || "").trim() || buildStockPromptTemplate(analysisMethod, isEnglish);
            const message = [
                `/stockboard ${symbolsForPrompt.join(" ")}`,
                isEnglish
                    ? `Analysis method: ${getStockMethodLabel(analysisMethod, true)}`
                    : `分析方法：${getStockMethodLabel(analysisMethod, false)}`,
                isEnglish
                    ? `Analysis scope: ${analysisScope === "selected" ? "selected symbol only" : "entire watchlist"}`
                    : `分析範圍：${analysisScope === "selected" ? "僅目前標的" : "全部自選"}`,
                targetSymbol
                    ? (isEnglish ? "Forced scope: single symbol action from Top Volume list." : "強制範圍：由成交量榜單觸發之單一標的分析。")
                    : "",
                isEnglish ? "User strategy prompt:" : "使用者策略提示：",
                userPrompt,
                isEnglish
                    ? "Use the latest Dashboard structured snapshot as primary evidence. Explicitly mention data freshness and uncertainty; avoid guaranteed financial advice."
                    : "請以最新 Dashboard 結構化快照為主要依據，明確標示資料新鮮度與不確定性，避免保證式投資建議。",
                snapshotForGolem?.generatedAt
                    ? `${isEnglish ? "Snapshot generated at" : "快照產生時間"}: ${snapshotForGolem.generatedAt}`
                    : "",
            ].filter(Boolean).join("\n");
            await apiPost(apiUrl("/api/chat"), { golemId: activeGolem, message });
            setSentSnapshot(true);
            toast.success(
                isEnglish ? "Snapshot sent" : "已送出看板快照",
                isEnglish
                    ? (targetSymbol ? "Single-symbol analysis sent. Open Chat to view the result." : "Please open Chat to view the analysis result.")
                    : (targetSymbol ? "已送出單一標的分析，請到交談功能查看結果。" : "請直接到交談功能查看分析結果。")
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            toast.error(isEnglish ? "Send failed" : "送出失敗", message);
        } finally {
            setIsSending(false);
        }
    };

    const snoozeSupportPrompt = () => {
        localStorage.setItem(SUPPORT_PROMPT_STORAGE_KEY, String(Date.now()));
        setShowSupportPrompt(false);
    };
    const supportCopy = SUPPORT_COPY_VARIANTS[supportCopyIndex % SUPPORT_COPY_VARIANTS.length];

    return (
        <div className="min-h-full bg-background text-foreground" onPointerDown={refreshOnInteraction}>
            {showSupportPrompt && (
                <div className="fixed right-4 top-4 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-lg border border-amber-300/70 bg-card p-4 shadow-2xl shadow-amber-500/15 dark:border-amber-400/35">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow-lg shadow-amber-500/25">
                            <Coffee className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 space-y-3">
                            <div>
                                <div className="text-sm font-semibold text-foreground">
                                    {isEnglish ? supportCopy.enTitle : supportCopy.zhTitle}
                                </div>
                                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                    {isEnglish ? supportCopy.enBody : supportCopy.zhBody}
                                </p>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Button className="bg-amber-400 text-amber-950 shadow-lg shadow-amber-500/25 hover:bg-amber-300" asChild>
                                    <a
                                        href={SUPPORT_URL}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={snoozeSupportPrompt}
                                    >
                                        <Coffee className="mr-2 h-4 w-4" />
                                        {isEnglish ? supportCopy.enAction : supportCopy.zhAction}
                                    </a>
                                </Button>
                                <Button variant="ghost" onClick={snoozeSupportPrompt}>
                                    {isEnglish ? "Not this time" : "狠心不贊助"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-4 p-4 sm:p-5">
                <section className="flex flex-col gap-3 border-b border-border/70 pb-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                            <LineChart className="h-4 w-4" />
                            {isEnglish ? "Live TW + US Market Board" : "即時台股 + 美股行情看板"}
                        </div>
                        <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">
                            {isEnglish ? "Stock Analysis" : "股市分析"}
                        </h1>
                        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                            {isEnglish
                                ? "Track watchlists, inspect indicators, search symbols, and send a structured live snapshot to Golem."
                                : "追蹤自選股、檢視技術指標、搜尋標的，並把結構化即時快照交給 Golem 分析。"}
                        </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        {!isRuntimeActive && (
                            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
                                {isEnglish
                                    ? "Background refresh paused (disabled in Settings or hidden in sidebar)."
                                    : "背景刷新已暫停（設定停用或側欄隱藏此頁）。"}
                            </div>
                        )}
                        <div className="inline-flex rounded-lg border border-border bg-card p-1">
                            {[
                                { key: "all", label: isEnglish ? "All" : "全部" },
                                { key: "tw", label: isEnglish ? "Taiwan" : "台股" },
                                { key: "us", label: isEnglish ? "US" : "美股" },
                            ].map((option) => (
                                <button
                                    key={option.key}
                                    type="button"
                                    onClick={() => setSelectedMarket(option.key as MarketFilter)}
                                    className={cn(
                                        "h-9 rounded-md px-3 text-sm font-semibold transition-colors",
                                        selectedMarket === option.key
                                            ? "bg-primary text-primary-foreground"
                                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                    )}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        <Button variant="secondary" onClick={refreshDashboard} disabled={isLoadingQuotes || isLoadingHistory}>
                            {isLoadingQuotes || isLoadingHistory ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                            {isEnglish ? "Refresh" : "刷新"}
                        </Button>
                        <Button
                            className="border-amber-300 bg-amber-400 text-amber-950 shadow-lg shadow-amber-500/25 ring-2 ring-amber-300/40 transition-all hover:bg-amber-300 hover:text-amber-950 dark:border-amber-300/70 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300 motion-safe:animate-pulse"
                            asChild
                        >
                            <a
                                href={SUPPORT_URL}
                                target="_blank"
                                rel="noreferrer"
                                onClick={snoozeSupportPrompt}
                            >
                                <Coffee className="mr-2 h-4 w-4" />
                                {isEnglish ? "Support" : "小額贊助"}
                            </a>
                        </Button>
                    </div>
                </section>

                <section className="grid gap-3 xl:grid-cols-[minmax(280px,0.9fr)_minmax(280px,1fr)_minmax(280px,1fr)]">
                    <Card className="rounded-lg border-border/80">
                        <CardContent className="flex gap-3 p-3">
                            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <div className="space-y-1 text-xs leading-5 text-muted-foreground">
                                <div className="font-semibold text-foreground">{isEnglish ? "How to use" : "使用說明"}</div>
                                <p>{isEnglish ? "Search a symbol, choose an analysis method, edit prompt if needed, then ask Golem. Quotes refresh every minute while this page is open." : "搜尋股票、選擇分析方法、必要時調整 prompt，再請 Golem 分析。頁面停留時每分鐘自動刷新行情。"}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="rounded-lg border-border/80">
                        <CardContent className="p-3 text-xs leading-5 text-muted-foreground">
                            <div className="font-semibold text-foreground">{isEnglish ? "Golem commands" : "Golem 指令"}</div>
                            <div className="mt-1 grid gap-1 sm:grid-cols-2">
                                <code className="rounded-md bg-secondary px-2 py-1">/stockboard 2330</code>
                                <code className="rounded-md bg-secondary px-2 py-1">分析台積電股市看板</code>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="rounded-lg border-border/80">
                        <CardContent className="flex gap-3 p-3">
                            <Newspaper className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <div className="space-y-1 text-xs leading-5 text-muted-foreground">
                                <div className="font-semibold text-foreground">{isEnglish ? "News policy" : "新聞規則"}</div>
                                <p>{isEnglish ? "News search is Chinese-first, merges Yahoo/Google/DuckDuckGo sources, and filters the latest 14 days." : "新聞搜尋中文優先，會合併 Yahoo、Google、DuckDuckGo 來源，並過濾最近 14 天。"}</p>
                            </div>
                        </CardContent>
                    </Card>

                </section>

                <section className="grid gap-4 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
                    <Card className="rounded-lg border-border/80">
                        <CardHeader className="pb-3">
                            <CardDescription>{isEnglish ? "Symbol Search" : "自選股搜尋"}</CardDescription>
                            <CardTitle className="text-xl">{isEnglish ? "Add Taiwan or US stocks" : "加入台股或美股"}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <form
                                className="flex gap-2"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    addSymbol(query);
                                }}
                            >
                                <label className="relative min-w-0 flex-1">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        value={query}
                                        onChange={(event) => setQuery(event.target.value)}
                                        placeholder={isEnglish ? "2330, AAPL, TSM..." : "2330、AAPL、TSM..."}
                                        className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
                                    />
                                </label>
                                <Button type="submit" size="icon" title={isEnglish ? "Add symbol" : "加入標的"}>
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </form>

                            {searchPreview && (
                                <div className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="min-w-0">
                                            <span className="font-semibold">{isEnglish ? "Searching" : "正在搜尋"} {searchPreview.symbol}</span>
                                            <span className="ml-2 text-muted-foreground">{searchPreview.name}</span>
                                        </span>
                                        <span className="shrink-0 rounded-md bg-background/70 px-2 py-1 text-xs text-muted-foreground">
                                            {searchPreview.market === "tw" ? (isEnglish ? "Taiwan" : "台股") : (isEnglish ? "US" : "美股")}
                                            {searchPreview.exchange ? ` · ${searchPreview.exchange}` : ""}
                                        </span>
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        {searchPreview.sector ? `${searchPreview.sector} · ` : ""}{searchPreview.dataSource}
                                    </div>
                                </div>
                            )}

                            <div className="max-h-[260px] min-h-[120px] overflow-y-auto rounded-lg border border-border bg-secondary/25">
                                {isSearching ? (
                                    <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {isEnglish ? "Searching..." : "搜尋中..."}
                                    </div>
                                ) : searchResults.length ? (
                                    <div className="divide-y divide-border/70">
                                        {searchResults.map((result) => (
                                            <button
                                                key={result.yahooSymbol}
                                                type="button"
                                                onClick={() => addSymbol(result.yahooSymbol)}
                                                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/60"
                                            >
                                                <span className="min-w-0">
                                                    <span className="block truncate text-sm font-semibold">{result.symbol} · {result.name}</span>
                                                    <span className="block text-xs text-muted-foreground">{result.exchange || result.market.toUpperCase()} · {result.type}{result.sector ? ` · ${result.sector}` : ""} · {result.dataSource}</span>
                                                </span>
                                                <Plus className="h-4 w-4 text-muted-foreground" />
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex h-32 items-center justify-center px-4 text-center text-sm leading-6 text-muted-foreground">
                                        {isEnglish ? "Search by symbol or company name. Taiwan numeric symbols automatically use .TW." : "可搜尋代號或公司名稱。台股數字代號會自動轉成 .TW。"}
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2">
                                <div className="text-xs text-muted-foreground">
                                    {isEnglish ? "Quick switch watchlist" : "快速切換自選"}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {visibleQuotes.slice(0, 6).map((quote) => (
                                        <button
                                            key={`quick-${quote.yahooSymbol}`}
                                            type="button"
                                            onClick={() => setSelectedSymbol(quote.yahooSymbol)}
                                            className={cn(
                                                "rounded-md border px-2.5 py-1 text-xs transition-colors",
                                                selectedSymbol === quote.yahooSymbol
                                                    ? "border-primary bg-primary/10 text-primary"
                                                    : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                                            )}
                                        >
                                            {quote.symbol}
                                        </button>
                                    ))}
                                    {!visibleQuotes.length && (
                                        <span className="text-xs text-muted-foreground">
                                            {isEnglish ? "No watchlist symbols yet." : "尚未有自選標的。"}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid gap-4 md:grid-cols-3">
                        <Card className="rounded-lg border-border/80">
                            <CardHeader className="pb-3">
                                <CardDescription>{isEnglish ? "Selected" : "目前選取"}</CardDescription>
                                <CardTitle className="flex items-center justify-between text-xl">
                                    <span className="truncate">{selectedQuote?.name || "--"}</span>
                                    <span className="ml-3 rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground">
                                        {selectedQuote?.symbol || displaySymbol(selectedSymbol)}
                                    </span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="text-3xl font-semibold">
                                    {selectedQuote ? `${selectedQuote.currency} ${formatNumber(selectedQuote.price, localeCode)}` : "--"}
                                </div>
                                <div className={cn("flex items-center text-sm font-semibold", getQuoteTone(selectedQuote?.change))}>
                                    {(selectedQuote?.change || 0) >= 0 ? <ArrowUpRight className="mr-1 h-4 w-4" /> : <ArrowDownRight className="mr-1 h-4 w-4" />}
                                    {selectedQuote && selectedQuote.change >= 0 ? "+" : ""}
                                    {formatNumber(selectedQuote?.change, localeCode)} ({selectedQuote && selectedQuote.changePercent >= 0 ? "+" : ""}
                                    {formatNumber(selectedQuote?.changePercent, localeCode)}%)
                                </div>
                                <p className="text-sm leading-6 text-muted-foreground">
                                    {selectedQuote
                                        ? `${selectedQuote.dataSource}${selectedQuote.dataQuality === "stale-cache" ? (isEnglish ? " · stale cache" : " · 快取資料") : ""} · ${getFreshnessLabel(selectedQuote.lastUpdatedAt, localeCode)}`
                                        : isEnglish ? "No quote selected." : "尚未選取行情。"}
                                </p>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="rounded-md border border-border bg-background px-2 py-1.5">
                                        <div className="text-muted-foreground">{isEnglish ? "Market Cap" : "市值"}</div>
                                        <div className="mt-0.5 font-semibold">{formatCompact(selectedQuote?.marketCap, localeCode)}</div>
                                    </div>
                                    <div className="rounded-md border border-border bg-background px-2 py-1.5">
                                        <div className="text-muted-foreground">{isEnglish ? "Trailing PE" : "本益比(TTM)"}</div>
                                        <div className="mt-0.5 font-semibold">{formatNumber(selectedQuote?.trailingPE, localeCode, 2)}</div>
                                    </div>
                                    <div className="rounded-md border border-border bg-background px-2 py-1.5">
                                        <div className="text-muted-foreground">{isEnglish ? "Forward PE" : "預估本益比"}</div>
                                        <div className="mt-0.5 font-semibold">{formatNumber(selectedQuote?.forwardPE, localeCode, 2)}</div>
                                    </div>
                                    <div className="rounded-md border border-border bg-background px-2 py-1.5">
                                        <div className="text-muted-foreground">{isEnglish ? "Dividend Yield" : "股息殖利率"}</div>
                                        <div className="mt-0.5 font-semibold">
                                            {selectedQuote?.dividendYield == null ? "--" : `${formatNumber(selectedQuote.dividendYield * 100, localeCode, 2)}%`}
                                        </div>
                                    </div>
                                </div>
                                <div className="rounded-lg border border-border/70 bg-secondary/30 p-2.5">
                                    <div className="mb-2 text-xs text-muted-foreground">{isEnglish ? "Market Breadth" : "市場廣度"}</div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1.5">
                                            <div className="text-[11px] text-muted-foreground">{isEnglish ? "Up" : "上漲"}</div>
                                            <div className="text-base font-semibold text-emerald-600 dark:text-emerald-400">{marketBreadth.advancers}</div>
                                        </div>
                                        <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1.5">
                                            <div className="text-[11px] text-muted-foreground">{isEnglish ? "Down" : "下跌"}</div>
                                            <div className="text-base font-semibold text-rose-600 dark:text-rose-400">{marketBreadth.decliners}</div>
                                        </div>
                                        <div className="rounded-md border border-sky-500/20 bg-sky-500/10 px-2 py-1.5">
                                            <div className="text-[11px] text-muted-foreground">{isEnglish ? "Avg" : "平均"}</div>
                                            <div className={cn("text-base font-semibold", getQuoteTone(marketBreadth.averageMove))}>
                                                {marketBreadth.averageMove >= 0 ? "+" : ""}
                                                {formatNumber(marketBreadth.averageMove, localeCode)}%
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-lg border-border/80">
                            <CardHeader className="pb-3">
                                <CardDescription>{isEnglish ? "Previous Session Leaderboard" : "前一交易日排行榜"}</CardDescription>
                                <CardTitle className="text-xl">{isEnglish ? "Top 50 by Volume" : "成交量 Top 50"}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={mostActiveMarket === "tw" ? "default" : "outline"}
                                        className="h-7 px-2 text-xs"
                                        onClick={() => setMostActiveMarket("tw")}
                                    >
                                        {isEnglish ? "Taiwan" : "台股"}
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={mostActiveMarket === "us" ? "default" : "outline"}
                                        className="h-7 px-2 text-xs"
                                        onClick={() => setMostActiveMarket("us")}
                                    >
                                        {isEnglish ? "US" : "美股"}
                                    </Button>
                                </div>
                                {isLoadingMostActive ? (
                                    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {isEnglish ? "Loading active symbols..." : "讀取熱門成交標的中..."}
                                    </div>
                                ) : mostActiveItems.length ? (
                                    <div className="max-h-[310px] overflow-y-auto rounded-lg border border-border bg-background/40">
                                        <div className="divide-y divide-border/70">
                                            {mostActiveItems.slice(0, showAllMostActive ? 50 : 20).map((item) => (
                                                <div key={`active-${item.yahooSymbol}`} className="space-y-2 px-3 py-2.5">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <div className="truncate text-sm font-semibold">{item.symbol} · {item.name}</div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {isEnglish ? "Volume" : "成交量"} {formatCompact(item.volume, localeCode)}
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-sm font-semibold">
                                                                {item.currency} {formatNumber(item.price, localeCode)}
                                                            </div>
                                                            <div className={cn("text-xs font-semibold", getQuoteTone(item.change))}>
                                                                {item.change !== null && item.change >= 0 ? "+" : ""}
                                                                {formatNumber(item.change, localeCode)} ({item.changePercent !== null && (item.changePercent || 0) >= 0 ? "+" : ""}
                                                                {formatNumber(item.changePercent, localeCode)}%)
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <select
                                                            value={mostActiveActions[item.yahooSymbol] || "add"}
                                                            onChange={(event) => {
                                                                const next = event.target.value as "add" | "chart" | "ask" | "news";
                                                                setMostActiveActions((prev) => ({ ...prev, [item.yahooSymbol]: next }));
                                                            }}
                                                            className="h-7 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs"
                                                        >
                                                            <option value="add">{isEnglish ? "Add Watchlist" : "加入自選股"}</option>
                                                            <option value="chart">{isEnglish ? "View K-line" : "看 K 線"}</option>
                                                            <option value="ask">{isEnglish ? "Ask Golem (Single)" : "單一送 Golem 分析"}</option>
                                                            <option value="news">{isEnglish ? "Load News" : "看新聞"}</option>
                                                        </select>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            className="h-7 px-2 text-xs"
                                                            onClick={() => void handleMostActiveAction(item)}
                                                            disabled={isSending}
                                                        >
                                                            {isEnglish ? "Run" : "執行"}
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                                        {isEnglish ? "No leaderboard data yet." : "暫無排行榜資料。"}
                                    </div>
                                )}
                                {!!mostActiveItems.length && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-full text-xs"
                                        onClick={() => setShowAllMostActive((prev) => !prev)}
                                    >
                                        {showAllMostActive
                                            ? (isEnglish ? "Show Top 20" : "只看前 20")
                                            : (isEnglish ? "Expand to Top 50" : "展開到 Top 50")}
                                    </Button>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="rounded-lg border-border/80">
                            <CardHeader className="pb-3">
                                <CardDescription>{isEnglish ? "Golem Handoff" : "交給 Golem"}</CardDescription>
                                <CardTitle className="flex items-center gap-2 text-xl">
                                    <BrainCircuit className="h-5 w-5 text-primary" />
                                    {isEnglish ? "Analyze Board" : "分析看板"}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <p className="text-sm leading-6 text-muted-foreground">
                                    {isEnglish
                                        ? "Send live quotes, indicators, search context, and watchlist breadth as a structured snapshot."
                                        : "把即時行情、技術指標、搜尋脈絡與自選股廣度整理成快照。"}
                                </p>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-foreground">
                                        {isEnglish ? "Analysis Method" : "分析方法"}
                                    </label>
                                    <select
                                        value={analysisMethod}
                                        onChange={(event) => setAnalysisMethod(event.target.value as StockAnalysisMethodKey)}
                                        className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                                    >
                                        {STOCK_ANALYSIS_METHODS.map((method) => (
                                            <option key={method.key} value={method.key}>
                                                {isEnglish ? method.labelEn : method.labelZh}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-muted-foreground">
                                        {isEnglish ? selectedAnalysisMethod.explainEn : selectedAnalysisMethod.explainZh}
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-foreground">
                                        {isEnglish ? "Analysis Scope" : "分析範圍"}
                                    </label>
                                    <select
                                        value={analysisScope}
                                        onChange={(event) => setAnalysisScope(event.target.value as AnalysisScope)}
                                        className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                                    >
                                        <option value="selected">{isEnglish ? "Selected symbol only" : "僅目前標的"}</option>
                                        <option value="watchlist">{isEnglish ? "Entire watchlist" : "全部自選"}</option>
                                    </select>
                                    <p className="text-xs text-muted-foreground">
                                        {analysisScope === "selected"
                                            ? (isEnglish ? "Only the current symbol snapshot will be sent to Golem." : "只會把目前標的快照送給 Golem。")
                                            : (isEnglish ? "All watchlist symbols will be included in the snapshot." : "會把全部自選標的一起送進快照。")}
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-foreground">
                                            {isEnglish ? "Prompt for Golem" : "給 Golem 的分析 Prompt"}
                                        </label>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-xs"
                                            onClick={() => setAnalysisPrompt(buildStockPromptTemplate(analysisMethod, isEnglish))}
                                        >
                                            {isEnglish ? "Reset template" : "重設模板"}
                                        </Button>
                                    </div>
                                    <textarea
                                        value={analysisPrompt}
                                        onChange={(event) => setAnalysisPrompt(event.target.value)}
                                        className="min-h-[96px] w-full rounded-md border border-border bg-background px-2 py-2 text-sm leading-5"
                                        placeholder={isEnglish ? "Write strategy prompt..." : "輸入分析策略提示..."}
                                    />
                                </div>
                                <Button className="w-full" onClick={() => void handleAskGolem()} disabled={isSending || !selectedQuote}>
                                    {sentSnapshot ? <Check className="mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                    {isSending ? (isEnglish ? "Sending..." : "送出中...") : (isEnglish ? "Ask Golem" : "請 Golem 分析")}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </section>

                <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
                    <Card className="rounded-lg border-border/80">
                        <CardHeader className="flex flex-col gap-3 pb-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <CardDescription>{isEnglish ? "Candlestick Trend" : "K 線趨勢"}</CardDescription>
                                <CardTitle className="mt-1 text-xl">{selectedQuote?.symbol || displaySymbol(selectedSymbol)} · {selectedQuote?.name || "--"}</CardTitle>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-2">
                                <select
                                    value={selectedSymbol}
                                    onChange={(event) => setSelectedSymbol(event.target.value)}
                                    className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                                >
                                    {visibleQuotes.map((quote) => (
                                        <option key={`chart-${quote.yahooSymbol}`} value={quote.yahooSymbol}>
                                            {quote.symbol} · {quote.name}
                                        </option>
                                    ))}
                                </select>
                                <div className="inline-flex rounded-lg border border-border bg-background p-1">
                                    {(Object.keys(RANGE_MAP) as RangeKey[]).map((option) => (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() => setRange(option)}
                                            className={cn(
                                                "h-8 min-w-10 rounded-md px-2 text-xs font-semibold transition-colors",
                                                range === option ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                            )}
                                        >
                                            {option}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="h-[340px]">
                                {isLoadingHistory ? (
                                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {isEnglish ? "Loading chart..." : "讀取走勢中..."}
                                    </div>
                                ) : (
                                    <CandlestickChart
                                        data={chartData}
                                        currency={selectedQuote?.currency || ""}
                                        localeCode={localeCode}
                                        isEnglish={isEnglish}
                                    />
                                )}
                            </div>
                            <div className="grid gap-3 sm:grid-cols-4">
                                {[
                                    { label: "SMA 5", value: formatNumber(indicators?.sma5, localeCode) },
                                    { label: "SMA 20", value: formatNumber(indicators?.sma20, localeCode) },
                                    { label: "RSI 14", value: formatNumber(indicators?.rsi14, localeCode, 1) },
                                    { label: "MACD", value: formatNumber(indicators?.macd, localeCode, 2) },
                                    { label: isEnglish ? "MACD Signal" : "MACD 訊號", value: formatNumber(indicators?.macdSignal, localeCode, 2) },
                                    { label: isEnglish ? "MACD Hist" : "MACD 柱", value: formatNumber(indicators?.macdHistogram, localeCode, 2) },
                                    { label: "KD K", value: formatNumber(indicators?.stochasticK, localeCode, 1) },
                                    { label: "KD D", value: formatNumber(indicators?.stochasticD, localeCode, 1) },
                                    { label: isEnglish ? "Volatility" : "年化波動", value: `${formatNumber(indicators?.volatility, localeCode, 1)}%` },
                                    { label: isEnglish ? "Drawdown" : "最大回撤", value: `${formatNumber(indicators?.maxDrawdown, localeCode, 1)}%` },
                                    { label: isEnglish ? "Volume Ratio" : "量比", value: `${formatNumber(indicators?.volumeRatio, localeCode, 2)}x` },
                                    { label: isEnglish ? "Vs SMA20" : "距 SMA20", value: `${formatNumber(indicators?.distanceToSma20Percent, localeCode, 1)}%` },
                                    { label: isEnglish ? "Day Range" : "日內區間", value: `${formatNumber(selectedQuote?.dayLow, localeCode)} - ${formatNumber(selectedQuote?.dayHigh, localeCode)}` },
                                    { label: isEnglish ? "52W Range" : "52 週區間", value: `${formatNumber(selectedQuote?.fiftyTwoWeekLow, localeCode)} - ${formatNumber(selectedQuote?.fiftyTwoWeekHigh, localeCode)}` },
                                ].map((item) => (
                                    <div key={item.label} className="rounded-lg border border-border bg-background p-3">
                                        <div className="text-xs text-muted-foreground">{item.label}</div>
                                        <div className="mt-1 text-base font-semibold">{item.value}</div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="space-y-4">
                    <Card className="rounded-lg border-border/80">
                        <CardHeader className="pb-4">
                            <CardDescription>{isEnglish ? "Volume Shape" : "量能輪廓"}</CardDescription>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <BarChart3 className="h-5 w-5 text-primary" />
                                {isEnglish ? "Trading Activity" : "交易活躍度"}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[280px] min-h-[280px] min-w-0">
                                {isMounted ? (
                                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                        <BarChart data={chartData.slice(-24)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                            <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={18} className="text-xs" />
                                            <YAxis tickLine={false} axisLine={false} width={46} className="text-xs" tickFormatter={(value) => formatCompact(Number(value), localeCode)} />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: "var(--color-popover)",
                                                    borderColor: "var(--color-border)",
                                                    borderRadius: 8,
                                                    boxShadow: "0 10px 24px rgba(0,0,0,0.22)",
                                                }}
                                                formatter={(value) => [formatCompact(toFiniteNumber(value), localeCode), isEnglish ? "Volume" : "成交量"]}
                                            />
                                            <Bar dataKey="volume" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : null}
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-3">
                                {[
                                    { label: isEnglish ? "Open" : "開盤", value: formatNumber(selectedQuote?.open, localeCode) },
                                    { label: isEnglish ? "Prev Close" : "昨收", value: formatNumber(selectedQuote?.previousClose, localeCode) },
                                    {
                                        label: isEnglish ? "Price Change" : "價格變動",
                                        value: `${selectedQuote?.currency || ""} ${formatSignedNumber(selectedQuote?.change, localeCode)}`.trim(),
                                        tone: getQuoteTone(selectedQuote?.change),
                                    },
                                    { label: isEnglish ? "Volume" : "成交量", value: formatCompact(selectedQuote?.volume, localeCode) },
                                    { label: isEnglish ? "Turnover" : "成交值", value: formatCompact(selectedQuote?.turnover, localeCode) },
                                ].map((item) => (
                                    <div key={item.label} className="rounded-lg border border-border bg-background p-3">
                                        <div className="text-xs text-muted-foreground">{item.label}</div>
                                        <div className={cn("mt-1 text-base font-semibold", item.tone)}>{item.value}</div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-lg border-border/80">
                        <CardHeader className="pb-3">
                            <CardDescription>{isEnglish ? "Chinese-first news" : "中文優先新聞"}</CardDescription>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <Newspaper className="h-5 w-5 text-primary" />
                                {selectedQuote ? `${selectedQuote.symbol} · ${selectedQuote.name}` : (isEnglish ? "Stock News" : "個股新聞")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="rounded-lg border border-border bg-background p-3 text-xs leading-5 text-muted-foreground">
                                {news?.dateWindow
                                    ? `${isEnglish ? "Query" : "查詢"}: ${news.query} · ${news.dateWindow.since} ~ ${news.dateWindow.until}`
                                    : isEnglish ? "News query adds a 14-day date window." : "新聞查詢會加入兩週內日期條件。"}
                            </div>
                            {isLoadingNews ? (
                                <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {isEnglish ? "Searching news..." : "搜尋新聞中..."}
                                </div>
                            ) : news?.results?.length ? (
                                <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                                    {news.results.map((item) => (
                                        <a
                                            key={item.url}
                                            href={item.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="block rounded-lg border border-border bg-background p-3 transition-colors hover:bg-accent/60"
                                        >
                                            <div className="line-clamp-2 text-sm font-semibold leading-5">{item.title}</div>
                                            <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.snippet || item.source}</div>
                                            {(item.publishedAt || item.source) && (
                                                <div className="mt-2 text-[11px] text-muted-foreground">
                                                    {item.source}{item.publishedAt ? ` · ${getFreshnessLabel(item.publishedAt, localeCode)}` : ""}
                                                </div>
                                            )}
                                        </a>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-lg border border-border bg-secondary/25 p-4 text-center text-sm text-muted-foreground">
                                    {isEnglish ? "No recent Chinese search results found." : "目前沒有找到兩週內中文優先搜尋結果。"}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    </div>
                </section>

                <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                    <Card className="rounded-lg border-border/80">
                        <CardHeader className="gap-3 pb-4 md:flex-row md:items-center md:justify-between md:space-y-0">
                            <div>
                                <CardDescription>{isEnglish ? "Watchlist" : "自選股"}</CardDescription>
                                <CardTitle className="text-xl">{isEnglish ? "Live Taiwan and US symbols" : "即時台股與美股標的"}</CardTitle>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {lastUpdatedAt ? `${isEnglish ? "Updated" : "更新"} ${getFreshnessLabel(lastUpdatedAt, localeCode)}` : ""}
                            </div>
                        </CardHeader>
                        <CardContent className="overflow-x-auto">
                            <table className="w-full min-w-[1040px] text-sm">
                                <thead>
                                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                                        <th className="pb-3 font-semibold">{isEnglish ? "Symbol" : "代號"}</th>
                                        <th className="pb-3 font-semibold">{isEnglish ? "Market" : "市場"}</th>
                                        <th className="pb-3 text-right font-semibold">{isEnglish ? "Price" : "價格"}</th>
                                        <th className="pb-3 text-right font-semibold">{isEnglish ? "Price Change" : "價格變動"}</th>
                                        <th className="pb-3 text-right font-semibold">{isEnglish ? "% Change" : "漲跌幅"}</th>
                                        <th className="pb-3 text-right font-semibold">{isEnglish ? "Volume" : "成交量"}</th>
                                        <th className="pb-3 text-right font-semibold">{isEnglish ? "Turnover" : "成交值"}</th>
                                        <th className="pb-3 font-semibold">{isEnglish ? "Source" : "來源"}</th>
                                        <th className="pb-3 text-right font-semibold">{isEnglish ? "Action" : "操作"}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoadingQuotes && !quotes.length ? (
                                        <tr>
                                            <td colSpan={9} className="py-10 text-center text-muted-foreground">
                                                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                                                {isEnglish ? "Loading quotes..." : "讀取行情中..."}
                                            </td>
                                        </tr>
                                    ) : visibleQuotes.map((quote) => (
                                        <tr
                                            key={quote.yahooSymbol}
                                            onClick={() => setSelectedSymbol(quote.yahooSymbol)}
                                            className={cn(
                                                "cursor-pointer border-b border-border/70 transition-colors hover:bg-accent/60",
                                                selectedQuote?.yahooSymbol === quote.yahooSymbol && "bg-primary/10"
                                            )}
                                        >
                                            <td className="py-3">
                                                <div className="font-semibold">{quote.symbol}</div>
                                                <div className="max-w-[220px] truncate text-xs text-muted-foreground">{quote.name}</div>
                                            </td>
                                            <td className="py-3">
                                                <span className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
                                                    {quote.market === "tw" ? (isEnglish ? "Taiwan" : "台股") : (isEnglish ? "US" : "美股")}
                                                </span>
                                            </td>
                                            <td className="py-3 text-right font-semibold">{quote.currency} {formatNumber(quote.price, localeCode)}</td>
                                            <td className={cn("py-3 text-right font-semibold", getQuoteTone(quote.change))}>
                                                {quote.currency} {formatSignedNumber(quote.change, localeCode)}
                                            </td>
                                            <td className={cn("py-3 text-right font-semibold", getQuoteTone(quote.change))}>
                                                {quote.changePercent >= 0 ? "+" : ""}
                                                {formatNumber(quote.changePercent, localeCode)}%
                                            </td>
                                            <td className="py-3 text-right text-muted-foreground">{formatCompact(quote.volume, localeCode)}</td>
                                            <td className="py-3 text-right text-muted-foreground">{formatCompact(quote.turnover, localeCode)}</td>
                                            <td className="py-3 text-muted-foreground">{quote.dataSource}</td>
                                            <td className="py-3 text-right">
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        removeSymbol(quote.yahooSymbol);
                                                    }}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                                    title={isEnglish ? "Remove" : "移除"}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {quoteErrors.length > 0 && (
                                <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-muted-foreground">
                                    {isEnglish ? "Some symbols failed:" : "部分標的讀取失敗："} {quoteErrors.map((item) => `${item.symbol}: ${item.error}`).join("; ")}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="rounded-lg border-border/80">
                        <CardHeader className="pb-3">
                            <CardDescription>{isEnglish ? "Snapshot Preview" : "快照預覽"}</CardDescription>
                            <CardTitle className="text-xl">{isEnglish ? "What Golem Reads" : "Golem 會讀到什麼"}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <pre className="max-h-[460px] overflow-auto rounded-lg border border-border bg-secondary/40 p-3 text-xs leading-5 text-muted-foreground">
                                {JSON.stringify(snapshot, null, 2)}
                            </pre>
                        </CardContent>
                    </Card>
                </section>
            </div>
        </div>
    );
}
