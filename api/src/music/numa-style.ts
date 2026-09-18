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

Let the thought determine the emotional center, intensity, tension, tempo, rhythm, harmony, dynamics, density, register, and use of silence. Interpret its emotional meaning rather than illustrating literal words or objects.

Treat the emotion with sincerity, maturity, and psychological nuance. A bright or joyful thought may feel open, luminous, or alive, but never cute, goofy, chirpy, whimsical, or cartoonish.

Compose it as a concise contemporary underscore—not a song, jingle, advertisement, trailer cue, or novelty track. Choose one coherent sonic world and only the instruments needed to express this specific thought. Acoustic, electronic, or hybrid production are all possible, but the timbres should feel grounded, intentional, and emotionally credible.

Favor nuanced harmony, natural phrasing, subtle rhythmic motion, textural detail, and meaningful restraint. If a melody appears, keep it fragmentary and emotionally suggestive rather than catchy, sing-song, or hook-driven.

Avoid bouncy or jaunty grooves, nursery-rhyme contours, comic pizzicato, chirpy mallets, toy-like sounds, novelty percussion, ukulele-style cheerfulness, handclap-driven pop, stock-advertising gestures, exaggerated cinematic swells, and generic feel-good resolutions.

Give the miniature one clear emotional movement or turn and a deliberate ending.

Numa is the frame: intimate, intentional, uncluttered, human-scaled, and emotionally honest.

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
