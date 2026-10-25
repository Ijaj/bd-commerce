import {
  Button,
  Group,
  Modal,
  NumberInput,
  Radio,
  Stack,
  Table,
  Text,
  Textarea,
} from '@mantine/core';
import { useState } from 'react';
import { MoneyInput } from '~/components/MoneyInput';
import { notifyOk } from '~/features/categories/queries';
import { formatPrice } from '~/lib/format';
import { returnsApi } from './api';
import { notifyReturnError } from './errors';
import {
  type OrderDetail,
  type RefundMethod,
  type ReturnDetail,
  useInvalidateReturns,
} from './queries';

export type RefundTarget =
  | { kind: 'return'; ret: ReturnDetail }
  | { kind: 'order'; order: OrderDetail };

function MethodField({
  value,
  onChange,
}: {
  value: RefundMethod;
  onChange: (m: RefundMethod) => void;
}) {
  return (
    <Radio.Group label="Refund to" value={value} onChange={(v) => onChange(v as RefundMethod)}>
      <Group mt={4}>
        <Radio value="original" label="Original payment" />
        <Radio value="wallet" label="Wallet credit" />
      </Group>
    </Radio.Group>
  );
}

/** Return refunds take their amount from the inspected lines; order refunds pick lines and/or an amount. */
export function RefundFormModal({
  target,
  opened,
  onClose,
}: {
  target: RefundTarget;
  opened: boolean;
  onClose: () => void;
}) {
  const invalidate = useInvalidateReturns();
  const [method, setMethod] = useState<RefundMethod>('original');
  const [note, setNote] = useState('');
  const [qty, setQty] = useState<Record<string, number>>({});
  const [amountP, setAmountP] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const isReturn = target.kind === 'return';
  const picked = isReturn
    ? []
    : target.order.items
        .filter((l) => (qty[l.id] ?? 0) > 0)
        .map((l) => ({ orderItemId: l.id, qty: qty[l.id] ?? 0 }));
  const noteMissing = !isReturn && !note.trim();
  const nothing = !isReturn && picked.length === 0 && amountP === null;

  async function submit() {
    setBusy(true);
    try {
      if (target.kind === 'return') {
        await returnsApi.refundReturn(target.ret.id, { method, note: note.trim() || undefined });
      } else {
        await returnsApi.refundOrder(target.order.id, {
          method,
          note: note.trim(),
          items: picked.length ? picked : undefined,
          amountP: amountP ?? undefined,
        });
      }
      invalidate();
      notifyOk('Refund created');
      onClose();
    } catch (e) {
      notifyReturnError(e, 'Could not create the refund');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isReturn ? 'Refund return' : 'Refund order'}
      size="lg"
      centered
    >
      <Stack>
        {target.kind === 'return' ? (
          <Text size="sm">
            Refunds the returned lines of {target.ret.returnNo}
            {target.ret.fault === 'customer' && target.ret.returnShippingP > 0
              ? `, minus ${formatPrice(target.ret.returnShippingP)} return shipping (customer fault)`
              : ''}
            . Lines value: {formatPrice(target.ret.items.reduce((s, i) => s + i.refundValueP, 0))}.
          </Text>
        ) : (
          <>
            <Text size="sm" c="dimmed">
              Pick lines to refund pro rata, and/or type an amount. Paid so far:{' '}
              {formatPrice(target.order.money.paidP)}, already refunded:{' '}
              {formatPrice(target.order.money.refundedP)}.
            </Text>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Item</Table.Th>
                  <Table.Th ta="right">Ordered</Table.Th>
                  <Table.Th w={110}>Refund qty</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {target.order.items.map((l) => (
                  <Table.Tr key={l.id}>
                    <Table.Td>
                      <Text size="sm">{l.titleSnapshot}</Text>
                      <Text size="xs" c="dimmed">
                        {l.sku}
                        {l.optionsText ? ` · ${l.optionsText}` : ''}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right">{l.qty}</Table.Td>
                    <Table.Td>
                      <NumberInput
                        aria-label={`Refund qty for ${l.titleSnapshot}`}
                        min={0}
                        max={l.qty}
                        allowDecimal={false}
                        value={qty[l.id] ?? 0}
                        onChange={(v) => setQty({ ...qty, [l.id]: Number(v) || 0 })}
                      />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            <MoneyInput
              label="Amount (optional)"
              description="Leave empty to refund the picked lines pro rata. Typing a value overrides it."
              value={amountP}
              onChange={setAmountP}
            />
          </>
        )}
        <MethodField value={method} onChange={setMethod} />
        {method === 'wallet' && (
          <Text size="xs" c="dimmed">
            Wallet refunds are only recorded for now; there is no wallet ledger until a later step.
          </Text>
        )}
        <Textarea
          label={isReturn ? 'Note (optional)' : 'Reason'}
          required={!isReturn}
          autosize
          minRows={2}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button loading={busy} disabled={noteMissing || nothing} onClick={submit}>
            Create refund
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
