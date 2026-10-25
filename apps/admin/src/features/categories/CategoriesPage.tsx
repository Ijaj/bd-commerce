import { Banner, EmptyState, SectionCard } from '@bdc/ui';
import { Button, Loader } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { PageHeader } from '~/components/PageHeader';
import { useCan, useCanAny } from '~/lib/perm';
import { categoriesApi } from './api';
import { CategoryDrawer, type DrawerState } from './CategoryDrawer';
import { CategoryTree } from './CategoryTree';
import { DeleteCategoryModal } from './DeleteCategoryModal';
import { MoveCategoryModal } from './MoveCategoryModal';
import { categoriesListQuery, notifyError } from './queries';
import { buildTree } from './tree';
import type { Category } from './types';

export function CategoriesPage() {
  const qc = useQueryClient();
  const canCreate = useCan('categories.create');
  const canEdit = useCan('categories.edit');
  const canDelete = useCanAny('categories.delete', 'categories.delete_with_products');

  const list = useQuery(categoriesListQuery);
  const categories = list.data ?? [];
  const tree = useMemo(() => buildTree(categories), [categories]);
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [moving, setMoving] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const reorder = useMutation({
    mutationFn: (items: { id: string; sort: number }[]) => categoriesApi.reorder(items),
    onMutate: async (items) => {
      await qc.cancelQueries({ queryKey: categoriesListQuery.queryKey });
      const prev = qc.getQueryData<Category[]>(categoriesListQuery.queryKey);
      const sorts = new Map(items.map((i) => [i.id, i.sort]));
      qc.setQueryData<Category[]>(categoriesListQuery.queryKey, (old) =>
        old?.map((c) => (sorts.has(c.id) ? { ...c, sort: sorts.get(c.id) as number } : c)),
      );
      return { prev };
    },
    onError: (e, _items, ctx) => {
      notifyError(e, 'Could not reorder');
      if (ctx?.prev) qc.setQueryData(categoriesListQuery.queryKey, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });

  const toggle = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const parentIds = categories.filter((c) => c.childCount > 0).map((c) => c.id);

  return (
    <div>
      <PageHeader
        title="Categories"
        crumbs={['Catalog', 'Categories & attributes']}
        description="Up to 4 levels. Drag to reorder siblings; use the row menu to move, add a sub-category or delete."
        actions={
          <>
            <Button variant="default" size="xs" onClick={() => setCollapsed(new Set())}>
              Expand all
            </Button>
            <Button variant="default" size="xs" onClick={() => setCollapsed(new Set(parentIds))}>
              Collapse all
            </Button>
            {canCreate && (
              <Button
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={() => setDrawer({ mode: 'create', parentId: null })}
              >
                Add main category
              </Button>
            )}
          </>
        }
      />
      <SectionCard title="Category tree" flush>
        {list.isLoading && (
          <div className="a-empty" role="status" aria-label="Loading">
            <Loader size="sm" />
          </div>
        )}
        {list.isError && <Banner tone="danger">{(list.error as Error).message}</Banner>}
        {list.data && list.data.length === 0 && (
          <EmptyState icon="categories" title="No categories yet.">
            Add a main category to start building the tree.
          </EmptyState>
        )}
        {list.data && list.data.length > 0 && (
          <CategoryTree
            nodes={tree}
            byId={byId}
            actions={{
              canCreate,
              canEdit,
              canDelete,
              collapsed,
              onToggle: toggle,
              onEdit: (c) => setDrawer({ mode: 'edit', id: c.id }),
              onAddChild: (c) => setDrawer({ mode: 'create', parentId: c.id }),
              onMove: setMoving,
              onDelete: setDeleting,
              onReorder: (items) => reorder.mutate(items),
            }}
          />
        )}
      </SectionCard>

      <CategoryDrawer
        state={drawer}
        categories={categories}
        onChange={setDrawer}
        onClose={() => setDrawer(null)}
        onMove={setMoving}
      />
      <MoveCategoryModal
        category={moving}
        categories={categories}
        onClose={() => setMoving(null)}
      />
      <DeleteCategoryModal
        key={deleting?.id}
        category={deleting}
        categories={categories}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
