import { notFound } from 'next/navigation';

// Catch-all so unknown URLs render [lang]/not-found.tsx inside the shell (the layout is the root layout).
export default function CatchAll() {
  notFound();
}
