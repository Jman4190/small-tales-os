export class BodyLimitError extends Error {
  constructor(message: string, public readonly status: 400 | 413) {
    super(message);
    this.name = 'BodyLimitError';
  }
}

/** Read raw bytes without allowing a missing or inaccurate length header to bypass the limit. */
export async function readBoundedRequestBody(request: Request, maxBytes: number): Promise<ArrayBuffer> {
  const lengthHeader = request.headers.get('content-length');
  let declaredLength: number | undefined;
  if (lengthHeader !== null) {
    if (!/^\d+$/.test(lengthHeader)) {
      throw new BodyLimitError('Invalid Content-Length', 400);
    }
    declaredLength = Number(lengthHeader);
    if (declaredLength > maxBytes) {
      throw new BodyLimitError('Request body too large', 413);
    }
  }

  const reader = request.body?.getReader();
  let body = new Uint8Array(Math.min(maxBytes, declaredLength ?? 8192));
  let size = 0;
  if (reader) {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const nextSize = size + value.byteLength;
        if (nextSize > maxBytes) {
          // Stop consuming immediately; cancellation must not hold up the rejection.
          void reader.cancel().catch(() => {});
          throw new BodyLimitError('Request body too large', 413);
        }
        if (nextSize > body.byteLength) {
          const grown = new Uint8Array(Math.min(maxBytes, Math.max(nextSize, body.byteLength * 2)));
          grown.set(body);
          body = grown;
        }
        body.set(value, size);
        size = nextSize;
      }
    } catch (error) {
      if (error instanceof BodyLimitError) throw error;
      throw new BodyLimitError('Could not read request body', 400);
    } finally {
      reader.releaseLock();
    }
  }

  if (declaredLength !== undefined && declaredLength !== size) {
    throw new BodyLimitError('Content-Length does not match request body', 400);
  }

  return body.byteLength === size ? body.buffer : body.buffer.slice(0, size);
}

export async function readBoundedJson<T = unknown>(request: Request, maxBytes = 16 * 1024): Promise<T> {
  const body = await readBoundedRequestBody(request, maxBytes);
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)) as T;
  } catch {
    throw new BodyLimitError('Invalid JSON request body', 400);
  }
}

export async function readBoundedJsonObject(request: Request, maxBytes = 16 * 1024): Promise<Record<string, any>> {
  const body = await readBoundedJson(request, maxBytes);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BodyLimitError('JSON object required', 400);
  return body as Record<string, any>;
}
