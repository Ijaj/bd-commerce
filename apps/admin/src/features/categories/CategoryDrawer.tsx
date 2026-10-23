import { Alert, Drawer, Loader, Tabs } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useCan } from '~/lib/perm';
import { AttributesPanel } from './AttributesPanel';
import { CategoryForm } from './CategoryForm';
import { categoryDetailQuery } from './queries';
import type { Category } from './types';

export type DrawerState =
  | { mode: 'create'; parentId: string | null }
  | { mode: 'edit'; id: string };

/** Side panel: category details form plus (for existing categories) the attributes tab. */
export function CategoryDrawer({
  state,
  categories,
  onChange,
  onClose,
  onMove,
}: {
  state: DrawerState | null;
  categories: Category[];
  onChange: (s: DrawerState) => void;
  onClose: () => void;
  onMove: (c: Category) => void;
}) {
  const [saves, setSaves] = useState(0);
  const canEdit = useCan('categories.edit');
  const canCreate = useCan('categories.create');
  const editId = state?.mode === 'edit' ? state.id : undefined;
  const detail = useQuery({ ...categoryDetailQuery(editId as string), enabled: !!editId });
  const parent =
    state?.mode === 'create' ? (categories.find((c) => c.id === state.parentId) ?? null) : null;

  const title =
    state?.mode === 'create'
      ? parent
        ? `New sub-category of ${parent.nameEn}`
        : 'New main category'
      : (detail.data?.nameEn ?? 'Category');

  return (
    <Drawer
      opened={!!state}
      onClose={onClose}
      position="right"
      size="xl"
      title={title}
      keepMounted={false}
    >
      {state?.mode === 'create' && (
        <CategoryForm
          key={`new-${parent?.id ?? 'root'}`}
          category={null}
          parent={parent}
          categories={categories}
          readOnly={!canCreate}
          onMove={() => {}}
          onSaved={(c) => onChange({ mode: 'edit', id: c.id })}
        />
      )}
      {state?.mode === 'edit' && detail.isLoading && <Loader size="sm" />}
      {state?.mode === 'edit' && detail.isError && (
        <Alert color="red">{(detail.error as Error).message}</Alert>
      )}
      {state?.mode === 'edit' && detail.data && (
        <Tabs defaultValue="details" keepMounted>
          <Tabs.List mb="md">
            <Tabs.Tab value="details">Details</Tabs.Tab>
            <Tabs.Tab value="attributes">
              Attributes ({detail.data.attributes.length + detail.data.inheritedAttributes.length})
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="details">
            <CategoryForm
              key={`${detail.data.id}-${saves}`}
              category={detail.data}
              parent={null}
              categories={categories}
              readOnly={!canEdit}
              onMove={() => onMove(detail.data)}
              onSaved={() => setSaves((n) => n + 1)}
            />
          </Tabs.Panel>
          <Tabs.Panel value="attributes">
            <AttributesPanel category={detail.data} canEdit={canEdit} />
          </Tabs.Panel>
        </Tabs>
      )}
    </Drawer>
  );
}
