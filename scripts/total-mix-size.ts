#!/usr/bin/env bun

import { readdirSync, statSync, existsSync } from "fs";
import { join } from "path";

function formatBytes(bytes: number) {
  const kb = bytes / 1024;
  const mb = kb / 1024;
  const gb = mb / 1024;

  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  if (kb >= 1) return `${kb.toFixed(2)} KB`;
  return `${bytes} B`;
}

async function main() {
  const ROOT_DIR = join(import.meta.dir, "..");

  console.log("📦 Calculating total size of all mixes (.wav and .mp3) across releases...\n");

  const entries = readdirSync(ROOT_DIR, { withFileTypes: true });
  const releaseDirs = entries
    .filter((entry) => entry.isDirectory() && /^\d{3}_/.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  if (releaseDirs.length === 0) {
    console.log("❌ No release directories found");
    process.exit(1);
  }

  let totalWavBytes = 0;
  let totalMp3Bytes = 0;

  for (const dir of releaseDirs) {
    const mixDir = join(ROOT_DIR, dir, "mix");
    if (!existsSync(mixDir)) {
      continue;
    }

    const files = readdirSync(mixDir);
    const wavFiles = files.filter((f) => f.toLowerCase().endsWith(".wav"));
    const mp3Files = files.filter((f) => f.toLowerCase().endsWith(".mp3"));

    let folderWavBytes = 0;
    let folderMp3Bytes = 0;

    for (const file of wavFiles) {
      const fullPath = join(mixDir, file);
      const stats = statSync(fullPath);
      folderWavBytes += stats.size;
    }

    for (const file of mp3Files) {
      const fullPath = join(mixDir, file);
      const stats = statSync(fullPath);
      folderMp3Bytes += stats.size;
    }

    totalWavBytes += folderWavBytes;
    totalMp3Bytes += folderMp3Bytes;

    if (folderWavBytes > 0 || folderMp3Bytes > 0) {
      console.log(
        `📁 ${dir}/mix -> WAV: ${formatBytes(folderWavBytes)}, MP3: ${formatBytes(
          folderMp3Bytes,
        )}`,
      );
    }
  }

  const totalBytes = totalWavBytes + totalMp3Bytes;

  console.log("\n=== Totals ===");
  console.log(`🎚️ WAV total: ${formatBytes(totalWavBytes)}`);
  console.log(`🎧 MP3 total: ${formatBytes(totalMp3Bytes)}`);
  console.log(`📊 All mixes (WAV + MP3): ${formatBytes(totalBytes)}\n`);
}

main().catch((err) => {
  console.error("❌ Error calculating mix sizes:", err);
  process.exit(1);
});


