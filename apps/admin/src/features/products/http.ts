import { ApiError, errorMessage } from '~/api';

/** Error that keeps the response body (publish failures carry `problems[]`). */
export class ProductApiError extends ApiError {
  constructor(
    message: string,
    status: number,
    readonly body: unknown,
  ) {
    super(message, status);
  }

  get problems(): string[] {
    const p = (this.body as { problems?: unknown } | null)?.problems;
    return Array.isArray(p) ? p.map(String) : [];
  }
}

/** Like unwrap(), but the thrown ProductApiError keeps the response body (e.g. `problems[]`). */
export async function call<T>(
  result: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await result;
  if (!response.ok) {
    throw new ProductApiError(
      errorMessage(error, `Request failed (${response.status})`),
      response.status,
      error,
    );
  }
  return data as T;
}
