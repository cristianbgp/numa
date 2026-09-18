import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

async function renderSoundCard() {
  const componentPath = "../src/components/how-it-sounds/SoundGallery";
  const module = (await import(componentPath)) as Record<string, unknown>;
  const SoundCard = module.SoundCard;

  expect(typeof SoundCard).toBe("function");
  if (typeof SoundCard !== "function") return "";

  const id = "a".repeat(64);
  return renderToStaticMarkup(
    <SoundCard
      result={{
        id,
        thought: "Rain against the window",
        audioUrl: `http://localhost:3000/v1/audio/${id}`,
        createdAt: "2026-09-17T12:00:00.000Z",
      }}
      active={false}
      playing={false}
      playbackError=""
      onToggle={() => undefined}
    />,
  );
}

describe("Sound gallery cards", () => {
  test("uses the orb as the sound playback control", async () => {
    const markup = await renderSoundCard();

    expect(markup).toMatch(
      /<button[^>]*aria-label="Play sound: Rain against the window"/,
    );
  });

  test("keeps one dedicated link to the public sound", async () => {
    const markup = await renderSoundCard();
    const id = "a".repeat(64);
    const detailLinks = markup.match(
      new RegExp(`href="/how-it-sounds/${id}"`, "g"),
    );

    expect(detailLinks).toHaveLength(1);
    expect(markup).toContain("open sound");
  });
});
