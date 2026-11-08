import { fal } from "@fal-ai/client";
import { exponentialBackoff } from "./exponentialBackoff";

const TRANSIENT_ERROR_CODES = [
  "ECONNRESET",
  "ECONNABORTED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "EAI_AGAIN"
];

function shouldRetry(err: any): boolean {
  if (TRANSIENT_ERROR_CODES.includes(err?.code)) {
    return true;
  }
  const status = err?.response?.status;
  return typeof status === "number" && status >= 500 && status < 600;
}

export async function uploadToFal(file: File, maxAttempts = 2): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fal.storage.upload(file);
    } catch (err: any) {
      const info = err?.response
        ? {
            type: err.response.data?.type,
            status: err.response.status,
            message: err.message,
          }
        : err;

      if (attempt < maxAttempts - 1 && shouldRetry(err)) {
        await exponentialBackoff(attempt);
        continue;
      }

      throw new Error(JSON.stringify(info));
    }
  }

  throw new Error("Failed to upload image to Fal storage");
}
