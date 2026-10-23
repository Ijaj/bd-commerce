/**
 * Picks the file name out of a Content-Disposition header. Prefers RFC 5987 `filename*=UTF-8''...`
 * (percent-decoded), then `filename="..."` / `filename=...`. Returns the fallback when none is usable.
 */
export function parseContentDisposition(
  header: string | null | undefined,
  fallback: string,
): string {
  if (!header) return fallback;

  const star = /filename\*\s*=\s*([^;]+)/i.exec(header);
  if (star?.[1]) {
    const m = /^\s*([\w-]+)'[^']*'(.*)$/.exec(star[1].trim());
    if (m?.[2]) {
      try {
        const name = decodeURIComponent(m[2]);
        if (name) return sanitize(name, fallback);
      } catch {
        // malformed escape: fall through to plain filename
      }
    }
  }

  const quoted = /filename\s*=\s*"((?:[^"\\]|\\.)*)"/i.exec(header);
  if (quoted?.[1]) return sanitize(quoted[1].replace(/\\(.)/g, '$1'), fallback);

  const bare = /filename\s*=\s*([^;]+)/i.exec(header);
  if (bare?.[1]) return sanitize(bare[1].trim(), fallback);

  return fallback;
}

/** Strip path separators so a header can never pick a directory. */
function sanitize(name: string, fallback: string): string {
  const base = name.split(/[\\/]/).pop()?.trim() ?? '';
  return base || fallback;
}
