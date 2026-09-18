import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type NumaDatabase = PostgresJsDatabase<typeof schema>;

export type DatabaseResources = {
  db: NumaDatabase;
  check(): Promise<void>;
  close(): Promise<void>;
};

export function createDatabase(
  url: string,
  options: { max?: number } = {},
): DatabaseResources {
  const client = postgres(url, { max: options.max ?? 10 });
  const db = drizzle(client, { schema });

  return {
    db,
    async check() {
      await client`select 1`;
    },
    async close() {
      await client.end();
    },
  };
}
