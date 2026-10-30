import { Alert, Button, Group, Modal, NumberInput, Stack, Text, TextInput } from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { notifyOk } from '~/features/categories/queries';
import { formatPrice } from '~/lib/format';
import { poApi } from './api';
import { notifyPoError } from './errors';
import { clampReceive, costAfterP, optionText } from './logic';
import { type PoDetail, useInvalidatePo } from './queries';

type Entry = { good: number; rejected: number };

/** Receive goods: good goes to stock, rejected is recorded but not stocked. Capped at what is outstanding. */
export function ReceiveModal({ po, onClose }: { po: PoDetail; onClose: () => void }) {
  const invalidate = useInvalidatePo();
  const [entries, setEntries] = useState<Record<string, Entry>>(() =>
    Object.fromEntries(po.items.map((i) => [i.id, { good: i.remaining, rejected: 0 }])),
  );
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const receive = useMutation({
    mutationFn: () => {
      const items = po.items
        .map((i) => ({
          poItemId: i.id,
          qtyGood: entries[i.id]?.good ?? 0,
          qtyRejected: entries[i.id]?.rejected ?? 0,
        }))
        .filter((l) => l.qtyGood + l.qtyRejected > 0);
      return poApi.receive(po.id, { ...(note.trim() ? { note: note.trim() } : {}), items });
    },
    onSuccess: async () => {
      await invalidate();
      notifyOk('Goods received, stock updated');
      onClose();
    },
    onError: (e) => notifyPoError(e, 'Could not record the receipt'),
  });

  function confirm() {
    const any = po.items.some((i) => {
      const e = entries[i.id];
      return e && e.good + e.rejected > 0;
    });
    if (!any) return setError('Enter a good or rejected quantity for at least one line.');
    setError(null);
    receive.mutate();
  }

  function edit(id: string, remaining: number, which: 'good' | 'rejected', v: string | number) {
    setEntries((prev) => {
      const cur = prev[id] ?? { good: 0, rejected: 0 };
      const next = clampReceive(
        remaining,
        which,
        typeof v === 'number' ? v : Number(v),
        which === 'good' ? cur.rejected : cur.good,
      );
      return { ...prev, [id]: next };
    });
  }

  return (
    <Modal opened onClose={onClose} title={`Receive goods: ${po.poNo}`} size="xl" centered>
      <Stack>
        <Text size="sm" c="dimmed">
          Enter what actually arrived. Good units go into stock now and update the average cost;
          rejected units are recorded but not stocked. The supplier is owed for good units only.
        </Text>
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>Product</th>
                <th className="num">Ordered</th>
                <th className="num">Already received</th>
                <th className="num">Good</th>
                <th className="num">Rejected</th>
                <th className="num">Stock after</th>
                <th className="num">Cost after</th>
              </tr>
            </thead>
            <tbody>
              {po.items.map((i) => {
                const e = entries[i.id] ?? { good: 0, rejected: 0 };
                const after = costAfterP(i.variantCostP, i.onHand, e.good, i.unitCostP);
                return (
                  <tr key={i.id}>
                    <td>
                      {i.productTitleEn}
                      {optionText(i.options)}
                      <span className="sub">{i.sku}</span>
                    </td>
                    <td className="num">{i.qtyOrdered}</td>
                    <td className="num">
                      {i.qtyReceived}
                      {i.qtyRejected > 0 && <span className="sub">{i.qtyRejected} rejected</span>}
                    </td>
                    <td className="num">
                      <NumberInput
                        aria-label={`Good ${i.sku}`}
                        w={84}
                        min={0}
                        max={i.remaining}
                        clampBehavior="strict"
                        allowDecimal={false}
                        allowNegative={false}
                        hideControls
                        disabled={i.remaining === 0}
                        value={e.good}
                        onChange={(v) => edit(i.id, i.remaining, 'good', v)}
                      />
                    </td>
                    <td className="num">
                      <NumberInput
                        aria-label={`Rejected ${i.sku}`}
                        w={84}
                        min={0}
                        max={i.remaining}
                        clampBehavior="strict"
                        allowDecimal={false}
                        allowNegative={false}
                        hideControls
                        disabled={i.remaining === 0}
                        value={e.rejected}
                        onChange={(v) => edit(i.id, i.remaining, 'rejected', v)}
                      />
                    </td>
                    <td className="num" data-testid={`after-${i.sku}`}>
                      {i.onHand + e.good}
                    </td>
                    <td className="num" data-testid={`cost-${i.sku}`}>
                      {e.good > 0 && after !== null ? (
                        <>
                          {formatPrice(after)}
                          {i.variantCostP !== null && i.variantCostP !== after && (
                            <span className="sub">was {formatPrice(i.variantCostP)}</span>
                          )}
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <TextInput
          label="Receiving note (damaged / short)"
          placeholder="Optional"
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
        />
        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={receive.isPending} onClick={confirm}>
            Confirm receipt &amp; update stock
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
