"use client"

/*
 * Adapted from ElevenLabs UI's Waveform and AudioScrubber components.
 * Copyright (c) ElevenLabs. Licensed under the MIT License.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import {
  type HTMLAttributes,
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
} from "react"

import { cn } from "@/lib/utils"

export type WaveformProps = HTMLAttributes<HTMLDivElement> & {
  data?: number[]
  progress?: number
  barWidth?: number
  barHeight?: number
  barGap?: number
  barRadius?: number
  height?: string | number
}

export function Waveform({
  data = [],
  progress = 0,
  barWidth = 2,
  barHeight: minimumBarHeight = 2,
  barGap = 2,
  barRadius = 1,
  height = 88,
  className,
  ...props
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const render = () => {
      const bounds = container.getBoundingClientRect()
      const ratio = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.round(bounds.width * ratio))
      canvas.height = Math.max(1, Math.round(bounds.height * ratio))
      canvas.style.width = `${bounds.width}px`
      canvas.style.height = `${bounds.height}px`

      const context = canvas.getContext("2d")
      if (!context) return
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, bounds.width, bounds.height)

      const styles = getComputedStyle(canvas)
      const playedColor = styles.getPropertyValue("--foreground").trim() || "#171717"
      const remainingColor = styles.getPropertyValue("--border").trim() || "#d7d7d4"
      const step = barWidth + barGap
      const barCount = Math.max(1, Math.floor((bounds.width + barGap) / step))
      const centerY = bounds.height / 2

      for (let index = 0; index < barCount; index += 1) {
        const dataIndex = Math.min(
          data.length - 1,
          Math.floor((index * data.length) / barCount),
        )
        const value = Math.max(0, Math.min(1, data[dataIndex] ?? 0))
        const drawnHeight = Math.max(
          minimumBarHeight,
          value * bounds.height * 0.72,
        )
        const x = index * step
        const y = centerY - drawnHeight / 2

        context.fillStyle =
          (index + 0.5) / barCount <= progress ? playedColor : remainingColor
        context.beginPath()
        context.roundRect(x, y, barWidth, drawnHeight, barRadius)
        context.fill()
      }
    }

    const observer = new ResizeObserver(render)
    observer.observe(container)
    render()
    return () => observer.disconnect()
  }, [barGap, barRadius, barWidth, data, minimumBarHeight, progress])

  return (
    <div
      ref={containerRef}
      data-slot="waveform"
      className={cn("relative w-full", className)}
      style={{ height: typeof height === "number" ? `${height}px` : height }}
      {...props}
    >
      <canvas ref={canvasRef} className="block size-full" aria-hidden="true" />
    </div>
  )
}

export type AudioScrubberProps = Omit<WaveformProps, "progress"> & {
  currentTime?: number
  duration?: number
  onSeek?: (time: number) => void
  showHandle?: boolean
}

export function AudioScrubber({
  data = [],
  currentTime = 0,
  duration = 0,
  onSeek,
  showHandle = true,
  height = 88,
  className,
  ...props
}: AudioScrubberProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0
  const safeCurrentTime = Math.min(
    safeDuration,
    Math.max(0, Number.isFinite(currentTime) ? currentTime : 0),
  )
  const progress = safeDuration > 0 ? safeCurrentTime / safeDuration : 0

  const seekTo = useCallback(
    (value: number) => {
      if (!safeDuration) return
      onSeek?.(Math.min(safeDuration, Math.max(0, value)))
    },
    [onSeek, safeDuration],
  )

  const seekFromPointer = useCallback(
    (clientX: number) => {
      const bounds = containerRef.current?.getBoundingClientRect()
      if (!bounds || bounds.width <= 0) return
      const ratio = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width))
      seekTo(ratio * safeDuration)
    },
    [safeDuration, seekTo],
  )

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!safeDuration) return
    draggingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    seekFromPointer(event.clientX)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (draggingRef.current) seekFromPointer(event.clientX)
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    draggingRef.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const stepByKey: Partial<Record<string, number>> = {
      ArrowDown: -1,
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: 1,
      PageDown: -5,
      PageUp: 5,
    }

    if (event.key === "Home") {
      event.preventDefault()
      seekTo(0)
      return
    }
    if (event.key === "End") {
      event.preventDefault()
      seekTo(safeDuration)
      return
    }

    const step = stepByKey[event.key]
    if (step === undefined) return
    event.preventDefault()
    seekTo(safeCurrentTime + step)
  }

  return (
    <div
      {...props}
      ref={containerRef}
      data-slot="audio-scrubber"
      role="slider"
      tabIndex={safeDuration > 0 ? 0 : -1}
      aria-label={props["aria-label"] ?? "Seek through sound"}
      aria-disabled={safeDuration === 0}
      aria-valuemin={0}
      aria-valuemax={safeDuration}
      aria-valuenow={safeCurrentTime}
      className={cn(
        "relative w-full touch-none cursor-pointer select-none focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-neutral-500 aria-disabled:cursor-default",
        className,
      )}
      style={{ height: typeof height === "number" ? `${height}px` : height }}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <Waveform
        data={data}
        progress={progress}
        height="100%"
        className="pointer-events-none"
      />
      <span
        data-slot="audio-scrubber-progress"
        className="pointer-events-none absolute inset-y-2 w-px bg-foreground"
        style={{ left: `${progress * 100}%` }}
        aria-hidden="true"
      />
      {showHandle && (
        <span
          data-slot="audio-scrubber-handle"
          className="pointer-events-none absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
          style={{ left: `${progress * 100}%` }}
          aria-hidden="true"
        />
      )}
    </div>
  )
}
