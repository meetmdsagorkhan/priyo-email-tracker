"use client";

import Image from "next/image";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Lock, Mail, ArrowRight, Eye, EyeOff } from "lucide-react";
import { safeCallbackUrl } from "@/lib/permissions";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const result = await signIn("credentials", {
        redirect: false,
        email: email.trim().toLowerCase(),
        password,
      });
      if (!result?.ok || result.error) {
        setError(
          result?.error === "CredentialsSignin"
            ? "Email or password is incorrect, your account is disabled, or too many attempts were made. Wait 15 minutes before retrying, or contact the project owner."
            : "Sign in is unavailable because the server setup could not be verified. Contact the project owner to check the database and authentication configuration.",
        );
        return;
      }
      // A full navigation ensures server components and the session provider
      // both load the newly issued cookie rather than stale client state.
      window.location.assign(
        safeCallbackUrl(
          new URLSearchParams(window.location.search).get("callbackUrl"),
        ),
      );
    } catch {
      setError("Sign in is unavailable right now. Please try again shortly.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <main className="min-h-dvh flex items-center justify-center bg-[#f5f5f7] p-4 sm:p-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Image
            src="/email-tracker-favicon.png"
            alt="Priyo Tracker"
            width={64}
            height={64}
            priority
            className="mx-auto mb-4 rounded-2xl shadow-lg"
          />
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome to Priyo Tracker
          </h1>
          <p className="mt-2 text-sm text-[#515154]">
            Email tracking for your work.
          </p>
        </div>
        <div className="apple-glass-card rounded-3xl p-6 sm:p-8">
          <form
            onSubmit={handleSubmit}
            className="space-y-5"
            aria-busy={loading}
          >
            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium">
                Work email
              </label>
              <div className="relative">
                <Mail
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#6e6e73]"
                />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  autoFocus
                  disabled={loading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="apple-input !pl-10"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium"
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#6e6e73]"
                />
                <input
                  id="password"
                  name="password"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="apple-input !pl-10 !pr-12"
                />
                <button
                  type="button"
                  onClick={() => setVisible(!visible)}
                  aria-label={visible ? "Hide password" : "Show password"}
                  aria-pressed={visible}
                  className="absolute right-1 top-1 rounded-lg p-2.5 text-[#515154]"
                >
                  {visible ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <button
              disabled={loading}
              type="submit"
              className="apple-btn-primary w-full !py-3"
            >
              {loading ? "Signing in…" : "Sign in"}
              <ArrowRight aria-hidden className="h-4 w-4" />
            </button>
          </form>
          <p className="mt-6 border-t border-black/5 pt-5 text-center text-sm text-[#515154]">
            Need access or help with your password? Contact the project owner.
          </p>
        </div>
        <p className="mt-6 text-center text-xs text-[#6e6e73]">
          A personal project by the workspace owner · Access by invitation
        </p>
      </div>
    </main>
  );
}
