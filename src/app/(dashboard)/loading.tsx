export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse" aria-label="Loading page">
      <div className="space-y-3">
        <div className="h-3 w-24 rounded bg-black/[0.08]" />
        <div className="h-8 w-64 max-w-full rounded bg-black/[0.08]" />
        <div className="h-3 w-80 max-w-full rounded bg-black/[0.06]" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="bento-card h-32 p-5">
            <div className="h-3 w-28 rounded bg-black/[0.07]" />
            <div className="mt-5 h-7 w-20 rounded bg-black/[0.08]" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="bento-card h-64 p-6" />
        <div className="bento-card h-64 p-6 lg:col-span-2" />
      </div>
    </div>
  );
}
