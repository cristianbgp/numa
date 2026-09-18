export function apiUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export function resultPath(id: string): string {
  return `/how-it-sounds/${id}`;
}

export function resultIdFromPath(pathname: string): string | null {
  return pathname.match(/^\/how-it-sounds\/([a-f0-9]{64})\/?$/)?.[1] ?? null;
}

export function downloadFilename(id: string): string {
  return `numa-audio-${id.slice(0, 12)}.mp3`;
}

export type ThoughtKeyInput = {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
};

export function shouldSubmitThoughtOnEnter({
  key,
  shiftKey,
  isComposing,
}: ThoughtKeyInput): boolean {
  return key === "Enter" && !shiftKey && !isComposing;
}

export function computeWaveformBins(
  samples: Float32Array,
  count: number,
): number[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError("Waveform bin count must be a positive integer");
  }

  if (samples.length === 0) return Array<number>(count).fill(0);

  const bins = Array.from({ length: count }, (_, index) => {
    const start = Math.floor((index * samples.length) / count);
    const end = Math.min(
      samples.length,
      Math.max(start + 1, Math.floor(((index + 1) * samples.length) / count)),
    );
    let peak = 0;

    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      peak = Math.max(peak, Math.abs(samples[sampleIndex] ?? 0));
    }

    return peak;
  });

  const maximum = Math.max(...bins);
  return maximum === 0 ? bins : bins.map((bin) => bin / maximum);
}

export type WaveformLayout = {
  bins: number[];
  barWidth: number;
  gap: number;
};

export function createWaveformLayout(
  bins: number[],
  width: number,
  gap = 2,
  minimumBarWidth = 1,
): WaveformLayout {
  if (bins.length === 0 || width <= 0) {
    return { bins: [], barWidth: 0, gap };
  }

  const capacity = Math.max(
    1,
    Math.floor((width + gap) / (minimumBarWidth + gap)),
  );
  const count = Math.min(bins.length, capacity);
  const fittedBins = Array.from({ length: count }, (_, index) => {
    const start = Math.floor((index * bins.length) / count);
    const end = Math.max(
      start + 1,
      Math.floor(((index + 1) * bins.length) / count),
    );

    return Math.max(...bins.slice(start, end));
  });

  return {
    bins: fittedBins,
    barWidth: (width - gap * (count - 1)) / count,
    gap,
  };
}

export type PublicSoundResult = {
  id: string;
  thought: string;
  audioUrl: string;
  createdAt: string;
};

export type GeneratedSoundResult = PublicSoundResult & { cached: boolean };

export type PublicSoundPage = {
  items: PublicSoundResult[];
  nextCursor: string | null;
};

export type SoundArtwork = {
  hue: number;
  accentHue: number;
  angle: number;
  focusX: number;
  focusY: number;
  driftX: number;
  driftY: number;
  primaryDuration: number;
  secondaryDuration: number;
  phaseDelay: number;
};

function idByte(id: string, offset: number): number {
  const value = Number.parseInt(id.slice(offset, offset + 2), 16);
  return Number.isFinite(value) ? value : 0;
}

export function soundArtwork(id: string): SoundArtwork {
  const hueByte = idByte(id, 0);
  return {
    hue: Math.round((hueByte / 255) * 360),
    accentHue: (Math.round((hueByte / 255) * 360) + 20 + (idByte(id, 2) % 35)) % 360,
    angle: 115 + (idByte(id, 4) % 130),
    focusX: 25 + (idByte(id, 6) % 51),
    focusY: 25 + (idByte(id, 8) % 51),
    driftX:
      (idByte(id, 14) % 2 === 0 ? 1 : -1) *
      (14 + (idByte(id, 16) % 9)),
    driftY:
      (idByte(id, 18) % 2 === 0 ? -1 : 1) *
      (14 + (idByte(id, 20) % 9)),
    primaryDuration: 8 + (idByte(id, 10) % 5),
    secondaryDuration: 9 + (idByte(id, 12) % 4),
    phaseDelay:
      idByte(id, 22) % 17 === 0 ? 0 : -(idByte(id, 22) % 17),
  };
}

const SOUND_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function formatSoundDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? SOUND_DATE_FORMATTER.format(date) : "";
}

export function appendUniqueResults(
  current: PublicSoundResult[],
  incoming: PublicSoundResult[],
): PublicSoundResult[] {
  const seen = new Set(current.map(({ id }) => id));
  return [
    ...current,
    ...incoming.filter(({ id }) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    }),
  ];
}

export class HowItSoundsApiError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "HowItSoundsApiError";
  }
}

type ErrorPayload = { error?: { code?: string; message?: string } };

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & ErrorPayload;
  if (!response.ok) {
    throw new HowItSoundsApiError(
      payload.error?.code ?? "request_failed",
      payload.error?.message ?? "Something went quiet. Please try again.",
    );
  }
  return payload;
}

export function createHowItSoundsApi(baseUrl: string, fetcher = fetch) {
  return {
    async generate(thought: string): Promise<GeneratedSoundResult> {
      const response = await fetcher(apiUrl(baseUrl, "/v1/how-it-sounds"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thought }),
      });
      return readJson<GeneratedSoundResult>(response);
    },
    async getResult(id: string): Promise<PublicSoundResult> {
      const response = await fetcher(
        apiUrl(baseUrl, `/v1/how-it-sounds/${encodeURIComponent(id)}`),
      );
      return readJson<PublicSoundResult>(response);
    },
    async listResults(
      options: { limit?: number; cursor?: string } = {},
    ): Promise<PublicSoundPage> {
      const query = new URLSearchParams();
      query.set("limit", String(options.limit ?? 12));
      if (options.cursor) query.set("cursor", options.cursor);
      const response = await fetcher(
        apiUrl(baseUrl, `/v1/how-it-sounds?${query.toString()}`),
      );
      return readJson<PublicSoundPage>(response);
    },
  };
}
