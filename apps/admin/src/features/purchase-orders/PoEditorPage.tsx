import { Banner, SectionCard, StatusBadge } from '@bdc/ui';
import { Alert, Button, Loader, Select, Textarea, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { PageHeader } from '~/components/PageHeader';
import { notifyOk } from '~/features/categories/queries';
import { formatDateTime } from '~/lib/format';
import { useCan } from '~/lib/perm';
import { poApi } from './api';
import { notifyPoError, poErrorMessage } from './errors';
import { LinesEditor } from './LinesEditor';
import {
  canCancel,
  canReceive,
  dateLabel,
  editMode,
  type LineDraft,
  lineError,
  PO_STATUS,
} from './logic';
import { PoLinesReadOnly, PoReceipts } from './PoDetailSections';
import classes from './PurchaseOrders.module.css';
import { type PoDetail, poQuery, poSuppliersQuery, useInvalidatePo } from './queries';
import { ReasonModal } from './ReasonModal';
import { ReceiveModal } from './ReceiveModal';

const draftLines = (po: PoDetail | null): LineDraft[] =>
  (po?.items ?? []).map((i) => ({
    key: i.variantId,
    variantId: i.variantId,
    title: i.productTitleEn,
    sku: i.sku,
    options: i.options,
    qty: i.qtyOrdered,
    unitCostP: i.unitCostP,
    hint: null,
  }));

/** Create (no id) or view/edit (id) a purchase order. */
export function PoEditorPage({ id, supplierId }: { id?: string; supplierId?: string }) {
  const q = useQuery({ ...poQuery(id ?? ''), enabled: !!id });
  if (id && q.isLoading) {
    return (
      <div className="a-card">
        <div className="a-empty">
          <Loader size="sm" aria-label="Loading" />
        </div>
      </div>
    );
  }
  if (id && (q.isError || !q.data)) {
    return <Banner tone="danger">{poErrorMessage(q.error, 'Could not load the order')}</Banner>;
  }
  const po = q.data ?? null;
  // Re-mount when the order moves on (sent, received...) so the form restarts from the server copy.
  return (
    <EditorBody
      key={po ? `${po.id}:${po.status}:${po.qtyReceived}:${po.qtyRejected}` : 'new'}
      po={po}
      presetSupplierId={supplierId}
    />
  );
}

function EditorBody({ po, presetSupplierId }: { po: PoDetail | null; presetSupplierId?: string }) {
  const navigate = useNavigate();
  const invalidate = useInvalidatePo();
  const canManage = useCan('suppliers.manage');
  const canRecv = useCan('purchase_orders.receive');
  const mode = editMode(po?.status ?? null, canManage);
  const isNew = !po;

  const suppliers = useQuery(poSuppliersQuery);
  const [supplierId, setSupplierId] = useState(po?.supplier.id ?? presetSupplierId ?? '');
  const [expectedAt, setExpectedAt] = useState(po?.expectedAt ?? '');
  const [notes, setNotes] = useState(po?.notes ?? '');
  const [lines, setLines] = useState<LineDraft[]>(() => draftLines(po));
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'receive' | 'close' | 'cancel' | null>(null);

  const supplierData = (suppliers.data?.items ?? [])
    .filter((s) => s.isActive || s.id === supplierId)
    .map((s) => ({ value: s.id, label: s.isActive ? s.name : `${s.name} (paused)` }));
  if (po && !supplierData.some((s) => s.value === po.supplier.id))
    supplierData.push({ value: po.supplier.id, label: po.supplier.name });

  /** Persists the form: creates the PO or patches it. Returns the saved id. */
  async function persist(): Promise<string | null> {
    if (mode === 'full') {
      if (!supplierId) {
        setError('Choose a supplier.');
        return null;
      }
      const bad = lineError(lines);
      if (bad) {
        setError(bad);
        return null;
      }
    }
    setError(null);
    const items = lines.map((l) => ({
      variantId: l.variantId,
      qtyOrdered: l.qty ?? 0,
      unitCostP: l.unitCostP ?? 0,
    }));
    if (!po) {
      const created = await poApi.create({
        supplierId,
        ...(expectedAt ? { expectedAt } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        items,
      });
      return created.id;
    }
    const meta = { expectedAt: expectedAt || null, notes: notes.trim() || null };
    await poApi.patch(po.id, mode === 'full' ? { ...meta, supplierId, items } : meta);
    return po.id;
  }

  const save = useMutation({
    mutationFn: persist,
    onSuccess: async (savedId) => {
      if (!savedId) return;
      await invalidate();
      notifyOk(isNew ? 'Saved as a draft' : 'Purchase order saved');
      if (isNew) navigate({ to: '/purchase-orders/$id', params: { id: savedId } });
    },
    onError: (e) => notifyPoError(e, 'Could not save'),
  });

  const send = useMutation({
    mutationFn: async () => {
      const savedId = await persist();
      if (!savedId) return null;
      return poApi.send(savedId);
    },
    onSuccess: async (res) => {
      if (!res) return;
      await invalidate();
      notifications.show({
        color: res.emailed ? 'teal' : 'yellow',
        message: res.emailed
          ? `${res.po.poNo} sent and emailed to ${res.po.supplier.name}`
          : `${res.po.poNo} marked as sent. There is no email on file for ${res.po.supplier.name}, so print it and send it by hand.`,
      });
      if (isNew) navigate({ to: '/purchase-orders/$id', params: { id: res.po.id } });
    },
    onError: (e) => notifyPoError(e, 'Could not send'),
  });

  const cancel = useMutation({
    mutationFn: (reason: string) => poApi.cancel(po?.id ?? '', reason || undefined),
    onSuccess: async () => {
      await invalidate();
      notifyOk('Purchase order cancelled');
      setDialog(null);
    },
    onError: (e) => notifyPoError(e, 'Could not cancel'),
  });

  const close = useMutation({
    mutationFn: (reason: string) => poApi.close(po?.id ?? '', reason),
    onSuccess: async () => {
      await invalidate();
      notifyOk('Purchase order closed short');
      setDialog(null);
    },
    onError: (e) => notifyPoError(e, 'Could not close'),
  });

  const busy = save.isPending || send.isPending;
  const status = po ? PO_STATUS[po.status] : PO_STATUS.draft;
  const locked = mode !== 'full';

  const headerActions = po && (
    <>
      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      <Button
        component="a"
        href={`/print/po/${po.id}`}
        target="_blank"
        rel="noopener"
        variant="default"
        size="xs"
      >
        Print
      </Button>
      {canRecv && canReceive(po.status) && (
        <Button size="xs" onClick={() => setDialog('receive')}>
          Receive goods
        </Button>
      )}
      {canManage && po.status === 'partially_received' && (
        <Button variant="default" size="xs" onClick={() => setDialog('close')}>
          Close PO
        </Button>
      )}
    </>
  );

  return (
    <>
      <PageHeader
        title={po ? po.poNo : 'New purchase order'}
        crumbs={['Suppliers & POs', 'Purchase orders', po ? po.poNo : 'New']}
        description={
          po
            ? `Created ${formatDateTime(po.createdAt)} by ${po.createdBy.name}${po.sentAt ? `, sent ${formatDateTime(po.sentAt)}` : ''}`
            : 'Saved as a draft until you send it to the supplier.'
        }
        actions={headerActions}
      />
      <div className={classes.stack}>
        {po?.status === 'closed' && (
          <Banner tone="info" icon="lock">
            Closed short{po.closedBy ? ` by ${po.closedBy.name}` : ''}: {po.closeReason}. The
            remaining quantity was dropped and nothing more is owed for it.
          </Banner>
        )}
        {po?.status === 'cancelled' && (
          <Banner tone="danger">Cancelled{po.closeReason ? `: ${po.closeReason}` : ''}.</Banner>
        )}
        {mode === 'none' && po?.status === 'draft' && (
          <Banner tone="info" icon="lock">
            You need the suppliers.manage permission to edit purchase orders.
          </Banner>
        )}
        {mode === 'meta' && (
          <Banner tone="info" icon="lock">
            This order was sent, so its lines are locked. You can still change the expected date and
            notes.
          </Banner>
        )}

        <SectionCard title="Order">
          <div className={classes.cols3}>
            <Select
              label="Supplier"
              placeholder="Choose a supplier"
              searchable
              allowDeselect={false}
              disabled={locked}
              data={supplierData}
              value={supplierId || null}
              onChange={(v) => {
                if (!v || v === supplierId) return;
                if (lines.length > 0) {
                  setLines([]);
                  notifications.show({
                    color: 'yellow',
                    message: 'Lines were cleared because costs differ per supplier.',
                  });
                }
                setSupplierId(v);
              }}
            />
            <TextInput
              label="Expected delivery"
              type="date"
              disabled={mode !== 'full' && mode !== 'meta'}
              value={expectedAt}
              onChange={(e) => setExpectedAt(e.currentTarget.value)}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Status</div>
              <div className={classes.statusCell}>
                <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                {po?.expectedAt && po.late && (
                  <StatusBadge tone="danger" style={{ marginLeft: 6 }}>
                    Late since {dateLabel(po.expectedAt)}
                  </StatusBadge>
                )}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Lines" flush={!!po && locked}>
          {po && locked ? (
            <PoLinesReadOnly po={po} />
          ) : (
            <LinesEditor supplierId={supplierId} lines={lines} onChange={setLines} />
          )}
        </SectionCard>

        <SectionCard title="Notes to supplier">
          <Textarea
            aria-label="Notes to supplier"
            autosize
            minRows={2}
            maxLength={1000}
            disabled={mode !== 'full' && mode !== 'meta'}
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
          />
        </SectionCard>

        {po && <PoReceipts po={po} />}

        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        {(mode === 'full' || mode === 'meta') && (
          <div className={classes.foot}>
            {mode === 'full' && isNew && (
              <Button
                color="red"
                variant="default"
                onClick={() => navigate({ to: '/purchase-orders' })}
              >
                Discard
              </Button>
            )}
            {po && canCancel(po) && (
              <Button color="red" variant="default" onClick={() => setDialog('cancel')}>
                Cancel PO
              </Button>
            )}
            <span className={classes.grow} />
            <Button
              variant="default"
              loading={save.isPending}
              disabled={busy}
              onClick={() => save.mutate()}
            >
              {mode === 'full' ? 'Save draft' : 'Save changes'}
            </Button>
            {mode === 'full' && (
              <Button loading={send.isPending} disabled={busy} onClick={() => send.mutate()}>
                Send to supplier
              </Button>
            )}
          </div>
        )}
      </div>

      {po && dialog === 'receive' && <ReceiveModal po={po} onClose={() => setDialog(null)} />}
      {po && dialog === 'close' && (
        <ReasonModal
          title={`Close ${po.poNo} short`}
          description="The quantity still outstanding is dropped and nothing is owed for it. Received goods stay in stock and on the supplier's balance. This cannot be undone."
          confirmLabel="Close PO"
          required
          pending={close.isPending}
          onSubmit={(r) => close.mutate(r)}
          onClose={() => setDialog(null)}
        />
      )}
      {po && dialog === 'cancel' && (
        <ReasonModal
          title={`Cancel ${po.poNo}`}
          description="The purchase order is cancelled and nothing is owed. This cannot be undone."
          confirmLabel="Cancel PO"
          required={false}
          pending={cancel.isPending}
          onSubmit={(r) => cancel.mutate(r)}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
