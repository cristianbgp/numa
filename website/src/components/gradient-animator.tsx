import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { mixes } from "../data/mixes";

interface SavedPreset {
  id: string;
  title: string;
  colors: string[];
}

const SAVED_PRESETS: SavedPreset[] = mixes.map((mix) => ({
  id: mix.id,
  title: mix.title,
  colors: mix.colors,
}));

export default function GradientAnimator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  
  // Animation settings
  const [speed, setSpeed] = useState(1);
  const [duration, setDuration] = useState(10); // seconds
  const [colors, setColors] = useState(SAVED_PRESETS[0].colors);
  const [gradientType, setGradientType] = useState<"radial" | "linear">("radial");
  const [grainIntensity, setGrainIntensity] = useState(0.15);
  const [vignetteIntensity, setVignetteIntensity] = useState(0.4);
  const [chromaticAberration, setChromaticAberration] = useState(2);
  
  // Canvas dimensions (optimized for shorts - 9:16 aspect ratio)
  const WIDTH = 1080;
  const HEIGHT = 1920;
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    let startTime = Date.now();
    
    const animate = () => {
      // Calculate time to ensure perfect loop - completes exactly one cycle per duration
      const elapsed = (Date.now() - startTime) / 1000; // in seconds
      const time = (elapsed * speed) % duration; // loops perfectly within duration
      const progress = (time / duration) * Math.PI * 2; // 0 to 2π for one complete cycle
      
      // Pulse factor: grows and shrinks smoothly (0.5 to 1.5 range)
      const pulse = Math.sin(progress) * 0.5 + 1;
      
      // Create gradient
      let gradient;
      
      if (gradientType === "radial") {
        // Center stays fixed for more dramatic pulse
        const centerX = WIDTH / 2;
        const centerY = HEIGHT / 2;
        
        // Radius pulses dramatically from small to large
        const baseRadius = Math.min(WIDTH, HEIGHT) * 0.6;
        const radius = baseRadius * pulse;
        
        gradient = ctx.createRadialGradient(
          centerX, centerY, 0,
          centerX, centerY, radius
        );
      } else {
        // Linear gradient rotates smoothly through 360 degrees
        const angle = progress;
        const distance = Math.max(WIDTH, HEIGHT);
        const x1 = WIDTH / 2 + Math.cos(angle) * distance;
        const y1 = HEIGHT / 2 + Math.sin(angle) * distance;
        const x2 = WIDTH / 2 - Math.cos(angle) * distance;
        const y2 = HEIGHT / 2 - Math.sin(angle) * distance;
        
        gradient = ctx.createLinearGradient(x1, y1, x2, y2);
      }
      
      // Add color stops with smooth, subtle shifting
      // Colors maintain their relative positions but shift slightly with the pulse
      const shift = Math.sin(progress) * 0.1; // Subtle shift from -0.1 to +0.1
      
      colors.forEach((color, i) => {
        // Evenly distribute colors with subtle animation
        const baseOffset = i / (colors.length - 1);
        const offset = baseOffset + shift * (0.5 - baseOffset); // Shift is stronger in middle, minimal at edges
        gradient.addColorStop(Math.max(0, Math.min(1, offset)), color);
      });
      
      // Add interpolated colors between stops for ultra-smooth blending
      if (colors.length >= 2) {
        for (let i = 0; i < colors.length - 1; i++) {
          const baseOffset = (i + 0.5) / (colors.length - 1);
          const offset = baseOffset + shift * (0.5 - baseOffset);
          // Blend between adjacent colors
          const blendColor = colors[i];
          gradient.addColorStop(Math.max(0, Math.min(1, offset)), blendColor);
        }
      }
      
      // Fill canvas
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      
      // Add lofi color grading overlay (slight desaturation and warmth)
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgba(255, 250, 240, 0.05)'; // Warm, vintage tone
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.globalCompositeOperation = 'source-over';
      
      // Add chromatic aberration effect (RGB shift for analog feel)
      if (chromaticAberration > 0) {
        const imageData = ctx.getImageData(0, 0, WIDTH, HEIGHT);
        const data = imageData.data;
        const shift = chromaticAberration;
        
        // Sample every nth pixel for performance
        const step = 4;
        for (let y = 0; y < HEIGHT; y += step) {
          for (let x = 0; x < WIDTH; x += step) {
            const i = (y * WIDTH + x) * 4;
            
            // Shift red channel
            const redX = Math.min(WIDTH - 1, x + shift);
            const redI = (y * WIDTH + redX) * 4;
            if (redI < data.length) {
              data[i] = data[redI];
            }
            
            // Shift blue channel
            const blueX = Math.max(0, x - shift);
            const blueI = (y * WIDTH + blueX) * 4;
            if (blueI < data.length) {
              data[i + 2] = data[blueI + 2];
            }
          }
        }
        
        ctx.putImageData(imageData, 0, 0);
      }
      
      // Add film grain effect
      // Create grain texture that covers more of the canvas
      const grainDensity = 3000; // Much more grain particles
      
      for (let i = 0; i < grainDensity; i++) {
        const x = Math.random() * WIDTH;
        const y = Math.random() * HEIGHT;
        const size = Math.random() * 1.5 + 0.5; // Vary grain size (0.5 to 2px)
        const opacity = Math.random() * grainIntensity;
        
        // Mix of light and dark grain
        const brightness = Math.random();
        if (brightness > 0.5) {
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        } else {
          ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
        }
        
        ctx.fillRect(x, y, size, size);
      }
      
      // Add vignette effect (stronger for lofi aesthetic)
      if (vignetteIntensity > 0) {
        const vignette = ctx.createRadialGradient(
          WIDTH / 2, HEIGHT / 2, 0,
          WIDTH / 2, HEIGHT / 2, Math.max(WIDTH, HEIGHT) * 0.65
        );
        vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vignette.addColorStop(0.7, `rgba(0, 0, 0, ${vignetteIntensity * 0.2})`);
        vignette.addColorStop(1, `rgba(0, 0, 0, ${vignetteIntensity})`);
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      }
      
      // Add light leak effect (random color wash in corners)
      const leakIntensity = Math.abs(Math.sin(progress * 0.5)) * 0.08;
      const leakGradient = ctx.createRadialGradient(
        WIDTH * 0.8 + Math.sin(progress) * 100,
        HEIGHT * 0.2 + Math.cos(progress) * 100,
        0,
        WIDTH * 0.8,
        HEIGHT * 0.2,
        WIDTH * 0.5
      );
      leakGradient.addColorStop(0, `rgba(255, 200, 150, ${leakIntensity})`);
      leakGradient.addColorStop(1, 'rgba(255, 200, 150, 0)');
      ctx.fillStyle = leakGradient;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [speed, colors, gradientType, duration, grainIntensity, vignetteIntensity, chromaticAberration]);
  
  const startRecording = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    setIsRecording(true);
    setRecordedChunks([]);
    
    const stream = canvas.captureStream(60); // 60 FPS
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp9",
      videoBitsPerSecond: 8000000, // High quality
    });
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        setRecordedChunks((prev) => [...prev, event.data]);
      }
    };
    
    mediaRecorder.onstop = () => {
      setIsRecording(false);
      setIsExporting(false);
    };
    
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    
    // Stop recording after specified duration
    setTimeout(() => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    }, duration * 1000);
  };
  
  const downloadVideo = () => {
    if (recordedChunks.length === 0) return;
    
    setIsExporting(true);
    
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `numa-gradient-${Date.now()}.webm`;
    a.click();
    
    URL.revokeObjectURL(url);
    
    setTimeout(() => {
      setIsExporting(false);
    }, 1000);
  };
  
  const updateColor = (index: number, value: string) => {
    const newColors = [...colors];
    newColors[index] = value;
    setColors(newColors);
  };
  
  const addColor = () => {
    if (colors.length < 6) {
      setColors([...colors, "#000000"]);
    }
  };
  
  const removeColor = (index: number) => {
    if (colors.length > 2) {
      setColors(colors.filter((_, i) => i !== index));
    }
  };
  
  const loadPreset = (preset: SavedPreset) => {
    setColors(preset.colors);
  };
  
  return (
    <div className="py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-mono font-bold mb-2 tracking-wide">
          numa.shorts
        </h1>
        <p className="text-muted-foreground font-mono text-sm tracking-wider">
          Create perfectly looping lofi gradient animations for shorts
        </p>
      </div>
      
      <div className="grid md:grid-cols-2 gap-8">
        {/* Preview */}
        <div className="space-y-4">
          <div className="aspect-9/16 bg-black rounded-lg overflow-hidden max-w-[360px] mx-auto shadow-2xl">
            <canvas
              ref={canvasRef}
              width={WIDTH}
              height={HEIGHT}
              className="w-full h-full"
            />
          </div>
          
          <div className="flex gap-2 justify-center">
            <Button
              onClick={startRecording}
              disabled={isRecording}
              className="font-mono"
            >
              {isRecording ? `Recording... (${duration}s)` : "Record Video"}
            </Button>
            
            {recordedChunks.length > 0 && (
              <Button
                onClick={downloadVideo}
                disabled={isExporting}
                variant="outline"
                className="font-mono"
              >
                {isExporting ? "Exporting..." : "Download"}
              </Button>
            )}
          </div>
        </div>
        
        {/* Controls */}
        <div className="space-y-6">
          <div>
            <Label className="font-mono">Gradient Type</Label>
            <div className="flex gap-2 mt-2">
              <Button
                variant={gradientType === "radial" ? "default" : "outline"}
                onClick={() => setGradientType("radial")}
                className="font-mono flex-1"
              >
                Radial
              </Button>
              <Button
                variant={gradientType === "linear" ? "default" : "outline"}
                onClick={() => setGradientType("linear")}
                className="font-mono flex-1"
              >
                Linear
              </Button>
            </div>
          </div>
          
          <div>
            <Label className="font-mono">Animation Speed: {speed.toFixed(1)}x</Label>
            <Slider
              value={[speed]}
              onValueChange={(v) => setSpeed(v[0])}
              min={0.1}
              max={5}
              step={0.1}
              className="mt-2"
            />
          </div>
          
          <div>
            <Label className="font-mono">Video Duration: {duration}s</Label>
            <Slider
              value={[duration]}
              onValueChange={(v) => setDuration(v[0])}
              min={3}
              max={60}
              step={1}
              className="mt-2"
            />
          </div>
          
          <div>
            <Label className="font-mono">Film Grain: {(grainIntensity * 100).toFixed(0)}%</Label>
            <Slider
              value={[grainIntensity]}
              onValueChange={(v) => setGrainIntensity(v[0])}
              min={0}
              max={0.3}
              step={0.01}
              className="mt-2"
            />
          </div>
          
          <div>
            <Label className="font-mono">Vignette: {(vignetteIntensity * 100).toFixed(0)}%</Label>
            <Slider
              value={[vignetteIntensity]}
              onValueChange={(v) => setVignetteIntensity(v[0])}
              min={0}
              max={0.8}
              step={0.05}
              className="mt-2"
            />
          </div>
          
          <div>
            <Label className="font-mono">Chromatic Aberration: {chromaticAberration}px</Label>
            <Slider
              value={[chromaticAberration]}
              onValueChange={(v) => setChromaticAberration(v[0])}
              min={0}
              max={10}
              step={1}
              className="mt-2"
            />
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label className="font-mono">Colors ({colors.length})</Label>
              <Button
                onClick={addColor}
                disabled={colors.length >= 6}
                variant="outline"
                size="sm"
                className="font-mono"
              >
                + Add
              </Button>
            </div>
            
            <div className="space-y-2">
              {colors.map((color, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Input
                    type="color"
                    value={color}
                    onChange={(e) => updateColor(index, e.target.value)}
                    className="w-16 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={color}
                    onChange={(e) => updateColor(index, e.target.value)}
                    className="font-mono flex-1"
                  />
                  {colors.length > 2 && (
                    <Button
                      onClick={() => removeColor(index)}
                      variant="ghost"
                      size="sm"
                      className="font-mono"
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <Label className="font-mono mb-2 block">Saved Presets</Label>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-2">
              {SAVED_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => loadPreset(preset)}
                  className="group relative overflow-hidden rounded-lg border border-border hover:border-primary transition-all p-3 text-left"
                >
                  <div className="flex gap-1 mb-2">
                    {preset.colors.map((color, i) => (
                      <div
                        key={i}
                        className="h-6 flex-1 rounded"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <p className="font-mono text-xs truncate">{preset.title}</p>
                </button>
              ))}
            </div>
          </div>
          
          <div className="text-xs text-muted-foreground font-mono space-y-1 pt-4 border-t">
            <p>• Output: 1080x1920 (9:16 ratio for shorts)</p>
            <p>• Format: WebM (VP9 codec)</p>
            <p>• Frame rate: 60 FPS</p>
            <p>• Bitrate: 8 Mbps (high quality)</p>
            <p>• Perfect loop: Animation cycles match video duration</p>
            <p>• Lofi effects: grain, vignette, chromatic aberration, light leaks</p>
          </div>
        </div>
      </div>
    </div>
  );
}
