import axios from "axios"

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
})

// Attach user ID to every request (replaced by JWT later)
export function setUserId(userId: string) {
  api.defaults.headers.common["X-User-Id"] = userId
}

export interface Trade {
  id?: string
  user_id?: string
  symbol?: string
  instrument_type?: string
  trade_type?: string        // options_intraday | equity_swing | futures_swing
  action?: string
  status?: string            // open | closed
  quantity?: number
  entry_price?: number
  exit_price?: number
  pnl?: number
  pnl_percent?: number
  trade_date?: string
  trade_time?: string
  broker?: string
  sector?: string
  overnight_charges?: number
  linked_trade_id?: string
  holding_days?: number
  closed_at?: string
  ai_feedback?: string
  created_at?: string
}

export interface TradeStats {
  total_trades: number
  win_rate: number
  total_pnl: number
  avg_profit: number
  avg_loss: number
}

export interface FeedbackResponse {
  trade: Trade
  feedback: string
}

export interface MultiTradeResponse {
  trades: Trade[]
  feedback: string
  count: number
}

export type UploadResponse = FeedbackResponse | MultiTradeResponse

export function isMultiTrade(r: UploadResponse): r is MultiTradeResponse {
  return "trades" in r && Array.isArray((r as MultiTradeResponse).trades)
}

export interface OpenPosition {
  trade: Trade
  days_held: number
}

export interface SectorStat {
  total: number
  wins: number
  win_rate: number
}

export interface SwingPatterns {
  sector_win_rate: Record<string, SectorStat>
  avg_holding_days_winners: number | null
  avg_holding_days_losers: number | null
  dead_money_positions: Trade[]
  panic_sell_count: number
}

export interface TimeSlotStat {
  total: number
  wins: number
  win_rate: number
}

export interface OptionsPatterns {
  expiry_day_win_rate: number | null
  non_expiry_win_rate: number | null
  expiry_day_trades: number
  time_slot_win_rate: Record<string, TimeSlotStat>
  total_options_trades: number
}

export async function uploadTradeScreenshot(
  file: File,
  options?: { linked_trade_id?: string; trade_type?: string }
): Promise<UploadResponse> {
  const form = new FormData()
  form.append("file", file)
  if (options?.linked_trade_id) {
    form.append("linked_trade_id", options.linked_trade_id)
  }
  if (options?.trade_type) {
    form.append("trade_type_override", options.trade_type)
  }
  const { data } = await api.post<UploadResponse>("/trades/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return data
}

export async function closePosition(
  tradeId: string,
  file: File
): Promise<FeedbackResponse> {
  const form = new FormData()
  form.append("file", file)
  const { data } = await api.post<FeedbackResponse>(
    `/trades/${tradeId}/close`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  )
  return data
}

export async function getOpenPositions(): Promise<OpenPosition[]> {
  const { data } = await api.get<OpenPosition[]>("/trades/open")
  return data
}

export async function getSwingPatterns(): Promise<SwingPatterns> {
  const { data } = await api.get<SwingPatterns>("/trades/patterns/swing")
  return data
}

export async function getOptionsPatterns(): Promise<OptionsPatterns> {
  const { data } = await api.get<OptionsPatterns>("/trades/patterns/options")
  return data
}

export async function fetchMyTrades(): Promise<Trade[]> {
  const { data } = await api.get<Trade[]>("/trades/my")
  return data
}

export async function fetchTradeStats(): Promise<TradeStats> {
  const { data } = await api.get<TradeStats>("/trades/stats")
  return data
}

export interface MarketContext {
  underlying: string
  strike: number
  opt_type: string
  moneyness: string
  spot: number
  vix: number
  vix_label: string
  vix_note: string
  dte: number
  theta_note: string
  gamma_note: string
  delta?: number
  gamma?: number
  theta?: number
  vega?: number
  // Chart context
  candle_pattern?: string
  candle_signal?: string
  candle_desc?: string
  candle_open?: number
  candle_high?: number
  candle_low?: number
  candle_close?: number
  candle_change?: number
  trend?: string
  trend_signal?: string
  trend_note?: string
  ema5?: number
  ema20?: number
  prev_high?: number
  prev_low?: number
  key_level?: string
  day_of_week?: string
  day_note?: string
}

export async function getTradeMarketContext(tradeId: string): Promise<MarketContext> {
  const { data } = await api.get<MarketContext>(`/trades/${tradeId}/market-context`)
  return data
}

export async function getTradeAutopsy(tradeId: string): Promise<string> {
  const { data } = await api.get<{ autopsy: string }>(`/trades/${tradeId}/autopsy`)
  return data.autopsy
}

export interface SwingContext {
  symbol: string
  trade_date: string
  curr_price: number
  entry_price: number | null
  entry_note: string | null
  ema20: number
  ema50: number | null
  ema200: number | null
  high52: number
  low52: number
  pct_in_range: number
  pct_from_52h: number
  trend: string
  trend_signal: string
  trend_note: string
  prev_high: number | null
  prev_low: number | null
  candle_pattern: string | null
  candle_signal: string | null
  candle_desc: string | null
  candle_open: number | null
  candle_high: number | null
  candle_low: number | null
  candle_close: number | null
  candle_change: number | null
  vix: number | null
  vix_label: string | null
  vix_note: string | null
  nifty: number | null
  nifty_trend: string | null
}

export async function getSwingContext(tradeId: string): Promise<SwingContext> {
  const { data } = await api.get<SwingContext>(`/trades/${tradeId}/swing-context`)
  return data
}

export async function generateTradeCoaching(tradeId: string): Promise<string> {
  const { data } = await api.post<{ feedback: string }>(`/trades/${tradeId}/generate-coaching`)
  return data.feedback
}

export interface TradeFundamentals {
  name?: string | null
  sector?: string | null
  industry?: string | null
  market_cap?: number | null
  cap_label?: string | null
  pe?: number | null
  forward_pe?: number | null
  pb?: number | null
  ev_ebitda?: number | null
  eps?: number | null
  eps_growth?: number | null
  rev_growth?: number | null
  roe?: number | null
  roa?: number | null
  debt_equity?: number | null
  div_yield?: number | null
  beta?: number | null
  w52_high?: number | null
  w52_low?: number | null
}

export async function getTradeFundamentals(tradeId: string): Promise<TradeFundamentals> {
  const { data } = await api.get<TradeFundamentals>(`/trades/${tradeId}/fundamentals`)
  return data
}

export interface TradeBucketStat {
  wins: number
  total: number
  win_rate: number
  avg_pnl: number
  total_pnl: number
}

export interface RevengeTradingStat {
  total_post_loss_trades: number
  loss_count: number
  loss_rate: number
  avg_pnl: number
  total_damage: number
  is_problem: boolean
}

export interface IntradayPatterns {
  overtrading: Record<string, TradeBucketStat>
  best_bucket: string | null
  worst_bucket: string | null
  revenge_trading: RevengeTradingStat | null
  best_underlying: Record<string, TradeBucketStat>
  total_intraday_trades: number
  total_trading_days: number
}

export async function getIntradayPatterns(): Promise<IntradayPatterns> {
  const { data } = await api.get<IntradayPatterns>("/trades/patterns/intraday")
  return data
}

export interface DayStat {
  wins: number
  total: number
  win_rate: number
  avg_pnl: number
  total_pnl: number
}

export interface ExpiryStats {
  day_stats: Record<string, DayStat>
  thursday_by_week: Record<string, DayStat>
  total_options_trades: number
  best_day: string | null
  worst_day: string | null
}

export async function getExpiryStats(): Promise<ExpiryStats> {
  const { data } = await api.get<ExpiryStats>("/trades/patterns/expiry")
  return data
}

export interface StrikeTypeStat {
  wins: number
  total: number
  win_rate: number
  avg_pnl: number
  total_pnl: number
}

export interface OptionsDepthStats {
  strike_stats: Record<string, StrikeTypeStat>
  hold_time_stats: Record<string, StrikeTypeStat>
  total_options_trades: number
}

export async function getOptionsDepthStats(): Promise<OptionsDepthStats> {
  const { data } = await api.get<OptionsDepthStats>("/trades/patterns/options-depth")
  return data
}

export interface PatternInsight {
  type: string
  icon: string
  severity: "positive" | "warning" | "neutral"
  title: string
  body: string
}

export interface PatternInsightsResponse {
  insights: PatternInsight[]
  total_trades: number
  ready: boolean
}

export interface UsageInfo {
  ai_analyses_used: number
  ai_analyses_limit: number
  is_pro: boolean
  can_generate: boolean
}

export async function getUsage(): Promise<UsageInfo> {
  const { data } = await api.get<UsageInfo>("/trades/usage")
  return data
}

export async function getPatternInsights(): Promise<PatternInsightsResponse> {
  const { data } = await api.get<PatternInsightsResponse>("/trades/patterns/insights")
  return data
}

export interface ImportResult {
  imported: number
  open_positions: number
  closed_trades: number
  broker: string
  trades: Trade[]
}

export async function importTrades(file: File, broker: string): Promise<ImportResult> {
  const form = new FormData()
  form.append("file", file)
  form.append("broker", broker)
  const { data } = await api.post<ImportResult>("/trades/import", form, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return data
}

// ── Payments ──────────────────────────────────────────────────────────────────

export interface RazorpayOrder {
  order_id: string
  amount: number
  currency: string
  key_id: string
}

export async function createPaymentOrder(plan: "monthly" | "yearly"): Promise<RazorpayOrder> {
  const { data } = await api.post<RazorpayOrder>("/payments/create-order", { plan })
  return data
}

export async function verifyPayment(payload: {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
  plan: "monthly" | "yearly"
}): Promise<{ success: boolean; is_pro: boolean }> {
  const { data } = await api.post("/payments/verify", payload)
  return data
}

export async function getProStatus(): Promise<{ is_pro: boolean; pro_plan: string | null }> {
  const { data } = await api.get("/payments/status")
  return data
}
