import { S3Client } from "@aws-sdk/client-s3";
import type { AudioStorageConfig } from "../config";
import type { AudioStore } from "../domain";
import { createLocalAudioStore } from "./local-audio-store";
import {
  createR2AudioStore,
  type R2ObjectClient,
} from "./r2-audio-store";

export function createConfiguredAudioStore(
  config: AudioStorageConfig,
  apiPublicBaseUrl: string,
  r2Client?: R2ObjectClient,
): AudioStore {
  if (config.driver === "local") {
    return createLocalAudioStore(config.storageDir, apiPublicBaseUrl);
  }

  const client =
    r2Client ??
    (new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    }) as unknown as R2ObjectClient);

  return createR2AudioStore({
    client,
    bucket: config.bucket,
    publicBaseUrl: config.publicBaseUrl,
  });
}
