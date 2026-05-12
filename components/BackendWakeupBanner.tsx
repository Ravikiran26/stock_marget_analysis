"use client"

import { useEffect, useState } from "react"

export default function BackendWakeupBanner() {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
    const timer = setTimeout(() => setSlow(true), 4000)

    fetch(`${base}/`)
      .then(() => {
        clearTimeout(timer)
        setSlow(false)
      })
      .catch(() => {
        clearTimeout(timer)
        setSlow(false)
      })

    return () => clearTimeout(timer)
  }, [])

  if (!slow) return null

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#0d1528] border border-[#1c2e4a] shadow-2xl shadow-black/60 text-sm text-slate-300 whitespace-nowrap">
      <svg
        className="w-4 h-4 animate-spin text-indigo-400 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      Server is warming up — please wait a moment...
    </div>
  )
}
