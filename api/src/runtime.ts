import { createApp } from "./app";
import type { AppConfig } from "./config";
import { createDatabase } from "./db/client";
import { createElevenLabsProvider } from "./music/elevenlabs";
import { createOpenAIThoughtModerator } from "./moderation/openai";
import { createPostgresGenerationLimiter } from "./rate-limit";
import { createConfiguredAudioStore } from "./storage/audio-store";
import { createPostgresResultStore } from "./storage/postgres-result-store";

export async function createRuntime(config: AppConfig) {
  const database = createDatabase(config.databaseUrl);
  try {
    await database.check();
    const audio = createConfiguredAudioStore(
      config.audioStorage,
      config.publicBaseUrl,
    );
    const app = createApp({
      moderator: createOpenAIThoughtModerator({
        apiKey: config.moderationApiKey,
      }),
      provider: createElevenLabsProvider({ apiKey: config.apiKey }),
      audio,
      results: createPostgresResultStore(database.db),
      limiter: createPostgresGenerationLimiter(database.db, {
        secret: config.rateLimitSecret,
        cooldownSeconds: config.rateLimitCooldownSeconds,
        perClientDailyLimit: config.rateLimitPerIpDaily,
        globalDailyLimit: config.rateLimitGlobalDaily,
        concurrencyLimit: config.rateLimitConcurrency,
      }),
      allowedOrigin: config.allowedOrigin,
      logError: (entry) => console.error(JSON.stringify(entry)),
    });
    return { app, database };
  } catch (error) {
    await database.close().catch(() => undefined);
    throw error;
  }
}
