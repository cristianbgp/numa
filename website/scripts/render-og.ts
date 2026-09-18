import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

const websiteRoot = join(import.meta.dir, "..");
const outputPath = join(websiteRoot, "public", "og", "numa.png");
const previewUrl = "http://127.0.0.1:4325/og-preview";

async function waitForPreview() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(previewUrl);
      if (response.ok) return;
    } catch {
      // Astro is still starting.
    }
    await Bun.sleep(250);
  }
  throw new Error(`OG preview did not start at ${previewUrl}`);
}

const server = Bun.spawn(
  ["bun", "run", "dev", "--", "--host", "127.0.0.1", "--port", "4325"],
  {
    cwd: websiteRoot,
    stdout: "ignore",
    stderr: "inherit",
  },
);

try {
  await waitForPreview();
  await mkdir(join(websiteRoot, "public", "og"), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 630 },
      deviceScaleFactor: 2,
    });
    await page.goto(previewUrl, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const fontFamily = await page
      .locator("[data-og-card]")
      .evaluate((element) => getComputedStyle(element).fontFamily);
    if (!fontFamily.includes("ui-monospace")) {
      throw new Error(`Unexpected OG font stack: ${fontFamily}`);
    }
    await page.locator("astro-dev-toolbar").evaluateAll((toolbars) => {
      for (const toolbar of toolbars) toolbar.remove();
    });
    await page.locator("[data-og-card]").screenshot({ path: outputPath });
  } finally {
    await browser.close();
  }

  console.log(`Rendered ${outputPath}`);
} finally {
  server.kill();
  await server.exited;
}
