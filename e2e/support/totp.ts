import { Secret, TOTP } from 'otpauth';

const STEP_MS = 30_000;
const lastStep = new Map<string, number>();

/**
 * Returns a TOTP code the API will accept for `secret`. The API accepts steps within +-1 of now and
 * rejects any step <= the last accepted one (replay guard), so this tracks the last step it handed
 * out per secret, uses a future step when allowed and otherwise waits for the clock to catch up.
 */
export async function nextTotp(secret: string): Promise<string> {
  const totp = new TOTP({ secret: Secret.fromBase32(secret) });
  const last = lastStep.get(secret) ?? -1;
  for (;;) {
    const now = Math.floor(Date.now() / STEP_MS);
    // Prefer the current step, then +1 (valid as long as our clock matches the API's).
    const step = [now, now + 1].find((s) => s > last);
    if (step !== undefined) {
      lastStep.set(secret, step);
      return totp.generate({ timestamp: step * STEP_MS + 1000 });
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}
