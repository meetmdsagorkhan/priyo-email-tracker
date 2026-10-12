"use client";

import Link from "next/link";
import { useState } from "react";
import { errorMessage } from "@/lib/errors";
import { AuthLayout } from "@/components/auth/AuthLayout";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, workspaceName, email, password }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Unable to create account.");
      setMessage(data.message);
      setPassword("");
    } catch (cause) {
      setError(errorMessage(cause, "Unable to create account."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Get started"
      title="A clearer view of every campaign."
      description="Bring campaign setup, email engagement, and recipient activity together in one workspace for your team."
    >
      <div className="auth-form-heading">
        <p className="auth-heading-eyebrow">Create an account</p>
        <h2 className="auth-form-title">Create your workspace</h2>
        <p className="auth-form-description">
          Start with a free workspace. Verify your email before signing in.
        </p>
      </div>
      <section className="auth-card">
        <form onSubmit={submit} className="space-y-4" aria-busy={loading}>
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          {message && (
            <p
              role="status"
              className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800"
            >
              {message}
            </p>
          )}
          <label className="block text-sm font-medium" htmlFor="signup-name">
            Your name
            <input
              id="signup-name"
              name="name"
              required
              maxLength={100}
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="apple-input mt-1.5"
            />
          </label>
          <label
            className="block text-sm font-medium"
            htmlFor="signup-workspace"
          >
            Workspace name
            <input
              id="signup-workspace"
              name="workspaceName"
              required
              maxLength={100}
              autoComplete="organization"
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              className="apple-input mt-1.5"
            />
          </label>
          <label className="block text-sm font-medium" htmlFor="signup-email">
            Work email
            <input
              id="signup-email"
              name="email"
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="apple-input mt-1.5"
            />
          </label>
          <label
            className="block text-sm font-medium"
            htmlFor="signup-password"
          >
            Password
            <span className="mt-0.5 block text-xs font-normal text-[#667085]">
              At least 12 characters
            </span>
            <input
              id="signup-password"
              name="new-password"
              required
              type="password"
              minLength={12}
              maxLength={72}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="apple-input mt-1.5"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="apple-btn-primary w-full disabled:opacity-50"
          >
            {loading ? "Creating workspace..." : "Create free workspace"}
          </button>
        </form>
      </section>
      <p className="auth-form-note mt-5 text-center">
        Already have an account?{" "}
        <Link href="/login" className="auth-link">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
