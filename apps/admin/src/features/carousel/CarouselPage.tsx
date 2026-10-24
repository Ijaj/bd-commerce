import { ActionIcon, Badge, Button, Group, Image, Loader, Paper, Stack, Text } from '@mantine/core';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { ConfirmDelete } from '~/components/ConfirmDelete';
import { PageHeader } from '~/components/PageHeader';
import { notifyError, notifyOk } from '~/features/categories/queries';
import { SortableItem, SortableList } from '~/features/products/Sortable';
import { formatDateTime } from '~/lib/format';
import { useCan } from '~/lib/perm';
import { type CarouselSlide, carouselApi } from './api';
import { LANG_OPTIONS, STATUS_COLOR, STATUS_LABEL, slideStatus } from './logic';
import { carouselQuery, useInvalidateCarousel } from './queries';
import { SlideModal } from './SlideModal';

/** Admin list for home carousel slides: add/edit/delete, drag to reorder. */
export function CarouselPage() {
  const canEdit = useCan('content.manage');
  const invalidate = useInvalidateCarousel();
  const list = useQuery(carouselQuery);
  const [form, setForm] = useState<{ slide: CarouselSlide | null } | null>(null);
  const [deleting, setDeleting] = useState<CarouselSlide | null>(null);
  // Local order while a drag is being saved, so the row does not snap back.
  const [pendingOrder, setPendingOrder] = useState<CarouselSlide[] | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => carouselApi.remove(id),
    onSuccess: () => {
      notifyOk('Slide deleted');
      invalidate();
    },
  });

  const reorder = useMutation({
    mutationFn: async (ids: string[]) => {
      await carouselApi.reorder(ids);
      await invalidate();
    },
    onSettled: () => setPendingOrder(null),
    onError: (e) => notifyError(e, 'Could not save the new order'),
  });

  const rows = pendingOrder ?? list.data ?? [];

  return (
    <div>
      <PageHeader
        title="Home carousel"
        description="Banners at the top of the storefront home page. Drag to reorder; the first live slide shows first."
        actions={
          canEdit && (
            <Button
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={() => setForm({ slide: null })}
            >
              Add slide
            </Button>
          )
        }
      />

      {list.isLoading && <Loader size="sm" aria-label="Loading" />}
      {list.isError && (
        <Text c="red" size="sm">
          {(list.error as Error).message}
        </Text>
      )}
      {list.data && list.data.length === 0 && (
        <Text c="dimmed" size="sm">
          No slides yet. The home page shows no carousel until a slide is live.
        </Text>
      )}

      <SortableList
        items={rows}
        getId={(s) => s.id}
        onReorder={(next) => {
          setPendingOrder(next);
          reorder.mutate(next.map((s) => s.id));
        }}
      >
        <Stack gap={0}>
          {rows.map((s) => (
            <SortableItem key={s.id} id={s.id} disabled={!canEdit}>
              {(handle) => (
                <SlideRow
                  slide={s}
                  handle={canEdit ? handle : null}
                  onEdit={canEdit ? () => setForm({ slide: s }) : null}
                  onDelete={canEdit ? () => setDeleting(s) : null}
                />
              )}
            </SortableItem>
          ))}
        </Stack>
      </SortableList>

      {form && (
        <SlideModal
          key={form.slide?.id ?? 'new'}
          slide={form.slide}
          onClose={() => setForm(null)}
        />
      )}

      <ConfirmDelete
        opened={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete slide"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutateAsync(deleting.id)}
      >
        Delete slide <b>{deleting?.title}</b>? It disappears from the storefront straight away.
      </ConfirmDelete>
    </div>
  );
}

function windowText(s: CarouselSlide): string {
  if (!s.startsAt && !s.endsAt) return 'Always';
  const from = s.startsAt ? `from ${formatDateTime(s.startsAt)}` : '';
  const until = s.endsAt ? `until ${formatDateTime(s.endsAt)}` : '';
  return [from, until].filter(Boolean).join(' ');
}

function SlideRow({
  slide: s,
  handle,
  onEdit,
  onDelete,
}: {
  slide: CarouselSlide;
  handle: ReactNode | null;
  onEdit: (() => void) | null;
  onDelete: (() => void) | null;
}) {
  const status = slideStatus(s);
  const lang = LANG_OPTIONS.find((o) => o.value === s.lang)?.label ?? s.lang;
  return (
    <Paper withBorder p="sm" mb="xs">
      <Group wrap="nowrap" gap="sm" align="center">
        {handle}
        <Image
          src={s.imageDesktop.thumbUrl}
          alt=""
          w={96}
          h={54}
          radius="sm"
          fit="cover"
          style={{ flex: '0 0 auto' }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Group gap="xs" wrap="nowrap">
            <Text size="sm" fw={500} truncate="end">
              {s.title}
            </Text>
            <Badge size="xs" variant="outline" color="gray">
              {lang}
            </Badge>
          </Group>
          <Text size="xs" c="dimmed" truncate="end">
            {windowText(s)}
            {s.linkUrl ? ` · ${s.linkUrl}` : ''}
          </Text>
        </div>
        <Badge size="sm" variant="light" color={STATUS_COLOR[status]}>
          {STATUS_LABEL[status]}
        </Badge>
        {onEdit && (
          <ActionIcon variant="subtle" aria-label={`Edit ${s.title}`} onClick={onEdit}>
            <IconPencil size={16} />
          </ActionIcon>
        )}
        {onDelete && (
          <ActionIcon
            variant="subtle"
            color="red"
            aria-label={`Delete ${s.title}`}
            onClick={onDelete}
          >
            <IconTrash size={16} />
          </ActionIcon>
        )}
      </Group>
    </Paper>
  );
}
