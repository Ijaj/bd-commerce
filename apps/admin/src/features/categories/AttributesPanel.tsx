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
  Badge,
  Button,
  Collapse,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
} from '@mantine/core';
import {
  IconGripVertical,
  IconListDetails,
  IconPencil,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ConfirmDelete } from '~/components/ConfirmDelete';
import { AttributeFormModal } from './AttributeFormModal';
import classes from './AttributesPanel.module.css';
import { categoriesApi } from './api';
import { conflictBody } from './http';
import { OptionEditor } from './OptionEditor';
import { notifyError, notifyOk, useInvalidateCategories } from './queries';
import { type Attribute, type AttributeUsageBody, type CategoryDetail, hasOptions } from './types';

const typeLabel = (a: Attribute) => (a.type === 'multiselect' ? 'multi-select' : a.type);

export function AttributesPanel({
  category,
  canEdit,
}: {
  category: CategoryDetail;
  canEdit: boolean;
}) {
  const invalidate = useInvalidateCategories();
  const [items, setItems] = useState(category.attributes);
  useEffect(() => setItems(category.attributes), [category.attributes]);
  const [form, setForm] = useState<{ attribute: Attribute | null } | null>(null);
  const [openOptions, setOpenOptions] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Attribute | null>(null);
  const [forceDelete, setForceDelete] = useState<{
    attr: Attribute;
    usage: AttributeUsageBody;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const reorder = useMutation({
    mutationFn: (next: Attribute[]) =>
      categoriesApi.reorderAttributes(
        category.id,
        next.map((a, sort) => ({ id: a.id, sort })),
      ),
    onSuccess: () => invalidate(),
    onError: (e) => {
      notifyError(e, 'Could not reorder');
      setItems(category.attributes);
    },
  });

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = items.findIndex((a) => a.id === e.active.id);
    const to = items.findIndex((a) => a.id === e.over?.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(items, from, to);
    setItems(next);
    reorder.mutate(next);
  }

  const remove = useMutation({
    mutationFn: ({ attr, force }: { attr: Attribute; force: boolean }) =>
      categoriesApi.removeAttribute(attr.id, force),
    onSuccess: () => {
      notifyOk('Attribute deleted');
      invalidate();
    },
  });

  async function confirmDelete(attr: Attribute) {
    try {
      await remove.mutateAsync({ attr, force: false });
    } catch (e) {
      const usage = conflictBody<AttributeUsageBody>(e);
      if (!usage) throw e;
      setForceDelete({ attr, usage });
    }
  }

  const nextSort = items.reduce((m, a) => Math.max(m, a.sort + 1), 0);

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={600}>Attributes of this category</Text>
        {canEdit && (
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setForm({ attribute: null })}
          >
            Add attribute
          </Button>
        )}
      </Group>
      {items.length === 0 && (
        <Text size="sm" c="dimmed">
          No attributes yet. Sub-categories inherit these.
        </Text>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((a) => a.id)} strategy={verticalListSortingStrategy}>
          <Stack gap="xs">
            {items.map((a) => (
              <AttributeRow
                key={a.id}
                attr={a}
                canEdit={canEdit}
                optionsOpen={openOptions.has(a.id)}
                onToggleOptions={() =>
                  setOpenOptions((s) => {
                    const n = new Set(s);
                    n.has(a.id) ? n.delete(a.id) : n.add(a.id);
                    return n;
                  })
                }
                onEdit={() => setForm({ attribute: a })}
                onDelete={() => setDeleting(a)}
              />
            ))}
          </Stack>
        </SortableContext>
      </DndContext>

      {category.inheritedAttributes.length > 0 && (
        <>
          <Text fw={600}>Inherited attributes</Text>
          <Stack gap="xs">
            {category.inheritedAttributes.map((a) => (
              <Paper key={a.id} withBorder p="xs" className={classes.inherited}>
                <Group justify="space-between" wrap="nowrap">
                  <div>
                    <Group gap="xs">
                      <Text size="sm" fw={500}>
                        {a.nameEn}
                      </Text>
                      <Text size="xs" c="dimmed" ff="monospace">
                        {a.key}
                      </Text>
                      <Badge size="xs" variant="light">
                        {typeLabel(a)}
                      </Badge>
                      {hasOptions(a.type) && (
                        <Badge size="xs" variant="outline" color="gray">
                          {a.options.length} options
                        </Badge>
                      )}
                    </Group>
                  </div>
                  <Badge size="sm" variant="light" color="grape">
                    from {a.inheritedFrom.nameEn}
                  </Badge>
                </Group>
              </Paper>
            ))}
          </Stack>
        </>
      )}

      {form && (
        <AttributeFormModal
          key={form.attribute?.id ?? 'new'}
          opened
          categoryId={category.id}
          attribute={form.attribute}
          nextSort={nextSort}
          onClose={() => setForm(null)}
        />
      )}

      <ConfirmDelete
        opened={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete attribute"
        loading={remove.isPending}
        onConfirm={() => deleting && confirmDelete(deleting)}
      >
        Delete attribute <b>{deleting?.nameEn}</b> and its options?
      </ConfirmDelete>

      <Modal
        opened={!!forceDelete}
        onClose={() => setForceDelete(null)}
        title="Attribute is in use"
        centered
      >
        <Stack>
          <Alert color="yellow" variant="light">
            {forceDelete?.usage.productCount} product
            {forceDelete?.usage.productCount === 1 ? '' : 's'} have {forceDelete?.usage.valueCount}{' '}
            value
            {forceDelete?.usage.valueCount === 1 ? '' : 's'} for <b>{forceDelete?.attr.nameEn}</b>.
            Deleting it removes those values.
          </Alert>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setForceDelete(null)}>
              Cancel
            </Button>
            <Button
              color="red"
              loading={remove.isPending}
              onClick={async () => {
                if (!forceDelete) return;
                try {
                  await remove.mutateAsync({ attr: forceDelete.attr, force: true });
                  setForceDelete(null);
                } catch (e) {
                  notifyError(e, 'Could not delete the attribute');
                }
              }}
            >
              Delete anyway
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

function AttributeRow({
  attr,
  canEdit,
  optionsOpen,
  onToggleOptions,
  onEdit,
  onDelete,
}: {
  attr: Attribute;
  canEdit: boolean;
  optionsOpen: boolean;
  onToggleOptions: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: attr.id,
    disabled: !canEdit,
  });
  return (
    <Paper
      ref={setNodeRef}
      withBorder
      p="xs"
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          {canEdit && (
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={`Drag ${attr.nameEn}`}
              className={classes.grip}
              {...attributes}
              {...listeners}
            >
              <IconGripVertical size={16} />
            </ActionIcon>
          )}
          <div>
            <Group gap="xs">
              <Text size="sm" fw={500}>
                {attr.nameEn}
              </Text>
              {attr.nameBn && (
                <Text size="xs" c="dimmed" lang="bn">
                  {attr.nameBn}
                </Text>
              )}
            </Group>
            <Group gap={6} mt={2}>
              <Text size="xs" c="dimmed" ff="monospace">
                {attr.key}
              </Text>
              <Badge size="xs" variant="light">
                {typeLabel(attr)}
                {attr.unit ? ` (${attr.unit})` : ''}
              </Badge>
              {attr.isFilterable && (
                <Badge size="xs" variant="outline" color="teal">
                  filterable
                </Badge>
              )}
              {attr.isRequired && (
                <Badge size="xs" variant="outline" color="red">
                  required
                </Badge>
              )}
            </Group>
          </div>
        </Group>
        <Group gap={4} wrap="nowrap">
          {hasOptions(attr.type) && (
            <Button
              size="compact-xs"
              variant={optionsOpen ? 'filled' : 'light'}
              leftSection={<IconListDetails size={12} />}
              onClick={onToggleOptions}
            >
              Options ({attr.options.length})
            </Button>
          )}
          {canEdit && (
            <>
              <ActionIcon variant="subtle" aria-label={`Edit ${attr.nameEn}`} onClick={onEdit}>
                <IconPencil size={16} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label={`Delete ${attr.nameEn}`}
                onClick={onDelete}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </>
          )}
        </Group>
      </Group>
      {hasOptions(attr.type) && (
        <Collapse expanded={optionsOpen} mt={optionsOpen ? 'sm' : 0}>
          <OptionEditor attribute={attr} disabled={!canEdit} />
        </Collapse>
      )}
    </Paper>
  );
}
