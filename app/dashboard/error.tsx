"use client"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center gap-5">
      <span className="text-5xl">😕</span>
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Something went wrong</h2>
        <p className="text-sm text-gray-500 max-w-sm">
          {error.message || "We couldn't load your dashboard. Please try again."}
        </p>
      </div>
      <button
        onClick={reset}
        className="rounded-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 text-sm font-semibold transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
