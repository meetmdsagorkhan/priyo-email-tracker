"use client";
import { useState } from "react";
import { signOut } from "next-auth/react";
export function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="bento-card p-5 sm:p-8">
      <h2 className="text-lg font-semibold">Change your password</h2>
      <p className="mt-1 text-sm text-[#515154]">
        Changing your password signs out existing sessions.
      </p>
      <form
        className="mt-5 max-w-md space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          if (password !== confirm) {
            setError("New passwords do not match.");
            return;
          }
          setBusy(true);
          try {
            const response = await fetch("/api/account/password", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ currentPassword: current, password }),
            });
            const data = await response.json();
            if (!response.ok)
              throw new Error(data.error || "Unable to change password.");
            await signOut({ callbackUrl: "/login" });
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Unable to change password.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <div>
          <label htmlFor="current-password" className="mb-1 block text-sm">
            Current password
          </label>
          <input
            id="current-password"
            required
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="apple-input"
          />
        </div>
        <div>
          <label htmlFor="new-password" className="mb-1 block text-sm">
            New password
          </label>
          <input
            id="new-password"
            required
            minLength={12}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="apple-input"
          />
          <p className="mt-1 text-xs text-[#515154]">
            At least 12 characters, up to 72 bytes.
          </p>
        </div>
        <div>
          <label htmlFor="confirm-password" className="mb-1 block text-sm">
            Confirm new password
          </label>
          <input
            id="confirm-password"
            required
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="apple-input"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <button disabled={busy} className="apple-btn-primary">
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>
    </section>
  );
}
