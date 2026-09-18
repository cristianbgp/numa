import { ArrowRight } from "lucide-react";
import SoundOrb from "./SoundOrb";

const ORB_IDS = ["0f".repeat(32), "7a".repeat(32), "d4".repeat(32)];

export default function ExploreSoundsLink() {
  return (
    <a
      href="/how-it-sounds/gallery"
      className="group inline-flex shrink-0 items-center gap-2 border-b border-current pb-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      <span className="flex -space-x-1" aria-hidden="true">
        {ORB_IDS.map((id) => (
          <SoundOrb
            key={id}
            id={id}
            animated={false}
            className="size-3.5 ring-1 ring-white"
          />
        ))}
      </span>
      <span>explore sounds</span>
      <ArrowRight
        size={12}
        className="explore-sounds-arrow"
        aria-hidden="true"
      />
    </a>
  );
}
