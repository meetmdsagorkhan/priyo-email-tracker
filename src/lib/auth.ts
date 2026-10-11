import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './prisma';
import bcrypt from 'bcrypt';

export const DEFAULT_ADMIN = {
  email: process.env.DEFAULT_ADMIN_EMAIL || 'sagor.khan@priyo.net',
  password: process.env.DEFAULT_ADMIN_PASSWORD || 'Mahibkhan@282024',
  name: process.env.DEFAULT_ADMIN_NAME || 'Sagor Khan',
};

export async function ensureDefaultAdminUser() {
  const existing = await prisma.user.findUnique({
    where: { email: DEFAULT_ADMIN.email },
  });

  if (existing) {
    if (!existing.isActive) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { isActive: true, role: 'ADMIN' },
      });
    }
    return existing;
  }

  const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN.password, 12);

  return prisma.user.create({
    data: {
      email: DEFAULT_ADMIN.email,
      password: hashedPassword,
      name: DEFAULT_ADMIN.name,
      role: 'ADMIN',
      isActive: true,
    },
  });
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'sagor.khan@priyo.net' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;

        if (!email || !password) {
          return null;
        }

        await ensureDefaultAdminUser();

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.isActive) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
  },
};
