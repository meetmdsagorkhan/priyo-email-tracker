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
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.sessionVersion = user.sessionVersion;
      }
      if (typeof token.id === "string") {
        const current = await prisma.user.findUnique({
          where: { id: token.id },
          select: {
            role: true,
            isActive: true,
            sessionVersion: true,
            name: true,
            email: true,
          },
        });
        token.active = Boolean(
          current?.isActive && current.sessionVersion === token.sessionVersion,
        );
        token.role = token.active ? current?.role : undefined;
        token.name = current?.name;
        token.email = current?.email;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id =
        token.active && typeof token.id === "string" ? token.id : "";
      session.user.role = token.active ? token.role : undefined;
      return session;
    },
  },
};
