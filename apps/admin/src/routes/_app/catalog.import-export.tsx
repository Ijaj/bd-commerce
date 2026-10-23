import { createFileRoute } from '@tanstack/react-router';
import { ImportExportPage } from '~/features/import-export/ImportExportPage';

export const Route = createFileRoute('/_app/catalog/import-export')({
  component: ImportExportPage,
});
