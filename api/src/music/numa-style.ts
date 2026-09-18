export const NUMA_PROMPT_VERSION = "numa-music-v1";

export const GENERATION_SETTINGS = Object.freeze({
  modelId: "music_v2_5",
  musicLengthMs: 12_000,
  forceInstrumental: true,
  outputFormat: "auto",
});

export function normalizeThought(thought: string): string {
  return thought.trim().replace(/\s+/gu, " ");
}

export function buildNumaPrompt(thought: string): string {
  const trimmedThought = thought.trim();
  return `Create a distinct 12-second instrumental miniature that translates the emotional world inside this thought:
“${trimmedThought}”

Interpret the emotional meaning, tension, memory, or atmosphere behind the thought. Do not merely illustrate its literal words.

For this specific thought, commit to a clear musical brief: an emotional center, a genre or musical language, a deliberate tempo or absence of pulse, a small instrumental palette, and a distinct production character or acoustic space. Let the thought determine every choice. Do not fall back automatically to ambient pads, soft piano, or a generic lo-fi beat.

Use only the sounds needed to express this moment. The production may be acoustic, electronic, or hybrid, but it should feel intimate, intentional, uncluttered, and emotionally credible.

Give the miniature a compact arrangement: establish its world immediately, introduce one meaningful emotional movement or change, and leave enough time for a deliberate ending or natural decay.

Melody, rhythm, harmony, texture, silence, and dynamics should serve the thought. Avoid cute, comic, novelty, advertising, trailer, or nursery-rhyme language. Bright emotions may feel open and alive, but should remain sincere and mature.

Instrumental only. No speech or singing.
No abrupt cutoff.`;
}

export async function createAudioId(normalizedThought: string): Promise<string> {
  const identity = JSON.stringify({
    thought: normalizedThought,
    promptVersion: NUMA_PROMPT_VERSION,
    modelId: GENERATION_SETTINGS.modelId,
    musicLengthMs: GENERATION_SETTINGS.musicLengthMs,
    forceInstrumental: GENERATION_SETTINGS.forceInstrumental,
    outputFormat: GENERATION_SETTINGS.outputFormat,
  });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(identity),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
