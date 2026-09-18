import { describe, expect, test } from "bun:test";
import {
  createApp as createProductionApp,
  type AppDependencies,
} from "../src/app";
import {
  AppFailure,
  type AudioStore,
  type GeneratedAudio,
  type MusicProvider,
  type PublicResult,
  type PublicResultStore,
} from "../src/domain";
import type { GenerationLimiter } from "../src/rate-limit";

function createApp(
  dependencies: Omit<AppDependencies, "moderator"> &
    Partial<Pick<AppDependencies, "moderator">>,
) {
  return createProductionApp({
    moderator: { async assertAllowed() {} },
    ...dependencies,
  });
}

function memoryAudioStore(initial?: Map<string, GeneratedAudio>): AudioStore {
  const files = initial ?? new Map<string, GeneratedAudio>();
  return {
    async has(id) {
      return files.has(id);
    },
    async read(id) {
      return files.get(id) ?? null;
    },
    async write(id, audio) {
      files.set(id, audio);
    },
    publicUrl(id) {
      return `https://audio.example/${id}.mp3`;
    },
  };
}

function memoryResults(initial: PublicResult[] = []): PublicResultStore {
  const results = new Map(initial.map((result) => [result.id, result]));
  return {
    async read(id) {
      return results.get(id) ?? null;
    },
    async createIfAbsent(result) {
      const existing = results.get(result.id);
      if (existing) return existing;
      results.set(result.id, result);
      return result;
    },
    async list({ limit, cursor }) {
      const offset = cursor === undefined ? 0 : Number(cursor);
      if (!Number.isInteger(offset) || offset < 0) {
        throw new AppFailure(
          "invalid_gallery_cursor",
          "Invalid gallery cursor",
        );
      }
      const ordered = [...results.values()].sort(
        (left, right) =>
          right.createdAt.localeCompare(left.createdAt) ||
          right.id.localeCompare(left.id),
      );
      const items = ordered.slice(offset, offset + limit);
      return {
        items,
        nextCursor:
          offset + items.length < ordered.length
            ? String(offset + items.length)
            : null,
      };
    },
  };
}

function workingProvider(onCall?: () => void): MusicProvider {
  return {
    async generate() {
      onCall?.();
      return {
        bytes: new Uint8Array([73, 68, 51]),
        contentType: "audio/mpeg",
      };
    },
  };
}

describe("app shell", () => {
  const app = createApp({
    provider: workingProvider(),
    audio: memoryAudioStore(),
    results: memoryResults(),
  });

  test("reports health", async () => {
    const response = await app.request("/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  test("publishes the full OpenAPI contract", async () => {
    const response = await app.request("/openapi.json");
    const document = (await response.json()) as {
      openapi: string;
      paths: Record<string, { get?: unknown; post?: unknown }>;
    };
    expect(document.openapi).toBe("3.0.0");
    expect(document.paths["/health"]).toBeDefined();
    expect(document.paths["/v1/how-it-sounds"]).toBeDefined();
    expect(document.paths["/v1/how-it-sounds"]?.get).toBeDefined();
    expect(document.paths["/v1/how-it-sounds"]?.post).toBeDefined();
    expect(document.paths["/v1/how-it-sounds/{id}"]).toBeDefined();
    expect(document.paths["/v1/audio/{id}"]).toBeDefined();
  });

  test("serves API docs", async () => {
    const response = await app.request("/docs");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
  });
});

describe("generation route", () => {
  test("moderates before cache lookup, quota admission, or generation", async () => {
    const events: string[] = [];
    const baseAudio = memoryAudioStore();
    const app = createApp({
      moderator: {
        async assertAllowed() {
          events.push("moderation");
          throw new AppFailure("thought_not_allowed", "private detail");
        },
      },
      provider: workingProvider(() => events.push("provider")),
      audio: {
        ...baseAudio,
        async has() {
          events.push("cache");
          return false;
        },
      },
      results: memoryResults(),
      limiter: {
        async acquire() {
          events.push("quota");
          return { release() {} };
        },
      },
    } as Parameters<typeof createApp>[0]);

    const response = await app.request("/v1/how-it-sounds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ thought: "private thought" }),
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: {
        code: "thought_not_allowed",
        message: "That thought cannot be published. Try expressing it another way.",
      },
    });
    expect(events).toEqual(["moderation"]);
  });

  test("generates once and then returns the canonical cached result", async () => {
    let calls = 0;
    const app = createApp({
      provider: workingProvider(() => {
        calls += 1;
      }),
      audio: memoryAudioStore(),
      results: memoryResults(),
    });

    const first = await app.request("/v1/how-it-sounds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ thought: "room after rain" }),
    });
    const firstBody = (await first.json()) as {
      id: string;
      thought: string;
      audioUrl: string;
      createdAt: string;
      cached: boolean;
    };
    const second = await app.request("/v1/how-it-sounds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ thought: " room   after rain " }),
    });

    expect(first.status).toBe(200);
    expect(firstBody.id).toMatch(/^[a-f0-9]{64}$/);
    expect(firstBody.thought).toBe("room after rain");
    expect(firstBody.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(firstBody.audioUrl).toBe(
      `https://audio.example/${firstBody.id}.mp3`,
    );
    expect(firstBody.cached).toBe(false);
    expect(await second.json()).toEqual({ ...firstBody, cached: true });
    expect(calls).toBe(1);

    const shared = await app.request(`/v1/how-it-sounds/${firstBody.id}`);
    expect(shared.status).toBe(200);
    expect(await shared.json()).toEqual({
      id: firstBody.id,
      thought: firstBody.thought,
      audioUrl: firstBody.audioUrl,
      createdAt: firstBody.createdAt,
    });
  });

  test("uses the originating client address for generation admission", async () => {
    const admitted: string[] = [];
    const limiter: GenerationLimiter = {
      async acquire(clientAddress) {
        admitted.push(clientAddress);
        return { release() {} };
      },
    };
    const app = createApp({
      provider: workingProvider(),
      audio: memoryAudioStore(),
      results: memoryResults(),
      limiter,
    });

    const response = await app.request("/v1/how-it-sounds", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.7, 10.0.0.2",
      },
      body: JSON.stringify({ thought: "streetlights in the mist" }),
    });

    expect(response.status).toBe(200);
    expect(admitted).toEqual(["203.0.113.7"]);
  });

  test.each([
    ["missing thought", {}],
    ["non-string thought", { thought: 42 }],
    ["blank thought", { thought: "   " }],
    ["oversized thought", { thought: "x".repeat(241) }],
  ])("rejects %s", async (_name, body) => {
    const app = createApp({
      provider: workingProvider(),
      audio: memoryAudioStore(),
      results: memoryResults(),
    });
    const response = await app.request("/v1/how-it-sounds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "invalid_thought",
        message: "Thought must contain between 1 and 240 characters.",
      },
    });
  });

  test("rejects malformed JSON without echoing it", async () => {
    const app = createApp({
      provider: workingProvider(),
      audio: memoryAudioStore(),
      results: memoryResults(),
    });
    const response = await app.request("/v1/how-it-sounds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"thought":"private words"',
    });
    const body = await response.text();

    expect(response.status).toBe(400);
    expect(body).not.toContain("private words");
    expect(JSON.parse(body)).toEqual({
      error: {
        code: "invalid_thought",
        message: "Thought must contain between 1 and 240 characters.",
      },
    });
  });

  test.each([
    ["invalid_provider_response", 502],
    ["provider_configuration_error", 503],
    ["provider_authentication_failed", 502],
    ["provider_payment_required", 402],
    ["provider_access_denied", 403],
    ["provider_request_rejected", 422],
    ["provider_rate_limited", 429],
    ["thought_not_allowed", 422],
    ["moderation_unavailable", 503],
    ["generation_rate_limited", 429],
    ["generation_ip_limit_reached", 429],
    ["generation_daily_limit_reached", 429],
    ["generation_capacity_reached", 429],
    ["provider_unavailable", 503],
    ["generation_timeout", 504],
    ["storage_failure", 500],
  ] as const)("maps %s to %d", async (code, status) => {
    const provider: MusicProvider = {
      async generate() {
        throw new AppFailure(code, "sensitive upstream detail");
      },
    };
    const app = createApp({
      provider,
      audio: memoryAudioStore(),
      results: memoryResults(),
    });
    const response = await app.request("/v1/how-it-sounds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ thought: "private thought" }),
    });
    const body = await response.text();

    expect(response.status).toBe(status);
    expect(body).toContain(`"code":"${code}"`);
    expect(body).not.toContain("sensitive upstream detail");
    expect(body).not.toContain("private thought");
  });

  test("reports an exhausted ElevenLabs key quota without leaking provider details", async () => {
    const provider: MusicProvider = {
      async generate() {
        throw new AppFailure(
          "provider_quota_exceeded",
          "numa-local has 0 credits remaining",
        );
      },
    };
    const app = createApp({
      provider,
      audio: memoryAudioStore(),
      results: memoryResults(),
    });

    const response = await app.request("/v1/how-it-sounds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ thought: "private thought" }),
    });

    expect(response.status).toBe(402);
    expect(await response.json()).toEqual({
      error: {
        code: "provider_quota_exceeded",
        message:
          "The ElevenLabs API key has exhausted its configured credit quota.",
      },
    });
  });
});

describe("gallery route", () => {
  const newestId = "c".repeat(64);
  const olderId = "b".repeat(64);
  const oldestId = "a".repeat(64);
  const results: PublicResult[] = [
    {
      id: oldestId,
      thought: "oldest thought",
      createdAt: "2026-09-15T12:00:00.000Z",
    },
    {
      id: newestId,
      thought: "newest thought",
      createdAt: "2026-09-17T12:00:00.000Z",
    },
    {
      id: olderId,
      thought: "older thought",
      createdAt: "2026-09-16T12:00:00.000Z",
    },
  ];

  test("lists public sounds with canonical audio URLs and a cursor", async () => {
    const app = createApp({
      provider: workingProvider(),
      audio: memoryAudioStore(),
      results: memoryResults(results),
    });

    const response = await app.request("/v1/how-it-sounds?limit=2");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [
        {
          id: newestId,
          thought: "newest thought",
          createdAt: "2026-09-17T12:00:00.000Z",
          audioUrl: `https://audio.example/${newestId}.mp3`,
        },
        {
          id: olderId,
          thought: "older thought",
          createdAt: "2026-09-16T12:00:00.000Z",
          audioUrl: `https://audio.example/${olderId}.mp3`,
        },
      ],
      nextCursor: "2",
    });
  });

  test("uses the default gallery page size", async () => {
    let receivedLimit = 0;
    const store = memoryResults(results);
    const app = createApp({
      provider: workingProvider(),
      audio: memoryAudioStore(),
      results: {
        ...store,
        async list(options) {
          receivedLimit = options.limit;
          return store.list(options);
        },
      },
    });

    const response = await app.request("/v1/how-it-sounds");

    expect(response.status).toBe(200);
    expect(receivedLimit).toBe(12);
  });

  test.each(["0", "25", "abc"])(
    "rejects invalid gallery limit %s",
    async (limit) => {
      const app = createApp({
        provider: workingProvider(),
        audio: memoryAudioStore(),
        results: memoryResults(results),
      });

      const response = await app.request(`/v1/how-it-sounds?limit=${limit}`);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: {
          code: "invalid_gallery_request",
          message: "Gallery pagination is invalid.",
        },
      });
    },
  );

  test("rejects an invalid gallery cursor without exposing details", async () => {
    const app = createApp({
      provider: workingProvider(),
      audio: memoryAudioStore(),
      results: memoryResults(results),
    });

    const response = await app.request(
      "/v1/how-it-sounds?limit=2&cursor=invalid",
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "invalid_gallery_request",
        message: "Gallery pagination is invalid.",
      },
    });
  });
});

describe("audio route", () => {
  test("serves immutable cached MP3 content", async () => {
    const id = "a".repeat(64);
    const files = new Map<string, GeneratedAudio>([
      [
        id,
        {
          bytes: new Uint8Array([73, 68, 51]),
          contentType: "audio/mpeg",
        },
      ],
    ]);
    const app = createApp({
      provider: workingProvider(),
      audio: memoryAudioStore(files),
      results: memoryResults(),
    });
    const response = await app.request(`/v1/audio/${id}`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    expect(response.headers.get("etag")).toBe(`"${id}"`);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([73, 68, 51]),
    );
  });

  test.each(["not-a-hash", "b".repeat(64)])(
    "returns 404 for invalid or missing ID %s",
    async (id) => {
      const app = createApp({
        provider: workingProvider(),
        audio: memoryAudioStore(),
        results: memoryResults(),
      });
      const response = await app.request(`/v1/audio/${id}`);

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        error: {
          code: "audio_not_found",
          message: "Audio was not found.",
        },
      });
    },
  );
});

describe("CORS", () => {
  const app = createApp({
    provider: workingProvider(),
    audio: memoryAudioStore(),
    results: memoryResults(),
    allowedOrigin: "http://localhost:4321",
  });

  test("allows only the configured browser origin", async () => {
    const allowed = await app.request("/v1/audio/not-a-hash", {
      headers: { origin: "http://localhost:4321" },
    });
    const unrelated = await app.request("/v1/audio/not-a-hash", {
      headers: { origin: "https://unrelated.example" },
    });

    expect(allowed.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:4321",
    );
    expect(unrelated.headers.get("access-control-allow-origin")).toBeNull();
  });
});
