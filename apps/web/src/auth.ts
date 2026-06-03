import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { and, eq } from "drizzle-orm";
import { db } from "db/src/index";
import * as schema from "db/src/schema";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { normalizeEmail, verifyPassword } from "./lib/password";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = normalizeEmail(String(credentials?.email ?? ""));
        const password = String(credentials?.password ?? "");

        if (!email || password.length < 6) {
          return null;
        }

        const credentialsAccount = await db.query.accounts.findFirst({
          where: and(
            eq(schema.accounts.provider, "credentials"),
            eq(schema.accounts.providerAccountId, email),
          ),
        });

        if (!credentialsAccount) {
          return null;
        }

        const user = await db.query.users.findFirst({
          where: eq(schema.users.id, credentialsAccount.userId),
        });

        if (!user?.passwordHash) {
          return null;
        }

        const isValidPassword = await verifyPassword(password, user.passwordHash);
        if (!isValidPassword) {
          return null;
        }

        return {
          id: user.id,
          name: user.name ?? user.email,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt({ token, trigger, session }) {
      if (trigger === "update" && session?.user) {
        token.name = session.user.name ?? token.name;
        token.picture = session.user.image ?? token.picture;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
        session.user.name = token.name ?? session.user.name;
        session.user.image = typeof token.picture === "string" ? token.picture : session.user.image;
      }
      return session;
    },
  },
});
