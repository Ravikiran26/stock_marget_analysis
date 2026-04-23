"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  fetchMyTrades, fetchTradeStats, getOpenPositions, getSwingPatterns, getOptionsPatterns,
  getPatternInsights, getExpiryStats, getOptionsDepthStats, getUsage, getIntradayPatterns,
  getStreak, getWeeklyReport,
  setUserId, Trade, TradeStats, OpenPosition, SwingPatterns, OptionsPatterns, PatternInsight, ExpiryStats, OptionsDepthStats, UsageInfo, IntradayPatterns,
  StreakInfo, WeeklyReport,
} from "@/lib/api"
import OpenPositionsCard from "@/components/OpenPositionsCard"
import MonthlyShareCard from "@/components/MonthlyShareCard"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts"

type Tab = "all" | "options" | "swing"

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeLocalStreak(trades: Trade[]): { type: "win" | "loss"; count: number } | null {
  const closed = [...trades]
    .filter((t) => t.pnl != null && t.status !== "open")
    .sort((a, b) => new Date(b.trade_date ?? b.created_at!).getTime() - new Date(a.trade_date ?? a.created_at!).getTime())
  if (closed.length < 2) return null
  const firstIsWin = (closed[0].pnl ?? 0) >= 0
  let count = 0
  for (const t of closed) {
    if (((t.pnl ?? 0) >= 0) === firstIsWin) count++
    else break
  }
  return count >= 2 ? { type: firstIsWin ? "win" : "loss", count } : null
}

function getMonthlyStats(trades: Trade[]) {
  const now = new Date()
  const cm = now.getMonth(), cy = now.getFullYear()
  const lm = cm === 0 ? 11 : cm - 1, ly = cm === 0 ? cy - 1 : cy
  let thisPnl = 0, thisCnt = 0, lastPnl = 0, lastCnt = 0
  trades.forEach((t) => {
    if (t.pnl == null) return
    const d = new Date(String(t.trade_date ?? t.created_at ?? ""))
    if (isNaN(d.getTime())) return
    if (d.getMonth() === cm && d.getFullYear() === cy) { thisPnl += t.pnl; thisCnt++ }
    else if (d.getMonth() === lm && d.getFullYear() === ly) { lastPnl += t.pnl; lastCnt++ }
  })
  return { thisPnl, thisCnt, lastPnl, lastCnt }
}

function fmt(n: number) {
  const abs = Math.abs(n)
  const str = abs.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  return `${n < 0 ? "−" : "+"}₹${str}`
}

function fmtPlain(n: number) {
  return `₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtDate(d?: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
}

function buildChartData(trades: Trade[]) {
  const sorted = [...trades]
    .filter((t) => t.pnl != null && t.created_at)
    .sort((a, b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime())
  let cumulative = 0
  return sorted.map((t) => {
    cumulative += t.pnl!
    return { date: fmtDate(t.created_at), pnl: Math.round(cumulative) }
  })
}

export default function DashboardPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [trades, setTrades] = useState<Trade[]>([])
  const [stats, setStats] = useState<TradeStats | null>(null)
  const [openPositions, setOpenPositions] = useState<OpenPosition[]>([])
  const [swingPatterns, setSwingPatterns]     = useState<SwingPatterns | null>(null)
  const [optionsPatterns, setOptionsPatterns] = useState<OptionsPatterns | null>(null)
  const [loadingData, setLoadingData]           = useState(true)
  const [loadingSwing, setLoadingSwing]         = useState(false)
  const [loadingOptions, setLoadingOptions]     = useState(false)
  const [optionsPatternsFailed, setOptionsPatternsFailed] = useState(false)
  const [expiryStats, setExpiryStats] = useState<ExpiryStats | null>(null)
  const [loadingExpiry, setLoadingExpiry] = useState(false)
  const [optionsDepth, setOptionsDepth] = useState<OptionsDepthStats | null>(null)
  const [loadingDepth, setLoadingDepth] = useState(false)
  const [intradayPatterns, setIntradayPatterns] = useState<IntradayPatterns | null>(null)
  const [loadingIntraday, setLoadingIntraday] = useState(false)
  const [insights, setInsights] = useState<PatternInsight[]>([])
  const [insightsReady, setInsightsReady] = useState(false)
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [streakInfo, setStreakInfo] = useState<StreakInfo | null>(null)
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>("all")

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace("/"); return }
      setUserId(data.session.user.id)
      setChecking(false)
      loadDashboard()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  async function loadDashboard() {
    setLoadingData(true)
    setError(null)
    try {
      const [t, s, op] = await Promise.all([
        fetchMyTrades(),
        fetchTradeStats(),
        getOpenPositions().catch(() => [] as OpenPosition[]),
      ])
      setTrades(t)
      setStats(s)
      setOpenPositions(op)
      // Load insights + streak + weekly report in background
      loadInsights()
      getStreak().then(setStreakInfo).catch(() => {})
      getWeeklyReport().then(setWeeklyReport).catch(() => {})
    } catch {
      setError("Could not load your trading data. Make sure the backend is running.")
    } finally {
      setLoadingData(false)
    }
  }

  async function loadInsights() {
    setLoadingInsights(true)
    try {
      const result = await getPatternInsights()
      setInsights(result.insights)
      setInsightsReady(result.ready)
    } catch {
      // insights failing silently is fine
    } finally {
      setLoadingInsights(false)
    }
  }

  // Lazy-load swing patterns
  useEffect(() => {
    if (activeTab === "swing" && !swingPatterns && !loadingSwing) {
      setLoadingSwing(true)
      getSwingPatterns()
        .then(setSwingPatterns)
        .catch(() => {})
        .finally(() => setLoadingSwing(false))
    }
  }, [activeTab, swingPatterns, loadingSwing])

  // Lazy-load options patterns — only try once
  useEffect(() => {
    if (
      (activeTab === "options" || activeTab === "all") &&
      !optionsPatterns && !loadingOptions && !optionsPatternsFailed
    ) {
      setLoadingOptions(true)
      getOptionsPatterns()
        .then(setOptionsPatterns)
        .catch(() => setOptionsPatternsFailed(true))
        .finally(() => setLoadingOptions(false))
    }
  }, [activeTab, optionsPatterns, loadingOptions, optionsPatternsFailed])

  // Lazy-load expiry intelligence
  useEffect(() => {
    if ((activeTab === "options" || activeTab === "all") && !expiryStats && !loadingExpiry) {
      setLoadingExpiry(true)
      getExpiryStats()
        .then(setExpiryStats)
        .catch(() => {})
        .finally(() => setLoadingExpiry(false))
    }
  }, [activeTab, expiryStats, loadingExpiry])

  // Lazy-load options depth (strike + hold time)
  useEffect(() => {
    if ((activeTab === "options" || activeTab === "all") && !optionsDepth && !loadingDepth) {
      setLoadingDepth(true)
      getOptionsDepthStats()
        .then(setOptionsDepth)
        .catch(() => {})
        .finally(() => setLoadingDepth(false))
    }
  }, [activeTab, optionsDepth, loadingDepth])

  // Lazy-load intraday patterns (overtrading, revenge trading, best underlying)
  useEffect(() => {
    if ((activeTab === "options" || activeTab === "all") && !intradayPatterns && !loadingIntraday) {
      setLoadingIntraday(true)
      getIntradayPatterns()
        .then(setIntradayPatterns)
        .catch(() => {})
        .finally(() => setLoadingIntraday(false))
    }
  }, [activeTab, intradayPatterns, loadingIntraday])

  useEffect(() => { document.title = "Dashboard | Traders Diary" }, [])

  if (checking) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-500 text-sm">
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
          </svg>
          Loading…
        </div>
      </div>
    )
  }

  // Filter trades by tab
  const visibleTrades = activeTab === "options"
    ? trades.filter((t) => t.trade_type === "options_intraday" || !t.trade_type)
    : activeTab === "swing"
    ? trades.filter((t) => t.trade_type === "equity_swing" || t.trade_type === "futures_swing")
    : trades

  const chartData = buildChartData(visibleTrades)
  const recentTrades = visibleTrades.slice(0, 5)

  // Compute tab-scoped stats from visibleTrades (not global stats)
  const tabStats = (() => {
    const closed = visibleTrades.filter(t => t.pnl != null && t.status !== "open")
    if (closed.length === 0) return { total_pnl: 0, win_rate: 0, total_trades: 0, avg_profit: 0, avg_loss: 0 }
    const wins   = closed.filter(t => (t.pnl ?? 0) > 0)
    const losses = closed.filter(t => (t.pnl ?? 0) < 0)
    return {
      total_pnl:   closed.reduce((s, t) => s + (t.pnl ?? 0), 0),
      win_rate:    Math.round(wins.length / closed.length * 1000) / 10,
      total_trades: closed.length,
      avg_profit:  wins.length   ? wins.reduce((s,t) => s + (t.pnl ?? 0), 0) / wins.length     : 0,
      avg_loss:    losses.length ? losses.reduce((s,t) => s + (t.pnl ?? 0), 0) / losses.length : 0,
    }
  })()

  const totalPnl = tabStats.total_pnl
  const isProfitable = totalPnl >= 0
  // Use backend streak if available, else fall back to client-side computation
  const localStreak = !loadingData ? computeLocalStreak(trades) : null
  const streakType = (streakInfo?.streak_type ?? localStreak?.type) as "win" | "loss" | null | undefined
  const streakCount = streakInfo?.streak_count ?? localStreak?.count ?? 0
  const monthly = !loadingData ? getMonthlyStats(trades) : null

  // Best sector from swing patterns
  const bestSector = swingPatterns
    ? Object.entries(swingPatterns.sector_win_rate)
        .sort((a, b) => b[1].win_rate - a[1].win_rate)[0]
    : null

  // Capital in open positions
  const capitalLocked = openPositions.reduce((sum, p) => {
    return sum + (p.trade.entry_price ?? 0) * (p.trade.quantity ?? 0)
  }, 0)

  return (
    <div className="min-h-screen bg-[#060c18]">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-6">

        {/* ── Header ── */}
        <div className="rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 px-6 py-5 shadow-lg shadow-blue-200/50">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-black text-white tracking-tight">Dashboard</h1>
                {streakType && streakCount >= 2 && (
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur-sm ${
                    streakType === "win"
                      ? "bg-white/20 text-white border border-white/30"
                      : "bg-red-500/30 text-red-100 border border-red-400/40"
                  }`}>
                    {streakType === "win" ? `🔥 ${streakCount}-win streak` : `⚠️ ${streakCount} losses in a row`}
                  </span>
                )}
              </div>
              <p className="text-sm text-blue-200 mt-0.5">Your trading performance at a glance</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {!loadingData && tabStats.total_trades > 0 && (
                <div className="text-right bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/20">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-200">Total P&amp;L</p>
                  <p className={`text-xl font-black tracking-tight tabular-nums ${isProfitable ? "text-emerald-300" : "text-red-300"}`}>
                    {fmt(tabStats.total_pnl)}
                  </p>
                </div>
              )}
              <a
                href="/upload"
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 text-white px-4 py-2.5 text-sm font-bold transition-colors border border-white/20"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload Trade
              </a>
            </div>
          </div>
        </div>

        {/* ── AI usage indicator (only shown when nearing/hitting limit) ── */}
        <AiUsageBanner />

        {/* ── Losing streak alert ── */}
        {streakInfo?.alert && (
          <div className="rounded-2xl border border-red-900/50 bg-red-950/30 p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">🚨</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-red-300 text-sm">{streakInfo.alert.message}</p>
                {streakInfo.alert.patterns.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {streakInfo.alert.patterns.map((p, i) => (
                      <li key={i} className="text-xs text-red-400/80 flex items-start gap-1.5">
                        <span className="mt-0.5">•</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-red-400 mt-2 font-medium">{streakInfo.alert.tip}</p>
              </div>
              <a href="/upload" className="flex-shrink-0 rounded-lg bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-xs font-bold transition-colors">
                Review trades
              </a>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
            {error}
          </div>
        )}

        {/* ── Tab bar ── */}
        <div className="flex gap-1 rounded-xl bg-[#0d1528] border border-[#1c2e4a] p-1 w-fit">
          {([
            { id: "all",     label: "All Trades",  icon: "M4 6h16M4 10h16M4 14h16M4 18h16" },
            { id: "options", label: "Options",     icon: "M13 10V3L4 14h7v7l9-11h-7z" },
            { id: "swing",   label: "Swing",       icon: "M7 20l4-16m2 16l4-16M6 9h14M4 15h14" },
          ] as { id: Tab; label: string; icon: string }[]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-900/40"
                  : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={activeTab === tab.id ? 2.2 : 1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Stat cards ── */}
        {loadingData ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-2xl bg-[#0d1528] p-5 animate-pulse border border-[#1c2e4a]">
                <div className="h-3 bg-[#162035] rounded w-1/2 mb-3" />
                <div className="h-7 bg-[#162035] rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : activeTab === "swing" ? (
          /* ── Swing-specific stat cards ── */
          loadingSwing ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-2xl bg-[#0d1528] p-5 animate-pulse border border-[#1c2e4a]">
                  <div className="h-3 bg-gray-100 rounded w-1/2 mb-3" />
                  <div className="h-7 bg-gray-100 rounded w-3/4" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                label="Best Sector"
                value={bestSector ? bestSector[0] : "—"}
                sub={bestSector ? `${bestSector[1].win_rate}% win rate` : "No sector data"}
                positive={null}
                color="green"
                icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
              />
              <StatCard
                label="Avg Hold — Winners"
                value={swingPatterns?.avg_holding_days_winners != null ? `${swingPatterns.avg_holding_days_winners}d` : "—"}
                sub="days in winning trades"
                positive={null}
                color="blue"
                icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              />
              <StatCard
                label="Capital in Opens"
                value={capitalLocked > 0 ? fmtPlain(capitalLocked) : "₹0"}
                sub={`${openPositions.length} open position${openPositions.length !== 1 ? "s" : ""}`}
                positive={null}
                color="amber"
                icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              />
              <StatCard
                label="Panic Sells"
                value={swingPatterns ? String(swingPatterns.panic_sell_count) : "—"}
                sub="closed < 2 days with loss"
                positive={swingPatterns ? swingPatterns.panic_sell_count === 0 : null}
                color="purple"
                icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
              />
            </div>
          )
        ) : (
          /* ── Default (All / Options) stat cards — scoped to visible tab ── */
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              label="Total P&L"
              value={fmt(tabStats.total_pnl)}
              sub={tabStats.total_trades ? `${tabStats.total_trades} trades` : "No trades yet"}
              positive={isProfitable}
              color="blue"
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
            <StatCard
              label="Win Rate"
              value={`${tabStats.win_rate.toFixed(1)}%`}
              sub={tabStats.win_rate >= 50 ? "Above average" : "Keep going"}
              positive={tabStats.win_rate >= 50}
              color="green"
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
            <StatCard
              label="Total Trades"
              value={String(tabStats.total_trades)}
              sub={activeTab === "options" ? "options trades" : "logged so far"}
              positive={null}
              color="purple"
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
            />
            <StatCard
              label="Avg Profit"
              value={tabStats.total_trades > 0 ? fmtPlain(tabStats.avg_profit) : "₹0"}
              sub="per winning trade"
              positive={tabStats.avg_profit > 0}
              color="amber"
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
            />
          </div>
        )}

        {/* ── AI Pattern Insights ── */}
        <PatternInsightsSection
          insights={insights}
          ready={insightsReady}
          loading={loadingInsights}
          totalTrades={stats?.total_trades ?? tabStats.total_trades}
        />

        {/* ── Monthly comparison strip ── */}
        {monthly && (monthly.thisCnt > 0 || monthly.lastCnt > 0) && (
          <div className="rounded-2xl bg-[#0d1528] border border-[#1c2e4a] px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#162035] flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Monthly</span>
            </div>
            <div className="flex items-center gap-2 bg-[#0a1220] rounded-xl px-3 py-2">
              <span className="text-[11px] text-slate-500 font-medium">This month</span>
              <span className={`text-sm font-black tabular-nums ${monthly.thisPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {monthly.thisPnl >= 0 ? "+" : "−"}₹{Math.abs(monthly.thisPnl).toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-slate-600 bg-[#0d1528] rounded-lg px-1.5 py-0.5 border border-[#1c2e4a]">{monthly.thisCnt}t</span>
            </div>
            {monthly.lastCnt > 0 && (
              <>
                <div className="flex items-center gap-2 bg-[#0a1220] rounded-xl px-3 py-2">
                  <span className="text-[11px] text-slate-500 font-medium">Last month</span>
                  <span className={`text-sm font-black tabular-nums ${monthly.lastPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {monthly.lastPnl >= 0 ? "+" : "−"}₹{Math.abs(monthly.lastPnl).toLocaleString("en-IN")}
                  </span>
                  <span className="text-[10px] text-slate-600 bg-[#0d1528] rounded-lg px-1.5 py-0.5 border border-[#1c2e4a]">{monthly.lastCnt}t</span>
                </div>
                {monthly.lastPnl !== 0 && (
                  <span className={`text-xs font-bold px-2.5 py-1.5 rounded-xl ${monthly.thisPnl > monthly.lastPnl ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/50" : "bg-red-950/40 text-red-400 border border-red-900/50"}`}>
                    {monthly.thisPnl > monthly.lastPnl ? "▲" : "▼"} {Math.abs(Math.round(((monthly.thisPnl - monthly.lastPnl) / Math.abs(monthly.lastPnl)) * 100))}% vs last month
                  </span>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Weekly Report ── */}
        {weeklyReport && (weeklyReport.this_week.total_trades > 0 || weeklyReport.last_week.total_trades > 0) && (
          <div className="rounded-2xl bg-[#0d1528] border border-[#1c2e4a] p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-indigo-900/60 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm font-bold text-slate-200">This Week vs Last Week</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {(["this_week", "last_week"] as const).map((key) => {
                const w = weeklyReport[key]
                const isThis = key === "this_week"
                return (
                  <div key={key} className={`rounded-xl p-3 ${isThis ? "bg-indigo-950/40 border border-indigo-900/50" : "bg-[#0a1220] border border-[#1c2e4a]"}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-wide mb-1.5 ${isThis ? "text-indigo-400" : "text-slate-500"}`}>
                      {isThis ? "This week" : "Last week"}
                    </p>
                    {w.total_trades === 0 ? (
                      <p className="text-xs text-slate-600">No trades</p>
                    ) : (
                      <>
                        <p className={`text-lg font-black tabular-nums ${w.total_pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {w.total_pnl >= 0 ? "+" : "−"}₹{Math.abs(w.total_pnl).toLocaleString("en-IN")}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {w.wins}W / {w.losses}L · {w.win_rate}% win rate
                        </p>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
            {weeklyReport.this_week.total_trades > 0 && weeklyReport.last_week.total_trades > 0 && (
              <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium mb-3 ${weeklyReport.pnl_change >= 0 ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/40" : "bg-red-950/40 text-red-400 border border-red-900/40"}`}>
                <span>{weeklyReport.pnl_change >= 0 ? "▲" : "▼"}</span>
                <span>
                  {weeklyReport.pnl_change >= 0 ? "+" : "−"}₹{Math.abs(weeklyReport.pnl_change).toLocaleString("en-IN")} vs last week
                  {weeklyReport.win_rate_change !== 0 && ` · Win rate ${weeklyReport.win_rate_change > 0 ? "+" : ""}${weeklyReport.win_rate_change}%`}
                </span>
              </div>
            )}
            <div className="rounded-xl bg-amber-950/30 border border-amber-900/40 px-3 py-2.5 flex gap-2">
              <span className="text-base">🎯</span>
              <p className="text-xs text-amber-300/80 font-medium leading-snug">{weeklyReport.focus}</p>
            </div>
          </div>
        )}

        {/* ── Monthly Share Card ── */}
        {trades.length > 0 && (
          <MonthlyShareCard trades={trades} />
        )}

        {/* ── Open Positions (above chart, only if positions exist) ── */}
        {openPositions.length > 0 && (activeTab === "all" || activeTab === "swing") && (
          <OpenPositionsCard positions={openPositions} />
        )}

        {/* ── P&L Chart ── */}
        <div className="rounded-2xl bg-[#0d1528] border border-[#1c2e4a] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#162035]">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isProfitable ? "bg-emerald-900/50" : "bg-red-900/50"}`}>
                <svg className={`w-4 h-4 ${isProfitable ? "text-emerald-400" : "text-red-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-200">Cumulative P&amp;L</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeTab === "swing" ? "Swing trades only" :
                   activeTab === "options" ? "Options & intraday only" :
                   "Running total across all trades"}
                </p>
              </div>
            </div>
            {chartData.length > 0 && (
              <span className={`text-sm font-black tabular-nums px-3.5 py-1.5 rounded-xl border ${isProfitable ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/50" : "bg-red-950/40 text-red-400 border-red-900/50"}`}>
                {fmt(totalPnl)}
              </span>
            )}
          </div>
          <div className="px-2 pt-4 pb-2">
            {chartData.length === 0 ? <EmptyChart /> : (() => {
              const chartColor = isProfitable ? "#22c55e" : "#ef4444"
              return (
                <ResponsiveContainer width="100%" height={230}>
                  <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="pnlFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chartColor} stopOpacity={0.22} />
                        <stop offset="100%" stopColor={chartColor} stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#162035" vertical={false} />
                    <ReferenceLine y={0} stroke="#1c2e4a" strokeWidth={1} strokeDasharray="4 4" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#475569" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#475569" }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} width={48} />
                    <Tooltip
                      formatter={(value) => [fmt(Number(value)), "Cumulative P&L"]}
                      contentStyle={{ borderRadius: "12px", border: "1px solid #1c2e4a", background: "#0d1528", fontSize: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", color: "#e2e8f0" }}
                      cursor={{ stroke: chartColor, strokeWidth: 1, strokeDasharray: "4 4" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="pnl"
                      stroke={chartColor}
                      strokeWidth={2.5}
                      fill="url(#pnlFill)"
                      dot={{ r: 3, fill: chartColor, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: chartColor, strokeWidth: 2, stroke: "#0d1528" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )
            })()}
          </div>
        </div>

        {/* ── Trading Heatmap ── */}
        {!loadingData && trades.length > 0 && (
          <TradeHeatmap trades={visibleTrades} />
        )}

        {/* ── Recent Trades ── */}
        <div className="rounded-2xl bg-[#0d1528] border border-[#1c2e4a] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#162035]">
            <div>
              <p className="text-sm font-semibold text-slate-200">Recent Trades</p>
              <p className="text-xs text-slate-500 mt-0.5">Last 5 {activeTab !== "all" ? `${activeTab} ` : ""}trades logged</p>
            </div>
            {visibleTrades.length > 5 && (
              <a href="/trades" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 hover:bg-indigo-950/60 border border-indigo-900/50 px-3 py-1.5 rounded-lg transition-colors">View all →</a>
            )}
          </div>
          {recentTrades.length === 0 ? <EmptyTrades /> : (
            <div className="divide-y divide-[#162035]">
              {recentTrades.map((t, i) => {
                const isProfit = (t.pnl ?? 0) >= 0
                const isOpen = t.status === "open"
                const isBuy = t.action?.toLowerCase() === "buy"
                const accentColor = isOpen ? "border-l-amber-500" : isProfit ? "border-l-emerald-500" : "border-l-red-500"
                return (
                  <div key={t.id ?? i} className={`relative flex items-center justify-between px-6 py-4 hover:bg-[#111d33] transition-colors border-l-[3px] ${accentColor} group`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-[10px] font-black ${isBuy ? "bg-emerald-950/50 text-emerald-400 border border-emerald-900/50" : "bg-red-950/50 text-red-400 border border-red-900/50"}`}>
                        {t.action?.slice(0,1).toUpperCase() ?? "—"}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-200 text-sm truncate">{t.symbol ?? "Unknown"}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {t.broker && <p className="text-xs text-slate-500 truncate">{t.broker}</p>}
                          {t.trade_type && t.trade_type !== "options_intraday" && (
                            <span className="text-[10px] font-semibold text-violet-400 bg-violet-950/40 border border-violet-900/40 px-1.5 py-0.5 rounded-md">
                              {t.trade_type === "equity_swing" ? "Swing" : "Futures"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className={`text-sm font-bold tabular-nums ${isOpen ? "text-amber-400" : isProfit ? "text-emerald-400" : "text-red-400"}`}>
                        {t.pnl != null ? fmt(t.pnl) : isOpen ? "Open" : "—"}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{fmtDate(t.trade_date ?? t.created_at)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Intraday Behaviour Patterns ── */}
        {(activeTab === "options" || activeTab === "all") && (
          <IntradayPatternsSection patterns={intradayPatterns} loading={loadingIntraday} />
        )}

        {/* ── Expiry Intelligence ── */}
        {(activeTab === "options" || activeTab === "all") && (
          <ExpiryIntelligenceSection stats={expiryStats} loading={loadingExpiry} />
        )}

        {/* ── Strike & Hold Time ── */}
        {(activeTab === "options" || activeTab === "all") && (
          <OptionsDepthSection stats={optionsDepth} loading={loadingDepth} />
        )}

        {/* ── Options Patterns ── */}
        {(activeTab === "options" || activeTab === "all") && !optionsPatternsFailed && (
          <OptionsPatternsSection patterns={optionsPatterns} loading={loadingOptions} />
        )}
        {optionsPatternsFailed && (
          <div className="rounded-2xl bg-[#0d1528] border border-[#1c2e4a] px-5 py-4 text-sm text-slate-500 text-center">
            Could not load patterns — make sure the backend is running.
          </div>
        )}

        {/* ── Swing Patterns detail ── */}
        {activeTab === "swing" && swingPatterns && !loadingSwing && (
          <SwingPatternsSection patterns={swingPatterns} />
        )}

      </div>
    </div>
  )
}

// ── Intraday Behaviour Patterns ───────────────────────────────────────────────

const OVERTRADE_ORDER = ["1–3 trades", "4–6 trades", "7+ trades"]
const UNDERLYING_ORDER = ["NIFTY", "BANKNIFTY", "FINNIFTY", "SENSEX", "MIDCPNIFTY"]
const UNDERLYING_LABELS: Record<string, string> = {
  NIFTY: "NIFTY 50", BANKNIFTY: "Bank Nifty", FINNIFTY: "Fin Nifty",
  SENSEX: "SENSEX", MIDCPNIFTY: "Midcap",
}

function IntradayPatternsSection({ patterns, loading }: { patterns: IntradayPatterns | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-2xl bg-[#0d1528] border border-[#1c2e4a] p-6 animate-pulse space-y-4">
        <div className="h-4 bg-gray-100 rounded w-56" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-48 bg-gray-50 rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (!patterns || patterns.total_intraday_trades < 5) {
    return (
      <div className="rounded-2xl bg-[#0d1528] border border-[#1c2e4a] px-6 py-10 text-center">
        <div className="text-3xl mb-2">🧠</div>
        <p className="text-sm font-medium text-gray-700">Behaviour patterns unlock after 5 intraday trades</p>
        <p className="text-xs text-slate-500 mt-1">We&apos;ll show overtrading, revenge trading and your best underlying</p>
      </div>
    )
  }

  const { overtrading, best_bucket, worst_bucket, revenge_trading, best_underlying, total_trading_days } = patterns
  const maxAbsOT = Math.max(1, ...Object.values(overtrading).map(s => Math.abs(s.avg_pnl)))
  const underlyings = UNDERLYING_ORDER.filter(k => best_underlying[k])

  return (
    <div className="rounded-2xl bg-[#0d1528] border border-[#1c2e4a] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#162035] flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
          <span className="text-base">🧠</span>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-200">Intraday Behaviour Patterns</p>
          <p className="text-xs text-slate-500 mt-0.5">{patterns.total_intraday_trades} trades across {total_trading_days} trading days</p>
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* ── Overtrading ── */}
        <div className="rounded-xl border border-[#1c2e4a] bg-[#0a1220] p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">📈</span>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Overtrading</p>
          </div>
          <p className="text-[10px] text-gray-400 mb-4">Avg P&amp;L per trade by how many trades you took that day</p>

          <div className="space-y-3">
            {OVERTRADE_ORDER.map(key => {
              const s = overtrading[key]
              if (!s) return (
                <div key={key} className="opacity-40">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">{key}</span>
                    <span className="text-gray-300">No data</span>
                  </div>
                </div>
              )
              const isBest  = key === best_bucket
              const isWorst = key === worst_bucket && worst_bucket !== best_bucket
              const pos     = s.avg_pnl >= 0
              const barPct  = Math.round(Math.abs(s.avg_pnl) / maxAbsOT * 100)
              return (
                <div key={key}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-medium">{key}</span>
                      {isBest  && <span className="text-[9px] font-bold text-emerald-400 bg-emerald-100 px-1.5 py-0.5 rounded-full">BEST</span>}
                      {isWorst && <span className="text-[9px] font-bold text-red-400 bg-red-100 px-1.5 py-0.5 rounded-full">WORST</span>}
                    </div>
                    <span className={`font-bold tabular-nums ${pos ? "text-emerald-600" : "text-red-500"}`}>
                      {pos ? "+" : ""}₹{Math.abs(s.avg_pnl).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[#162035] overflow-hidden">
                    <div className={`h-full rounded-full ${pos ? "bg-emerald-500" : "bg-red-400"}`} style={{ width: `${barPct}%` }} />
                  </div>
                  <p className="text-[9px] text-gray-400 mt-0.5">{s.wins}/{s.total} wins · {s.win_rate.toFixed(0)}%</p>
                </div>
              )
            })}
          </div>

          {best_bucket && worst_bucket && worst_bucket !== best_bucket && overtrading[worst_bucket] && (
            <div className="mt-3 rounded-lg px-3 py-2 bg-red-950/30 border border-red-900/40 text-xs text-red-400 font-medium">
              ⚠️ Stop after <strong>{best_bucket.replace(" trades","")}</strong> trades — your P&amp;L drops sharply beyond that
            </div>
          )}
        </div>

        {/* ── Revenge Trading ── */}
        <div className="rounded-xl border border-[#1c2e4a] bg-[#0a1220] p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">😤</span>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Revenge Trading</p>
          </div>
          <p className="text-[10px] text-gray-400 mb-4">Trades placed immediately after a loss on the same day</p>

          {!revenge_trading ? (
            <p className="text-xs text-slate-500 text-center mt-8">Not enough data yet — need more multi-trade days</p>
          ) : (
            <>
              {/* Big stat */}
              <div className={`rounded-xl p-4 text-center mb-3 ${revenge_trading.is_problem ? "bg-red-950/30 border border-red-900/50" : "bg-emerald-950/30 border border-emerald-900/50"}`}>
                <p className={`text-4xl font-black tabular-nums mb-1 ${revenge_trading.is_problem ? "text-red-600" : "text-emerald-600"}`}>
                  {revenge_trading.loss_rate.toFixed(0)}%
                </p>
                <p className={`text-xs font-semibold ${revenge_trading.is_problem ? "text-red-400" : "text-emerald-400"}`}>
                  of post-loss trades also lost
                </p>
                <p className="text-[10px] text-gray-400 mt-1">
                  {revenge_trading.loss_count}/{revenge_trading.total_post_loss_trades} post-loss trades were losses
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs px-1">
                  <span className="text-gray-500">Avg P&amp;L after a loss</span>
                  <span className={`font-bold ${revenge_trading.avg_pnl >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {revenge_trading.avg_pnl >= 0 ? "+" : ""}₹{Math.abs(revenge_trading.avg_pnl).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>
                </div>
                {revenge_trading.total_damage < 0 && (
                  <div className="flex justify-between text-xs px-1">
                    <span className="text-gray-500">Total damage from revenge</span>
                    <span className="font-bold text-red-600">
                      −₹{Math.abs(revenge_trading.total_damage).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
              </div>

              {revenge_trading.is_problem && (
                <div className="mt-3 rounded-lg px-3 py-2 bg-red-950/30 border border-red-900/40 text-xs text-red-400 font-medium">
                  🚨 After a loss, take a 15-min break before the next trade
                </div>
              )}
              {!revenge_trading.is_problem && (
                <div className="mt-3 rounded-lg px-3 py-2 bg-emerald-950/30 border border-emerald-900/40 text-xs text-emerald-400 font-medium">
                  ✅ Good emotional control — you recover well after losses
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Best Underlying ── */}
        <div className="rounded-xl border border-[#1c2e4a] bg-[#0a1220] p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">🎯</span>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Best Underlying</p>
          </div>
          <p className="text-[10px] text-gray-400 mb-4">Which index gives you the best results?</p>

          {underlyings.length === 0 ? (
            <p className="text-xs text-slate-500 text-center mt-8">No underlying data found — make sure symbols are in format like &quot;NIFTY 22600 CE&quot;</p>
          ) : (
            <div className="space-y-3">
              {underlyings.map((key, idx) => {
                const s = best_underlying[key]
                const isBest = idx === 0 || (underlyings.length > 1 &&
                  s.avg_pnl === Math.max(...underlyings.map(k => best_underlying[k]?.avg_pnl ?? -Infinity)))
                const pos = s.avg_pnl >= 0
                return (
                  <div key={key} className={`rounded-xl p-3 border ${isBest && pos ? "bg-indigo-950/40 border-indigo-900/60" : "bg-[#0a1220] border-[#1c2e4a]"}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-300">{UNDERLYING_LABELS[key] ?? key}</span>
                        {isBest && pos && <span className="text-[9px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-full">YOUR EDGE</span>}
                      </div>
                      <span className={`text-sm font-black tabular-nums ${s.win_rate >= 55 ? "text-emerald-600" : s.win_rate <= 40 ? "text-red-500" : "text-gray-700"}`}>
                        {s.win_rate.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#162035] overflow-hidden mb-1.5">
                      <div className={`h-full rounded-full ${s.win_rate >= 55 ? "bg-emerald-500" : s.win_rate <= 40 ? "bg-red-400" : "bg-amber-400"}`}
                        style={{ width: `${s.win_rate}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-400">{s.wins}/{s.total} wins</span>
                      <span className={`font-bold ${pos ? "text-emerald-600" : "text-red-500"}`}>
                        avg {pos ? "+" : ""}₹{Math.abs(s.avg_pnl).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Expiry Intelligence ───────────────────────────────────────────────────────

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
const DAY_SHORT: Record<string, string> = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu", Friday: "Fri",
}
const WEEK_LABELS: Record<string, string> = {
  "Week 1": "1st Thu", "Week 2": "2nd Thu", "Week 3": "3rd Thu", "Week 4": "4th Thu (Monthly)",
}

function ExpiryIntelligenceSection({ stats, loading }: { stats: ExpiryStats | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-2xl bg-[#0d1528] border border-[#1c2e4a] p-6 animate-pulse space-y-4">
        <div className="h-4 bg-gray-100 rounded w-48" />
        <div className="grid grid-cols-5 gap-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-24 bg-gray-50 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[1,2,3,4].map(i => <div key={i} className="h-20 bg-gray-50 rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (!stats || stats.total_options_trades < 3) {
    return (
      <div className="rounded-2xl bg-[#0d1528] border border-[#1c2e4a] px-6 py-10 text-center">
        <div className="text-3xl mb-2">📅</div>
        <p className="text-sm font-medium text-gray-700">Expiry intelligence unlocks after 3 options trades</p>
        <p className="text-xs text-slate-500 mt-1">We&apos;ll show exactly which day of the week costs you money</p>
      </div>
    )
  }

  const { day_stats, thursday_by_week, best_day, worst_day } = stats

  // Worst day total loss for the verdict
  const worstStat = worst_day ? day_stats[worst_day] : null
  const bestStat  = best_day  ? day_stats[best_day]  : null

  return (
    <div className="rounded-2xl bg-[#0d1528] border border-[#1c2e4a] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#162035] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
            <span className="text-base">📅</span>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-200">Expiry Day Intelligence</p>
            <p className="text-xs text-slate-500 mt-0.5">{stats.total_options_trades} options trades analysed</p>
          </div>
        </div>
        {worst_day && worstStat && (
          <span className="text-[11px] font-bold text-red-600 bg-red-950/30 border border-red-900/40 px-2.5 py-1 rounded-lg">
            Worst: {DAY_SHORT[worst_day]}
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">

        {/* Day of week grid */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 px-1">Win Rate &amp; Avg P&amp;L by Day</p>
          <div className="grid grid-cols-5 gap-2">
            {DAY_ORDER.map(day => {
              const s = day_stats[day]
              const isThursday = day === "Thursday"
              const isBest  = day === best_day
              const isWorst = day === worst_day
              const profitable = s ? s.avg_pnl >= 0 : null

              return (
                <div key={day}
                  className={`rounded-xl p-3 text-center border transition-all ${
                    !s
                      ? "bg-gray-50 border-gray-100 opacity-40"
                      : isBest
                      ? "bg-emerald-50 border-emerald-200"
                      : isWorst
                      ? "bg-red-50 border-red-200"
                      : isThursday
                      ? "bg-orange-50 border-orange-200"
                      : "bg-gray-50 border-gray-100"
                  }`}>
                  <p className={`text-[10px] font-bold mb-2 ${
                    isBest ? "text-emerald-600" : isWorst ? "text-red-600" : isThursday ? "text-orange-600" : "text-gray-500"
                  }`}>
                    {DAY_SHORT[day]}
                    {isThursday && <span className="block text-[8px] font-semibold opacity-70">EXPIRY</span>}
                    {isBest && !isThursday && <span className="block text-[8px] font-semibold">BEST</span>}
                    {isWorst && !isThursday && <span className="block text-[8px] font-semibold">WORST</span>}
                  </p>
                  {s ? (
                    <>
                      <p className={`text-lg font-black tabular-nums leading-none mb-1 ${
                        s.win_rate >= 55 ? "text-emerald-600" : s.win_rate <= 40 ? "text-red-600" : "text-gray-700"
                      }`}>
                        {s.win_rate.toFixed(0)}%
                      </p>
                      <p className="text-[9px] text-gray-400 mb-1.5">{s.wins}/{s.total} wins</p>
                      <p className={`text-[10px] font-bold tabular-nums ${profitable ? "text-emerald-600" : "text-red-500"}`}>
                        {s.avg_pnl >= 0 ? "+" : ""}₹{Math.abs(s.avg_pnl).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </p>
                      <p className="text-[8px] text-gray-300">avg/trade</p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-300 mt-2">No data</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Verdict banner */}
        {worst_day && worstStat && bestStat && (
          <div className={`rounded-xl px-4 py-3 flex items-start gap-3 ${
            (worstStat.avg_pnl < -500)
              ? "bg-red-950/30 border border-red-900/40"
              : "bg-indigo-950/30 border border-indigo-900/40"
          }`}>
            <span className="text-base mt-0.5">{worstStat.avg_pnl < -500 ? "🚨" : "💡"}</span>
            <p className={`text-xs font-medium leading-relaxed ${worstStat.avg_pnl < -500 ? "text-red-400" : "text-blue-700"}`}>
              {worstStat.avg_pnl < -500
                ? `${worst_day} is bleeding you — avg ₹${Math.abs(worstStat.avg_pnl).toLocaleString("en-IN", { maximumFractionDigits: 0 })} loss per trade over ${worstStat.total} trades (₹${Math.abs(worstStat.total_pnl).toLocaleString("en-IN", { maximumFractionDigits: 0 })} total). ${best_day !== worst_day ? `Your best day is ${best_day} at ${bestStat.win_rate.toFixed(0)}% win rate.` : ""} Consider sitting out ${DAY_SHORT[worst_day]} entirely.`
                : `No single day is dramatically worse than others. Your edge is fairly distributed across the week.`
              }
            </p>
          </div>
        )}

        {/* Thursday week-of-month breakdown */}
        {Object.keys(thursday_by_week).length >= 2 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 px-1">
              Thursday Breakdown — Which Week of Month?
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {["Week 1","Week 2","Week 3","Week 4"].map(wk => {
                const s = thursday_by_week[wk]
                const isMonthly = wk === "Week 4"
                if (!s) return (
                  <div key={wk} className="rounded-xl p-3 bg-gray-50 border border-gray-100 opacity-40 text-center">
                    <p className="text-[10px] text-gray-400">{WEEK_LABELS[wk]}</p>
                    <p className="text-xs text-gray-300 mt-2">No data</p>
                  </div>
                )
                const profitable = s.avg_pnl >= 0
                return (
                  <div key={wk}
                    className={`rounded-xl p-3 border text-center ${
                      isMonthly
                        ? profitable ? "bg-violet-50 border-violet-200" : "bg-red-50 border-red-200"
                        : profitable ? "bg-emerald-50 border-emerald-100" : "bg-amber-50 border-amber-100"
                    }`}>
                    <p className={`text-[10px] font-bold mb-2 ${
                      isMonthly
                        ? profitable ? "text-violet-600" : "text-red-600"
                        : profitable ? "text-emerald-600" : "text-amber-600"
                    }`}>
                      {WEEK_LABELS[wk]}
                      {isMonthly && <span className="block text-[8px] opacity-70">Monthly expiry</span>}
                    </p>
                    <p className={`text-xl font-black tabular-nums leading-none mb-1 ${
                      s.win_rate >= 55 ? "text-emerald-600" : s.win_rate <= 40 ? "text-red-600" : "text-gray-700"
                    }`}>
                      {s.win_rate.toFixed(0)}%
                    </p>
                    <p className="text-[9px] text-gray-400 mb-1">{s.wins}/{s.total} wins</p>
                    <p className={`text-[10px] font-bold tabular-nums ${profitable ? "text-emerald-600" : "text-red-500"}`}>
                      {s.avg_pnl >= 0 ? "+" : ""}₹{Math.abs(s.avg_pnl).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-[8px] text-gray-300">avg/trade</p>
                  </div>
                )
              })}
            </div>
            <p className="text-[10px] text-gray-400 mt-2 px-1">
              4th Thursday = monthly NSE expiry (typically higher volatility + premium decay)
            </p>
          </div>
        )}

      </div>
    </div>
  )
}

// ── Options Depth (Strike + Hold Time) ───────────────────────────────────────

const STRIKE_ORDER = ["OTM", "ATM", "ITM"]
const STRIKE_META: Record<string, { label: string; desc: string; color: string; bg: string; border: string }> = {
  OTM: { label: "OTM",  desc: "Out of the money",  color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-200"  },
  ATM: { label: "ATM",  desc: "At the money",       color: "text-indigo-600",  bg: "bg-indigo-50",  border: "border-indigo-200" },
  ITM: { label: "ITM",  desc: "In the money",       color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200"},
}
const HOLD_ORDER = ["<30 min", "30–60 min", "1–2 hrs", "2–3 hrs", "3 hrs+"]

function OptionsDepthSection({ stats, loading }: { stats: OptionsDepthStats | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-2xl bg-[#0d1528] border border-[#1c2e4a] p-6 animate-pulse space-y-4">
        <div className="h-4 bg-gray-100 rounded w-56" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-48 bg-gray-50 rounded-xl" />
          <div className="h-48 bg-gray-50 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!stats || stats.total_options_trades < 5) {
    return (
      <div className="rounded-2xl bg-[#0d1528] border border-[#1c2e4a] px-6 py-10 text-center">
        <div className="text-3xl mb-2">🎯</div>
        <p className="text-sm font-medium text-gray-700">Strike &amp; hold-time analysis unlocks after 5 options trades</p>
        <p className="text-xs text-slate-500 mt-1">We&apos;ll show whether OTM, ATM, or ITM works best for you</p>
      </div>
    )
  }

  const { strike_stats, hold_time_stats } = stats

  // Best strike by win rate (min 2 trades)
  const validStrikes = STRIKE_ORDER.filter(k => strike_stats[k] && strike_stats[k].total >= 2)
  const bestStrike   = validStrikes.length
    ? validStrikes.reduce((a, b) => (strike_stats[a]?.win_rate ?? 0) >= (strike_stats[b]?.win_rate ?? 0) ? a : b)
    : null

  // Best hold time by avg_pnl (min 2 trades)
  const validHolds   = HOLD_ORDER.filter(k => hold_time_stats[k] && hold_time_stats[k].total >= 2)
  const bestHold     = validHolds.length
    ? validHolds.reduce((a, b) => (hold_time_stats[a]?.avg_pnl ?? -Infinity) >= (hold_time_stats[b]?.avg_pnl ?? -Infinity) ? a : b)
    : null
  const worstHold    = validHolds.length > 1
    ? validHolds.reduce((a, b) => (hold_time_stats[a]?.avg_pnl ?? Infinity) <= (hold_time_stats[b]?.avg_pnl ?? Infinity) ? a : b)
    : null

  // Max bar value for hold time chart
  const maxAbsPnl = Math.max(1, ...validHolds.map(k => Math.abs(hold_time_stats[k]?.avg_pnl ?? 0)))

  return (
    <div className="rounded-2xl bg-[#0d1528] border border-[#1c2e4a] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#162035] flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
          <span className="text-base">🎯</span>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-200">Strike &amp; Hold Time Analysis</p>
          <p className="text-xs text-slate-500 mt-0.5">{stats.total_options_trades} options trades</p>
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* ── Strike selection ── */}
        <div className="rounded-xl border border-[#1c2e4a] bg-[#0a1220] p-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm">💰</span>
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Strike Type Performance</p>
          </div>

          <div className="space-y-3">
            {STRIKE_ORDER.map(key => {
              const s = strike_stats[key]
              const meta = STRIKE_META[key]
              const isBest = key === bestStrike
              if (!s) return (
                <div key={key} className="flex items-center gap-3 opacity-40">
                  <div className={`w-12 text-center py-1 rounded-lg text-[10px] font-black ${meta.color} ${meta.bg}`}>{meta.label}</div>
                  <p className="text-xs text-slate-500">No data</p>
                </div>
              )
              return (
                <div key={key} className={`rounded-xl p-3 border ${isBest ? `${meta.bg} ${meta.border}` : "bg-[#0a1220] border-[#1c2e4a]"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${meta.color} ${meta.bg}`}>{meta.label}</span>
                      <span className="text-[10px] text-gray-400">{meta.desc}</span>
                      {isBest && <span className="text-[9px] font-bold text-white bg-indigo-500 px-1.5 py-0.5 rounded-full">YOUR ZONE</span>}
                    </div>
                    <span className={`text-sm font-black tabular-nums ${s.win_rate >= 55 ? "text-emerald-600" : s.win_rate <= 40 ? "text-red-500" : "text-gray-700"}`}>
                      {s.win_rate.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#162035] overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full ${s.win_rate >= 55 ? "bg-emerald-500" : s.win_rate <= 40 ? "bg-red-400" : "bg-amber-400"}`}
                      style={{ width: `${s.win_rate}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-gray-400">{s.wins}/{s.total} wins</span>
                    <span className={`font-bold tabular-nums ${s.avg_pnl >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      avg {s.avg_pnl >= 0 ? "+" : ""}₹{Math.abs(s.avg_pnl).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {bestStrike && (
            <div className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ${STRIKE_META[bestStrike].bg} border ${STRIKE_META[bestStrike].border} ${STRIKE_META[bestStrike].color}`}>
              🏆 Stick to <strong>{bestStrike}</strong> — {strike_stats[bestStrike]?.win_rate.toFixed(0)}% win rate is your best zone
            </div>
          )}
        </div>

        {/* ── Hold time ── */}
        <div className="rounded-xl border border-[#1c2e4a] bg-[#0a1220] p-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm">⏱️</span>
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Hold Time vs Avg P&amp;L</p>
          </div>

          {validHolds.length === 0 ? (
            <p className="text-xs text-slate-500">No trade time data available — make sure trade time is captured on upload</p>
          ) : (
            <div className="space-y-3">
              {HOLD_ORDER.map(key => {
                const s = hold_time_stats[key]
                if (!s) return null
                const isBest  = key === bestHold
                const isWorst = key === worstHold && worstHold !== bestHold
                const barPct  = Math.round((Math.abs(s.avg_pnl) / maxAbsPnl) * 100)
                const positive = s.avg_pnl >= 0
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 font-medium w-20">{key}</span>
                        {isBest  && <span className="text-[9px] font-bold text-emerald-400 bg-emerald-100 px-1.5 py-0.5 rounded-full">SWEET SPOT</span>}
                        {isWorst && <span className="text-[9px] font-bold text-red-400 bg-red-100 px-1.5 py-0.5 rounded-full">AVOID</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-[10px]">{s.total}t</span>
                        <span className={`font-bold tabular-nums ${positive ? "text-emerald-600" : "text-red-500"}`}>
                          {positive ? "+" : ""}₹{Math.abs(s.avg_pnl).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-[#162035] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${positive ? "bg-emerald-500" : "bg-red-400"}`}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {bestHold && worstHold && worstHold !== bestHold && hold_time_stats[worstHold] && (
            <div className="mt-3 rounded-lg px-3 py-2 bg-red-950/30 border border-red-900/40 text-xs text-red-400 font-medium">
              ⚠️ You give back profits after <strong>{worstHold}</strong> — avg ₹{Math.abs(hold_time_stats[worstHold]!.avg_pnl).toLocaleString("en-IN", { maximumFractionDigits: 0 })} loss. Exit earlier.
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Options Patterns ──────────────────────────────────────────────────────────

function OptionsPatternsSection({ patterns, loading }: { patterns: OptionsPatterns | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-2xl bg-[#0d1528] border border-[#1c2e4a] p-6 animate-pulse space-y-3">
        <div className="h-4 bg-gray-100 rounded w-40" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-28 bg-gray-50 rounded-xl" />
          <div className="h-28 bg-gray-50 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!patterns || patterns.total_options_trades < 3) {
    return (
      <div className="rounded-2xl bg-[#0d1528] border border-[#1c2e4a] px-6 py-10 text-center">
        <div className="text-3xl mb-2">📊</div>
        <p className="text-sm font-medium text-gray-700">Not enough options data yet</p>
        <p className="text-xs text-slate-500 mt-1">Upload at least 3 options trades to see patterns</p>
      </div>
    )
  }

  // Sort time slots by hour for display
  const slots = Object.entries(patterns.time_slot_win_rate)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .filter(([, v]) => v.total >= 1)

  const bestSlot  = slots.length ? slots.reduce((a, b) => b[1].win_rate > a[1].win_rate ? b : a) : null
  const worstSlot = slots.length > 1 ? slots.reduce((a, b) => b[1].win_rate < a[1].win_rate ? b : a) : null

  const expiryWR    = patterns.expiry_day_win_rate
  const nonExpiryWR = patterns.non_expiry_win_rate
  const expiryDiff  = expiryWR != null && nonExpiryWR != null ? expiryWR - nonExpiryWR : null

  return (
    <div className="rounded-2xl bg-[#0d1528] border border-[#1c2e4a] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#162035] flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <p className="text-sm font-bold text-slate-200">Options Trading Patterns</p>
        <span className="ml-auto text-[11px] font-semibold text-gray-400 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-lg">{patterns.total_options_trades} trades</span>
      </div>

      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Expiry day card */}
        <div className="rounded-xl border border-[#1c2e4a] bg-[#0a1220] p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">📅</span>
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Expiry Day (Thursday) vs Other Days</p>
          </div>

          <div className="space-y-2.5">
            {/* Expiry day */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500 font-medium">Thursday (Expiry)</span>
                <span className={`font-bold ${(expiryWR ?? 0) >= 50 ? "text-green-600" : "text-red-500"}`}>
                  {expiryWR != null ? `${expiryWR.toFixed(0)}%` : "—"}
                  <span className="text-gray-400 font-normal ml-1">({patterns.expiry_day_trades} trades)</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-[#162035] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${(expiryWR ?? 0) >= 50 ? "bg-green-500" : "bg-red-400"}`}
                  style={{ width: `${expiryWR ?? 0}%` }}
                />
              </div>
            </div>

            {/* Non-expiry */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500 font-medium">Non-Expiry Days</span>
                <span className={`font-bold ${(nonExpiryWR ?? 0) >= 50 ? "text-green-600" : "text-red-500"}`}>
                  {nonExpiryWR != null ? `${nonExpiryWR.toFixed(0)}%` : "—"}
                </span>
              </div>
              <div className="h-2 rounded-full bg-[#162035] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${(nonExpiryWR ?? 0) >= 50 ? "bg-green-500" : "bg-red-400"}`}
                  style={{ width: `${nonExpiryWR ?? 0}%` }}
                />
              </div>
            </div>
          </div>

          {expiryDiff != null && (
            <div className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ${
              expiryDiff < -10 ? "bg-red-50 text-red-400 border border-red-100" :
              expiryDiff > 10  ? "bg-green-50 text-green-700 border border-green-100" :
              "bg-blue-50 text-blue-700 border border-blue-100"
            }`}>
              {expiryDiff < -10
                ? `⚠️ You lose ${Math.abs(expiryDiff).toFixed(0)}% more on expiry days — consider sitting out Thursdays`
                : expiryDiff > 10
                ? `✅ You actually perform better on expiry days (+${expiryDiff.toFixed(0)}%)`
                : "ℹ️ No significant difference between expiry and non-expiry days"}
            </div>
          )}
        </div>

        {/* Time slot card */}
        <div className="rounded-xl border border-[#1c2e4a] bg-[#0a1220] p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">⏰</span>
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Win Rate by Time of Day</p>
          </div>

          {slots.length === 0 ? (
            <p className="text-xs text-slate-500">No time data available</p>
          ) : (
            <div className="space-y-2">
              {slots.map(([slot, stat]) => {
                const isBest  = slot === bestSlot?.[0]
                const isWorst = slot === worstSlot?.[0]
                return (
                  <div key={slot}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-500 font-medium">{slot}:00</span>
                        {isBest  && <span className="text-[9px] font-bold text-green-600 bg-green-100 px-1 py-0.5 rounded">BEST</span>}
                        {isWorst && <span className="text-[9px] font-bold text-red-600 bg-red-100 px-1 py-0.5 rounded">WORST</span>}
                      </div>
                      <span className={`font-bold ${stat.win_rate >= 50 ? "text-green-600" : "text-red-500"}`}>
                        {stat.win_rate.toFixed(0)}%
                        <span className="text-gray-400 font-normal ml-1">{stat.wins}/{stat.total}</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#162035] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${stat.win_rate >= 50 ? "bg-green-500" : "bg-red-400"}`}
                        style={{ width: `${stat.win_rate}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {bestSlot && (
            <div className="mt-3 rounded-lg px-3 py-2 bg-green-50 border border-green-100 text-xs text-green-700 font-medium">
              🏆 Your best hour: <strong>{bestSlot[0]}:00</strong> — {bestSlot[1].win_rate.toFixed(0)}% win rate
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Swing Patterns detail ─────────────────────────────────────────────────────

function SwingPatternsSection({ patterns }: { patterns: SwingPatterns }) {
  const sectors = Object.entries(patterns.sector_win_rate)
    .filter(([, v]) => v.total > 0)
    .sort((a, b) => b[1].win_rate - a[1].win_rate)

  const deadMoney = patterns.dead_money_positions ?? []

  return (
    <div className="rounded-2xl bg-[#0d1528] border border-[#1c2e4a] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#162035] flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <p className="text-sm font-bold text-slate-200">Swing Trading Patterns</p>
      </div>

      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Sector performance */}
        <div className="rounded-xl border border-[#1c2e4a] bg-[#0a1220] p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">🏭</span>
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Sector Win Rates</p>
          </div>
          {sectors.length === 0 ? (
            <p className="text-xs text-slate-500">No sector data available yet</p>
          ) : (
            <div className="space-y-2.5">
              {sectors.map(([sector, stat]) => (
                <div key={sector}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400 font-medium">{sector}</span>
                    <span className={`font-bold ${stat.win_rate >= 50 ? "text-green-600" : "text-red-500"}`}>
                      {stat.win_rate.toFixed(0)}%
                      <span className="text-gray-400 font-normal ml-1">({stat.wins}/{stat.total})</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[#162035] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${stat.win_rate >= 50 ? "bg-green-500" : "bg-red-400"}`}
                      style={{ width: `${stat.win_rate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Holding behaviour + dead money */}
        <div className="space-y-3">
          {/* Hold time comparison */}
          <div className="rounded-xl border border-[#1c2e4a] bg-[#0a1220] p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm">⏱</span>
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Holding Behaviour</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center rounded-lg bg-green-50 border border-green-100 py-3">
                <p className="text-xs text-green-600 font-medium">Winners</p>
                <p className="text-xl font-black text-green-700 mt-1">
                  {patterns.avg_holding_days_winners != null ? `${patterns.avg_holding_days_winners}d` : "—"}
                </p>
                <p className="text-[10px] text-green-500 mt-0.5">avg hold time</p>
              </div>
              <div className="text-center rounded-lg bg-red-950/30 border border-red-900/40 py-3">
                <p className="text-xs text-red-500 font-medium">Losers</p>
                <p className="text-xl font-black text-red-600 mt-1">
                  {patterns.avg_holding_days_losers != null ? `${patterns.avg_holding_days_losers}d` : "—"}
                </p>
                <p className="text-[10px] text-red-400 mt-0.5">avg hold time</p>
              </div>
            </div>
            {patterns.avg_holding_days_winners != null && patterns.avg_holding_days_losers != null && (
              <p className={`mt-2 text-xs px-3 py-2 rounded-lg font-medium ${
                patterns.avg_holding_days_losers > patterns.avg_holding_days_winners
                  ? "bg-red-950/30 border border-red-900/40 text-red-400"
                  : "bg-green-50 border border-green-100 text-green-700"
              }`}>
                {patterns.avg_holding_days_losers > patterns.avg_holding_days_winners
                  ? `⚠️ You hold losers ${(patterns.avg_holding_days_losers - patterns.avg_holding_days_winners).toFixed(1)}d longer than winners — classic mistake`
                  : `✅ You cut losses faster than you book profits — good discipline`}
              </p>
            )}
          </div>

          {/* Panic sells */}
          {patterns.panic_sell_count > 0 && (
            <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
              <div className="flex items-center gap-2">
                <span className="text-base">😱</span>
                <div>
                  <p className="text-xs font-semibold text-orange-800">Panic Sells Detected</p>
                  <p className="text-xs text-orange-600 mt-0.5">
                    <strong>{patterns.panic_sell_count}</strong> position{patterns.panic_sell_count !== 1 ? "s" : ""} closed at a loss within 2 days of entry
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Dead money */}
          {deadMoney.length > 0 && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">💤</span>
                <p className="text-xs font-semibold text-amber-800">Dead Money Positions ({deadMoney.length})</p>
              </div>
              {deadMoney.map((t, i) => (
                <div key={i} className="text-xs text-amber-700 flex justify-between py-1 border-b border-amber-100 last:border-0">
                  <span className="font-medium">{t.symbol}</span>
                  <span className="text-amber-500">open &gt; 2× avg hold</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Pattern Insights ─────────────────────────────────────────────────────────

function PatternInsightsSection({
  insights, ready, loading, totalTrades,
}: {
  insights: PatternInsight[]
  ready: boolean
  loading: boolean
  totalTrades: number
}) {
  const needed = Math.max(0, 5 - totalTrades)

  if (loading) {
    return (
      <div className="rounded-2xl bg-[#0d1528] border border-[#1c2e4a] p-6 space-y-3 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-40" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-50 rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/40 px-6 py-8 text-center">
        <div className="text-3xl mb-2">🧠</div>
        <p className="text-sm font-bold text-slate-800 mb-1">Pattern insights unlock after 5 trades</p>
        <p className="text-xs text-slate-500">
          {needed > 0
            ? `Upload ${needed} more trade${needed !== 1 ? "s" : ""} — then we'll show you exactly where you're losing money.`
            : "Processing your trades…"}
        </p>
      </div>
    )
  }

  if (insights.length === 0) {
    return null
  }

  const severityStyle = (s: PatternInsight["severity"]) => {
    if (s === "positive") return { card: "bg-emerald-50 border-emerald-200", icon: "bg-emerald-100", badge: "bg-emerald-100 text-emerald-400" }
    if (s === "warning")  return { card: "bg-amber-50 border-amber-200",   icon: "bg-amber-100",   badge: "bg-amber-100 text-amber-700"   }
    return                         { card: "bg-slate-50 border-slate-200",  icon: "bg-slate-100",   badge: "bg-slate-100 text-slate-600"   }
  }

  return (
    <div className="rounded-2xl bg-[#0d1528] border border-[#1c2e4a] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#162035] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-200">Pattern Insights</p>
            <p className="text-xs text-slate-500 mt-0.5">Based on your last {totalTrades} trades</p>
          </div>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full">
          {insights.length} insight{insights.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {insights.map((insight, i) => {
          const s = severityStyle(insight.severity)
          return (
            <div key={i} className={`rounded-xl p-4 border ${s.card}`}>
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${s.icon}`}>
                  {insight.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-sm font-bold text-slate-900">{insight.title}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.badge}`}>
                      {insight.severity === "positive" ? "Edge" : "Fix this"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{insight.body}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── AI Usage Banner ───────────────────────────────────────────────────────────

function AiUsageBanner() {
  const [usage, setUsage] = useState<UsageInfo | null>(null)

  useEffect(() => {
    getUsage().then(setUsage).catch(() => {})
  }, [])

  if (!usage || usage.is_pro) return null

  const { ai_analyses_used, ai_analyses_limit } = usage
  const remaining = ai_analyses_limit - ai_analyses_used
  const isExhausted = remaining <= 0
  const isNearing   = remaining <= 2 && remaining > 0

  if (!isExhausted && !isNearing) return null

  if (isExhausted) {
    return (
      <div className="rounded-2xl border border-violet-900/50 bg-violet-950/30 px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-violet-900/60 flex items-center justify-center flex-shrink-0">
            <span className="text-base">🧠</span>
          </div>
          <div>
            <p className="text-sm font-bold text-violet-200">You&apos;ve used all {ai_analyses_limit} free AI analyses</p>
            <p className="text-xs text-violet-400 mt-0.5">Journaling &amp; all dashboards remain free forever. Upgrade for unlimited AI coaching.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-black text-violet-300">₹499<span className="font-normal text-violet-500">/mo</span></p>
            <p className="text-[10px] text-violet-500">or ₹3,499/yr</p>
          </div>
          <button className="text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 px-4 py-2 rounded-xl transition-opacity shadow-lg shadow-violet-900/40">
            Upgrade to Pro →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-amber-900/40 bg-amber-950/20 px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-2.5">
        <div className="flex gap-1">
          {Array.from({ length: ai_analyses_limit }).map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full ${i < ai_analyses_used ? "bg-amber-500" : "bg-amber-900/50"}`} />
          ))}
        </div>
        <p className="text-sm font-semibold text-amber-300/80">
          {remaining} free AI {remaining === 1 ? "analysis" : "analyses"} remaining
        </p>
      </div>
      <button className="text-xs font-bold text-amber-400 hover:text-amber-300 bg-amber-950/40 hover:bg-amber-950/60 border border-amber-900/50 px-3 py-1.5 rounded-lg transition-colors">
        Upgrade for unlimited →
      </button>
    </div>
  )
}

function StatCard({ label, value, sub, positive, color, icon }: {
  label: string; value: string; sub: string; positive: boolean | null
  color: "blue" | "green" | "purple" | "amber"; icon: React.ReactNode
}) {
  const colorMap = {
    blue:   { iconBg: "bg-indigo-900/60",  iconText: "text-indigo-400",  accent: "group-hover:border-indigo-500/40"  },
    green:  { iconBg: "bg-emerald-900/60", iconText: "text-emerald-400", accent: "group-hover:border-emerald-500/40" },
    purple: { iconBg: "bg-violet-900/60",  iconText: "text-violet-400",  accent: "group-hover:border-violet-500/40"  },
    amber:  { iconBg: "bg-amber-900/60",   iconText: "text-amber-400",   accent: "group-hover:border-amber-500/40"   },
  }
  const c = colorMap[color]
  const valueColor = positive === true ? "text-emerald-400" : positive === false ? "text-red-400" : "text-slate-100"
  return (
    <div className={`group rounded-2xl bg-[#0d1528] border border-[#1c2e4a] ${c.accent} p-5 flex flex-col gap-3 transition-all duration-200 hover:bg-[#111d33]`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.iconBg} ${c.iconText} flex-shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
        <p className={`text-[26px] font-black tracking-tight leading-none tabular-nums mt-1 ${valueColor}`}>{value}</p>
        <p className="text-[11px] text-slate-600 mt-1.5">{sub}</p>
      </div>
    </div>
  )
}

// ── Trade Heatmap ─────────────────────────────────────────────────────────────

function TradeHeatmap({ trades }: { trades: Trade[] }) {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null)

  // Build date → { pnl, count } map
  const dayMap = new Map<string, { pnl: number; count: number }>()
  trades.forEach((t) => {
    const d = t.trade_date ? String(t.trade_date) : t.created_at?.slice(0, 10)
    if (!d) return
    const e = dayMap.get(d) ?? { pnl: 0, count: 0 }
    dayMap.set(d, { pnl: e.pnl + (t.pnl ?? 0), count: e.count + 1 })
  })

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const WEEKS = 18

  // Build grid: start from WEEKS*7 days ago, aligned to nearest Monday
  const start = new Date(today)
  start.setDate(today.getDate() - WEEKS * 7)
  const dow0 = start.getDay()
  start.setDate(start.getDate() + (dow0 === 0 ? 1 : dow0 === 1 ? 0 : 8 - dow0))

  const weeks: Array<Array<{ dateStr: string; dow: number; pnl: number | null; count: number }>> = []
  const cur = new Date(start)
  for (let w = 0; w < WEEKS; w++) {
    const week: typeof weeks[0] = []
    for (let d = 0; d < 7; d++) {
      const dow = cur.getDay()
      const dateStr = cur.toISOString().slice(0, 10)
      if (dow >= 1 && dow <= 5) {
        const data = dayMap.get(dateStr)
        week.push({ dateStr, dow, pnl: data?.pnl ?? null, count: data?.count ?? 0 })
      }
      cur.setDate(cur.getDate() + 1)
    }
    weeks.push(week)
  }

  // Month labels
  const monthLabels: { label: string; idx: number }[] = []
  let lastMon = -1
  weeks.forEach((wk, i) => {
    if (wk.length === 0) return
    const m = new Date(wk[0].dateStr).getMonth()
    if (m !== lastMon) {
      monthLabels.push({ label: new Date(wk[0].dateStr).toLocaleDateString("en-IN", { month: "short" }), idx: i })
      lastMon = m
    }
  })

  function cellBg(pnl: number | null, count: number, isFuture: boolean) {
    if (isFuture) return "bg-transparent cursor-default"
    if (count === 0 || pnl === null) return "bg-[#162035] hover:bg-[#1c2e4a]"
    if (pnl > 0) {
      if (pnl < 2000) return "bg-emerald-900 hover:bg-emerald-800"
      if (pnl < 8000) return "bg-emerald-600 hover:bg-emerald-500"
      return "bg-emerald-400 hover:bg-emerald-300"
    }
    if (pnl > -2000) return "bg-red-900 hover:bg-red-800"
    if (pnl > -8000) return "bg-red-600 hover:bg-red-500"
    return "bg-red-400 hover:bg-red-300"
  }

  const CELL = 14, GAP = 3

  return (
    <>
      <div className="rounded-2xl bg-[#0d1528] border border-[#1c2e4a] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#162035] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#162035] flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-200">Trading Calendar</p>
              <p className="text-xs text-slate-500 mt-0.5">Daily P&amp;L — last {WEEKS} weeks</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-600 font-medium">Less</span>
            {["bg-[#162035]", "bg-emerald-900", "bg-emerald-600", "bg-emerald-400"].map((c) => (
              <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />
            ))}
            <span className="text-[10px] text-slate-600 font-medium">Profit</span>
            <span className="text-slate-700 mx-1">·</span>
            {["bg-red-900", "bg-red-600", "bg-red-400"].map((c) => (
              <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />
            ))}
            <span className="text-[10px] text-slate-600 font-medium">Loss</span>
          </div>
        </div>

        <div className="px-6 py-4 overflow-x-auto">
          <div className="inline-flex flex-col" style={{ minWidth: `${WEEKS * (CELL + GAP) + 32}px` }}>

            {/* Month labels */}
            <div className="flex mb-1.5 pl-8">
              {weeks.map((_, i) => {
                const lbl = monthLabels.find((m) => m.idx === i)
                return (
                  <div key={i} style={{ width: CELL + GAP, flexShrink: 0 }}>
                    {lbl && <span className="text-[10px] font-semibold text-slate-600">{lbl.label}</span>}
                  </div>
                )
              })}
            </div>

            {/* 5 rows: Mon–Fri */}
            {[1, 2, 3, 4, 5].map((targetDow) => (
              <div key={targetDow} className="flex items-center" style={{ marginBottom: GAP }}>
                <span className="text-[9px] font-medium text-slate-700 w-8 flex-shrink-0">
                  {["", "Mon", "Tue", "Wed", "Thu", "Fri"][targetDow]}
                </span>
                {weeks.map((wk, wi) => {
                  const day = wk.find((d) => d.dow === targetDow)
                  if (!day) return <div key={wi} style={{ width: CELL, height: CELL, marginRight: GAP }} />
                  const isFuture = day.dateStr > todayStr
                  const isToday = day.dateStr === todayStr
                  const bg = cellBg(day.pnl, day.count, isFuture)
                  const tooltipText = day.count > 0
                    ? `${day.dateStr} · ${day.count} trade${day.count > 1 ? "s" : ""} · ${(day.pnl ?? 0) >= 0 ? "+" : "−"}₹${Math.abs(day.pnl ?? 0).toLocaleString("en-IN")}`
                    : `${day.dateStr} · No trades`
                  return (
                    <div
                      key={wi}
                      style={{ width: CELL, height: CELL, marginRight: GAP, flexShrink: 0 }}
                      className={`rounded-sm transition-colors cursor-pointer ${bg} ${isToday ? "ring-1 ring-indigo-500 ring-offset-[1.5px] ring-offset-[#0d1528]" : ""}`}
                      onMouseEnter={(e) => {
                        const r = (e.target as HTMLElement).getBoundingClientRect()
                        setTooltip({ text: tooltipText, x: r.left + r.width / 2, y: r.top })
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tooltip — fixed, not clipped by overflow */}
      {tooltip && (
        <div
          className="fixed z-[999] bg-[#0d1528] border border-[#1c2e4a] text-slate-200 text-xs px-2.5 py-1.5 rounded-lg pointer-events-none shadow-xl whitespace-nowrap"
          style={{ left: tooltip.x, top: tooltip.y - 6, transform: "translateX(-50%) translateY(-100%)" }}
        >
          {tooltip.text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-[#0d1528]" />
        </div>
      )}
    </>
  )
}

function EmptyChart() {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-3">
      <div className="w-12 h-12 rounded-2xl bg-indigo-950/50 border border-indigo-900/50 flex items-center justify-center">
        <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-slate-300">No chart data yet</p>
        <p className="text-xs text-slate-500 mt-1">Your P&L curve will appear after your first trade</p>
      </div>
      <a href="/upload" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 hover:bg-indigo-950/60 border border-indigo-900/50 px-3 py-1.5 rounded-lg transition-colors">
        Upload first trade →
      </a>
    </div>
  )
}

function EmptyTrades() {
  return (
    <div className="flex flex-col items-center justify-center h-44 gap-3">
      <div className="w-12 h-12 rounded-2xl bg-[#162035] border border-[#1c2e4a] flex items-center justify-center">
        <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-slate-300">No trades logged</p>
        <p className="text-xs text-slate-500 mt-1">Upload a screenshot to get AI coaching on your first trade</p>
      </div>
      <a href="/upload" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 hover:bg-indigo-950/60 border border-indigo-900/50 px-3 py-1.5 rounded-lg transition-colors">
        Upload first trade →
      </a>
    </div>
  )
}
