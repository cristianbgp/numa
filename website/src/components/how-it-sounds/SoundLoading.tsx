import { useEffect, useState } from "react";
import SoundOrb from "./SoundOrb";

const LOADING_ORB_ID = "7c".repeat(32);

export function loadingMessageAt(elapsedSeconds: number): string {
  if (elapsedSeconds >= 30) return "finding its rhythm…";
  if (elapsedSeconds >= 12) return "shaping its texture…";
  return "listening to your thought…";
}

function formatElapsedTime(elapsedSeconds: number): string {
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = String(elapsedSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function SoundLoading({ thought }: { thought: string }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="sound-loading mt-12 text-center sm:mt-16">
      <SoundOrb
        id={LOADING_ORB_ID}
        className="sound-loading__orb mx-auto aspect-square w-32 sm:w-40"
      />
      <p
        className="mt-8 text-lg font-light"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {loadingMessageAt(elapsedSeconds)}
      </p>
      <p className="mt-2 text-xs tabular-nums text-neutral-400" aria-hidden="true">
        {formatElapsedTime(elapsedSeconds)} elapsed
      </p>
      <blockquote className="mx-auto mt-7 max-w-lg text-sm font-light leading-7 text-neutral-500">
        “{thought}”
      </blockquote>
    </div>
  );
}
