import { useMutation } from '@tanstack/react-query';
import { notifyOk } from '~/features/categories/queries';
import { poApi } from './api';
import { notifyPoError } from './errors';
import { type PoDetail, useInvalidatePo } from './queries';
import { ReasonModal } from './ReasonModal';
import { ReceiveModal } from './ReceiveModal';

export type PoDialog = 'receive' | 'close' | 'cancel' | null;

/** The receive / close-short / cancel dialogs of a saved purchase order. */
export function PoDialogs({
  po,
  dialog,
  onClose,
}: {
  po: PoDetail;
  dialog: PoDialog;
  onClose: () => void;
}) {
  const invalidate = useInvalidatePo();

  const cancel = useMutation({
    mutationFn: (reason: string) => poApi.cancel(po.id, reason || undefined),
    onSuccess: async () => {
      await invalidate();
      notifyOk('Purchase order cancelled');
      onClose();
    },
    onError: (e) => notifyPoError(e, 'Could not cancel'),
  });

  const close = useMutation({
    mutationFn: (reason: string) => poApi.close(po.id, reason),
    onSuccess: async () => {
      await invalidate();
      notifyOk('Purchase order closed short');
      onClose();
    },
    onError: (e) => notifyPoError(e, 'Could not close'),
  });

  return (
    <>
      {dialog === 'receive' && <ReceiveModal po={po} onClose={onClose} />}
      {dialog === 'close' && (
        <ReasonModal
          title={`Close ${po.poNo} short`}
          description="The quantity still outstanding is dropped and nothing is owed for it. Received goods stay in stock and on the supplier's balance. This cannot be undone."
          confirmLabel="Close PO"
          required
          pending={close.isPending}
          onSubmit={(r) => close.mutate(r)}
          onClose={onClose}
        />
      )}
      {dialog === 'cancel' && (
        <ReasonModal
          title={`Cancel ${po.poNo}`}
          description="The purchase order is cancelled and nothing is owed. This cannot be undone."
          confirmLabel="Cancel PO"
          required={false}
          pending={cancel.isPending}
          onSubmit={(r) => cancel.mutate(r)}
          onClose={onClose}
        />
      )}
    </>
  );
}
