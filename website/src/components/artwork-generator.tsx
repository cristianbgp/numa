"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Download, RefreshCw } from "lucide-react";
import { mixes } from "@/data/mixes";

type Ratio = "square" | "landscape";

const RATIO_CONFIG = {
  square: { width: 3000, height: 3000, label: "Cover (3000×3000px)" },
  landscape: { width: 3840, height: 2160, label: "YouTube (3840×2160px)" },
};

type SavedStyle = {
  id: string;
  title: string;
  subtitle: string;
  colors: string[];
  titleColor: string;
  subtitleColor: string;
};

const SAVED_STYLES: SavedStyle[] = mixes.map((mix) => ({
  id: mix.id,
  title: mix.title,
  subtitle: mix.description,
  colors: mix.colors,
  titleColor: mix.title_color,
  subtitleColor: mix.subtitle_color,
}));

export default function ArtworkGenerator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const grainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [title, setTitle] = useState("numa.001");
  const [subtitle, setSubtitle] = useState("under the sun");
  const [mark, setMark] = useState("n.");
  const [titleColor, setTitleColor] = useState<string>("#2d2d2d");
  const [subtitleColor, setSubtitleColor] = useState<string>("#2d2d2d");
  const [markColor, setMarkColor] = useState<string>("#2d2d2d");
  const [colors, setColors] = useState<string[]>(["#f5e6d3", "#e8d4b8"]); // gradient stops
  const [grainIntensity, setGrainIntensity] = useState(0.15);
  const [letterSpacing, setLetterSpacing] = useState(40);
  const [gradientAngle, setGradientAngle] = useState(45); // degrees
  const [ratio, setRatio] = useState<Ratio>("square");

  useEffect(() => {
    scheduleDraw();
  }, [
    title,
    subtitle,
    mark,
    titleColor,
    subtitleColor,
    markColor,
    colors,
    grainIntensity,
    letterSpacing,
    gradientAngle,
    ratio,
  ]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const scheduleDraw = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(drawCanvas);
  };

  const getGrainCanvas = (width: number, height: number) => {
    let grain = grainCanvasRef.current;
    if (!grain || grain.width !== width || grain.height !== height) {
      grain = document.createElement("canvas");
      grain.width = width;
      grain.height = height;
      const gctx = grain.getContext("2d");
      if (gctx) {
        const imageData = gctx.createImageData(width, height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const v = Math.random() * 255;
          data[i] = v;
          data[i + 1] = v;
          data[i + 2] = v;
          data[i + 3] = 255;
        }
        gctx.putImageData(imageData, 0, 0);
      }
      grainCanvasRef.current = grain;
    }
    return grainCanvasRef.current!;
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Create gradient background (supports 1+ stops)
    let fillStyle: CanvasGradient | string;
    if (colors.length <= 1) {
      fillStyle = colors[0] ?? "#ffffff";
    } else {
      // Calculate gradient coordinates based on angle
      const angleRad = (gradientAngle * Math.PI) / 180;
      const diagonal = Math.sqrt(width * width + height * height);
      const centerX = width / 2;
      const centerY = height / 2;

      // Calculate start and end points
      const x1 = centerX - (Math.cos(angleRad) * diagonal) / 2;
      const y1 = centerY - (Math.sin(angleRad) * diagonal) / 2;
      const x2 = centerX + (Math.cos(angleRad) * diagonal) / 2;
      const y2 = centerY + (Math.sin(angleRad) * diagonal) / 2;

      const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
      const step = 1 / (colors.length - 1);
      colors.forEach((c, i) => {
        gradient.addColorStop(i * step, c);
      });
      fillStyle = gradient;
    }
    ctx.fillStyle = fillStyle;
    ctx.fillRect(0, 0, width, height);

    // Overlay precomputed grain texture for performance
    const grain = getGrainCanvas(width, height);
    ctx.save();
    ctx.globalAlpha = grainIntensity;
    ctx.globalCompositeOperation = "soft-light";
    ctx.drawImage(grain, 0, 0, width, height);
    ctx.restore();

    // Set text properties
    const defaultTextColor = "rgba(45, 45, 45, 0.85)";
    ctx.fillStyle = defaultTextColor;
    ctx.textBaseline = "bottom";

    // Calculate font size based on canvas size
    const baseFontSize = Math.floor(width / 25);

    // Draw main title
    ctx.font = `${baseFontSize}px "Geist Mono", monospace`;
    ctx.letterSpacing = `${letterSpacing}px`;
    const titleY = height - baseFontSize * 2.5;
    ctx.fillStyle = titleColor;
    ctx.fillText(title, baseFontSize * 0.8, titleY);

    // Draw subtitle
    const subtitleY = height - baseFontSize * 1.2;
    ctx.fillStyle = subtitleColor;
    ctx.fillText(subtitle, baseFontSize * 0.8, subtitleY);

    // Draw mark (top-right)
    if (mark) {
      ctx.fillStyle = markColor;
      ctx.globalAlpha = 0.5;
      ctx.font = `${baseFontSize * 0.65}px "Geist Mono", monospace`;
      const markWidth = ctx.measureText(mark).width;
      ctx.fillText(
        mark,
        width - markWidth - baseFontSize * 0.8,
        baseFontSize * 1.5
      );
      ctx.globalAlpha = 1;
    }
  };

  const setColorAt = (index: number, value: string) => {
    setColors((prev) => prev.map((c, i) => (i === index ? value : c)));
  };

  const addColorStop = () => {
    setColors((prev) => [...prev, prev[prev.length - 1] ?? "#e8d4b8"]);
  };

  const removeColorStop = (index: number) => {
    setColors((prev) =>
      prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)
    );
  };

  const hexToRgb = (hex: string) => {
    const m = hex.replace("#", "").match(/.{1,2}/g);
    if (!m) return { r: 255, g: 255, b: 255 };
    const [r, g, b] = m.map((x) => parseInt(x.length === 1 ? x + x : x, 16));
    return { r, g, b };
  };

  const rgbToHex = (r: number, g: number, b: number) => {
    const toHex = (v: number) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const interpolate = (a: number, b: number, t: number) => a + (b - a) * t;

  const interpolateHex = (c1: string, c2: string, t: number) => {
    const A = hexToRgb(c1);
    const B = hexToRgb(c2);
    return rgbToHex(
      interpolate(A.r, B.r, t),
      interpolate(A.g, B.g, t),
      interpolate(A.b, B.b, t)
    );
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = `${title.replace(/\s+/g, "-").toLowerCase()}-${ratio}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const randomizeColors = () => {
    const palettes: [string, string][] = [
      ["#f5e6d3", "#e8d4b8"],
      ["#ffecd2", "#fcb69f"],
      ["#fff1e6", "#fde1d7"],
      ["#fef4e4", "#f7d9c4"],
      ["#ffe8d6", "#f4c4a0"],
    ];
    const [start, end] = palettes[Math.floor(Math.random() * palettes.length)];
    if (colors.length <= 2) {
      setColors([start, end]);
    } else {
      // generate a multi-stop gradient by interpolating between start/end
      const stops: string[] = [];
      for (let i = 0; i < colors.length; i++) {
        const t = i / (colors.length - 1);
        stops.push(interpolateHex(start, end, t));
      }
      setColors(stops);
    }
  };

  const loadStyle = (style: SavedStyle) => {
    setTitle(style.id);
    setSubtitle(style.title);
    setColors(style.colors);
    setTitleColor(style.titleColor);
    setSubtitleColor(style.subtitleColor);
    setMarkColor(style.titleColor); // Use title color for mark
  };

  const currentRatio = RATIO_CONFIG[ratio];

  return (
    <div className="py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-mono font-bold mb-2 tracking-wide">
          numa.art
        </h1>
        <p className="text-muted-foreground font-mono text-sm tracking-wider">
          Create artwork for numa.channel
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Canvas Preview */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-6">
            <canvas
              ref={canvasRef}
              width={currentRatio.width}
              height={currentRatio.height}
              className="w-full h-auto rounded-md shadow-lg"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setRatio("square")}
              variant={ratio === "square" ? "default" : "outline"}
              className="flex-1 font-mono"
            >
              Cover
              <span className="ml-2 text-xs opacity-70">3000×3000</span>
            </Button>
            <Button
              onClick={() => setRatio("landscape")}
              variant={ratio === "landscape" ? "default" : "outline"}
              className="flex-1 font-mono"
            >
              YouTube
              <span className="ml-2 text-xs opacity-70">3840×2160</span>
            </Button>
          </div>
          <Button onClick={downloadImage} className="w-full" size="lg">
            <Download className="mr-2 h-4 w-4" />
            Download {currentRatio.label}
          </Button>
        </div>

        {/* Controls */}
        <div className="space-y-6">
          {/* Saved Styles */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-mono font-semibold mb-4 tracking-wide">
              Saved Styles
            </h2>
            <div className="grid grid-cols-5 gap-3">
              {SAVED_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => loadStyle(style)}
                  className="group relative aspect-square rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-all cursor-pointer"
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        style.colors.length === 1
                          ? style.colors[0]
                          : `linear-gradient(135deg, ${style.colors.join(
                              ", "
                            )})`,
                    }}
                  />
                  <div className="absolute hidden lg:block inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-linear-to-t hidden lg:block">
                    <p
                      className="font-mono text-[10px] text-white/90 font-semibold leading-tight"
                      style={{
                        color: style.titleColor,
                      }}
                    >
                      {style.id}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-6 space-y-6">
            <div>
              <h2 className="text-xl font-mono font-semibold mb-4 tracking-wide">
                Typography
              </h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title" className="font-mono">
                    Title
                  </Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="font-mono"
                    placeholder="numa.001"
                  />
                  <div className="mt-3">
                    <Label htmlFor="titleColor" className="font-mono">
                      Title Color
                    </Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="titleColor"
                        type="color"
                        value={titleColor}
                        onChange={(e) => setTitleColor(e.target.value)}
                        className="w-20 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={titleColor}
                        onChange={(e) => setTitleColor(e.target.value)}
                        className="font-mono"
                        placeholder="#2d2d2d"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <Label htmlFor="subtitle" className="font-mono">
                    Subtitle
                  </Label>
                  <Input
                    id="subtitle"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    className="font-mono"
                    placeholder="under the sun"
                  />
                  <div className="mt-3">
                    <Label htmlFor="subtitleColor" className="font-mono">
                      Subtitle Color
                    </Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="subtitleColor"
                        type="color"
                        value={subtitleColor}
                        onChange={(e) => setSubtitleColor(e.target.value)}
                        className="w-20 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={subtitleColor}
                        onChange={(e) => setSubtitleColor(e.target.value)}
                        className="font-mono"
                        placeholder="#2d2d2d"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <Label htmlFor="mark" className="font-mono">
                    Mark (optional)
                  </Label>
                  <Input
                    id="mark"
                    value={mark}
                    onChange={(e) => setMark(e.target.value)}
                    className="font-mono"
                    placeholder="n."
                  />
                  <div className="mt-3">
                    <Label htmlFor="markColor" className="font-mono">
                      Mark Color
                    </Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="markColor"
                        type="color"
                        value={markColor}
                        onChange={(e) => setMarkColor(e.target.value)}
                        className="w-20 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={markColor}
                        onChange={(e) => setMarkColor(e.target.value)}
                        className="font-mono"
                        placeholder="#2d2d2d"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <Label htmlFor="letterSpacing" className="font-mono">
                    Letter Spacing: {letterSpacing}px
                  </Label>
                  <Slider
                    id="letterSpacing"
                    min={0}
                    max={80}
                    step={5}
                    value={[letterSpacing]}
                    onValueChange={(value) => setLetterSpacing(value[0])}
                    className="mt-2"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-mono font-semibold tracking-wide">
                  Colors
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={randomizeColors}
                  className="font-mono bg-transparent"
                >
                  <RefreshCw className="mr-2 h-3 w-3" />
                  Randomize
                </Button>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="gradientAngle" className="font-mono">
                    Gradient Angle: {gradientAngle}°
                  </Label>
                  <Slider
                    id="gradientAngle"
                    min={0}
                    max={360}
                    step={15}
                    value={[gradientAngle]}
                    onValueChange={(value) => setGradientAngle(value[0])}
                    className="mt-2"
                  />
                </div>
                {colors.map((c, i) => (
                  <div key={i}>
                    <Label htmlFor={`color-${i}`} className="font-mono">
                      {`Stop ${i + 1}`}
                    </Label>
                    <div className="flex gap-2 mt-1 items-center">
                      <Input
                        id={`color-${i}`}
                        type="color"
                        value={c}
                        onChange={(e) => setColorAt(i, e.target.value)}
                        className="w-20 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={c}
                        onChange={(e) => setColorAt(i, e.target.value)}
                        className="font-mono"
                        placeholder="#f5e6d3"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="font-mono"
                        onClick={() => removeColorStop(i)}
                        disabled={colors.length <= 2}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-mono"
                    onClick={addColorStop}
                  >
                    Add Stop
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-mono font-semibold mb-4 tracking-wide">
                Texture
              </h2>
              <div>
                <Label htmlFor="grain" className="font-mono">
                  Grain Intensity: {(grainIntensity * 100).toFixed(0)}%
                </Label>
                <Slider
                  id="grain"
                  min={0}
                  max={0.4}
                  step={0.01}
                  value={[grainIntensity]}
                  onValueChange={(value) => setGrainIntensity(value[0])}
                  className="mt-2"
                />
              </div>
            </div>
          </div>

          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <h3 className="font-mono text-sm font-semibold mb-2 tracking-wide">
              Design Specs
            </h3>
            <ul className="text-xs font-mono space-y-1 text-muted-foreground">
              <li>• Cover: 3000×3000px PNG</li>
              <li>• YouTube: 3840×2160px PNG</li>
              <li>• Font: Geist Mono (monospace)</li>
              <li>• Text Color: rgba(45, 45, 45, 0.85)</li>
              <li>• Paper-like grain texture</li>
              <li>• Warm gradient backgrounds</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
