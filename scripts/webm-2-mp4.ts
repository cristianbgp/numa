#!/usr/bin/env bun

import { $ } from "bun";
import { existsSync } from "fs";
import { join, basename, extname, dirname } from "path";

async function convertWebmToMp4(inputPath: string, outputPath?: string) {
  // Validate input file exists
  if (!existsSync(inputPath)) {
    console.error(`❌ Error: Input file not found: ${inputPath}`);
    process.exit(1);
  }

  // Validate it's a webm file
  if (extname(inputPath).toLowerCase() !== ".webm") {
    console.error(`❌ Error: Input file must be a .webm file`);
    process.exit(1);
  }

  // Generate output path if not provided
  if (!outputPath) {
    const dir = dirname(inputPath);
    const name = basename(inputPath, ".webm");
    outputPath = join(dir, `${name}.mp4`);
  }

  console.log(`📹 Converting WebM to MP4...`);
  console.log(`   Input:  ${inputPath}`);
  console.log(`   Output: ${outputPath}`);
  console.log();

  try {
    // Convert using ffmpeg with high quality settings
    await $`ffmpeg -i ${inputPath} -c:v libx264 -crf 18 -preset slow -c:a aac -b:a 192k -movflags +faststart -y ${outputPath}`;

    console.log(`\n✅ Conversion complete!`);
    console.log(`   Output file: ${outputPath}`);
  } catch (error) {
    console.error(`\n❌ Error during conversion:`, error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
Usage: bun scripts/webm-2-mp4.ts <input.webm> [output.mp4]

Convert a WebM file to MP4 format.

Arguments:
  input.webm   Path to the input WebM file (required)
  output.mp4   Path to the output MP4 file (optional, defaults to same name as input)

Examples:
  bun scripts/webm-2-mp4.ts video.webm
  bun scripts/webm-2-mp4.ts input.webm output.mp4
  bun scripts/webm-2-mp4.ts 001_under_the_sun/videos/fragment.webm
`);
  process.exit(0);
}

const inputPath = args[0];
const outputPath = args[1];

convertWebmToMp4(inputPath!, outputPath!);

