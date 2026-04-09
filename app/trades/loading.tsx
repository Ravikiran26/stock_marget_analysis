export default function TradesLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-28 bg-gray-100 rounded-lg" />
        <div className="h-9 w-32 bg-gray-100 rounded-full" />
      </div>

      {/* Filter pills */}
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-8 w-16 bg-gray-100 rounded-full" />
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-100 overflow-hidden">
        <div className="h-10 bg-gray-50 border-b border-gray-100" />
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex gap-4 px-4 py-3.5 border-b border-gray-50">
            <div className="h-4 w-20 bg-gray-100 rounded" />
            <div className="h-4 w-24 bg-gray-100 rounded" />
            <div className="h-4 w-16 bg-gray-100 rounded" />
            <div className="h-4 w-12 bg-gray-100 rounded" />
            <div className="h-4 w-16 bg-gray-100 rounded ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}
