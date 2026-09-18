import { and, desc, eq, lt, or } from "drizzle-orm";
import type { NumaDatabase } from "../db/client";
import { publicSounds } from "../db/schema";
import {
  AppFailure,
  type PublicResult,
  type PublicResultStore,
} from "../domain";
import { decodeResultCursor, encodeResultCursor } from "./result-cursor";

const AUDIO_ID = /^[a-f0-9]{64}$/;

function validateId(id: string): void {
  if (!AUDIO_ID.test(id)) {
    throw new AppFailure("storage_failure", "Invalid result identifier");
  }
}

function toPublicResult(row: typeof publicSounds.$inferSelect): PublicResult {
  return {
    id: row.id,
    thought: row.thought,
    createdAt: row.createdAt.toISOString(),
  };
}

function storageFailure(message: string, error: unknown): AppFailure {
  if (error instanceof AppFailure) return error;
  return new AppFailure("storage_failure", message, { cause: error });
}

export function createPostgresResultStore(
  db: NumaDatabase,
): PublicResultStore {
  async function read(id: string): Promise<PublicResult | null> {
    validateId(id);
    try {
      const [row] = await db
        .select()
        .from(publicSounds)
        .where(eq(publicSounds.id, id))
        .limit(1);
      return row ? toPublicResult(row) : null;
    } catch (error) {
      throw storageFailure("Could not read public result", error);
    }
  }

  return {
    read,

    async createIfAbsent(result) {
      validateId(result.id);
      try {
        const [created] = await db
          .insert(publicSounds)
          .values({
            id: result.id,
            thought: result.thought,
            createdAt: new Date(result.createdAt),
          })
          .onConflictDoNothing({ target: publicSounds.id })
          .returning();
        if (created) return toPublicResult(created);

        const canonical = await read(result.id);
        if (!canonical) {
          throw new Error("Canonical public result disappeared");
        }
        return canonical;
      } catch (error) {
        throw storageFailure("Could not persist public result", error);
      }
    },

    async list({ limit, cursor }) {
      const after = cursor ? decodeResultCursor(cursor) : null;
      try {
        const query = db
          .select()
          .from(publicSounds)
          .orderBy(desc(publicSounds.createdAt), desc(publicSounds.id))
          .limit(limit + 1);
        const rows = after
          ? await query.where(
              or(
                lt(publicSounds.createdAt, new Date(after.createdAt)),
                and(
                  eq(publicSounds.createdAt, new Date(after.createdAt)),
                  lt(publicSounds.id, after.id),
                ),
              ),
            )
          : await query;
        const hasMore = rows.length > limit;
        const items = rows.slice(0, limit).map(toPublicResult);
        const last = items.at(-1);

        return {
          items,
          nextCursor: hasMore && last ? encodeResultCursor(last) : null,
        };
      } catch (error) {
        throw storageFailure("Could not list public results", error);
      }
    },
  };
}
