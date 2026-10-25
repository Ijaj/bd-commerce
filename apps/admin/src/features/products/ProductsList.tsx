import { Icon, Toolbar } from '@bdc/ui';
import {
  ActionIcon,
  Button,
  Checkbox,
  Group,
  Menu,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import {
  IconArchive,
  IconArrowsSort,
  IconCopy,
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconPlus,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { ConfirmDelete } from '~/components/ConfirmDelete';
import { type Column, DataTable } from '~/components/DataTable';
import { PageHeader } from '~/components/PageHeader';
import { formatNumber, formatPrice } from '~/lib/format';
import { useCan } from '~/lib/perm';
import { useDeleteProduct, useProductActions } from './actions';
import { categoryOptions } from './categoryTree';
import { ProblemsModal } from './ProblemsModal';
import classes from './ProductsList.module.css';
import { brandsQuery, categoriesQuery, productListQuery } from './queries';
import { StatusBadge } from './StatusBadge';
import type { ProductListItem } from './types';

export interface ProductsSearch {
  q?: string;
  status?: 'draft' | 'active' | 'archived';
  category?: string;
  brand?: string;
  fulfillment?: 'stock' | 'dropship';
  upcoming?: boolean;
  preorder?: boolean;
  lowStock?: boolean;
  sort?: 'createdAt' | 'title' | 'price';
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined =>
  allowed.includes(v as T) ? (v as T) : undefined;
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const bool = (v: unknown) => (v === true || v === 'true' ? true : undefined);
const int = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

/** Router `validateSearch`: tolerant of hand-edited URLs, drops anything invalid. */
export function validateProductsSearch(s: Record<string, unknown>): ProductsSearch {
  return {
    q: str(s.q),
    status: oneOf(s.status, ['draft', 'active', 'archived'] as const),
    category: str(s.category),
    brand: str(s.brand),
    fulfillment: oneOf(s.fulfillment, ['stock', 'dropship'] as const),
    upcoming: bool(s.upcoming),
    preorder: bool(s.preorder),
    lowStock: bool(s.lowStock),
    sort: oneOf(s.sort, ['createdAt', 'title', 'price'] as const),
    order: oneOf(s.order, ['asc', 'desc'] as const),
    page: int(s.page),
    pageSize: int(s.pageSize),
  };
}

const SORTS = [
  { value: 'createdAt', label: 'Newest' },
  { value: 'title', label: 'Title' },
  { value: 'price', label: 'Price' },
];

function priceRange(p: ProductListItem) {
  if (p.minP === null || p.maxP === null) return '-';
  return p.minP === p.maxP
    ? formatPrice(p.minP)
    : `${formatPrice(p.minP)} - ${formatPrice(p.maxP)}`;
}

export function ProductsList({ search }: { search: ProductsSearch }) {
  const navigate = useNavigate();
  const canCreate = useCan('products.create');
  const canPublish = useCan('products.publish');
  const canDelete = useCan('products.delete');
  const actions = useProductActions((action, p) => {
    if (action === 'duplicate') navigate({ to: '/catalog/products/$id', params: { id: p.id } });
  });
  const del = useDeleteProduct();
  const [toDelete, setToDelete] = useState<ProductListItem | null>(null);
  const [blocked, setBlocked] = useState<ProductListItem | null>(null);

  const setSearch = (patch: Partial<ProductsSearch>, keepPage = false) =>
    navigate({
      to: '/catalog/products',
      search: (prev: ProductsSearch) => ({
        ...prev,
        ...patch,
        page: keepPage ? prev.page : undefined,
      }),
      replace: true,
    });

  const [qText, setQText] = useState(search.q ?? '');
  const [debouncedQ] = useDebouncedValue(qText, 300);
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the debounced text should trigger a navigation
  useEffect(() => {
    if ((debouncedQ || undefined) !== search.q) setSearch({ q: debouncedQ || undefined });
  }, [debouncedQ]);

  const sort = search.sort ?? 'createdAt';
  const order = search.order ?? (sort === 'title' ? 'asc' : 'desc');
  const page = search.page ?? 1;
  const pageSize = search.pageSize ?? 20;

  const list = useQuery({
    ...productListQuery({
      page,
      pageSize,
      q: search.q,
      status: search.status,
      categoryId: search.category,
      brandId: search.brand,
      fulfillment: search.fulfillment,
      isUpcoming: search.upcoming,
      isPreorder: search.preorder,
      lowStock: search.lowStock,
      sort,
      order,
    }),
    placeholderData: (prev) => prev,
  });
  const categories = useQuery(categoriesQuery);
  const brands = useQuery(brandsQuery);
  const categorySelect = useMemo(() => categoryOptions(categories.data), [categories.data]);
  const brandSelect = (brands.data ?? []).map((b) => ({ value: b.id, label: b.nameEn }));

  const edit = (id: string) => navigate({ to: '/catalog/products/$id', params: { id } });

  const columns: Column<ProductListItem>[] = [
    {
      key: 'title',
      header: 'Product',
      render: (p) => (
        <div className={classes.cell}>
          <span className={classes.thumb}>
            {p.thumbnailUrl ? (
              <img src={p.thumbnailUrl} alt="" />
            ) : (
              <Icon name="products" size={18} />
            )}
          </span>
          <div>
            <span className={classes.name}>{p.titleEn}</span>
            {p.titleBn && (
              <span className={classes.sub} lang="bn">
                {p.titleBn}
              </span>
            )}
          </div>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
    { key: 'brand', header: 'Brand', render: (p) => p.brand?.nameEn ?? '-' },
    { key: 'category', header: 'Category', render: (p) => p.primaryCategory.nameEn },
    { key: 'variants', header: 'Variants', align: 'right', render: (p) => p.variantCount },
    {
      key: 'price',
      header: 'Price',
      align: 'right',
      render: (p) => <b>{priceRange(p)}</b>,
    },
    {
      key: 'stock',
      header: 'Available',
      align: 'right',
      render: (p) => (
        <span className={p.totalAvailable <= 0 ? classes.out : undefined}>
          {formatNumber(p.totalAvailable, 0)}
        </span>
      ),
    },
    {
      key: 'updated',
      header: 'Updated',
      render: (p) => new Date(p.updatedAt).toLocaleDateString('en-GB', { dateStyle: 'medium' }),
    },
    {
      key: 'actions',
      header: '',
      width: 48,
      render: (p) => (
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={`Actions for ${p.titleEn}`}
              onClick={(e) => e.stopPropagation()}
            >
              <IconDotsVertical size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
            <Menu.Item leftSection={<IconEdit size={14} />} onClick={() => edit(p.id)}>
              Edit
            </Menu.Item>
            {canCreate && (
              <Menu.Item
                leftSection={<IconCopy size={14} />}
                onClick={() => actions.duplicate(p.id)}
              >
                Duplicate
              </Menu.Item>
            )}
            {canPublish && p.status !== 'active' && (
              <Menu.Item leftSection={<IconEye size={14} />} onClick={() => actions.publish(p.id)}>
                Publish
              </Menu.Item>
            )}
            {canPublish && p.status === 'active' && (
              <Menu.Item
                leftSection={<IconEyeOff size={14} />}
                onClick={() => actions.unpublish(p.id)}
              >
                Unpublish
              </Menu.Item>
            )}
            {canDelete && p.status !== 'archived' && (
              <Menu.Item
                leftSection={<IconArchive size={14} />}
                onClick={() => actions.archive(p.id)}
              >
                Archive
              </Menu.Item>
            )}
            {canDelete && (
              <>
                <Menu.Divider />
                <Menu.Item
                  color="red"
                  leftSection={<IconTrash size={14} />}
                  onClick={() => setToDelete(p)}
                >
                  Delete
                </Menu.Item>
              </>
            )}
          </Menu.Dropdown>
        </Menu>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Products"
        crumbs={['Catalog', 'Products']}
        description="Catalog items, variants and stock levels."
        actions={
          canCreate && (
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => navigate({ to: '/catalog/products/$id', params: { id: 'new' } })}
            >
              New product
            </Button>
          )
        }
      />

      <Toolbar className={classes.filters}>
        <TextInput
          placeholder="Search title or SKU"
          aria-label="Search products"
          leftSection={<IconSearch size={14} />}
          value={qText}
          onChange={(e) => setQText(e.currentTarget.value)}
          className="grow"
        />
        <Select
          placeholder="Status"
          aria-label="Status"
          clearable
          w={130}
          data={['draft', 'active', 'archived']}
          value={search.status ?? null}
          onChange={(v) => setSearch({ status: (v as ProductsSearch['status']) ?? undefined })}
        />
        <Select
          placeholder="Category"
          aria-label="Category"
          clearable
          searchable
          w={220}
          data={categorySelect}
          value={search.category ?? null}
          onChange={(v) => setSearch({ category: v ?? undefined })}
        />
        <Select
          placeholder="Brand"
          aria-label="Brand"
          clearable
          searchable
          w={160}
          data={brandSelect}
          value={search.brand ?? null}
          onChange={(v) => setSearch({ brand: v ?? undefined })}
        />
        <Select
          placeholder="Fulfillment"
          aria-label="Fulfillment"
          clearable
          w={140}
          data={[
            { value: 'stock', label: 'Stock' },
            { value: 'dropship', label: 'Dropship' },
          ]}
          value={search.fulfillment ?? null}
          onChange={(v) =>
            setSearch({ fulfillment: (v as ProductsSearch['fulfillment']) ?? undefined })
          }
        />
        <div className={classes.checks}>
          <Checkbox
            label="Upcoming"
            checked={!!search.upcoming}
            onChange={(e) => setSearch({ upcoming: e.currentTarget.checked || undefined })}
          />
          <Checkbox
            label="Pre-order"
            checked={!!search.preorder}
            onChange={(e) => setSearch({ preorder: e.currentTarget.checked || undefined })}
          />
          <Checkbox
            label="Low stock"
            checked={!!search.lowStock}
            onChange={(e) => setSearch({ lowStock: e.currentTarget.checked || undefined })}
          />
        </div>
        <div className={classes.sortGroup}>
          <Select
            aria-label="Sort by"
            w={120}
            allowDeselect={false}
            data={SORTS}
            value={sort}
            onChange={(v) => v && setSearch({ sort: v as ProductsSearch['sort'] })}
          />
          <ActionIcon
            variant="default"
            size="lg"
            aria-label={order === 'asc' ? 'Ascending' : 'Descending'}
            title={order === 'asc' ? 'Ascending' : 'Descending'}
            onClick={() => setSearch({ order: order === 'asc' ? 'desc' : 'asc' })}
          >
            <IconArrowsSort size={16} />
          </ActionIcon>
        </div>
      </Toolbar>

      <DataTable
        columns={columns}
        rows={list.data?.items}
        rowKey={(p) => p.id}
        loading={list.isLoading}
        emptyMessage="No products match these filters."
        page={page}
        pageSize={pageSize}
        total={list.data?.total}
        onPageChange={(p) => setSearch({ page: p === 1 ? undefined : p }, true)}
        onPageSizeChange={(n) => setSearch({ pageSize: n === 20 ? undefined : n })}
        onRowClick={(p) => edit(p.id)}
      />

      <ConfirmDelete
        opened={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Delete product"
        loading={del.isPending}
        onConfirm={async () => {
          if (!toDelete) return;
          const result = await del.mutateAsync(toDelete.id);
          if (result === 'blocked') setBlocked(toDelete);
        }}
      >
        Delete "{toDelete?.titleEn}" and all of its variants? This cannot be undone.
      </ConfirmDelete>

      <Modal
        opened={!!blocked}
        onClose={() => setBlocked(null)}
        title="Cannot delete"
        size="sm"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            "{blocked?.titleEn}" has stock history, so it cannot be deleted. Archive it instead to
            hide it from the shop and keep the records.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setBlocked(null)}>
              Cancel
            </Button>
            {blocked?.status !== 'archived' && (
              <Button
                onClick={() => {
                  if (blocked) actions.archive(blocked.id);
                  setBlocked(null);
                }}
              >
                Archive instead
              </Button>
            )}
          </Group>
        </Stack>
      </Modal>

      <ProblemsModal problems={actions.problems} onClose={actions.clearProblems} />
    </>
  );
}
