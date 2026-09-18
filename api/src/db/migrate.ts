import { join } from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabase } from "./client";

const databaseUrl = Bun.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const database = createDatabase(databaseUrl, { max: 1 });

try {
  await database.check();
  await migrate(database.db, {
    migrationsFolder: join(import.meta.dir, "../../drizzle"),
  });
  console.log("Database migrations applied");
} finally {
  await database.close();
}
