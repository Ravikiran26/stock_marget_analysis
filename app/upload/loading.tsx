export default function UploadLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-gray-100 rounded-lg" />
      <div className="h-4 w-64 bg-gray-100 rounded" />
      <div className="h-64 w-full bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200" />
      <div className="h-11 w-36 bg-gray-100 rounded-full" />
    </div>
  )
}
