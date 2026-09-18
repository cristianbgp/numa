import {
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const publicSounds = pgTable(
  "public_sounds",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    thought: varchar("thought", { length: 240 }).notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => [
    index("public_sounds_created_at_id_idx").on(
      table.createdAt.desc(),
      table.id.desc(),
    ),
  ],
);

export const generationUsage = pgTable(
  "generation_usage",
  {
    day: date("day", { mode: "string" }).notNull(),
    scope: varchar("scope", { length: 16 })
      .$type<"global" | "client">()
      .notNull(),
    key: varchar("key", { length: 64 }).notNull(),
    attempts: integer("attempts").notNull(),
    lastAttemptAt: timestamp("last_attempt_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [primaryKey({ columns: [table.day, table.scope, table.key] })],
);
