import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Image,
  NumberInput,
  Paper,
  Radio,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconPlus, IconSearch, IconX } from '@tabler/icons-react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { LoadMore } from '~/components/LoadMore';
import { PageTitle } from '~/components/PageTitle';
import { QueryBoundary } from '~/components/QueryBoundary';
import { num, t } from '~/i18n';
import { formatPrice } from '~/lib/format';
import { paisaToTaka, takaToPaisa } from '~/lib/money';
import { AddShopForm } from './AddShopForm';
import { type SrProduct, type SrSaleDetail, srApi } from './api';
import {
  belowListPct,
  type DeliveryBy,
  type DraftLine,
  emptyDraft,
  hasErrors,
  lineFromProduct,
  lineTotalP,
  type SaleDraft,
  saleTotals,
  validateSale,
} from './logic';
import { srKeys, srProductsQuery, srShopQuery, srShopsQuery } from './queries';
import { NewBadge } from './ShopsPage';

function ShopPicker({
  shopId,
  error,
  onChange,
}: {
  shopId: string | null;
  error?: string;
  onChange: (id: string | null) => void;
}) {
  const [q, setQ] = useState('');
  const [debounced] = useDebouncedValue(q.trim(), 250);
  const [adding, setAdding] = useState(false);
  const chosenQuery = useQuery({ ...srShopQuery(shopId ?? ''), enabled: Boolean(shopId) });
  const shops = useInfiniteQuery({ ...srShopsQuery(debounced), enabled: !shopId && !adding });
  const chosen = chosenQuery.data;

  if (shopId) {
    return (
      <Paper>
        <Group justify="space-between" wrap="nowrap">
          <div>
            <Text>
              {chosen?.name ?? t('loading')}
              {chosen?.isNew && <NewBadge />}
            </Text>
            {chosen && (
              <Text size="sm" c="dimmed">
                {chosen.area}
                {chosen.dueBalanceP > 0 && (
                  <>
                    {' · '}
                    <Text span size="sm" c="red">
                      {t('currentDue', { amount: formatPrice(chosen.dueBalanceP) })}
                    </Text>
                  </>
                )}
              </Text>
            )}
          </div>
          <Button size="xs" variant="default" onClick={() => onChange(null)}>
            {t('change')}
          </Button>
        </Group>
      </Paper>
    );
  }

  if (adding) {
    return (
      <Paper>
        <Group justify="space-between" mb="sm">
          <Title order={2}>{t('addShopTitle')}</Title>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label="Close"
            onClick={() => setAdding(false)}
          >
            <IconX size={16} />
          </ActionIcon>
        </Group>
        <AddShopForm
          onCreated={(shop) => {
            setAdding(false);
            onChange(shop.id);
          }}
        />
      </Paper>
    );
  }

  return (
    <Stack gap="xs">
      <TextInput
        type="search"
        placeholder={t('searchShops')}
        leftSection={<IconSearch size={16} />}
        value={q}
        error={error}
        onChange={(e) => setQ(e.currentTarget.value)}
      />
      <QueryBoundary query={shops}>
        {(data) => {
          const matches = data.pages.flatMap((p) => p.items).filter((s) => s.status === 'active');
          return (
            <>
              <Paper py={4}>
                {matches.length === 0 ? (
                  <Text c="dimmed" ta="center" py="sm">
                    {t('noShops')}
                  </Text>
                ) : (
                  matches.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="portal-item"
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        background: 'none',
                        border: 0,
                        cursor: 'pointer',
                        color: 'inherit',
                      }}
                      onClick={() => onChange(s.id)}
                    >
                      <Text>
                        {s.name}
                        {s.isNew && <NewBadge />}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {[s.ownerName, s.area].filter(Boolean).join(' · ')}
                      </Text>
                    </button>
                  ))
                )}
              </Paper>
              <LoadMore query={shops} />
            </>
          );
        }}
      </QueryBoundary>
      <Button variant="light" leftSection={<IconPlus size={16} />} onClick={() => setAdding(true)}>
        {t('addNewShop')}
      </Button>
    </Stack>
  );
}

function ProductPicker({
  onPick,
  onClose,
}: {
  onPick: (p: SrProduct) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [debounced] = useDebouncedValue(q.trim(), 250);
  const products = useQuery(srProductsQuery(debounced));
  return (
    <Paper>
      <Group gap="xs" wrap="nowrap" mb="xs">
        <TextInput
          style={{ flex: 1 }}
          type="search"
          autoFocus
          placeholder={t('searchProduct')}
          leftSection={<IconSearch size={16} />}
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
        />
        <ActionIcon variant="subtle" color="gray" size="lg" aria-label="Close" onClick={onClose}>
          <IconX size={18} />
        </ActionIcon>
      </Group>
      <QueryBoundary query={products}>
        {(list) =>
          list.length === 0 ? (
            <Text c="dimmed" ta="center" py="sm">
              {t('noProducts')}
            </Text>
          ) : (
            list.slice(0, 20).map((p) => (
              <button
                key={p.variantId}
                type="button"
                className="portal-item"
                disabled={p.available < 1}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'none',
                  border: 0,
                  cursor: p.available < 1 ? 'not-allowed' : 'pointer',
                  opacity: p.available < 1 ? 0.5 : 1,
                  color: 'inherit',
                }}
                onClick={() => onPick(p)}
              >
                <Group wrap="nowrap" gap="sm">
                  {p.image && <Image src={p.image.url320} w={44} h={44} radius="sm" alt="" />}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Text truncate>{p.titleEn}</Text>
                    <Text size="sm" c="dimmed" truncate>
                      {[p.optionsText, p.sku].filter(Boolean).join(' · ')}
                    </Text>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <Text size="sm">{formatPrice(p.priceP)}</Text>
                    <Text size="xs" c={p.available < 1 ? 'red' : 'dimmed'}>
                      {t('available', { n: p.available })}
                    </Text>
                  </div>
                </Group>
              </button>
            ))
          )
        }
      </QueryBoundary>
    </Paper>
  );
}

function LineCard({
  line,
  error,
  onChange,
  onRemove,
}: {
  line: DraftLine;
  error?: string;
  onChange: (patch: Partial<DraftLine>) => void;
  onRemove: () => void;
}) {
  const below = belowListPct(line);
  return (
    <Paper data-testid="line">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <div style={{ minWidth: 0 }}>
          <Text truncate>{line.title}</Text>
          <Text size="sm" c="dimmed">
            {[line.optionsText, t('listPrice', { amount: formatPrice(line.listPriceP) })]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </div>
        <ActionIcon variant="subtle" color="gray" aria-label={t('remove')} onClick={onRemove}>
          <IconX size={16} />
        </ActionIcon>
      </Group>
      <Group grow align="flex-start" mt="xs">
        <NumberInput
          label={t('qty')}
          min={0}
          allowDecimal={false}
          allowNegative={false}
          value={line.qty ?? ''}
          error={error && (!line.qty || line.qty > line.available ? error : undefined)}
          onChange={(v) => onChange({ qty: v === '' ? null : Number(v) })}
        />
        <NumberInput
          label={t('yourPrice')}
          min={0}
          decimalScale={2}
          allowNegative={false}
          value={paisaToTaka(line.unitPriceP)}
          error={error && line.unitPriceP === null ? error : undefined}
          onChange={(v) => onChange({ unitPriceP: takaToPaisa(v) })}
        />
      </Group>
      <Group justify="space-between" mt="xs">
        <Text size="sm" c="orange">
          {below !== null ? t('belowList', { pct: Math.abs(below) }) : ''}
        </Text>
        <Text>{formatPrice(lineTotalP(line))}</Text>
      </Group>
    </Paper>
  );
}

function Totals({ draft }: { draft: SaleDraft }) {
  const c = saleTotals(draft);
  return (
    <Paper>
      <Stack gap={4}>
        <Group justify="space-between">
          <Text>{t('total')}</Text>
          <Text data-testid="total">{formatPrice(c.totalP)}</Text>
        </Group>
        <Group justify="space-between">
          <Text c="dimmed">{t('collectedAtSale')}</Text>
          <Text>{formatPrice(c.paidP)}</Text>
        </Group>
        <Group justify="space-between">
          <Text>{t('due')}</Text>
          <Text c={c.dueP > 0 ? 'red' : 'teal'} data-testid="due">
            {formatPrice(c.dueP)}
          </Text>
        </Group>
      </Stack>
    </Paper>
  );
}

export function NewSalePage({ initialShopId }: { initialShopId?: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<SaleDraft>(() => ({
    ...emptyDraft(),
    shopId: initialShopId ?? null,
  }));
  const [step, setStep] = useState<'form' | 'review'>('form');
  const [attempted, setAttempted] = useState(false);
  const [picking, setPicking] = useState(false);
  const [done, setDone] = useState<SrSaleDetail | null>(null);

  const chosenShop = useQuery({
    ...srShopQuery(draft.shopId ?? ''),
    enabled: Boolean(draft.shopId),
  });
  const errors = validateSale(draft);
  const patch = (p: Partial<SaleDraft>) => setDraft((d) => ({ ...d, ...p }));
  const patchLine = (variantId: string, p: Partial<DraftLine>) =>
    setDraft((d) => ({
      ...d,
      lines: d.lines.map((l) => (l.variantId === variantId ? { ...l, ...p } : l)),
    }));

  const submit = useMutation({
    mutationFn: () =>
      srApi.createSale({
        b2bShopId: draft.shopId as string,
        items: draft.lines.map((l) => ({
          variantId: l.variantId,
          qty: l.qty as number,
          unitPriceP: l.unitPriceP as number,
        })),
        paidAtSaleP: draft.paidP ?? 0,
        deliveryBy: draft.deliveryBy,
        note: draft.note.trim() || undefined,
      }),
    onSuccess: async (sale) => {
      setDone(sale);
      await qc.invalidateQueries({ queryKey: srKeys.all });
    },
  });

  if (done) {
    return (
      <Stack gap="md" align="center" ta="center" py="xl">
        <Title order={1}>{t('saleSubmitted')}</Title>
        <Text>{t('saleSubmittedBody', { memo: done.memoNo })}</Text>
        <Text fz={28}>{formatPrice(done.totalP)}</Text>
        <Button
          variant="default"
          onClick={() => {
            setDone(null);
            setDraft(emptyDraft());
            setStep('form');
            setAttempted(false);
          }}
        >
          {t('newAnother')}
        </Button>
        <Button
          variant="subtle"
          onClick={() => void navigate({ to: '/sr/sales/$id', params: { id: done.id } })}
        >
          {t('viewSale')}
        </Button>
      </Stack>
    );
  }

  if (step === 'review') {
    const shop = chosenShop.data;
    return (
      <Stack gap="md">
        <PageTitle>{t('reviewSale')}</PageTitle>
        <Paper>
          <Text size="sm" c="dimmed">
            {t('buyerShop')}
          </Text>
          <Text>{shop?.name}</Text>
        </Paper>
        <Paper>
          {draft.lines.map((l) => (
            <Group key={l.variantId} justify="space-between" wrap="nowrap" py={4}>
              <Text size="sm" truncate>
                {num(l.qty ?? 0)} x {l.title}
              </Text>
              <Text size="sm">{formatPrice(lineTotalP(l))}</Text>
            </Group>
          ))}
        </Paper>
        <Totals draft={draft} />
        <Text size="sm">
          {t('deliveryBy')}: {draft.deliveryBy === 'sr' ? t('deliveryBySr') : t('deliveryByStaff')}
        </Text>
        {draft.note && (
          <Text size="sm" c="dimmed">
            {t('note')}: {draft.note}
          </Text>
        )}
        {submit.error && (
          <Alert color="red" variant="light">
            {submit.error.message}
          </Alert>
        )}
        <Button loading={submit.isPending} onClick={() => submit.mutate()}>
          {t('submitApproval')}
        </Button>
        <Button variant="default" onClick={() => setStep('form')}>
          {t('editSale')}
        </Button>
        <Text size="sm" c="dimmed" ta="center">
          {t('submitHint')}
        </Text>
      </Stack>
    );
  }

  const totals = saleTotals(draft);
  return (
    <Stack gap="md">
      <PageTitle>{t('newSale')}</PageTitle>

      <div>
        <Text size="sm" mb={4}>
          {t('buyerShop')}
        </Text>
        <ShopPicker
          shopId={draft.shopId}
          error={attempted ? errors.shop : undefined}
          onChange={(id) => patch({ shopId: id })}
        />
      </div>

      <div>
        <Text size="sm" mb={4}>
          {t('items')}
        </Text>
        <Stack gap="xs">
          {draft.lines.length === 0 && (
            <Paper>
              <Text c={attempted && errors.items ? 'red' : 'dimmed'} ta="center">
                {attempted && errors.items ? errors.items : t('noItems')}
              </Text>
            </Paper>
          )}
          {draft.lines.map((l) => (
            <LineCard
              key={l.variantId}
              line={l}
              error={errors.lines[l.variantId]}
              onChange={(p) => patchLine(l.variantId, p)}
              onRemove={() =>
                patch({ lines: draft.lines.filter((x) => x.variantId !== l.variantId) })
              }
            />
          ))}
          {picking ? (
            <ProductPicker
              onClose={() => setPicking(false)}
              onPick={(p) => {
                if (!draft.lines.some((l) => l.variantId === p.variantId)) {
                  patch({ lines: [...draft.lines, lineFromProduct(p)] });
                }
                setPicking(false);
              }}
            />
          ) : (
            <Button
              variant="light"
              leftSection={<IconPlus size={16} />}
              onClick={() => setPicking(true)}
            >
              {t('addItem')}
            </Button>
          )}
        </Stack>
      </div>

      <Radio.Group
        label={t('whoDelivers')}
        value={draft.deliveryBy}
        onChange={(v) => patch({ deliveryBy: v as DeliveryBy })}
      >
        <Stack gap="xs" mt={6}>
          <Radio value="staff" label={t('deliverOffice')} description={t('deliverOfficeHint')} />
          <Radio value="sr" label={t('deliverSr')} description={t('deliverSrHint')} />
        </Stack>
      </Radio.Group>

      <div>
        <NumberInput
          label={t('amountNow')}
          min={0}
          decimalScale={2}
          allowNegative={false}
          value={paisaToTaka(draft.paidP)}
          error={errors.paid}
          onChange={(v) => patch({ paidP: takaToPaisa(v) })}
        />
        <Group gap="xs" mt="xs">
          <Button size="xs" variant="default" onClick={() => patch({ paidP: totals.totalP })}>
            {t('fullAmount')}
          </Button>
          <Button size="xs" variant="default" onClick={() => patch({ paidP: 0 })}>
            {t('nothingAllBaki')}
          </Button>
        </Group>
      </div>

      <Textarea
        label={t('noteApprover')}
        autosize
        minRows={2}
        value={draft.note}
        onChange={(e) => patch({ note: e.currentTarget.value })}
      />

      <Totals draft={draft} />

      <Button
        onClick={() => {
          setAttempted(true);
          if (!hasErrors(errors)) setStep('review');
        }}
      >
        {t('review')}
      </Button>
    </Stack>
  );
}
