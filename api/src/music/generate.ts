import type { AudioStore, MusicProvider } from "../domain";
import type { GenerationLimiter } from "../rate-limit";
import {
  buildNumaPrompt,
  createAudioId,
  normalizeThought,
} from "./numa-style";

export type GenerationResult = { id: string; cached: boolean };

export function createMusicGenerator({
  provider,
  audio,
  limiter,
}: {
  provider: MusicProvider;
  audio: AudioStore;
  limiter?: GenerationLimiter;
}) {
  const inFlight = new Map<string, Promise<void>>();
  const admission =
    limiter ??
    ({
      async acquire() {
        return { release() {} };
      },
    } satisfies GenerationLimiter);

  return async function generate(
    thought: string,
    clientAddress = "unknown",
  ): Promise<GenerationResult> {
    const normalizedThought = normalizeThought(thought);
    const id = await createAudioId(normalizedThought);

    if (await audio.has(id)) return { id, cached: true };

    const existing = inFlight.get(id);
    if (existing) {
      await existing;
      return { id, cached: true };
    }

    const work = (async () => {
      const permit = await admission.acquire(clientAddress);
      try {
        const generatedAudio = await provider.generate(buildNumaPrompt(thought));
        await audio.write(id, generatedAudio);
      } finally {
        permit.release();
      }
    })();
    inFlight.set(id, work);

    try {
      await work;
      return { id, cached: false };
    } finally {
      inFlight.delete(id);
    }
  };
}
