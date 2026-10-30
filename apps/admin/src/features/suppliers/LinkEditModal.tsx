import { Button, Checkbox, Group, Modal, NumberInput, Stack, Text, TextInput } from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { MoneyInput } from '~/components/MoneyInput';
import { notifyOk } from '~/features/categories/queries';
import { formatPrice } from '~/lib/format';
import { suppliersApi } from './api';
import { notifyApiError } from './errors';
import { optionsText } from './logic';
import { type SupplierLink, useInvalidateSuppliers } from './queries';

/** What the modal edits; `new` links come from the variant picker and have no saved values yet. */
export interface LinkDraft {
  variantId: string;
  productTitleEn: string;
  sku: string;
  options: SupplierLink['options'];
  supplierSku: string | null;
  costP: number | null;
  leadTimeDays: number | null;
  isDefault: boolean;
  variantCostP: number | null;
}

export function LinkEditModal({
  supplierId,
  link,
  isNew,
  onClose,
}: {
  supplierId: string;
  link: LinkDraft;
  isNew?: boolean;
  onClose: () => void;
}) {
  const invalidate = useInvalidateSuppliers();
  const [supplierSku, setSupplierSku] = useState(link.supplierSku ?? '');
  const [costP, setCostP] = useState<number | null>(link.costP ?? link.variantCostP);
  const [lead, setLead] = useState<number | string>(link.leadTimeDays ?? '');
  const [isDefault, setIsDefault] = useState(link.isDefault);

  const save = useMutation({
    mutationFn: () =>
      suppliersApi.upsertLink(supplierId, link.variantId, {
        supplierSku: supplierSku.trim() || null,
        costP,
        leadTimeDays: lead === '' ? null : Number(lead),
        isDefault,
      }),
    onSuccess: () => {
      notifyOk(isNew ? 'Product linked' : 'Link saved');
      invalidate();
      onClose();
    },
    onError: (e) => notifyApiError(e, 'Could not save the link'),
  });

  const opts = optionsText(link.options);
  return (
    <Modal opened onClose={onClose} title={isNew ? 'Link product' : 'Edit link'} centered>
      <Stack>
        <Text size="sm">
          <b>{link.productTitleEn}</b>
          {opts && ` (${opts})`}
          <span className="sub"> {link.sku}</span>
        </Text>
        <TextInput
          label="Supplier SKU"
          value={supplierSku}
          maxLength={80}
          onChange={(e) => setSupplierSku(e.currentTarget.value)}
        />
        <MoneyInput
          label="Cost per unit"
          description={
            link.variantCostP !== null
              ? `Our current cost: ${formatPrice(link.variantCostP)}`
              : undefined
          }
          value={costP}
          onChange={setCostP}
        />
        <NumberInput
          label="Lead time (days)"
          min={0}
          max={365}
          allowDecimal={false}
          value={lead}
          onChange={setLead}
        />
        <Checkbox
          label="Default supplier for this product"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.currentTarget.checked)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
