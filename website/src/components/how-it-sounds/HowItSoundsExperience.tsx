import { Download, Pause, Play, Share2 } from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  computeWaveformBins,
  createWaveformLayout,
  createHowItSoundsApi,
  downloadFilename,
  type PublicSoundResult,
  resultIdFromPath,
  resultPath,
  shouldSubmitThoughtOnEnter,
} from "@/lib/how-it-sounds";
import SoundOrb from "./SoundOrb";
import SoundLoading from "./SoundLoading";

type Props = {
  apiBaseUrl: string;
  initialId?: string;
};

type ViewState =
  | { name: "writing" }
  | { name: "generating" }
  | { name: "loading" }
  | { name: "result"; result: PublicSoundResult }
  | { name: "error"; message: string };

const EMPTY_BINS = Array<number>(160).fill(0.08);

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const rounded = Math.max(0, Math.floor(seconds));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

function friendlyError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Something went quiet. Please try again.";
}

function WaveformPlayer({ result }: { result: PublicSoundResult }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [bins, setBins] = useState(EMPTY_BINS);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function decodeWaveform() {
      try {
        const response = await fetch(result.audioUrl, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Audio could not be loaded.");
        const bytes = await response.arrayBuffer();
        const context = new AudioContext();
        const decoded = await context.decodeAudioData(bytes.slice(0));
        setBins(computeWaveformBins(decoded.getChannelData(0), 160));
        await context.close();
      } catch (error) {
        if (!controller.signal.aborted) setAudioError(friendlyError(error));
      }
    }

    void decodeWaveform();
    return () => controller.abort();
  }, [result.audioUrl]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return;

    const width = frame.clientWidth;
    const height = 88;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.clearRect(0, 0, width, height);

    const layout = createWaveformLayout(bins, width);
    const progress = duration > 0 ? currentTime / duration : 0;
    const playedUntil = progress * width;

    layout.bins.forEach((bin, index) => {
      const x = index * (layout.barWidth + layout.gap);
      const barHeight = Math.max(2, bin * 62);
      context.fillStyle = x <= playedUntil ? "#171717" : "#d7d7d4";
      context.fillRect(
        x,
        (height - barHeight) / 2,
        layout.barWidth,
        barHeight,
      );
    });

    if (progress > 0) {
      context.fillStyle = "#171717";
      context.fillRect(Math.min(width - 1, playedUntil), 7, 1, height - 14);
    }
  }, [bins, currentTime, duration]);

  useEffect(() => {
    draw();
    const observer = new ResizeObserver(draw);
    if (frameRef.current) observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, [draw]);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (audio.paused) await audio.play();
      else audio.pause();
    } catch (error) {
      setAudioError(friendlyError(error));
    }
  }

  function seek(value: number) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    audio.currentTime = value;
    setCurrentTime(value);
  }

  return (
    <div className="w-full">
      <audio
        ref={audioRef}
        src={result.audioUrl}
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) =>
          setCurrentTime(event.currentTarget.currentTime)
        }
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setAudioError("Audio could not be played.")}
      />

      <div className="flex items-center gap-5 sm:gap-8">
        <button
          type="button"
          onClick={() => void togglePlayback()}
          className="grid size-11 shrink-0 place-items-center rounded-full border border-neutral-900 transition-colors hover:bg-neutral-900 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4"
          aria-label={playing ? "Pause sound" : "Play sound"}
          title={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause size={15} /> : <Play size={15} className="ml-px" />}
        </button>

        <div className="min-w-0 flex-1">
          <div
            ref={frameRef}
            className="relative focus-within:outline-1 focus-within:outline-offset-4 focus-within:outline-neutral-500"
          >
            <canvas
              ref={canvasRef}
              className="block w-full"
              aria-hidden="true"
            />
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="0.01"
              value={currentTime}
              onChange={(event) => seek(Number(event.currentTarget.value))}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Seek through sound"
              disabled={!duration}
            />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-neutral-500">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {audioError && (
        <p className="mt-3 text-xs text-neutral-600" role="status">
          {audioError}
        </p>
      )}
    </div>
  );
}

function ResultView({
  result,
  onReset,
}: {
  result: PublicSoundResult;
  onReset: () => void;
}) {
  const [actionStatus, setActionStatus] = useState("");

  async function share() {
    const url = `${window.location.origin}${resultPath(result.id)}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "how it sounds | numa",
          text: result.thought,
          url,
        });
        setActionStatus("shared");
      } else {
        await navigator.clipboard.writeText(url);
        setActionStatus("link copied");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setActionStatus("could not share");
    }
  }

  async function download() {
    setActionStatus("preparing download");
    try {
      const response = await fetch(result.audioUrl);
      if (!response.ok) throw new Error();
      const objectUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = downloadFilename(result.id);
      anchor.click();
      URL.revokeObjectURL(objectUrl);
      setActionStatus("download ready");
    } catch {
      setActionStatus("could not download");
    }
  }

  return (
    <section className="flex min-h-[calc(100svh-53px)] flex-col py-10 sm:py-14">
      <div>
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-light tracking-[-0.04em]">
              how it sounds
            </h1>
            <p className="mt-3 text-sm text-neutral-500">
              turn a thought into sound.
            </p>
          </div>
          <a
            href="/how-it-sounds/gallery"
            className="shrink-0 border-b border-current pb-1 text-xs transition-opacity hover:opacity-55"
          >
            explore sounds
          </a>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center py-12 sm:py-16">
        <SoundOrb
          id={result.id}
          className="mx-auto aspect-square w-36 sm:w-52"
        />

        <blockquote className="mx-auto mt-10 max-w-3xl text-center text-2xl font-light leading-relaxed tracking-[-0.03em] sm:mt-12 sm:text-4xl sm:leading-relaxed">
          “{result.thought}”
        </blockquote>

        <div className="mt-12 sm:mt-16">
          <WaveformPlayer result={result} />
        </div>
      </div>

      <div className="flex flex-col gap-5 border-t border-neutral-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs">this is how it sounds.</p>
          <p className="mt-1 text-[11px] text-neutral-500">
            a public sound made from one thought
          </p>
          <p className="sr-only" aria-live="polite">
            {actionStatus}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-xs">
          <button
            type="button"
            onClick={onReset}
            className="border-b border-current pb-px hover:opacity-55"
          >
            try another
          </button>
          <button
            type="button"
            onClick={() => void download()}
            className="inline-flex items-center gap-1.5 border-b border-current pb-px hover:opacity-55"
          >
            <Download size={13} aria-hidden="true" /> download
          </button>
          <button
            type="button"
            onClick={() => void share()}
            className="inline-flex items-center gap-1.5 border-b border-current pb-px hover:opacity-55"
          >
            <Share2 size={13} aria-hidden="true" />{" "}
            {actionStatus === "link copied" ? "copied" : "share"}
          </button>
        </div>
      </div>
    </section>
  );
}

export default function HowItSoundsExperience({
  apiBaseUrl,
  initialId,
}: Props) {
  const api = useMemo(() => createHowItSoundsApi(apiBaseUrl), [apiBaseUrl]);
  const [thought, setThought] = useState("");
  const [view, setView] = useState<ViewState>(
    initialId ? { name: "loading" } : { name: "writing" },
  );

  const loadResult = useCallback(
    async (id: string) => {
      setView({ name: "loading" });
      try {
        setView({ name: "result", result: await api.getResult(id) });
      } catch (error) {
        setView({ name: "error", message: friendlyError(error) });
      }
    },
    [api],
  );

  useEffect(() => {
    if (initialId) void loadResult(initialId);
  }, [initialId, loadResult]);

  useEffect(() => {
    function handlePopState() {
      const id = resultIdFromPath(window.location.pathname);
      if (id) void loadResult(id);
      else setView({ name: "writing" });
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [loadResult]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = thought.trim();
    if (!normalized) return;
    setView({ name: "generating" });
    try {
      const result = await api.generate(normalized);
      window.history.pushState({}, "", resultPath(result.id));
      setView({ name: "result", result });
    } catch (error) {
      setView({ name: "error", message: friendlyError(error) });
    }
  }

  function handleThoughtKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      !shouldSubmitThoughtOnEnter({
        key: event.key,
        shiftKey: event.shiftKey,
        isComposing: event.nativeEvent.isComposing,
      })
    ) {
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  function reset() {
    setThought("");
    window.history.pushState({}, "", "/how-it-sounds");
    setView({ name: "writing" });
  }

  if (view.name === "result") {
    return <ResultView result={view.result} onReset={reset} />;
  }

  return (
    <section className="flex min-h-[calc(100svh-53px)] flex-col py-10 sm:py-14">
      <p className="text-xs tracking-[0.16em] text-neutral-500">
        HOW IT SOUNDS
      </p>

      <div className="flex flex-1 items-center py-16 sm:py-24">
        <div className="mx-auto w-full max-w-3xl">
          <h1 className="text-3xl font-light leading-tight tracking-[-0.04em] sm:text-5xl">
            turn a thought into sound.
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-neutral-500 sm:text-base">
            write a feeling, memory, or moment. numa will shape it into a short
            instrumental sound journal.
          </p>

          {view.name === "generating" ? (
            <SoundLoading thought={thought.trim()} />
          ) : view.name === "loading" ? (
            <div
              className="mt-16 border-y border-neutral-200 py-10"
              aria-live="polite"
            >
              <p className="text-lg font-light">finding its sound…</p>
              <p className="mt-3 text-xs text-neutral-500">one quiet moment</p>
            </div>
          ) : (
            <form onSubmit={(event) => void submit(event)} className="mt-14">
              <label htmlFor="thought" className="text-xs text-neutral-500">
                what is on your mind?
              </label>
              <textarea
                id="thought"
                name="thought"
                value={thought}
                onChange={(event) => setThought(event.currentTarget.value)}
                onKeyDown={handleThoughtKeyDown}
                maxLength={240}
                rows={3}
                autoFocus
                placeholder="the first warm evening after a long winter"
                className="mt-3 block w-full resize-none border-0 border-b border-neutral-300 bg-transparent px-0 py-4 text-xl font-light leading-relaxed placeholder:text-neutral-300 focus:border-neutral-900 focus:outline-none sm:text-2xl"
              />

              {view.name === "error" && (
                <p className="mt-4 text-sm text-neutral-600" role="alert">
                  {view.message}
                </p>
              )}

              <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-md text-[11px] leading-5 text-neutral-500">
                  your thought and its sound will be public. do not include
                  anything private.
                </p>
                <button
                  type="submit"
                  disabled={!thought.trim()}
                  className="w-fit border-b border-current pb-1 text-sm transition-opacity hover:opacity-55 disabled:cursor-not-allowed disabled:opacity-25"
                >
                  hear it →
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-6">
        <p className="text-[11px] text-neutral-400">
          made slowly, one sound at a time
        </p>
        <a
          href="/how-it-sounds/gallery"
          className="shrink-0 border-b border-current pb-1 text-xs transition-opacity hover:opacity-55"
        >
          explore sounds
        </a>
      </div>
    </section>
  );
}
