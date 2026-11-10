'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Notice } from '~/features/account/Field';
import { call } from '~/features/account/lib';
import { dict, type Lang } from '~/i18n';
import { href } from '~/i18n/routing';
import { browserApi } from '~/lib/api-browser';
import s from './orders.module.css';
import type { OrderTrack } from './types';

type Props = { lang: Lang; orderNo: string } & (
  | { phone?: undefined; onCancelled?: undefined }
  | { phone: string; onCancelled: (t: OrderTrack) => void }
);

/**
 * Customer cancel (A3): a button that opens an inline confirm. With `phone` it is the guest
 * track-page flow, otherwise the signed-in customer's order (page refreshes after).
 */
export function CancelOrder({ lang, orderNo, phone, onCancelled }: Props) {
  const d = dict(lang).orders;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setCode(null);
    const body = reason.trim() ? { reason: reason.trim() } : {};
    if (phone) {
      const r = await call<OrderTrack>(
        browserApi.POST('/v1/public/track/cancel', { body: { orderNo, phone, ...body } }),
      );
      setBusy(false);
      if (r.ok) onCancelled?.(r.data);
      else setCode(r.code ?? (r.status === 429 ? 'TOO_MANY_REQUESTS' : `HTTP_${r.status}`));
      return;
    }
    const r = await call<unknown>(
      browserApi.POST('/v1/customer/orders/{orderNo}/cancel', {
        params: { path: { orderNo } },
        body,
      }),
    );
    setBusy(false);
    if (r.ok) {
      setOpen(false);
      router.refresh();
    } else setCode(r.code ?? (r.status === 429 ? 'TOO_MANY_REQUESTS' : `HTTP_${r.status}`));
  }

  if (!open) {
    return (
      <p className={s.actions}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
          {d.cancelOrder}
        </button>
      </p>
    );
  }
  const errors = d.cancelErrors as Record<string, string>;
  return (
    <section className={s.card} aria-labelledby="od-cancel">
      <h2 id="od-cancel" className={s.cardTitle}>
        {d.cancelTitle}
      </h2>
      <p className={s.muted}>{d.cancelBody}</p>
      <label className={s.cancelReason}>
        <span>{d.cancelReason}</span>
        <textarea
          rows={2}
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      {code ? (
        <Notice kind="error">
          {errors[code] ?? d.cancelErrors.generic}
          {code === 'LOGIN_REQUIRED' ? (
            <>
              {' '}
              <Link className="link" href={href(lang, '/login')}>
                {d.cancelLogin}
              </Link>
            </>
          ) : null}
        </Notice>
      ) : null}
      <div className={s.formActions}>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={confirm}>
          {busy ? d.cancelling : d.cancelConfirm}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={busy}
          onClick={() => setOpen(false)}
        >
          {d.cancelKeep}
        </button>
      </div>
    </section>
  );
}
