import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "./db";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as any, // Type assertion to bypass adapter compatibility issue
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
          include: { company: true },
        });

        if (!user || !user.password) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId,
        };
      },
    }),
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: parseInt(process.env.EMAIL_SERVER_PORT || "587"),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/login",
    verifyRequest: "/auth/verify-request",
    error: "/auth/error",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Fetch user with company and role information
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          include: {
            company: true,
          },
        });

        if (dbUser) {
          token.role = dbUser.role;
          token.companyId = dbUser.companyId;
          token.companyName = dbUser.company?.name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.sub) {
        session.user.id = token.sub;
        session.user.role = token.role;
        session.user.companyId = token.companyId;
        session.user.companyName = token.companyName;
      }
      return session;
    },
    async signIn({ user, account, profile, email, credentials }) {
      // Allow sign in for existing users or create new ones with AGENT role by default
      return true;
    },
  },
  events: {
    async createUser({ user }) {
      // When a new user is created, assign them to the first company if it exists
      // or create a new company if this is the first user
      const existingUsers = await db.user.count();

      if (existingUsers === 1) {
        // This is the first user, make them OWNER and create a company
        const company = await db.company.create({
          data: {
            name: "Default Company",
          },
        });

        await db.user.update({
          where: { id: user.id },
          data: {
            role: Role.OWNER,
            companyId: company.id,
          },
        });
      } else {
        // For subsequent users, they start as AGENT with no company
        // They need to be invited by an admin
        await db.user.update({
          where: { id: user.id },
          data: {
            role: Role.AGENT,
          },
        });
      }
    },
  },
};

// Helper functions for role checking
export function hasRole(userRole: Role, requiredRole: Role): boolean {
  const roleHierarchy = {
    [Role.AGENT]: 1,
    [Role.ADMIN]: 2,
    [Role.OWNER]: 3,
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

export function canAccessCompany(
  userRole: Role,
  userCompanyId: string | null,
  targetCompanyId: string
): boolean {
  // OWNER and ADMIN can access their company
  if (userCompanyId === targetCompanyId && hasRole(userRole, Role.ADMIN)) {
    return true;
  }

  // AGENT can only access their company's data
  if (userRole === Role.AGENT && userCompanyId === targetCompanyId) {
    return true;
  }

  return false;
}

export function canManageSettings(userRole: Role): boolean {
  return hasRole(userRole, Role.ADMIN);
}

export function canManageUsers(userRole: Role): boolean {
  return hasRole(userRole, Role.ADMIN);
}
