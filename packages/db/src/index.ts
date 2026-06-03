import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/libsql/web";
import * as schema from "./schema";

for (const envPath of [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../..", ".env"),
]) {
  if (existsSync(envPath)) config({ path: envPath, quiet: true });
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to connect to the database.");
}

export const db = drizzle({
  connection: {
    url: databaseUrl,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
  schema,
});
