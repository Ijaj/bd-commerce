import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ActionIcon,
  Alert,
  Button,
  Group,
  List,
  Modal,
  ScrollArea,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { IconGripVertical, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { categoriesApi } from './api';
import { conflictBody, HttpError } from './http';
import {
  type OptionProblem,
  type OptionRow,
  problemMap,
  problemsFromServer,
  toOptionPayload,
  validateOptions,
} from './options';
import { notifyError, notifyOk, useInvalidateCategories } from './queries';
import type { Attribute, OptionProblemsBody, OptionUsageBody } from './types';

let rowCounter = 0;
const newKey = () => `new-${++rowCounter}`;

const fromAttribute = (a: Attribute): OptionRow[] =>
  [...a.options]
    .sort((x, y) => x.sort - y.sort)
    .map((o) => ({ key: o.id, id: o.id, valueEn: o.valueEn, valueBn: o.valueBn ?? '' }));

const MESSAGES = { blank: 'Required', duplicate: 'Duplicate' } as const;

/**
 * Q116/Q117: one row per option with separate EN and BN inputs, drag to reorder, delete per row.
 * "+ Add option" lives in the header so it never moves; the whole list is saved at once.
 */
export function OptionEditor({
  attribute,
  disabled,
}: {
  attribute: Attribute;
  disabled?: boolean;
}) {
  const invalidate = useInvalidateCategories();
  const [saved, setSaved] = useState(() => fromAttribute(attribute));
  const [rows, setRows] = useState(saved);
  const [attempted, setAttempted] = useState(false);
  const [serverProblems, setServerProblems] = useState<OptionProblem[]>([]);
  const [usage, setUsage] = useState<OptionUsageBody | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const local = useMemo(() => validateOptions(rows), [rows]);
  // Blank rows are only flagged once the user tries to save (new rows start empty).
  const shown = useMemo(
    () => [...local.filter((p) => attempted || p.reason === 'duplicate'), ...serverProblems],
    [local, attempted, serverProblems],
  );
  const map = useMemo(() => problemMap(shown), [shown]);
  const dirty = JSON.stringify(toOptionPayload(rows)) !== JSON.stringify(toOptionPayload(saved));

  const save = useMutation({
    mutationFn: ({ force }: { force: boolean }) =>
      categoriesApi.setOptions(attribute.id, toOptionPayload(rows), force),
    onSuccess: (options) => {
      const next = fromAttribute({ ...attribute, options });
      setSaved(next);
      setRows(next);
      setAttempted(false);
      setServerProblems([]);
      setUsage(null);
      notifyOk('Options saved');
      invalidate();
    },
    onError: (e) => {
      const u = conflictBody<OptionUsageBody>(e);
      if (u?.usage) return setUsage(u);
      if (e instanceof HttpError && e.status === 400) {
        const sp = problemsFromServer((e.body as OptionProblemsBody | null)?.rows);
        if (sp.length) setServerProblems(sp);
      }
      notifyError(e, 'Could not save the options');
    },
  });

  function trySave(force = false) {
    setAttempted(true);
    if (local.length) {
      notifyError(new Error('Fix the highlighted options first (blank or duplicate values)'));
      return;
    }
    save.mutate({ force });
  }

  function update(index: number, patch: Partial<OptionRow>) {
    setServerProblems([]);
    setRows((r) => r.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function add() {
    const key = newKey();
    setServerProblems([]);
    setRows((r) => [...r, { key, valueEn: '', valueBn: '' }]);
    setFocusKey(key);
    // Keep the new row in view without moving the header.
    requestAnimationFrame(() => {
      const el = listRef.current?.parentElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    setServerProblems([]);
    setRows((r) => {
      const from = r.findIndex((x) => x.key === e.active.id);
      const to = r.findIndex((x) => x.key === e.over?.id);
      return from < 0 || to < 0 ? r : arrayMove(r, from, to);
    });
  }

  return (
    <Stack gap="xs" data-testid="option-editor">
      <Group justify="space-between" wrap="nowrap">
        <Text size="sm" fw={600}>
          Options ({rows.length})
        </Text>
        <Group gap="xs">
          {dirty && (
            <Button
              size="compact-sm"
              variant="subtle"
              color="gray"
              onClick={() => {
                setRows(saved);
                setAttempted(false);
                setServerProblems([]);
              }}
            >
              Reset
            </Button>
          )}
          <Button
            size="compact-sm"
            variant="light"
            leftSection={<IconPlus size={14} />}
            disabled={disabled}
            onClick={add}
          >
            Add option
          </Button>
          <Button
            size="compact-sm"
            disabled={disabled || !dirty}
            loading={save.isPending}
            onClick={() => trySave()}
          >
            Save options
          </Button>
        </Group>
      </Group>
      <ScrollArea.Autosize mah={320} type="auto" offsetScrollbars>
        <div ref={listRef}>
          {rows.length === 0 && (
            <Text size="sm" c="dimmed" py="xs">
              No options yet. Add the values staff can pick for this attribute.
            </Text>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={rows.map((r) => r.key)} strategy={verticalListSortingStrategy}>
              {rows.map((row, index) => (
                <OptionRowView
                  key={row.key}
                  row={row}
                  disabled={disabled}
                  autoFocus={row.key === focusKey}
                  errEn={map.get(`${index}:valueEn`)}
                  errBn={map.get(`${index}:valueBn`)}
                  onChange={(patch) => update(index, patch)}
                  onDelete={() => setRows((r) => r.filter((_, i) => i !== index))}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </ScrollArea.Autosize>

      <Modal opened={!!usage} onClose={() => setUsage(null)} title="Options are in use" centered>
        <Stack>
          <Alert color="yellow" variant="light">
            Removing these options also removes them from the products that use them.
          </Alert>
          <List size="sm" spacing={2}>
            {usage?.usage.map((u) => (
              <List.Item key={u.optionId}>
                <b>{u.valueEn}</b>: {u.productCount} product{u.productCount === 1 ? '' : 's'}
              </List.Item>
            ))}
          </List>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setUsage(null)}>
              Cancel
            </Button>
            <Button color="red" loading={save.isPending} onClick={() => trySave(true)}>
              Remove anyway
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

function OptionRowView({
  row,
  disabled,
  autoFocus,
  errEn,
  errBn,
  onChange,
  onDelete,
}: {
  row: OptionRow;
  disabled?: boolean;
  autoFocus: boolean;
  errEn?: 'blank' | 'duplicate';
  errBn?: 'blank' | 'duplicate';
  onChange: (patch: Partial<OptionRow>) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.key,
    disabled,
  });
  const enRef = useRef<HTMLInputElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: focus only when the row is first added
  useEffect(() => {
    if (autoFocus) enRef.current?.focus();
  }, []);
  return (
    <Group
      ref={setNodeRef}
      wrap="nowrap"
      gap="xs"
      align="flex-start"
      mb={6}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        background: 'var(--bdc-surface)',
      }}
    >
      <ActionIcon
        variant="subtle"
        color="gray"
        mt={4}
        aria-label="Drag option"
        style={{ cursor: 'grab', touchAction: 'none' }}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <IconGripVertical size={16} />
      </ActionIcon>
      <TextInput
        style={{ flex: 1 }}
        size="xs"
        placeholder="English"
        aria-label="Option (English)"
        value={row.valueEn}
        disabled={disabled}
        ref={enRef}
        error={errEn ? MESSAGES[errEn] : undefined}
        onChange={(e) => onChange({ valueEn: e.currentTarget.value })}
      />
      <TextInput
        style={{ flex: 1 }}
        size="xs"
        lang="bn"
        placeholder="বাংলা (optional)"
        aria-label="Option (Bangla)"
        value={row.valueBn}
        disabled={disabled}
        error={errBn ? MESSAGES[errBn] : undefined}
        onChange={(e) => onChange({ valueBn: e.currentTarget.value })}
      />
      <ActionIcon
        variant="subtle"
        color="red"
        mt={4}
        aria-label="Delete option"
        disabled={disabled}
        onClick={onDelete}
      >
        <IconTrash size={16} />
      </ActionIcon>
    </Group>
  );
}
