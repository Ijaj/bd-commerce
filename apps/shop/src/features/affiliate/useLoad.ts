'use client';
import { useCallback, useEffect, useState } from 'react';
import type { ApiResult } from '~/features/account/lib';

export type Loaded<T> = { status: 'loading' } | { status: 'error' } | { status: 'ok'; data: T };

/** Runs `fetcher` whenever `key` changes; `reload` retries. Late answers from old keys are dropped. */
export function useLoad<T>(fetcher: () => Promise<ApiResult<T>>, key: string) {
  const [state, setState] = useState<Loaded<T>>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: key + nonce are the only triggers by design
  useEffect(() => {
    let live = true;
    setState({ status: 'loading' });
    void fetcher().then((r) => {
      if (live) setState(r.ok ? { status: 'ok', data: r.data } : { status: 'error' });
    });
    return () => {
      live = false;
    };
  }, [key, nonce]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { state, reload };
}
