import { describe, expect, test } from "bun:test";
import { createConfiguredAudioStore } from "../src/storage/audio-store";

describe("configured audio store", () => {
  test("selects local files with the API compatibility URL", () => {
    const store = createConfiguredAudioStore(
      { driver: "local", storageDir: "./storage" },
      "https://api.numa.channel/",
    );

    expect(store.publicUrl("a".repeat(64))).toBe(
      `https://api.numa.channel/v1/audio/${"a".repeat(64)}`,
    );
  });

  test("selects R2 with its direct public media URL", () => {
    const store = createConfiguredAudioStore(
      {
        driver: "r2",
        accountId: "account-id",
        accessKeyId: "access-key",
        secretAccessKey: "secret-key",
        bucket: "numa-sounds",
        publicBaseUrl: "https://media.numa.channel",
      },
      "https://api.numa.channel",
      { send: async () => ({}) },
    );

    expect(store.publicUrl("b".repeat(64))).toBe(
      `https://media.numa.channel/${"b".repeat(64)}.mp3`,
    );
  });
});
