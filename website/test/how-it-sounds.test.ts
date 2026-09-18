import { describe, expect, test } from "bun:test";
import {
  appendUniqueResults,
  apiUrl,
  createHowItSoundsApi,
  computeWaveformBins,
  downloadFilename,
  formatSoundDate,
  HowItSoundsApiError,
  resultIdFromPath,
  resultPath,
  shouldSubmitThoughtOnEnter,
  soundArtwork,
} from "../src/lib/how-it-sounds";

describe("How It Sounds frontend helpers", () => {
  test("submits on Enter while preserving newlines and IME composition", () => {
    expect(
      shouldSubmitThoughtOnEnter({
        key: "Enter",
        shiftKey: false,
        isComposing: false,
      }),
    ).toBe(true);
    expect(
      shouldSubmitThoughtOnEnter({
        key: "Enter",
        shiftKey: true,
        isComposing: false,
      }),
    ).toBe(false);
    expect(
      shouldSubmitThoughtOnEnter({
        key: "Enter",
        shiftKey: false,
        isComposing: true,
      }),
    ).toBe(false);
    expect(
      shouldSubmitThoughtOnEnter({
        key: "a",
        shiftKey: false,
        isComposing: false,
      }),
    ).toBe(false);
  });

  test("builds stable API and public result URLs", () => {
    const id = "a".repeat(64);

    expect(apiUrl("http://localhost:3000/", `/v1/how-it-sounds/${id}`)).toBe(
      `http://localhost:3000/v1/how-it-sounds/${id}`,
    );
    expect(resultPath(id)).toBe(`/how-it-sounds/${id}`);
    expect(downloadFilename(id)).toBe("numa-audio-aaaaaaaaaaaa.mp3");
    expect(resultIdFromPath(`/how-it-sounds/${id}`)).toBe(id);
    expect(resultIdFromPath("/how-it-sounds")).toBeNull();
    expect(resultIdFromPath("/how-it-sounds/not-an-id")).toBeNull();
  });

  test("derives normalized waveform bins from real samples", () => {
    const samples = new Float32Array([-1, -0.5, 0, 0.5, 1, 0.25]);

    expect(computeWaveformBins(samples, 3)).toEqual([1, 0.5, 1]);
  });

  test("returns silent bins for an empty channel", () => {
    expect(computeWaveformBins(new Float32Array(), 4)).toEqual([0, 0, 0, 0]);
  });

  test("generates and reads public results", async () => {
    const id = "b".repeat(64);
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher: typeof fetch = Object.assign(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(input), init });
        return Response.json({
          id,
          thought: "Rain against the window",
          audioUrl: `http://localhost:3000/v1/audio/${id}`,
          createdAt: "2026-09-16T12:00:00.000Z",
          ...(init?.method === "POST" ? { cached: false } : {}),
        });
      },
      { preconnect: fetch.preconnect },
    );
    const api = createHowItSoundsApi("http://localhost:3000/", fetcher);

    const generated = await api.generate("Rain against the window");
    const result = await api.getResult(id);

    expect(generated.cached).toBe(false);
    expect(result.id).toBe(id);
    expect(calls[0]?.url).toBe("http://localhost:3000/v1/how-it-sounds");
    expect(calls[0]?.init?.body).toBe(
      JSON.stringify({ thought: "Rain against the window" }),
    );
    expect(calls[1]?.url).toBe(`http://localhost:3000/v1/how-it-sounds/${id}`);
  });

  test("preserves useful API errors", async () => {
    const fetcher: typeof fetch = Object.assign(
      async () =>
        Response.json(
          {
            error: {
              code: "provider_rate_limited",
              message: "Try again later.",
            },
          },
          { status: 429 },
        ),
      { preconnect: fetch.preconnect },
    );
    const api = createHowItSoundsApi("http://localhost:3000", fetcher);

    try {
      await api.generate("A busy afternoon");
      throw new Error("Expected request to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(HowItSoundsApiError);
      expect((error as HowItSoundsApiError).code).toBe("provider_rate_limited");
      expect((error as Error).message).toBe("Try again later.");
    }
  });

  test("requests public sound pages with encoded cursors", async () => {
    const id = "c".repeat(64);
    const calls: string[] = [];
    const fetcher: typeof fetch = Object.assign(
      async (input: RequestInfo | URL) => {
        calls.push(String(input));
        return Response.json({
          items: [
            {
              id,
              thought: "A quiet train home",
              audioUrl: `http://localhost:3000/v1/audio/${id}`,
              createdAt: "2026-09-17T12:00:00.000Z",
            },
          ],
          nextCursor: "next+/=page",
        });
      },
      { preconnect: fetch.preconnect },
    );
    const api = createHowItSoundsApi("http://localhost:3000/", fetcher);

    const first = await api.listResults({ limit: 12 });
    const second = await api.listResults({
      limit: 12,
      cursor: "next+/=page",
    });

    expect(first.items[0]?.id).toBe(id);
    expect(first.nextCursor).toBe("next+/=page");
    expect(second.items[0]?.thought).toBe("A quiet train home");
    expect(calls).toEqual([
      "http://localhost:3000/v1/how-it-sounds?limit=12",
      "http://localhost:3000/v1/how-it-sounds?limit=12&cursor=next%2B%2F%3Dpage",
    ]);
  });

  test("derives stable muted artwork from a sound ID", () => {
    const artwork = soundArtwork("a".repeat(64));

    expect(artwork).toEqual({
      hue: 240,
      accentHue: 290,
      angle: 155,
      focusX: 42,
      focusY: 42,
      driftX: 22,
      driftY: -22,
      primaryDuration: 8,
      secondaryDuration: 11,
      phaseDelay: 0,
    });
    expect(soundArtwork("a".repeat(64))).toEqual(artwork);
    expect(soundArtwork("b".repeat(64))).not.toEqual(artwork);
  });

  test("gives orb artwork enough movement to remain visibly alive", () => {
    const artwork = soundArtwork("a".repeat(64));

    expect(Math.abs(artwork.driftX)).toBeGreaterThanOrEqual(14);
    expect(Math.abs(artwork.driftY)).toBeGreaterThanOrEqual(14);
    expect(artwork.primaryDuration).toBeLessThanOrEqual(12);
    expect(artwork.secondaryDuration).toBeLessThanOrEqual(12);
  });

  test("formats gallery dates consistently and rejects invalid dates", () => {
    expect(formatSoundDate("2026-09-17T12:00:00.000Z")).toBe("Sep 17, 2026");
    expect(formatSoundDate("not-a-date")).toBe("");
  });

  test("appends unseen public results without changing existing order", () => {
    const first = {
      id: "a".repeat(64),
      thought: "first",
      audioUrl: "http://localhost:3000/v1/audio/first",
      createdAt: "2026-09-17T12:00:00.000Z",
    };
    const second = {
      id: "b".repeat(64),
      thought: "second",
      audioUrl: "http://localhost:3000/v1/audio/second",
      createdAt: "2026-09-16T12:00:00.000Z",
    };

    expect(appendUniqueResults([first], [first, second])).toEqual([
      first,
      second,
    ]);
  });
});
