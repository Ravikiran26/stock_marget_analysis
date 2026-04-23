"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { signInWithGoogle, supabase } from "@/lib/supabase"
import { startProCheckout } from "@/hooks/useRazorpay"

function GoogleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="flex-shrink-0">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

/* ─── Product mockup ─────────────────────────────────────────────────────── */
function ProductMockup() {
  const trades = [
    { sym: "NIFTY 22600 CE",  type: "Options", action: "BUY",  entry: "₹239",    exit: "₹485",    pnl: "+₹12,300",  pct: "+103.1%", pos: true  },
    { sym: "DIVISLAB",         type: "Equity",  action: "BUY",  entry: "₹3,915",  exit: "₹5,797",  pnl: "+₹11,289",  pct: "+48.1%",  pos: true  },
    { sym: "BANKNIFTY FUT",    type: "Futures", action: "SELL", entry: "₹47,820", exit: "₹48,135", pnl: "−₹7,875",   pct: "−0.66%",  pos: false },
    { sym: "BAJEL",            type: "Equity",  action: "BUY",  entry: "₹303",    exit: "—",       pnl: "—",         pct: "Open",    pos: null  },
    { sym: "SENSEX 75300 CE",  type: "Options", action: "BUY",  entry: "₹185",    exit: "₹412",    pnl: "+₹9,072",   pct: "+122.7%", pos: true  },
  ]

  return (
    <div className="w-full rounded-2xl overflow-hidden"
      style={{
        background: "#0f1117",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset",
      }}>
      {/* chrome bar */}
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)" }}>
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1.5">
            {["#ef4444","#f59e0b","#22c55e"].map(c => <div key={c} className="w-3 h-3 rounded-full" style={{ background: c }} />)}
          </div>
          <span className="text-xs font-medium ml-1" style={{ color: "rgba(255,255,255,0.22)" }}>tradersdiary.in / my-trades</span>
        </div>
        <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /><span className="text-[10px]" style={{ color: "rgba(255,255,255,0.28)" }}>Live</span></div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-4 gap-px m-4 rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        {[["Total P&L","+ ₹24,786","#4ade80"],["Win Rate","67%","#a5b4fc"],["Trades","33","#ffffff"],["Open","4","#fbbf24"]].map(([l,v,c])=>(
          <div key={l} className="px-3 py-3 text-center" style={{ background: "rgba(255,255,255,0.02)" }}>
            <p className="text-[9px] mb-1 uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.25)" }}>{l}</p>
            <p className="font-black text-sm tabular-nums" style={{ color: c as string }}>{v}</p>
          </div>
        ))}
      </div>

      {/* rows */}
      <div className="px-4 space-y-1.5 pb-3">
        {trades.map((t,i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
              style={{ background: t.type === "Options" ? "linear-gradient(135deg,#4f46e5,#7c3aed)" : t.type === "Futures" ? "linear-gradient(135deg,#0ea5e9,#4f46e5)" : "linear-gradient(135deg,#059669,#0ea5e9)" }}>
              {t.sym[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{t.sym}</p>
              <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.28)" }}>{t.type}</p>
            </div>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-md hidden sm:block"
              style={{ color: t.action==="BUY"?"#4ade80":"#f87171", background: t.action==="BUY"?"rgba(74,222,128,0.1)":"rgba(248,113,113,0.1)" }}>{t.action}</span>
            <div className="text-right w-24 flex-shrink-0">
              <p className="text-xs font-bold tabular-nums" style={{ color: t.pos===true?"#4ade80":t.pos===false?"#f87171":"rgba(255,255,255,0.4)" }}>{t.pnl}</p>
              <p className="text-[9px]" style={{ color: t.pos===true?"rgba(74,222,128,0.55)":t.pos===false?"rgba(248,113,113,0.55)":"rgba(255,255,255,0.22)" }}>{t.pct}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Behaviour strip */}
      <div className="mx-4 mb-4 p-4 rounded-xl" style={{ background: "rgba(79,70,229,0.1)", border: "1px solid rgba(79,70,229,0.25)" }}>
        <p className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: "#a5b4fc" }}>⚡ Pattern Intelligence · Last 30 days</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Overtrading alert", val: "7+ trades/day → avg −₹4,200. Your sweet spot is 1–3 trades.", icon: "⚠️", warn: true },
            { label: "Revenge trading", val: "After a loss, you win only 28% of the time. Stop after 2 losses.", icon: "🔁", warn: true },
            { label: "Expiry edge", val: "Thursday weekly expiry: 62% win rate. Non-expiry days: 41% only.", icon: "📅", warn: false },
          ].map((item,i) => (
            <div key={i} className="flex gap-2 items-start p-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${item.warn ? "rgba(251,191,36,0.2)" : "rgba(255,255,255,0.06)"}` }}>
              <span className="text-[13px] flex-shrink-0 mt-px">{item.icon}</span>
              <div>
                <p className="text-[8px] font-bold uppercase tracking-wider mb-0.5" style={{ color: item.warn ? "#fbbf24" : "#a5b4fc" }}>{item.label}</p>
                <p className="text-[10px] leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{item.val}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Feature card ───────────────────────────────────────────────────────── */
function FeatureCard({ icon, title, desc, color, wide = false }: { icon: string; title: string; desc: string; color: string; wide?: boolean }) {
  const accents: Record<string, { iconBg: string; glow: string }> = {
    indigo:  { iconBg: "bg-indigo-600",  glow: "group-hover:shadow-indigo-500/20" },
    violet:  { iconBg: "bg-violet-600",  glow: "group-hover:shadow-violet-500/20" },
    sky:     { iconBg: "bg-sky-600",     glow: "group-hover:shadow-sky-500/20"    },
    emerald: { iconBg: "bg-emerald-600", glow: "group-hover:shadow-emerald-500/20"},
    amber:   { iconBg: "bg-amber-600",   glow: "group-hover:shadow-amber-500/20"  },
    rose:    { iconBg: "bg-rose-600",    glow: "group-hover:shadow-rose-500/20"   },
  }
  const a = accents[color] ?? accents.indigo
  return (
    <div className={`group rounded-2xl p-6 bg-[#0d1528] border border-[#1c2e4a] hover:border-[#2a4570] transition-all duration-200 hover:shadow-xl ${a.glow} ${wide ? "sm:col-span-2" : ""}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-4 ${a.iconBg}`}>
        <span>{icon}</span>
      </div>
      <h3 className="text-slate-100 font-bold text-base mb-2">{title}</h3>
      <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
    </div>
  )
}

/* ─── FAQ ────────────────────────────────────────────────────────────────── */
const FAQS = [
  { q: "Is my trade data private?", a: "Yes — completely. Trades are stored in your private account only. Nobody else can see your journal. We never share or sell data." },
  { q: "Does this give buy/sell recommendations?", a: "No. Traders Diary is an educational trade journal. The AI reviews your past trades only — never tells you what to buy or sell. All outputs end with 'Not investment advice.'" },
  { q: "Which brokers are supported?", a: "CSV import is supported for Zerodha (Tax P&L / Tradebook), Upstox, and Dhan (P&L Report). Screenshot upload works with any broker — AI reads the image directly." },
  { q: "How does the AI coaching work?", a: "Each trade is analysed with live data — VIX, DTE, Greeks, OTM/ATM/ITM classification, NIFTY trend — generating 5 specific insights grounded in your actual numbers. You get 10 AI analyses free; after that, upgrade to Pro for unlimited." },
  { q: "What are behaviour patterns?", a: "After enough trades, Traders Diary automatically detects your personal patterns: days you overtrade, revenge trading spirals after losses, expiry day win rates, best underlying symbols, best time slots. These are shown on your dashboard — no extra steps needed." },
  { q: "Is it SEBI compliant?", a: "Yes. Traders Diary is a journaling and analytics tool, not an investment adviser. It analyses trades you have already made — retrospective only. No SEBI IA registration required for this use case." },
]

const BROKERS = [
  "Zerodha","Upstox","Dhan",
  "Zerodha","Upstox","Dhan",
  "Zerodha","Upstox","Dhan",
  "Zerodha","Upstox","Dhan",
  "Zerodha","Upstox","Dhan",
  "Zerodha","Upstox","Dhan",
]

/* ─── Pro pricing card with live Razorpay checkout ──────────────────────── */
function ProCard() {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState<string>("")

  // Auto-trigger checkout if user just logged in via the upgrade flow
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("checkout") !== "pro") return
    // Remove param from URL without reload
    const url = new URL(window.location.href)
    url.searchParams.delete("checkout")
    window.history.replaceState({}, "", url.toString())
    // Trigger checkout
    triggerCheckout()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function triggerCheckout() {
    setLoading(true)
    setStatus("idle")
    setErrorMsg("")
    try {
      const result = await startProCheckout("monthly")
      if (result === "success") setStatus("success")
      else if (result === "error") { setStatus("error"); setErrorMsg("Payment verification failed.") }
    } catch (err: unknown) {
      setStatus("error")
      setErrorMsg((err as Error).message ?? "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  async function handleUpgrade() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      await signInWithGoogle("/?checkout=pro")
      return
    }
    await triggerCheckout()
  }

  return (
    <div className="rounded-2xl p-7 relative overflow-hidden text-white flex flex-col"
      style={{
        background: "linear-gradient(135deg, #1e1b4b 0%, #2e1065 50%, #1e3a5f 100%)",
        border: "2px solid rgba(167,139,250,0.4)",
        boxShadow: "0 20px 60px rgba(79,70,229,0.3)",
      }}>
      <div className="absolute top-4 right-4 text-[10px] font-bold px-2 py-0.5 rounded-full"
        style={{ background: "rgba(167,139,250,0.2)", border: "1px solid rgba(167,139,250,0.4)", color: "#ddd6fe" }}>
        Most popular
      </div>
      <div className="absolute bottom-0 right-0 w-40 h-40 pointer-events-none"
        style={{ background: "radial-gradient(circle at bottom right, rgba(139,92,246,0.3), transparent 60%)" }} />
      <p className="text-xs font-bold uppercase tracking-widest text-violet-300 mb-3">Pro</p>
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-4xl font-black">₹499</span>
        <span className="text-sm text-white/50 mb-1">/mo</span>
      </div>
      <p className="text-white/40 text-xs mb-6">Cancel anytime</p>
      <ul className="space-y-2.5 mb-6 flex-1">
        {[
          "Unlimited AI analyses",
          "Full pattern dashboard",
          "Overtrading detection",
          "Revenge trading flag",
          "Expiry day edge reports",
          "Live market context",
          "All brokers supported",
        ].map(f => (
          <li key={f} className="flex items-center gap-2.5 text-xs text-white/70">
            <svg className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
            {f}
          </li>
        ))}
      </ul>

      {status === "success" ? (
        <div className="w-full rounded-xl py-2.5 text-xs font-bold text-center text-emerald-300 bg-emerald-950/40 border border-emerald-800/40">
          Payment successful! You&apos;re now Pro.
        </div>
      ) : (
        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="relative w-full rounded-xl py-2.5 text-xs font-bold text-white transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #6d28d9, #4f46e5)", boxShadow: "0 8px 24px rgba(109,40,217,0.4)" }}>
          {loading ? (
            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Processing…</>
          ) : "Upgrade to Pro →"}
        </button>
      )}

      {status === "error" && (
        <p className="text-xs text-red-400 text-center mt-3">{errorMsg || "Payment failed. Please try again."}</p>
      )}
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const router = useRouter()
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard")
    })
  }, [router])

  return (
    <div className="flex flex-col overflow-x-hidden bg-[#060c18]">

      {/* ══════════════════════════════════════════════════════════════════
          HERO — Rich indigo/purple gradient
      ══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden flex flex-col items-center text-center px-6 pt-20 pb-0"
        style={{
          background: "linear-gradient(160deg, #0f0b28 0%, #1e1760 30%, #2d1b8a 55%, #1a1550 75%, #0b0920 100%)",
        }}>

        {/* Glow orbs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(109,40,217,0.5) 0%, rgba(79,70,229,0.2) 40%, transparent 70%)", filter: "blur(60px)" }} />
        <div className="absolute top-1/4 -left-40 w-[400px] h-[400px] pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(6,182,212,0.25) 0%, transparent 65%)", filter: "blur(70px)" }} />
        <div className="absolute top-1/4 -right-40 w-[400px] h-[400px] pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(236,72,153,0.2) 0%, transparent 65%)", filter: "blur(70px)" }} />

        {/* Subtle dot grid */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.15]"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }} />

        {/* Content */}
        <div className="relative z-10 max-w-4xl mx-auto">

          {/* Badge */}
          <div className="animate-fade-up inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
            style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", backdropFilter: "blur(12px)" }}>
            <span>🇮🇳</span>
            <span className="text-xs font-semibold text-white/80">Built for Indian F&O & Intraday Options Traders</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(139,92,246,0.4)", color: "#ddd6fe" }}>Beta</span>
          </div>

          {/* Headline */}
          <h1 className="animate-fade-up delay-100 font-black tracking-tight leading-[1.06] mb-6 text-white"
            style={{ fontSize: "clamp(2.8rem, 5.5vw, 5rem)" }}>
            Stop losing money<br />
            <span style={{
              background: "linear-gradient(135deg, #c4b5fd 0%, #a78bfa 35%, #818cf8 65%, #67e8f9 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>without knowing why.</span>
          </h1>

          {/* Subheading */}
          <p className="animate-fade-up delay-200 text-lg leading-relaxed max-w-2xl mx-auto mb-10 text-white/60">
            Traders Diary spots{" "}
            <span className="text-white/90 font-medium">overtrading patterns, revenge trading, expiry day edge</span>
            {" "}— and gives AI coaching grounded in your actual numbers. Not generic advice.
          </p>

          {/* CTAs */}
          <div className="animate-fade-up delay-300 flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <button
              onClick={() => signInWithGoogle()}
              className="inline-flex items-center gap-2.5 rounded-xl px-7 py-3.5 text-sm font-bold text-white transition-all duration-200 hover:scale-[1.04] active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                boxShadow: "0 0 0 1px rgba(165,180,252,0.3) inset, 0 8px 32px rgba(79,70,229,0.5)",
              }}>
              <GoogleIcon size={16} />
              Start free with Google
              <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
              </svg>
            </button>
            <div className="flex items-center gap-2 text-white/40 text-sm">
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
              </svg>
              10 free analyses · No card needed
            </div>
          </div>

          {/* Trust */}
          <div className="animate-fade-up delay-400 flex items-center justify-center gap-3 mb-16">
            <div className="flex -space-x-2">
              {[["RK",200],["AM",240],["SP",270],["VG",310],["NK",180],["PJ",220]].map(([n,h],i) => (
                <div key={i} className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ borderColor: "#1e1760", background: `hsl(${h},55%,35%)` }}>{n}</div>
              ))}
            </div>
            <p className="text-sm text-white/35">Joined by traders from Zerodha, Upstox & Dhan</p>
          </div>

          {/* Product mockup */}
          <div className="animate-slide-up max-w-5xl mx-auto" style={{ animationDelay: "0.5s" }}>
            <ProductMockup />
          </div>
        </div>

        {/* Gradient fade into dark bg */}
        <div className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, transparent, #060c18)" }} />
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          BROKER STRIP — dark
      ══════════════════════════════════════════════════════════════════ */}
      <div className="bg-[#060c18] py-5 overflow-hidden border-y border-white/[0.05]">
        <p className="text-center text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-600 mb-4">
          CSV import supported for
        </p>
        <div className="flex">
          <div className="flex gap-12 animate-marquee whitespace-nowrap">
            {BROKERS.map((b, i) => (
              <span key={i} className="text-sm font-semibold text-slate-500 flex-shrink-0">{b}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          STATS — dark
      ══════════════════════════════════════════════════════════════════ */}
      <section className="bg-[#060c18] py-20 px-6">
        <div className="mx-auto max-w-4xl grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {[
            { val: "F&O",  label: "Native support",       sub: "CE/PE, lot sizes, weekly expiry, DTE" },
            { val: "10",   label: "Free AI analyses",      sub: "No card needed to get started" },
            { val: "3",    label: "Brokers supported",      sub: "Zerodha · Upstox · Dhan" },
            { val: "100%", label: "Private",               sub: "Your journal, only yours" },
          ].map(({ val, label, sub }) => (
            <div key={val}>
              <p className="text-4xl font-black text-indigo-400 mb-1">{val}</p>
              <p className="text-slate-200 font-bold text-sm mb-1">{label}</p>
              <p className="text-slate-500 text-xs">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          PRICING — dark
      ══════════════════════════════════════════════════════════════════ */}
      <section className="bg-[#060c18] py-24 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-3">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-100 tracking-tight mb-3">
              Start free. No card needed.
            </h2>
            <p className="text-slate-500 text-sm">Upgrade when you&apos;re ready to go unlimited.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

            {/* Free */}
            <div className="rounded-2xl p-7 bg-[#0d1528] border border-[#1c2e4a] flex flex-col">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Free</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-black text-slate-100">₹0</span>
              </div>
              <p className="text-slate-500 text-xs mb-6">Forever · No card needed</p>
              <ul className="space-y-2.5 mb-6 flex-1">
                {[
                  { label: "10 AI analyses (lifetime)", on: true },
                  { label: "Screenshot upload", on: true },
                  { label: "Zerodha · Upstox · Dhan CSV", on: true },
                  { label: "Basic P&L dashboard", on: true },
                  { label: "Pattern intelligence", on: false },
                  { label: "Behaviour analysis", on: false },
                  { label: "Expiry edge reports", on: false },
                ].map(({ label, on }) => (
                  <li key={label} className="flex items-center gap-2.5 text-xs">
                    {on ? (
                      <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    ) : (
                      <span className="w-3.5 h-3.5 flex-shrink-0 flex items-center justify-center text-slate-700 font-bold text-base leading-none">–</span>
                    )}
                    <span className={on ? "text-slate-400" : "text-slate-600"}>{label}</span>
                  </li>
                ))}
              </ul>
              <button onClick={() => signInWithGoogle()}
                className="w-full rounded-xl py-2.5 text-xs font-bold border border-[#1c2e4a] text-slate-400 hover:border-indigo-500/50 hover:text-indigo-300 transition-all flex items-center justify-center gap-2">
                <GoogleIcon size={12} />
                Get started free
              </button>
            </div>

            {/* Pro */}
            <ProCard />

            {/* Elite — coming soon */}
            <div className="rounded-2xl p-7 relative overflow-hidden text-white flex flex-col"
              style={{
                background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
                border: "1px solid rgba(99,102,241,0.25)",
              }}>
              <div className="absolute top-4 right-4 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc" }}>
                Coming soon
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-300 mb-3">Elite</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-black">₹999</span>
                <span className="text-sm text-white/50 mb-1">/mo</span>
              </div>
              <p className="text-white/30 text-xs mb-6">Coming soon</p>
              <ul className="space-y-2.5 mb-6 flex-1">
                {[
                  "Everything in Pro",
                  "Weekly AI review report",
                  "Priority support",
                  "Advanced sector analytics",
                  "Custom trade tags & notes",
                  "Export to PDF/Excel",
                  "Early access to features",
                ].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-xs text-white/50">
                    <svg className="w-3.5 h-3.5 text-indigo-400/60 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    {f}
                  </li>
                ))}
              </ul>
              <button disabled
                className="w-full rounded-xl py-2.5 text-xs font-bold text-white/30 cursor-not-allowed"
                style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)" }}>
                Launching soon
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          TRUST BADGES
      ══════════════════════════════════════════════════════════════════ */}
      <section className="bg-[#060c18] py-16 px-6 border-t border-white/[0.04]">
        <div className="mx-auto max-w-5xl">
          <p className="text-center text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-600 mb-10">
            Why traders trust us with their data
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            {[
              { icon: "🔒", title: "No broker login", body: "We never ask for your Zerodha, Upstox or Dhan credentials" },
              { icon: "📁", title: "File upload only", body: "Share only the report you choose. Nothing else is ever accessed" },
              { icon: "🇮🇳", title: "SEBI compliant", body: "Educational tool. Not investment advice. No regulated activity" },
              { icon: "👁️", title: "You control your data", body: "Delete your account and all data any time, instantly" },
              { icon: "🚫", title: "No live trading access", body: "Technically impossible for us to place trades on your behalf" },
              { icon: "🔑", title: "Read-only analysis", body: "We read your uploaded file. We cannot write to anything" },
            ].map(({ icon, title, body }) => (
              <div key={title} className="flex flex-col items-center text-center gap-3 p-5 rounded-2xl bg-[#0d1528] border border-[#1c2e4a]">
                <span className="text-2xl">{icon}</span>
                <p className="text-slate-200 font-semibold text-sm">{title}</p>
                <p className="text-slate-500 text-xs leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          FEATURES — dark
      ══════════════════════════════════════════════════════════════════ */}
      <section className="bg-[#0a1220] py-24 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3">Features</p>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-100 tracking-tight leading-tight">
              More than a journal.<br />
              <span className="text-slate-500">A complete trade intelligence platform.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

            {/* Wide — AI coaching */}
            <div className="sm:col-span-2 rounded-2xl p-7 relative overflow-hidden bg-[#0d1528] border border-[#1c2e4a] hover:border-indigo-500/30 transition-all duration-200">
              <div className="absolute top-0 right-0 w-64 h-64 pointer-events-none"
                style={{ background: "radial-gradient(circle at top right, rgba(79,70,229,0.12), transparent 60%)" }} />
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-5 bg-indigo-600">🧠</div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-2">AI Coaching</p>
              <h3 className="text-slate-100 font-black text-xl mb-3 leading-tight">5 analyst-grade insights. Every single trade.</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-5">
                Not generic advice — actual numbers. Entry vs EMA-20, unrealized P&L, 52W range, sector win rate. Powered by Claude AI.
              </p>
              <div className="flex flex-wrap gap-2">
                {["Position sizing","Entry quality vs EMA","Sector context","Risk-reward","52W range","Trend structure"].map(t => (
                  <span key={t} className="text-xs px-3 py-1 rounded-full font-medium bg-indigo-950/60 text-indigo-300 border border-indigo-800/50">{t}</span>
                ))}
              </div>
            </div>

            {/* Screenshot */}
            <FeatureCard icon="📸" title="Screenshot → data" color="emerald"
              desc="Drop any broker screenshot. AI reads every field in seconds. Zero manual entry ever." />

            {/* Live data */}
            <FeatureCard icon="📡" title="Live market context" color="sky"
              desc="Current price, EMA-20/50/200, VIX, NIFTY trend, 52-week range — fetched live for open positions." />

            {/* Overtrading */}
            <FeatureCard icon="⚠️" title="Overtrading detection" color="amber"
              desc="See how your P&L changes as trade count increases each day. Know your personal cut-off point." />

            {/* Wide — Dashboard */}
            <div className="sm:col-span-2 rounded-2xl p-7 relative overflow-hidden bg-[#0d1528] border border-[#1c2e4a] hover:border-violet-500/30 transition-all duration-200">
              <div className="absolute top-0 right-0 w-64 h-64 pointer-events-none"
                style={{ background: "radial-gradient(circle at top right, rgba(124,58,237,0.1), transparent 60%)" }} />
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-5 bg-violet-600">📊</div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-2">Pattern Dashboard</p>
              <h3 className="text-slate-100 font-black text-xl mb-3 leading-tight">See where your real edge is.</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Expiry day edge", val: "+18%" },
                  { label: "Revenge trading", val: "28% wins" },
                  { label: "Best time slot", val: "9:30–10am" },
                  { label: "OTM win rate", val: "38%" },
                ].map(({ label, val }) => (
                  <div key={label} className="rounded-xl px-4 py-3 bg-[#0a1220] border border-[#1c2e4a]">
                    <p className="text-[10px] text-slate-500 mb-1">{label}</p>
                    <p className="text-lg font-black text-slate-100">{val}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Revenge trading */}
            <FeatureCard icon="🔁" title="Revenge trading flag" color="rose"
              desc="Detects when you trade emotionally after a loss. Shows post-loss win rate vs normal win rate." />

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          BUILT FOR INDIA — dark
      ══════════════════════════════════════════════════════════════════ */}
      <section className="bg-[#060c18] py-24 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-3">Built for India</p>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-100 tracking-tight mb-3">
              The only journal that speaks NSE natively.
            </h2>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              Every other tool is built for US stocks. Traders Diary is built from scratch for F&O, NSE, and ₹.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: "⚡", title: "F&O aware",           desc: "CE/PE, lot sizes, weekly expiry, DTE, theta decay. Not adapted — native."             },
              { icon: "📉", title: "VIX + Greeks",         desc: "India VIX, Delta/Gamma/Theta/Vega computed at exact trade time via Black-Scholes."    },
              { icon: "💹", title: "Index options",        desc: "NIFTY, BANKNIFTY, FINNIFTY, SENSEX — underlying trend and EMA structure included."    },
              { icon: "₹",  title: "INR native",           desc: "All P&L in rupees. Lot-based calculations. ₹ throughout — not a USD tool adapted."    },
              { icon: "📅", title: "Expiry intelligence",  desc: "Day-of-week win rates + Thursday week-of-month breakdown. Know your expiry edge cold." },
              { icon: "🗂️", title: "CSV import",             desc: "Upload P&L reports from Zerodha, Upstox, or Dhan directly. Full history loaded in seconds." },
            ].map(f => (
              <div key={f.title} className="rounded-2xl p-5 flex gap-4 bg-[#0d1528] border border-[#1c2e4a] hover:border-[#2a4570] transition-colors">
                <div className="w-10 h-10 rounded-xl bg-[#0a1220] border border-[#1c2e4a] flex items-center justify-center text-lg flex-shrink-0">{f.icon}</div>
                <div>
                  <p className="text-slate-200 font-semibold text-sm mb-1">{f.title}</p>
                  <p className="text-slate-500 text-xs leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          HOW IT WORKS — dark
      ══════════════════════════════════════════════════════════════════ */}
      <section className="bg-[#0a1220] py-24 px-6">
        <div className="mx-auto max-w-2xl">
          <div className="mb-14 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-violet-400 mb-3">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-100 tracking-tight">
              Screenshot to insight in 10 seconds.
            </h2>
          </div>
          <div className="space-y-5">
            {[
              { n:"01", title:"Upload a screenshot or CSV",      body:"Drag from Zerodha Kite, Upstox, or Dhan — or import your P&L report. Takes 10 seconds.",         tag:"Quick import" },
              { n:"02", title:"AI extracts every field",         body:"Symbol, action, CE/PE, strike, lot size, entry, exit, P&L — all read automatically. Zero manual entry.", tag:"Zero effort"  },
              { n:"03", title:"Live F&O context attached",       body:"VIX, DTE, Greeks, NIFTY trend, OTM/ATM/ITM classification — fetched automatically at trade time.",       tag:"Real-time"    },
              { n:"04", title:"Read your AI coaching",           body:"5 numbered insights grounded in your actual numbers — entry quality, timing, risk-reward, what to fix.",  tag:"5 insights"   },
              { n:"05", title:"Spot behaviour patterns",         body:"Dashboard flags overtrading days, revenge trade spirals, expiry day edge, best underlying. Your blind spots revealed.", tag:"Patterns" },
            ].map(({ n, title, body, tag }) => (
              <div key={n} className="flex gap-4 bg-[#0d1528] rounded-2xl p-5 border border-[#1c2e4a] hover:border-[#2a4570] transition-colors">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                  style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)", boxShadow: "0 4px 16px rgba(79,70,229,0.35)" }}>
                  {n}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-slate-100 font-bold text-sm">{title}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-indigo-950/60 text-indigo-300 border border-indigo-800/50">{tag}</span>
                  </div>
                  <p className="text-slate-500 text-sm leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          FAQ — dark
      ══════════════════════════════════════════════════════════════════ */}
      <section className="bg-[#0a1220] py-24 px-6">
        <div className="mx-auto max-w-2xl">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-3">FAQ</p>
            <h2 className="text-3xl font-black text-slate-100 tracking-tight">Common questions</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i}
                className="rounded-2xl overflow-hidden cursor-pointer bg-[#0d1528] border transition-all duration-200"
                style={{ borderColor: openFaq === i ? "#6366f1" : "#1c2e4a", boxShadow: openFaq === i ? "0 0 0 1px rgba(99,102,241,0.2)" : "none" }}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <div className="flex items-center justify-between px-6 py-4">
                  <p className="text-sm font-semibold text-slate-200 pr-4">{faq.q}</p>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                    style={{ background: openFaq === i ? "#4f46e5" : "#162035" }}>
                    <svg className="w-3.5 h-3.5 transition-transform duration-200"
                      style={{ color: openFaq === i ? "white" : "#475569", transform: openFaq === i ? "rotate(180deg)" : "none" }}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                  </div>
                </div>
                {openFaq === i && (
                  <div className="px-6 pb-5">
                    <p className="text-sm leading-relaxed text-slate-500">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          FINAL CTA — dark gradient (bookend)
      ══════════════════════════════════════════════════════════════════ */}
      <section className="py-28 px-6 relative overflow-hidden text-center"
        style={{ background: "linear-gradient(160deg, #0f0b28 0%, #1e1760 35%, #2d1b8a 60%, #0b0920 100%)" }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(99,102,241,0.35) 0%, transparent 65%)" }} />
        <div className="absolute inset-0 pointer-events-none opacity-[0.12]"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }} />
        <div className="relative mx-auto max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-300 mb-5">Ready to find your edge?</p>
          <h2 className="font-black text-white tracking-tight leading-tight mb-5" style={{ fontSize: "clamp(2rem,4.5vw,3.5rem)" }}>
            Upload your first trade.<br />
            <span className="text-white/40">See what you missed.</span>
          </h2>
          <p className="text-white/50 text-base mb-10 max-w-sm mx-auto leading-relaxed">
            Free to start. Works with Zerodha, Upstox, and Dhan.
          </p>
          <button
            onClick={() => signInWithGoogle()}
            className="inline-flex items-center gap-3 rounded-xl px-8 py-4 text-base font-bold text-white transition-all duration-200 hover:scale-[1.04] active:scale-[0.98] mb-5"
            style={{
              background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
              boxShadow: "0 0 0 1px rgba(165,180,252,0.2) inset, 0 16px 56px rgba(79,70,229,0.5)",
            }}>
            <GoogleIcon size={18} />
            Start free with Google
          </button>
          <p className="text-xs text-white/20">Educational tool · Not investment advice · SEBI compliant</p>
        </div>
      </section>

    </div>
  )
}
