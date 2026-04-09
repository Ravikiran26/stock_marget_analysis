import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center gap-5">
      <span className="text-6xl">📉</span>
      <div>
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2">404</h1>
        <p className="text-lg font-semibold text-gray-700 mb-1">Page not found</p>
        <p className="text-sm text-gray-400 max-w-xs">
          This page doesn&apos;t exist. Head back to your dashboard to continue journaling.
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/dashboard"
          className="rounded-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 text-sm font-semibold transition-colors"
        >
          Go to Dashboard
        </Link>
        <Link
          href="/"
          className="rounded-full border border-gray-200 hover:border-blue-400 text-gray-600 hover:text-blue-600 px-6 py-2.5 text-sm font-medium transition-colors"
        >
          Home
        </Link>
      </div>
    </div>
  )
}
