import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { BackLink } from '~/components/PageTitle';
import { QueryBoundary } from '~/components/QueryBoundary';
import { StatusBadge } from '~/components/StatusBadge';
import { num, t } from '~/i18n';
import { formatDate, formatPrice } from '~/lib/format';
import type { SrSaleDetail } from './api';
import { srApi } from './api';
import { srKeys, srSaleQuery } from './queries';
import { shareMemo } from './share';

function activeStep(s: SrSaleDetail['status']) {
  if (s === 'delivered') return 3;
  if (s === 'approved') return 2;
  if (s === 'submitted') return 1;
  return 1;
}

export function SaleDetailPage({ id }: { id: string }) {
  const sale = useQuery(srSaleQuery(id));
  const qc = useQueryClient();
  const [confirmOpen, { open, close }] = useDisclosure(false);
  const [deliverOpen, { open: openDeliver, close: closeDeliver }] = useDisclosure(false);
  const share = useMutation({
    mutationFn: shareMemo,
    onError: () => notifications.show({ message: t('memoLinkFailed'), color: 'red' }),
  });
  const deliver = useMutation({
    mutationFn: () => srApi.deliverSale(id),
    onSuccess: async () => {
      closeDeliver();
      notifications.show({ message: t('deliveredDone'), color: 'green' });
      await qc.invalidateQueries({ queryKey: srKeys.all });
    },
  });
  const cancel = useMutation({
    mutationFn: () => srApi.cancelSale(id),
    onSuccess: async () => {
      close();
      notifications.show({ message: t('cancelled'), color: 'green' });
      await qc.invalidateQueries({ queryKey: srKeys.all });
    },
  });

  return (
    <QueryBoundary query={sale}>
      {(s) => {
        const closed =
          s.status === 'rejected' || s.status === 'cancelled' || s.status === 'reversed';
        const step = activeStep(s.status);
        return (
          <>
            <BackLink to="/sr/sales">{t('backSales')}</BackLink>
            <div className="sr-h">
              <h1>{s.shop.name}</h1>
              <StatusBadge status={s.status} />
            </div>

            {!closed && (
              <div className="sr-steps">
                <div className="done">{t('statusSubmitted')}</div>
                <div className={step >= 2 ? 'done' : undefined}>{t('filterApproved')}</div>
                <div className={step >= 3 ? 'done' : undefined}>{t('statusDelivered')}</div>
              </div>
            )}
            {s.status === 'submitted' && <div className="sr-note warn">{t('waitingApproval')}</div>}
            {s.status === 'reversed' && (
              <div className="sr-note danger">
                {t('reversedNote', { reason: s.reverseReason ?? '-' })}
              </div>
            )}
            {s.status === 'rejected' && (
              <div className="sr-note danger">
                {t('rejectedBy', { reason: s.rejectedReason ?? '-' })}
              </div>
            )}

            <div
              className={
                s.status === 'approved' || s.status === 'delivered' ? 'sr-memobox' : 'sr-card'
              }
            >
              <div>
                <div className="sr-muted">{t('memoNumber')}</div>
                <b data-testid="memo-no">{s.memoNo}</b>
                {s.status === 'submitted' && <div className="sr-muted">{t('memoPending')}</div>}
              </div>
              {(s.status === 'approved' || s.status === 'delivered') && (
                <div className="acts">
                  <Button
                    component="a"
                    href={srApi.memoUrl(s.id)}
                    target="_blank"
                    rel="noopener"
                    size="compact-sm"
                  >
                    {t('viewMemo')}
                  </Button>
                  <Button
                    component="a"
                    href={srApi.memoUrl(s.id, 'bn')}
                    target="_blank"
                    rel="noopener"
                    size="compact-sm"
                    variant="default"
                  >
                    বাংলা
                  </Button>
                  <Button
                    size="compact-sm"
                    variant="default"
                    loading={share.isPending}
                    onClick={() => share.mutate(s)}
                  >
                    {t('shareMemo')}
                  </Button>
                </div>
              )}
            </div>

            <div className="sr-card">
              <h2 className="sr-h2">{t('items')}</h2>
              <table className="sr-tbl">
                <thead>
                  <tr>
                    <th>{t('item')}</th>
                    <th className="num">{t('qty')}</th>
                    <th className="num">{t('price')}</th>
                    <th className="num">{t('total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.items.map((i) => (
                    <tr key={i.id}>
                      <td>
                        {i.titleEn}
                        {i.optionsText !== '' && <div className="sr-muted">{i.optionsText}</div>}
                      </td>
                      <td className="num">{num(i.qty)}</td>
                      <td className="num">{formatPrice(i.unitPriceP)}</td>
                      <td className="num">{formatPrice(i.lineTotalP)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="sr-mt-10">
                <div className="sr-row">
                  <span>{t('total')}</span>
                  <b>{formatPrice(s.totalP)}</b>
                </div>
                <div className="sr-row">
                  <span>{t('collectedAtSale')}</span>
                  <b>{formatPrice(s.paidAtSaleP)}</b>
                </div>
                <div className="sr-row">
                  <span>{t('due')}</span>
                  <b className={s.dueP > 0 ? 'sr-due' : 'sr-ok'}>{formatPrice(s.dueP)}</b>
                </div>
              </div>
            </div>

            <div className="sr-card">
              <dl className="a-kv">
                <dt>{t('shop')}</dt>
                <dd>
                  <Link to="/sr/shops/$id" params={{ id: s.shop.id }}>
                    {s.shop.name}
                  </Link>
                </dd>
                <dt>{t('statusSubmitted')}</dt>
                <dd>{formatDate(s.submittedAt)}</dd>
                {s.approvedAt && (
                  <>
                    <dt>{t('filterApproved')}</dt>
                    <dd>{formatDate(s.approvedAt)}</dd>
                  </>
                )}
                <dt>{t('deliveryBy')}</dt>
                <dd>{s.deliveryBy === 'sr' ? t('deliveryBySr') : t('deliveryByStaff')}</dd>
                {s.deliveredAt && (
                  <>
                    <dt>{t('statusDelivered')}</dt>
                    <dd>{formatDate(s.deliveredAt)}</dd>
                  </>
                )}
                {s.note && (
                  <>
                    <dt>{t('note')}</dt>
                    <dd>{s.note}</dd>
                  </>
                )}
              </dl>
            </div>

            {s.status === 'approved' && s.deliveryBy === 'sr' && (
              <>
                <Button fullWidth onClick={openDeliver}>
                  {t('markDelivered')}
                </Button>
                <Modal
                  opened={deliverOpen}
                  onClose={closeDeliver}
                  title={t('markDelivered')}
                  centered
                >
                  <Stack>
                    <Text>{t('markDeliveredConfirm')}</Text>
                    {deliver.error && (
                      <Alert color="red" variant="light">
                        {deliver.error.message}
                      </Alert>
                    )}
                    <Group grow>
                      <Button variant="default" onClick={closeDeliver}>
                        {t('notYet')}
                      </Button>
                      <Button loading={deliver.isPending} onClick={() => deliver.mutate()}>
                        {t('yesDelivered')}
                      </Button>
                    </Group>
                  </Stack>
                </Modal>
              </>
            )}
            {s.status === 'submitted' && (
              <>
                <Button fullWidth color="red" onClick={open}>
                  {t('cancelSale')}
                </Button>
                <Modal opened={confirmOpen} onClose={close} title={t('cancelSale')} centered>
                  <Stack>
                    <Text>{t('cancelConfirm')}</Text>
                    {cancel.error && (
                      <Alert color="red" variant="light">
                        {cancel.error.message}
                      </Alert>
                    )}
                    <Group grow>
                      <Button variant="default" onClick={close}>
                        {t('keepIt')}
                      </Button>
                      <Button
                        color="red"
                        loading={cancel.isPending}
                        onClick={() => cancel.mutate()}
                      >
                        {t('cancelSale')}
                      </Button>
                    </Group>
                  </Stack>
                </Modal>
              </>
            )}
          </>
        );
      }}
    </QueryBoundary>
  );
}
