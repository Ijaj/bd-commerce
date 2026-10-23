const ID = /^[A-Za-z0-9_-]{6,20}$/;

/** youtube.com/watch?v=ID, youtu.be/ID or youtube.com/shorts/ID (Q26). */
export function isYoutubeUrl(value: string): boolean {
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  const host = u.hostname.replace(/^www\.|^m\./, '');
  if (host === 'youtu.be') return ID.test(u.pathname.slice(1));
  if (host !== 'youtube.com') return false;
  if (u.pathname === '/watch') return ID.test(u.searchParams.get('v') ?? '');
  const shorts = /^\/shorts\/([^/]+)$/.exec(u.pathname);
  return !!shorts && ID.test(shorts[1] ?? '');
}
