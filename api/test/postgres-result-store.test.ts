import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDatabase, type DatabaseResources } from "../src/db/client";
import { publicSounds } from "../src/db/schema";
import { createPostgresResultStore } from "../src/storage/postgres-result-store";

const runDatabaseTests = Bun.env.RUN_DATABASE_INTEGRATION === "1";
const databaseDescribe = runDatabaseTests ? describe : describe.skip;

databaseDescribe("PostgreSQL public result store", () => {
  let database: DatabaseResources;

  beforeAll(async () => {
    database = createDatabase(
      Bun.env.DATABASE_TEST_URL ?? "postgresql://localhost:5432/numa_test",
      { max: 1 },
    );
    await database.check();
  });

  beforeEach(async () => {
    await database.db.delete(publicSounds);
  });

  afterAll(async () => {
    await database?.close();
  });

  test("creates one canonical result and preserves its first values", async () => {
    const store = createPostgresResultStore(database.db);
    const id = "a".repeat(64);
    const original = {
      id,
      thought: "quiet room after rain",
      createdAt: "2026-09-16T20:00:00.000Z",
    };

    expect(await store.read(id)).toBeNull();
    expect(await store.createIfAbsent(original)).toEqual(original);
    expect(
      await store.createIfAbsent({
        id,
        thought: "replacement thought",
        createdAt: "2026-09-16T21:00:00.000Z",
      }),
    ).toEqual(original);
    expect(await store.read(id)).toEqual(original);

    const rows = await database.db
      .select()
      .from(publicSounds)
      .where(eq(publicSounds.id, id));
    expect(rows).toHaveLength(1);
  });

  test("returns null for a missing result", async () => {
    const store = createPostgresResultStore(database.db);

    expect(await store.read("f".repeat(64))).toBeNull();
  });

  test("lists newest results first with stable cursor pagination", async () => {
    const store = createPostgresResultStore(database.db);
    const oldestId = "a".repeat(64);
    const tiedLowerId = "b".repeat(64);
    const tiedHigherId = "c".repeat(64);
    const newestId = "d".repeat(64);

    await Promise.all([
      store.createIfAbsent({
        id: oldestId,
        thought: "oldest",
        createdAt: "2026-09-16T20:00:00.000Z",
      }),
      store.createIfAbsent({
        id: tiedLowerId,
        thought: "lower tie",
        createdAt: "2026-09-16T21:00:00.000Z",
      }),
      store.createIfAbsent({
        id: tiedHigherId,
        thought: "higher tie",
        createdAt: "2026-09-16T21:00:00.000Z",
      }),
      store.createIfAbsent({
        id: newestId,
        thought: "newest",
        createdAt: "2026-09-16T22:00:00.000Z",
      }),
    ]);

    const firstPage = await store.list({ limit: 2 });
    expect(firstPage.items.map(({ id }) => id)).toEqual([
      newestId,
      tiedHigherId,
    ]);
    expect(firstPage.nextCursor).toEqual(expect.any(String));

    const secondPage = await store.list({
      limit: 2,
      cursor: firstPage.nextCursor!,
    });
    expect(secondPage.items.map(({ id }) => id)).toEqual([
      tiedLowerId,
      oldestId,
    ]);
    expect(secondPage.nextCursor).toBeNull();
  });

  test("returns an empty page", async () => {
    const store = createPostgresResultStore(database.db);

    expect(await store.list({ limit: 12 })).toEqual({
      items: [],
      nextCursor: null,
    });
  });

  test("rejects malformed gallery cursors before querying", async () => {
    const store = createPostgresResultStore(database.db);

    await expect(
      store.list({ limit: 12, cursor: "not-a-valid-cursor" }),
    ).rejects.toMatchObject({ code: "invalid_gallery_cursor" });
  });
});
