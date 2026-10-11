"use client";

import Image from "next/image";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Lock, Mail, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("sagor.khan@priyo.net");
  const [password, setPassword] = useState("Mahibkhan@282024");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (res?.error) {
        setError("Invalid email or password. Please verify credentials.");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#f5f5f7]">
      <div className="w-full max-w-sm">
        {/* Brand logo */}
        <div className="text-center mb-8">
          <div className="h-16 w-16 rounded-2xl shadow-lg mx-auto mb-4 overflow-hidden bg-white/60">
            <Image
              src="/email-tracker-favicon.png"
              alt="Priyo Email Tracker favicon"
              width={160}
              height={160}
              priority
              className="h-full w-full object-cover"
            />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">
            Sign in to Priyo Tracker
          </h1>
          <p className="text-xs text-[#86868b] mt-1">
            Enterprise Email Tracking & Delivery Intelligence
          </p>
        </div>

        {/* Card */}
        <div className="apple-glass-card rounded-3xl p-8 border border-black/[0.08] shadow-xl space-y-6">
          {error && (
            <div className="p-3 rounded-xl bg-[#ff3b30]/10 border border-[#ff3b30]/20 text-xs text-[#ff3b30]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sagor.khan@priyo.net"
                  className="apple-input text-xs pl-8"
                />
                <Mail className="h-3.5 w-3.5 text-[#86868b] absolute left-2.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="apple-input text-xs pl-8"
                />
                <Lock className="h-3.5 w-3.5 text-[#86868b] absolute left-2.5 top-3" />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="apple-btn-primary w-full text-xs py-2.5 font-medium disabled:opacity-50"
              >
                {loading ? "Authenticating..." : "Continue"}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>

          <div className="pt-2 text-center border-t border-black/[0.05]">
            <p className="text-[11px] text-[#86868b] flex items-center justify-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-[#34c759]" />
              Protected by secure credential authentication
            </p>
          </div>
        </div>

        <div className="text-center mt-6 text-xs text-[#86868b]">
          Priyo Technologies © 2026. Internal Operations Only.
        </div>
      </div>
    </div>
  );
}
