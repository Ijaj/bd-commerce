import { Button, Group } from '@mantine/core';
import { Outlet } from '@tanstack/react-router';
import type { ReactNode } from 'react';

/** White, shell-less layout for print routes. Force light colours so dark mode never prints dark. */
const BASE_CSS = `
html, body { background: #fff !important; color: #111 !important; }
.print-root { background: #fff; color: #111; }
@media print { .no-print { display: none !important; } }
`;

export function PrintLayout() {
  return (
    <div className="print-root">
      <style>{BASE_CSS}</style>
      <Outlet />
    </div>
  );
}

/** Page size rule for the current print view (only one print view is mounted at a time). */
export function PageRule({ css }: { css: string }) {
  return <style>{css}</style>;
}

/** Print + Back buttons, hidden when printing. Printing only starts on click, never on load. */
export function PrintToolbar({ children, disabled }: { children?: ReactNode; disabled?: boolean }) {
  return (
    <Group className="no-print" p="sm" gap="xs" style={{ borderBottom: '1px solid #ddd' }}>
      <Button
        variant="default"
        onClick={() => (window.history.length > 1 ? window.history.back() : window.close())}
      >
        Back
      </Button>
      <Button disabled={disabled} onClick={() => window.print()}>
        Print
      </Button>
      {children}
    </Group>
  );
}
