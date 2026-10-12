type TrendDay = {
  label: string;
  opens: number;
  clicks: number;
};

type LinkStat = {
  url: string;
  total: number;
  unique: number;
};

function linePath(values: number[], maxValue: number) {
  const width = 560;
  const height = 136;
  const left = 20;
  const top = 12;
  return values
    .map((value, index) => {
      const x = left + (index / Math.max(values.length - 1, 1)) * width;
      const y = top + height - (value / maxValue) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function linkLabel(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`.replace(/\/$/, "") || parsed.hostname;
  } catch {
    return url;
  }
}

export function CampaignAnalyticsCharts({
  trend,
  links,
}: {
  trend: TrendDay[];
  links: LinkStat[];
}) {
  const peak = Math.max(1, ...trend.flatMap((day) => [day.opens, day.clicks]));
  const topLinks = links.slice(0, 5);
  const maxLinkClicks = Math.max(1, ...topLinks.map((link) => link.total));

  return (
    <section
      className="grid gap-5 lg:grid-cols-5"
      aria-label="Campaign analytics charts"
    >
      <div className="bento-card p-5 sm:p-6 lg:col-span-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#1d1d1f]">
              Engagement over time
            </h2>
            <p className="mt-1 text-xs text-[#667085]">
              Tracked opens and clicks per day · last 7 days
            </p>
          </div>
          <div className="flex gap-3 text-[11px] text-[#667085]">
            <span className="inline-flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-full bg-[#2563eb]" /> Opens
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-full bg-[#16a36a]" /> Clicks
            </span>
          </div>
        </div>
        <div className="mt-5 overflow-hidden">
          <svg
            viewBox="0 0 600 190"
            role="img"
            aria-label="Daily opens and clicks over the last seven days"
            className="h-auto w-full"
          >
            {[24, 70, 116, 162].map((y) => (
              <line
                key={y}
                x1="20"
                x2="580"
                y1={y}
                y2={y}
                stroke="#e8edf4"
                strokeWidth="1"
              />
            ))}
            <path
              d={linePath(
                trend.map((day) => day.opens),
                peak,
              )}
              transform="translate(0 8)"
              fill="none"
              stroke="#2563eb"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={linePath(
                trend.map((day) => day.clicks),
                peak,
              )}
              transform="translate(0 8)"
              fill="none"
              stroke="#16a36a"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {trend.map((day, index) => {
              const x = 20 + (index / Math.max(trend.length - 1, 1)) * 560;
              return (
                <text
                  key={day.label}
                  x={x}
                  y="184"
                  textAnchor="middle"
                  className="fill-[#667085] text-[10px]"
                >
                  {day.label}
                </text>
              );
            })}
          </svg>
        </div>
        {peak === 1 && trend.every((day) => day.opens === 0 && day.clicks === 0) && (
          <p className="mt-2 text-center text-xs text-[#667085]">
            Engagement activity will appear here as recipients interact with
            your campaign.
          </p>
        )}
      </div>

      <div className="bento-card p-5 sm:p-6 lg:col-span-2">
        <div>
          <h2 className="text-sm font-semibold text-[#1d1d1f]">
            Top clicked links
          </h2>
          <p className="mt-1 text-xs text-[#667085]">
            All recorded clicks for this campaign
          </p>
        </div>
        {topLinks.length === 0 ? (
          <p className="py-10 text-center text-xs text-[#667085]">
            Tracked link performance will appear here.
          </p>
        ) : (
          <ol className="mt-5 space-y-4">
            {topLinks.map((link, index) => (
              <li key={`${link.url}-${index}`}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate text-[#344054]" title={link.url}>
                    {linkLabel(link.url)}
                  </span>
                  <strong className="shrink-0 font-semibold text-[#1d1d1f]">
                    {link.total.toLocaleString()}
                  </strong>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#eef2f7]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#2563eb] to-[#60a5fa]"
                    style={{
                      width: `${Math.max((link.total / maxLinkClicks) * 100, link.total ? 4 : 0)}%`,
                    }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-[#98a2b3]">
                  {link.unique.toLocaleString()} unique clickers
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
