import type { Lang } from '@bdc/i18n';
import { Alert, Button, Loader } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { InvoiceView } from './InvoiceView';
import { LabelPageRule, LabelView } from './LabelView';
import { PrintToolbar } from './PrintShell';
import { invoiceQuery, labelQuery, labelsQuery } from './queries';

export function InvoicePrintPage({
  id,
  lang,
  onLang,
}: {
  id: string;
  lang: Lang | undefined;
  onLang: (l: Lang) => void;
}) {
  const q = useQuery(invoiceQuery(id));
  // Default to the language the customer ordered in; the toggle overrides it.
  const shown = lang ?? q.data?.snapshot.lang ?? 'en';
  return (
    <>
      <PrintToolbar disabled={!q.data}>
        <Button variant={shown === 'en' ? 'filled' : 'default'} onClick={() => onLang('en')}>
          English
        </Button>
        <Button variant={shown === 'bn' ? 'filled' : 'default'} onClick={() => onLang('bn')}>
          বাংলা
        </Button>
      </PrintToolbar>
      {q.isLoading && <Loader m="lg" size="sm" />}
      {q.isError && (
        <Alert color="red" m="md">
          {q.error.message}
        </Alert>
      )}
      {q.data && <InvoiceView invoice={q.data} lang={shown} />}
    </>
  );
}

export function LabelPrintPage({ id }: { id: string }) {
  const q = useQuery(labelQuery(id));
  return (
    <>
      <LabelPageRule />
      <PrintToolbar disabled={!q.data} />
      {q.isLoading && <Loader m="lg" size="sm" />}
      {q.isError && (
        <Alert color="red" m="md">
          {q.error.message}
        </Alert>
      )}
      {q.data && <LabelView label={q.data} />}
    </>
  );
}

export function LabelsPrintPage({ ids, max }: { ids: string[]; max: number }) {
  const navigate = useNavigate();
  const use = ids.slice(0, max);
  const q = useQuery({ ...labelsQuery(use), enabled: use.length > 0 });
  return (
    <>
      <LabelPageRule />
      <PrintToolbar disabled={!q.data?.length} />
      {ids.length > max && (
        <Alert color="yellow" m="md" className="no-print">
          {ids.length} labels requested; only the first {max} are shown. Print the rest in another
          batch.
        </Alert>
      )}
      {use.length === 0 && (
        <Alert color="gray" m="md" className="no-print">
          No shipments selected.{' '}
          <Button size="compact-sm" variant="subtle" onClick={() => navigate({ to: '/shipments' })}>
            Go to shipments
          </Button>
        </Alert>
      )}
      {q.isLoading && <Loader m="lg" size="sm" />}
      {q.isError && (
        <Alert color="red" m="md">
          {q.error.message}
        </Alert>
      )}
      {q.data?.map((l) => (
        <LabelView key={l.shipmentNo} label={l} />
      ))}
    </>
  );
}
