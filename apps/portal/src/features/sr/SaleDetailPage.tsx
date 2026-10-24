import {
  Alert,
  Button,
  Group,
  Modal,
  Paper,
  Stack,
  Stepper,
  Table,
  Text,
  Title,
} from '@mantine/core';
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
        return (
          <Stack gap="md">
            <div>
              <BackLink to="/sr/sales">{t('backSales')}</BackLink>
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Title order={1}>{s.shop.name}</Title>
                <StatusBadge status={s.status} />
              </Group>
            </div>

            {!closed && (
              <Stepper active={activeStep(s.status)} size="xs" allowNextStepsSelect={false}>
                <Stepper.Step label={t('statusSubmitted')} />
                <Stepper.Step label={t('filterApproved')} />
                <Stepper.Step label={t('statusDelivered')} />
              </Stepper>
            )}
            {s.status === 'submitted' && (
              <Alert color="yellow" variant="light">
                {t('waitingApproval')}
              </Alert>
            )}
            {s.status === 'reversed' && (
              <Alert color="grape" variant="light">
                {t('reversedNote', { reason: s.reverseReason ?? '-' })}
              </Alert>
            )}
            {s.status === 'rejected' && (
              <Alert color="red" variant="light">
                {t('rejectedBy', { reason: s.rejectedReason ?? '-' })}
              </Alert>
            )}

            <Paper>
              <Group justify="space-between" align="center">
                <div>
                  <Text size="sm" c="dimmed">
                    {t('memoNumber')}
                  </Text>
                  <Text data-testid="memo-no">{s.memoNo}</Text>
                  {s.status === 'submitted' && (
                    <Text size="xs" c="dimmed">
                      {t('memoPending')}
                    </Text>
                  )}
                </div>
                {(s.status === 'approved' || s.status === 'delivered') && (
                  <Group gap="xs">
                    <Button
                      component="a"
                      href={srApi.memoUrl(s.id)}
                      target="_blank"
                      rel="noopener"
                      size="xs"
                    >
                      {t('viewMemo')}
                    </Button>
                    <Button
                      component="a"
                      href={srApi.memoUrl(s.id, 'bn')}
                      target="_blank"
                      rel="noopener"
                      size="xs"
                      variant="default"
                    >
                      বাংলা
                    </Button>
                    <Button
                      size="xs"
                      variant="default"
                      loading={share.isPending}
                      onClick={() => share.mutate(s)}
                    >
                      {t('shareMemo')}
                    </Button>
                  </Group>
                )}
              </Group>
            </Paper>

            <Paper>
              <Title order={2} mb="xs">
                {t('items')}
              </Title>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('item')}</Table.Th>
                    <Table.Th ta="right">{t('qty')}</Table.Th>
                    <Table.Th ta="right">{t('price')}</Table.Th>
                    <Table.Th ta="right">{t('total')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {s.items.map((i) => (
                    <Table.Tr key={i.id}>
                      <Table.Td>
                        {i.titleEn}
                        {i.optionsText !== '' && (
                          <Text size="xs" c="dimmed">
                            {i.optionsText}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td ta="right">{num(i.qty)}</Table.Td>
                      <Table.Td ta="right">{formatPrice(i.unitPriceP)}</Table.Td>
                      <Table.Td ta="right">{formatPrice(i.lineTotalP)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
              <Stack gap={4} mt="sm">
                <Group justify="space-between">
                  <Text>{t('total')}</Text>
                  <Text>{formatPrice(s.totalP)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text>{t('collectedAtSale')}</Text>
                  <Text>{formatPrice(s.paidAtSaleP)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text>{t('due')}</Text>
                  <Text c={s.dueP > 0 ? 'red' : 'teal'}>{formatPrice(s.dueP)}</Text>
                </Group>
              </Stack>
            </Paper>

            <Paper>
              <Stack gap={4}>
                <Group justify="space-between">
                  <Text c="dimmed">{t('shop')}</Text>
                  <Link to="/sr/shops/$id" params={{ id: s.shop.id }}>
                    {s.shop.name}
                  </Link>
                </Group>
                <Group justify="space-between">
                  <Text c="dimmed">{t('statusSubmitted')}</Text>
                  <Text>{formatDate(s.submittedAt)}</Text>
                </Group>
                {s.approvedAt && (
                  <Group justify="space-between">
                    <Text c="dimmed">{t('filterApproved')}</Text>
                    <Text>{formatDate(s.approvedAt)}</Text>
                  </Group>
                )}
                <Group justify="space-between">
                  <Text c="dimmed">{t('deliveryBy')}</Text>
                  <Text ta="right">
                    {s.deliveryBy === 'sr' ? t('deliveryBySr') : t('deliveryByStaff')}
                  </Text>
                </Group>
                {s.deliveredAt && (
                  <Group justify="space-between">
                    <Text c="dimmed">{t('statusDelivered')}</Text>
                    <Text>{formatDate(s.deliveredAt)}</Text>
                  </Group>
                )}
                {s.note && (
                  <Group justify="space-between" align="flex-start">
                    <Text c="dimmed">{t('note')}</Text>
                    <Text ta="right">{s.note}</Text>
                  </Group>
                )}
              </Stack>
            </Paper>

            {s.status === 'approved' && s.deliveryBy === 'sr' && (
              <>
                <Button onClick={openDeliver}>{t('markDelivered')}</Button>
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
                <Button color="red" variant="light" onClick={open}>
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
          </Stack>
        );
      }}
    </QueryBoundary>
  );
}
