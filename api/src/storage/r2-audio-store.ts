import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { AppFailure, type AudioStore } from "../domain";

const AUDIO_ID = /^[a-f0-9]{64}$/;
const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";

export type R2ObjectClient = {
  send(command: unknown): Promise<unknown>;
};

export type R2AudioStoreOptions = {
  client: R2ObjectClient;
  bucket: string;
  publicBaseUrl: string;
};

function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    candidate.$metadata?.httpStatusCode === 404 ||
    candidate.name === "NotFound" ||
    candidate.name === "NoSuchKey"
  );
}

export function createR2AudioStore(options: R2AudioStoreOptions): AudioStore {
  const baseUrl = options.publicBaseUrl.replace(/\/+$/u, "");

  function keyFor(id: string): string {
    if (!AUDIO_ID.test(id)) {
      throw new AppFailure("storage_failure", "Invalid audio identifier");
    }
    return `${id}.mp3`;
  }

  return {
    async has(id) {
      try {
        await options.client.send(
          new HeadObjectCommand({ Bucket: options.bucket, Key: keyFor(id) }),
        );
        return true;
      } catch (error) {
        if (isNotFound(error)) return false;
        if (error instanceof AppFailure) throw error;
        throw new AppFailure("storage_failure", "Could not inspect audio storage", {
          cause: error,
        });
      }
    },

    async read(id) {
      try {
        const response = (await options.client.send(
          new GetObjectCommand({ Bucket: options.bucket, Key: keyFor(id) }),
        )) as {
          Body?: { transformToByteArray?(): Promise<Uint8Array> } | Uint8Array;
        };
        if (!response.Body) {
          throw new Error("R2 returned an empty object body");
        }
        const bytes =
          response.Body instanceof Uint8Array
            ? response.Body
            : await response.Body.transformToByteArray?.();
        if (!bytes) throw new Error("R2 object body is unreadable");
        return { bytes: new Uint8Array(bytes), contentType: "audio/mpeg" };
      } catch (error) {
        if (isNotFound(error)) return null;
        if (error instanceof AppFailure) throw error;
        throw new AppFailure("storage_failure", "Could not read audio storage", {
          cause: error,
        });
      }
    },

    async write(id, audio) {
      try {
        await options.client.send(
          new PutObjectCommand({
            Bucket: options.bucket,
            Key: keyFor(id),
            Body: audio.bytes,
            ContentType: audio.contentType,
            CacheControl: IMMUTABLE_CACHE,
          }),
        );
      } catch (error) {
        if (error instanceof AppFailure) throw error;
        throw new AppFailure("storage_failure", "Could not persist generated audio", {
          cause: error,
        });
      }
    },

    publicUrl(id) {
      return `${baseUrl}/${keyFor(id)}`;
    },
  };
}
