import { Banner, StatusBadge } from '@bdc/ui';
import { ActionIcon, Alert, Button, Group, Image, Modal, Stack, Text } from '@mantine/core';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ConfirmDelete } from '~/components/ConfirmDelete';
import { type Column, DataTable } from '~/components/DataTable';
import { PageHeader } from '~/components/PageHeader';
import { conflictBody } from '~/features/categories/http';
import { notifyError, notifyOk } from '~/features/categories/queries';
import { useCan } from '~/lib/perm';
import { brandsApi } from './api';
import { BrandModal } from './BrandModal';
import classes from './BrandsPage.module.css';
import { type Brand, brandsQuery, useInvalidateBrands } from './queries';

export function BrandsPage() {
  const canCreate = useCan('products.create');
  const canEdit = useCan('products.edit');
  const canDelete = useCan('products.delete');
  const invalidate = useInvalidateBrands();
  const list = useQuery(brandsQuery);
  const [form, setForm] = useState<{ brand: Brand | null } | null>(null);
  const [deleting, setDeleting] = useState<Brand | null>(null);
  const [forcing, setForcing] = useState<Brand | null>(null);

  const remove = useMutation({
    mutationFn: ({ brand, force }: { brand: Brand; force: boolean }) =>
      brandsApi.remove(brand.id, force),
    onSuccess: () => {
      notifyOk('Brand deleted');
      invalidate();
    },
  });

  async function confirmDelete(brand: Brand) {
    try {
      await remove.mutateAsync({ brand, force: false });
    } catch (e) {
      // 409: products still use it; offer to detach them and delete.
      if (conflictBody<unknown>(e)) setForcing(brand);
      else throw e;
    }
  }

  const columns: Column<Brand>[] = [
    {
      key: 'logo',
      header: '',
      width: 56,
      render: (b) =>
        b.logoUrl ? (
          <Image src={b.logoUrl} alt="" w={36} h={36} fit="contain" radius="sm" />
        ) : (
          <div className={classes.logo} />
        ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (b) => (
        <div>
          <Text size="sm" fw={500}>
            {b.nameEn}
          </Text>
          {b.nameBn && (
            <Text size="xs" c="dimmed" lang="bn">
              {b.nameBn}
            </Text>
          )}
        </div>
      ),
    },
    {
      key: 'slug',
      header: 'Slug',
      render: (b) => <span className={classes.mono}>{b.slug}</span>,
    },
    { key: 'products', header: 'Products', align: 'right', render: (b) => b.productCount },
    {
      key: 'active',
      header: 'Status',
      render: (b) => (
        <StatusBadge tone={b.active ? 'ok' : 'muted'}>
          {b.active ? 'Active' : 'Inactive'}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: 80,
      render: (b) => (
        <Group gap={4} wrap="nowrap" justify="flex-end">
          {canEdit && (
            <ActionIcon
              variant="subtle"
              aria-label={`Edit ${b.nameEn}`}
              onClick={() => setForm({ brand: b })}
            >
              <IconPencil size={16} />
            </ActionIcon>
          )}
          {canDelete && (
            <ActionIcon
              variant="subtle"
              color="red"
              aria-label={`Delete ${b.nameEn}`}
              onClick={() => setDeleting(b)}
            >
              <IconTrash size={16} />
            </ActionIcon>
          )}
        </Group>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Brands"
        crumbs={['Catalog', 'Brands']}
        description="Brands you can assign to products."
        actions={
          canCreate && (
            <Button
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={() => setForm({ brand: null })}
            >
              Add brand
            </Button>
          )
        }
      />
      {list.isError && <Banner tone="danger">{(list.error as Error).message}</Banner>}
      <DataTable
        columns={columns}
        rows={list.data}
        rowKey={(b) => b.id}
        loading={list.isLoading}
        emptyMessage="No brands yet."
      />

      {form && (
        <BrandModal
          key={form.brand?.id ?? 'new'}
          brand={form.brand}
          readOnly={form.brand ? !canEdit : !canCreate}
          onClose={() => setForm(null)}
        />
      )}

      <ConfirmDelete
        opened={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete brand"
        loading={remove.isPending}
        onConfirm={() => deleting && confirmDelete(deleting)}
      >
        Delete brand <b>{deleting?.nameEn}</b>?
      </ConfirmDelete>

      <Modal opened={!!forcing} onClose={() => setForcing(null)} title="Brand is in use" centered>
        <Stack>
          <Alert color="yellow" variant="light">
            <b>{forcing?.nameEn}</b> is used by {forcing?.productCount} product
            {forcing?.productCount === 1 ? '' : 's'}. Those products will be left without a brand.
          </Alert>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setForcing(null)}>
              Cancel
            </Button>
            <Button
              color="red"
              loading={remove.isPending}
              onClick={async () => {
                if (!forcing) return;
                try {
                  await remove.mutateAsync({ brand: forcing, force: true });
                  setForcing(null);
                } catch (e) {
                  notifyError(e, 'Could not delete the brand');
                }
              }}
            >
              Remove brand from products and delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
