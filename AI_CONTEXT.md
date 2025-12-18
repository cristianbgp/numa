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
│  ├─ tracklist.txt          # Simple track list and durations
│  └─ prompt.txt             # AI generation prompt template (optional)
├─ mix/
│  ├─ <release>_mix.wav      # final continuous mix (WAV format)
│  └─ <release>_mix.mp3      # final continuous mix (MP3 format, 320kbps)
├─ tracks/                   # individual track WAVs (optional)
└─ videos/
   └─ <release>.mp4          # rendered video output (generated)
```

### Repo layout snapshot (high-level)
```
/assets/logo/               # brand marks
/001_under_the_sun/         # release 1
/002_evening_rain/          # release 2
/003_neon_dust/             # release 3
/004_blurred_streets/       # release 4
/website/                   # Astro website for numa.channel
/scripts/                   # Bun scripts (generate-mix, generate-video, sync-mix-data, webm-2-mp4)
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
  "description": "a warm lofi journey for slow summer days. sounds for still moments, drifting light, and quiet warmth.",
  "release_date": "TBD",
  "duration": "00:20:23",
  "youtube_url": "https://www.youtube.com/watch?v=...",
  "colors": ["#f5e6d3", "#e8d4b8"],
  "title_color": "#2d2d2d",
  "subtitle_color": "#2d2d2d",
  "tracks": [
    { "index": 1, "title": "lazy heatwave", "duration": "1:52", "timestamp": "00:00" }
    // ... more tracks ...
  ],
  "created_with": "Suno AI Pro",
  "license": "All rights reserved © numa.channel 2025"
}
```

**Fields:**
- `colors`: Array of hex strings for gradient background (supports 1+ colors for multi-stop gradients)
- `title_color` and `subtitle_color`: Hex strings for text colors in artwork
- `youtube_url`: Optional YouTube link (used by website)
- `duration`: Total mix duration in `HH:MM:SS` format
- `tracks`: Array with `index`, `title`, `duration` (MM:SS), and `timestamp` (HH:MM:SS)
- Timestamps are calculated with 2-second crossfade + 1.00516 adjustment ratio

`metadata/description.txt` is the human-friendly YouTube description (intro, tracklist with timestamps, about blurb). `metadata/tags.txt` lists YouTube tags, one per line (e.g., lofi, chill beats, study music, minimal lofi, numa, release name).

### Prompts (metadata/prompt.txt)
Each release includes a prompt file for Suno AI track generation. Keep it concise and focused on mood, core instruments, texture, and context. Always include `title: [track name here]` suffix.

**Examples:**

**numa.001 — under the sun:**
```
warm lofi instrumental with gentle vinyl crackle, soft electric piano and mellow drums, evokes a quiet summer afternoon under the sun, nostalgic and dreamy mood, relaxed tempo, minimal and organic textures, soothing and reflective atmosphere. title: [track name here]
```

**numa.004 — blurred streets:**
```
lofi instrumental with soft vinyl texture and gentle dusty drums, mellow electric piano and distant reverb tails, evokes a quiet walk through blurred city lights at night, calm and reflective, slightly hazy and detuned, minimal arrangement, warm but distant mood. title: [track name here]
```

**Key principles:**
- Keep prompt consistent across all 10 tracks for coherence
- Emphasize mood and atmosphere over technical details
- Include texture elements (vinyl, tape, reverb)
- Specify tempo range when relevant (70-86 bpm for blurred streets)
- Avoid heavy drums, sharp snares, dramatic chords

### Tooling and rules
- This repo uses **Bun** for scripts and shelling. Prefer Bun over Node/npm/pnpm.
- Video rendering uses `ffmpeg` (must be installed on the host system).
- Bun Shell docs: [Bun Shell](https://bun.com/docs/runtime/shell)

### Video generation (scripts/generate-video.ts)
- CLI: `bun scripts/generate-video.ts <release-folder>` (e.g., `bun scripts/generate-video.ts 001_under_the_sun`)
- Behavior:
  - Validates `<folder>` exists
  - Expects `artwork/yt_background.png`
  - Finds the first `.wav` inside `mix/`
  - Writes output to `videos/<folderName>.mp4`
  - ffmpeg args: `-loop 1 -c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p -shortest -vf scale=1920:1080,format=yuv420p -y`

### Mix generation (scripts/generate-mix.ts)
- CLI: `bun scripts/generate-mix.ts <release-folder> [--crossfade <seconds>]` (e.g., `bun scripts/generate-mix.ts 002_evening_rain --crossfade 2`)
- Behavior:
  - Validates `<folder>` exists
  - Reads all `.wav` files from `tracks/` subdirectory
  - Sorts tracks numerically by filename (e.g., `01_track.wav`, `02_track.wav`)
  - Uses ffmpeg `acrossfade` filter to crossfade between tracks
  - Default crossfade duration: 2 seconds (customizable via `--crossfade` flag)
  - Writes outputs to `mix/<folderName>_mix.wav` and `mix/<folderName>_mix.mp3`
  - MP3 encoding: 320kbps with libmp3lame
- Crossfade parameters: `d=<duration>:c1=tri:c2=tri` (triangular fade curves)
- **Note:** Timestamps in metadata are calculated with a 1.00516 adjustment ratio to account for actual WAV file durations vs metadata durations

### Artwork generator (`/website/src/components/artwork-generator.tsx`)
- React + TypeScript component in the website project
- Features: ratio toggle (square / landscape), gradient colors with adjustable angle, grain intensity, letter spacing, title/subtitle/mark controls, PNG export
- Loads saved styles from `website/src/data/mixes.ts` automatically
- Accessible at `/tools` route on the website

### Released Mixes

#### numa.001 — under the sun
- **Theme:** summer, warmth, stillness
- **Duration:** 20:23
- **Colors:** `#f5e6d3`, `#e8d4b8` (warm beige gradient)
- **Text Colors:** `#2d2d2d` (dark)
- **Tracks:** lazy heatwave; golden haze; soft mirage; still air; amber loop; dustlight; glass horizon; quiet glow; afterlight; sleeping light
- **YouTube:** https://www.youtube.com/watch?v=7rvox0fYgyY

#### numa.002 — evening rain
- **Theme:** dusk, rain, window light
- **Duration:** 24:40
- **Colors:** `#a7b6c8`, `#1c436d` (cool blue gradient)
- **Text Colors:** `#e0e0e0` (light)
- **Tracks:** soft drizzle; window light; vinyl rain; afterglow neon; gentle rhodes; puddle chorus; street hush; amber umbrellas; late bus echo; quiet apartment
- **YouTube:** https://www.youtube.com/watch?v=aphDIhWN8TY

#### numa.003 — neon dust
- **Theme:** nocturnal, city lights, vaporwave
- **Duration:** 27:18
- **Colors:** `#2a1f3d`, `#4a3f5e` (dark purple gradient)
- **Text Colors:** `#d4a5ff` (neon purple)
- **Tracks:** midnight chrome; vapor streets; lost signals; electric haze; phantom glow; city echoes; dim walkway; velvet pixels; faded neon; slow motion blur
- **YouTube:** https://www.youtube.com/watch?v=nvb9WlcWreY

#### numa.004 — blurred streets
- **Theme:** nocturnal, quiet city, distance
- **Duration:** 22:11
- **Colors:** `#f0935a`, `#9b6d9f`, `#2c3e5e` (orange → purple → navy gradient)
- **Text Colors:** `#e8d4c4` (warm white)
- **Tracks:** crossfade corner; passing glow; soft neon; window phase; pale traffic; warm concrete; low signal; tint reflection; avenue blur; quiet return
- **YouTube:** https://www.youtube.com/watch?v=0jgP2SxCnyg

### New release checklist
1. Create new folder `NNN_theme-slug/` with required subfolders (`artwork/`, `metadata/`, `mix/`, `tracks/`, `videos/`)
2. Fill `metadata/info.json` with release info (id, title, theme, colors, track list)
3. Create `metadata/prompt.txt` with Suno AI prompt template
4. Generate 10 tracks with Suno AI using the prompt, save as `01_track_name.wav`, `02_track_name.wav`, etc. in `tracks/`
5. **Verify all track names are unique:**
   - Run `just check-tracks` (or `bun scripts/check-track-names.ts`)
   - Fix any duplicates before proceeding
6. Produce artwork via website `/tools` (artwork generator) and save to `artwork/cover.png` and `artwork/yt_background.png`
7. Generate mix with crossfades:
   - `just mix NNN_theme-slug` (or `bun scripts/generate-mix.ts NNN_theme-slug --crossfade 2`)
8. Calculate timestamps (2s crossfade + 1.00516 adjustment ratio) and update `info.json`, `description.txt`, `tracklist.txt`
9. Render video:
   - `just video NNN_theme-slug` (or `bun scripts/generate-video.ts NNN_theme-slug`)
10. Sync data to website:
    - `just sync-data` (or `bun scripts/sync-mix-data.ts`)
11. Upload to YouTube using the metadata files

### Website data sync
- Mix metadata is synced from `metadata/info.json` files to `website/src/data/mixes.ts`
- Run `bun scripts/sync-mix-data.ts` or `just sync-data` after updating any info.json
- The website uses this TypeScript data file for displaying mixes

### Additional Scripts

**scripts/sync-mix-data.ts**
- Syncs mix metadata from all `metadata/info.json` files to `website/src/data/mixes.ts`
- Automatically discovers all release directories (format: `NNN_theme`)
- Generates TypeScript data file with proper types
- Run: `bun scripts/sync-mix-data.ts` or `just sync-data`

**scripts/webm-2-mp4.ts**
- Converts WebM files to MP4 format
- High quality settings (CRF 18, slow preset)
- Run: `bun scripts/webm-2-mp4.ts <input.webm> [output.mp4]` or `just webm-to-mp4 <input> [output]`

**scripts/check-track-names.ts**
- Validates that all track names are unique across all releases
- Reports any duplicates found with their release and track index
- Run: `bun scripts/check-track-names.ts` or `just check-tracks`
- **Use before finalizing a new release** to ensure no naming conflicts

### Justfile commands
Quick commands via `just`:
- `just mix <release> [crossfade]` - Generate mix (default 2s crossfade)
- `just video <release>` - Generate video
- `just full <release> [crossfade]` - Generate both mix and video
- `just sync-data` - Sync mix data to website
- `just webm-to-mp4 <input> [output]` - Convert WebM to MP4
- `just check-tracks` - Check all track names are unique across releases
- `just validate <release>` - Validate release files
- `just releases` - List all releases
- `just info <release>` - Show release metadata

### Track Naming Rules
- **All track names must be unique** across all releases
- Format: lowercase, 1-2 words, atmospheric
- Match the release theme and mood
- Examples: "lazy heatwave", "soft neon", "crossfade corner"
- Before creating new release, verify all 10 track names don't exist in previous releases

### Notes for AI agents
- Prefer Bun Shell for command execution and scripting. Example:

```ts
import { $ } from "bun";
await $`ffmpeg -i ${"in.wav"} -y ${"out.mp4"}`;
```

- Avoid adding large binaries to the repo; media files are gitignored
- Keep visuals and copy consistent with the minimalist, warm, calm aesthetic
- Default crossfade is 2 seconds between tracks
- Timestamps require adjustment ratio (1.00516) to match actual WAV durations
- Website artwork generator loads styles from synced mix data automatically
- All releases follow the same structure and naming conventions for consistency


