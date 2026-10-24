import { API_URL } from './env';

/**
 * The e2e API runs with E2E_EXPOSE_OTP=1, which serves the latest SMS it "sent" to a phone at
 * GET /v1/test/last-sms (the API refuses to boot with that flag in production). Codes are stored
 * as keyed hashes, so the database cannot be used to read them.
 */
export async function readSmsCode(phone: string): Promise<string> {
  const res = await fetch(`${API_URL}/v1/test/last-sms?phone=${encodeURIComponent(phone)}`);
  if (!res.ok) throw new Error(`no SMS recorded for ${phone} (HTTP ${res.status})`);
  const { text } = (await res.json()) as { text: string };
  const code = /(\d{6})/.exec(text)?.[1];
  if (!code) throw new Error(`no 6-digit code in SMS to ${phone}: ${text}`);
  return code;
}
