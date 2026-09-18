import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

describe("ExploreSoundsLink", () => {
  test("pairs the gallery link with three small static orbs and an arrow", async () => {
    const componentPath =
      "../src/components/how-it-sounds/ExploreSoundsLink";
    const module = await import(componentPath).catch(() => null);

    expect(module).not.toBeNull();
    if (!module) return;

    const ExploreSoundsLink = module.default;
    const markup = renderToStaticMarkup(<ExploreSoundsLink />);

    expect(markup).toContain('href="/how-it-sounds/gallery"');
    expect(markup).toContain("explore sounds");
    expect(markup).not.toContain("sound-orb--static");
    expect(markup.match(/animate-none/g)).toHaveLength(6);
    expect(markup).toContain("lucide-arrow-right");
  });
});
