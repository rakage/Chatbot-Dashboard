import { Role } from "@prisma/client";
import { DefaultSession, DefaultUser } from "next-auth";
import { JWT, DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      companyId: string | null;
      companyName?: string;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role: Role;
    companyId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    role: Role;
    companyId: string | null;
    companyName?: string;
  }
}

declare module "next-auth/adapters" {
  interface AdapterUser {
    role: Role;
    companyId: string | null;
  }
}
