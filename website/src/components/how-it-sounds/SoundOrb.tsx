import type { CSSProperties } from "react";
import { soundArtwork } from "@/lib/how-it-sounds";

type Props = {
  id: string;
  className?: string;
};

type OrbStyle = CSSProperties & Record<`--orb-${string}`, string>;

function artworkStyle(id: string): OrbStyle {
  const artwork = soundArtwork(id);
  const oppositeX = 100 - artwork.focusX;
  const oppositeY = 100 - artwork.focusY;

  return {
    background: `linear-gradient(${artwork.angle}deg, oklch(0.97 0.018 ${artwork.hue}), oklch(0.76 0.055 ${artwork.hue}))`,
    boxShadow: `inset -18px -22px 42px oklch(0.28 0.035 ${artwork.hue} / 0.14), inset 12px 14px 28px oklch(1 0 0 / 0.38)`,
    "--orb-primary-background": `radial-gradient(circle at ${artwork.focusX}% ${artwork.focusY}%, oklch(0.96 0.09 ${artwork.accentHue}) 0%, transparent 50%)`,
    "--orb-secondary-background": `radial-gradient(circle at ${oppositeX}% ${oppositeY}%, oklch(0.61 0.09 ${artwork.hue}) 0%, transparent 64%)`,
    "--orb-drift-x": `${artwork.driftX}%`,
    "--orb-drift-y": `${artwork.driftY}%`,
    "--orb-secondary-x": `${artwork.driftX * -0.9}%`,
    "--orb-secondary-y": `${artwork.driftY * -0.9}%`,
    "--orb-primary-duration": `${artwork.primaryDuration}s`,
    "--orb-secondary-duration": `${artwork.secondaryDuration}s`,
    "--orb-primary-delay": `${artwork.phaseDelay}s`,
    "--orb-secondary-delay": `${artwork.phaseDelay - 7}s`,
  };
}

export default function SoundOrb({ id, className = "" }: Props) {
  return (
    <div
      className={`sound-orb rounded-full ${className}`.trim()}
      style={artworkStyle(id)}
      aria-hidden="true"
    >
      <span className="sound-orb__glow sound-orb__glow--primary" />
      <span className="sound-orb__glow sound-orb__glow--secondary" />
    </div>
  );
}
