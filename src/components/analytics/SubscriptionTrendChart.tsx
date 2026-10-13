type SubscriptionTrendDay = {
  label: string;
  subscribed: number;
  unsubscribed: number;
};

export function SubscriptionTrendChart({
  trend,
}: {
  trend: SubscriptionTrendDay[];
}) {
  const peak = Math.max(
    1,
    ...trend.flatMap((day) => [day.subscribed, day.unsubscribed]),
  );
  const chartHeight = 120;
  const chartWidth = 560;

  return (
    <section className="bento-card p-5 sm:p-6">
      <div>
        <h2 className="text-sm font-semibold text-[#1d1d1f]">
          Subscription status changes
        </h2>
        <p className="mt-1 text-xs text-[#667085]">
          Recorded opt-ins and unsubscribes · last 30 days
        </p>
      </div>
      <div className="mt-5 overflow-hidden">
        <svg
          viewBox="0 0 600 180"
          role="img"
          aria-label="Daily email subscriptions and unsubscribes over the last 30 days"
          className="h-auto w-full"
        >
          {[24, 64, 104, 144].map((y) => (
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
          {trend.map((day, index) => {
            const groupWidth = chartWidth / Math.max(trend.length, 1);
            const x = 20 + index * groupWidth;
            const subscribedHeight = (day.subscribed / peak) * chartHeight;
            const unsubscribedHeight = (day.unsubscribed / peak) * chartHeight;
            return (
              <g key={day.label}>
                <rect
                  x={x + groupWidth * 0.15}
                  y={144 - subscribedHeight}
                  width={Math.max(groupWidth * 0.3, 2)}
                  height={subscribedHeight}
                  rx="2"
                  fill="#625bf6"
                >
                  <title>
                    {day.label}: {day.subscribed} new subscriptions
                  </title>
                </rect>
                <rect
                  x={x + groupWidth * 0.55}
                  y={144 - unsubscribedHeight}
                  width={Math.max(groupWidth * 0.3, 2)}
                  height={unsubscribedHeight}
                  rx="2"
                  fill="#f79009"
                >
                  <title>
                    {day.label}: {day.unsubscribed} unsubscribes
                  </title>
                </rect>
                {index % 5 === 0 && (
                  <text
                    x={x + groupWidth / 2}
                    y="166"
                    textAnchor="middle"
                    className="fill-[#667085] text-[9px]"
                  >
                    {day.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-2 flex gap-4 text-[11px] text-[#667085]">
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-full bg-[#625bf6]" /> New subscriptions
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-full bg-[#f79009]" /> Unsubscribes
        </span>
      </div>
    </section>
  );
}
