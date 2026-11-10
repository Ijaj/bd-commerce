import { Banner, SectionCard } from '@bdc/ui';
import { Button, Group, Loader, Modal, Textarea } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { notifyError, notifyOk } from '~/features/categories/queries';
import { ordersApi } from './api';
import { buildEditBody, hasChanges, initialDraft } from './edit-logic';
import { OrderEditLines } from './OrderEditLines';
import { OrderEditShip } from './OrderEditShip';
import { OrderEditTotals } from './OrderEditTotals';
import { type OrderDetail, useInvalidateOrders } from './queries';

/**
 * Edit before hand-off: lines, quantities, ship-to. The server prices a preview (same code as the
 * save, rolled back) so the totals shown are exactly what Save stores.
 */
export function OrderEditModal({
  order,
  opened,
  onClose,
}: {
  order: OrderDetail;
  opened: boolean;
  onClose: () => void;
}) {
  const invalidate = useInvalidateOrders();
  const [draft, setDraft] = useState(() => initialDraft(order));
  const [busy, setBusy] = useState(false);
  // Start from the order each time the modal opens, but never reset a draft mid-edit when the
  // order query refetches in the background.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only reset on open
  useEffect(() => {
    if (opened) setDraft(initialDraft(order));
  }, [opened]);

  const body = buildEditBody(draft, order);
  const changed = hasChanges(body);
  // The reason is not part of the pricing: leave it out so typing it does not re-run the preview.
  const { note: _note, ...pricing } = body;
  const [debounced] = useDebouncedValue(JSON.stringify(pricing), 400);
  const preview = useQuery({
    queryKey: ['orders', 'edit-preview', order.id, debounced],
    queryFn: () => ordersApi.editPreview(order.id, JSON.parse(debounced)),
    enabled: opened && changed,
    retry: false,
    gcTime: 0,
    placeholderData: keepPreviousData,
  });
  const empty = draft.lines.every((l) => l.qty === 0);
  const stale = debounced !== JSON.stringify(pricing) || preview.isFetching;

  async function save() {
    setBusy(true);
    try {
      await ordersApi.edit(order.id, body);
      notifyOk('Order updated');
      invalidate();
      onClose();
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={`Edit ${order.orderNo}`} size="xl" centered>
      <p className="sub">
        Items you do not change keep the price the customer ordered at. Added items are priced at
        today&apos;s price. Coupons, offers and delivery are worked out again.
      </p>
      <SectionCard title="Items">
        <OrderEditLines lines={draft.lines} onChange={(lines) => setDraft({ ...draft, lines })} />
      </SectionCard>
      <SectionCard title="Ship to">
        <OrderEditShip
          value={draft.ship}
          placeText={order.shipTo.placeText}
          onChange={(ship) => setDraft({ ...draft, ship })}
        />
      </SectionCard>
      <SectionCard title="New totals">
        {!changed && <div className="sub">Change something to see the new totals.</div>}
        {empty && changed && (
          <Banner tone="danger">
            An order cannot be empty. Cancel the order instead of removing every item.
          </Banner>
        )}
        {changed && preview.isError && !empty && (
          <Banner tone="danger">{(preview.error as Error).message}</Banner>
        )}
        {changed && preview.data && !(preview.isError && !empty) && (
          <OrderEditTotals preview={preview.data} />
        )}
        {changed && preview.isFetching && <Loader size="xs" aria-label="Calculating" />}
      </SectionCard>
      <Textarea
        label="Reason (kept in the edit history)"
        maxLength={500}
        autosize
        minRows={2}
        value={draft.note}
        onChange={(e) => setDraft({ ...draft, note: e.currentTarget.value })}
      />
      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose} disabled={busy}>
          Close
        </Button>
        <Button
          loading={busy}
          disabled={!changed || empty || preview.isError || stale || !preview.data}
          onClick={save}
        >
          Save changes
        </Button>
      </Group>
    </Modal>
  );
}
