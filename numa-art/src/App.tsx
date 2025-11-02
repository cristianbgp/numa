"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Download, RefreshCw } from "lucide-react"

type Ratio = "square" | "landscape"

const RATIO_CONFIG = {
  square: { width: 3000, height: 3000, label: "Cover (3000×3000px)" },
  landscape: { width: 3840, height: 2160, label: "YouTube (3840×2160px)" },
}

export default function ImageGenerator() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const grainCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [title, setTitle] = useState("numa.001")
  const [subtitle, setSubtitle] = useState("under the sun")
  const [mark, setMark] = useState("n.")
  const [colors, setColors] = useState<string[]>(["#f5e6d3", "#e8d4b8"]) // gradient stops
  const [grainIntensity, setGrainIntensity] = useState(0.15)
  const [letterSpacing, setLetterSpacing] = useState(40)
  const [ratio, setRatio] = useState<Ratio>("square")

  useEffect(() => {
    scheduleDraw()
  }, [title, subtitle, mark, colors, grainIntensity, letterSpacing, ratio])

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const scheduleDraw = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(drawCanvas)
  }

  const getGrainCanvas = (width: number, height: number) => {
    let grain = grainCanvasRef.current
    if (!grain || grain.width !== width || grain.height !== height) {
      grain = document.createElement("canvas")
      grain.width = width
      grain.height = height
      const gctx = grain.getContext("2d")
      if (gctx) {
        const imageData = gctx.createImageData(width, height)
        const data = imageData.data
        for (let i = 0; i < data.length; i += 4) {
          const v = Math.random() * 255
          data[i] = v
          data[i + 1] = v
          data[i + 2] = v
          data[i + 3] = 255
        }
        gctx.putImageData(imageData, 0, 0)
      }
      grainCanvasRef.current = grain
    }
    return grainCanvasRef.current!
  }

  const drawCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    // Create gradient background (supports 1+ stops)
    let fillStyle: CanvasGradient | string
    if (colors.length <= 1) {
      fillStyle = colors[0] ?? "#ffffff"
    } else {
      const gradient = ctx.createLinearGradient(0, 0, width, height)
      const step = 1 / (colors.length - 1)
      colors.forEach((c, i) => {
        gradient.addColorStop(i * step, c)
      })
      fillStyle = gradient
    }
    ctx.fillStyle = fillStyle
    ctx.fillRect(0, 0, width, height)

    // Overlay precomputed grain texture for performance
    const grain = getGrainCanvas(width, height)
    ctx.save()
    ctx.globalAlpha = grainIntensity
    ctx.globalCompositeOperation = "soft-light"
    ctx.drawImage(grain, 0, 0, width, height)
    ctx.restore()

    // Set text properties
    ctx.fillStyle = "rgba(45, 45, 45, 0.85)"
    ctx.textBaseline = "bottom"

    // Calculate font size based on canvas size
    const baseFontSize = Math.floor(width / 25)

    // Draw main title
    ctx.font = `${baseFontSize}px "Geist Mono", monospace`
    ctx.letterSpacing = `${letterSpacing}px`
    const titleY = height - baseFontSize * 2.5
    ctx.fillText(title, baseFontSize * 0.8, titleY)

    // Draw subtitle
    const subtitleY = height - baseFontSize * 1.2
    ctx.fillText(subtitle, baseFontSize * 0.8, subtitleY)

    // Draw mark (top-right)
    if (mark) {
      ctx.globalAlpha = 0.5
      ctx.font = `${baseFontSize * 0.65}px "Geist Mono", monospace`
      const markWidth = ctx.measureText(mark).width
      ctx.fillText(mark, width - markWidth - baseFontSize * 0.8, baseFontSize * 1.5)
      ctx.globalAlpha = 1
    }
  }

  const setColorAt = (index: number, value: string) => {
    setColors((prev) => prev.map((c, i) => (i === index ? value : c)))
  }

  const addColorStop = () => {
    setColors((prev) => [...prev, prev[prev.length - 1] ?? "#e8d4b8"])
  }

  const removeColorStop = (index: number) => {
    setColors((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)))
  }

  const hexToRgb = (hex: string) => {
    const m = hex.replace('#','').match(/.{1,2}/g)
    if (!m) return { r: 255, g: 255, b: 255 }
    const [r, g, b] = m.map((x) => parseInt(x.length === 1 ? x + x : x, 16))
    return { r, g, b }
  }

  const rgbToHex = (r: number, g: number, b: number) => {
    const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
  }

  const interpolate = (a: number, b: number, t: number) => a + (b - a) * t

  const interpolateHex = (c1: string, c2: string, t: number) => {
    const A = hexToRgb(c1)
    const B = hexToRgb(c2)
    return rgbToHex(interpolate(A.r, B.r, t), interpolate(A.g, B.g, t), interpolate(A.b, B.b, t))
  }

  const downloadImage = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const link = document.createElement("a")
    link.download = `${title.replace(/\s+/g, "-").toLowerCase()}-${ratio}.png`
    link.href = canvas.toDataURL("image/png")
    link.click()
  }

  const randomizeColors = () => {
    const palettes: [string, string][] = [
      ["#f5e6d3", "#e8d4b8"],
      ["#ffecd2", "#fcb69f"],
      ["#fff1e6", "#fde1d7"],
      ["#fef4e4", "#f7d9c4"],
      ["#ffe8d6", "#f4c4a0"],
    ]
    const [start, end] = palettes[Math.floor(Math.random() * palettes.length)]
    if (colors.length <= 2) {
      setColors([start, end])
    } else {
      // generate a multi-stop gradient by interpolating between start/end
      const stops: string[] = []
      for (let i = 0; i < colors.length; i++) {
        const t = i / (colors.length - 1)
        stops.push(interpolateHex(start, end, t))
      }
      setColors(stops)
    }
  }

  const currentRatio = RATIO_CONFIG[ratio]

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-mono font-bold mb-2 tracking-wide">Image Generator</h1>
          <p className="text-muted-foreground font-mono text-sm tracking-wider">
            Create artistic cover images with grain texture and custom typography
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
            <div className="bg-card border border-border rounded-lg p-6 space-y-6">
              <div>
                <h2 className="text-xl font-mono font-semibold mb-4 tracking-wide">Typography</h2>
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
                  <h2 className="text-xl font-mono font-semibold tracking-wide">Colors</h2>
                  <Button variant="outline" size="sm" onClick={randomizeColors} className="font-mono bg-transparent">
                    <RefreshCw className="mr-2 h-3 w-3" />
                    Randomize
                  </Button>
                </div>
                <div className="space-y-4">
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
                    <Button variant="outline" size="sm" className="font-mono" onClick={addColorStop}>
                      Add Stop
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-mono font-semibold mb-4 tracking-wide">Texture</h2>
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
              <h3 className="font-mono text-sm font-semibold mb-2 tracking-wide">Design Specs</h3>
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
    </div>
  )
}
