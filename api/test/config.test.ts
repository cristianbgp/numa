import { describe, expect, test } from "bun:test";
import { readConfig } from "../src/config";

const localEnvironment = {
  DATABASE_URL: "postgresql://numa:numa@localhost:5432/numa",
  AUDIO_STORAGE_DRIVER: "local",
  OPENAI_API_KEY: "moderation-secret",
};

describe("API configuration", () => {
  test("uses conservative public generation limits by default", () => {
    const config = readConfig({
      ...localEnvironment,
      ELEVENLABS_API_KEY: "provider-secret",
    });

    expect(config.databaseUrl).toBe(localEnvironment.DATABASE_URL);
    expect(config.moderationApiKey).toBe("moderation-secret");
    expect(config.audioStorage).toEqual({
      driver: "local",
      storageDir: "./storage",
    });
    expect(config.rateLimitSecret).toBe("provider-secret");
    expect(config.rateLimitCooldownSeconds).toBe(600);
    expect(config.rateLimitPerIpDaily).toBe(3);
    expect(config.rateLimitGlobalDaily).toBe(20);
    expect(config.rateLimitConcurrency).toBe(1);
    expect(config.idleTimeoutSeconds).toBe(120);
  });

  test("accepts explicit production limit overrides", () => {
    const config = readConfig({
      ...localEnvironment,
      RATE_LIMIT_SECRET: "separate-secret",
      RATE_LIMIT_COOLDOWN_SECONDS: "300",
      RATE_LIMIT_PER_IP_DAILY: "4",
      RATE_LIMIT_GLOBAL_DAILY: "12",
      RATE_LIMIT_CONCURRENCY: "2",
      SERVER_IDLE_TIMEOUT_SECONDS: "90",
    });

    expect(config.rateLimitSecret).toBe("separate-secret");
    expect(config.rateLimitCooldownSeconds).toBe(300);
    expect(config.rateLimitPerIpDaily).toBe(4);
    expect(config.rateLimitGlobalDaily).toBe(12);
    expect(config.rateLimitConcurrency).toBe(2);
    expect(config.idleTimeoutSeconds).toBe(90);
  });

  test.each([
    ["RATE_LIMIT_COOLDOWN_SECONDS", "-1"],
    ["RATE_LIMIT_PER_IP_DAILY", "0"],
    ["RATE_LIMIT_GLOBAL_DAILY", "2.5"],
    ["RATE_LIMIT_CONCURRENCY", "0"],
    ["SERVER_IDLE_TIMEOUT_SECONDS", "256"],
  ])("rejects invalid %s", (name, value) => {
    expect(() => readConfig({ ...localEnvironment, [name]: value })).toThrow(
      name,
    );
  });

  test("requires an explicit PostgreSQL connection", () => {
    expect(() =>
      readConfig({
        AUDIO_STORAGE_DRIVER: "local",
        OPENAI_API_KEY: "moderation-secret",
      }),
    ).toThrow("DATABASE_URL");
  });

  test("requires an explicit audio storage driver", () => {
    expect(() =>
      readConfig({
        DATABASE_URL: localEnvironment.DATABASE_URL,
        OPENAI_API_KEY: "moderation-secret",
      }),
    ).toThrow("AUDIO_STORAGE_DRIVER");
  });

  test("requires an OpenAI key for public thought moderation", () => {
    expect(() =>
      readConfig({ ...localEnvironment, OPENAI_API_KEY: undefined }),
    ).toThrow("OPENAI_API_KEY");
  });

  test("accepts complete R2 storage configuration", () => {
    const config = readConfig({
      DATABASE_URL: localEnvironment.DATABASE_URL,
      AUDIO_STORAGE_DRIVER: "r2",
      OPENAI_API_KEY: "moderation-secret",
      R2_ACCOUNT_ID: "account-id",
      R2_ACCESS_KEY_ID: "access-key",
      R2_SECRET_ACCESS_KEY: "secret-key",
      R2_BUCKET: "numa-sounds",
      R2_PUBLIC_BASE_URL: "https://media.numa.channel/",
    });

    expect(config.audioStorage).toEqual({
      driver: "r2",
      accountId: "account-id",
      accessKeyId: "access-key",
      secretAccessKey: "secret-key",
      bucket: "numa-sounds",
      publicBaseUrl: "https://media.numa.channel",
    });
  });

  test.each([
    ["unknown audio driver", { AUDIO_STORAGE_DRIVER: "filesystem" }, "AUDIO_STORAGE_DRIVER"],
    ["missing account ID", { AUDIO_STORAGE_DRIVER: "r2" }, "R2_ACCOUNT_ID"],
    [
      "invalid public URL",
      {
        AUDIO_STORAGE_DRIVER: "r2",
        R2_ACCOUNT_ID: "account-id",
        R2_ACCESS_KEY_ID: "access-key",
        R2_SECRET_ACCESS_KEY: "secret-key",
        R2_BUCKET: "numa-sounds",
        R2_PUBLIC_BASE_URL: "not-a-url",
      },
      "R2_PUBLIC_BASE_URL",
    ],
  ])("rejects %s", (_name, overrides, message) => {
    expect(() =>
      readConfig({
        DATABASE_URL: localEnvironment.DATABASE_URL,
        OPENAI_API_KEY: "moderation-secret",
        ...overrides,
      }),
    ).toThrow(message);
  });
});
