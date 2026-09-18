import { describe, expect, test } from "bun:test";
import { createPageMetadata } from "../src/lib/metadata";

describe("page metadata", () => {
  test("builds absolute canonical and social image URLs", () => {
    const metadata = createPageMetadata({
      pathname: "/how-it-sounds",
      title: "how it sounds | numa",
    });

    expect(metadata.canonicalUrl).toBe(
      "https://numa.channel/how-it-sounds",
    );
    expect(metadata.imageUrl).toBe("https://numa.channel/og/numa.png");
    expect(metadata.title).toBe("how it sounds | numa");
    expect(metadata.description).toContain("minimalist sound journals");
  });

  test("accepts page-specific descriptions and image paths", () => {
    const metadata = createPageMetadata({
      pathname: "/mixes?ignored=true",
      title: "mixes | numa",
      description: "listen to every numa mix.",
      image: "/og/mixes.png",
    });

    expect(metadata.canonicalUrl).toBe("https://numa.channel/mixes");
    expect(metadata.imageUrl).toBe("https://numa.channel/og/mixes.png");
    expect(metadata.description).toBe("listen to every numa mix.");
  });
});
