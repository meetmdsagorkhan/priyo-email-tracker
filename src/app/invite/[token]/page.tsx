"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = Array.isArray(params?.token) ? params.token[0] : params?.token;
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError("Invalid invite link.");
      return;
    }

    if (password.length < 12) {
      setError("Password must be at least 12 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to accept invite.");
        setLoading(false);
        return;
      }

      setSuccess("Account created successfully. Redirecting to sign in...");
      setTimeout(() => {
        router.push("/login");
      }, 1200);
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Team invitation"
      title="A shared view of email engagement."
      description="Activate your account to join your team and follow campaign activity in Priyo Tracker."
    >
      <div className="auth-form-heading">
        <p className="auth-heading-eyebrow">You’re invited</p>
        <h2 className="auth-form-title">
            Create your account
        </h2>
        <p className="auth-form-description">
            Set your name and password to activate your Priyo account.
        </p>
      </div>
      <section className="auth-card">

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mb-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
          >
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="invite-name"
              className="mb-1.5 block text-sm font-medium"
            >
              Full name
            </label>
            <input
              id="invite-name"
              autoComplete="name"
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="apple-input"
              placeholder="Jordan Smith"
              required
            />
          </div>

          <div>
            <label
              htmlFor="invite-password"
              className="mb-1.5 block text-sm font-medium"
            >
              Password
            </label>
            <input
              id="invite-password"
              autoComplete="new-password"
              minLength={12}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="apple-input"
              placeholder="At least 12 characters"
              required
            />
          </div>

          <div>
            <label
              htmlFor="invite-confirm"
              className="mb-1.5 block text-sm font-medium"
            >
              Confirm password
            </label>
            <input
              id="invite-confirm"
              autoComplete="new-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="apple-input"
              placeholder="Re-enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !!success}
            className="apple-btn-primary w-full py-2.5 disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Activate account"}
          </button>
        </form>
      </section>
    </AuthLayout>
  );
}
