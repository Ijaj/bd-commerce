import { Alert, Stack } from '@mantine/core';
import { PageHeader } from '~/components/PageHeader';
import { useCan } from '~/lib/perm';
import { ExportCard } from './ExportCard';
import { ImportCard } from './ImportCard';

export function ImportExportPage() {
  const canExport = useCan('products.export');
  const canImport = useCan('products.import');

  return (
    <>
      <PageHeader
        title="Import / Export"
        crumbs={['Catalog', 'Import / Export']}
        description="Bulk-edit products and stock in a spreadsheet."
      />
      <Stack gap="md" maw={900}>
        {canExport && <ExportCard />}
        {canImport && <ImportCard />}
        {!canExport && !canImport && (
          <Alert color="gray">You do not have permission to import or export products.</Alert>
        )}
      </Stack>
    </>
  );
}
