const deviceBreakdown = [
  { label: "Desktop", value: 54, color: "#8bbdff" },
  { label: "Mobile", value: 34, color: "#7ee1b0" },
  { label: "Other", value: 12, color: "#c4b5fd" },
];

const topLinks = [
  { label: "Explore collection", value: 82 },
  { label: "Read the story", value: 58 },
];

export function AuthAnalyticsPreview() {
  return (
    <div className="auth-product-preview" aria-hidden="true">
      <div className="auth-preview-heading">
        <span>Campaign analytics</span>
        <span className="auth-preview-status">Sample data</span>
      </div>

      <div className="auth-preview-metrics">
        <div>
          <span>Opens</span>
          <strong>1,284</strong>
        </div>
        <div>
          <span>Clicks</span>
          <strong>362</strong>
        </div>
        <div>
          <span>Click-to-open</span>
          <strong>28.2%</strong>
        </div>
      </div>

      <div className="auth-preview-line-chart">
        <svg viewBox="0 0 360 88" preserveAspectRatio="none">
          <path d="M0 12H360M0 34H360M0 56H360M0 78H360" />
          <path
            className="auth-preview-area"
            d="M0 67C24 64 30 45 58 50S91 61 118 42s38 7 65-2 36-23 61-12 36 7 55-8 35-1 61-13v71H0z"
          />
          <path
            className="auth-preview-opens"
            d="M0 67C24 64 30 45 58 50S91 61 118 42s38 7 65-2 36-23 61-12 36 7 55-8 35-1 61-13"
          />
          <path
            className="auth-preview-clicks"
            d="M0 76c24-4 31-9 58-6s37-11 60-7 38 1 65-10 40 8 65-1 38-3 55-10 35 1 57-10"
          />
        </svg>
        <div className="auth-preview-legend">
          <span><i />Opens</span>
          <span><i />Clicks</span>
        </div>
      </div>

      <div className="auth-preview-breakdowns">
        <div className="auth-preview-devices">
          <p>Client mix</p>
          <div className="auth-preview-device-content">
            <span className="auth-preview-donut" />
            <ul>
              {deviceBreakdown.map((device) => (
                <li key={device.label}>
                  <i style={{ backgroundColor: device.color }} />
                  {device.label}
                  <strong>{device.value}%</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="auth-preview-links">
          <p>Top links</p>
          {topLinks.map((link) => (
            <div className="auth-preview-link-row" key={link.label}>
              <div>
                <span>{link.label}</span>
                <strong>{link.value}%</strong>
              </div>
              <i>
                <span style={{ width: `${link.value}%` }} />
              </i>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
