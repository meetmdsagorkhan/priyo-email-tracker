"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Lock, Mail, ArrowRight, Eye, EyeOff } from "lucide-react";
import { safeCallbackUrl } from "@/lib/permissions";
import { AuthLayout } from "@/components/auth/AuthLayout";

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
    <AuthLayout
      eyebrow="Email intelligence"
      title="Make every email more insightful."
      description="Understand campaign engagement, follow link activity, and keep your team in sync from one clear workspace."
    >
      <div className="auth-form-heading">
        <p className="auth-heading-eyebrow">Welcome back</p>
        <h2 className="auth-form-title">Sign in to your workspace</h2>
        <p className="auth-form-description">
          Use your work email and password to continue.
        </p>
      </div>
      <div className="auth-card">
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
                  <EyeOff aria-hidden className="h-4 w-4" />
                ) : (
                  <Eye aria-hidden className="h-4 w-4" />
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
        <p className="auth-form-note mt-6 border-t border-[#e7ebf2] pt-5">
          Need access to an existing team? Ask its workspace admin for an
          invitation.
        </p>
      </div>
      <p className="auth-form-note mt-5 text-center">
        New to Priyo Tracker?{" "}
        <Link href="/signup" className="auth-link">
          Create a workspace
        </Link>
      </p>
    </AuthLayout>
  );
}
