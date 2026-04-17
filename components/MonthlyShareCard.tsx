"use client"

import { useRef } from "react"
import { Trade } from "@/lib/api"

interface Props {
  trades: Trade[]
}

function fmt(n: number) {
  const abs = Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  return `${n < 0 ? "−" : "+"}₹${abs}`
}

export default function MonthlyShareCard({ trades }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)

  const now = new Date()
  const cm = now.getMonth(), cy = now.getFullYear()
  const monthName = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" })

  const monthly = trades.filter((t) => {
    if (t.pnl == null) return false
    const d = new Date(String(t.trade_date ?? t.created_at ?? ""))
    return !isNaN(d.getTime()) && d.getMonth() === cm && d.getFullYear() === cy
  })

  if (monthly.length === 0) return null

  const totalPnl = monthly.reduce((s, t) => s + (t.pnl ?? 0), 0)
  const wins = monthly.filter((t) => (t.pnl ?? 0) > 0)
  const losses = monthly.filter((t) => (t.pnl ?? 0) <= 0)
  const winRate = Math.round((wins.length / monthly.length) * 100)
  const best = monthly.reduce((a, b) => ((b.pnl ?? 0) > (a.pnl ?? 0) ? b : a))
  const worst = monthly.reduce((a, b) => ((b.pnl ?? 0) < (a.pnl ?? 0) ? b : a))
  const isProfit = totalPnl >= 0

  async function handleShare() {
    const card = cardRef.current
    if (!card) return
    try {
      // Dynamic import to avoid SSR issues
      const html2canvas = (await import("html2canvas")).default
      const canvas = await html2canvas(card, { backgroundColor: null, scale: 2 })
      canvas.toBlob(async (blob) => {
        if (!blob) return
        if (navigator.share && navigator.canShare?.({ files: [new File([blob], "tradfy-month.png", { type: "image/png" })] })) {
          await navigator.share({
            title: `My ${monthName} Trading Summary`,
            files: [new File([blob], "tradfy-month.png", { type: "image/png" })],
          })
        } else {
          // Fallback: download
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = `tradfy-${monthName.replace(" ", "-")}.png`
          a.click()
          URL.revokeObjectURL(url)
        }
      }, "image/png")
    } catch {
      // Silently fail — share/download is optional
    }
  }

  return (
    <div className="space-y-3">
      {/* The shareable card */}
      <div
        ref={cardRef}
        className={`rounded-2xl p-5 ${isProfit ? "bg-gradient-to-br from-emerald-600 to-teal-700" : "bg-gradient-to-br from-red-600 to-rose-700"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">EdgeJournal</p>
            <p className="text-sm font-bold text-white">{monthName}</p>
          </div>
          <span className="text-2xl">{isProfit ? "📈" : "📉"}</span>
        </div>

        {/* Big P&L */}
        <div className="mb-4">
          <p className="text-3xl font-black text-white tracking-tight">{fmt(totalPnl)}</p>
          <p className="text-xs text-white/70 mt-0.5">{monthly.length} trades logged</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-xl bg-white/10 px-3 py-2 text-center">
            <p className="text-lg font-black text-white">{winRate}%</p>
            <p className="text-[10px] text-white/60">Win rate</p>
          </div>
          <div className="rounded-xl bg-white/10 px-3 py-2 text-center">
            <p className="text-lg font-black text-white">{wins.length}</p>
            <p className="text-[10px] text-white/60">Winners</p>
          </div>
          <div className="rounded-xl bg-white/10 px-3 py-2 text-center">
            <p className="text-lg font-black text-white">{losses.length}</p>
            <p className="text-[10px] text-white/60">Losers</p>
          </div>
        </div>

        {/* Best / Worst */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/10 px-3 py-2">
            <p className="text-[10px] text-white/60 mb-0.5">Best trade</p>
            <p className="text-sm font-bold text-white truncate">{best.symbol ?? "—"}</p>
            <p className="text-xs text-emerald-200">{fmt(best.pnl ?? 0)}</p>
          </div>
          <div className="rounded-xl bg-white/10 px-3 py-2">
            <p className="text-[10px] text-white/60 mb-0.5">Worst trade</p>
            <p className="text-sm font-bold text-white truncate">{worst.symbol ?? "—"}</p>
            <p className="text-xs text-red-200">{fmt(worst.pnl ?? 0)}</p>
          </div>
        </div>

        {/* Footer watermark */}
        <p className="text-[9px] text-white/30 mt-3 text-right">tradfy.in · AI Trade Journal</p>
      </div>

      {/* Share button */}
      <button
        onClick={handleShare}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        Share monthly summary
      </button>
    </div>
  )
}
