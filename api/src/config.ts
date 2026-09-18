export type AudioStorageConfig =
  | { driver: "local"; storageDir: string }
  | {
      driver: "r2";
      accountId: string;
      accessKeyId: string;
      secretAccessKey: string;
      bucket: string;
      publicBaseUrl: string;
    };

export type AppConfig = {
  apiKey: string;
  moderationApiKey: string;
  port: number;
  databaseUrl: string;
  audioStorage: AudioStorageConfig;
  publicBaseUrl: string;
  allowedOrigin: string;
  rateLimitSecret: string;
  rateLimitCooldownSeconds: number;
  rateLimitPerIpDaily: number;
  rateLimitGlobalDaily: number;
  rateLimitConcurrency: number;
  idleTimeoutSeconds: number;
};

function requiredSetting(
  env: Record<string, string | undefined>,
  name: string,
): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function databaseSetting(env: Record<string, string | undefined>): string {
  const value = requiredSetting(env, "DATABASE_URL");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
  }
  return value;
}

function publicUrlSetting(
  env: Record<string, string | undefined>,
  name: string,
): string {
  const value = requiredSetting(env, name);
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    return value.replace(/\/+$/u, "");
  } catch {
    throw new Error(`${name} must be a valid HTTP URL`);
  }
}

function audioStorageSetting(
  env: Record<string, string | undefined>,
): AudioStorageConfig {
  const driver = requiredSetting(env, "AUDIO_STORAGE_DRIVER");
  if (driver === "local") {
    return {
      driver,
      storageDir: env.STORAGE_DIR?.trim() || "./storage",
    };
  }
  if (driver === "r2") {
    return {
      driver,
      accountId: requiredSetting(env, "R2_ACCOUNT_ID"),
      accessKeyId: requiredSetting(env, "R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredSetting(env, "R2_SECRET_ACCESS_KEY"),
      bucket: requiredSetting(env, "R2_BUCKET"),
      publicBaseUrl: publicUrlSetting(env, "R2_PUBLIC_BASE_URL"),
    };
  }
  throw new Error("AUDIO_STORAGE_DRIVER must be either local or r2");
}

function integerSetting(
  env: Record<string, string | undefined>,
  name: string,
  fallback: number,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const value = Number(env[name] ?? fallback);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `${name} must be an integer between ${minimum} and ${maximum}`,
    );
  }
  return value;
}

export function readConfig(
  env: Record<string, string | undefined> = Bun.env,
): AppConfig {
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  return {
    apiKey: env.ELEVENLABS_API_KEY?.trim() ?? "",
    moderationApiKey: requiredSetting(env, "OPENAI_API_KEY"),
    port,
    databaseUrl: databaseSetting(env),
    audioStorage: audioStorageSetting(env),
    publicBaseUrl:
      env.PUBLIC_BASE_URL?.trim() || `http://localhost:${port}`,
    allowedOrigin:
      env.ALLOWED_ORIGIN?.trim() || "http://localhost:4321",
    rateLimitSecret:
      env.RATE_LIMIT_SECRET?.trim() ||
      env.ELEVENLABS_API_KEY?.trim() ||
      "local-development-only",
    rateLimitCooldownSeconds: integerSetting(
      env,
      "RATE_LIMIT_COOLDOWN_SECONDS",
      600,
      0,
    ),
    rateLimitPerIpDaily: integerSetting(
      env,
      "RATE_LIMIT_PER_IP_DAILY",
      3,
      1,
    ),
    rateLimitGlobalDaily: integerSetting(
      env,
      "RATE_LIMIT_GLOBAL_DAILY",
      20,
      1,
    ),
    rateLimitConcurrency: integerSetting(
      env,
      "RATE_LIMIT_CONCURRENCY",
      1,
      1,
    ),
    idleTimeoutSeconds: integerSetting(
      env,
      "SERVER_IDLE_TIMEOUT_SECONDS",
      120,
      1,
      255,
    ),
  };
}
