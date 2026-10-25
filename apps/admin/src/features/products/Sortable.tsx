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
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ActionIcon } from '@mantine/core';
import { IconGripVertical } from '@tabler/icons-react';
import type { CSSProperties, ReactNode } from 'react';
import classes from './Sortable.module.css';

interface SortableListProps<T> {
  items: T[];
  getId: (item: T) => string;
  onReorder: (items: T[]) => void;
  /** 'grid' for the image grid, 'list' for vertical lists. */
  layout?: 'grid' | 'list';
  children: ReactNode;
}

/** Drag-and-drop reordering (pointer + keyboard). Children are <SortableItem id=...> elements. */
export function SortableList<T>({
  items,
  getId,
  onReorder,
  layout = 'list',
  children,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map(getId);

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(items, from, to));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext
        items={ids}
        strategy={layout === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
      >
        {children}
      </SortableContext>
    </DndContext>
  );
}

export function SortableItem({
  id,
  disabled,
  style,
  children,
}: {
  id: string;
  disabled?: boolean;
  style?: CSSProperties;
  /** Receives the drag handle to place anywhere in the item. */
  children: (handle: ReactNode) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });
  const handle = (
    <ActionIcon
      variant="subtle"
      color="gray"
      size="sm"
      aria-label="Drag to reorder"
      disabled={disabled}
      className={disabled ? classes.gripOff : classes.grip}
      {...attributes}
      {...listeners}
    >
      <IconGripVertical size={14} />
    </ActionIcon>
  );
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 1 : undefined,
        position: 'relative',
        ...style,
      }}
    >
      {children(handle)}
    </div>
  );
}
