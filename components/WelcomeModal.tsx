"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

const STORAGE_KEY = "tradfy_welcomed"

export default function WelcomeModal() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // Show once per browser — flip flag after shown
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
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={dismiss}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 flex flex-col items-center text-center gap-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="text-5xl">🎉</div>

        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Welcome to Tradfy!
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Your AI trade journal is ready. Upload your first broker screenshot
            and get instant AI coaching insights on your trade.
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full">
          <Button
            onClick={goUpload}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold"
          >
            Upload My First Trade →
          </Button>
          <button
            onClick={dismiss}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            I&apos;ll do it later
          </button>
        </div>
      </div>
    </div>
  )
}
