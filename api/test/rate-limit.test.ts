import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createDatabase, type DatabaseResources } from "../src/db/client";
import { generationUsage } from "../src/db/schema";
import { createPostgresGenerationLimiter } from "../src/rate-limit";

const runDatabaseTests = Bun.env.RUN_DATABASE_INTEGRATION === "1";
const databaseDescribe = runDatabaseTests ? describe : describe.skip;

databaseDescribe("PostgreSQL generation limiter", () => {
  let database: DatabaseResources;
  let current: Date;

  beforeAll(async () => {
    database = createDatabase(
      Bun.env.DATABASE_TEST_URL ?? "postgresql://localhost:5432/numa_test",
      { max: 2 },
    );
    await database.check();
  });

  beforeEach(async () => {
    await database.db.delete(generationUsage);
    current = new Date("2026-09-16T12:00:00.000Z");
  });

  afterAll(async () => {
    await database?.close();
  });

  function createLimiter(overrides: Record<string, number> = {}) {
    return createPostgresGenerationLimiter(database.db, {
      secret: "test-secret",
      cooldownSeconds: overrides.cooldownSeconds ?? 600,
      perClientDailyLimit: overrides.perClientDailyLimit ?? 3,
      globalDailyLimit: overrides.globalDailyLimit ?? 20,
      concurrencyLimit: overrides.concurrencyLimit ?? 1,
      now: () => current,
    });
  }

  test("enforces cooldown and per-client daily quota", async () => {
    const limiter = createLimiter({ perClientDailyLimit: 2 });

    (await limiter.acquire("203.0.113.5")).release();
    await expect(limiter.acquire("203.0.113.5")).rejects.toMatchObject({
      code: "generation_rate_limited",
    });

    current = new Date("2026-09-16T12:10:00.000Z");
    (await limiter.acquire("203.0.113.5")).release();
    current = new Date("2026-09-16T12:20:00.000Z");
    await expect(limiter.acquire("203.0.113.5")).rejects.toMatchObject({
      code: "generation_ip_limit_reached",
    });
  });

  test("enforces the global daily quota across clients", async () => {
    const limiter = createLimiter({
      cooldownSeconds: 0,
      perClientDailyLimit: 5,
      globalDailyLimit: 2,
    });

    (await limiter.acquire("203.0.113.1")).release();
    (await limiter.acquire("203.0.113.2")).release();
    await expect(limiter.acquire("203.0.113.3")).rejects.toMatchObject({
      code: "generation_daily_limit_reached",
    });
  });

  test("persists quotas across limiter instances without raw addresses", async () => {
    const first = createLimiter({ cooldownSeconds: 0, perClientDailyLimit: 1 });
    (await first.acquire("203.0.113.9")).release();

    const restarted = createLimiter({
      cooldownSeconds: 0,
      perClientDailyLimit: 1,
    });
    await expect(restarted.acquire("203.0.113.9")).rejects.toMatchObject({
      code: "generation_ip_limit_reached",
    });

    const rows = await database.db.select().from(generationUsage);
    expect(rows).toHaveLength(2);
    expect(rows.map(({ key }) => key)).not.toContain("203.0.113.9");
    expect(rows.find(({ scope }) => scope === "client")?.key).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });

  test("resets daily quotas at UTC midnight", async () => {
    const limiter = createLimiter({ cooldownSeconds: 0, perClientDailyLimit: 1 });
    (await limiter.acquire("203.0.113.7")).release();

    current = new Date("2026-09-17T00:00:00.000Z");
    (await limiter.acquire("203.0.113.7")).release();

    expect(await database.db.select().from(generationUsage)).toHaveLength(4);
  });

  test("keeps provider concurrency process-local and releases once", async () => {
    const limiter = createLimiter({ cooldownSeconds: 0, concurrencyLimit: 1 });
    const first = await limiter.acquire("203.0.113.1");

    await expect(limiter.acquire("203.0.113.2")).rejects.toMatchObject({
      code: "generation_capacity_reached",
    });
    first.release();
    first.release();
    (await limiter.acquire("203.0.113.2")).release();
  });
});
