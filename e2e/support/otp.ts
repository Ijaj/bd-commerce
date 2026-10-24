import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { DB_NAME, PG_CONTAINER } from './env';

/**
 * SMS codes are only sent to the in-memory outbox when NODE_ENV=test (the e2e API), so the code
 * cannot be read from Mailpit. The API stores sha256(`${phone}:${purpose}:${code}`); the
 * 10^6 candidates are checked here against the latest row. Test-only: the DB is the harness's own.
 */
export function readSmsCode(phone: string, purpose: 'signup' | 'reset'): string {
  const sql = `select code_hash from otp_codes where phone = '${phone}' and purpose = '${purpose}' order by created_at desc limit 1`;
  const hash = execEngine([
    'exec',
    PG_CONTAINER,
    'psql',
    '-U',
    'bdc',
    '-d',
    DB_NAME,
    '-At',
    '-c',
    sql,
  ]).trim();
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error(`no ${purpose} OTP row for ${phone}`);
  for (let n = 0; n < 1_000_000; n++) {
    const code = String(n).padStart(6, '0');
    if (createHash('sha256').update(`${phone}:${purpose}:${code}`).digest('hex') === hash)
      return code;
  }
  throw new Error(`OTP for ${phone} not found`);
}

function execEngine(args: string[]): string {
  for (const bin of ['podman', 'docker']) {
    try {
      return execFileSync(bin, args, { encoding: 'utf8' });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }
  throw new Error('podman or docker is required to reach the dev Postgres container');
}
