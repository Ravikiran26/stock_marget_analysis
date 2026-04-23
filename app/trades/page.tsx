"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { fetchMyTrades, getTradeMarketContext, getTradeAutopsy, getSwingContext, generateTradeCoaching, getTradeFundamentals, setUserId, Trade, MarketContext, SwingContext, TradeFundamentals } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import UpgradeButton from "@/components/UpgradeButton"

type Filter = "all" | "profit" | "loss" | "options" | "equity" | "swing"

function fmt(n?: number | null) {
  if (n == null) return "—"
  return `₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(d?: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,3}[^\n]*/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .trim()
}

// ── Setup quality score ────────────────────────────────────────────────────────

function getSetupScore(ctx: MarketContext) {
  let score = 0
  const factors: string[] = []

  if (ctx.vix > 25)      { score -= 2; factors.push("High VIX inflates premiums") }
  else if (ctx.vix > 20) { score -= 1; factors.push("Elevated volatility") }
  else                   { score += 1; factors.push("Low/normal volatility") }

  if (ctx.dte === 0)     { score -= 3; factors.push("Expiry day — max theta risk") }
  else if (ctx.dte <= 2) { score -= 2; factors.push("Near expiry — theta danger zone") }
  else if (ctx.dte <= 5) { score -= 1; factors.push(`${ctx.dte}d to expiry`) }
  else                   { score += 1; factors.push(`${ctx.dte}d to expiry — time on your side`) }

  if (ctx.moneyness === "OTM")      { score -= 1; factors.push("OTM — needs big directional move") }
  else if (ctx.moneyness === "ITM") { score += 1; factors.push("ITM — strong directional exposure") }
  else                              { score += 1; factors.push("ATM — balanced risk/reward") }

  if (score >= 2)  return { label: "Favorable",   color: "green",  score }
  if (score >= 0)  return { label: "Neutral",      color: "amber",  score }
  if (score >= -2) return { label: "Challenging",  color: "orange", score }
  return           { label: "High Risk",           color: "red",    score }
}

// ── Market Pulse Card ─────────────────────────────────────────────────────────

function MarketContextCard({ ctx }: { ctx: MarketContext }) {
  const vixPct = Math.min((ctx.vix / 40) * 100, 96)
  const thetaAbs = Math.abs(ctx.theta ?? 0)
  const totalDecay = ctx.dte > 0 ? thetaAbs * ctx.dte : thetaAbs

  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
      {/* VIX section */}
      <div className="px-5 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">India VIX</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-slate-900">{ctx.vix}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                ctx.vix > 25 ? "bg-red-100 text-red-600" :
                ctx.vix > 20 ? "bg-amber-100 text-amber-600" :
                "bg-emerald-100 text-emerald-600"
              }`}>{ctx.vix_label}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">DTE</p>
            <p className="text-2xl font-extrabold text-slate-900">{ctx.dte}<span className="text-sm font-normal text-slate-400 ml-0.5">d</span></p>
          </div>
        </div>
        {/* Gauge */}
        <div className="relative h-2 rounded-full overflow-hidden bg-gradient-to-r from-emerald-400 via-yellow-400 to-red-500">
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-4 bg-white rounded-full shadow-lg ring-1 ring-slate-300"
            style={{ left: `calc(${vixPct}% - 5px)` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          {["10 Low", "20 Normal", "30 High", "40 Extreme"].map((l) => (
            <span key={l} className="text-[9px] text-slate-300">{l}</span>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">{ctx.vix_note}</p>
      </div>

      {/* Greeks + position row */}
      <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100">
        {[
          { label: "Δ Delta",  value: ctx.delta?.toFixed(2) ?? "—",  color: "text-blue-600"   },
          { label: "Γ Gamma",  value: ctx.gamma?.toFixed(3) ?? "—",  color: "text-violet-600" },
          { label: "Θ Theta",  value: ctx.theta != null ? `-₹${thetaAbs.toFixed(1)}` : "—", color: "text-red-500" },
          { label: "V Vega",   value: ctx.vega?.toFixed(2) ?? "—",   color: "text-amber-600"  },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex flex-col items-center py-3 px-1">
            <span className="text-[9px] font-semibold text-slate-400 mb-1">{label}</span>
            <span className={`text-sm font-bold ${color}`}>{value}</span>
          </div>
        ))}
      </div>

      {/* Theta decay impact */}
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Theta Bleeding</p>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-red-600">₹{thetaAbs.toFixed(1)}</span>
            <span className="text-xs text-slate-400">/ day</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{ctx.theta_note}</p>
        </div>
        {ctx.dte > 0 && (
          <div className="flex-shrink-0 text-center bg-red-50 rounded-xl px-4 py-2.5 border border-red-100">
            <p className="text-[10px] text-red-400 font-semibold uppercase tracking-wide">Total risk</p>
            <p className="text-xl font-extrabold text-red-600 mt-0.5">₹{totalDecay.toFixed(0)}</p>
            <p className="text-[10px] text-red-400 mt-0.5">over {ctx.dte}d</p>
          </div>
        )}
      </div>

      {/* Position strip */}
      <div className="px-5 py-3 bg-slate-50 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{ctx.underlying}</span> spot ₹{ctx.spot.toLocaleString("en-IN")}
        </span>
        <span className="text-slate-300 text-sm">·</span>
        <span className="text-xs text-slate-500">
          Strike <span className="font-semibold text-slate-700">{ctx.strike} {ctx.opt_type}</span>
        </span>
        <span className="text-slate-300 text-sm">·</span>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
          ctx.moneyness === "ITM" ? "bg-emerald-100 text-emerald-700" :
          ctx.moneyness === "OTM" ? "bg-red-100 text-red-600" :
          "bg-blue-100 text-blue-600"
        }`}>{ctx.moneyness}</span>
      </div>
    </div>
  )
}

// ── Chart Context Card ────────────────────────────────────────────────────────

const SIGNAL_STYLES = {
  bullish: { bg: "bg-emerald-50", border: "border-l-emerald-500", badge: "bg-emerald-500 text-white", text: "text-emerald-700", icon: "▲" },
  bearish: { bg: "bg-red-50",     border: "border-l-red-500",     badge: "bg-red-500 text-white",     text: "text-red-700",     icon: "▼" },
  neutral: { bg: "bg-slate-50",   border: "border-l-slate-400",   badge: "bg-slate-500 text-white",   text: "text-slate-600",   icon: "◆" },
}

function ChartContextCard({ ctx }: { ctx: MarketContext }) {
  if (!ctx.candle_pattern) return null

  const sig      = (ctx.candle_signal ?? "neutral") as keyof typeof SIGNAL_STYLES
  const style    = SIGNAL_STYLES[sig] ?? SIGNAL_STYLES.neutral
  const trendSig = (ctx.trend_signal ?? "neutral") as keyof typeof SIGNAL_STYLES
  const trendStyle = SIGNAL_STYLES[trendSig] ?? SIGNAL_STYLES.neutral

  const changePositive = (ctx.candle_change ?? 0) >= 0

  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">

      {/* OHLC header row */}
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-4">
          {[
            { l: "O", v: ctx.candle_open },
            { l: "H", v: ctx.candle_high },
            { l: "L", v: ctx.candle_low },
            { l: "C", v: ctx.candle_close },
          ].map(({ l, v }) => (
            <div key={l}>
              <span className="text-[9px] font-bold text-slate-400 block uppercase">{l}</span>
              <span className="text-sm font-semibold text-slate-700">{v != null ? v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400">{ctx.day_of_week}</span>
          <span className={`text-sm font-bold ${changePositive ? "text-emerald-600" : "text-red-500"}`}>
            {changePositive ? "+" : ""}{ctx.candle_change}%
          </span>
        </div>
      </div>

      {/* Candle pattern */}
      <div className={`px-5 py-3 border-b border-slate-100 border-l-4 ${style.border} ${style.bg}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.badge}`}>
            {style.icon} {ctx.candle_pattern}
          </span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">{ctx.candle_desc}</p>
      </div>

      {/* Trend */}
      <div className="px-5 py-3 border-b border-slate-100">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Trend</p>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
            trendSig === "bullish" ? "bg-emerald-100 text-emerald-700" :
            trendSig === "bearish" ? "bg-red-100 text-red-700" :
            "bg-slate-100 text-slate-600"
          }`}>{ctx.trend}</span>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">{ctx.trend_note}</p>
        <div className="flex gap-4 mt-2">
          <span className="text-[10px] text-slate-400">EMA-5 <span className="font-bold text-slate-600">{ctx.ema5?.toLocaleString("en-IN")}</span></span>
          <span className="text-[10px] text-slate-400">EMA-20 <span className="font-bold text-slate-600">{ctx.ema20?.toLocaleString("en-IN")}</span></span>
        </div>
      </div>

      {/* Key level + day note */}
      {(ctx.key_level || ctx.day_note) && (
        <div className="px-5 py-3 bg-amber-50 space-y-1.5">
          {ctx.key_level && (
            <div className="flex items-start gap-2">
              <span className="text-xs mt-0.5">📍</span>
              <p className="text-xs font-semibold text-amber-800">{ctx.key_level}</p>
            </div>
          )}
          {ctx.day_note && (
            <div className="flex items-start gap-2">
              <span className="text-xs mt-0.5">🗓️</span>
              <p className="text-xs text-amber-700">{ctx.day_note}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Swing Context Card ────────────────────────────────────────────────────────

function SwingContextCard({ ctx }: { ctx: SwingContext }) {
  const trendSig   = (ctx.trend_signal ?? "neutral") as keyof typeof SIGNAL_STYLES
  const trendStyle = SIGNAL_STYLES[trendSig] ?? SIGNAL_STYLES.neutral
  const candleSig  = (ctx.candle_signal ?? "neutral") as keyof typeof SIGNAL_STYLES
  const candleStyle = SIGNAL_STYLES[candleSig] ?? SIGNAL_STYLES.neutral

  // 52-week range bar position
  const rangePos = Math.max(0, Math.min(100, ctx.pct_in_range))

  const emas = [
    { label: "EMA-20",  value: ctx.ema20,  above: ctx.curr_price > ctx.ema20 },
    { label: "EMA-50",  value: ctx.ema50,  above: ctx.ema50  != null && ctx.curr_price > ctx.ema50  },
    { label: "EMA-200", value: ctx.ema200, above: ctx.ema200 != null && ctx.curr_price > ctx.ema200 },
  ].filter((e) => e.value != null)

  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">

      {/* Header: symbol price + NIFTY/VIX strip */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Price at Entry</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">
              ₹{(ctx.entry_price ?? ctx.curr_price).toLocaleString("en-IN")}
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              trendSig === "bullish" ? "bg-emerald-100 text-emerald-700" :
              trendSig === "bearish" ? "bg-red-100 text-red-700" :
              "bg-slate-100 text-slate-600"
            }`}>{ctx.trend}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-right">
          {ctx.vix != null && (
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-400">India VIX</p>
              <p className={`text-base font-extrabold ${
                ctx.vix > 25 ? "text-red-600" : ctx.vix > 20 ? "text-amber-600" : "text-emerald-600"
              }`}>{ctx.vix}</p>
              <p className="text-[9px] text-slate-400">{ctx.vix_label}</p>
            </div>
          )}
          {ctx.nifty != null && (
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-400">NIFTY</p>
              <p className="text-base font-extrabold text-slate-800">{ctx.nifty.toLocaleString("en-IN")}</p>
              <p className={`text-[9px] font-semibold ${ctx.nifty_trend === "Uptrend" ? "text-emerald-600" : "text-red-500"}`}>
                {ctx.nifty_trend ?? "—"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Moving averages */}
      <div className="px-5 py-3 border-b border-slate-100">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Price vs Moving Averages</p>
        <div className="space-y-2">
          {emas.map(({ label, value, above }) => (
            <div key={label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${above ? "bg-emerald-500" : "bg-red-400"}`} />
                <span className="text-xs font-medium text-slate-500">{label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">₹{value!.toLocaleString("en-IN")}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                  above ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                }`}>{above ? "ABOVE" : "BELOW"}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">{ctx.trend_note}</p>
      </div>

      {/* 52-week range bar */}
      <div className="px-5 py-3 border-b border-slate-100">
        <div className="flex justify-between text-[9px] font-bold text-slate-400 mb-1.5">
          <span>52W Low ₹{ctx.low52.toLocaleString("en-IN")}</span>
          <span>52W High ₹{ctx.high52.toLocaleString("en-IN")}</span>
        </div>
        <div className="relative h-2 rounded-full bg-gradient-to-r from-red-400 via-amber-300 to-emerald-400 overflow-visible">
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-4 bg-white rounded-full shadow-lg ring-2 ring-slate-400"
            style={{ left: `calc(${rangePos}% - 6px)` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-[10px] text-slate-400">{rangePos.toFixed(0)}% of annual range</span>
          <span className={`text-[10px] font-bold ${ctx.pct_from_52h >= -5 ? "text-emerald-600" : ctx.pct_from_52h >= -20 ? "text-amber-600" : "text-red-500"}`}>
            {ctx.pct_from_52h}% from 52W high
          </span>
        </div>
      </div>

      {/* Candle pattern on entry day */}
      {ctx.candle_pattern && (
        <div className={`px-5 py-3 border-b border-slate-100 border-l-4 ${candleStyle.border} ${candleStyle.bg}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${candleStyle.badge}`}>
              {candleStyle.icon} {ctx.candle_pattern}
            </span>
            {ctx.candle_change != null && (
              <span className={`text-xs font-bold ml-auto ${(ctx.candle_change ?? 0) >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {(ctx.candle_change ?? 0) >= 0 ? "+" : ""}{ctx.candle_change}%
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">{ctx.candle_desc}</p>
        </div>
      )}

      {/* Entry quality note */}
      {ctx.entry_note && (
        <div className="px-5 py-3 bg-blue-50 flex items-start gap-2">
          <span className="text-sm mt-0.5">💡</span>
          <p className="text-xs text-blue-700 leading-relaxed font-medium">{ctx.entry_note}</p>
        </div>
      )}

      {/* Support/resistance levels */}
      {(ctx.prev_high || ctx.prev_low) && (
        <div className="px-5 py-3 bg-slate-50 flex gap-4">
          {ctx.prev_high && (
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-400">Prev Day High</p>
              <p className="text-sm font-bold text-slate-700">₹{ctx.prev_high.toLocaleString("en-IN")}</p>
            </div>
          )}
          {ctx.prev_low && (
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-400">Prev Day Low</p>
              <p className="text-sm font-bold text-slate-700">₹{ctx.prev_low.toLocaleString("en-IN")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}


// ── AI Feedback Drawer ────────────────────────────────────────────────────────

const ACCENT_COLORS = [
  { border: "border-l-blue-500",   num: "bg-blue-600",   title: "text-blue-700"   },
  { border: "border-l-violet-500", num: "bg-violet-600", title: "text-violet-700" },
  { border: "border-l-emerald-500",num: "bg-emerald-600",title: "text-emerald-700"},
  { border: "border-l-amber-500",  num: "bg-amber-500",  title: "text-amber-700"  },
]

const SETUP_STYLES = {
  Favorable:   { bar: "bg-emerald-500", pill: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", vixBar: "bg-emerald-500" },
  Neutral:     { bar: "bg-amber-400",   pill: "bg-amber-500/20  text-amber-300  border-amber-500/30",  vixBar: "bg-amber-400"   },
  Challenging: { bar: "bg-orange-500",  pill: "bg-orange-500/20 text-orange-300 border-orange-500/30", vixBar: "bg-orange-500"  },
  "High Risk": { bar: "bg-red-500",     pill: "bg-red-500/20    text-red-300    border-red-500/30",    vixBar: "bg-red-500"     },
}

function SectionLabel({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 px-1 mb-2">
      <span className="text-sm">{icon}</span>
      <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{title}</span>
      {sub && <span className="text-xs text-slate-400">· {sub}</span>}
    </div>
  )
}

function FundamentalsCard({ f }: { f: TradeFundamentals }) {
  function fmtCap(v?: number | null) {
    if (!v) return "—"
    if (v >= 1e12) return `₹${(v / 1e12).toFixed(1)}L Cr`
    if (v >= 1e9)  return `₹${(v / 1e9).toFixed(0)} Cr`
    return `₹${(v / 1e7).toFixed(0)} Cr`
  }
  function fmtPct(v?: number | null) {
    return v != null ? `${v > 0 ? "+" : ""}${v.toFixed(1)}%` : "—"
  }
  function fmtNum(v?: number | null, suffix = "") {
    return v != null ? `${v}${suffix}` : "—"
  }

  const peColor = !f.pe ? "text-slate-500" : f.pe > 40 ? "text-red-600" : f.pe > 20 ? "text-amber-600" : "text-emerald-600"
  const deColor = !f.debt_equity ? "text-slate-500" : f.debt_equity > 1.5 ? "text-red-600" : f.debt_equity > 0.5 ? "text-amber-600" : "text-emerald-600"
  const roeColor = !f.roe ? "text-slate-500" : f.roe > 15 ? "text-emerald-600" : f.roe > 8 ? "text-amber-600" : "text-red-500"
  const growthColor = (v?: number | null) => !v ? "text-slate-500" : v > 10 ? "text-emerald-600" : v > 0 ? "text-amber-600" : "text-red-500"

  const rows = [
    { label: "Market Cap",     value: fmtCap(f.market_cap),           sub: f.cap_label,   color: "text-slate-700" },
    { label: "P/E (TTM)",      value: fmtNum(f.pe, "x"),              sub: f.forward_pe ? `Fwd ${f.forward_pe}x` : undefined, color: peColor },
    { label: "P/B Ratio",      value: fmtNum(f.pb, "x"),              sub: undefined,     color: "text-slate-700" },
    { label: "EV/EBITDA",      value: fmtNum(f.ev_ebitda, "x"),       sub: undefined,     color: "text-slate-700" },
    { label: "EPS (TTM)",      value: f.eps != null ? `₹${f.eps}` : "—", sub: f.eps_growth != null ? `Growth ${fmtPct(f.eps_growth)}` : undefined, color: growthColor(f.eps_growth) },
    { label: "Revenue Growth", value: fmtPct(f.rev_growth),           sub: "YoY",         color: growthColor(f.rev_growth) },
    { label: "ROE",            value: fmtPct(f.roe),                  sub: undefined,     color: roeColor },
    { label: "Debt / Equity",  value: fmtNum(f.debt_equity, "x"),     sub: undefined,     color: deColor },
    { label: "Beta",           value: fmtNum(f.beta),                 sub: f.beta != null ? (f.beta > 1.2 ? "High volatility" : f.beta < 0.8 ? "Low volatility" : "Market-like") : undefined, color: "text-slate-700" },
    { label: "Dividend Yield", value: fmtPct(f.div_yield),            sub: undefined,     color: "text-slate-700" },
  ]

  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
      {f.name && (
        <div className="px-4 pt-3 pb-2 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-500">{f.name}</p>
          {(f.sector || f.industry) && (
            <p className="text-[11px] text-slate-400 mt-0.5">{[f.sector, f.industry].filter(Boolean).join(" · ")}</p>
          )}
        </div>
      )}
      <div className="divide-y divide-slate-50">
        {rows.map(({ label, value, sub, color }) => (
          <div key={label} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-xs text-slate-500">{label}</span>
            <div className="text-right">
              <span className={`text-sm font-bold tabular-nums ${color}`}>{value}</span>
              {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FeedbackDrawer({ trade, onClose, onTradeUpdated }: { trade: Trade; onClose: () => void; onTradeUpdated?: (updated: Trade) => void }) {
  const isProfit = (trade.pnl ?? 0) >= 0
  const [mktCtx, setMktCtx] = useState<MarketContext | null>(null)
  const [autopsy, setAutopsy] = useState<string | null>(null)
  const [autopsyLoading, setAutopsyLoading] = useState(false)
  const [autopsyError, setAutopsyError] = useState<string | null>(null)
  const [coachingLoading, setCoachingLoading] = useState(false)
  const [generatedFeedback, setGeneratedFeedback] = useState<string | null>(null)
  const [upgradeRequired, setUpgradeRequired] = useState(false)
  const [mktLoading, setMktLoading] = useState(false)

  const [swingCtx, setSwingCtx] = useState<SwingContext | null>(null)
  const [swingLoading, setSwingLoading] = useState(false)
  const [fundamentals, setFundamentals] = useState<TradeFundamentals | null>(null)

  useEffect(() => {
    if (!trade.id || trade.instrument_type !== "options") return
    setMktLoading(true)
    getTradeMarketContext(trade.id)
      .then(setMktCtx)
      .catch(() => setMktCtx(null))
      .finally(() => setMktLoading(false))
  }, [trade.id, trade.instrument_type])

  useEffect(() => {
    const isSwing = trade.instrument_type === "equity" || trade.instrument_type === "futures"
    if (!trade.id || !isSwing) return
    setSwingLoading(true)
    getSwingContext(trade.id)
      .then(setSwingCtx)
      .catch(() => setSwingCtx(null))
      .finally(() => setSwingLoading(false))
    // Fetch fundamentals in parallel
    getTradeFundamentals(trade.id)
      .then(setFundamentals)
      .catch(() => setFundamentals(null))
  }, [trade.id, trade.instrument_type])

  // Auto-generate coaching on open:
  // - Always regenerate for open positions (live price/EMA data changes daily)
  // - Generate once for closed trades that have no coaching yet
  useEffect(() => {
    if (!trade.id || coachingLoading) return
    const isOpen = trade.status === "open"
    if (!isOpen && trade.ai_feedback) return  // closed + already has coaching → skip
    handleGenerateCoaching()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trade.id])

  async function handleGenerateCoaching() {
    if (!trade.id || coachingLoading) return
    setCoachingLoading(true)
    setUpgradeRequired(false)
    try {
      const feedback = await generateTradeCoaching(trade.id)
      setGeneratedFeedback(feedback)
      onTradeUpdated?.({ ...trade, ai_feedback: feedback })
    } catch (err: unknown) {
      // Check for 402 upgrade required
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 402) {
        setUpgradeRequired(true)
      }
      // other errors fail silently
    } finally {
      setCoachingLoading(false)
    }
  }

  async function handleAutopsy() {
    if (!trade.id || autopsyLoading) return
    setAutopsyLoading(true)
    setAutopsyError(null)
    try {
      const result = await getTradeAutopsy(trade.id)
      setAutopsy(result)
    } catch {
      setAutopsyError("Autopsy failed. Please try again.")
    } finally {
      setAutopsyLoading(false)
    }
  }

  // Parse autopsy lines (📍 🚪 ⚙️ 🛡️ for loss / 📈 ⏰ 💰 ⚡ for profit)
  // Use \S+ for icon to handle multi-codepoint emoji like ⚙️ 🛡️
  const autopsyItems: { icon: string; label: string; body: string }[] = []
  if (autopsy) {
    autopsy.split("\n").forEach((line) => {
      const clean = line.trim().replace(/^#+\s*/, "").replace(/\*\*/g, "")
      // Match: <icon(s)> <Label text>: <body>
      const m = clean.match(/^(\S+)\s+([A-Za-z][^:]{1,50}):\s*(.+)$/)
      if (m && !/^\d+$/.test(m[1])) { // exclude numbered list items
        autopsyItems.push({ icon: m[1], label: m[2].trim(), body: m[3].trim() })
      }
    })
  }

  // Use generated feedback as fallback if no stored feedback
  const effectiveFeedback = trade.ai_feedback ?? generatedFeedback ?? ""

  // Parse AI feedback
  const lines = effectiveFeedback.split("\n").map((l) => l.trim()).filter(Boolean)
  const disclaimer = lines.find((l) => l.startsWith("⚠️") || l.toLowerCase().startsWith("not investment advice"))
  const contentLines = lines
    .filter((l) => l !== disclaimer && !l.startsWith("#"))
    .map((l) => l.replace(/\*\*/g, "").replace(/\*/g, "").trim())
    .filter(Boolean)
  const heading = lines.find((l) => l.startsWith("#"))
  const headingText = heading ? heading.replace(/^#{1,3}\s*/, "").replace(/\*\*/g, "").trim() : null
  const isSessionFeedback = headingText?.toLowerCase().includes("session") || headingText?.toLowerCase().includes("trades")

  const insights: { num: string; label: string | null; body: string }[] = []
  const plainLines: string[] = []
  let keyMistake: string | null = null
  let doBetter: string | null = null

  // Multi-line aware parsing:
  // Claude sometimes puts title on one line and body on the next
  let pendingInsight: { num: string; label: string | null; bodyLines: string[] } | null = null

  const flushPending = () => {
    if (pendingInsight) {
      insights.push({
        num: pendingInsight.num,
        label: pendingInsight.label,
        body: pendingInsight.bodyLines.join(" ").trim(),
      })
      pendingInsight = null
    }
  }

  contentLines.forEach((line) => {
    // Skip separator lines
    if (/^-{2,}$/.test(line)) return

    if (line.startsWith("🔴") || /^Key Mistake:/i.test(line)) {
      flushPending()
      keyMistake = line.replace(/^🔴\s*/,"").replace(/^Key Mistake:\s*/i, "").trim()
    } else if (line.startsWith("✅") || /^Do Better:/i.test(line)) {
      flushPending()
      doBetter = line.replace(/^✅\s*/,"").replace(/^Do Better:\s*/i, "").trim()
    } else {
      const m = line.match(/^(\d+)\.\s*(.+)$/)
      if (m) {
        flushPending()
        // Check if body is inline: "1. Title: body text here"
        const labelM = m[2].match(/^([A-Za-z][A-Za-z ]{1,30}):\s*(.+)$/)
        if (labelM) {
          // Inline format — complete insight on one line
          insights.push({ num: m[1], label: labelM[1], body: labelM[2] })
        } else {
          // Title-only line — body may follow on next lines
          pendingInsight = { num: m[1], label: m[2].trim(), bodyLines: [] }
        }
      } else if (pendingInsight) {
        // Continuation line — append to current insight body
        pendingInsight.bodyLines.push(line)
      } else {
        plainLines.push(line)
      }
    }
  })
  flushPending()

  // Setup score for header accent
  const setup = mktCtx ? getSetupScore(mktCtx) : null
  const setupStyle = setup ? SETUP_STYLES[setup.label as keyof typeof SETUP_STYLES] ?? SETUP_STYLES["Neutral"] : null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full w-full max-w-[520px] bg-[#f4f5f7] z-50 shadow-2xl flex flex-col animate-slide-in-right overflow-hidden">

        {/* ── Pinned header ──────────────────────────────────────────── */}
        <div className="relative bg-gradient-to-b from-[#0f1117] to-[#1a1d27] px-6 pt-5 pb-0 overflow-hidden flex-shrink-0">
          {/* Glow */}
          <div className={`absolute -top-10 -right-10 w-52 h-52 rounded-full blur-3xl opacity-15 pointer-events-none ${isProfit ? "bg-emerald-400" : "bg-red-400"}`} />

          {/* Top row */}
          <div className="flex items-start justify-between relative mb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-sm">🤖</div>
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">AI Coach Review</span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center text-slate-400 hover:text-white transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Symbol + date */}
          <h2 className="text-[22px] font-bold text-white leading-tight tracking-tight">{trade.symbol ?? "—"}</h2>
          <p className="text-slate-500 text-xs mt-0.5 mb-3">{fmtDate(trade.trade_date ?? trade.created_at)}</p>

          {/* P&L row */}
          <div className="flex items-baseline gap-2 mb-3">
            {trade.pnl != null ? (
              <>
                <span className={`text-[28px] font-extrabold leading-none ${isProfit ? "text-emerald-400" : "text-red-400"}`}>
                  {isProfit ? "+" : "−"}{fmt(trade.pnl)}
                </span>
                {trade.pnl_percent != null && (
                  <span className={`text-sm font-semibold ${isProfit ? "text-emerald-500" : "text-red-500"}`}>
                    ({isProfit ? "+" : ""}{trade.pnl_percent.toFixed(1)}%)
                  </span>
                )}
              </>
            ) : (
              <span className="text-slate-500 text-sm">Open position</span>
            )}
          </div>

          {/* Badges row */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {trade.broker && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/8 text-slate-300 border border-white/10">{trade.broker}</span>
            )}
            {trade.action && (
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                trade.action.toLowerCase() === "buy"
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25"
                  : "bg-red-500/15 text-red-300 border-red-500/25"
              }`}>{trade.action.toUpperCase()}</span>
            )}
            {trade.entry_price != null && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] text-slate-400 bg-white/5 border border-white/8">
                ₹{trade.entry_price.toLocaleString("en-IN")} → ₹{trade.exit_price?.toLocaleString("en-IN") ?? "open"}
              </span>
            )}
            {setup && setupStyle && (
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${setupStyle.pill}`}>
                {setup.label}
              </span>
            )}
          </div>

          {/* Setup quality accent bar */}
          <div className="h-[3px] mx-[-24px] relative">
            {setupStyle ? (
              <div className={`absolute inset-0 ${setupStyle.bar}`} />
            ) : (
              <div className="absolute inset-0 bg-white/5" />
            )}
          </div>
        </div>

        {/* ── Scrollable body ──────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">

          {/* ── Market Conditions at Entry (options only) ── */}
          {trade.instrument_type === "options" && (
            mktLoading ? (
              <div>
                <SectionLabel icon="📡" title="Market at Entry" />
                <div className="rounded-2xl bg-white border border-slate-200 px-5 py-6 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full border-[2.5px] border-slate-200 border-t-blue-500 animate-spin flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Pulling VIX &amp; Greeks…</p>
                    <p className="text-xs text-slate-400 mt-0.5">for {fmtDate(trade.trade_date)}</p>
                  </div>
                </div>
              </div>
            ) : mktCtx ? (
              <div className="space-y-3">
                <SectionLabel icon="📡" title="Market at Entry" sub={`VIX ${mktCtx.vix} · ${mktCtx.vix_label}`} />
                <MarketContextCard ctx={mktCtx} />
                <ChartContextCard ctx={mktCtx} />
              </div>
            ) : null
          )}

          {/* ── Entry Analysis (equity/futures swing only) ── */}
          {(trade.instrument_type === "equity" || trade.instrument_type === "futures") && (
            swingLoading ? (
              <div>
                <SectionLabel icon="📈" title="Entry Analysis" />
                <div className="rounded-2xl bg-white border border-slate-200 px-5 py-6 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full border-[2.5px] border-slate-200 border-t-emerald-500 animate-spin flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Fetching chart data…</p>
                    <p className="text-xs text-slate-400 mt-0.5">EMAs · 52W range · candle for {trade.symbol}</p>
                  </div>
                </div>
              </div>
            ) : swingCtx ? (
              <div className="space-y-3">
                <SectionLabel icon="📈" title="Entry Analysis" sub={`${swingCtx.trend} · VIX ${swingCtx.vix ?? "—"}`} />
                <SwingContextCard ctx={swingCtx} />
              </div>
            ) : null
          )}

          {/* ── Fundamentals (equity/futures only) ── */}
          {(trade.instrument_type === "equity" || trade.instrument_type === "futures") && fundamentals && (
            <div className="space-y-3">
              <SectionLabel icon="🏦" title="Fundamentals" sub={fundamentals.cap_label ?? undefined} />
              <FundamentalsCard f={fundamentals} />
            </div>
          )}

          {/* ── AI Coaching ── */}
          {upgradeRequired ? (
            <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center text-2xl mx-auto mb-3">🧠</div>
              <p className="text-sm font-bold text-violet-900 mb-1">Upgrade to Pro for unlimited AI coaching</p>
              <p className="text-xs text-violet-600 mb-4 leading-relaxed">
                You&apos;ve used all 10 free analyses. Journaling, dashboards and all pattern analysis remain free forever.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap mb-4">
                <div className="text-center">
                  <p className="text-2xl font-black text-violet-700">₹499<span className="text-sm font-normal text-violet-400">/mo</span></p>
                  <p className="text-[10px] text-violet-400">billed monthly</p>
                </div>
                <div className="text-violet-300 font-light text-lg">or</div>
                <div className="text-center">
                  <p className="text-2xl font-black text-violet-700">₹3,499<span className="text-sm font-normal text-violet-400">/yr</span></p>
                  <p className="text-[10px] text-emerald-500 font-semibold">Save ₹2,489 · ₹292/mo</p>
                </div>
              </div>
              <UpgradeButton plan="monthly" className="w-full rounded-xl py-3 text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 transition-opacity shadow-sm shadow-violet-200" onSuccess={() => setUpgradeRequired(false)}>
                Upgrade to Pro — ₹499/mo →
              </UpgradeButton>
              <p className="text-[10px] text-violet-400 mt-2">Cancel anytime · Instant access</p>
            </div>
          ) : (!effectiveFeedback || coachingLoading) && coachingLoading ? (
            <div className="rounded-2xl bg-white border border-slate-200 px-5 py-6 flex items-center gap-4">
              <div className="w-8 h-8 rounded-full border-[2.5px] border-slate-200 border-t-blue-500 animate-spin flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-slate-700">Analysing trade…</p>
                <p className="text-xs text-slate-400 mt-0.5">Fetching live price · EMAs · market context for {trade.symbol}</p>
              </div>
            </div>
          ) : !effectiveFeedback ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-slate-400">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl">💭</div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-600">Coaching unavailable</p>
                <p className="text-xs text-slate-400 mt-1">Tap below to retry</p>
              </div>
              <button
                onClick={handleGenerateCoaching}
                className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 text-sm font-semibold transition-colors"
              >
                🤖 Generate AI Coaching
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <SectionLabel icon="🎯" title={isSessionFeedback ? "Session Coaching" : "Trade Coaching"} />
                {trade.status === "open" && (
                  <button
                    onClick={handleGenerateCoaching}
                    disabled={coachingLoading}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-40"
                    title="Refresh with today's live data"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </button>
                )}
              </div>

              {/* Session context banner */}
              {isSessionFeedback && headingText && (
                <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-2.5 flex items-center gap-2">
                  <span className="text-sm">📊</span>
                  <p className="text-xs text-blue-700 font-medium">{headingText}</p>
                </div>
              )}

              {/* Intro lines */}
              {plainLines.map((line, i) => (
                <p key={i} className="text-sm text-slate-500 px-1 leading-relaxed">{line}</p>
              ))}

              {/* Insight cards */}
              <div className="space-y-2.5">
                {insights.map(({ num, label, body }, i) => {
                  const c = ACCENT_COLORS[i % ACCENT_COLORS.length]
                  return (
                    <div key={i} className={`bg-white rounded-2xl border border-slate-100 border-l-4 ${c.border} px-4 py-4 shadow-sm`}>
                      <div className="flex items-start gap-3">
                        <span className={`flex-shrink-0 w-6 h-6 rounded-lg ${c.num} text-white text-[11px] font-bold flex items-center justify-center mt-0.5`}>
                          {num}
                        </span>
                        <div className="flex-1 min-w-0">
                          {label && (
                            <p className={`text-sm font-bold ${c.title} mb-1`}>{label}</p>
                          )}
                          <p className="text-sm text-slate-600 leading-relaxed">{body}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Key Mistake + Do Better cards */}
              {(keyMistake || doBetter) && (
                <div className="space-y-2 pt-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">Lesson from this trade</p>
                  {keyMistake && (
                    <div className="bg-red-50 border border-red-100 border-l-4 border-l-red-400 rounded-2xl px-4 py-3.5 flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-red-400 text-white text-xs font-bold flex items-center justify-center mt-0.5">✕</span>
                      <div>
                        <p className="text-xs font-bold text-red-600 mb-0.5">Key Mistake</p>
                        <p className="text-sm text-red-700 leading-relaxed">{keyMistake}</p>
                      </div>
                    </div>
                  )}
                  {doBetter && (
                    <div className="bg-emerald-50 border border-emerald-100 border-l-4 border-l-emerald-400 rounded-2xl px-4 py-3.5 flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-emerald-400 text-white text-xs font-bold flex items-center justify-center mt-0.5">↑</span>
                      <div>
                        <p className="text-xs font-bold text-emerald-700 mb-0.5">Do Better Next Time</p>
                        <p className="text-sm text-emerald-800 leading-relaxed">{doBetter}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Disclaimer */}
              {disclaimer && (
                <p className="text-[11px] text-slate-400 px-1 pt-1 leading-relaxed">
                  ⚠️ {disclaimer.replace("⚠️", "").trim()}
                </p>
              )}

            </div>
          )}

          {/* ── Trade Autopsy — always shown for closed trades ── */}
          {trade.status !== "open" && (
            <div>
              {!autopsy && !autopsyLoading && (
                <button
                  onClick={handleAutopsy}
                  className={`w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-4 text-sm font-semibold transition-all ${
                    isProfit
                      ? "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                      : "border-red-200 text-red-600 hover:bg-red-50"
                  }`}
                >
                  <span className="text-lg">{isProfit ? "📈" : "🔬"}</span>
                  {isProfit ? "How could I have made more?" : "Why did this trade fail?"}
                </button>
              )}

              {autopsyLoading && (
                <div className="flex items-center justify-center gap-3 py-6 text-slate-400">
                  <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                  <span className="text-sm">Running trade autopsy…</span>
                </div>
              )}

              {autopsyError && (
                <p className="text-xs text-red-500 px-1">{autopsyError}</p>
              )}

              {autopsy && (
                <div className="space-y-2">
                  <SectionLabel icon={isProfit ? "📈" : "🔬"} title={isProfit ? "Profit Autopsy" : "Loss Autopsy"} />
                  {autopsyItems.length > 0 ? (
                    autopsyItems.map(({ icon, label, body }, i) => (
                      <div key={i} className={`rounded-2xl border px-4 py-3.5 flex items-start gap-3 ${
                        isProfit
                          ? "bg-emerald-50/60 border-emerald-100"
                          : "bg-slate-50 border-slate-200"
                      }`}>
                        <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
                        <div>
                          <p className={`text-xs font-bold mb-0.5 ${isProfit ? "text-emerald-700" : "text-slate-600"}`}>{label}</p>
                          <p className="text-sm text-slate-700 leading-relaxed">{body}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    // Fallback: show raw text if emoji parsing fails
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      {autopsy.split("\n").filter(l => l.trim() && !l.startsWith("⚠️")).map((line, i) => (
                        <p key={i} className="text-sm text-slate-700 leading-relaxed mb-1">{line.trim()}</p>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400 px-1">⚠️ Not investment advice.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TradesPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>("all")
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => { document.title = "My Trades | Tradfy" }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace("/"); return }
      setUserId(data.session.user.id)
      setChecking(false)
      loadTrades()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // Close drawer on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setSelectedTrade(null) }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  async function loadTrades() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchMyTrades()
      setTrades(data)
    } catch {
      setError("Could not load trades. Make sure the backend is running.")
    } finally {
      setLoading(false)
    }
  }

  function handleExport() {
    const headers = ["Date", "Symbol", "Type", "Action", "Entry", "Exit", "P&L", "P&L%", "Broker", "Sector", "Status"]
    const rows = filtered.map((t) => [
      t.trade_date ?? "", t.symbol ?? "", t.instrument_type ?? "", t.action ?? "",
      t.entry_price ?? "", t.exit_price ?? "", t.pnl ?? "",
      t.pnl_percent != null ? `${t.pnl_percent.toFixed(1)}%` : "",
      t.broker ?? "", t.sector ?? "", t.status ?? "",
    ])
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n")
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
    a.download = `tradfy_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  const filtered = trades.filter((t) => {
    const q = searchQuery.trim().toLowerCase()
    if (q && !(t.symbol ?? "").toLowerCase().includes(q) && !(t.broker ?? "").toLowerCase().includes(q)) return false
    if (filter === "profit") return (t.pnl ?? 0) > 0
    if (filter === "loss") return (t.pnl ?? 0) < 0
    if (filter === "options") return t.instrument_type === "options"
    if (filter === "equity") return t.instrument_type === "equity"
    if (filter === "swing") return t.trade_type === "equity_swing" || t.trade_type === "futures_swing"
    return true
  })

  if (checking) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Checking session…</div>
  }

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "profit", label: "Profit" },
    { key: "loss", label: "Loss" },
    { key: "options", label: "Options" },
    { key: "equity", label: "Equity" },
    { key: "swing", label: "Swing" },
  ]

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">
        {/* Header */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 px-6 py-5 shadow-lg">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">My Trades</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                {trades.length} trade{trades.length !== 1 ? "s" : ""} logged
                {searchQuery && filtered.length !== trades.length && (
                  <span className="text-slate-500"> · {filtered.length} matching</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {filtered.length > 0 && (
                <button
                  onClick={handleExport}
                  className="flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 text-sm font-medium transition-colors backdrop-blur-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export CSV
                </button>
              )}
              <a
                href="/upload"
                className="flex items-center gap-1.5 rounded-xl bg-white hover:bg-blue-50 text-slate-800 px-4 py-2 text-sm font-bold transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Upload Trade
              </a>
            </div>
          </div>
        </div>

        {/* Search + Filter row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search symbol or broker…"
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            )}
          </div>
          {/* Filter pills */}
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors whitespace-nowrap
                ${filter === f.key
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600"
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 flex items-center justify-between">
            ⚠️ {error}
            <button onClick={loadTrades} className="text-blue-600 hover:underline text-xs font-medium">
              Retry
            </button>
          </div>
        )}

        {/* Trade list */}
        {loading ? (
          <SkeletonTable />
        ) : filtered.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <>
          {/* ── Mobile cards (< md) ── */}
          <div className="md:hidden space-y-2.5">
            {filtered.map((t, i) => {
              const isProfit = (t.pnl ?? 0) >= 0
              const isOpen = t.status === "open"
              const isBuy = t.action?.toLowerCase() === "buy"
              const accent = isOpen ? "border-l-amber-400" : isProfit ? "border-l-emerald-400" : "border-l-red-400"
              return (
                <div
                  key={t.id ?? i}
                  onClick={() => setSelectedTrade(t)}
                  className={`bg-white rounded-2xl border border-gray-100 border-l-4 ${accent} p-4 cursor-pointer active:bg-gray-50 shadow-sm`}
                >
                  <div className="flex items-start justify-between mb-2.5">
                    <div>
                      <p className="font-bold text-gray-900 text-base leading-tight">{t.symbol ?? "—"}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {t.instrument_type && <span className="text-[10px] text-gray-400 capitalize">{t.instrument_type}</span>}
                        {t.broker && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">{t.broker}</span>}
                        {t.trade_type && t.trade_type !== "options_intraday" && (
                          <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-md">
                            {t.trade_type === "equity_swing" ? "Swing" : "Futures"}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      {t.pnl != null ? (
                        <>
                          <p className={`font-bold text-base tabular-nums ${isOpen ? "text-amber-600" : isProfit ? "text-emerald-600" : "text-red-600"}`}>
                            {isProfit ? "+" : "−"}₹{Math.abs(t.pnl).toLocaleString("en-IN")}
                          </p>
                          {t.pnl_percent != null && (
                            <p className={`text-xs tabular-nums ${isProfit ? "text-emerald-500" : "text-red-400"}`}>
                              {isProfit ? "+" : ""}{t.pnl_percent.toFixed(1)}%
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-amber-500 font-medium">Open</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isBuy ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-red-50 text-red-700 border border-red-100"}`}>
                        {t.action?.toUpperCase() ?? "—"}
                      </span>
                      {t.entry_price != null && (
                        <span className="text-[11px] text-gray-400">
                          ₹{t.entry_price.toLocaleString("en-IN")} → {t.exit_price ? `₹${t.exit_price.toLocaleString("en-IN")}` : "open"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] text-gray-400">{fmtDate(t.trade_date ?? t.created_at)}</p>
                      {t.ai_feedback && <span className="text-[10px] text-blue-500 font-medium">🤖 AI</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Desktop table (≥ md) ── */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col className="w-[100px]" />
                <col className="w-[220px]" />
                <col className="w-[80px]" />
                <col className="w-[70px]" />
                <col className="w-[80px]" />
                <col className="w-[80px]" />
                <col className="w-[130px]" />
                <col />
              </colgroup>
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Symbol</th>
                  <th className="px-3 py-3 hidden sm:table-cell">Broker</th>
                  <th className="px-3 py-3">Action</th>
                  <th className="px-3 py-3 hidden md:table-cell">Entry</th>
                  <th className="px-3 py-3 hidden md:table-cell">Exit</th>
                  <th className="px-3 py-3">P&L</th>
                  <th className="px-3 py-3 hidden lg:table-cell">AI Insight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((t, i) => {
                  const isProfit = (t.pnl ?? 0) >= 0
                  const isBuy = t.action?.toLowerCase() === "buy"

                  const feedbackPreview = (() => {
                    if (!t.ai_feedback) return null
                    const clean = t.ai_feedback
                      .replace(/#{1,3}[^\n]*/g, "")
                      .replace(/\*\*/g, "")
                      .replace(/\*/g, "")
                    const match = clean.match(/1\.\s*(.+?)(?:\n|$)/)
                    const text = match ? match[1] : clean.trim()
                    return text.slice(0, 80).trim()
                  })()

                  return (
                    <tr
                      key={t.id ?? i}
                      onClick={() => setSelectedTrade(t)}
                      className="hover:bg-blue-50/40 transition-colors bg-white cursor-pointer group"
                    >
                      <td className="px-3 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {fmtDate(t.trade_date ?? t.created_at)}
                      </td>
                      <td className="px-3 py-3 font-semibold text-gray-900">
                        <div className="truncate" title={t.symbol ?? ""}>
                          {t.symbol ?? "—"}
                          {t.instrument_type && (
                            <span className="text-xs text-gray-400 capitalize hidden sm:inline ml-1">
                              ({t.instrument_type})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 hidden sm:table-cell">
                        {t.broker ? (
                          <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 text-xs">
                            {t.broker}
                          </Badge>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {t.action ? (
                          <Badge
                            variant="outline"
                            className={
                              isBuy
                                ? "text-green-700 border-green-200 bg-green-50 text-xs"
                                : "text-red-700 border-red-200 bg-red-50 text-xs"
                            }
                          >
                            {t.action.toUpperCase()}
                          </Badge>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell text-gray-600 text-xs">
                        {t.entry_price != null ? `₹${t.entry_price.toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell text-gray-600 text-xs">
                        {t.exit_price != null ? `₹${t.exit_price.toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className={`font-semibold text-sm ${isProfit ? "text-green-600" : "text-red-600"}`}>
                          {t.pnl != null ? `${isProfit ? "+" : "−"}${fmt(t.pnl)}` : "—"}
                        </span>
                        {t.pnl_percent != null && (
                          <span className={`text-xs ml-1 ${isProfit ? "text-green-500" : "text-red-500"}`}>
                            ({isProfit ? "+" : ""}{t.pnl_percent.toFixed(1)}%)
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 hidden lg:table-cell">
                        {feedbackPreview ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-500 text-xs truncate block">
                              {feedbackPreview}…
                            </span>
                            <span className="flex-shrink-0 text-blue-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                              View →
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* AI Feedback Drawer */}
      {selectedTrade && (
        <FeedbackDrawer
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
          onTradeUpdated={(updated) => {
            setTrades((prev) => prev.map((t) => t.id === updated.id ? updated : t))
            setSelectedTrade(updated)
          }}
        />
      )}

      <style jsx global>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </>
  )
}

function SkeletonTable() {
  return (
    <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="bg-gray-50 h-10" />
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-t border-gray-50 animate-pulse">
          <div className="h-4 bg-gray-100 rounded w-20" />
          <div className="h-4 bg-gray-100 rounded w-24" />
          <div className="h-4 bg-gray-100 rounded w-16" />
          <div className="h-4 bg-gray-100 rounded w-12" />
          <div className="h-4 bg-gray-100 rounded w-16 ml-auto" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ filter }: { filter: Filter }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <span className="text-5xl">📁</span>
      {filter === "all" ? (
        <>
          <p className="text-gray-700 font-semibold">No trades yet</p>
          <p className="text-gray-400 text-sm">Upload your first screenshot to get started!</p>
          <a
            href="/upload"
            className="mt-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 text-sm font-semibold transition-colors"
          >
            Upload My First Trade →
          </a>
        </>
      ) : (
        <>
          <p className="text-gray-700 font-semibold">No {filter} trades found</p>
          <p className="text-gray-400 text-sm">Try a different filter.</p>
        </>
      )}
    </div>
  )
}
