import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chromium, type Browser } from "playwright";

const PORT = 4329;
const BASE_URL = `http://127.0.0.1:${PORT}`;

let browser: Browser;
let server: ReturnType<typeof Bun.spawn>;

async function waitForServer() {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/tools`);
      if (response.ok) return;
    } catch {
      await Bun.sleep(100);
    }
  }

  throw new Error("Astro dev server did not become ready");
}

describe("browser behavior", () => {
  beforeAll(async () => {
    server = Bun.spawn(
      [
        "bun",
        "run",
        "dev",
        "--host",
        "127.0.0.1",
        "--port",
        String(PORT),
      ],
      {
        cwd: `${import.meta.dir}/..`,
        stdout: "ignore",
        stderr: "ignore",
      },
    );
    await waitForServer();
    browser = await chromium.launch({ headless: true });
  }, 30_000);

  afterAll(async () => {
    await browser?.close();
    server?.kill();
    await server?.exited;
  }, 30_000);

  test("tools stays within a 320px viewport", async () => {
    const page = await browser.newPage({ viewport: { width: 320, height: 720 } });
    await page.goto(`${BASE_URL}/tools`, { waitUntil: "networkidle" });

    const widths = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      tabs: (() => {
        const tabs = document.querySelector<HTMLElement>(
          '[data-slot="tabs-list"]',
        );
        return tabs
          ? { client: tabs.clientWidth, content: tabs.scrollWidth }
          : null;
      })(),
    }));

    expect(widths.document).toBeLessThanOrEqual(widths.viewport);
    expect(widths.tabs?.content).toBeLessThanOrEqual(widths.tabs?.client ?? 0);
    await page.close();
  });

  test("home leads with the interactive sound experience", async () => {
    const page = await browser.newPage();
    await page.goto(BASE_URL, { waitUntil: "networkidle" });

    const callsToAction = page.locator("main a");
    expect(
      await callsToAction.evaluateAll((links) =>
        links.map((link) => link.textContent?.trim()),
      ),
    ).toEqual([
      "turn a thought into sound →",
      "explore all mixes →",
      "watch on YouTube →",
    ]);
    expect(await callsToAction.first().getAttribute("href")).toBe(
      "/how-it-sounds",
    );

    await page.close();
  });

  test("about exposes the repository without replacing the current page", async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE_URL}/about`, { waitUntil: "networkidle" });

    const sourceLink = page.getByRole("link", { name: "view the source ↗" });
    expect(await sourceLink.count()).toBe(1);
    expect(await sourceLink.getAttribute("href")).toBe(
      "https://github.com/cristianbgp/numa",
    );
    expect(await sourceLink.getAttribute("target")).toBe("_blank");
    expect((await sourceLink.getAttribute("rel"))?.split(" ").sort()).toEqual([
      "noopener",
      "noreferrer",
    ]);

    await page.close();
  });

  test("generation errors shake unless reduced motion is requested", async () => {
    async function errorAnimation(reducedMotion: "no-preference" | "reduce") {
      const page = await browser.newPage();
      await page.emulateMedia({ reducedMotion });
      await page.route("http://localhost:3000/**", async (route) => {
        const headers = {
          "access-control-allow-headers": "content-type",
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-origin": "*",
        };

        if (route.request().method() === "OPTIONS") {
          await route.fulfill({ status: 204, headers });
          return;
        }

        await route.fulfill({
          status: 500,
          headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify({
            error: {
              code: "generation_failed",
              message: "Something went quiet. Please try again.",
            },
          }),
        });
      });
      await page.goto(`${BASE_URL}/how-it-sounds`, {
        waitUntil: "networkidle",
      });
      await page
        .getByLabel("what is on your mind?")
        .fill("Rain against the window");
      await page.getByRole("button", { name: "hear it →" }).click();

      const animationName = await page
        .getByRole("alert")
        .evaluate((element) => getComputedStyle(element).animationName);
      await page.close();
      return animationName;
    }

    expect(await errorAnimation("no-preference")).toBe(
      "generation-error-shake",
    );
    expect(await errorAnimation("reduce")).toBe("generation-error-fade");
  });

  test("explore sounds keeps its content stable while only the arrow moves", async () => {
    async function hoverResult(reducedMotion: "no-preference" | "reduce") {
      const page = await browser.newPage();
      await page.emulateMedia({ reducedMotion });
      await page.goto(`${BASE_URL}/how-it-sounds`, {
        waitUntil: "networkidle",
      });

      const link = page.getByRole("link", { name: "explore sounds" });
      const arrow = link.locator("svg");
      await link.scrollIntoViewIfNeeded();
      const before = await arrow.boundingBox();
      await link.hover();
      await page.waitForTimeout(200);
      const after = await arrow.boundingBox();
      const opacity = await link.evaluate(
        (element) => getComputedStyle(element).opacity,
      );
      await page.close();

      if (!before || !after) throw new Error("Explore arrow was not visible");
      return { opacity, arrowShift: after.x - before.x };
    }

    const standard = await hoverResult("no-preference");
    const reduced = await hoverResult("reduce");

    expect(standard.opacity).toBe("1");
    expect(standard.arrowShift).toBeGreaterThan(1.8);
    expect(standard.arrowShift).toBeLessThan(2.2);
    expect(reduced.opacity).toBe("1");
    expect(Math.abs(reduced.arrowShift)).toBeLessThan(0.1);
  });

  test("thought character count follows the textarea value", async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE_URL}/how-it-sounds`, {
      waitUntil: "networkidle",
    });

    const thought = page.getByLabel("what is on your mind?");
    const counter = page.getByText("0 / 240", { exact: true });

    expect(await counter.count()).toBe(1);
    await thought.fill("quiet afternoon");
    expect(
      await page.getByText("15 / 240", { exact: true }).count(),
    ).toBe(1);

    await page.close();
  });

  test("the public sound uses a visible keyboard-accessible audio scrubber", async () => {
    const page = await browser.newPage({ viewport: { width: 320, height: 720 } });
    const id = "a".repeat(64);

    await page.route(`http://localhost:3000/v1/how-it-sounds/${id}`, async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          "access-control-allow-origin": "*",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          id,
          thought: "Rain settling over the city",
          audioUrl: "https://audio.test/sound.mp3",
          createdAt: "2026-09-18T12:00:00.000Z",
        }),
      });
    });
    await page.route("https://audio.test/**", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "content-type": "audio/mpeg" },
        body: "",
      });
    });

    await page.goto(`${BASE_URL}/how-it-sounds/${id}`, {
      waitUntil: "networkidle",
    });
    await page.getByText("Rain settling over the city").waitFor();
    await page.locator("audio").evaluate((audio) => {
      Object.defineProperty(audio, "duration", {
        configurable: true,
        value: 12,
      });
      audio.dispatchEvent(new Event("loadedmetadata"));
    });

    const scrubber = page.getByRole("slider", { name: "Seek through sound" });
    expect(
      await scrubber.evaluate((element) => getComputedStyle(element).opacity),
    ).toBe("1");

    await scrubber.focus();
    await page.keyboard.press("ArrowRight");
    expect(await scrubber.getAttribute("aria-valuenow")).toBe("1");
    expect(await page.locator("audio").evaluate((audio) => audio.currentTime)).toBe(1);

    const box = await scrubber.boundingBox();
    if (!box) throw new Error("Audio scrubber was not visible");
    expect(box.x + box.width).toBeLessThanOrEqual(320);

    await page.close();
  });
});
