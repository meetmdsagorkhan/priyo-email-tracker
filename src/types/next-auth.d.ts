import type { DefaultSession } from "next-auth";
import type { AppRole } from "@/lib/permissions";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { id: string; role?: AppRole };
  }
  interface User {
    role?: AppRole;
    sessionVersion?: number;
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: AppRole;
    active?: boolean;
    sessionVersion?: number;
  }
}
