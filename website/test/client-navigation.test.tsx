import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import ToolsComponent from "../src/components/Tools";
import HowItSoundsExperience from "../src/components/how-it-sounds/HowItSoundsExperience";

describe("client navigation", () => {
  test("exposes How It Sounds as a real internal link", () => {
    const markup = renderToStaticMarkup(
      <ToolsComponent tab="artwork-generator" />,
    );

    expect(markup).toContain('href="/how-it-sounds"');
  });

  test("links the sound generator to the public gallery", () => {
    const markup = renderToStaticMarkup(
      <HowItSoundsExperience apiBaseUrl="http://localhost:3000" />,
    );

    expect(markup).toContain('href="/how-it-sounds/gallery"');
    expect(markup).toContain("explore sounds");
  });
});
