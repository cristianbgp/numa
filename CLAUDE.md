# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**numa** is a minimalist YouTube lofi channel producing "sound journals" — each release captures a single feeling/theme. The project consists of:
- **Audio releases:** Numbered releases (numa.001, numa.002, etc.) with 10 tracks each, mixed into continuous 20-30 minute sessions
- **Website:** Astro-based site at numa.channel for browsing releases
- **Scripts:** Bun-powered automation for mix generation, video rendering, and data sync
- **Visual identity:** Warm paper-like textures, subtle grain, monospace typography (Geist Mono), small top-right mark `n.`

## Development Environment

### Runtime
- **Bun** is the primary runtime (NOT Node.js, npm, or pnpm)
- All scripts use `#!/usr/bin/env bun` shebang
- Use `bun` for package management, script execution, and shell commands
- Bun Shell (`import { $ } from "bun"`) is used for command execution

### Key Technologies
- **Audio:** ffmpeg (required on system) for mix generation and video rendering
- **Website:** Astro + React + Tailwind CSS + Cloudflare deployment
- **Scripts:** TypeScript with Bun runtime
- **Task Runner:** just (justfile for common commands)

## Commands

### Common Development Tasks

**Audio Production:**
```bash
# Generate mix from tracks (default 2s crossfade)
just mix <release> [crossfade]
bun scripts/generate-mix.ts <release> --crossfade 2

# Generate video from mix and artwork
just video <release>
bun scripts/generate-video.ts <release>

# Generate both mix and video
just full <release> [crossfade]

# Check all track names are unique across releases
just check-tracks
bun scripts/check-track-names.ts
```

**Website:**
```bash
cd website
bun install
bun run dev      # Development server
bun run build    # Build for production
bun run preview  # Preview production build
```

**Data Management:**
```bash
# Sync mix metadata from info.json files to website
just sync-data
bun scripts/sync-mix-data.ts

# Convert WebM to MP4
just webm-to-mp4 <input> [output]
bun scripts/webm-2-mp4.ts <input> [output]
```

**Validation:**
```bash
# List all releases
just releases

# Show release metadata
just info <release>

# Validate release has all required files
just validate <release>
```

## Architecture

### Repository Structure

```
/
├── NNN_theme_slug/         # Release directories (001_under_the_sun, 002_evening_rain, etc.)
│   ├── artwork/
│   │   ├── cover.png              # 3000×3000 (square)
│   │   └── yt_background.png      # 3840×2160 (landscape)
│   ├── metadata/
│   │   ├── info.json              # Structured metadata (synced to website)
│   │   ├── description.txt        # YouTube description
│   │   ├── tags.txt               # SEO tags, one per line
│   │   ├── tracklist.txt          # Simple track list
│   │   └── prompt.txt             # Suno AI generation prompt
│   ├── mix/
│   │   ├── NNN_theme_slug_mix.wav # Final mix (WAV master)
│   │   └── NNN_theme_slug_mix.mp3 # Final mix (320kbps MP3)
│   ├── tracks/                    # 10 individual track WAVs (01_name.wav - 10_name.wav)
│   └── videos/
│       └── NNN_theme_slug.mp4     # Rendered video
├── scripts/                # Bun scripts for automation
├── website/                # Astro website
└── assets/                 # Brand assets (logo, etc.)
```

### Data Flow

1. **Source of Truth:** Each release's `metadata/info.json` contains all metadata
2. **Sync to Website:** `bun scripts/sync-mix-data.ts` reads all info.json files and generates `website/src/data/mixes.ts`
3. **Website Consumes:** Astro site imports `mixes.ts` for displaying releases
4. **Artwork Generator:** Website's `/tools` route provides interactive artwork generator that loads saved styles from synced mix data

### Mix Generation Pipeline

1. Tracks are created with Suno AI Pro (10 per release)
2. Tracks named `01_track_name.wav` through `10_track_name.wav` in `tracks/` directory
3. `generate-mix.ts` uses ffmpeg `acrossfade` filter to crossfade tracks with triangular curves
4. Output: WAV master + 320kbps MP3
5. Timestamps calculated with 2-second crossfade + 1.00516 adjustment ratio

### Video Rendering

- Uses static artwork (`yt_background.png`) with audio mix
- ffmpeg args: `-loop 1 -c:v libx264 -tune stillimage -c:a aac -b:a 192k`
- Output: MP4 video for YouTube upload

## Critical Rules

### Track Naming
- **All track names MUST be unique across ALL releases** (critical for brand consistency)
- Run `just check-tracks` or `bun scripts/check-track-names.ts` before finalizing new releases
- Format: lowercase, 1-2 words, atmospheric (e.g., "lazy heatwave", "soft neon")

### Release Structure
- Every release MUST have all required subdirectories and files (use `just validate <release>` to check)
- Releases MUST have exactly 10 tracks numbered 01-10
- `generate-mix.ts` will error if any tracks 01-10 are missing

### Bun-First Development
- Always use Bun commands instead of Node.js/npm equivalents
- Use Bun Shell (`$` from "bun") for command execution in scripts
- Reference: `.cursor/rules/use-bun-instead-of-node-vite-npm-pnpm.mdc`

### Metadata Sync
- Always run `just sync-data` after updating any `metadata/info.json` file
- Website will NOT reflect changes until sync is run
- The website data file (`website/src/data/mixes.ts`) is auto-generated — do not edit manually

### Visual Consistency
- Artwork specs: 3000×3000 (cover), 3840×2160 (YouTube background)
- Use artwork generator at `/tools` route on website
- Maintain minimalist aesthetic: warm gradients, subtle grain, monospace type
- Each release has unique color palette defined in `info.json`

## Script Details

### generate-mix.ts
- Validates all 10 tracks (01-10) are present before starting
- Sorts tracks numerically by filename prefix
- Uses ffmpeg acrossfade filter with triangular fade curves (c1=tri:c2=tri)
- Outputs both WAV and MP3 (320kbps) formats
- Default crossfade: 2 seconds (customizable)

### sync-mix-data.ts
- Auto-discovers all release directories matching `NNN_*` pattern
- Reads each `metadata/info.json` file
- Generates TypeScript data file with proper type definitions
- Orders mixes latest-first (reversed sort)

### generate-video.ts
- Validates release folder and artwork exist
- Finds first .wav file in mix/ directory
- Uses stillimage tune for static background optimization
- Outputs 1920x1080 MP4 with AAC audio

### check-track-names.ts
- Scans all releases for duplicate track names
- Reports conflicts with release ID and track index
- Essential to run before finalizing new releases

## Metadata Schema

Key fields in `metadata/info.json`:

```json
{
  "id": "numa.NNN",
  "title": "release title",
  "theme": "short theme description",
  "description": "poetic description for users",
  "release_date": "TBD",
  "duration": "HH:MM:SS",
  "music_url": "https://mixes.numa.channel/mixes/...",
  "youtube_url": "https://www.youtube.com/watch?v=...",
  "colors": ["#hex1", "#hex2", "#hex3"],
  "title_color": "#hex",
  "subtitle_color": "#hex",
  "tracks": [
    {
      "index": 1,
      "title": "track name",
      "duration": "M:SS",
      "timestamp": "H:MM:SS"
    }
  ],
  "created_with": "Suno AI Pro",
  "license": "All rights reserved © numa.channel 2025"
}
```

**Notes:**
- `colors`: Array of 1-3 hex colors for gradient backgrounds
- `duration`: Track duration in M:SS, total duration in HH:MM:SS
- `timestamp`: Calculated with 2s crossfade + 1.00516 adjustment ratio
- `music_url`: Optional direct MP3 link
- `youtube_url`: Optional YouTube video link

## Website Architecture

### Stack
- **Framework:** Astro 5+ (static site generation)
- **UI:** React 19+ for interactive components
- **Styling:** Tailwind CSS 4+ with custom config
- **Deployment:** Cloudflare Pages (adapter: @astrojs/cloudflare)

### Key Components
- `artwork-generator.tsx`: Interactive artwork creation tool with ratio toggle, gradient editor, grain controls
- `MobileMenu.tsx`: Mobile navigation
- `Tools.tsx`: Tools page wrapper
- UI components in `components/ui/`: shadcn-style components (button, input, slider, sheet, tabs)

### Data Layer
- Single source of truth: `website/src/data/mixes.ts` (auto-generated)
- TypeScript interfaces for Mix and Track
- Consumed by pages and components via import

### Styling Notes
- Uses Tailwind v4 with Vite plugin
- Custom utilities in `tw-animate-css`
- Monospace font: Geist Mono (loaded via Astro)
- Color palette per release (defined in mix metadata)

## Common Workflows

### Creating a New Release

1. Create directory: `NNN_theme_slug/` with subdirectories
2. Fill `metadata/info.json` with release info
3. Create `metadata/prompt.txt` for Suno AI
4. Generate 10 tracks with Suno AI, save as `01_track.wav` - `10_track.wav` in `tracks/`
5. **Verify track names:** `just check-tracks`
6. Create artwork via website `/tools` route
7. Generate mix: `just mix NNN_theme_slug`
8. Update timestamps in `info.json` (2s crossfade + 1.00516 ratio)
9. Generate video: `just video NNN_theme_slug`
10. Sync data: `just sync-data`
11. Upload to YouTube using metadata files

### Updating Website Content

1. Edit release metadata in `NNN_*/metadata/info.json`
2. Run `just sync-data` to update website data
3. Changes appear in website after rebuild

### Testing Audio Generation

1. Place test tracks in `test_release/tracks/` as `01_test.wav` - `10_test.wav`
2. Run `just mix test_release` to test mix generation
3. Review output in `test_release/mix/`

## Additional Context

- **Brand Evolution:** Releases 001-002 focused on natural elements (sun, rain), 003-004 on urban nocturne themes, 005-006 on intimate interiors, 007+ on emotional states and focus
- **Audio Settings:** All tracks created with Suno AI Pro, focus on atmosphere over technical complexity
- **Release Frequency:** Typically releases every Monday (as stated in descriptions)
- **Timestamp Adjustment:** The 1.00516 ratio accounts for actual WAV file durations vs metadata durations (discovered empirically)
- **Crossfade Curve:** Triangular (tri) fade curves provide smooth, musical transitions between tracks
- **Git Workflow:** Media files (.wav, .mp3, .mp4) are gitignored; only metadata, scripts, and website code are tracked
