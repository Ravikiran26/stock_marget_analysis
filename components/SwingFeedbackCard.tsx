"use client"

interface SwingInsight {
  severity: "critical" | "warning" | "positive"
  title: string
  body: string
}

interface SwingFeedback {
  verdict: "HIGH RISK" | "BE CAREFUL" | "LOOKS CLEAN"
  summary: string
  insights: SwingInsight[]
  key_mistake: string
  do_better: string
}

const VERDICT_CONFIG = {
  "HIGH RISK": {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    badge: "bg-red-100 text-red-700",
    emoji: "⚠️",
  },
  "BE CAREFUL": {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    badge: "bg-amber-100 text-amber-700",
    emoji: "👀",
  },
  "LOOKS CLEAN": {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-700",
    emoji: "✅",
  },
}

const SEVERITY_CONFIG = {
  critical: {
    icon: "🔴",
    border: "border-l-red-400",
    titleColor: "text-red-800",
    bg: "bg-red-50/40",
  },
  warning: {
    icon: "🟡",
    border: "border-l-amber-400",
    titleColor: "text-amber-800",
    bg: "bg-amber-50/40",
  },
  positive: {
    icon: "🟢",
    border: "border-l-emerald-400",
    titleColor: "text-emerald-800",
    bg: "bg-emerald-50/40",
  },
}

export default function SwingFeedbackCard({ data, tradeType }: { data: SwingFeedback; tradeType?: string }) {
  const verdict = VERDICT_CONFIG[data.verdict] ?? VERDICT_CONFIG["BE CAREFUL"]
  const label = tradeType === "futures_swing" ? "Futures Review" : "Swing Review"

  return (
    <div className="space-y-3">

      {/* ── Header label ── */}
      <div className="flex items-center gap-2">
        <span className="text-base">📊</span>
        <span className="text-sm font-semibold text-gray-700">Trade Coaching</span>
        <span className="text-xs text-gray-400 font-medium">{label}</span>
      </div>

      {/* ── Verdict banner ── */}
      <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${verdict.bg} ${verdict.border}`}>
        <span className="text-xl mt-0.5">{verdict.emoji}</span>
        <div>
          <p className={`text-sm font-bold tracking-wide ${verdict.text}`}>{data.verdict}</p>
          <p className="text-sm text-gray-700 mt-0.5 leading-snug">{data.summary}</p>
        </div>
      </div>

      {/* ── Insights ── */}
      <div className="space-y-2">
        {data.insights.map((insight, i) => {
          const sev = SEVERITY_CONFIG[insight.severity] ?? SEVERITY_CONFIG.warning
          return (
            <div
              key={i}
              className={`rounded-xl border-l-4 border border-gray-100 px-4 py-3 ${sev.border} ${sev.bg}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">{sev.icon}</span>
                <p className={`text-sm font-semibold leading-tight ${sev.titleColor}`}>
                  {insight.title}
                </p>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed pl-6">
                {insight.body}
              </p>
            </div>
          )
        })}
      </div>

      {/* ── Key Mistake + Do Better ── */}
      <div className="space-y-2 pt-1">
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 flex gap-3">
          <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-0.5">Biggest Mistake</p>
            <p className="text-sm text-gray-700 leading-relaxed">{data.key_mistake}</p>
          </div>
        </div>

        <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 flex gap-3">
          <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-0.5">Do This Next Time</p>
            <p className="text-sm text-gray-700 leading-relaxed">{data.do_better}</p>
          </div>
        </div>
      </div>

      {/* ── Disclaimer ── */}
      <p className="text-xs text-gray-400 pt-1">
        ⚠️ Not investment advice. Decision is entirely yours.
      </p>
    </div>
  )
}
