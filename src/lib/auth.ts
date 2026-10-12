import { authenticationRedirect } from "./site";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcrypt";
import crypto from "node:crypto";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password || Buffer.byteLength(password) > 72)
          return null;
        try {
          const emailHash = crypto
            .createHash("sha256")
            .update(email)
            .digest("hex");
          const failures = await prisma.auditLog.count({
            where: {
              action: "LOGIN_FAILED",
              createdAt: { gt: new Date(Date.now() - 15 * 60 * 1000) },
              details: { path: ["emailHash"], equals: emailHash },
            },
          });
          if (failures >= 10) return null;
          const user = await prisma.user.findUnique({ where: { email } });
          if (
            !user?.isActive ||
            !user.emailVerifiedAt ||
            !(await bcrypt.compare(password, user.password))
          ) {
            await prisma.auditLog.create({
              data: { action: "LOGIN_FAILED", details: { emailHash } },
            });
            return null;
          }
          await prisma.auditLog.deleteMany({
            where: {
              action: "LOGIN_FAILED",
              details: { path: ["emailHash"], equals: emailHash },
            },
          });
          const membership = await prisma.workspaceMembership.findFirst({
            where: { userId: user.id, isActive: true },
            orderBy: { createdAt: "asc" },
          });
          if (!membership) return null;
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: membership.role,
            workspaceId: membership.workspaceId,
            workspaceSessionVersion: membership.sessionVersion,
            sessionVersion: user.sessionVersion,
          };
        } catch (error) {
          // Never mislabel a missing column, unreachable DB, or bad deployment
          // configuration as an incorrect password. Do not log credentials.
          console.error("AUTH_DATABASE_ERROR", {
            code:
              error && typeof error === "object" && "code" in error
                ? error.code
                : "UNKNOWN",
          });
          throw new Error("Configuration");
        }
      },
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      return authenticationRedirect(url, baseUrl);
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.sessionVersion = user.sessionVersion;
        token.workspaceId = user.workspaceId;
        token.workspaceSessionVersion = user.workspaceSessionVersion;
      }
      if (typeof token.id === "string") {
        const current = await prisma.user.findUnique({
          where: { id: token.id },
          select: {
            isActive: true,
            sessionVersion: true,
            name: true,
            email: true,
            memberships: {
              where: { workspaceId: token.workspaceId },
              select: { role: true, isActive: true, sessionVersion: true },
              take: 1,
            },
          },
        });
        token.active = Boolean(
          current?.isActive &&
            current.sessionVersion === token.sessionVersion &&
            current.memberships.some(
              (membership) =>
                membership.isActive &&
                membership.sessionVersion === token.workspaceSessionVersion,
            ),
        );
        token.role = token.active ? current?.memberships[0].role : undefined;
        token.name = current?.name;
        token.email = current?.email;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id =
        token.active && typeof token.id === "string" ? token.id : "";
      session.user.role = token.active ? token.role : undefined;
      session.user.workspaceId =
        token.active && typeof token.workspaceId === "string"
          ? token.workspaceId
          : undefined;
      return session;
    },
  },
};
