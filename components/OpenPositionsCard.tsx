"use client"

import { useRouter } from "next/navigation"
import { OpenPosition } from "@/lib/api"

interface OpenPositionsCardProps {
  positions: OpenPosition[]
}

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function DaysHeldBadge({ days }: { days: number }) {
  if (days > 15) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-red-50 text-red-600 border border-red-100">
        ⚠️ {days}d — dead money
      </span>
    )
  }
  if (days >= 7) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
        {days}d
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-green-50 text-green-700 border border-green-100">
      {days}d
    </span>
  )
}

export default function OpenPositionsCard({ positions }: OpenPositionsCardProps) {
  const router = useRouter()

  const capitalLocked = positions.reduce((sum, p) => {
    const ep = p.trade.entry_price ?? 0
    const qty = p.trade.quantity ?? 0
    return sum + ep * qty
  }, 0)

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <p className="text-sm font-semibold text-gray-900">Open Positions</p>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
              {positions.length}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Capital locked:{" "}
            <span className="font-semibold text-gray-700">
              {capitalLocked > 0 ? fmt(capitalLocked) : "—"}
            </span>
          </p>
        </div>
        <a
          href="/positions"
          className="text-xs font-semibold text-blue-600 hover:text-blue-700"
        >
          View all →
        </a>
      </div>

      {/* table — desktop */}
      <div className="hidden sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50">
              <th className="text-left text-xs font-medium text-gray-400 px-6 py-3">Symbol</th>
              <th className="text-left text-xs font-medium text-gray-400 px-3 py-3">Type</th>
              <th className="text-left text-xs font-medium text-gray-400 px-3 py-3">Entry</th>
              <th className="text-left text-xs font-medium text-gray-400 px-3 py-3">Days held</th>
              <th className="text-left text-xs font-medium text-gray-400 px-3 py-3">Sector</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {positions.map(({ trade, days_held }) => (
              <tr key={trade.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-3.5">
                  <p className="font-semibold text-gray-900">{trade.symbol ?? "—"}</p>
                  <p className="text-xs text-gray-400">{trade.broker ?? ""}</p>
                </td>
                <td className="px-3 py-3.5">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-violet-50 text-violet-700">
                    {trade.trade_type === "futures_swing" ? "Futures" : "Equity"}
                  </span>
                </td>
                <td className="px-3 py-3.5 text-gray-700 font-medium">
                  {trade.entry_price != null ? fmt(trade.entry_price) : "—"}
                </td>
                <td className="px-3 py-3.5">
                  <DaysHeldBadge days={days_held} />
                </td>
                <td className="px-3 py-3.5">
                  {trade.sector ? (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      {trade.sector}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
                <td className="px-6 py-3.5">
                  <button
                    onClick={() =>
                      router.push(
                        `/upload?close=${trade.id}&symbol=${encodeURIComponent(trade.symbol ?? "")}`
                      )
                    }
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Close position →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* mobile list */}
      <div className="sm:hidden divide-y divide-gray-50">
        {positions.map(({ trade, days_held }) => (
          <div key={trade.id} className="px-4 py-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">{trade.symbol ?? "—"}</p>
              <div className="flex items-center gap-2 mt-1">
                <DaysHeldBadge days={days_held} />
                {trade.sector && (
                  <span className="text-xs text-gray-400">{trade.sector}</span>
                )}
              </div>
            </div>
            <button
              onClick={() =>
                router.push(
                  `/upload?close=${trade.id}&symbol=${encodeURIComponent(trade.symbol ?? "")}`
                )
              }
              className="flex-shrink-0 text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg"
            >
              Close →
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
