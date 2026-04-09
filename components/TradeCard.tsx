import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trade } from "@/lib/api"

interface TradeCardProps {
  trade: Trade
}

function fmt(n?: number | null, prefix = "₹") {
  if (n == null) return "—"
  return `${prefix}${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(d?: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export default function TradeCard({ trade }: TradeCardProps) {
  const isProfit = (trade.pnl ?? 0) >= 0
  const isBuy = trade.action?.toLowerCase() === "buy"

  return (
    <Card className="w-full shadow-sm border border-gray-100">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-xl font-bold text-gray-900">
            {trade.symbol ?? "Unknown Symbol"}
          </CardTitle>
          <div className="flex items-center gap-2">
            {trade.action && (
              <Badge
                className={
                  isBuy
                    ? "bg-green-100 text-green-700 border-green-200"
                    : "bg-red-100 text-red-700 border-red-200"
                }
                variant="outline"
              >
                {trade.action.toUpperCase()}
              </Badge>
            )}
            {trade.instrument_type && (
              <Badge variant="secondary" className="capitalize">
                {trade.instrument_type}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          <DataRow label="Entry Price" value={fmt(trade.entry_price)} />
          <DataRow label="Exit Price" value={fmt(trade.exit_price)} />
          <DataRow label="Quantity" value={trade.quantity?.toString() ?? "—"} />
          <DataRow
            label="P&L"
            value={fmt(trade.pnl)}
            valueClass={isProfit ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}
          />
          <DataRow
            label="P&L %"
            value={
              trade.pnl_percent != null
                ? `${isProfit ? "+" : ""}${trade.pnl_percent.toFixed(2)}%`
                : "—"
            }
            valueClass={isProfit ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}
          />
          <DataRow label="Date" value={fmtDate(trade.trade_date)} />
          {trade.broker && (
            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs text-gray-500 mb-1">Broker</p>
              <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                {trade.broker}
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function DataRow({
  label,
  value,
  valueClass = "text-gray-800",
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-sm font-medium ${valueClass}`}>{value}</p>
    </div>
  )
}
