/** @type { import("drizzle-kit").Config } */
export default {
  schema: './packages/db/src/schema.ts',
  out: './packages/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: './db.sqlite3',
  }
};