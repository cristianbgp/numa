import { describe, expect, test } from "bun:test";
import type {
  AudioStore,
  GeneratedAudio,
  MusicProvider,
} from "../src/domain";
import { AppFailure } from "../src/domain";
import { createMusicGenerator } from "../src/music/generate";
import type { GenerationLimiter } from "../src/rate-limit";

function memoryAudioStore(): AudioStore {
  const files = new Map<string, GeneratedAudio>();
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

describe("music generator", () => {
  test("reuses canonical audio for normalized-equivalent thoughts", async () => {
    let calls = 0;
    const prompts: string[] = [];
    const provider: MusicProvider = {
      async generate(prompt) {
        calls += 1;
        prompts.push(prompt);
        return { bytes: new Uint8Array([1]), contentType: "audio/mpeg" };
      },
    };
    const generate = createMusicGenerator({ provider, audio: memoryAudioStore() });

    const first = await generate("  soft  morning  ");
    const second = await generate(" soft\nmorning ");

    expect(first.cached).toBe(false);
    expect(second).toEqual({ id: first.id, cached: true });
    expect(calls).toBe(1);
    expect(prompts[0]).toContain("“soft  morning”");
  });

  test("deduplicates simultaneous misses", async () => {
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const provider: MusicProvider = {
      async generate() {
        calls += 1;
        await gate;
        return { bytes: new Uint8Array([1]), contentType: "audio/mpeg" };
      },
    };
    const generate = createMusicGenerator({ provider, audio: memoryAudioStore() });
    const first = generate("same thought");
    const second = generate("same thought");
    release();

    const [created, joined] = await Promise.all([first, second]);
    expect(created).toEqual({ id: joined.id, cached: false });
    expect(joined.cached).toBe(true);
    expect(calls).toBe(1);
  });

  test("clears a failed in-flight request so it can be retried explicitly", async () => {
    let calls = 0;
    const provider: MusicProvider = {
      async generate() {
        calls += 1;
        if (calls === 1) throw new Error("temporary failure");
        return { bytes: new Uint8Array([1]), contentType: "audio/mpeg" };
      },
    };
    const generate = createMusicGenerator({ provider, audio: memoryAudioStore() });

    await expect(generate("retry me")).rejects.toThrow("temporary failure");
    expect(await generate("retry me")).toMatchObject({ cached: false });
    expect(calls).toBe(2);
  });

  test("charges admission only for a new provider generation", async () => {
    let admissions = 0;
    let providerCalls = 0;
    const limiter: GenerationLimiter = {
      async acquire() {
        admissions += 1;
        return { release() {} };
      },
    };
    const provider: MusicProvider = {
      async generate() {
        providerCalls += 1;
        return { bytes: new Uint8Array([1]), contentType: "audio/mpeg" };
      },
    };
    const generate = createMusicGenerator({
      provider,
      audio: memoryAudioStore(),
      limiter,
    });

    await generate("same cached thought", "203.0.113.1");
    await generate(" same  cached thought ", "203.0.113.1");

    expect(admissions).toBe(1);
    expect(providerCalls).toBe(1);
  });

  test("does not call the provider when admission is rejected", async () => {
    let providerCalls = 0;
    const limiter: GenerationLimiter = {
      async acquire() {
        throw new AppFailure(
          "generation_daily_limit_reached",
          "daily limit",
        );
      },
    };
    const provider: MusicProvider = {
      async generate() {
        providerCalls += 1;
        return { bytes: new Uint8Array([1]), contentType: "audio/mpeg" };
      },
    };
    const generate = createMusicGenerator({
      provider,
      audio: memoryAudioStore(),
      limiter,
    });

    await expect(generate("new thought", "203.0.113.1")).rejects.toMatchObject({
      code: "generation_daily_limit_reached",
    });
    expect(providerCalls).toBe(0);
  });

  test("releases generation capacity after a provider failure", async () => {
    let releases = 0;
    const limiter: GenerationLimiter = {
      async acquire() {
        return {
          release() {
            releases += 1;
          },
        };
      },
    };
    const provider: MusicProvider = {
      async generate() {
        throw new Error("provider failed");
      },
    };
    const generate = createMusicGenerator({
      provider,
      audio: memoryAudioStore(),
      limiter,
    });

    await expect(generate("new thought", "203.0.113.1")).rejects.toThrow(
      "provider failed",
    );
    expect(releases).toBe(1);
  });
});
