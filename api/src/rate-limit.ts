import { createHmac } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { NumaDatabase } from "./db/client";
import { generationUsage } from "./db/schema";
import { AppFailure } from "./domain";

export type GenerationPermit = {
  release(): void;
};

export type GenerationLimiter = {
  acquire(clientAddress: string): Promise<GenerationPermit>;
};

export type PostgresGenerationLimiterOptions = {
  secret: string;
  cooldownSeconds: number;
  perClientDailyLimit: number;
  globalDailyLimit: number;
  concurrencyLimit: number;
  now?: () => Date;
};

const GENERATION_ADMISSION_LOCK = 1_314_214_209;
const GLOBAL_KEY = "all";

export function createPostgresGenerationLimiter(
  db: NumaDatabase,
  options: PostgresGenerationLimiterOptions,
): GenerationLimiter {
  const now = options.now ?? (() => new Date());
  let active = 0;

  function clientKey(clientAddress: string): string {
    return createHmac("sha256", options.secret)
      .update(clientAddress)
      .digest("hex");
  }

  return {
    async acquire(clientAddress) {
      if (active >= options.concurrencyLimit) {
        throw new AppFailure(
          "generation_capacity_reached",
          "Generation concurrency limit reached",
        );
      }
      active += 1;

      try {
        const timestamp = now();
        const day = timestamp.toISOString().slice(0, 10);
        const key = clientKey(clientAddress);

        await db.transaction(async (transaction) => {
          await transaction.execute(
            sql`select pg_advisory_xact_lock(${GENERATION_ADMISSION_LOCK})`,
          );

          const [global] = await transaction
            .select()
            .from(generationUsage)
            .where(
              and(
                eq(generationUsage.day, day),
                eq(generationUsage.scope, "global"),
                eq(generationUsage.key, GLOBAL_KEY),
              ),
            )
            .limit(1);
          const [client] = await transaction
            .select()
            .from(generationUsage)
            .where(
              and(
                eq(generationUsage.day, day),
                eq(generationUsage.scope, "client"),
                eq(generationUsage.key, key),
              ),
            )
            .limit(1);

          if ((global?.attempts ?? 0) >= options.globalDailyLimit) {
            throw new AppFailure(
              "generation_daily_limit_reached",
              "Global generation limit reached",
            );
          }
          if ((client?.attempts ?? 0) >= options.perClientDailyLimit) {
            throw new AppFailure(
              "generation_ip_limit_reached",
              "Client generation limit reached",
            );
          }
          if (
            client?.lastAttemptAt &&
            timestamp.getTime() - client.lastAttemptAt.getTime() <
              options.cooldownSeconds * 1_000
          ) {
            throw new AppFailure(
              "generation_rate_limited",
              "Client generation cooldown is active",
            );
          }

          await transaction
            .insert(generationUsage)
            .values({
              day,
              scope: "global",
              key: GLOBAL_KEY,
              attempts: (global?.attempts ?? 0) + 1,
              lastAttemptAt: null,
            })
            .onConflictDoUpdate({
              target: [
                generationUsage.day,
                generationUsage.scope,
                generationUsage.key,
              ],
              set: { attempts: (global?.attempts ?? 0) + 1 },
            });
          await transaction
            .insert(generationUsage)
            .values({
              day,
              scope: "client",
              key,
              attempts: (client?.attempts ?? 0) + 1,
              lastAttemptAt: timestamp,
            })
            .onConflictDoUpdate({
              target: [
                generationUsage.day,
                generationUsage.scope,
                generationUsage.key,
              ],
              set: {
                attempts: (client?.attempts ?? 0) + 1,
                lastAttemptAt: timestamp,
              },
            });
        });
      } catch (error) {
        active = Math.max(0, active - 1);
        if (error instanceof AppFailure) throw error;
        throw new AppFailure("storage_failure", "Could not persist rate limits", {
          cause: error,
        });
      }

      let released = false;
      return {
        release() {
          if (released) return;
          released = true;
          active = Math.max(0, active - 1);
        },
      };
    },
  };
}
