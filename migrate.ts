import "dotenv/config";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";

const absoluteDbPath = "/home/bhumi/Code/chess2/db.sqlite3";

const sqlite = new Database(absoluteDbPath);
const db = drizzle(sqlite);

async function main() {
  console.log("Running migrations on:", absoluteDbPath);
  migrate(db, { migrationsFolder: "./packages/db/migrations" });
  console.log("Migrations finished!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
