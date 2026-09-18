import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import {
  AppFailure,
  type AudioStore,
  type MusicProvider,
  type PublicResultStore,
  type ThoughtModerator,
} from "./domain";
import { createMusicGenerator } from "./music/generate";
import { normalizeThought } from "./music/numa-style";
import type { GenerationLimiter } from "./rate-limit";

export type AppDependencies = {
  moderator: ThoughtModerator;
  provider: MusicProvider;
  audio: AudioStore;
  results: PublicResultStore;
  limiter?: GenerationLimiter;
  allowedOrigin?: string;
  logError?: (entry: { code: string; message: string }) => void;
  now?: () => Date;
};

const ErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

const ThoughtSchema = z.object({
  thought: z.string().trim().min(1).max(240),
});

const GenerationSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{64}$/),
  thought: z.string(),
  audioUrl: z.string().url(),
  createdAt: z.string().datetime(),
  cached: z.boolean(),
});

const PublicResultSchema = GenerationSchema.omit({ cached: true });

const GalleryPageSchema = z.object({
  items: z.array(PublicResultSchema),
  nextCursor: z.string().nullable(),
});

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ status: z.literal("ok") }),
        },
      },
      description: "Service is healthy",
    },
  },
});

const generationRoute = createRoute({
  method: "post",
  path: "/v1/how-it-sounds",
  request: {
    body: {
      required: true,
      content: {
        "application/json": { schema: ThoughtSchema },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: GenerationSchema } },
      description: "Canonical generated audio",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Invalid thought",
    },
    402: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Provider payment or credits required",
    },
    403: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Provider access denied",
    },
    422: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Thought moderation or provider rejected the request",
    },
    429: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Provider rate or concurrency limit reached",
    },
    500: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Storage or internal failure",
    },
    502: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Invalid provider response",
    },
    503: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Moderation or generation unavailable",
    },
    504: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Generation timed out",
    },
  },
});

const galleryRoute = createRoute({
  method: "get",
  path: "/v1/how-it-sounds",
  request: {
    query: z.object({
      limit: z.coerce.number().int().min(1).max(24).default(12),
      cursor: z.string().min(1).optional(),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: GalleryPageSchema } },
      description: "Public generated sounds ordered newest first",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Invalid gallery pagination",
    },
    500: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Storage failure",
    },
  },
});

const audioRoute = createRoute({
  method: "get",
  path: "/v1/audio/{id}",
  request: {
    params: z.object({
      id: z.string().openapi({
        pattern: "^[a-f0-9]{64}$",
        example: "a".repeat(64),
      }),
    }),
  },
  responses: {
    200: {
      content: {
        "audio/mpeg": {
          schema: z.string().openapi({ format: "binary" }),
        },
      },
      description: "Generated MP3",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Audio not found",
    },
    500: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Storage failure",
    },
  },
});

const publicResultRoute = createRoute({
  method: "get",
  path: "/v1/how-it-sounds/{id}",
  request: {
    params: z.object({
      id: z.string().openapi({
        pattern: "^[a-f0-9]{64}$",
        example: "a".repeat(64),
      }),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: PublicResultSchema } },
      description: "Public generated result",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Result not found",
    },
    500: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Storage failure",
    },
  },
});

const AUDIO_ID = /^[a-f0-9]{64}$/;
const INVALID_THOUGHT = {
  error: {
    code: "invalid_thought",
    message: "Thought must contain between 1 and 240 characters.",
  },
} as const;
const INVALID_GALLERY_REQUEST = {
  error: {
    code: "invalid_gallery_request",
    message: "Gallery pagination is invalid.",
  },
} as const;
const AUDIO_NOT_FOUND = {
  error: {
    code: "audio_not_found",
    message: "Audio was not found.",
  },
} as const;
const RESULT_NOT_FOUND = {
  error: {
    code: "result_not_found",
    message: "This sound was not found.",
  },
} as const;

function clientAddress(headers: Headers): string {
  const cloudflareAddress = headers.get("cf-connecting-ip")?.trim();
  if (cloudflareAddress) return cloudflareAddress;

  const forwardedAddress = headers
    .get("x-forwarded-for")
    ?.split(",", 1)[0]
    ?.trim();
  return forwardedAddress || "unknown";
}

export function createApp(dependencies: AppDependencies) {
  const app = new OpenAPIHono({
    defaultHook: (result, context) => {
      if (!result.success) {
        return context.json(
          context.req.method === "GET" &&
            context.req.path === "/v1/how-it-sounds"
            ? INVALID_GALLERY_REQUEST
            : INVALID_THOUGHT,
          400,
        );
      }
    },
  });
  const generate = createMusicGenerator(dependencies);
  const now = dependencies.now ?? (() => new Date());

  if (dependencies.allowedOrigin) {
    const allowedOrigin = dependencies.allowedOrigin;
    app.use(
      "/v1/*",
      cors({
        origin: (origin) => (origin === allowedOrigin ? origin : undefined),
      }),
    );
  }

  app.openapi(healthRoute, (context) =>
    context.json({ status: "ok" as const }, 200),
  );

  app.openapi(galleryRoute, async (context) => {
    const { limit, cursor } = context.req.valid("query");
    const page = await dependencies.results.list({ limit, cursor });
    return context.json(
      {
        items: page.items.map((result) => ({
          ...result,
          audioUrl: dependencies.audio.publicUrl(result.id),
        })),
        nextCursor: page.nextCursor,
      },
      200,
    );
  });

  app.openapi(generationRoute, async (context) => {
    const { thought } = context.req.valid("json");
    await dependencies.moderator.assertAllowed(thought);
    const generation = await generate(thought, clientAddress(context.req.raw.headers));
    const result = await dependencies.results.createIfAbsent({
      id: generation.id,
      thought: normalizeThought(thought),
      createdAt: now().toISOString(),
    });
    return context.json(
      {
        ...result,
        audioUrl: dependencies.audio.publicUrl(result.id),
        cached: generation.cached,
      },
      200,
    );
  });

  app.openapi(publicResultRoute, async (context) => {
    const { id } = context.req.valid("param");
    if (!AUDIO_ID.test(id)) return context.json(RESULT_NOT_FOUND, 404);

    const result = await dependencies.results.read(id);
    if (!result) return context.json(RESULT_NOT_FOUND, 404);

    return context.json(
      {
        ...result,
        audioUrl: dependencies.audio.publicUrl(result.id),
      },
      200,
    );
  });

  app.openapi(audioRoute, async (context) => {
    const { id } = context.req.valid("param");
    if (!AUDIO_ID.test(id)) return context.json(AUDIO_NOT_FOUND, 404);

    const audio = await dependencies.audio.read(id);
    if (!audio) return context.json(AUDIO_NOT_FOUND, 404);

    return context.body(audio.bytes, 200, {
      "Content-Type": "audio/mpeg",
      ETag: `"${id}"`,
      "Cache-Control": "public, max-age=31536000, immutable",
    });
  });

  app.onError((error, context) => {
    if (error instanceof HTTPException && error.status === 400) {
      return context.json(INVALID_THOUGHT, 400);
    }

    if (error instanceof AppFailure) {
      if (error.code === "invalid_gallery_cursor") {
        dependencies.logError?.({ code: error.code, message: error.message });
        return context.json(INVALID_GALLERY_REQUEST, 400);
      }
      const statusByCode = {
        invalid_provider_response: 502,
        provider_configuration_error: 503,
        provider_authentication_failed: 502,
        provider_quota_exceeded: 402,
        provider_payment_required: 402,
        provider_access_denied: 403,
        provider_request_rejected: 422,
        provider_rate_limited: 429,
        thought_not_allowed: 422,
        moderation_unavailable: 503,
        generation_rate_limited: 429,
        generation_ip_limit_reached: 429,
        generation_daily_limit_reached: 429,
        generation_capacity_reached: 429,
        provider_unavailable: 503,
        generation_timeout: 504,
        storage_failure: 500,
      } as const;
      const messageByCode = {
        invalid_provider_response: "Music provider returned invalid audio.",
        provider_configuration_error: "Music generation is not configured.",
        provider_authentication_failed:
          "ElevenLabs rejected the configured API key.",
        provider_quota_exceeded:
          "The ElevenLabs API key has exhausted its configured credit quota.",
        provider_payment_required:
          "ElevenLabs requires payment or available credits for this request.",
        provider_access_denied:
          "This API key does not have access to ElevenLabs Music. A paid plan and Music permission are required.",
        provider_request_rejected:
          "ElevenLabs rejected this music generation request.",
        provider_rate_limited:
          "ElevenLabs rate or concurrency limit reached. Try again later.",
        thought_not_allowed:
          "That thought cannot be published. Try expressing it another way.",
        moderation_unavailable:
          "Thought review is temporarily unavailable. Try again shortly.",
        generation_rate_limited:
          "You can create another sound in a few minutes.",
        generation_ip_limit_reached:
          "You have reached today's public generation limit. Try again tomorrow.",
        generation_daily_limit_reached:
          "Numa has reached today's public generation limit. Try again tomorrow.",
        generation_capacity_reached:
          "Numa is creating another sound. Try again shortly.",
        provider_unavailable: "ElevenLabs is temporarily unavailable.",
        generation_timeout: "Music generation timed out.",
        storage_failure: "Audio storage is unavailable.",
      } as const;
      dependencies.logError?.({ code: error.code, message: error.message });
      return context.json(
        { error: { code: error.code, message: messageByCode[error.code] } },
        statusByCode[error.code],
      );
    }

    dependencies.logError?.({ code: "internal_error", message: error.message });
    return context.json(
      {
        error: {
          code: "internal_error",
          message: "An internal error occurred.",
        },
      },
      500,
    );
  });

  app.doc("/openapi.json", {
    openapi: "3.0.0",
    info: { title: "numa api", version: "0.1.0" },
  });
  app.get("/docs", swaggerUI({ url: "/openapi.json" }));

  return app;
}
