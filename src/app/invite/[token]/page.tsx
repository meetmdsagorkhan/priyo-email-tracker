"use client";

import { useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";

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

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

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
    setLoading(false);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f5f5f7] p-4">
      <div className="w-full max-w-md rounded-[28px] border border-black/[0.08] bg-white/80 p-8 shadow-xl backdrop-blur-xl">
        <div className="text-center mb-6">
          <div className="mx-auto mb-4 h-16 w-16 overflow-hidden rounded-2xl bg-white shadow-lg">
            <Image src="/email-tracker-favicon.png" alt="Priyo favicon" width={160} height={160} className="h-full w-full object-cover" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">Create your account</h1>
          <p className="mt-1 text-xs text-[#86868b]">Set your name and password to activate your Priyo account.</p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-[#ff3b30]/20 bg-[#ff3b30]/10 px-3 py-2 text-xs text-[#ff3b30]">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-xl border border-[#34c759]/20 bg-[#34c759]/10 px-3 py-2 text-xs text-[#1d1d1f]">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#1d1d1f]">Full name</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="apple-input text-xs"
              placeholder="Jordan Smith"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#1d1d1f]">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="apple-input text-xs"
              placeholder="At least 8 characters"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#1d1d1f]">Confirm password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="apple-input text-xs"
              placeholder="Re-enter your password"
              required
            />
          </div>

          <button type="submit" disabled={loading} className="apple-btn-primary w-full text-xs py-2.5 font-medium disabled:opacity-60">
            {loading ? "Creating account..." : "Activate account"}
          </button>
        </form>
      </div>
    </div>
  );
}
