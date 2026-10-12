import type { DefaultSession } from "next-auth";
import type { AppRole } from "@/lib/permissions";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role?: AppRole;
      workspaceId?: string;
      workspaceSessionVersion?: number;
    };
  }
  interface User {
    role?: AppRole;
    sessionVersion?: number;
    workspaceId?: string;
    workspaceSessionVersion?: number;
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: AppRole;
    active?: boolean;
    sessionVersion?: number;
    workspaceId?: string;
    workspaceSessionVersion?: number;
  }
}
