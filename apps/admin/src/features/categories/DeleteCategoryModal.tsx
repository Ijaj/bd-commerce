import {
  Alert,
  Button,
  Group,
  List,
  Modal,
  Radio,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useCan } from '~/lib/perm';
import { categoriesApi } from './api';
import { conflictBody } from './http';
import { notifyError, notifyOk, useInvalidateCategories } from './queries';
import { categoryLabel, deleteMoveTargets } from './tree';
import type { CascadeBlockedBody, Category } from './types';

type Mode = 'move' | 'cascade';

/** Q23/Q73: preview what is inside, then move it all to another category or delete it with its products. */
export function DeleteCategoryModal({
  category,
  categories,
  onClose,
}: {
  category: Category | null;
  categories: Category[];
  onClose: () => void;
}) {
  const canMove = useCan('categories.delete');
  const canCascade = useCan('categories.delete_with_products');
  const invalidate = useInvalidateCategories();
  const [modeChoice, setMode] = useState<Mode | null>(null);
  const mode: Mode = modeChoice ?? (canMove ? 'move' : 'cascade');
  const [targetId, setTargetId] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [blocked, setBlocked] = useState<CascadeBlockedBody | null>(null);

  const id = category?.id;
  const preview = useQuery({
    queryKey: ['categories', 'delete-preview', id],
    queryFn: () => categoriesApi.deletePreview(id as string),
    enabled: !!id,
    gcTime: 0,
  });

  const targets = useMemo(
    () =>
      category
        ? deleteMoveTargets(categories, category).map((t) => ({
            value: t.id,
            label: categoryLabel(categories, t),
          }))
        : [],
    [category, categories],
  );

  const nothingInside =
    preview.data && preview.data.subCategoryCount === 0 && preview.data.productCount === 0;

  const del = useMutation({
    mutationFn: () =>
      categoriesApi.remove(
        (category as Category).id,
        mode === 'cascade'
          ? { mode: 'cascade' }
          : nothingInside
            ? { mode: 'move' }
            : { mode: 'move', targetId: targetId as string },
      ),
    onSuccess: () => {
      notifyOk('Category deleted');
      invalidate();
      onClose();
    },
    onError: (e) => {
      const body = conflictBody<CascadeBlockedBody>(e);
      if (body?.products) setBlocked(body);
      else notifyError(e, 'Could not delete the category');
    },
  });

  const confirmOk =
    mode === 'move'
      ? !!nothingInside || !!targetId
      : typed.trim() === (category?.nameEn ?? '\u0000');

  return (
    <Modal opened={!!category} onClose={onClose} title="Delete category" centered size="lg">
      {category && (
        <Stack>
          <Text size="sm">
            You are deleting <b>{category.nameEn}</b>.
          </Text>
          {preview.isLoading && (
            <Text size="sm" c="dimmed">
              Checking what is inside...
            </Text>
          )}
          {preview.isError && <Alert color="red">{(preview.error as Error).message}</Alert>}
          {preview.data && (
            <Alert color={nothingInside ? 'gray' : 'yellow'} variant="light">
              {nothingInside
                ? 'It has no sub-categories and no products.'
                : `It contains ${preview.data.subCategoryCount} sub-categor${preview.data.subCategoryCount === 1 ? 'y' : 'ies'} and ${preview.data.productCount} product${preview.data.productCount === 1 ? '' : 's'} (${preview.data.primaryProductCount} with it as primary category).`}
            </Alert>
          )}

          {preview.data && (
            <Radio.Group
              value={mode}
              onChange={(v) => {
                setMode(v as Mode);
                setBlocked(null);
              }}
            >
              <Stack gap="sm">
                <Radio
                  value="move"
                  disabled={!canMove}
                  label={nothingInside ? 'Delete category' : 'Move everything to another category'}
                  description={
                    nothingInside
                      ? 'Nothing to move; the empty category is simply removed.'
                      : 'Sub-categories and products go to the category you choose, then this one is deleted.'
                  }
                />
                {mode === 'move' && !nothingInside && (
                  <Select
                    ml={28}
                    data={targets}
                    value={targetId}
                    onChange={setTargetId}
                    searchable
                    placeholder="Target category"
                    aria-label="Target category"
                    nothingFoundMessage="No category can take its sub-categories (4-level limit)"
                  />
                )}
                {canCascade && (
                  <Radio
                    value="cascade"
                    color="red"
                    label="Delete category, sub-categories AND their products"
                    description="Products are permanently deleted. This cannot be undone."
                  />
                )}
                {canCascade && mode === 'cascade' && (
                  <TextInput
                    ml={28}
                    value={typed}
                    onChange={(e) => setTyped(e.currentTarget.value)}
                    label={`Type "${category.nameEn}" to confirm`}
                    aria-label="Confirm category name"
                  />
                )}
              </Stack>
            </Radio.Group>
          )}

          {blocked && (
            <Alert color="red" title="Some products cannot be deleted">
              <Text size="sm" mb={4}>
                {blocked.message}
              </Text>
              <List size="sm" spacing={2}>
                {blocked.products.map((p) => (
                  <List.Item key={p.id}>{p.titleEn}</List.Item>
                ))}
              </List>
            </Alert>
          )}

          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button
              color="red"
              disabled={!preview.data || !confirmOk || (!canMove && !canCascade)}
              loading={del.isPending}
              onClick={() => del.mutate()}
            >
              {mode === 'cascade'
                ? 'Delete everything'
                : nothingInside
                  ? 'Delete'
                  : 'Move and delete'}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
