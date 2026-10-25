import { Alert, Button, Group, Menu, Modal, Select, Stack, Text } from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { errorCode, friendlyMessage, notifyApiError } from '~/features/b2b/errors';
import { notifyOk } from '~/features/categories/queries';
import { formatPrice } from '~/lib/format';
import { useCan } from '~/lib/perm';
import { shipmentsApi } from './api';
import { allowedActions, COURIER_OPTIONS, needsManualCancel, type Shipment } from './logic';
import { useInvalidateShipments } from './queries';

type Dialog = 'book' | 'rebook' | 'cancel' | 'handover' | null;

/** Row menu for one shipment: only the actions its status and the staff's permission allow. */
export function ShipmentActions({ shipment }: { shipment: Shipment }) {
  const canManage = useCan('shipments.manage');
  const invalidate = useInvalidateShipments();
  const [dialog, setDialog] = useState<Dialog>(null);
  const actions = allowedActions(shipment.status);

  const sync = useMutation({
    mutationFn: () => shipmentsApi.sync(shipment.id),
    onSuccess: (r) => {
      notifyOk(r.changed ? `Status updated: ${r.rawStatus}` : `No change (${r.rawStatus})`);
      invalidate();
    },
    onError: (e) => notifyApiError(e, 'Sync failed'),
  });

  if (!canManage || actions.length === 0) return null;
  const has = (a: (typeof actions)[number]) => actions.includes(a);

  return (
    <>
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <Button size="compact-sm" variant="light" loading={sync.isPending}>
            Actions
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          {has('book') && <Menu.Item onClick={() => setDialog('book')}>Book courier</Menu.Item>}
          {has('handover') && (
            <Menu.Item onClick={() => setDialog('handover')}>Mark handed over</Menu.Item>
          )}
          {has('sync') && <Menu.Item onClick={() => sync.mutate()}>Sync status</Menu.Item>}
          {has('label') && (
            <Menu.Item
              component="a"
              href={`/print/label/${shipment.id}`}
              target="_blank"
              rel="noopener"
            >
              Print label
            </Menu.Item>
          )}
          {has('rebook') && (
            <Menu.Item onClick={() => setDialog('rebook')}>
              {shipment.status === 'ready' ? 'Book with another courier' : 'Rebook'}
            </Menu.Item>
          )}
          {has('cancel') && (
            <Menu.Item color="red" onClick={() => setDialog('cancel')}>
              Cancel shipment
            </Menu.Item>
          )}
        </Menu.Dropdown>
      </Menu>

      <CourierDialog
        opened={dialog === 'book' || dialog === 'rebook'}
        mode={dialog === 'rebook' ? 'rebook' : 'book'}
        shipment={shipment}
        onClose={() => setDialog(null)}
        onDone={invalidate}
      />
      <CancelDialog
        opened={dialog === 'cancel'}
        shipment={shipment}
        onClose={() => setDialog(null)}
        onDone={invalidate}
      />
      <HandoverDialog
        opened={dialog === 'handover'}
        shipment={shipment}
        onClose={() => setDialog(null)}
        onDone={invalidate}
      />
    </>
  );
}

interface DialogProps {
  opened: boolean;
  shipment: Shipment;
  onClose: () => void;
  onDone: () => void;
}

function CourierDialog({
  mode,
  ...p
}: DialogProps & {
  mode: 'book' | 'rebook';
}) {
  const [courier, setCourier] = useState<string | null>(p.shipment.courier?.code ?? 'steadfast');
  // Rebooking a booked shipment cancels the live booking first; real couriers may refuse.
  const [manualNeeded, setManualNeeded] = useState(false);
  const run = useMutation({
    mutationFn: (manualCancel: boolean) =>
      mode === 'book'
        ? shipmentsApi.book(p.shipment.id, courier as string)
        : shipmentsApi.rebook(p.shipment.id, {
            courierCode: courier ?? undefined,
            manualCancel: manualCancel || undefined,
          }),
    onSuccess: () => {
      notifyOk(mode === 'book' ? 'Courier booked' : 'Rebooked');
      setManualNeeded(false);
      p.onDone();
      p.onClose();
    },
    onError: (e) => {
      if (needsManualCancel(errorCode(e))) setManualNeeded(true);
      else notifyApiError(e, 'Booking failed');
    },
  });

  return (
    <Modal
      opened={p.opened}
      onClose={p.onClose}
      title={mode === 'book' ? 'Book courier' : 'Rebook shipment'}
    >
      <Stack>
        <Text size="sm">
          {p.shipment.shipmentNo} for order {p.shipment.orderNo}. Cash to collect:{' '}
          {formatPrice(p.shipment.codAmountP)}.
        </Text>
        <Select
          label="Courier"
          data={COURIER_OPTIONS}
          value={courier}
          onChange={setCourier}
          allowDeselect={false}
        />
        {manualNeeded && (
          <Alert color="orange">
            This courier cannot cancel the old booking through its API. Cancel it in the courier's
            own panel first, then confirm below.
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={p.onClose}>
            Close
          </Button>
          {manualNeeded ? (
            <Button color="orange" loading={run.isPending} onClick={() => run.mutate(true)}>
              I cancelled it manually, continue
            </Button>
          ) : (
            <Button loading={run.isPending} disabled={!courier} onClick={() => run.mutate(false)}>
              {mode === 'book' ? 'Book' : 'Rebook'}
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}

function CancelDialog(p: DialogProps) {
  const [manualNeeded, setManualNeeded] = useState<string | null>(null);
  const run = useMutation({
    mutationFn: (manual: boolean) => shipmentsApi.cancel(p.shipment.id, manual),
    onSuccess: () => {
      notifyOk('Shipment cancelled');
      setManualNeeded(null);
      p.onDone();
      p.onClose();
    },
    onError: (e) => {
      if (needsManualCancel(errorCode(e))) setManualNeeded(friendlyMessage(e, 'Courier refused'));
      else notifyApiError(e, 'Cancel failed');
    },
  });

  return (
    <Modal opened={p.opened} onClose={p.onClose} title="Cancel shipment">
      <Stack>
        <Text size="sm">
          Cancel {p.shipment.shipmentNo}? The items go back to the order so they can be shipped
          again.
        </Text>
        {manualNeeded && (
          <Alert color="orange" title="The courier could not cancel it">
            {manualNeeded} Cancel the parcel in the courier's own panel, then mark it cancelled
            here.
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={p.onClose}>
            Keep shipment
          </Button>
          {manualNeeded ? (
            <Button color="red" loading={run.isPending} onClick={() => run.mutate(true)}>
              Mark cancelled manually
            </Button>
          ) : (
            <Button color="red" loading={run.isPending} onClick={() => run.mutate(false)}>
              Cancel shipment
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}

function HandoverDialog(p: DialogProps) {
  const run = useMutation({
    mutationFn: () => shipmentsApi.handover(p.shipment.id),
    onSuccess: () => {
      notifyOk('Marked as handed over');
      p.onDone();
      p.onClose();
    },
    onError: (e) => notifyApiError(e, 'Handover failed'),
  });
  return (
    <Modal opened={p.opened} onClose={p.onClose} title="Mark handed over">
      <Stack>
        <Text size="sm">
          Confirm the courier has collected {p.shipment.shipmentNo}. Stock for these items is
          deducted now and this cannot be undone.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={p.onClose}>
            Close
          </Button>
          <Button loading={run.isPending} onClick={() => run.mutate()}>
            Handed over
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
