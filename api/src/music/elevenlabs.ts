import { AppFailure, type FailureCode, type MusicProvider } from "../domain";
import { GENERATION_SETTINGS } from "./numa-style";

export type ElevenLabsOptions = {
  apiKey: string;
  fetch?: Fetcher;
  timeoutMs?: number;
  endpoint?: string;
};

export type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

const FAILURE_CODE_BY_PROVIDER_STATUS: Record<string, FailureCode> = {
  quota_exceeded: "provider_quota_exceeded",
  payment_required: "provider_payment_required",
  invalid_api_key: "provider_authentication_failed",
  missing_api_key: "provider_authentication_failed",
  authentication_error: "provider_authentication_failed",
  missing_permissions: "provider_access_denied",
  authorization_error: "provider_access_denied",
};

async function providerFailureCode(
  response: Response,
): Promise<FailureCode | undefined> {
  if (!response.headers.get("content-type")?.includes("application/json")) {
    return undefined;
  }

  try {
    const body = (await response.json()) as {
      detail?: { status?: unknown; code?: unknown };
    };
    const providerStatus =
      typeof body.detail?.status === "string"
        ? body.detail.status
        : typeof body.detail?.code === "string"
          ? body.detail.code
          : undefined;
    return providerStatus
      ? FAILURE_CODE_BY_PROVIDER_STATUS[providerStatus]
      : undefined;
  } catch {
    return undefined;
  }
}

export function createElevenLabsProvider(
  options: ElevenLabsOptions,
): MusicProvider {
  const request: Fetcher = options.fetch ?? globalThis.fetch;
  const endpoint = new URL(
    options.endpoint ?? "https://api.elevenlabs.io/v1/music",
  );
  endpoint.searchParams.set("output_format", GENERATION_SETTINGS.outputFormat);
  const timeoutMs = options.timeoutMs ?? 120_000;

  return {
    async generate(prompt) {
      if (!options.apiKey) {
        throw new AppFailure(
          "provider_configuration_error",
          "Music generation is not configured",
        );
      }

      let response: Response;
      try {
        response = await request(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "xi-api-key": options.apiKey,
          },
          body: JSON.stringify({
            prompt,
            model_id: GENERATION_SETTINGS.modelId,
            music_length_ms: GENERATION_SETTINGS.musicLengthMs,
            force_instrumental: GENERATION_SETTINGS.forceInstrumental,
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        if (
          error instanceof DOMException &&
          (error.name === "AbortError" || error.name === "TimeoutError")
        ) {
          throw new AppFailure(
            "generation_timeout",
            "Music generation timed out",
            { cause: error },
          );
        }
        throw new AppFailure(
          "provider_unavailable",
          "Music provider is unavailable",
          { cause: error },
        );
      }

      if (!response.ok) {
        const code =
          (await providerFailureCode(response)) ??
          (response.status === 401
            ? "provider_authentication_failed"
            : response.status === 402
              ? "provider_payment_required"
              : response.status === 403
                ? "provider_access_denied"
                : response.status === 408
                  ? "generation_timeout"
                  : response.status === 429
                    ? "provider_rate_limited"
                    : response.status >= 500
                      ? "provider_unavailable"
                      : "provider_request_rejected");
        throw new AppFailure(code, `Music provider rejected the request (${response.status})`);
      }
      if (
        !response.headers.get("content-type")?.toLowerCase().startsWith("audio/")
      ) {
        throw new AppFailure(
          "invalid_provider_response",
          "Music provider returned invalid audio",
        );
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength === 0) {
        throw new AppFailure(
          "invalid_provider_response",
          "Music provider returned empty audio",
        );
      }

      return { bytes, contentType: "audio/mpeg" };
    },
  };
}
