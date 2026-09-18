export type GeneratedAudio = {
  bytes: Uint8Array<ArrayBuffer>;
  contentType: "audio/mpeg";
};

export interface MusicProvider {
  generate(prompt: string): Promise<GeneratedAudio>;
}

export interface ThoughtModerator {
  assertAllowed(thought: string): Promise<void>;
}

export interface AudioStore {
  has(id: string): Promise<boolean>;
  read(id: string): Promise<GeneratedAudio | null>;
  write(id: string, audio: GeneratedAudio): Promise<void>;
  publicUrl(id: string): string;
}

export type PublicResult = {
  id: string;
  thought: string;
  createdAt: string;
};

export type PublicResultPage = {
  items: PublicResult[];
  nextCursor: string | null;
};

export interface PublicResultStore {
  read(id: string): Promise<PublicResult | null>;
  createIfAbsent(result: PublicResult): Promise<PublicResult>;
  list(options: {
    limit: number;
    cursor?: string;
  }): Promise<PublicResultPage>;
}

export type FailureCode =
  | "invalid_provider_response"
  | "provider_configuration_error"
  | "provider_authentication_failed"
  | "provider_quota_exceeded"
  | "provider_payment_required"
  | "provider_access_denied"
  | "provider_request_rejected"
  | "provider_rate_limited"
  | "thought_not_allowed"
  | "moderation_unavailable"
  | "generation_rate_limited"
  | "generation_ip_limit_reached"
  | "generation_daily_limit_reached"
  | "generation_capacity_reached"
  | "provider_unavailable"
  | "generation_timeout"
  | "invalid_gallery_cursor"
  | "storage_failure";

export class AppFailure extends Error {
  constructor(
    readonly code: FailureCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AppFailure";
  }
}
