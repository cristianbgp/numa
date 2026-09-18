import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

describe("SoundOrb", () => {
  test("renders deterministic artwork as a reusable decorative component", async () => {
    const componentPath = "../src/components/how-it-sounds/SoundOrb";
    const module = await import(componentPath).catch(() => null);

    expect(module).not.toBeNull();
    if (!module) return;

    const SoundOrb = module.default;
    const markup = renderToStaticMarkup(
      <SoundOrb id={"a".repeat(64)} className="size-64" />,
    );

    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("sound-orb");
    expect(markup).toContain("size-64");
    expect(markup).toContain("--orb-drift-x:22%");
    expect(markup.match(/<span/g)).toHaveLength(2);
  });
});
