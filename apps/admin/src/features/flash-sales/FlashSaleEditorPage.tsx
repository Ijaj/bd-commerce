import { Alert, Button, Divider, Group, Loader, Text, Title } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { ConfirmDelete } from '~/components/ConfirmDelete';
import { PageHeader } from '~/components/PageHeader';
import { notifyOk } from '~/features/categories/queries';
import { formatDateTime } from '~/lib/format';
import { useCan } from '~/lib/perm';
import { flashApi } from './api';
import { FlashItemsEditor } from './FlashItemsEditor';
import { flashErrorMessage } from './logic';
import { PhaseBadge } from './PhaseBadge';
import { flashDetailQuery, useInvalidateFlash } from './queries';
import { SaleDetailsForm } from './SaleDetailsForm';

/** `id` empty = create form; after saving it moves to the edit page where items are managed. */
export function FlashSaleEditorPage({ id }: { id?: string }) {
  const navigate = useNavigate();
  const canManage = useCan('flash_sales.manage');
  const invalidate = useInvalidateFlash();
  const [deleting, setDeleting] = useState(false);
  const detail = useQuery({ ...flashDetailQuery(id ?? ''), enabled: !!id });

  const remove = useMutation({
    mutationFn: () => flashApi.remove(id as string),
    onSuccess: () => {
      notifyOk('Flash sale deleted');
      invalidate();
      navigate({ to: '/promotions/flash-sales' });
    },
  });

  const back = (
    <Button
      component={Link}
      to="/promotions/flash-sales"
      variant="subtle"
      size="xs"
      leftSection={<IconArrowLeft size={14} />}
      mb="xs"
    >
      All flash sales
    </Button>
  );

  if (!id) {
    return (
      <>
        {back}
        <PageHeader
          title="New flash sale"
          description="Items are added after the sale is created."
        />
        <SaleDetailsForm
          canManage={canManage}
          onCreated={(newId) =>
            navigate({ to: '/promotions/flash-sales/$id', params: { id: newId } })
          }
        />
      </>
    );
  }

  if (detail.isLoading) return <Loader />;
  if (detail.error || !detail.data) {
    return (
      <Alert color="red" role="alert">
        {flashErrorMessage(detail.error, 'Could not load this flash sale')}
      </Alert>
    );
  }
  const sale = detail.data;

  return (
    <>
      {back}
      <PageHeader
        title={sale.nameEn}
        description={`${formatDateTime(sale.startsAt)} to ${formatDateTime(sale.endsAt)}`}
        actions={
          <>
            <PhaseBadge phase={sale.phase} />
            {canManage && (
              <Button color="red" variant="light" onClick={() => setDeleting(true)}>
                Delete
              </Button>
            )}
          </>
        }
      />
      <Group gap="xl" mb="md">
        <Text size="sm">Items: {sale.itemCount}</Text>
        <Text size="sm">Units sold: {sale.unitsSold}</Text>
      </Group>
      {/* key: a save from elsewhere (or the server normalising dates) must reset the form */}
      <SaleDetailsForm
        key={`${sale.startsAt}|${sale.endsAt}|${sale.nameEn}|${sale.isActive}`}
        sale={sale}
        canManage={canManage}
      />
      <Divider my="xl" />
      <Title order={3} mb="sm">
        Items
      </Title>
      <FlashItemsEditor
        key={sale.items.map((i) => `${i.id}:${i.qtySold}`).join(',')}
        sale={sale}
        canManage={canManage}
      />
      <ConfirmDelete
        opened={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => remove.mutateAsync()}
        loading={remove.isPending}
        title="Delete flash sale"
      >
        Delete "{sale.nameEn}"? A sale that already has sales cannot be deleted; deactivate it
        instead.
      </ConfirmDelete>
    </>
  );
}
