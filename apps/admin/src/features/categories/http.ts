import { errorMessage } from '~/api';

/** Error that keeps the response status and parsed body (409 payloads carry usage details). */
export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * Like `unwrap` from ~/api but keeps the error body, which the catalog pages need for 409/400 details.
 *   const rows = await send(api.GET('/v1/admin/brands'));
 */
export async function send<T>(
  result: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await result;
  if (!response.ok) {
    throw new HttpError(
      errorMessage(error, `Request failed (${response.status})`),
      response.status,
      error,
    );
  }
  return data as T;
}

/** Narrow an unknown error to a 409 and return its body typed as B. */
export function conflictBody<B>(err: unknown): B | null {
  return err instanceof HttpError && err.status === 409 ? (err.body as B) : null;
}
