import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "db/src/index";
import { accounts, users } from "db/src/schema";
import { hashPassword, normalizeEmail } from "@/lib/password";

type AccountInsert = typeof accounts.$inferInsert;

function isValidSignupEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
  } | null;

  const email = normalizeEmail(String(body?.email ?? ""));
  const password = String(body?.password ?? "");

  if (!isValidSignupEmail(email)) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (password.length < 6) {
    return Response.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 },
    );
  }

  const existingAccount = await db.query.accounts.findFirst({
    where: and(
      eq(accounts.provider, "credentials"),
      eq(accounts.providerAccountId, email),
    ),
  });

  if (existingAccount) {
    return Response.json(
      { error: "An account already exists for this email." },
      { status: 409 },
    );
  }

  const userId = randomUUID();
  const passwordHash = await hashPassword(password);
  const displayName = email.split("@")[0] || email;

  await db.insert(users).values({
    id: userId,
    name: displayName,
    email,
    image: null,
    emailVerified: null,
    passwordHash,
  });

  await db.insert(accounts).values({
    userId,
    type: "credentials" as AccountInsert["type"],
    provider: "credentials",
    providerAccountId: email,
  });

  return Response.json({ ok: true });
}
