#!/usr/bin/env bun

/**
 * Syncs mix data from metadata/info.json files to website/src/data/mixes.ts
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT_DIR = join(import.meta.dir, "..");
const WEBSITE_DATA_DIR = join(ROOT_DIR, "website", "src", "data");

interface Track {
  index: number;
  title: string;
  duration: string;
  timestamp: string;
}

interface MixMetadata {
  id: string;
  title: string;
  theme: string;
  description: string;
  release_date: string;
  duration: string;
  colors: string[];
  title_color: string;
  subtitle_color: string;
  tracks: Track[];
  created_with: string;
  license: string;
}

async function syncMixData() {
  console.log("🔄 Syncing mix data from info.json files...\n");

  // Find all release directories (format: NNN_name)
  const entries = readdirSync(ROOT_DIR, { withFileTypes: true });
  const releaseDirs = entries
    .filter((entry) => entry.isDirectory() && /^\d{3}_/.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .reverse(); // Latest first

  console.log(`📁 Found ${releaseDirs.length} release directories:`);
  releaseDirs.forEach((dir) => console.log(`   - ${dir}`));
  console.log();

  const mixes: MixMetadata[] = [];

  for (const dir of releaseDirs) {
    const infoPath = join(ROOT_DIR, dir, "metadata", "info.json");
    
    if (!existsSync(infoPath)) {
      console.log(`⚠️  Skipping ${dir}: no info.json found`);
      continue;
    }

    try {
      const infoContent = readFileSync(infoPath, "utf-8");
      const mixData: MixMetadata = JSON.parse(infoContent);
      mixes.push(mixData);
      console.log(`✅ Loaded ${mixData.id} — ${mixData.title}`);
    } catch (error) {
      console.error(`❌ Error reading ${dir}:`, error);
    }
  }

  console.log(`\n📝 Generating TypeScript data file...\n`);

  // Generate TypeScript file
  const tsContent = `// Auto-generated from metadata/info.json files
// To regenerate: bun run scripts/sync-mix-data.ts

export interface Track {
  index: number;
  title: string;
  duration: string;
  timestamp: string;
}

export interface Mix {
  id: string;
  title: string;
  theme: string;
  description: string;
  release_date: string;
  duration: string;
  colors: string[];
  title_color: string;
  subtitle_color: string;
  tracks: Track[];
  created_with: string;
  license: string;
  youtubeUrl?: string;
}

export const mixes: Mix[] = ${JSON.stringify(mixes, null, 2)};
`;

  const outputPath = join(WEBSITE_DATA_DIR, "mixes.ts");
  writeFileSync(outputPath, tsContent, "utf-8");

  console.log(`✅ Written to ${outputPath}`);
  console.log(`\n🎉 Sync complete! ${mixes.length} mixes synced.\n`);
}

syncMixData().catch((error) => {
  console.error("❌ Error syncing mix data:", error);
  process.exit(1);
});

