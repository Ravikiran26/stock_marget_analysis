"use client"

import { useState } from "react"
import { signInWithGoogle } from "@/lib/supabase"

interface AuthModalProps {
  onClose: () => void
}

export default function AuthModal({ onClose }: AuthModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGoogleSignIn() {
    setError(null)
    setLoading(true)
    try {
      await signInWithGoogle()
      // redirects to Google — modal will close on return via callback
    } catch (err: unknown) {
      setError((err as Error).message ?? "Something went wrong")
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[#0d1528] border border-[#1c2e4a] rounded-2xl shadow-2xl shadow-black/60 w-full max-w-sm p-8 flex flex-col gap-6">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-600 hover:text-slate-400 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-3">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <polyline points="2,24 8,16 14,20 20,10 26,14 30,8" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="30" cy="8" r="2.5" fill="#22c55e"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-100">Welcome to Traders Diary</h2>
          <p className="text-sm text-slate-500 mt-1">Sign in to start journaling your trades</p>
        </div>

        {/* Google Sign In */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 rounded-xl py-3 px-4 text-sm font-semibold text-slate-100 bg-[#0a1220] border border-[#1c2e4a] hover:border-indigo-500/50 hover:bg-[#0f1a2e] transition-all disabled:opacity-50"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-slate-600 border-t-indigo-400 rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          {loading ? "Redirecting…" : "Continue with Google"}
        </button>

        {error && (
          <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2 text-center">
            ⚠️ {error}
          </p>
        )}

        <p className="text-center text-xs text-slate-600">
          By continuing, you agree to our{" "}
          <span className="text-indigo-400">Terms of Service</span>
          {" & "}
          <span className="text-indigo-400">Privacy Policy</span>
        </p>
      </div>
    </div>
  )
}
