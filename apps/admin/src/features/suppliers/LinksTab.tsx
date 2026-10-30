import { SectionCard, StatusBadge } from '@bdc/ui';
import { Button } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { ConfirmAction } from '~/features/b2b/components';
import { notifyOk } from '~/features/categories/queries';
import { formatPrice } from '~/lib/format';
import { suppliersApi } from './api';
import { type LinkDraft, LinkEditModal } from './LinkEditModal';
import { LinkProductsModal } from './LinkProductsModal';
import { optionsText } from './logic';
import {
  linksQuery,
  type SupplierLink,
  useInvalidateSuppliers,
  type VariantOption,
} from './queries';
import classes from './suppliers.module.css';

type Editing = { link: LinkDraft; isNew: boolean };

function fromOption(v: VariantOption): Editing {
  return {
    isNew: !v.linked,
    link: {
      variantId: v.variantId,
      productTitleEn: v.productTitleEn,
      sku: v.sku,
      options: v.options,
      supplierSku: null,
      costP: v.lastCostP,
      leadTimeDays: null,
      isDefault: false,
      variantCostP: v.variantCostP,
    },
  };
}

export function LinksTab({ supplierId, canManage }: { supplierId: string; canManage: boolean }) {
  const invalidate = useInvalidateSuppliers();
  const links = useQuery(linksQuery(supplierId));
  const [editing, setEditing] = useState<Editing | null>(null);
  const [picking, setPicking] = useState(false);
  const [removing, setRemoving] = useState<SupplierLink | null>(null);

  const columns: Column<SupplierLink>[] = [
    {
      key: 'product',
      header: 'Product',
      render: (l) => (
        <div>
          <b>{l.productTitleEn}</b>
          {optionsText(l.options) && <span className="sub">{optionsText(l.options)}</span>}
        </div>
      ),
    },
    { key: 'sku', header: 'SKU', render: (l) => <span className={classes.mono}>{l.sku}</span> },
    { key: 'ssku', header: 'Supplier SKU', render: (l) => l.supplierSku ?? '-' },
    {
      key: 'cost',
      header: 'Supplier cost',
      className: 'num',
      render: (l) => (l.costP === null ? '-' : formatPrice(l.costP)),
    },
    {
      key: 'ours',
      header: 'Our current cost',
      className: 'num',
      render: (l) => (l.variantCostP === null ? '-' : formatPrice(l.variantCostP)),
    },
    {
      key: 'lead',
      header: 'Lead time',
      className: 'num',
      render: (l) => (l.leadTimeDays === null ? '-' : `${l.leadTimeDays} d`),
    },
    {
      key: 'flags',
      header: '',
      render: (l) => (
        <span style={{ display: 'inline-flex', gap: 4 }}>
          {l.isDefault && <StatusBadge tone="ok">Default</StatusBadge>}
          {l.fulfillment === 'dropship' && <StatusBadge tone="muted">Dropship</StatusBadge>}
        </span>
      ),
    },
    ...(canManage
      ? [
          {
            key: 'act',
            header: '',
            className: 'act',
            render: (l: SupplierLink) => (
              <span className={classes.rowActions}>
                <Button
                  size="compact-sm"
                  variant="default"
                  onClick={() => setEditing({ link: l, isNew: false })}
                >
                  Edit
                </Button>
                <Button
                  size="compact-sm"
                  variant="default"
                  color="red"
                  onClick={() => setRemoving(l)}
                >
                  Remove
                </Button>
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <SectionCard
      title="Linked products"
      flush
      actions={
        canManage && (
          <Button size="compact-sm" onClick={() => setPicking(true)}>
            Link products
          </Button>
        )
      }
    >
      <DataTable
        columns={columns}
        rows={links.data?.items}
        rowKey={(l) => l.variantId}
        loading={links.isLoading}
        emptyMessage="No products linked yet. Linked products fill in cost and lead time on purchase orders."
      />
      {picking && (
        <LinkProductsModal
          supplierId={supplierId}
          onClose={() => setPicking(false)}
          onPick={(v) => {
            const existing = links.data?.items.find((l) => l.variantId === v.variantId);
            setPicking(false);
            setEditing(existing ? { link: existing, isNew: false } : fromOption(v));
          }}
        />
      )}
      {editing && (
        <LinkEditModal
          supplierId={supplierId}
          link={editing.link}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmAction
        opened={!!removing}
        onClose={() => setRemoving(null)}
        title="Remove link"
        confirmLabel="Remove"
        color="red"
        onConfirm={async () => {
          if (!removing) return;
          await suppliersApi.removeLink(supplierId, removing.variantId);
          notifyOk('Link removed');
          invalidate();
        }}
      >
        Stop buying {removing?.productTitleEn} from this supplier? Existing purchase orders are not
        changed.
      </ConfirmAction>
    </SectionCard>
  );
}
