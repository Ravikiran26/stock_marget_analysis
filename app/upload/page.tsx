"use client"

import { useCallback, useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useDropzone, FileRejection } from "react-dropzone"
import { supabase } from "@/lib/supabase"
import {
  uploadTradeScreenshot,
  closePosition,
  getOpenPositions,
  setUserId,
  importTrades,
  getUsage,
  FeedbackResponse,
  MultiTradeResponse,
  UploadResponse,
  isMultiTrade,
  OpenPosition,
  ImportResult,
} from "@/lib/api"
import TradeCard from "@/components/TradeCard"
import FeedbackCard from "@/components/FeedbackCard"
import PaywallModal from "@/components/PaywallModal"
import { Button } from "@/components/ui/button"

const FREE_LIMIT_FALLBACK = 10 // matches backend FREE_AI_LIMIT; used until API responds
const ACCEPTED = { "image/jpeg": [], "image/png": [], "image/webp": [] }
const ACCEPTED_CSV = { "text/csv": [], "application/vnd.ms-excel": [], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [] }
const MAX_SIZE = 10 * 1024 * 1024

type Instrument = "options" | "equity_swing" | "futures_swing"
type OptionsStyle = "options_scalping" | "options_intraday" | "options_positional"
type TradeType = OptionsStyle | "equity_swing" | "futures_swing"
type TradeDirection = "open" | "close"
type UploadMode = "screenshot" | "csv"

const BROKERS = [
  { value: "zerodha",  label: "Zerodha",  note: "Tradebook / P&L CSV" },
  { value: "upstox",   label: "Upstox",   note: "Trade history CSV" },
  { value: "groww",    label: "Groww",    note: "P&L or transaction CSV" },
  { value: "dhan",     label: "Dhan",     note: "Tradebook CSV" },
]

const INSTRUMENTS: { value: Instrument; label: string; sub: string; icon: string }[] = [
  { value: "options",       label: "Options",      sub: "CE · PE · F&O",      icon: "M13 10V3L4 14h7v7l9-11h-7z" },
  { value: "equity_swing",  label: "Equity Swing", sub: "CNC · Delivery",     icon: "M7 20l4-16m2 16l4-16M6 9h14M4 15h14" },
  { value: "futures_swing", label: "Futures",      sub: "NRML · FUT · Carry", icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" },
]

const OPTIONS_STYLES: { value: OptionsStyle; label: string; sub: string; desc: string }[] = [
  {
    value: "options_scalping",
    label: "Scalping",
    sub: "Seconds – 5 min",
    desc: "Brokerage impact, timing, noise",
  },
  {
    value: "options_intraday",
    label: "Intraday",
    sub: "Same day exit",
    desc: "Setup quality, VIX, Greeks",
  },
  {
    value: "options_positional",
    label: "Positional",
    sub: "Overnight & multi-day",
    desc: "Theta decay, IV crush, gap risk",
  },
]

// Inner component that uses useSearchParams
function UploadPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [checking, setChecking] = useState(true)

  // core upload state
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<UploadResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aiUsed, setAiUsed] = useState<number>(0)
  const [aiLimit, setAiLimit] = useState<number>(FREE_LIMIT_FALLBACK)
  const [showPaywall, setShowPaywall] = useState(false)

  // upload mode
  const [uploadMode, setUploadMode] = useState<UploadMode>("screenshot")

  // CSV import state
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvBroker, setCsvBroker] = useState<string>("")
  const [csvLoading, setCsvLoading] = useState(false)
  const [csvResult, setCsvResult] = useState<ImportResult | null>(null)
  const [csvError, setCsvError] = useState<string | null>(null)

  // 2-step instrument/style state
  const [instrument, setInstrument] = useState<Instrument | null>(null)
  const [optionsStyle, setOptionsStyle] = useState<OptionsStyle | null>(null)
  const [tradeDirection, setTradeDirection] = useState<TradeDirection>("open")
  const [openPositions, setOpenPositions] = useState<OpenPosition[]>([])
  const [loadingPositions, setLoadingPositions] = useState(false)
  const [linkedTradeId, setLinkedTradeId] = useState<string>("")

  // Resolved trade type sent to backend
  const tradeType: TradeType | null =
    instrument === "options"
      ? optionsStyle ?? null
      : instrument ?? null
  const isSwing = instrument === "equity_swing" || instrument === "futures_swing"
  const isOptionsSelected = instrument === "options"
  const canProceedToUpload = tradeType !== null

  // Auth guard + fetch real quota from backend
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace("/"); return }
      setUserId(data.session.user.id)
      setChecking(false)
      try {
        const usage = await getUsage()
        setAiUsed(usage.ai_analyses_used)
        setAiLimit(usage.ai_analyses_limit)
      } catch {
        // fall back to defaults — upload will still work; backend enforces the real limit
      }
    })
  }, [router])

  // Pre-select position from URL ?close=ID&symbol=SYM
  useEffect(() => {
    const closeId = searchParams.get("close")
    if (closeId) {
      setInstrument("equity_swing")
      setTradeDirection("close")
      setLinkedTradeId(closeId)
    }
  }, [searchParams])

  // Fetch open positions when closing a swing trade
  useEffect(() => {
    if (isSwing && tradeDirection === "close" && openPositions.length === 0) {
      setLoadingPositions(true)
      getOpenPositions()
        .then(setOpenPositions)
        .catch(() => setOpenPositions([]))
        .finally(() => setLoadingPositions(false))
    }
  }, [isSwing, tradeDirection, openPositions.length])

  const onDrop = useCallback((accepted: File[], rejected: FileRejection[]) => {
    setError(null)
    setResult(null)
    if (rejected.length > 0) {
      const msg = rejected[0]?.errors[0]?.message ?? "Invalid file"
      setError(msg.includes("larger") ? "File is too large. Max 10 MB." : "Only JPG, PNG, and WEBP files are supported.")
      return
    }
    const f = accepted[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxSize: MAX_SIZE,
    multiple: false,
  })

  const onCsvDrop = useCallback((accepted: File[]) => {
    setCsvError(null)
    if (accepted[0]) setCsvFile(accepted[0])
  }, [])
  const { getRootProps: getCsvRootProps, getInputProps: getCsvInputProps, isDragActive: isCsvDragActive } = useDropzone({
    onDrop: onCsvDrop,
    accept: ACCEPTED_CSV,
    maxSize: MAX_SIZE,
    multiple: false,
  })

  async function handleCsvImport() {
    if (!csvFile || !csvBroker) return
    setCsvLoading(true)
    setCsvError(null)
    setCsvResult(null)
    try {
      const result = await importTrades(csvFile, csvBroker)
      setCsvResult(result)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Import failed. Make sure the file is a valid broker export."
      setCsvError(msg)
    } finally {
      setCsvLoading(false)
    }
  }

  function handleCsvReset() {
    setCsvFile(null)
    setCsvResult(null)
    setCsvError(null)
  }

  async function handleAnalyse() {
    if (!file || !tradeType) return
    if (aiUsed >= aiLimit) {
      setShowPaywall(true)
      return
    }
    // Closing swing: need a linked position selected
    if (isSwing && tradeDirection === "close" && !linkedTradeId) {
      setError("Please select which open position you are closing.")
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      let data: UploadResponse

      if (isSwing && tradeDirection === "close" && linkedTradeId) {
        // Use the dedicated close endpoint
        data = await closePosition(linkedTradeId, file)
      } else {
        // Normal upload — pass trade_type so backend uses correct AI prompt
        data = await uploadTradeScreenshot(file, { trade_type: tradeType })
      }

      setResult(data)
      // Refresh usage from backend so the quota display is accurate
      try {
        const usage = await getUsage()
        setAiUsed(usage.ai_analyses_used)
        setAiLimit(usage.ai_analyses_limit)
      } catch {
        setAiUsed((n) => n + 1)
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Something went wrong. Please try again."
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setFile(null)
    setPreview(null)
    setResult(null)
    setError(null)
    // Don't reset trade type — user likely wants to upload another of the same type
  }

  function handleInstrumentChange(i: Instrument) {
    setInstrument(i)
    setOptionsStyle(null)
    setTradeDirection("open")
    setLinkedTradeId("")
    setError(null)
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-400 text-sm">
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
          </svg>
          Loading…
        </div>
      </div>
    )
  }

  const used = aiUsed
  const remaining = Math.max(0, aiLimit - used)
  const atLimit = used >= aiLimit

  const closeLabel =
    isSwing && tradeDirection === "close"
      ? "Analyse & Close Position →"
      : !canProceedToUpload
      ? "Select trade type above →"
      : "Analyse Trade →"

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} limit={aiLimit} />}

      {/* ── Header ── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Log a Trade</h1>
            <p className="text-sm text-gray-400">
              Upload a screenshot for instant AI feedback, or import your full history from a broker CSV.
            </p>
          </div>
        </div>
      </div>

      {/* ── Mode Tabs ── */}
      <div className="mb-8 flex gap-1 rounded-2xl bg-gray-100/80 p-1">
        <button
          onClick={() => setUploadMode("screenshot")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all ${
            uploadMode === "screenshot"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Screenshot
        </button>
        <button
          onClick={() => setUploadMode("csv")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all ${
            uploadMode === "csv"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Import CSV
        </button>
      </div>

      {/* ── CSV Import Panel ── */}
      {uploadMode === "csv" && (
        <div className="space-y-6">
          {csvResult ? (
            /* ── CSV Success ── */
            <div className="space-y-6">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{csvResult.broker} import complete</p>
                    <p className="text-sm text-gray-500">{csvFile?.name}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-white border border-emerald-100 p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900">{csvResult.imported}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Trades imported</p>
                  </div>
                  <div className="rounded-xl bg-white border border-blue-100 p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">{csvResult.open_positions}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Open positions</p>
                  </div>
                  <div className="rounded-xl bg-white border border-gray-100 p-4 text-center">
                    <p className="text-2xl font-bold text-gray-700">{csvResult.closed_trades}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Closed trades</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  Your trades are now in My Trades. AI coaching is available for individual options trades via the trade drawer.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCsvReset}
                  className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Import another file
                </button>
                <a
                  href="/trades"
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 text-sm font-semibold transition-colors"
                >
                  View My Trades →
                </a>
              </div>
            </div>
          ) : (
            <>
              {/* ── Broker selector ── */}
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Select your broker</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {BROKERS.map((b) => (
                    <button
                      key={b.value}
                      onClick={() => setCsvBroker(b.value)}
                      className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border text-sm font-semibold transition-all ${
                        csvBroker === b.value
                          ? "bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-200"
                          : "bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-white"
                      }`}
                    >
                      {b.label}
                      <span className={`text-[10px] font-normal text-center leading-tight ${csvBroker === b.value ? "text-blue-200" : "text-gray-400"}`}>
                        {b.note}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── CSV drop zone ── */}
              <div
                {...getCsvRootProps()}
                className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-all
                  ${isCsvDragActive ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50"}`}
              >
                <input {...getCsvInputProps()} />
                {csvFile ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-gray-800">{csvFile.name}</p>
                    <p className="text-xs text-gray-400">{(csvFile.size / 1024).toFixed(0)} KB · click to replace</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <span className="text-5xl">📊</span>
                    <p className="text-base font-medium text-gray-700">
                      {isCsvDragActive ? "Drop it here!" : "Drop your broker CSV or Excel file here"}
                    </p>
                    <p className="text-sm text-gray-400">or click to browse</p>
                    <p className="text-xs text-gray-300 mt-2">CSV · XLSX · XLS · max 10 MB</p>
                  </div>
                )}
              </div>

              {/* How to export hint */}
              {csvBroker && (
                <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-xs text-amber-700 flex gap-2">
                  <span className="mt-0.5">💡</span>
                  <span>
                    {csvBroker === "zerodha" && "In Zerodha Console → Reports → Tradebook → select date range → Download CSV"}
                    {csvBroker === "upstox" && "In Upstox → Reports → Trade History → select date range → Export to CSV"}
                    {csvBroker === "groww" && "In Groww → P&L → Download P&L Report or Transaction Statement (CSV)"}
                    {csvBroker === "dhan" && "In Dhan → Reports → Tradebook → select date range → Export CSV"}
                  </span>
                </div>
              )}

              {csvError && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                  ⚠️ {csvError}
                </div>
              )}

              <Button
                onClick={handleCsvImport}
                disabled={!csvFile || !csvBroker || csvLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-8 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {csvLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Importing trades…
                  </span>
                ) : (
                  "Import Trades →"
                )}
              </Button>
            </>
          )}
        </div>
      )}

      {uploadMode === "screenshot" && (
      <>
      {/* ── Quota badge ── */}
      <div className="mb-6 flex justify-end">
        {!checking && (
          <button
            onClick={atLimit ? () => setShowPaywall(true) : undefined}
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 border text-sm transition-colors ${
              atLimit
                ? "bg-red-50 border-red-100 cursor-pointer hover:bg-red-100"
                : remaining <= 2
                ? "bg-amber-50 border-amber-100"
                : "bg-gray-50 border-gray-100"
            }`}
          >
            <div className="flex gap-1">
              {Array.from({ length: aiLimit }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full ${
                    i < used ? (atLimit ? "bg-red-400" : "bg-blue-500") : "bg-gray-200"
                  }`}
                />
              ))}
            </div>
            <span className={`font-semibold ${
              atLimit ? "text-red-600" : remaining <= 2 ? "text-amber-600" : "text-gray-600"
            }`}>
              {atLimit
                ? "Free limit reached · Upgrade →"
                : `${remaining} free ${remaining === 1 ? "analysis" : "analyses"} left`}
            </span>
          </button>
        )}
      </div>

      {/* ── Paywall wall ── */}
      {atLimit && !result && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-10 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white border border-red-100 flex items-center justify-center shadow-sm">
            <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H9m3-4V9m0 0V7m0 2h2m-2 0H9" />
            </svg>
          </div>
          <div>
            <p className="text-base font-bold text-gray-900 mb-1">You&apos;ve used all {aiLimit} free trade analyses</p>
            <p className="text-sm text-gray-500 max-w-xs">
              Upgrade to Pro to continue getting AI coaching on your trades. Paid plans are launching soon.
            </p>
          </div>
          <button
            onClick={() => setShowPaywall(true)}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 text-sm font-semibold transition-colors"
          >
            See upgrade options →
          </button>
        </div>
      )}

      {/* ── Upload form ── */}
      {!atLimit && !result && (
        <div className="space-y-6">

          {/* ── 1. Instrument selector ── */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black">1</span>
              <p className="text-sm font-bold text-gray-700">What did you trade?</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {INSTRUMENTS.map((ins) => (
                <button
                  key={ins.value}
                  onClick={() => handleInstrumentChange(ins.value)}
                  className={`relative flex flex-col items-center gap-2 px-3 py-5 rounded-xl border-2 text-sm font-semibold transition-all ${
                    instrument === ins.value
                      ? "bg-gradient-to-br from-blue-600 to-indigo-600 border-blue-500 text-white shadow-lg shadow-blue-200"
                      : "bg-gray-50/80 border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50/30 hover:text-gray-800"
                  }`}
                >
                  {instrument === ins.value && (
                    <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  )}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${instrument === ins.value ? "bg-white/20" : "bg-white border border-gray-100 shadow-sm"}`}>
                    <svg className={`w-5 h-5 ${instrument === ins.value ? "text-white" : "text-blue-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={ins.icon} />
                    </svg>
                  </div>
                  <span className="font-bold">{ins.label}</span>
                  <span className={`text-[10px] font-medium ${instrument === ins.value ? "text-blue-100" : "text-gray-400"}`}>
                    {ins.sub}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── 2. Options style sub-selector (Options only) ── */}
          {isOptionsSelected && (
            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-blue-50/40 p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-black">2</span>
                <p className="text-sm font-bold text-indigo-800">How did you trade it?</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {OPTIONS_STYLES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setOptionsStyle(s.value)}
                    className={`relative flex flex-col gap-1.5 px-3 py-4 rounded-xl border-2 text-left transition-all ${
                      optionsStyle === s.value
                        ? "bg-gradient-to-br from-indigo-600 to-blue-600 border-indigo-500 text-white shadow-lg shadow-indigo-200"
                        : "bg-white border-indigo-100 text-gray-700 hover:border-indigo-300 hover:shadow-sm"
                    }`}
                  >
                    {optionsStyle === s.value && (
                      <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    )}
                    <span className="text-sm font-bold">{s.label}</span>
                    <span className={`text-[10px] font-semibold ${optionsStyle === s.value ? "text-indigo-200" : "text-indigo-500"}`}>
                      {s.sub}
                    </span>
                    <span className={`text-[10px] leading-tight ${optionsStyle === s.value ? "text-blue-100" : "text-gray-400"}`}>
                      {s.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── 3. Direction selector (swing only) ── */}
          {isSwing && (
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Is this a buy (opening) or sell (closing) trade?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setTradeDirection("open"); setLinkedTradeId("") }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
                    tradeDirection === "open"
                      ? "bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-200"
                      : "bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Opening trade
                </button>
                <button
                  onClick={() => setTradeDirection("close")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
                    tradeDirection === "close"
                      ? "bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-200"
                      : "bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Closing trade
                </button>
              </div>
            </div>
          )}

          {/* ── 4. Open position selector (swing close only) ── */}
          {isSwing && tradeDirection === "close" && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">
                Which position are you closing?
              </p>
              {loadingPositions ? (
                <div className="flex items-center gap-2 text-sm text-blue-600 py-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                  </svg>
                  Loading open positions…
                </div>
              ) : openPositions.length === 0 ? (
                <div className="text-sm text-blue-600 py-2">
                  No open positions found.{" "}
                  <button
                    onClick={() => setTradeDirection("open")}
                    className="underline font-semibold"
                  >
                    Upload as an opening trade instead?
                  </button>
                </div>
              ) : (
                <select
                  value={linkedTradeId}
                  onChange={(e) => setLinkedTradeId(e.target.value)}
                  className="w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="">— Select open position —</option>
                  {openPositions.map(({ trade, days_held }) => (
                    <option key={trade.id} value={trade.id}>
                      {trade.symbol} · {trade.trade_type === "futures_swing" ? "Futures" : "Equity"} · Entry{" "}
                      {trade.entry_price != null ? `₹${trade.entry_price}` : "?"} · {days_held}d held
                      {trade.sector ? ` · ${trade.sector}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* ── 5. Drop zone ── */}
          <div
            {...getRootProps()}
            className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-all
              ${isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50"}`}
          >
            <input {...getInputProps()} />
            {preview ? (
              <div className="flex flex-col items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Trade preview" className="max-h-72 rounded-xl shadow object-contain" />
                <p className="text-sm text-gray-500 font-medium">{file?.name}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <span className="text-5xl">
                  {isSwing && tradeDirection === "close" ? "📤" : "📂"}
                </span>
                <p className="text-base font-medium text-gray-700">
                  {isDragActive
                    ? "Drop it here!"
                    : isSwing && tradeDirection === "close"
                    ? "Drop your sell/exit screenshot here"
                    : "Drag & drop your screenshot here"}
                </p>
                <p className="text-sm text-gray-400">or click to browse</p>
                <p className="text-xs text-gray-300 mt-2">JPG · PNG · WEBP · max 10 MB</p>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              ⚠️ {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleAnalyse}
              disabled={!file || loading || !canProceedToUpload || (isSwing && tradeDirection === "close" && !linkedTradeId)}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-8 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  AI is reading your trade…
                </span>
              ) : (
                closeLabel
              )}
            </Button>
            {file && !loading && (
              <button onClick={handleReset} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {result && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {isMultiTrade(result)
                ? `${result.count} trades logged ✅`
                : isSwing && tradeDirection === "close"
                ? "Position closed ✅"
                : "Analysis complete ✅"}
            </h2>
            <button onClick={handleReset} className="text-sm text-blue-600 hover:underline font-medium">
              Upload another trade
            </button>
          </div>

          {isMultiTrade(result) ? (
            <div className="space-y-4">
              <FeedbackCard feedback={result.feedback} tradeType="options_intraday" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.trades.map((trade, i) => (
                  <TradeCard key={trade.id ?? i} trade={trade} />
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <TradeCard trade={(result as FeedbackResponse).trade} />
              <FeedbackCard feedback={result.feedback} tradeType={(result as FeedbackResponse).trade.trade_type} />
            </div>
          )}
        </div>
      )}
      </>
      )}
    </div>
  )
}

// Wrap with Suspense because useSearchParams requires it in Next.js App Router
export default function UploadPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading…</div>
    }>
      <UploadPageInner />
    </Suspense>
  )
}
