#!/usr/bin/env bun

import { $ } from "bun";
import { existsSync } from "fs";
import { readdir } from "fs/promises";
import { join, basename } from "path";

async function findTrackFiles(tracksDir: string): Promise<string[]> {
  if (!existsSync(tracksDir)) {
    return [];
  }
  
  const files = await readdir(tracksDir);
  const wavFiles = files
    .filter(file => file.endsWith(".wav"))
    .sort((a, b) => {
      // Sort numerically by track number (e.g., 01_track.wav, 02_track.wav)
      const aNum = parseInt(a.match(/^\d+/)?.[0] ?? "0");
      const bNum = parseInt(b.match(/^\d+/)?.[0] ?? "0");
      return aNum - bNum;
    });
  
  return wavFiles.map(f => join(tracksDir, f));
}

async function generateMix(folderPath: string, crossfadeDuration: number = 2) {
  // Validate folder exists
  if (!existsSync(folderPath)) {
    console.error(`Error: Folder "${folderPath}" does not exist`);
    process.exit(1);
  }

  // Define paths
  const tracksDir = join(folderPath, "tracks");
  const mixDir = join(folderPath, "mix");
  
  // Find track files
  const trackFiles = await findTrackFiles(tracksDir);
  if (trackFiles.length === 0) {
    console.error(`Error: No .wav files found in ${tracksDir}`);
    process.exit(1);
  }

  if (trackFiles.length === 1) {
    console.error(`Error: Need at least 2 tracks to create a mix with crossfades`);
    process.exit(1);
  }

  // Create mix directory if it doesn't exist
  if (!existsSync(mixDir)) {
    await $`mkdir -p ${mixDir}`;
  }

  // Generate output filename based on folder name
  const folderName = basename(folderPath);
  const outputWavPath = join(mixDir, `${folderName}_mix.wav`);
  const outputMp3Path = join(mixDir, `${folderName}_mix.mp3`);

  console.log(`📁 Folder: ${folderPath}`);
  console.log(`🎵 Tracks found: ${trackFiles.length}`);
  trackFiles.forEach((track, i) => {
    console.log(`   ${i + 1}. ${basename(track)}`);
  });
  console.log(`⏱️  Crossfade: ${crossfadeDuration}s`);
  console.log(`🎚️  Output WAV: ${outputWavPath}`);
  console.log(`🎚️  Output MP3: ${outputMp3Path}`);
  console.log("\n🔄 Mixing tracks...\n");

  // Build ffmpeg filter_complex for crossfading
  // For N tracks, we need N-1 crossfades
  const inputs = trackFiles.map((_, i) => `-i "${trackFiles[i]}"`).join(" ");
  
  let filterComplex = "";
  let currentLabel = "[0]";
  
  for (let i = 1; i < trackFiles.length; i++) {
    const nextInput = `[${i}]`;
    const outputLabel = i === trackFiles.length - 1 ? "" : `[a${i}]`;
    
    if (i === trackFiles.length - 1) {
      // Last crossfade - no output label needed
      filterComplex += `${currentLabel}${nextInput}acrossfade=d=${crossfadeDuration}:c1=tri:c2=tri`;
    } else {
      filterComplex += `${currentLabel}${nextInput}acrossfade=d=${crossfadeDuration}:c1=tri:c2=tri${outputLabel};`;
      currentLabel = outputLabel;
    }
  }

  // Run ffmpeg command using Bun Shell to generate WAV
  // Note: We use raw shell syntax here because of the complex filter
  await $`ffmpeg ${trackFiles.map(f => ["-i", f]).flat()} -filter_complex ${filterComplex} -y ${outputWavPath}`;

  console.log(`\n✅ WAV mix generated successfully`);
  console.log(`\n🔄 Converting to MP3...\n`);

  // Convert WAV to MP3 with high quality
  await $`ffmpeg -i ${outputWavPath} -codec:a libmp3lame -b:a 320k -y ${outputMp3Path}`;

  console.log(`\n✅ MP3 mix generated successfully`);
  console.log(`\n📦 Output files:`);
  console.log(`   WAV: ${outputWavPath}`);
  console.log(`   MP3: ${outputMp3Path}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Review the mix in your audio editor`);
  console.log(`  2. Generate video: bun generate-video.ts ${folderName}`);
}

// Main CLI
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log("Usage: bun generate-mix.ts <folder-path> [--crossfade <seconds>]");
  console.log("\nExample:");
  console.log("  bun generate-mix.ts 002_evening_rain");
  console.log("  bun generate-mix.ts 002_evening_rain --crossfade 3");
  console.log("\nOptions:");
  console.log("  --crossfade <seconds>  Duration of crossfade between tracks (default: 2)");
  process.exit(1);
}

const folderPath = args[0];
let crossfadeDuration = 2;

// Parse optional --crossfade flag
const crossfadeIndex = args.indexOf("--crossfade");
if (crossfadeIndex !== -1 && args[crossfadeIndex + 1]) {
  crossfadeDuration = parseFloat(args[crossfadeIndex + 1]!);
  if (isNaN(crossfadeDuration) || crossfadeDuration < 0) {
    console.error("Error: --crossfade must be a positive number");
    process.exit(1);
  }
}

await generateMix(folderPath!, crossfadeDuration);

