import { Alert, Button, Loader, Modal, Stack, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { optionsText } from './logic';
import { type VariantOption, variantOptionsQuery } from './queries';
import classes from './suppliers.module.css';

/** Search the catalog for variants to link. Already linked and dropship variants are disabled. */
export function LinkProductsModal({
  supplierId,
  onPick,
  onClose,
}: {
  supplierId: string;
  onPick: (v: VariantOption) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [debounced] = useDebouncedValue(q.trim(), 300);
  const res = useQuery(variantOptionsQuery(supplierId, debounced));

  return (
    <Modal opened onClose={onClose} title="Link products" size="lg" centered>
      <Stack>
        <TextInput
          label="Search products"
          placeholder="Product name or SKU"
          data-autofocus
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
        />
        {res.isError && <Alert color="red">{(res.error as Error).message}</Alert>}
        <div className={classes.pickList}>
          {res.isLoading && (
            <div className={classes.pickRow}>
              <Loader size="sm" />
            </div>
          )}
          {res.data?.length === 0 && (
            <div className={classes.pickRow}>
              <span className={classes.muted}>No matching products.</span>
            </div>
          )}
          {res.data?.map((v) => {
            const dropship = v.fulfillment === 'dropship';
            const opts = optionsText(v.options);
            return (
              <div key={v.variantId} className={classes.pickRow}>
                <div>
                  <b>{v.productTitleEn}</b>
                  {opts && (
                    <Text span size="sm">
                      {' '}
                      ({opts})
                    </Text>
                  )}
                  <div className={`${classes.muted} ${classes.small}`}>
                    {v.sku}
                    {dropship && ' · dropship: not on POs'}
                  </div>
                </div>
                <Button
                  size="compact-sm"
                  variant={v.linked ? 'default' : 'filled'}
                  disabled={dropship}
                  onClick={() => onPick(v)}
                >
                  {v.linked ? 'Edit link' : 'Link'}
                </Button>
              </div>
            );
          })}
        </div>
      </Stack>
    </Modal>
  );
}
