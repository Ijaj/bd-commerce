'use client';
import { useEffect } from 'react';
import type { Me } from '~/lib/types';
import { setSessionMe } from './session';

/** Account pages already know the customer on the server; hand it to the client store so the header agrees at once. */
export function SessionSeed({ me }: { me: Me }) {
  useEffect(() => {
    setSessionMe(me);
  }, [me]);
  return null;
}
