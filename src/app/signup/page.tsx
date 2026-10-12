"use client";

import Link from "next/link";
import { useState } from "react";
import { errorMessage } from "@/lib/errors";

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
    <main className="min-h-dvh flex items-center justify-center bg-[#f5f5f7] p-4 sm:p-8">
      <section className="apple-glass-card w-full max-w-md rounded-3xl p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Create your workspace</h1>
        <p className="mt-2 text-sm text-[#515154]">
          Start with a free workspace. Verify your email before signing in.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {message && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{message}</p>}
          <label className="block text-sm">Your name
            <input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className="apple-input mt-1" />
          </label>
          <label className="block text-sm">Workspace name
            <input required maxLength={100} value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} className="apple-input mt-1" />
          </label>
          <label className="block text-sm">Work email
            <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="apple-input mt-1" />
          </label>
          <label className="block text-sm">Password (at least 12 characters)
            <input required type="password" minLength={12} maxLength={72} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="apple-input mt-1" />
          </label>
          <button type="submit" disabled={loading} className="apple-btn-primary w-full disabled:opacity-50">
            {loading ? "Creating workspace..." : "Create free workspace"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-[#515154]">
          Already have an account? <Link href="/login" className="text-[#0071e3]">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
