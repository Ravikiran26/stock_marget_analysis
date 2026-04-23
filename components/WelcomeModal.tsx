"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

const STORAGE_KEY = "tradfy_welcomed"

export default function WelcomeModal() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setOpen(true)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1")
    setOpen(false)
  }

  function goUpload() {
    dismiss()
    router.push("/upload")
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={dismiss} />

      <div className="relative bg-[#0d1528] border border-[#1c2e4a] rounded-2xl shadow-2xl shadow-black/60 max-w-sm w-full p-8 flex flex-col items-center text-center gap-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <polyline points="2,24 8,16 14,20 20,10 26,14 30,8" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="30" cy="8" r="2.5" fill="#22c55e"/>
          </svg>
        </div>

        <div>
          <h2 className="text-xl font-bold text-slate-100 mb-2">
            Welcome to Traders Diary!
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Your AI trade journal is ready. Upload your first broker screenshot
            and get instant AI coaching on your trade.
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={goUpload}
            className="w-full rounded-xl py-3 text-sm font-bold text-white transition-all hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
              boxShadow: "0 8px 24px rgba(79,70,229,0.4)",
            }}
          >
            Upload My First Trade →
          </button>
          <button
            onClick={dismiss}
            className="text-sm text-slate-600 hover:text-slate-400 transition-colors"
          >
            I&apos;ll do it later
          </button>
        </div>
      </div>
    </div>
  )
}
