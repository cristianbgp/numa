import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

describe("Sound gallery cards", () => {
  test("opens the public sound when its orb is clicked", async () => {
    const componentPath = "../src/components/how-it-sounds/SoundGallery";
    const module = (await import(componentPath)) as Record<string, unknown>;
    const SoundCard = module.SoundCard;

    expect(typeof SoundCard).toBe("function");
    if (typeof SoundCard !== "function") return;

    const id = "a".repeat(64);
    const markup = renderToStaticMarkup(
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

    expect(markup).toContain(`href="/how-it-sounds/${id}"`);
    expect(markup).toContain('aria-label="Open sound: Rain against the window"');
  });
});
