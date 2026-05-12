"use client"

import { useState } from "react"
import { createPaymentOrder, verifyPayment } from "@/lib/api"

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any
  }
}

const PLANS = [
  {
    id: "monthly" as const,
    label: "Monthly",
    price: "₹499",
    sub: "per month",
    badge: null,
  },
  {
    id: "yearly" as const,
    label: "Annual",
    price: "₹4,499",
    sub: "₹375/mo · saves ₹1,489",
    badge: "Best value",
  },
]

const FEATURES = [
  "Unlimited AI trade analyses",
  "Full dashboard & P&L tracking",
  "Behavioral pattern detection",
  "Weekly AI coach report",
  "Priority support",
]

export default function PaywallModal({ onClose, limit = 10 }: { onClose: () => void; limit?: number }) {
  const [selected, setSelected] = useState<"monthly" | "yearly">("yearly")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  async function handleUpgrade() {
    setLoading(true)
    setError("")
    try {
      const order = await createPaymentOrder(selected)

      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: order.key_id,
          amount: order.amount,
          currency: order.currency,
          order_id: order.order_id,
          name: "Traders Diary",
          description: `Pro ${selected === "monthly" ? "Monthly" : "Annual"} Plan`,
          theme: { color: "#2563EB" },
          handler: async (response: {
            razorpay_order_id: string
            razorpay_payment_id: string
            razorpay_signature: string
          }) => {
            try {
              await verifyPayment({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan: selected,
              })
              resolve()
            } catch {
              reject(new Error("Payment verification failed"))
            }
          },
          modal: {
            ondismiss: () => reject(new Error("dismissed")),
          },
        })
        rzp.open()
      })

      setSuccess(true)
      setTimeout(() => {
        onClose()
        window.location.reload()
      }, 2000)
    } catch (err: unknown) {
      if (err instanceof Error && err.message !== "dismissed") {
        setError("Payment failed. Please try again or contact support.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 flex flex-col gap-5">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-300 hover:text-gray-500 transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
          <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>

        {success ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">🎉</div>
            <p className="text-lg font-bold text-gray-900">You&apos;re now Pro!</p>
            <p className="text-sm text-gray-500 mt-1">Reloading your dashboard…</p>
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-xl font-black text-gray-900 mb-2">
                You&apos;ve used all {limit} free analyses
              </h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                Upgrade to Pro for unlimited AI coaching, full patterns, and weekly reports.
              </p>
            </div>

            {/* Features */}
            <ul className="space-y-1.5">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-blue-500 text-xs">✓</span>
                  {f}
                </li>
              ))}
            </ul>

            {/* Plan selector */}
            <div className="flex gap-2">
              {PLANS.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => setSelected(plan.id)}
                  className={`flex-1 rounded-xl border-2 p-3 text-left transition-all ${
                    selected === plan.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-600">{plan.label}</span>
                    {plan.badge && (
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-100 rounded px-1.5 py-0.5">
                        {plan.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-base font-black text-gray-900">{plan.price}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{plan.sub}</div>
                </button>
              ))}
            </div>

            {error && <p className="text-xs text-red-500 -mt-2">{error}</p>}

            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white py-3 text-sm font-bold transition-colors disabled:opacity-60"
            >
              {loading ? "Opening payment…" : `Upgrade to Pro — ${selected === "monthly" ? "₹499/mo" : "₹4,499/yr"}`}
            </button>

            <p className="text-xs text-gray-400 text-center -mt-2">
              Secure payment via Razorpay · Cancel anytime
            </p>
          </>
        )}
      </div>
    </div>
  )
}
