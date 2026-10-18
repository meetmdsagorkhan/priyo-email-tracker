export default function AnalyticsLoading() {
  return (
    <div
      className="space-y-6 animate-fade-in"
      role="status"
      aria-label="Loading email analytics"
    >
      <span className="sr-only">Loading email analytics</span>
      <div className="h-8 w-56 animate-pulse rounded bg-black/[0.06]" />
      <div className="h-12 animate-pulse rounded border-b border-black/[0.06] bg-black/[0.02]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="bento-card h-28 animate-pulse bg-black/[0.03]"
          />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="bento-card h-64 animate-pulse bg-black/[0.03] lg:col-span-3" />
        <div className="bento-card h-64 animate-pulse bg-black/[0.03] lg:col-span-2" />
      </div>
    </div>
  );
}
