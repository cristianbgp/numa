# numa.channel justfile

# Run commands with: just <command> [args]

# List all available commands
default:
  @just --list

# List all available commands
list:
  @just --list

# Generate mix from tracks with crossfade (default: 2 seconds)
mix release crossfade="2":
  bun scripts/generate-mix.ts {{release}} --crossfade {{crossfade}}

# Generate video from mix and artwork
video release:
  bun scripts/generate-video.ts {{release}}

# Convert WebM to MP4
webm-to-mp4 input output="":
  bun scripts/webm-2-mp4.ts {{input}} {{output}}

# Export all mix MP3s to a directory (default: all_mixes_mp3)
export-mp3 output="all_mixes_mp3":
  bun scripts/export-mix-mp3.ts {{output}}

# Generate both mix and video for a release
full release crossfade="2":
  @echo "🎵 Generating mix for {{release}}..."
  @just mix {{release}} {{crossfade}}
  @echo "🎬 Generating video for {{release}}..."
  @just video {{release}}
  @echo "✅ Done! Video ready at {{release}}/videos/"

# Sync mix data from info.json to website
sync-data:
  @echo "🔄 Syncing mix data to website..."
  bun scripts/sync-mix-data.ts

# Check all track names are unique across releases
check-tracks:
  @echo "🔍 Checking track name uniqueness..."
  bun scripts/check-track-names.ts

# List all releases
releases:
  @echo "Available releases:"
  @ls -d [0-9][0-9][0-9]_* 2>/dev/null || echo "No releases found"

# Show info about a release
info release:
  @echo "📀 Release: {{release}}"
  @echo ""
  @cat {{release}}/metadata/info.json | bun -e "console.log(JSON.stringify(JSON.parse(await Bun.stdin.text()), null, 2))"

# Validate release has all required files
validate release:
  @echo "🔍 Validating {{release}}..."
  @test -f {{release}}/metadata/info.json && echo "✅ info.json" || echo "❌ info.json missing"
  @test -f {{release}}/metadata/description.txt && echo "✅ description.txt" || echo "❌ description.txt missing"
  @test -f {{release}}/metadata/tags.txt && echo "✅ tags.txt" || echo "❌ tags.txt missing"
  @test -f {{release}}/metadata/tracklist.txt && echo "✅ tracklist.txt" || echo "❌ tracklist.txt missing"
  @test -f {{release}}/metadata/prompt.txt && echo "✅ prompt.txt" || echo "❌ prompt.txt missing"
  @test -f {{release}}/artwork/cover.png && echo "✅ cover.png" || echo "❌ cover.png missing"
  @test -f {{release}}/artwork/yt_background.png && echo "✅ yt_background.png" || echo "❌ yt_background.png missing"
  @test -n "$(find {{release}}/tracks -name '*.wav' 2>/dev/null)" && echo "✅ tracks/*.wav files found" || echo "❌ No WAV files in tracks/"
  @test -n "$(find {{release}}/mix -name '*.wav' 2>/dev/null)" && echo "✅ mix/*.wav file found" || echo "❌ No WAV file in mix/"
  @test -n "$(find {{release}}/mix -name '*.mp3' 2>/dev/null)" && echo "✅ mix/*.mp3 file found" || echo "❌ No MP3 file in mix/"
  @test -n "$(find {{release}}/videos -name '*.mp4' 2>/dev/null)" && echo "✅ videos/*.mp4 file found" || echo "❌ No MP4 file in videos/"
