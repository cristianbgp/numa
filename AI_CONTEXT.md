## numa — AI project context

Purpose: Provide compact, high-signal context so any AI agent can work productively in this repo without discovery steps.

### What this project is
- **numa** is a minimalist YouTube lofi channel: “sound journals” — each release captures a single feeling/theme.
- Visual identity: warm paper-like textures, subtle grain, monospace typography, small top-right mark `n.`
- Audio: original lofi tracks and mixes; mixes are exported as a single WAV per release and paired with a static background for YouTube.

### Naming and structure conventions
- Releases are numbered: `numa.001`, `numa.002`, ...
- Release directory naming: `NNN_theme_slug` (e.g., `001_under_the_sun`).
- Required subfolders per release:

```
NNN_theme/
├─ artwork/
│  ├─ cover.png              # 3000×3000 (square)
│  └─ yt_background.png      # 3840×2160 (landscape, for YouTube)
├─ metadata/
│  ├─ info.json              # structured metadata (see schema below)
│  ├─ description.txt        # YouTube description (tracklist, about)
│  ├─ tags.txt               # SEO tags, one per line
│  └─ tracklist.txt          # Simple track list and durations
├─ mix/
│  └─ <final-mix>.wav        # final continuous mix
├─ tracks/                   # individual track WAVs (optional)
└─ videos/
   └─ <release>.mp4          # rendered video output (generated)
```

### Repo layout snapshot (high-level)
```
/assets/logo/               # brand marks
/001_under_the_sun/         # first release
/numa-art/                  # artwork generator web app
generate-video.ts           # Bun CLI to render YouTube video via ffmpeg
```

### Visual design specs
- Canvas sizes:
  - Cover: 3000×3000 PNG
  - YouTube: 3840×2160 PNG
- Font: Geist Mono (monospace look)
- Text color: rgba(45, 45, 45, 0.85)
- Background: warm gradient + light paper-like grain

The `numa-art` app renders these with adjustable typography, colors, letter spacing, and grain; it exports PNGs for both ratios.

### Metadata schema (metadata/info.json)
Example from `001_under_the_sun`:

```json
{
  "id": "numa.001",
  "title": "under the sun",
  "theme": "summer, warmth, stillness",
  "colors": ["#f5e6d3", "#e8d4b8"],
  "description": "a warm lofi journey for slow summer days. sounds for still moments, drifting light, and quiet warmth.",
  "release_date": "2025-11-01",
  "duration": "00:20:00",
  "tracks": [
    { "index": 1, "title": "lazy heatwave", "duration": "1:52", "timestamp": "00:00" }
    // ... more tracks ...
  ],
  "created_with": "Suno AI Pro",
  "mixed_with": "Audacity",
  "license": "All rights reserved © numa.channel 2025"
}
```

`colors` is an array of hex strings used for the gradient background to keep visual identity consistent across artwork outputs.

`metadata/description.txt` is the human-friendly YouTube description (intro, tracklist with timestamps, about blurb). `metadata/tags.txt` lists YouTube tags, one per line (e.g., lofi, chill beats, study music, minimal lofi, numa, release name).

### Tooling and rules
- This repo uses **Bun** for scripts and shelling. Prefer Bun over Node/npm/pnpm.
- Video rendering uses `ffmpeg` (must be installed on the host system).
- Bun Shell docs: [Bun Shell](https://bun.com/docs/runtime/shell)

### Video generation (generate-video.ts)
- CLI: `bun generate-video.ts <release-folder>` (e.g., `bun generate-video.ts 001_under_the_sun`)
- Behavior:
  - Validates `<folder>` exists
  - Expects `artwork/yt_background.png`
  - Finds the first `.wav` inside `mix/`
  - Writes output to `videos/<folderName>.mp4`
  - ffmpeg args: `-loop 1 -c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p -shortest -vf scale=1920:1080,format=yuv420p -y`

### Artwork generator (`/numa-art`)
- React + TypeScript app to create cover and YouTube backgrounds.
- Features: ratio toggle (square / landscape), gradient colors, grain intensity, letter spacing, title/subtitle/mark controls, PNG export.

### Current release (reference)
`numa.001 — under the sun`
- Theme: summer, warmth, stillness
- Track titles: lazy heatwave; golden haze; soft mirage; still air; amber loop; dustlight; glass horizon; quiet glow; afterlight; sleeping light

### New release checklist
1. Create new folder `NNN_theme-slug/` with required subfolders.
2. Produce artwork via `/numa-art` and save to `artwork/cover.png` and `artwork/yt_background.png`.
3. Place final mixed audio `mix/<something>.wav`.
4. Fill `metadata/` files (`info.json`, `description.txt`, `tags.txt`, `tracklist.txt`).
5. Render video:
   - `bun generate-video.ts NNN_theme-slug`
6. Upload to YouTube using the metadata files.

### Notes for AI agents
- Prefer Bun Shell for command execution and scripting. Example:

```ts
import { $ } from "bun";
await $`ffmpeg -i ${"in.wav"} -y ${"out.mp4"}`;
```

- Avoid adding large binaries to the repo; media files are gitignored.
- Keep visuals and copy consistent with the minimalist, warm, calm aesthetic.


