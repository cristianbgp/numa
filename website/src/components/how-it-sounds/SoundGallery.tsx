import { ArrowUpRight, Pause, Play } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  appendUniqueResults,
  createHowItSoundsApi,
  formatSoundDate,
  type PublicSoundResult,
  resultPath,
} from "@/lib/how-it-sounds";
import SoundOrb from "./SoundOrb";

type Props = {
  apiBaseUrl: string;
};

function friendlyError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "The archive could not be reached. Please try again.";
}

export function SoundCard({
  result,
  active,
  playing,
  playbackError,
  onToggle,
}: {
  result: PublicSoundResult;
  active: boolean;
  playing: boolean;
  playbackError: string;
  onToggle: (result: PublicSoundResult) => void;
}) {
  const date = formatSoundDate(result.createdAt);

  return (
    <article className="group flex min-w-0 flex-col border-t border-neutral-200 pt-5">
      <div className="relative mx-auto w-full max-w-[15rem] p-4 sm:p-5">
        <a
          href={resultPath(result.id)}
          aria-label={`Open sound: ${result.thought}`}
          className="block rounded-full focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <SoundOrb
            id={result.id}
            className="aspect-square w-full transition-transform duration-200 ease-out group-hover:scale-[1.02] group-active:scale-[0.98]"
          />
        </a>
        <button
          type="button"
          onClick={() => onToggle(result)}
          className="absolute bottom-2 left-2 grid size-11 place-items-center rounded-full border border-black/15 bg-white/85 text-neutral-900 shadow-sm backdrop-blur-sm transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 sm:bottom-3 sm:left-3"
          aria-label={active && playing ? "Pause sound" : "Play sound"}
          title={active && playing ? "Pause" : "Play"}
        >
          {active && playing ? (
            <Pause size={14} aria-hidden="true" />
          ) : (
            <Play size={14} className="ml-px" aria-hidden="true" />
          )}
        </button>
      </div>

      <div className="flex flex-1 flex-col pb-8">
        <a
          href={resultPath(result.id)}
          className="group/link flex flex-1 flex-col focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <blockquote className="line-clamp-4 text-base font-light leading-7 tracking-[-0.02em] sm:text-lg">
            “{result.thought}”
          </blockquote>
          <span className="mt-5 inline-flex items-center gap-1 text-[11px] text-neutral-500 transition-colors group-hover/link:text-neutral-900">
            open sound <ArrowUpRight size={11} aria-hidden="true" />
          </span>
        </a>
        {date && <time className="mt-3 text-[10px] text-neutral-400">{date}</time>}
        {active && playbackError && (
          <p className="mt-3 text-[11px] text-neutral-600" role="status">
            {playbackError}
          </p>
        )}
      </div>
    </article>
  );
}

export default function SoundGallery({ apiBaseUrl }: Props) {
  const api = useMemo(() => createHowItSoundsApi(apiBaseUrl), [apiBaseUrl]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [items, setItems] = useState<PublicSoundResult[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState("");

  const loadPage = useCallback(
    async (cursor?: string) => {
      if (cursor) setLoadingMore(true);
      else setInitialLoading(true);
      setError("");
      try {
        const page = await api.listResults({ limit: 12, cursor });
        setItems((current) =>
          cursor ? appendUniqueResults(current, page.items) : page.items,
        );
        setNextCursor(page.nextCursor);
      } catch (loadError) {
        setError(friendlyError(loadError));
      } finally {
        setInitialLoading(false);
        setLoadingMore(false);
      }
    },
    [api],
  );

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  async function togglePlayback(result: PublicSoundResult) {
    const audio = audioRef.current;
    if (!audio) return;
    setPlaybackError("");

    try {
      if (activeId === result.id) {
        if (audio.paused) await audio.play();
        else audio.pause();
        return;
      }

      audio.pause();
      audio.src = result.audioUrl;
      setActiveId(result.id);
      await audio.play();
    } catch (playError) {
      setPlaybackError(friendlyError(playError));
      setPlaying(false);
    }
  }

  const empty = !initialLoading && !error && items.length === 0;

  return (
    <section className="min-h-[calc(100svh-53px)] py-10 sm:py-14">
      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => {
          setPlaying(false);
          setPlaybackError("This sound could not be played.");
        }}
      />

      <header className="flex flex-col gap-8 border-b border-neutral-200 pb-10 sm:flex-row sm:items-end sm:justify-between sm:pb-14">
        <div>
          <h1 className="mt-5 text-3xl font-light tracking-[-0.04em] sm:text-5xl">
            thoughts, heard differently.
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-neutral-500 sm:text-base">
            a growing archive of moments made public through sound.
          </p>
        </div>
        <a
          href="/how-it-sounds"
          className="w-fit shrink-0 border-b border-current pb-1 text-sm transition-opacity hover:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          make a sound →
        </a>
      </header>

      {initialLoading && items.length === 0 && (
        <div className="py-24 text-center" aria-live="polite">
          <p className="text-lg font-light">gathering sounds…</p>
          <p className="mt-3 text-xs text-neutral-500">one quiet moment</p>
        </div>
      )}

      {empty && (
        <div className="py-24 text-center">
          <p className="text-xl font-light">the archive is still quiet.</p>
          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-neutral-500">
            the first public thought has not become a sound yet.
          </p>
          <a
            href="/how-it-sounds"
            className="mt-8 inline-block border-b border-current pb-1 text-sm hover:opacity-55"
          >
            make the first sound →
          </a>
        </div>
      )}

      {error && items.length === 0 && (
        <div className="py-24 text-center" role="alert">
          <p className="text-lg font-light">the archive went quiet.</p>
          <p className="mt-3 text-sm text-neutral-500">{error}</p>
          <button
            type="button"
            onClick={() => void loadPage()}
            className="mt-8 border-b border-current pb-1 text-sm hover:opacity-55"
          >
            try again
          </button>
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-x-8 pt-10 sm:grid-cols-2 sm:pt-14 lg:grid-cols-3">
            {items.map((result) => (
              <SoundCard
                key={result.id}
                result={result}
                active={activeId === result.id}
                playing={activeId === result.id && playing}
                playbackError={playbackError}
                onToggle={(selected) => void togglePlayback(selected)}
              />
            ))}
          </div>

          <div className="flex min-h-28 flex-col items-center justify-center border-t border-neutral-200 pt-8">
            {error && (
              <p className="mb-4 text-xs text-neutral-500" role="status">
                {error}
              </p>
            )}
            {nextCursor && (
              <button
                type="button"
                onClick={() => void loadPage(nextCursor)}
                disabled={loadingMore}
                className="border-b border-current pb-1 text-sm transition-opacity hover:opacity-55 disabled:cursor-wait disabled:opacity-35"
              >
                {loadingMore ? "gathering…" : "load more sounds"}
              </button>
            )}
            {!nextCursor && !error && (
              <p className="text-[11px] text-neutral-400">you have reached the quiet beginning</p>
            )}
            {error && (
              <button
                type="button"
                onClick={() => void loadPage(nextCursor ?? undefined)}
                className="border-b border-current pb-1 text-sm hover:opacity-55"
              >
                try again
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
