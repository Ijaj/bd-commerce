import { Banner } from '@bdc/ui';
import { ActionIcon, Alert, Badge, Button, Group, Tooltip } from '@mantine/core';
import { IconMapPin, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ConfirmDelete } from '~/components/ConfirmDelete';
import { type Column, DataTable } from '~/components/DataTable';
import { PageHeader } from '~/components/PageHeader';
import { notifyOk } from '~/features/categories/queries';
import { formatPrice } from '~/lib/format';
import { useCan } from '~/lib/perm';
import { deliveryApi } from './api';
import { LocationsModal } from './LocationsModal';
import { freeLabel, gramsToKg } from './logic';
import { useInvalidateZones, type Zone, zonesQuery } from './queries';
import { ZoneModal } from './ZoneModal';

function coverage(z: Zone): string {
  if (z.locations.length === 0) return z.isDefault ? 'Everywhere else' : 'No places yet';
  const shown = z.locations
    .slice(0, 3)
    .map((l) => l.nameEn)
    .join(', ');
  const more = z.locations.length - 3;
  return more > 0 ? `${shown} +${more} more` : shown;
}

export function DeliveryPage() {
  const canManage = useCan('delivery.manage');
  const invalidate = useInvalidateZones();
  const list = useQuery(zonesQuery);
  const [form, setForm] = useState<{ zone: Zone | null } | null>(null);
  const [coverageOf, setCoverageOf] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Zone | null>(null);

  const remove = useMutation({
    mutationFn: (z: Zone) => deliveryApi.remove(z.id),
    onSuccess: () => {
      notifyOk('Zone deleted');
      invalidate();
    },
  });

  const columns: Column<Zone>[] = [
    {
      key: 'name',
      header: 'Zone',
      render: (z) => (
        <div>
          <Group gap={6}>
            <b>{z.nameEn}</b>
            {z.isDefault && (
              <Badge size="sm" color="blue">
                Default
              </Badge>
            )}
          </Group>
          {z.nameBn && (
            <span className="sub" lang="bn">
              {z.nameBn}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'base',
      header: 'Base charge',
      align: 'right',
      render: (z) => formatPrice(z.baseChargeP),
    },
    {
      key: 'weight',
      header: 'Base weight',
      align: 'right',
      render: (z) => `${gramsToKg(z.baseWeightG)} kg`,
    },
    {
      key: 'extra',
      header: 'Extra / kg',
      align: 'right',
      render: (z) => formatPrice(z.extraPerKgP),
    },
    { key: 'eta', header: 'ETA', render: (z) => `${z.etaMinDays}-${z.etaMaxDays} days` },
    {
      key: 'free',
      header: 'Free delivery',
      render: (z) => (
        <Badge
          size="sm"
          color={z.freeAboveP === null ? 'gray' : z.freeAboveP === 0 ? 'green' : 'blue'}
        >
          {freeLabel(z.freeAboveP, formatPrice)}
        </Badge>
      ),
    },
    {
      key: 'coverage',
      header: 'Coverage',
      render: (z) => <span className="a-muted a-sm">{coverage(z)}</span>,
    },
    { key: 'orders', header: 'Orders', align: 'right', render: (z) => z.orderCount },
  ];
  if (canManage) {
    columns.push({
      key: 'actions',
      header: '',
      width: 120,
      render: (z) => (
        <Group gap={4} wrap="nowrap" justify="flex-end">
          <Tooltip label="Coverage">
            <ActionIcon
              variant="subtle"
              aria-label={`Coverage of ${z.nameEn}`}
              onClick={() => setCoverageOf(z.id)}
            >
              <IconMapPin size={16} />
            </ActionIcon>
          </Tooltip>
          <ActionIcon
            variant="subtle"
            aria-label={`Edit ${z.nameEn}`}
            onClick={() => setForm({ zone: z })}
          >
            <IconPencil size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            aria-label={`Delete ${z.nameEn}`}
            onClick={() => setDeleting(z)}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      ),
    });
  }

  const noDefault = list.data && list.data.length > 0 && !list.data.some((z) => z.isDefault);

  return (
    <div>
      <PageHeader
        title="Delivery zones"
        crumbs={['People & partners', 'Delivery & couriers']}
        description="One delivery charge per order. Free delivery: never, always, or above a subtotal."
        actions={
          canManage && (
            <Button leftSection={<IconPlus size={15} />} onClick={() => setForm({ zone: null })}>
              Add zone
            </Button>
          )
        }
      />
      {list.isError && <Alert color="red">{(list.error as Error).message}</Alert>}
      {noDefault && (
        <Banner tone="warn" icon="warn">
          No default zone. Customers outside every zone's coverage cannot check out.
        </Banner>
      )}
      <DataTable
        columns={columns}
        rows={list.data}
        rowKey={(z) => z.id}
        loading={list.isLoading}
        emptyMessage="No delivery zones yet. Checkout needs at least a default zone."
      />

      {form && (
        <ZoneModal key={form.zone?.id ?? 'new'} zone={form.zone} onClose={() => setForm(null)} />
      )}
      {coverageOf && <LocationsModal zoneId={coverageOf} onClose={() => setCoverageOf(null)} />}

      <ConfirmDelete
        opened={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete zone"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutateAsync(deleting)}
      >
        Delete zone <b>{deleting?.nameEn}</b>? Its places fall back to the default zone. A zone with
        orders or the default zone cannot be deleted.
      </ConfirmDelete>
    </div>
  );
}
