# numa

numa is a series of minimalist lofi sound journals. Each release captures a
single feeling or moment through ten original tracks, a continuous mix, and a
quiet visual identity.

- Website: [numa.channel](https://numa.channel)
- YouTube: [@numa.000](https://www.youtube.com/@numa.000)

## Repository overview

This repository contains the complete production workflow for numa:

- Numbered release directories hold artwork, metadata, tracks, mixes, and
  rendered videos.
- `scripts/` contains Bun scripts for audio, video, validation, and data sync.
- `website/` contains the Astro website and its artwork generator.
- `justfile` provides the common project commands.

```text
.
├── NNN_release_name/
│   ├── artwork/
│   ├── metadata/
│   ├── mix/
│   ├── tracks/
│   └── videos/
├── assets/
├── scripts/
├── website/
└── justfile
```

Audio and video files are intentionally ignored by Git. Release metadata,
scripts, artwork, and website source are tracked.

## Requirements

- [Bun](https://bun.sh/)
- [just](https://github.com/casey/just)
- [ffmpeg](https://ffmpeg.org/)
- [asdf](https://asdf-vm.com/) when matching the Cloudflare Node runtime

The repository pins Node in `.tool-versions`. Install that version without
changing the version used by other projects:

```sh
asdf install
```

Install the Bun dependencies for each workspace:

```sh
cd scripts && bun install
cd ../website && bun install
```

## Common commands

Run these commands from the repository root:

```sh
# Show all available commands
just

# Generate a continuous WAV and MP3 mix; crossfade defaults to 2 seconds
just mix 012_open_air
just mix 012_open_air 3

# Render a release video from its mix and landscape artwork
just video 012_open_air

# Generate both the mix and video
just full 012_open_air

# Sync release metadata into the website
just sync-data

# Check that every track name is unique across all releases
just check-tracks

# Validate a release's required files
just validate 012_open_air

# List releases or inspect one release's metadata
just releases
just info 012_open_air

# Export every release MP3 into one directory
just export-mp3

# Convert a WebM file to MP4
just webm-to-mp4 input.webm output.mp4
```

The corresponding scripts can also be run directly with Bun. See `justfile`
for the exact invocations.

## Release structure

Release directories use the format `NNN_release_name`, while public release
IDs use `numa.NNN`.

```text
NNN_release_name/
├── artwork/
│   ├── cover.png                 # 3000 × 3000
│   └── yt_background.png         # 3840 × 2160
├── metadata/
│   ├── info.json                 # canonical structured metadata
│   ├── description.txt           # YouTube description
│   ├── tags.txt                  # YouTube tags
│   ├── tracklist.txt             # human-readable track list
│   └── prompt.txt                # music-generation prompt
├── mix/
│   ├── NNN_release_name_mix.wav
│   └── NNN_release_name_mix.mp3
├── tracks/
│   ├── 01_track_name.wav
│   └── ...
└── videos/
    └── NNN_release_name.mp4
```

Every release contains exactly ten tracks. Track names must be lowercase,
atmospheric, usually one or two words, and unique across the complete catalog.
Run `just check-tracks` before finalizing a release.

## Production workflow

1. Create the numbered release directory and required subdirectories.
2. Add the release details and track list to `metadata/info.json`.
3. Add the music-generation prompt and produce ten numbered WAV tracks.
4. Run `just check-tracks` to catch duplicate names.
5. Create the square cover and landscape YouTube artwork with the `/tools`
   page in the website.
6. Run `just mix <release>` to produce the WAV master and 320 kbps MP3.
7. Update durations and timestamps in the release metadata and text files.
8. Run `just video <release>` to render the YouTube video.
9. Run `just sync-data` to update the website data.
10. Run `just validate <release>` before publishing.

Mixes use two-second triangular crossfades by default. Metadata timestamps use
the project’s established `1.00516` duration adjustment ratio.

## Metadata and website data

Each release’s `metadata/info.json` is the source of truth for its title,
description, colors, URLs, duration, and tracks.

```text
NNN_*/metadata/info.json
        │
        └── bun scripts/sync-mix-data.ts
                    │
                    └── website/src/data/mixes.ts
```

`website/src/data/mixes.ts` is generated. Do not edit it manually; update the
release metadata and run `just sync-data` instead.

The repository deliberately does not duplicate the full release catalog in
this README. The metadata files remain current and can be exposed by the
website through `/data.json`.

## Website

The website uses Astro, React, Tailwind CSS, and the Cloudflare adapter.

```sh
cd website
bun install
bun run dev
bun run build
bun run preview
```

Current routes include the home page, mixes, about, the artwork tools, and the
generated data endpoint. The artwork generator reads the same synced release
data as the public mixes page.

### Cloudflare Pages

The Pages project uses:

- Root directory: `website`
- Build command: the package’s `build` script (`bun run build` locally)
- Build output directory: `dist`
- Wrangler configuration: `website/wrangler.jsonc`
- Node version: the repository-level `.tool-versions` pin

The Wrangler configuration uses `pages_build_output_dir` and preserves the
Cloudflare compatibility flags required by the Astro adapter.

## Visual direction

- Warm, restrained gradients with subtle paper-like grain
- Geist Mono typography
- A small `n.` mark
- Calm, minimal copy written in lowercase
- Square artwork at 3000 × 3000 and YouTube artwork at 3840 × 2160

Each release defines its palette and text colors in `metadata/info.json`.

## Project rules

- Use Bun for dependency management and TypeScript scripts.
- Keep media binaries out of Git.
- Treat release metadata as the canonical data source.
- Regenerate website data after metadata changes.
- Keep every track name unique across all releases.
- Preserve the quiet, minimal character of the website and artwork.

## Rights

Release metadata declares the music and artwork as all rights reserved. This
repository does not currently include an open-source license.
