import { Icon } from '@bdc/ui';
import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Image,
  NumberInput,
  Radio,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
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
      <div className="sr-chosen">
        <div>
          <b>{chosen?.name ?? t('loading')}</b>
          {chosen?.isNew && <NewBadge />}
          {chosen && (
            <div className="sr-muted">
              {chosen.area}
              {chosen.dueBalanceP > 0 && (
                <>
                  {' · '}
                  <span className="sr-due">
                    {t('currentDue', { amount: formatPrice(chosen.dueBalanceP) })}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
        <Button size="compact-sm" variant="default" onClick={() => onChange(null)}>
          {t('change')}
        </Button>
      </div>
    );
  }

  if (adding) {
    return (
      <div className="sr-card">
        <div className="sr-row sr-mb">
          <h2 className="sr-h2 sr-h2-flat">{t('addShopTitle')}</h2>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label="Close"
            onClick={() => setAdding(false)}
          >
            <Icon name="x" size={16} />
          </ActionIcon>
        </div>
        <AddShopForm
          onCreated={(shop) => {
            setAdding(false);
            onChange(shop.id);
          }}
        />
      </div>
    );
  }

  return (
    <Stack gap="xs">
      <TextInput
        type="search"
        placeholder={t('searchShops')}
        leftSection={<Icon name="search" size={16} />}
        value={q}
        error={error}
        onChange={(e) => setQ(e.currentTarget.value)}
      />
      <QueryBoundary query={shops}>
        {(data) => {
          const matches = data.pages.flatMap((p) => p.items).filter((s) => s.status === 'active');
          return (
            <>
              {matches.length === 0 ? (
                <div className="sr-empty sm">{t('noShops')}</div>
              ) : (
                <div className="sr-pick">
                  {matches.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="sr-item"
                      onClick={() => onChange(s.id)}
                    >
                      <div className="t">
                        <span>
                          {s.name}
                          {s.isNew && <NewBadge />}
                        </span>
                        {s.dueBalanceP > 0 && (
                          <span className="sr-due">
                            {t('currentDue', { amount: formatPrice(s.dueBalanceP) })}
                          </span>
                        )}
                      </div>
                      <div className="s">
                        <span>{[s.ownerName, s.area].filter(Boolean).join(' · ')}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <LoadMore query={shops} />
            </>
          );
        }}
      </QueryBoundary>
      <Button
        variant="default"
        size="compact-sm"
        leftSection={<Icon name="plus" size={14} />}
        onClick={() => setAdding(true)}
      >
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
    <div className="sr-card">
      <div className="sr-row sr-mb">
        <TextInput
          className="sr-grow"
          type="search"
          autoFocus
          placeholder={t('searchProduct')}
          leftSection={<Icon name="search" size={16} />}
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
        />
        <ActionIcon variant="subtle" color="gray" size="lg" aria-label="Close" onClick={onClose}>
          <Icon name="x" size={18} />
        </ActionIcon>
      </div>
      <QueryBoundary query={products}>
        {(list) =>
          list.length === 0 ? (
            <div className="sr-empty sm">{t('noProducts')}</div>
          ) : (
            <div className="sr-pick">
              {list.slice(0, 20).map((p) => (
                <button
                  key={p.variantId}
                  type="button"
                  className="sr-item sr-product"
                  disabled={p.available < 1}
                  onClick={() => onPick(p)}
                >
                  {p.image && <Image src={p.image.url320} w={44} h={44} radius="sm" alt="" />}
                  <div className="sr-product-main">
                    <div className="sr-product-t">{p.titleEn}</div>
                    <div className="sr-muted">
                      {[p.optionsText, p.sku].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="sr-product-end">
                    <div>{formatPrice(p.priceP)}</div>
                    <div className={p.available < 1 ? 'sr-muted sr-due' : 'sr-muted'}>
                      {t('available', { n: p.available })}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )
        }
      </QueryBoundary>
    </div>
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
    <div className="sr-line" data-testid="line">
      <div className="top">
        <div className="sr-product-main">
          <b>{line.title}</b>
          <div className="sr-muted">
            {[line.optionsText, t('listPrice', { amount: formatPrice(line.listPriceP) })]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
        <ActionIcon variant="subtle" color="gray" aria-label={t('remove')} onClick={onRemove}>
          <Icon name="x" size={16} />
        </ActionIcon>
      </div>
      <div className="f">
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
      </div>
      <div className="sr-row sr-mt-6">
        <span className="sr-flag">
          {below !== null ? t('belowList', { pct: Math.abs(below) }) : ''}
        </span>
        <b>{formatPrice(lineTotalP(line))}</b>
      </div>
    </div>
  );
}

function Totals({ draft }: { draft: SaleDraft }) {
  const c = saleTotals(draft);
  return (
    <div className="sr-sum">
      <div className="r">
        <span>{t('total')}</span>
        <b data-testid="total">{formatPrice(c.totalP)}</b>
      </div>
      <div className="r sr-muted">
        <span>{t('collectedAtSale')}</span>
        <span>{formatPrice(c.paidP)}</span>
      </div>
      <div className="r t">
        <span>{t('due')}</span>
        <span className={c.dueP > 0 ? 'sr-due' : 'sr-ok'} data-testid="due">
          {formatPrice(c.dueP)}
        </span>
      </div>
    </div>
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
        <Title order={1} fz={19}>
          {t('saleSubmitted')}
        </Title>
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
        <div className="sr-card sr-card-flat">
          <h2 className="sr-h2">{t('buyerShop')}</h2>
          <b>{shop?.name}</b>
        </div>
        <div className="sr-card sr-card-flat">
          {draft.lines.map((l) => (
            <div key={l.variantId} className="sr-row sr-py">
              <span>
                {num(l.qty ?? 0)} x {l.title}
              </span>
              <b>{formatPrice(lineTotalP(l))}</b>
            </div>
          ))}
        </div>
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
        <Button fullWidth loading={submit.isPending} onClick={() => submit.mutate()}>
          {t('submitApproval')}
        </Button>
        <Button fullWidth variant="default" onClick={() => setStep('form')}>
          {t('editSale')}
        </Button>
        <p className="a-hint sr-center">{t('submitHint')}</p>
      </Stack>
    );
  }

  const totals = saleTotals(draft);
  return (
    <Stack gap="md">
      <PageTitle>{t('newSale')}</PageTitle>

      <div>
        <span className="sr-label">{t('buyerShop')}</span>
        <ShopPicker
          shopId={draft.shopId}
          error={attempted ? errors.shop : undefined}
          onChange={(id) => patch({ shopId: id })}
        />
      </div>

      <div>
        <span className="sr-label">{t('items')}</span>
        <Stack gap="xs">
          {draft.lines.length === 0 && (
            <div className={attempted && errors.items ? 'sr-empty sm sr-due' : 'sr-empty sm'}>
              {attempted && errors.items ? errors.items : t('noItems')}
            </div>
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
              variant="default"
              fullWidth
              leftSection={<Icon name="plus" size={16} />}
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
          <Radio
            classNames={{ root: 'sr-radio-card' }}
            value="staff"
            label={t('deliverOffice')}
            description={t('deliverOfficeHint')}
          />
          <Radio
            classNames={{ root: 'sr-radio-card' }}
            value="sr"
            label={t('deliverSr')}
            description={t('deliverSrHint')}
          />
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
          <Button
            size="compact-sm"
            variant="default"
            onClick={() => patch({ paidP: totals.totalP })}
          >
            {t('fullAmount')}
          </Button>
          <Button size="compact-sm" variant="default" onClick={() => patch({ paidP: 0 })}>
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
        fullWidth
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
