import Image from "next/image";
import { Check } from "lucide-react";
import { AuthAnalyticsPreview } from "@/components/auth/AuthAnalyticsPreview";

const features = [
  "Email open and link click tracking",
  "Campaign and recipient activity",
  "Shared access for your team",
];

export function AuthLayout({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="auth-layout">
      <aside className="auth-brand-panel">
        <div className="auth-brand-header">
          <Image
            src="/favicon.svg"
            alt=""
            width={36}
            height={36}
            priority
            className="auth-brand-logo"
          />
          <div>
            <p className="auth-brand-name">Signalpost</p>
            <p className="auth-brand-caption">Email intelligence workspace</p>
          </div>
        </div>

        <div className="auth-brand-copy">
          <p className="auth-brand-eyebrow">{eyebrow}</p>
          <h1 className="auth-brand-title">{title}</h1>
          <p className="auth-brand-description">{description}</p>

          <AuthAnalyticsPreview />

          <ul className="auth-feature-list mt-7 space-y-3">
            {features.map((feature) => (
              <li
                key={feature}
                className="flex items-center gap-2.5 text-sm text-white/80"
              >
                <Check
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-[#8bbdff]"
                />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <p className="auth-brand-bottom">
          Email engagement, made clear.
        </p>
      </aside>

      <section className="auth-content" aria-label="Account access">
        <div className="auth-form">{children}</div>
      </section>
    </main>
  );
}
