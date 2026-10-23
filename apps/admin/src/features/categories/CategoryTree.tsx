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
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Image,
  Menu,
  Text,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import {
  IconArrowsMove,
  IconChevronDown,
  IconChevronRight,
  IconDotsVertical,
  IconGripVertical,
  IconHome,
  IconPencil,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { memo } from 'react';
import { MAX_LEVEL, reorderSiblings, type TreeNode } from './tree';
import type { Category } from './types';

export interface TreeActions {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (c: Category) => void;
  onAddChild: (c: Category) => void;
  onMove: (c: Category) => void;
  onDelete: (c: Category) => void;
  onReorder: (items: { id: string; sort: number }[]) => void;
}

export function CategoryTree({
  nodes,
  byId,
  actions,
}: {
  nodes: TreeNode<Category>[];
  byId: Map<string, Category>;
  actions: TreeActions;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Siblings only: dropping onto a different parent is ignored (use "Move to...").
  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const a = byId.get(String(e.active.id));
    const o = byId.get(String(e.over.id));
    if (!a || !o || a.parentId !== o.parentId) return;
    const siblings = findSiblings(nodes, a.parentId).map((n) => n.category.id);
    const items = reorderSiblings(siblings, a.id, o.id);
    if (items) actions.onReorder(items);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <Group wrap="nowrap" px="xs" py={4} gap="xs" c="dimmed" fz="xs" fw={600} tt="uppercase">
        <Box w={56} />
        <Box style={{ flex: 1 }}>Category</Box>
        <Box w={90}>Slug</Box>
        <Box w={64} ta="right">
          Products
        </Box>
        <Box w={170}>Status</Box>
        <Box w={64} />
      </Group>
      <TreeGroup nodes={nodes} actions={actions} />
    </DndContext>
  );
}

function findSiblings(roots: TreeNode<Category>[], parentId: string | null): TreeNode<Category>[] {
  if (parentId === null) return roots;
  const stack = [...roots];
  while (stack.length) {
    const n = stack.pop() as TreeNode<Category>;
    if (n.category.id === parentId) return n.children;
    stack.push(...n.children);
  }
  return [];
}

function TreeGroup({ nodes, actions }: { nodes: TreeNode<Category>[]; actions: TreeActions }) {
  return (
    <SortableContext
      items={nodes.map((n) => n.category.id)}
      strategy={verticalListSortingStrategy}
      disabled={!actions.canEdit}
    >
      {nodes.map((n) => (
        <SortableNode key={n.category.id} node={n} actions={actions} />
      ))}
    </SortableContext>
  );
}

function SortableNode({ node, actions }: { node: TreeNode<Category>; actions: TreeActions }) {
  const c = node.category;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: c.id,
    disabled: !actions.canEdit,
  });
  const open = !actions.collapsed.has(c.id);
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        position: 'relative',
        zIndex: isDragging ? 2 : undefined,
      }}
    >
      <Row
        c={c}
        open={open}
        hasChildren={node.children.length > 0}
        actions={actions}
        handleProps={{ ...attributes, ...listeners }}
      />
      {open && node.children.length > 0 && <TreeGroup nodes={node.children} actions={actions} />}
    </div>
  );
}

const Row = memo(function Row({
  c,
  open,
  hasChildren,
  actions,
  handleProps,
}: {
  c: Category;
  open: boolean;
  hasChildren: boolean;
  actions: TreeActions;
  handleProps: Record<string, unknown>;
}) {
  return (
    <Group
      wrap="nowrap"
      gap="xs"
      px="xs"
      py={6}
      data-testid={`cat-row-${c.slug}`}
      style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
    >
      <Group gap={2} wrap="nowrap" w={56}>
        {actions.canEdit ? (
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            aria-label={`Drag ${c.nameEn}`}
            style={{ cursor: 'grab', touchAction: 'none' }}
            {...handleProps}
          >
            <IconGripVertical size={14} />
          </ActionIcon>
        ) : null}
        {hasChildren ? (
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            aria-label={open ? 'Collapse' : 'Expand'}
            onClick={() => actions.onToggle(c.id)}
          >
            {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          </ActionIcon>
        ) : null}
      </Group>
      <UnstyledButton onClick={() => actions.onEdit(c)} style={{ flex: 1, minWidth: 0 }}>
        <Group wrap="nowrap" gap="sm" pl={(c.level - 1) * 14}>
          <span
            title={c.chipColor ?? 'No chip colour'}
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              flex: 'none',
              background: c.chipColor ?? 'transparent',
              border: '1px solid var(--mantine-color-default-border)',
            }}
          />
          {c.image ? (
            <Image src={c.image.url} alt="" w={32} h={32} radius="sm" fit="cover" />
          ) : (
            <Box
              w={32}
              h={32}
              style={{ borderRadius: 4, background: 'var(--mantine-color-gray-1)' }}
            />
          )}
          <div style={{ minWidth: 0 }}>
            <Text size="sm" fw={500} truncate>
              {c.nameEn}
            </Text>
            {c.nameBn && (
              <Text size="xs" c="dimmed" truncate lang="bn">
                {c.nameBn}
              </Text>
            )}
          </div>
        </Group>
      </UnstyledButton>
      <Text size="xs" c="dimmed" w={90} truncate ff="monospace">
        {c.slug}
      </Text>
      <Text size="sm" w={64} ta="right">
        {c.productCount}
      </Text>
      <Group gap={4} w={170} wrap="nowrap">
        <Badge size="sm" variant="light" color={c.isActive ? 'teal' : 'gray'}>
          {c.isActive ? 'Active' : 'Inactive'}
        </Badge>
        {c.showOnHome && (
          <Badge
            size="sm"
            variant="light"
            color="indigo"
            leftSection={
              <ThemeIcon size={10} variant="transparent" color="indigo">
                <IconHome size={10} />
              </ThemeIcon>
            }
          >
            Home
          </Badge>
        )}
      </Group>
      <Group gap={2} w={64} justify="flex-end" wrap="nowrap">
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              aria-label={`Actions for ${c.nameEn}`}
            >
              <IconDotsVertical size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => actions.onEdit(c)}>
              {actions.canEdit ? 'Edit' : 'View'}
            </Menu.Item>
            {actions.canCreate && (
              <Menu.Item
                leftSection={<IconPlus size={14} />}
                disabled={c.level >= MAX_LEVEL}
                onClick={() => actions.onAddChild(c)}
              >
                Add sub-category{c.level >= MAX_LEVEL ? ' (max depth)' : ''}
              </Menu.Item>
            )}
            {actions.canEdit && (
              <Menu.Item
                leftSection={<IconArrowsMove size={14} />}
                onClick={() => actions.onMove(c)}
              >
                Move to...
              </Menu.Item>
            )}
            {actions.canDelete && (
              <>
                <Menu.Divider />
                <Menu.Item
                  color="red"
                  leftSection={<IconTrash size={14} />}
                  onClick={() => actions.onDelete(c)}
                >
                  Delete
                </Menu.Item>
              </>
            )}
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Group>
  );
});
