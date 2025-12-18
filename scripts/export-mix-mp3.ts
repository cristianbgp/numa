#!/usr/bin/env bun

import { readdirSync, readFileSync, existsSync, mkdirSync, copyFileSync } from "fs";
import { join } from "path";

interface MixMetadata {
  id: string;
  title: string;
}

function getRootDir() {
  return join(import.meta.dir, "..");
}

function getReleaseDirs(rootDir: string) {
  const entries = readdirSync(rootDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && /^\d{3}_/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function loadMixMetadata(rootDir: string, dir: string): MixMetadata | null {
  const infoPath = join(rootDir, dir, "metadata", "info.json");
  if (!existsSync(infoPath)) {
    console.warn(`⚠️  Skipping ${dir}: no metadata/info.json found`);
    return null;
  }

  try {
    const content = readFileSync(infoPath, "utf-8");
    const data = JSON.parse(content) as MixMetadata;
    return data;
  } catch (err) {
    console.error(`❌ Error reading metadata for ${dir}:`, err);
    return null;
  }
}

function ensureDir(path: string) {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

async function main() {
  const ROOT_DIR = getRootDir();

  // CLI: optional output directory (relative to repo root or absolute)
  const args = process.argv.slice(2);
  const outDirArg = args[0];

  const outputDir = outDirArg
    ? outDirArg.startsWith("/")
      ? outDirArg
      : join(ROOT_DIR, outDirArg)
    : join(ROOT_DIR, "all_mixes_mp3");

  ensureDir(outputDir);

  console.log("📂 Exporting all mix MP3 files to:");
  console.log(`   ${outputDir}\n`);

  const releaseDirs = getReleaseDirs(ROOT_DIR);

  if (releaseDirs.length === 0) {
    console.error("❌ No release directories found");
    process.exit(1);
  }

  let exportedCount = 0;

  for (const dir of releaseDirs) {
    const mixDir = join(ROOT_DIR, dir, "mix");
    if (!existsSync(mixDir)) {
      console.warn(`⚠️  Skipping ${dir}: no mix/ directory found`);
      continue;
    }

    const files = readdirSync(mixDir);
    const mp3Files = files.filter((f) => f.toLowerCase().endsWith(".mp3"));

    if (mp3Files.length === 0) {
      console.warn(`⚠️  Skipping ${dir}: no .mp3 files in mix/`);
      continue;
    }

    // Prefer the standard "<folder>_mix.mp3" file if present
    const expectedName = `${dir}_mix.mp3`;
    const chosenFile =
      mp3Files.find((f) => f === expectedName) ?? mp3Files[0];

    const srcPath = join(mixDir, chosenFile);

    const metadata = loadMixMetadata(ROOT_DIR, dir);
    if (!metadata) {
      console.warn(`⚠️  Skipping ${dir}: could not load mix metadata`);
      continue;
    }

    // Derive slug from folder name (strip numeric prefix)
    const slug = dir.split("_").slice(1).join("_");
    const baseName = `${metadata.id}-${slug}.mp3`;
    const destPath = join(outputDir, baseName);

    copyFileSync(srcPath, destPath);
    exportedCount++;

    console.log(
      `✅ ${metadata.id} — ${metadata.title}\n   ${srcPath}\n   → ${destPath}\n`,
    );
  }

  console.log(`\n📊 Done. Exported ${exportedCount} mix MP3 file(s).`);
}

main().catch((err) => {
  console.error("❌ Error exporting mix MP3 files:", err);
  process.exit(1);
});



