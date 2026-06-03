import { createClient } from "@libsql/client";
import "dotenv/config";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run migrations.");
}

const client = createClient({
  url: databaseUrl,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = drizzle(client);

async function main() {
  console.log("Running migrations on:", databaseUrl);
  await migrate(db, { migrationsFolder: "./packages/db/migrations" });
  console.log("Migrations finished!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
