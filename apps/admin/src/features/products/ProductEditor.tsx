import { Icon, PageHeader } from '@bdc/ui';
import {
  Alert,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  Paper,
  Stack,
  Tabs,
  Text,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArchive, IconEye, IconEyeOff } from '@tabler/icons-react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useBlocker, useNavigate } from '@tanstack/react-router';
import { useMemo, useRef, useState } from 'react';
import { api } from '~/api';
import { useCan } from '~/lib/perm';
import { AttributesTab } from './AttributesTab';
import { useProductActions } from './actions';
import { type AttrValues, mergeAttributes, valuesFromDetail } from './attributes';
import { BasicsTab } from './BasicsTab';
import { categoryOptions } from './categoryTree';
import { DescriptionTab } from './DescriptionTab';
import { call, ProductApiError } from './http';
import { MediaTab } from './MediaTab';
import { ProblemsModal } from './ProblemsModal';
import classes from './ProductEditor.module.css';
import {
  buildImagesPayload,
  buildProductPayload,
  emptyForm,
  formFromDetail,
  type ImageDraft,
  imagesFromDetail,
  type ProductForm,
} from './payload';
import {
  brandsQuery,
  categoriesQuery,
  categoryDetailQuery,
  productDetailQuery,
  productsKey,
} from './queries';
import { ShippingTab } from './ShippingTab';
import { StatusBadge } from './StatusBadge';
import type { ProductDetail } from './types';
import { VariantsTab } from './VariantsTab';
import {
  buildVariantsPayload,
  comboLabel,
  type OptionDraft,
  optionsFromDetail,
  rowsFromDetail,
  skuProblems,
  usableOptions,
  type VariantRowDraft,
} from './variants';

/**
 * Loads the product, then mounts the form keyed by id + a version counter. The form copies the
 * detail into local drafts once; saving (or discarding) bumps the version, which remounts it from
 * the freshest data. Background refetches therefore never overwrite what is being typed.
 */
export function ProductEditor({ id }: { id: string }) {
  const isNew = id === 'new';
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState<string>('basics');
  const qc = useQueryClient();
  const detailQ = useQuery({
    ...productDetailQuery(id),
    enabled: !isNew,
    gcTime: 0,
    refetchOnMount: 'always',
  });

  if (!isNew && detailQ.isLoading) {
    return (
      <Center py="xl">
        <Loader aria-label="Loading product" />
      </Center>
    );
  }
  if (!isNew && !detailQ.data) {
    return (
      <Alert color="red" title="Could not load this product">
        {detailQ.error?.message ?? 'Not found.'}{' '}
        <Link to="/catalog/products">Back to products</Link>
      </Alert>
    );
  }

  return (
    <EditorForm
      key={`${id}:${version}`}
      id={id}
      detail={detailQ.data}
      tab={tab}
      onTab={setTab}
      onDiscard={() => setVersion((v) => v + 1)}
      onSaved={(d) => {
        qc.setQueryData(productDetailQuery(d.id).queryKey, d);
        qc.invalidateQueries({ queryKey: [...productsKey, 'list'] });
        setVersion((v) => v + 1);
      }}
    />
  );
}

interface FormProps {
  id: string;
  /** Latest server copy; drafts are copied from it once at mount. */
  detail: ProductDetail | undefined;
  tab: string;
  onTab: (tab: string) => void;
  onDiscard: () => void;
  onSaved: (d: ProductDetail) => void;
}

function EditorForm({ id, detail, tab, onTab, onDiscard, onSaved }: FormProps) {
  const isNew = !detail;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canEdit = useCan(isNew ? 'products.create' : 'products.edit');
  const canEditPrice = useCan('products.edit_price');
  const canViewCost = useCan('products.view_cost');
  const canPublish = useCan('products.publish');
  const canDelete = useCan('products.delete');

  const [form, setForm] = useState<ProductForm>(() =>
    detail ? formFromDetail(detail, valuesFromDetail(detail.attributeValues)) : emptyForm(),
  );
  const [options, setOptions] = useState<OptionDraft[]>(() =>
    detail ? optionsFromDetail(detail) : [],
  );
  const [rows, setRows] = useState<VariantRowDraft[]>(() => (detail ? rowsFromDetail(detail) : []));
  const [images, setImages] = useState<ImageDraft[]>(() =>
    detail ? imagesFromDetail(detail) : [],
  );
  const [conflictSkus, setConflictSkus] = useState<ReadonlySet<string>>(new Set());

  const base = useRef({
    form: JSON.stringify(form),
    variants: JSON.stringify({ options, rows }),
    images: JSON.stringify(images),
  });
  const formDirty = JSON.stringify(form) !== base.current.form;
  const variantsDirty = JSON.stringify({ options, rows }) !== base.current.variants;
  const imagesDirty = JSON.stringify(images) !== base.current.images;
  const dirty = formDirty || variantsDirty || imagesDirty;

  const set = (patch: Partial<ProductForm>) => setForm((f) => ({ ...f, ...patch }));

  // ---- lookups and inherited attributes ----
  const categoriesQ = useQuery(categoriesQuery);
  const brandsQ = useQuery(brandsQuery);
  const categorySelect = useMemo(() => categoryOptions(categoriesQ.data), [categoriesQ.data]);
  const brandSelect = (brandsQ.data ?? []).map((b) => ({ value: b.id, label: b.nameEn }));

  const selectedCategoryIds = [form.primaryCategoryId, ...form.extraCategoryIds].filter(
    (c): c is string => !!c,
  );
  const attrQueries = useQueries({
    queries: selectedCategoryIds.map((c) => categoryDetailQuery(c)),
  });
  const attrsLoading = attrQueries.some((q) => q.isLoading);
  const attrsReady = attrQueries.every((q) => q.isSuccess);
  const attributes = mergeAttributes(attrQueries.flatMap((q) => (q.data ? [q.data] : [])));

  // ---- leave guard ----
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const skipGuard = useRef(false);
  const blocker = useBlocker({
    shouldBlockFn: () => dirtyRef.current && !skipGuard.current,
    enableBeforeUnload: () => dirtyRef.current && !skipGuard.current,
    withResolver: true,
  });

  // ---- save: one button; PATCH product, then PUT variants / PUT images only when dirty ----
  const save = useMutation({
    mutationFn: async () => {
      if (!form.titleEn.trim()) throw new Error('English title is required');
      if (!form.primaryCategoryId) throw new Error('Choose a primary category');
      const attrs = attrsReady ? attributes : null;

      if (!detail) {
        return call(
          // options: [] is the generated type's required (defaulted) field; no variants = default draft variant.
          api.POST('/v1/admin/products', {
            body: { ...buildProductPayload(form, attrs), options: [] },
          }),
        );
      }

      if (variantsDirty) {
        if (options.some((o) => o.nameEn.trim() !== '' && usableOptions([o]).length === 0)) {
          throw new Error('Each option needs at least one value');
        }
        if (options.some((o) => o.nameEn.trim() === '' && o.values.some((v) => v.valueEn.trim()))) {
          throw new Error('Give every option a name');
        }
        if (rows.every((r) => r.retired)) throw new Error('A product needs at least one variant');
        if (skuProblems(rows).size) throw new Error('Fix the empty or duplicate SKUs first');
      }

      let latest = detail;
      try {
        if (formDirty) {
          latest = await call(
            api.PATCH('/v1/admin/products/{id}', {
              params: { path: { id } },
              body: buildProductPayload(form, attrs),
            }),
          );
        }
        if (variantsDirty) {
          latest = await call(
            api.PUT('/v1/admin/products/{id}/variants', {
              params: { path: { id } },
              body: buildVariantsPayload(options, rows, { canViewCost }),
            }),
          );
        }
        if (imagesDirty) {
          latest = await call(
            api.PUT('/v1/admin/products/{id}/images', {
              params: { path: { id } },
              body: buildImagesPayload(images, new Set(latest.variants.map((v) => v.id))),
            }),
          );
        }
      } catch (e) {
        // Earlier steps may have saved: keep the cached copy current for the read-only parts.
        if (latest !== detail) qc.setQueryData(productDetailQuery(id).queryKey, latest);
        throw e;
      }
      return latest;
    },
    onMutate: () => setConflictSkus(new Set()),
    onSuccess: (saved) => {
      notifications.show({ color: 'green', message: isNew ? 'Product created' : 'Product saved' });
      if (isNew) {
        skipGuard.current = true;
        qc.invalidateQueries({ queryKey: [...productsKey, 'list'] });
        navigate({ to: '/catalog/products/$id', params: { id: saved.id }, replace: true });
      } else {
        onSaved(saved);
      }
    },
    onError: (e) => {
      if (e instanceof ProductApiError && e.status === 409) {
        const m = /SKU "([^"]+)"/.exec(e.message);
        if (m?.[1]) setConflictSkus(new Set([m[1].toUpperCase()]));
        if (/slug/i.test(e.message)) onTab('basics');
        else if (m) onTab('variants');
      }
      notifications.show({ color: 'red', title: 'Not saved', message: e.message });
    },
  });

  const actions = useProductActions(() => {
    qc.invalidateQueries({ queryKey: productDetailQuery(id).queryKey });
  });

  const liveRows = rows.filter((r) => !r.retired);
  const variantOptions = liveRows
    .filter((r) => r.id)
    .map((r) => ({ value: r.id as string, label: comboLabel(options, r.valueKeys) || r.sku }));

  const disabled = !canEdit;
  const status = detail?.status;

  return (
    <>
      <PageHeader
        title={
          <>
            {form.titleEn.trim() || (isNew ? 'New product' : 'Untitled product')}
            {status && (
              <span className={classes.titleBadge}>
                <StatusBadge status={status} />
              </span>
            )}
          </>
        }
        crumbs={[
          'Catalog',
          <Link key="list" to="/catalog/products">
            Products
          </Link>,
          detail?.titleEn ?? 'New product',
        ]}
        actions={
          <>
            <Button
              component={Link}
              to="/catalog/products"
              variant="subtle"
              aria-label="Back to products"
              leftSection={<Icon name="chevron" size={14} className={classes.back} />}
            >
              Back to list
            </Button>
            {!isNew && canPublish && status !== 'active' && (
              <Tooltip label="Save your changes first" disabled={!dirty}>
                <Button
                  leftSection={<IconEye size={16} />}
                  loading={actions.pending}
                  disabled={dirty}
                  onClick={() => actions.publish(id)}
                >
                  Publish
                </Button>
              </Tooltip>
            )}
            {!isNew && canPublish && status === 'active' && (
              <Tooltip label="Save your changes first" disabled={!dirty}>
                <Button
                  variant="default"
                  leftSection={<IconEyeOff size={16} />}
                  loading={actions.pending}
                  disabled={dirty}
                  onClick={() => actions.unpublish(id)}
                >
                  Unpublish
                </Button>
              </Tooltip>
            )}
            {!isNew && canDelete && status !== 'archived' && (
              <Button
                variant="default"
                leftSection={<IconArchive size={16} />}
                loading={actions.pending}
                disabled={dirty}
                onClick={() => actions.archive(id)}
              >
                Archive
              </Button>
            )}
          </>
        }
      />

      {!canEdit && (
        <Alert color="gray" variant="light" mb="md" className={classes.notice}>
          You can view this product but not change it.
        </Alert>
      )}

      <Tabs value={tab} onChange={(v) => v && onTab(v)} keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="basics">Basics</Tabs.Tab>
          <Tabs.Tab value="description">Description</Tabs.Tab>
          <Tabs.Tab value="media" disabled={isNew}>
            Media{images.length ? ` (${images.length})` : ''}
          </Tabs.Tab>
          <Tabs.Tab value="variants" disabled={isNew}>
            Variants{liveRows.length ? ` (${liveRows.length})` : ''}
          </Tabs.Tab>
          <Tabs.Tab value="attributes">Attributes</Tabs.Tab>
          <Tabs.Tab value="shipping">Shipping &amp; rules</Tabs.Tab>
        </Tabs.List>

        <Paper withBorder p="md" mb="md">
          <Tabs.Panel value="basics">
            <BasicsTab
              form={form}
              set={set}
              disabled={disabled}
              categories={categorySelect}
              brands={brandSelect}
            />
            {isNew && (
              <Text size="sm" c="dimmed" mt="md">
                After the first save you can add images, variants and prices.
              </Text>
            )}
          </Tabs.Panel>
          <Tabs.Panel value="description">
            <DescriptionTab form={form} set={set} disabled={disabled} />
          </Tabs.Panel>
          <Tabs.Panel value="media">
            <MediaTab
              images={images}
              onChange={setImages}
              variantOptions={variantOptions.length > 1 ? variantOptions : []}
              disabled={disabled}
            />
          </Tabs.Panel>
          <Tabs.Panel value="variants">
            <VariantsTab
              options={options}
              rows={rows}
              onChange={(o, r) => {
                setOptions(o);
                setRows(r);
              }}
              slug={form.slug || form.titleEn}
              canEdit={canEdit}
              canEditPrice={canEditPrice}
              canViewCost={canViewCost}
              conflictSkus={conflictSkus}
            />
          </Tabs.Panel>
          <Tabs.Panel value="attributes">
            <AttributesTab
              attributes={attributes}
              loading={attrsLoading}
              values={form.attributes}
              onChange={(attributes: AttrValues) => set({ attributes })}
              disabled={disabled}
            />
          </Tabs.Panel>
          <Tabs.Panel value="shipping">
            <ShippingTab form={form} set={set} disabled={disabled} />
          </Tabs.Panel>
        </Paper>
      </Tabs>

      {canEdit && (
        <div className={classes.savebar} data-testid="save-bar">
          <Group justify="space-between" className={classes.saveRow}>
            <Text size="sm" className={dirty ? classes.dirty : classes.msg}>
              {dirty
                ? 'You have unsaved changes'
                : isNew
                  ? 'Fill in the basics, then save'
                  : 'All changes saved'}
            </Text>
            <Group gap="xs">
              {dirty && (
                <Button variant="default" disabled={save.isPending} onClick={onDiscard}>
                  Discard
                </Button>
              )}
              <Button
                loading={save.isPending}
                disabled={!dirty && !isNew}
                onClick={() => save.mutate()}
              >
                {isNew ? 'Create product' : 'Save'}
              </Button>
            </Group>
          </Group>
        </div>
      )}

      <ProblemsModal problems={actions.problems} onClose={actions.clearProblems} />

      <Modal
        opened={blocker.status === 'blocked'}
        onClose={() => blocker.reset?.()}
        title="Leave without saving?"
        size="sm"
        centered
      >
        <Stack gap="md">
          <Text size="sm">You have unsaved changes on this product. They will be lost.</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => blocker.reset?.()}>
              Keep editing
            </Button>
            <Button color="red" onClick={() => blocker.proceed?.()}>
              Leave
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
