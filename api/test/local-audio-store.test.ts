import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLocalAudioStore } from "../src/storage/local-audio-store";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("local audio store", () => {
  test("stores, reads, and exposes an MP3 by validated hash", async () => {
    const directory = await mkdtemp(join(tmpdir(), "numa-audio-"));
    directories.push(directory);
    const store = createLocalAudioStore(directory, "http://localhost:3000/");
    const id = "a".repeat(64);
    const audio = {
      bytes: new Uint8Array([73, 68, 51]),
      contentType: "audio/mpeg" as const,
    };

    expect(await store.has(id)).toBe(false);
    await store.write(id, audio);
    expect(await store.has(id)).toBe(true);
    expect(await store.read(id)).toEqual(audio);
    expect(store.publicUrl(id)).toBe(`http://localhost:3000/v1/audio/${id}`);
    expect(await readdir(directory)).toEqual([`${id}.mp3`]);
  });

  test("rejects identifiers that could escape the storage directory", async () => {
    const directory = await mkdtemp(join(tmpdir(), "numa-audio-"));
    directories.push(directory);
    const store = createLocalAudioStore(directory, "http://localhost:3000");

    await expect(store.read("../secret")).rejects.toMatchObject({
      code: "storage_failure",
    });
    expect(() => store.publicUrl("../secret")).toThrow();
  });

  test("does not leave temporary files after a failed write", async () => {
    const directory = await mkdtemp(join(tmpdir(), "numa-audio-"));
    directories.push(directory);
    const blocker = join(directory, "blocker");
    await writeFile(blocker, "not a directory");
    const store = createLocalAudioStore(
      join(blocker, "storage"),
      "http://localhost:3000",
    );

    await expect(
      store.write("b".repeat(64), {
        bytes: new Uint8Array([73, 68, 51]),
        contentType: "audio/mpeg",
      }),
    ).rejects.toMatchObject({ code: "storage_failure" });
    expect(await readdir(directory)).toEqual(["blocker"]);
  });
});
