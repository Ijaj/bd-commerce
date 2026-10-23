import { Button, Group, Modal, Select, Stack, Text } from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { categoriesApi } from './api';
import { notifyError, notifyOk, useInvalidateCategories } from './queries';
import { categoryLabel, eligibleMoveTargets } from './tree';
import type { Category } from './types';

const ROOT = '__root__';

/** "Move to..." for one category: pick a new parent among the eligible ones (PATCH parentId). */
export function MoveCategoryModal({
  category,
  categories,
  onClose,
}: {
  category: Category | null;
  categories: Category[];
  onClose: () => void;
}) {
  const invalidate = useInvalidateCategories();
  const [target, setTarget] = useState<string | null>(null);

  const data = useMemo(() => {
    if (!category) return [];
    const { root, targets } = eligibleMoveTargets(categories, category);
    return [
      ...(root ? [{ value: ROOT, label: 'Main category (top level)' }] : []),
      ...targets.map((t) => ({ value: t.id, label: categoryLabel(categories, t) })),
    ];
  }, [category, categories]);

  const move = useMutation({
    mutationFn: () =>
      categoriesApi.update((category as Category).id, {
        parentId: target === ROOT ? null : target,
      }),
    onSuccess: () => {
      notifyOk('Category moved');
      invalidate();
      handleClose();
    },
    onError: (e) => notifyError(e, 'Could not move the category'),
  });

  function handleClose() {
    setTarget(null);
    onClose();
  }

  return (
    <Modal opened={!!category} onClose={handleClose} title="Move category" centered>
      {category && (
        <Stack>
          <Text size="sm">
            Move <b>{category.nameEn}</b> (with its sub-categories) under:
          </Text>
          <Select
            data={data}
            value={target}
            onChange={setTarget}
            placeholder="Choose a new parent"
            searchable
            nothingFoundMessage="No eligible category (the 4-level limit applies)"
            aria-label="New parent"
          />
          <Text size="xs" c="dimmed">
            Itself, its sub-categories and parents that would exceed 4 levels are not listed.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={handleClose}>
              Cancel
            </Button>
            <Button disabled={!target} loading={move.isPending} onClick={() => move.mutate()}>
              Move
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
