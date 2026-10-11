"use client";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { roles, roleLabels, type AppRole } from "@/lib/permissions";

type TeamUser = {
  id: string;
  email: string;
  name: string | null;
  role: AppRole;
  isActive: boolean;
};
type Invite = {
  id: string;
  email: string;
  role: AppRole;
  status: string;
  expiresAt: string;
};
export function TeamAccess() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [form, setForm] = useState({ name: "", email: "", role: "MEMBER" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [resetUser, setResetUser] = useState<TeamUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [link, setLink] = useState("");
  const admin = session?.user.role === "ADMIN";
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/invite", { cache: "no-store" });
      if (!response.ok)
        throw new Error("Unable to load team access. Try again.");
      const data = await response.json();
      setUsers(data.users);
      setInvites(data.invitations);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to load team.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!admin) return;
    const controller = new AbortController();
    fetch("/api/admin/invite", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load team access.");
        return response.json();
      })
      .then((data) => {
        setUsers(data.users);
        setInvites(data.invitations);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error ? error.message : "Unable to load team.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [admin]);
  async function mutate(
    url: string,
    method: string,
    body: object,
    key: string,
  ) {
    setBusy(key);
    setError("");
    setMessage("");
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Unable to save changes.");
      if (data.inviteUrl) {
        setLink(data.inviteUrl);
        setForm({ name: "", email: "", role: "MEMBER" });
      }
      setMessage(
        data.inviteUrl
          ? "Invitation created. Copy and share the link securely. A new invite replaces earlier pending links for this email."
          : "Access updated.",
      );
      setResetUser(null);
      setResetPassword("");
      await load();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to save changes.",
      );
    } finally {
      setBusy("");
    }
  }
  if (status === "loading") return <p role="status">Loading access…</p>;
  if (!admin)
    return (
      <div className="bento-card p-6">
        <h2 className="font-semibold">Your access</h2>
        <p className="mt-2 text-sm text-[#515154]">
          Your role is {session?.user.role && roleLabels[session.user.role]}.
          Admins manage team access. Admins and campaign managers can create
          campaigns, manage recipients, and send email; members and viewers have
          read-only access.
        </p>
      </div>
    );
  return (
    <section
      className="bento-card space-y-6 p-5 sm:p-8"
      aria-labelledby="team-title"
    >
      <div>
        <h2 id="team-title" className="text-lg font-semibold">
          Team access
        </h2>
        <p className="mt-1 text-sm text-[#515154]">
          Invite teammates, change roles, or disable accounts. Role changes
          apply to existing sessions.
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setLink("");
          void mutate("/api/admin/invite", "POST", form, "invite");
        }}
        className="grid gap-3 sm:grid-cols-2"
      >
        <div>
          <label htmlFor="team-name" className="mb-1 block text-sm">
            Full name
          </label>
          <input
            id="team-name"
            required
            maxLength={100}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="apple-input"
          />
        </div>
        <div>
          <label htmlFor="team-email" className="mb-1 block text-sm">
            Work email
          </label>
          <input
            id="team-email"
            type="email"
            required
            maxLength={254}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="apple-input"
          />
        </div>
        <div>
          <label htmlFor="team-role" className="mb-1 block text-sm">
            Role
          </label>
          <select
            id="team-role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="apple-input"
          >
            {roles.map((role) => (
              <option key={role} value={role}>
                {roleLabels[role]}
              </option>
            ))}
          </select>
        </div>
        <button disabled={!!busy} className="apple-btn-primary self-end !py-3">
          {busy === "invite" ? "Creating…" : "Create invitation"}
        </button>
      </form>
      <p className="text-xs text-[#515154]">
        Admins: full access. Campaign managers: campaigns, recipients, sending.
        Members and viewers: read-only.
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {error}{" "}
          <button onClick={() => void load()} className="underline">
            Reload
          </button>
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-xl bg-green-50 p-3 text-sm text-green-800"
        >
          {message}
        </p>
      )}
      {link && (
        <div className="flex flex-wrap gap-2">
          <input
            aria-label="Invitation link"
            readOnly
            value={link}
            className="apple-input !w-auto min-w-0 flex-1"
          />
          <button
            className="apple-btn-secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setMessage("Invitation link copied.");
              } catch {
                setError("Select and copy the invitation link manually.");
              }
            }}
          >
            Copy link
          </button>
        </div>
      )}
      {loading ? (
        <p role="status">Loading team…</p>
      ) : (
        <>
          {resetUser && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void mutate(
                  "/api/admin/users",
                  "PATCH",
                  {
                    id: resetUser.id,
                    role: resetUser.role,
                    isActive: resetUser.isActive,
                    password: resetPassword,
                  },
                  resetUser.id,
                );
              }}
              className="space-y-3 rounded-xl border p-4"
            >
              <label htmlFor="reset-password" className="block text-sm">
                New password for {resetUser.email}
              </label>
              <input
                id="reset-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                className="apple-input"
              />
              <p className="text-xs text-[#515154]">
                At least 12 characters. Existing sessions will be signed out.
                Share the new password securely.
              </p>
              <div className="flex gap-2">
                <button disabled={!!busy} className="apple-btn-primary">
                  Save password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResetUser(null);
                    setResetPassword("");
                  }}
                  className="apple-btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          <h3 className="font-semibold">Current team</h3>
          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-black/5 p-3"
              >
                <div className="min-w-0 flex-1 basis-40">
                  <p className="break-words text-sm font-medium">
                    {user.name || user.email}
                    {user.id === session?.user.id ? " (you)" : ""}
                  </p>
                  <p className="break-all text-xs text-[#515154]">
                    {user.email} · {user.isActive ? "Active" : "Disabled"}
                  </p>
                </div>
                <select
                  aria-label={`Role for ${user.email}`}
                  value={user.role}
                  disabled={!!busy || user.id === session?.user.id}
                  onChange={(e) =>
                    void mutate(
                      "/api/admin/users",
                      "PATCH",
                      {
                        id: user.id,
                        role: e.target.value,
                        isActive: user.isActive,
                      },
                      user.id,
                    )
                  }
                  className="apple-input !w-auto"
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </select>
                <button
                  disabled={!!busy}
                  onClick={() => {
                    setResetUser(user);
                    setResetPassword("");
                  }}
                  className="apple-btn-secondary"
                >
                  Reset password
                </button>
                <button
                  disabled={!!busy || user.id === session?.user.id}
                  onClick={() => {
                    if (
                      user.isActive &&
                      !window.confirm(`Disable access for ${user.email}?`)
                    )
                      return;
                    void mutate(
                      "/api/admin/users",
                      "PATCH",
                      {
                        id: user.id,
                        role: user.role,
                        isActive: !user.isActive,
                      },
                      user.id,
                    );
                  }}
                  className="apple-btn-secondary"
                >
                  {user.isActive ? "Disable" : "Enable"}
                </button>
              </div>
            ))}
          </div>
          <h3 className="font-semibold">Invitations</h3>
          {!invites.length && (
            <p className="text-sm text-[#515154]">No invitations yet.</p>
          )}
          <div className="space-y-2">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/5 p-3"
              >
                <div className="min-w-0">
                  <p className="break-all text-sm">{invite.email}</p>
                  <p className="text-xs text-[#515154]">
                    {roleLabels[invite.role]} · {invite.status} · Expires{" "}
                    {new Date(invite.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                {invite.status === "PENDING" && (
                  <button
                    disabled={!!busy}
                    className="apple-btn-secondary"
                    onClick={() =>
                      void mutate(
                        "/api/admin/invite",
                        "DELETE",
                        { id: invite.id },
                        invite.id,
                      )
                    }
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
