import { AppFailure, type PublicResult } from "../domain";

const AUDIO_ID = /^[a-f0-9]{64}$/;

export type ResultCursor = Pick<PublicResult, "createdAt" | "id">;

function isIsoDate(value: string): boolean {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

export function encodeResultCursor(result: ResultCursor): string {
  return Buffer.from(
    JSON.stringify({ createdAt: result.createdAt, id: result.id }),
  ).toString("base64url");
}

export function decodeResultCursor(cursor: string): ResultCursor {
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as
      Partial<ResultCursor>;
    if (
      typeof value.createdAt !== "string" ||
      !isIsoDate(value.createdAt) ||
      typeof value.id !== "string" ||
      !AUDIO_ID.test(value.id)
    ) {
      throw new Error("Invalid cursor data");
    }
    return { createdAt: value.createdAt, id: value.id };
  } catch (error) {
    throw new AppFailure("invalid_gallery_cursor", "Invalid gallery cursor", {
      cause: error,
    });
  }
}
