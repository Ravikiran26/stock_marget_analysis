export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 space-y-8">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-9 w-32 bg-gray-100 rounded-full animate-pulse" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-gray-100 p-5 space-y-3 animate-pulse">
            <div className="flex justify-between">
              <div className="h-3 w-16 bg-gray-100 rounded" />
              <div className="h-5 w-5 bg-gray-100 rounded" />
            </div>
            <div className="h-7 w-24 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="rounded-xl border border-gray-100 p-6 space-y-4 animate-pulse">
        <div className="h-4 w-32 bg-gray-100 rounded" />
        <div className="h-60 bg-gray-50 rounded-lg" />
      </div>

      {/* Trades skeleton */}
      <div className="rounded-xl border border-gray-100 overflow-hidden animate-pulse">
        <div className="h-12 bg-gray-50 border-b border-gray-100" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-gray-50">
            <div className="h-5 w-12 bg-gray-100 rounded-full" />
            <div className="h-4 w-24 bg-gray-100 rounded" />
            <div className="h-4 w-16 bg-gray-100 rounded ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}
