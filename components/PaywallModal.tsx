"use client"

import { useState } from "react"
import axios from "axios"

export default function PaywallModal({ onClose, limit = 10 }: { onClose: () => void; limit?: number }) {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleNotify(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/waitlist`,
        { email }
      )
      setSubmitted(true)
    } catch {
      setError("Couldn't save your email. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 flex flex-col gap-5">

        {/* close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-300 hover:text-gray-500 transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* icon */}
        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
          <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>

        {/* copy */}
        <div>
          <h2 className="text-xl font-black text-gray-900 mb-2">You&apos;ve used all {limit} free analyses</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Your free quota is up. Upgrade to Pro for unlimited AI coaching — or drop
            your email below to get notified about new features and offers.
          </p>
        </div>

        {/* pricing teaser */}
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Coming soon — Pro plan</p>
          <ul className="space-y-1.5">
            {[
              "Unlimited trade analyses",
              "Full dashboard & P&L tracking",
              "Priority AI coaching",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                <span className="text-blue-500 text-xs">✓</span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* waitlist form */}
        {submitted ? (
          <div className="text-center py-2">
            <p className="text-sm font-semibold text-green-600">✓ You&apos;re on the list!</p>
            <p className="text-xs text-gray-400 mt-1">We&apos;ll email you when paid plans launch.</p>
          </div>
        ) : (
          <form onSubmit={handleNotify} className="flex flex-col gap-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              disabled={loading}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition disabled:opacity-50"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {loading ? "Saving…" : "Notify me when Pro launches"}
            </button>
          </form>
        )}

        <p className="text-xs text-gray-400 text-center -mt-2">No spam. Unsubscribe anytime.</p>
      </div>
    </div>
  )
}
