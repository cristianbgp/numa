import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

describe("SoundLoading", () => {
  test("renders an honest accessible loading state", async () => {
    const componentPath = "../src/components/how-it-sounds/SoundLoading";
    const module = await import(componentPath).catch(() => null);

    expect(module).not.toBeNull();
    if (!module) return;

    const SoundLoading = module.default;
    const markup = renderToStaticMarkup(
      <SoundLoading thought="Rain against the window" />,
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain("listening to your thought…");
    expect(markup).toContain("0:00 elapsed");
    expect(markup).not.toContain('role="progressbar"');
  });

  test("changes its message as generation continues", async () => {
    const componentPath = "../src/components/how-it-sounds/SoundLoading";
    const module = (await import(componentPath)) as Record<string, unknown>;
    const loadingMessageAt = module.loadingMessageAt;

    expect(typeof loadingMessageAt).toBe("function");
    if (typeof loadingMessageAt !== "function") return;

    expect(loadingMessageAt(0)).toBe("listening to your thought…");
    expect(loadingMessageAt(12)).toBe("shaping its texture…");
    expect(loadingMessageAt(30)).toBe("finding its rhythm…");
  });
});
