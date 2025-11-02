#!/usr/bin/env bun

import { $ } from "bun";
import { existsSync } from "fs";
import { readdir } from "fs/promises";
import { join, basename } from "path";

async function findWavFile(mixDir: string): Promise<string | null> {
  if (!existsSync(mixDir)) {
    return null;
  }
  
  const files = await readdir(mixDir);
  const wavFile = files.find(file => file.endsWith(".wav"));
  
  return wavFile ? join(mixDir, wavFile) : null;
}

async function generateVideo(folderPath: string) {
  // Validate folder exists
  if (!existsSync(folderPath)) {
    console.error(`Error: Folder "${folderPath}" does not exist`);
    process.exit(1);
  }

  // Define paths
  const artworkPath = join(folderPath, "artwork", "yt_background.png");
  const mixDir = join(folderPath, "mix");
  const videosDir = join(folderPath, "videos");
  
  // Check if artwork exists
  if (!existsSync(artworkPath)) {
    console.error(`Error: Could not find yt_background.png at ${artworkPath}`);
    process.exit(1);
  }

  // Find WAV file
  const wavPath = await findWavFile(mixDir);
  if (!wavPath) {
    console.error(`Error: Could not find any .wav file in ${mixDir}`);
    process.exit(1);
  }

  // Create videos directory if it doesn't exist
  if (!existsSync(videosDir)) {
    await $`mkdir -p ${videosDir}`;
  }

  // Generate output filename based on folder name
  const folderName = basename(folderPath);
  const outputPath = join(videosDir, `${folderName}.mp4`);

  console.log(`📁 Folder: ${folderPath}`);
  console.log(`🎨 Artwork: ${artworkPath}`);
  console.log(`🎵 Audio: ${wavPath}`);
  console.log(`🎬 Output: ${outputPath}`);
  console.log("\n🔄 Generating video...\n");

  // Run ffmpeg command using Bun Shell
  await $`ffmpeg -loop 1 -i ${artworkPath} -i ${wavPath} -c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p -shortest -vf scale=1920:1080,format=yuv420p -y ${outputPath}`;

  console.log(`\n✅ Video generated successfully: ${outputPath}`);
}

// Main CLI
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log("Usage: bun generate-video.ts <folder-path>");
  console.log("\nExample:");
  console.log("  bun generate-video.ts 001_under_the_sun");
  process.exit(1);
}

const folderPath = args[0];
await generateVideo(folderPath!);