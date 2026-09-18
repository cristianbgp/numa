import { describe, expect, test } from "bun:test";
import {
  createElevenLabsProvider,
  type Fetcher,
} from "../src/music/elevenlabs";

describe("ElevenLabs provider", () => {
  test("sends fixed Music settings and returns MP3 bytes", async () => {
    let captured: { url?: string; init?: RequestInit } = {};
    const fakeFetch: Fetcher = async (input, init) => {
      captured = { url: String(input), init };
      return new Response(new Uint8Array([73, 68, 51]), {
        status: 200,
        headers: { "content-type": "audio/mpeg" },
      });
    };
    const provider = createElevenLabsProvider({
      apiKey: "test-key",
      fetch: fakeFetch,
    });

    const audio = await provider.generate("quiet prompt");
    const body = JSON.parse(String(captured.init?.body));
    expect(captured.url).toBe(
      "https://api.elevenlabs.io/v1/music?output_format=auto",
    );
    expect(new Headers(captured.init?.headers).get("xi-api-key")).toBe(
      "test-key",
    );
    expect(body).toEqual({
      prompt: "quiet prompt",
      model_id: "music_v2_5",
      music_length_ms: 12_000,
      force_instrumental: true,
    });
    expect(audio).toEqual({
      bytes: new Uint8Array([73, 68, 51]),
      contentType: "audio/mpeg",
    });
  });

  test.each([
    [401, "provider_authentication_failed"],
    [402, "provider_payment_required"],
    [403, "provider_access_denied"],
    [422, "provider_request_rejected"],
    [429, "provider_rate_limited"],
    [500, "provider_unavailable"],
    [503, "provider_unavailable"],
  ] as const)("maps upstream status %d to %s", async (status, code) => {
    const provider = createElevenLabsProvider({
      apiKey: "test-key",
      fetch: async () =>
        new Response(
          JSON.stringify({
            detail: {
              code: "provider-secret-code",
              message: "provider secret body",
            },
          }),
          { status, headers: { "content-type": "application/json" } },
        ),
    });

    try {
      await provider.generate("prompt");
      throw new Error("Expected provider generation to fail");
    } catch (error) {
      expect(error).toMatchObject({ code });
      expect(String(error)).not.toContain("test-key");
      expect(String(error)).not.toContain("provider secret body");
    }
  });

  test.each([
    ["quota_exceeded", "provider_quota_exceeded"],
    ["missing_permissions", "provider_access_denied"],
    ["authorization_error", "provider_access_denied"],
    ["invalid_api_key", "provider_authentication_failed"],
    ["missing_api_key", "provider_authentication_failed"],
    ["authentication_error", "provider_authentication_failed"],
    ["payment_required", "provider_payment_required"],
  ] as const)(
    "uses ElevenLabs error status %s instead of the HTTP fallback",
    async (providerStatus, code) => {
      const provider = createElevenLabsProvider({
        apiKey: "test-key",
        fetch: async () =>
          Response.json(
            {
              detail: {
                status: providerStatus,
                message: "private provider detail",
              },
            },
            { status: 401 },
          ),
      });

      try {
        await provider.generate("private prompt");
        throw new Error("Expected provider generation to fail");
      } catch (error) {
        expect(error).toMatchObject({ code });
        expect(String(error)).not.toContain("private provider detail");
        expect(String(error)).not.toContain("private prompt");
        expect(String(error)).not.toContain("test-key");
      }
    },
  );

  test("reads the provider error code when status is absent", async () => {
    const provider = createElevenLabsProvider({
      apiKey: "test-key",
      fetch: async () =>
        Response.json(
          {
            detail: {
              code: "quota_exceeded",
              message: "private provider detail",
            },
          },
          { status: 401 },
        ),
    });

    await expect(provider.generate("prompt")).rejects.toMatchObject({
      code: "provider_quota_exceeded",
    });
  });

  test.each([
    new Response("provider secret body", {
      status: 200,
      headers: { "content-type": "text/plain" },
    }),
    new Response(new Uint8Array(), {
      status: 200,
      headers: { "content-type": "audio/mpeg" },
    }),
  ])("rejects a successful response without usable audio", async (response) => {
    const provider = createElevenLabsProvider({
      apiKey: "test-key",
      fetch: async () => response,
    });

    await expect(provider.generate("prompt")).rejects.toMatchObject({
      code: "invalid_provider_response",
    });
  });

  test("maps request timeouts without leaking credentials", async () => {
    const provider = createElevenLabsProvider({
      apiKey: "secret-key",
      fetch: async () => {
        throw new DOMException("request aborted", "AbortError");
      },
      timeoutMs: 1,
    });

    try {
      await provider.generate("prompt");
      throw new Error("Expected provider generation to fail");
    } catch (error) {
      expect(error).toMatchObject({ code: "generation_timeout" });
      expect(String(error)).not.toContain("secret-key");
    }
  });

  test("maps a network failure separately from a timeout", async () => {
    const provider = createElevenLabsProvider({
      apiKey: "secret-key",
      fetch: async () => {
        throw new TypeError("network unavailable");
      },
    });

    await expect(provider.generate("prompt")).rejects.toMatchObject({
      code: "provider_unavailable",
    });
  });

  test("rejects generation when no API key is configured", async () => {
    let called = false;
    const provider = createElevenLabsProvider({
      apiKey: "",
      fetch: async () => {
        called = true;
        return new Response();
      },
    });

    await expect(provider.generate("prompt")).rejects.toMatchObject({
      code: "provider_configuration_error",
    });
    expect(called).toBe(false);
  });
});
