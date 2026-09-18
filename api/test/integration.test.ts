import { afterAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/app";
import type { PublicResultStore } from "../src/domain";
import { createElevenLabsProvider } from "../src/music/elevenlabs";
import { createLocalAudioStore } from "../src/storage/local-audio-store";

const runPaidTest = Bun.env.RUN_ELEVENLABS_INTEGRATION === "1";
const paidTest = runPaidTest ? test : test.skip;
let storageDir: string | undefined;

function createMemoryResultStore(): PublicResultStore {
  const results = new Map();
  return {
    async read(id) {
      return results.get(id) ?? null;
    },
    async createIfAbsent(result) {
      const canonical = results.get(result.id) ?? result;
      results.set(result.id, canonical);
      return canonical;
    },
    async list() {
      return { items: [...results.values()], nextCursor: null };
    },
  };
}

afterAll(async () => {
  if (storageDir) await rm(storageDir, { recursive: true, force: true });
});

paidTest("PAID: generates and reuses one ElevenLabs track", async () => {
  const apiKey = Bun.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "ELEVENLABS_API_KEY is required when RUN_ELEVENLABS_INTEGRATION=1",
    );
  }

  storageDir = await mkdtemp(join(tmpdir(), "numa-integration-"));
  const app = createApp({
    moderator: { async assertAllowed() {} },
    provider: createElevenLabsProvider({ apiKey }),
    audio: createLocalAudioStore(storageDir, "http://localhost:3000"),
    results: createMemoryResultStore(),
  });
  const thought = "the quiet room after the last train";

  const first = await app.request("/v1/how-it-sounds", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ thought }),
  });
  const firstBody = (await first.json()) as {
    id: string;
    audioUrl: string;
    cached: boolean;
  };

  expect(first.status).toBe(200);
  expect(firstBody.id).toMatch(/^[a-f0-9]{64}$/);
  expect(firstBody.cached).toBe(false);

  const audio = await app.request(new URL(firstBody.audioUrl).pathname);
  expect(audio.status).toBe(200);
  expect(audio.headers.get("content-type")).toBe("audio/mpeg");
  expect((await audio.arrayBuffer()).byteLength).toBeGreaterThan(0);

  const second = await app.request("/v1/how-it-sounds", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ thought }),
  });
  const secondBody = (await second.json()) as {
    id: string;
    cached: boolean;
  };

  expect(second.status).toBe(200);
  expect(secondBody.id).toBe(firstBody.id);
  expect(secondBody.cached).toBe(true);
});
