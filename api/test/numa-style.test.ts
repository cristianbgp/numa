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
      "Interpret the emotional meaning, tension, memory, or atmosphere behind the thought.",
    );
    expect(prompt).toContain(
      "Do not merely illustrate its literal words.",
    );
  });

  test("requires a distinct musical brief for each thought", () => {
    const prompt = buildNumaPrompt("Quiet room—after rain!");

    expect(prompt).toContain(
      "commit to a clear musical brief: an emotional center, a genre or musical language, a deliberate tempo or absence of pulse, a small instrumental palette, and a distinct production character or acoustic space.",
    );
    expect(prompt).toContain(
      "Let the thought determine every choice.",
    );
  });

  test("does not default every thought to the same ambient palette", () => {
    const prompt = buildNumaPrompt("Quiet room—after rain!");

    expect(prompt).toContain(
      "Do not fall back automatically to ambient pads, soft piano, or a generic lo-fi beat.",
    );
    expect(prompt).toContain(
      "The production may be acoustic, electronic, or hybrid",
    );
    expect(prompt).toContain(
      "intimate, intentional, uncluttered, and emotionally credible.",
    );
  });

  test("gives the short generation a compact arrangement and ending", () => {
    const prompt = buildNumaPrompt("Quiet room—after rain!");

    expect(prompt).toContain(
      "establish its world immediately, introduce one meaningful emotional movement or change, and leave enough time for a deliberate ending or natural decay.",
    );
  });

  test("keeps the emotional language mature without overprescribing style", () => {
    const prompt = buildNumaPrompt("Quiet room—after rain!");

    expect(prompt).toContain(
      "Melody, rhythm, harmony, texture, silence, and dynamics should serve the thought.",
    );
    expect(prompt).toContain(
      "Avoid cute, comic, novelty, advertising, trailer, or nursery-rhyme language.",
    );
    expect(prompt).toContain(
      "Bright emotions may feel open and alive, but should remain sincere and mature.",
    );
  });

  test("keeps the result instrumental and prevents an abrupt cutoff", () => {
    const prompt = buildNumaPrompt("Quiet room—after rain!");

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
