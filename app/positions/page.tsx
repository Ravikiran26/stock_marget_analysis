"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getOpenPositions, setUserId, OpenPosition } from "@/lib/api"

const NOTES_KEY = (id: string) => `tradfy_notes_${id}`

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtDate(d?: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

function DaysHeldPill({ days }: { days: number }) {
  if (days > 15) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-red-50 text-red-600 border border-red-100">
        ⚠️ {days} days · dead money
      </span>
    )
  }
  if (days >= 7) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
        🕐 {days} days
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-green-50 text-green-700 border border-green-100">
      ✓ {days} days
    </span>
  )
}

function PositionCard({
  position,
  onClose,
}: {
  position: OpenPosition
  onClose: (id: string, symbol: string) => void
}) {
  const { trade, days_held } = position
  const [notes, setNotes] = useState("")
  const [editingNotes, setEditingNotes] = useState(false)
  const [draft, setDraft] = useState("")

  useEffect(() => {
    if (trade.id) {
      const saved = localStorage.getItem(NOTES_KEY(trade.id))
      if (saved) setNotes(saved)
    }
  }, [trade.id])

  function saveNotes() {
    if (trade.id) {
      localStorage.setItem(NOTES_KEY(trade.id), draft)
      setNotes(draft)
    }
    setEditingNotes(false)
  }

  function startEdit() {
    setDraft(notes)
    setEditingNotes(true)
  }

  const capitalCommitted =
    (trade.entry_price ?? 0) * (trade.quantity ?? 0)

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      {/* top bar */}
      <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-50">
        <div className="flex items-start gap-4 min-w-0">
          {/* symbol badge */}
          <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-sm font-black text-white"
            style={{ background: trade.trade_type === "futures_swing" ? "linear-gradient(135deg, #7c3aed, #6366f1)" : "linear-gradient(135deg, #2563eb, #3b82f6)" }}>
            {(trade.symbol ?? "?")[0]}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-gray-900 text-base">{trade.symbol ?? "Unknown"}</p>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                trade.trade_type === "futures_swing"
                  ? "bg-violet-50 text-violet-700"
                  : "bg-blue-50 text-blue-700"
              }`}>
                {trade.trade_type === "futures_swing" ? "Futures Swing" : "Equity Swing"}
              </span>
              {trade.sector && (
                <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                  {trade.sector}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{trade.broker ?? ""}</p>
          </div>
        </div>
        <DaysHeldPill days={days_held} />
      </div>

      {/* metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-100">
        {[
          { label: "Entry price", value: trade.entry_price != null ? fmt(trade.entry_price) : "—" },
          { label: "Quantity", value: trade.quantity != null ? String(trade.quantity) : "—" },
          { label: "Capital locked", value: capitalCommitted > 0 ? fmt(capitalCommitted) : "—" },
          { label: "Entry date", value: fmtDate(trade.trade_date ?? trade.created_at) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white px-5 py-4">
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className="text-sm font-semibold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* notes */}
      <div className="px-6 py-4 border-t border-gray-50">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Thesis / Stop level</p>
          {!editingNotes && (
            <button
              onClick={startEdit}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              {notes ? "Edit notes" : "+ Add notes"}
            </button>
          )}
        </div>

        {editingNotes ? (
          <div className="space-y-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. Breakout from 6-month range. Stop below ₹1,450. Target ₹1,700."
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={saveNotes}
                className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setEditingNotes(false)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : notes ? (
          <p className="text-sm text-gray-600 leading-relaxed">{notes}</p>
        ) : (
          <p className="text-xs text-gray-300 italic">No notes yet. Add your trade thesis or stop loss level.</p>
        )}
      </div>

      {/* actions */}
      <div className="px-6 py-4 border-t border-gray-50 flex items-center gap-3">
        <button
          onClick={() => onClose(trade.id!, trade.symbol ?? "")}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-sm font-semibold transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Close position
        </button>
        <span className="text-xs text-gray-400">Upload your sell screenshot to close</span>
      </div>
    </div>
  )
}

export default function PositionsPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [positions, setPositions] = useState<OpenPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace("/"); return }
      setUserId(data.session.user.id)
      setChecking(false)
      try {
        const p = await getOpenPositions()
        setPositions(p)
      } catch {
        setError("Could not load positions. Make sure the backend is running.")
      } finally {
        setLoading(false)
      }
    })
  }, [router])

  function handleClose(tradeId: string, symbol: string) {
    router.push(`/upload?close=${tradeId}&symbol=${encodeURIComponent(symbol)}`)
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

  return (
    <div className="min-h-screen" style={{ background: "#f6f8fc" }}>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">

        {/* header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Open Positions</h1>
            <p className="text-sm text-gray-400 mt-0.5">Swing trades you haven&apos;t closed yet</p>
          </div>
          <a
            href="/upload"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-sm font-semibold transition-colors shadow-sm shadow-blue-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            New trade
          </a>
        </div>

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-2xl bg-white border border-gray-100 p-6 animate-pulse">
                <div className="h-5 bg-gray-100 rounded w-1/3 mb-3" />
                <div className="h-4 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : positions.length === 0 ? (
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-16 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
              <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold text-gray-800 mb-1">No open positions</p>
              <p className="text-sm text-gray-400 max-w-xs">
                Upload a buy screenshot and select &quot;Equity Swing&quot; or &quot;Futures Swing&quot; to start tracking a swing trade.
              </p>
            </div>
            <a
              href="/upload"
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 text-sm font-semibold transition-colors"
            >
              Upload opening trade →
            </a>
          </div>
        ) : (
          <div className="space-y-5">
            {positions.map((pos) => (
              <PositionCard key={pos.trade.id} position={pos} onClose={handleClose} />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
