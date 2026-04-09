"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface FeedbackCardProps {
  feedback: string
  tradeType?: string  // options_intraday | equity_swing | futures_swing
}

const TYPE_CONFIG = {
  equity_swing: {
    label: "Swing Coach",
    borderColor: "border-l-emerald-500",
    badgeBg: "bg-emerald-50 text-emerald-700",
    dotColor: "bg-emerald-100 text-emerald-700",
    icon: "📊",
    tags: ["Holding period", "Sector", "Entry timing"],
  },
  futures_swing: {
    label: "Futures Coach",
    borderColor: "border-l-violet-500",
    badgeBg: "bg-violet-50 text-violet-700",
    dotColor: "bg-violet-100 text-violet-700",
    icon: "⚡",
    tags: ["Overnight risk", "Margin", "Expiry"],
  },
  options_intraday: {
    label: "AI Coach Says",
    borderColor: "border-l-blue-500",
    badgeBg: "bg-blue-50 text-blue-700",
    dotColor: "bg-blue-100 text-blue-700",
    icon: "🤖",
    tags: ["Psychology", "Execution", "Risk"],
  },
}

export default function FeedbackCard({ feedback, tradeType }: FeedbackCardProps) {
  const cfg = TYPE_CONFIG[tradeType as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.options_intraday

  // Strip markdown and split into lines
  const lines = feedback
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !l.startsWith("#"))  // remove heading lines
    .map((l) =>
      l
        .replace(/\*\*/g, "")   // remove bold
        .replace(/\*/g, "")     // remove italic
        .trim()
    )
    .filter(Boolean)

  // Separate disclaimer (last line starting with ⚠️ or "Not investment advice")
  const disclaimer = lines.find(
    (l) => l.startsWith("⚠️") || l.toLowerCase().startsWith("not investment advice")
  )
  const insights = lines.filter((l) => l !== disclaimer)

  return (
    <Card className={`w-full shadow-sm border-l-4 ${cfg.borderColor} border border-gray-100`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg text-gray-900">
            <span className="text-2xl">{cfg.icon}</span>
            {cfg.label}
          </CardTitle>
          <div className="flex gap-1.5">
            {cfg.tags.map((tag) => (
              <span
                key={tag}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.badgeBg}`}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {insights.map((line, i) => {
          const isNumbered = /^\d+\./.test(line)
          return (
            <div key={i} className="flex gap-3">
              {isNumbered && (
                <span className={`flex-shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center mt-0.5 ${cfg.dotColor}`}>
                  {line.match(/^(\d+)\./)?.[1]}
                </span>
              )}
              <p className="text-sm text-gray-700 leading-relaxed">
                {isNumbered ? line.replace(/^\d+\.\s*/, "") : line}
              </p>
            </div>
          )
        })}

        {disclaimer && (
          <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">
            {disclaimer}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
