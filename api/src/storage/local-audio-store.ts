import { mkdir, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import {
  AppFailure,
  type AudioStore,
  type GeneratedAudio,
} from "../domain";

const AUDIO_ID = /^[a-f0-9]{64}$/;

export function createLocalAudioStore(
  storageDir: string,
  publicBaseUrl: string,
): AudioStore {
  const baseUrl = publicBaseUrl.replace(/\/+$/u, "");

  function validateId(id: string): void {
    if (!AUDIO_ID.test(id)) {
      throw new AppFailure("storage_failure", "Invalid audio identifier");
    }
  }

  function pathFor(id: string): string {
    validateId(id);
    return join(storageDir, `${id}.mp3`);
  }

  return {
    async has(id) {
      try {
        return await Bun.file(pathFor(id)).exists();
      } catch (error) {
        if (error instanceof AppFailure) throw error;
        throw new AppFailure("storage_failure", "Could not inspect audio storage", {
          cause: error,
        });
      }
    },

    async read(id) {
      try {
        const file = Bun.file(pathFor(id));
        if (!(await file.exists())) return null;
        return {
          bytes: new Uint8Array(await file.arrayBuffer()),
          contentType: "audio/mpeg",
        };
      } catch (error) {
        if (error instanceof AppFailure) throw error;
        throw new AppFailure("storage_failure", "Could not read audio storage", {
          cause: error,
        });
      }
    },

    async write(id, audio: GeneratedAudio) {
      const destination = pathFor(id);
      const temporary = `${destination}.${crypto.randomUUID()}.tmp`;
      try {
        await mkdir(storageDir, { recursive: true });
        await Bun.write(temporary, audio.bytes);
        await rename(temporary, destination);
      } catch (error) {
        await unlink(temporary).catch(() => undefined);
        throw new AppFailure("storage_failure", "Could not persist generated audio", {
          cause: error,
        });
      }
    },

    publicUrl(id) {
      validateId(id);
      return `${baseUrl}/v1/audio/${id}`;
    },
  };
}
