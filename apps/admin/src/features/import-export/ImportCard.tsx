import { SectionCard } from '@bdc/ui';
import { Alert, Badge, Button, Group, Select, Stack, Table, Text } from '@mantine/core';
import { Dropzone, MIME_TYPES } from '@mantine/dropzone';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { inventoryKey } from '~/features/inventory/queries';
import { formatNumber } from '~/lib/format';
import {
  downloadFile,
  type FileFormat,
  type ImportIssue,
  type ImportMode,
  ImportRequestError,
  type ImportSummary,
  submitImport,
} from './api';
import classes from './ImportCard.module.css';

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = [MIME_TYPES.xlsx, MIME_TYPES.csv, 'application/vnd.ms-excel'];

function Counts({ label, c }: { label: string; c: ImportSummary['products'] }) {
  return (
    <Text size="sm">
      <Text span fw={600}>
        {label}:
      </Text>{' '}
      {formatNumber(c.create)} to create, {formatNumber(c.update)} to update
      {c.unchanged > 0 ? `, ${formatNumber(c.unchanged)} unchanged` : ''}
    </Text>
  );
}

function IssueTable({
  issues,
  total,
  color,
}: {
  issues: ImportIssue[];
  total?: number;
  color: string;
}) {
  return (
    <Stack gap={4}>
      <Table.ScrollContainer minWidth={400} mah={320}>
        <Table striped withTableBorder stickyHeader>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={70}>Row</Table.Th>
              <Table.Th w={160}>Column</Table.Th>
              <Table.Th>Message</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {issues.map((i, idx) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: issue list is static per result
              <Table.Tr key={idx}>
                <Table.Td>{i.row}</Table.Td>
                <Table.Td>{i.column}</Table.Td>
                <Table.Td c={color}>{i.message}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      {total !== undefined && total > issues.length && (
        <Text size="xs" c="dimmed">
          Showing the first {issues.length} of {total}.
        </Text>
      )}
    </Stack>
  );
}

export function ImportCard() {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ImportMode>('upsert');
  const [checked, setChecked] = useState<ImportSummary | null>(null);
  const [rejected, setRejected] = useState<{ issues: ImportIssue[]; count: number } | null>(null);
  const [done, setDone] = useState<ImportSummary | null>(null);

  function reset() {
    setChecked(null);
    setRejected(null);
    setDone(null);
  }

  function showFailure(e: Error) {
    if (e instanceof ImportRequestError && e.issues.length > 0) {
      setRejected({ issues: e.issues, count: e.errorCount });
    } else {
      notifications.show({ color: 'red', message: e.message });
    }
  }

  const check = useMutation({
    mutationFn: () => submitImport(file as File, mode, true),
    onSuccess: (s) => {
      setRejected(null);
      setDone(null);
      setChecked(s);
    },
    onError: showFailure,
  });

  const run = useMutation({
    mutationFn: () => submitImport(file as File, mode, false),
    onSuccess: (s) => {
      setDone(s);
      setChecked(null);
      setRejected(null);
      setFile(null);
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: inventoryKey });
      notifications.show({ color: 'green', message: 'Import finished' });
    },
    onError: showFailure,
  });

  const template = useMutation({
    mutationFn: (format: FileFormat) =>
      downloadFile('/v1/admin/products/import-template', { format }, `import-template.${format}`),
    onError: (e) => notifications.show({ color: 'red', message: e.message }),
  });

  const summary = checked ?? done;
  const errors = checked?.errors ?? rejected?.issues ?? [];
  const errorCount = checked ? checked.errorCount : (rejected?.count ?? 0);
  const canImport = !!file && !!checked && checked.errorCount === 0 && !run.isPending;

  return (
    <SectionCard
      title="Import products"
      actions={
        <Group gap="xs">
          <Button
            size="compact-sm"
            variant="default"
            loading={template.isPending && template.variables === 'xlsx'}
            onClick={() => template.mutate('xlsx')}
          >
            Template XLSX
          </Button>
          <Button
            size="compact-sm"
            variant="default"
            loading={template.isPending && template.variables === 'csv'}
            onClick={() => template.mutate('csv')}
          >
            Template CSV
          </Button>
        </Group>
      }
    >
      <Stack gap="sm">
        <p className="a-hint">
          XLSX or CSV, up to 10 MB. The file is checked first; nothing is saved until you import.
        </p>

        <Dropzone
          onDrop={(files) => {
            setFile(files[0] ?? null);
            reset();
          }}
          onReject={() =>
            notifications.show({ color: 'red', message: 'Only one XLSX or CSV file, max 10 MB' })
          }
          accept={ACCEPT}
          maxSize={MAX_BYTES}
          maxFiles={1}
          multiple={false}
        >
          <Stack align="center" gap={2} mih={64} justify="center" className={classes.dropInner}>
            {file ? (
              <Text size="sm" fw={500}>
                {file.name} ({Math.max(1, Math.round(file.size / 1024))} KB)
              </Text>
            ) : (
              <Text size="sm" c="dimmed">
                Drop a spreadsheet here or click to choose
              </Text>
            )}
          </Stack>
        </Dropzone>

        <Select
          label="When a product already exists"
          w={320}
          allowDeselect={false}
          value={mode}
          onChange={(v) => {
            setMode((v as ImportMode) ?? 'upsert');
            reset();
          }}
          data={[
            { value: 'upsert', label: 'Update it (create new ones too)' },
            { value: 'create_only', label: 'Create only (skip existing)' },
          ]}
        />

        <Group>
          <Button
            variant="light"
            disabled={!file}
            loading={check.isPending}
            onClick={() => check.mutate()}
          >
            1. Check file
          </Button>
          <Button disabled={!canImport} loading={run.isPending} onClick={() => run.mutate()}>
            2. Import
          </Button>
        </Group>

        {summary && (
          <Alert
            color={done ? 'green' : errorCount > 0 ? 'red' : 'indigo'}
            variant="light"
            title={done ? 'Import complete' : 'File checked'}
          >
            <Stack gap={2}>
              <Text size="sm">{formatNumber(summary.rows)} rows read</Text>
              <Counts label="Products" c={summary.products} />
              <Counts label="Variants" c={summary.variants} />
              {summary.stockMovements > 0 && (
                <Text size="sm">{formatNumber(summary.stockMovements)} stock changes</Text>
              )}
              {!done && summary.errorCount === 0 && (
                <Text size="sm" c="green" fw={500}>
                  No errors. Ready to import.
                </Text>
              )}
            </Stack>
          </Alert>
        )}

        {errorCount > 0 && (
          <Stack gap={4}>
            <Group gap="xs">
              <Badge color="red">
                {errorCount} {errorCount === 1 ? 'error' : 'errors'}
              </Badge>
              <Text size="sm" c="dimmed">
                Fix these in the file and check it again.
              </Text>
            </Group>
            <IssueTable issues={errors} total={errorCount} color="red" />
          </Stack>
        )}

        {summary && summary.warnings.length > 0 && (
          <Stack gap={4}>
            <Badge color="yellow">
              {summary.warnings.length} {summary.warnings.length === 1 ? 'warning' : 'warnings'}
            </Badge>
            <IssueTable issues={summary.warnings} color="orange" />
          </Stack>
        )}
      </Stack>
    </SectionCard>
  );
}
