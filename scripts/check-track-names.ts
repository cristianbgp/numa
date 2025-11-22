#!/usr/bin/env bun

import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

interface Track {
  index: number;
  title: string;
  duration: string;
  timestamp: string;
}

interface MixMetadata {
  id: string;
  title: string;
  tracks: Track[];
}

async function checkTrackNames() {
  const ROOT_DIR = join(import.meta.dir, "..");
  console.log("🔍 Checking track name uniqueness across all releases...\n");

  // Find all release directories (format: NNN_theme)
  const entries = readdirSync(ROOT_DIR, { withFileTypes: true });
  const releaseDirs = entries
    .filter((entry) => entry.isDirectory() && /^\d{3}_/.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  if (releaseDirs.length === 0) {
    console.log("❌ No release directories found");
    process.exit(1);
  }

  console.log(`📁 Found ${releaseDirs.length} release directories:\n`);

  const allTracks: Array<{ release: string; track: Track }> = [];
  const releases: Array<{ id: string; title: string; trackCount: number }> = [];

  // Load all tracks from all releases
  for (const dir of releaseDirs) {
    const infoPath = join(ROOT_DIR, dir, "metadata", "info.json");

    if (!existsSync(infoPath)) {
      console.log(`⚠️  Skipping ${dir}: no info.json found`);
      continue;
    }

    try {
      const infoContent = readFileSync(infoPath, "utf-8");
      const mixData: MixMetadata = JSON.parse(infoContent);

      releases.push({
        id: mixData.id,
        title: mixData.title,
        trackCount: mixData.tracks.length,
      });

      mixData.tracks.forEach((track) => {
        allTracks.push({ release: mixData.id, track });
      });

      console.log(`✅ ${mixData.id} — ${mixData.title} (${mixData.tracks.length} tracks)`);
    } catch (error) {
      console.error(`❌ Error reading ${dir}:`, error);
    }
  }

  console.log(`\n📊 Total tracks: ${allTracks.length}\n`);

  // Check for duplicates
  const trackNameMap = new Map<string, Array<{ release: string; index: number }>>();

  allTracks.forEach(({ release, track }) => {
    const normalizedName = track.title.toLowerCase().trim();
    if (!trackNameMap.has(normalizedName)) {
      trackNameMap.set(normalizedName, []);
    }
    trackNameMap.get(normalizedName)!.push({ release, index: track.index });
  });

  // Find duplicates
  const duplicates = Array.from(trackNameMap.entries()).filter(
    ([_, occurrences]) => occurrences.length > 1
  );

  if (duplicates.length === 0) {
    console.log("✅ All track names are unique!\n");
    console.log("📋 Summary:");
    releases.forEach((release) => {
      console.log(`   ${release.id} — ${release.title}: ${release.trackCount} tracks`);
    });
    console.log(`\n   Total: ${allTracks.length} unique track names`);
    process.exit(0);
  }

  // Report duplicates
  console.log(`❌ Found ${duplicates.length} duplicate track name(s):\n`);

  duplicates.forEach(([trackName, occurrences]) => {
    console.log(`   "${trackName}" appears in:`);
    occurrences.forEach(({ release, index }) => {
      console.log(`      - ${release} (track ${index})`);
    });
    console.log();
  });

  console.log(`\n⚠️  Please rename duplicate tracks to ensure uniqueness.`);
  process.exit(1);
}

checkTrackNames().catch((error) => {
  console.error("❌ Error checking track names:", error);
  process.exit(1);
});

