import { describe, expect, test } from "bun:test";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { createR2AudioStore } from "../src/storage/r2-audio-store";

function fakeClient(send: (command: unknown) => Promise<unknown>) {
  return { send };
}

describe("R2 audio store", () => {
  const id = "a".repeat(64);

  test("checks object existence and treats only not-found as a miss", async () => {
    const hit = createR2AudioStore({
      client: fakeClient(async (command) => {
        expect(command).toBeInstanceOf(HeadObjectCommand);
        return {};
      }),
      bucket: "numa-audio",
      publicBaseUrl: "https://media.numa.channel",
    });
    expect(await hit.has(id)).toBe(true);

    const miss = createR2AudioStore({
      client: fakeClient(async () => {
        throw Object.assign(new Error("missing"), {
          name: "NotFound",
          $metadata: { httpStatusCode: 404 },
        });
      }),
      bucket: "numa-audio",
      publicBaseUrl: "https://media.numa.channel",
    });
    expect(await miss.has(id)).toBe(false);
  });

  test("writes immutable MPEG objects", async () => {
    let input: PutObjectCommand["input"] | undefined;
    const store = createR2AudioStore({
      client: fakeClient(async (command) => {
        expect(command).toBeInstanceOf(PutObjectCommand);
        input = (command as PutObjectCommand).input;
        return {};
      }),
      bucket: "numa-audio",
      publicBaseUrl: "https://media.numa.channel/",
    });
    const bytes = new Uint8Array([73, 68, 51]);

    await store.write(id, { bytes, contentType: "audio/mpeg" });

    expect(input).toMatchObject({
      Bucket: "numa-audio",
      Key: `${id}.mp3`,
      Body: bytes,
      ContentType: "audio/mpeg",
      CacheControl: "public, max-age=31536000, immutable",
    });
    expect(store.publicUrl(id)).toBe(`https://media.numa.channel/${id}.mp3`);
  });

  test("reads object bytes for the compatibility route", async () => {
    const store = createR2AudioStore({
      client: fakeClient(async (command) => {
        expect(command).toBeInstanceOf(GetObjectCommand);
        return {
          Body: {
            async transformToByteArray() {
              return new Uint8Array([73, 68, 51]);
            },
          },
        };
      }),
      bucket: "numa-audio",
      publicBaseUrl: "https://media.numa.channel",
    });

    expect(await store.read(id)).toEqual({
      bytes: new Uint8Array([73, 68, 51]),
      contentType: "audio/mpeg",
    });
  });

  test("returns null for missing reads and sanitizes operational failures", async () => {
    const missing = createR2AudioStore({
      client: fakeClient(async () => {
        throw Object.assign(new Error("secret provider detail"), {
          $metadata: { httpStatusCode: 404 },
        });
      }),
      bucket: "numa-audio",
      publicBaseUrl: "https://media.numa.channel",
    });
    expect(await missing.read(id)).toBeNull();

    const failing = createR2AudioStore({
      client: fakeClient(async () => {
        throw new Error("secret provider detail");
      }),
      bucket: "numa-audio",
      publicBaseUrl: "https://media.numa.channel",
    });
    await expect(failing.has(id)).rejects.toMatchObject({
      code: "storage_failure",
      message: "Could not inspect audio storage",
    });
  });
});
