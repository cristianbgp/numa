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
  const [title, setTitle] = useState("numa.001")
  const [subtitle, setSubtitle] = useState("under the sun")
  const [mark, setMark] = useState("n.")
  const [color1, setColor1] = useState("#f5e6d3")
  const [color2, setColor2] = useState("#e8d4b8")
  const [grainIntensity, setGrainIntensity] = useState(0.15)
  const [letterSpacing, setLetterSpacing] = useState(40)
  const [ratio, setRatio] = useState<Ratio>("square")

  useEffect(() => {
    drawCanvas()
  }, [title, subtitle, mark, color1, color2, grainIntensity, letterSpacing, ratio])

  const drawCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    // Create gradient background
    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, color1)
    gradient.addColorStop(1, color2)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    // Add grain texture
    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * grainIntensity * 255
      data[i] += noise
      data[i + 1] += noise
      data[i + 2] += noise
    }
    ctx.putImageData(imageData, 0, 0)

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

  const downloadImage = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const link = document.createElement("a")
    link.download = `${title.replace(/\s+/g, "-").toLowerCase()}-${ratio}.png`
    link.href = canvas.toDataURL("image/png")
    link.click()
  }

  const randomizeColors = () => {
    const warmColors = [
      ["#f5e6d3", "#e8d4b8"],
      ["#ffecd2", "#fcb69f"],
      ["#fff1e6", "#fde1d7"],
      ["#fef4e4", "#f7d9c4"],
      ["#ffe8d6", "#f4c4a0"],
    ]
    const random = warmColors[Math.floor(Math.random() * warmColors.length)]
    setColor1(random[0])
    setColor2(random[1])
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
                  <div>
                    <Label htmlFor="color1" className="font-mono">
                      Gradient Start
                    </Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="color1"
                        type="color"
                        value={color1}
                        onChange={(e) => setColor1(e.target.value)}
                        className="w-20 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={color1}
                        onChange={(e) => setColor1(e.target.value)}
                        className="font-mono"
                        placeholder="#f5e6d3"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="color2" className="font-mono">
                      Gradient End
                    </Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="color2"
                        type="color"
                        value={color2}
                        onChange={(e) => setColor2(e.target.value)}
                        className="w-20 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={color2}
                        onChange={(e) => setColor2(e.target.value)}
                        className="font-mono"
                        placeholder="#e8d4b8"
                      />
                    </div>
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
