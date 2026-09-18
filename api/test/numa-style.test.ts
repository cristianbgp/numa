import { describe, expect, test } from "bun:test";
import {
  buildNumaPrompt,
  createAudioId,
  normalizeThought,
} from "../src/music/numa-style";

describe("Numa music identity", () => {
  test("normalizes only whitespace for cache identity", () => {
    expect(normalizeThought("  Quiet\n\nroom   after rain  ")).toBe(
      "Quiet room after rain",
    );
  });

  test("makes the thought's emotional world the primary creative brief", () => {
    const prompt = buildNumaPrompt("Quiet room—after rain!");

    expect(prompt).toContain("“Quiet room—after rain!”");
    expect(prompt).toContain(
      "Let the thought determine the emotional center, intensity, tension, tempo, rhythm, harmony, dynamics, density, register, and use of silence.",
    );
    expect(prompt).toContain(
      "Interpret its emotional meaning rather than illustrating literal words or objects.",
    );
  });

  test("keeps bright emotions sincere instead of playful or cartoonish", () => {
    const prompt = buildNumaPrompt("Quiet room—after rain!");

    expect(prompt).toContain(
      "Treat the emotion with sincerity, maturity, and psychological nuance.",
    );
    expect(prompt).toContain(
      "A bright or joyful thought may feel open, luminous, or alive, but never cute, goofy, chirpy, whimsical, or cartoonish.",
    );
  });

  test("frames the result as a coherent underscore instead of a jingle", () => {
    const prompt = buildNumaPrompt("Quiet room—after rain!");

    expect(prompt).toContain(
      "Compose it as a concise contemporary underscore—not a song, jingle, advertisement, trailer cue, or novelty track.",
    );
    expect(prompt).toContain(
      "Choose one coherent sonic world and only the instruments needed to express this specific thought.",
    );
    expect(prompt).toContain(
      "Acoustic, electronic, or hybrid production are all possible, but the timbres should feel grounded, intentional, and emotionally credible.",
    );
  });

  test("rejects catchy melodies, bouncy grooves, and novelty timbres", () => {
    const prompt = buildNumaPrompt("Quiet room—after rain!");

    expect(prompt).toContain(
      "If a melody appears, keep it fragmentary and emotionally suggestive rather than catchy, sing-song, or hook-driven.",
    );
    expect(prompt).toContain(
      "Avoid bouncy or jaunty grooves, nursery-rhyme contours, comic pizzicato, chirpy mallets, toy-like sounds, novelty percussion, ukulele-style cheerfulness, handclap-driven pop, stock-advertising gestures, exaggerated cinematic swells, and generic feel-good resolutions.",
    );
  });

  test("keeps the Numa frame concise, instrumental, and deliberate", () => {
    const prompt = buildNumaPrompt("Quiet room—after rain!");

    expect(prompt).toContain(
      "Give the miniature one clear emotional movement or turn and a deliberate ending.",
    );
    expect(prompt).toContain(
      "Numa is the frame: intimate, intentional, uncluttered, human-scaled, and emotionally honest.",
    );
    expect(prompt).toContain("Instrumental only. No speech or singing.");
    expect(prompt).toContain("No abrupt cutoff.");
  });

  test("creates one lowercase SHA-256 ID for equivalent whitespace", async () => {
    const first = await createAudioId(normalizeThought("soft  morning"));
    const second = await createAudioId(normalizeThought(" soft\nmorning "));
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  test("meaningful text differences change the ID", async () => {
    const first = await createAudioId(normalizeThought("soft morning"));
    const second = await createAudioId(normalizeThought("soft evening"));
    expect(first).not.toBe(second);
  });

  test("preserves the version-one cache identity", async () => {
    expect(await createAudioId("soft morning")).toBe(
      "ef486e26bdb7ac67b8b5e1b9a006713446f861d6b8a58821e59b792bf313f277",
    );
  });
});
