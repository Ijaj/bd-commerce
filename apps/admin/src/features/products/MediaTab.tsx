import {
  ActionIcon,
  Group,
  Image,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { ImageUpload, type MediaDto } from '~/components/ImageUpload';
import classes from './MediaTab.module.css';
import type { ImageDraft } from './payload';
import { SortableItem, SortableList } from './Sortable';

interface Props {
  images: ImageDraft[];
  onChange: (images: ImageDraft[]) => void;
  /** Saved variants only: an image can be tied to a variant that already has an id. */
  variantOptions: { value: string; label: string }[];
  disabled: boolean;
}

const ALL = '__all__';

export function MediaTab({ images, onChange, variantOptions, disabled }: Props) {
  const update = (mediaId: string, patch: Partial<ImageDraft>) =>
    onChange(images.map((i) => (i.mediaId === mediaId ? { ...i, ...patch } : i)));

  function added(list: MediaDto[]) {
    const have = new Set(images.map((i) => i.mediaId));
    const fresh = list
      .filter((m) => !have.has(m.id))
      .map<ImageDraft>((m) => ({
        mediaId: m.id,
        url: m.url,
        thumbUrl: m.thumbUrl,
        alt: m.alt ?? '',
        variantId: null,
      }));
    onChange([...images, ...fresh]);
  }

  return (
    <Stack gap="md">
      {!disabled && (
        <ImageUpload
          multiple
          value={[]}
          onChange={added}
          label="Add images"
          description="The first image is the product's main image. Drag to reorder."
        />
      )}
      {images.length === 0 && (
        <Text size="sm" c="dimmed">
          No images yet.
        </Text>
      )}
      <SortableList items={images} getId={(i) => i.mediaId} onReorder={onChange} layout="grid">
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
          {images.map((img, index) => (
            <SortableItem key={img.mediaId} id={img.mediaId} disabled={disabled}>
              {(handle) => (
                <Paper withBorder p="xs" className={classes.card}>
                  <Group align="flex-start" wrap="nowrap" gap="xs">
                    <div className={classes.tile}>
                      <Image src={img.thumbUrl} alt={img.alt} w={84} h={84} fit="cover" />
                      {index === 0 && <span className={classes.main}>Main</span>}
                    </div>
                    <Stack gap={6} className={classes.body}>
                      <Group justify="space-between" gap={4}>
                        <Group gap={4}>
                          {handle}
                          <Text size="xs" c="dimmed">
                            {index === 0 ? 'Main image' : `Image ${index + 1}`}
                          </Text>
                        </Group>
                        {!disabled && (
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            size="sm"
                            aria-label="Remove image"
                            onClick={() =>
                              onChange(images.filter((i) => i.mediaId !== img.mediaId))
                            }
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        )}
                      </Group>
                      <TextInput
                        size="xs"
                        placeholder="Alt text"
                        aria-label="Alt text"
                        maxLength={250}
                        disabled={disabled}
                        value={img.alt}
                        onChange={(e) => update(img.mediaId, { alt: e.currentTarget.value })}
                      />
                      {variantOptions.length > 0 && (
                        <Select
                          size="xs"
                          aria-label="Variant"
                          allowDeselect={false}
                          disabled={disabled}
                          data={[{ value: ALL, label: 'All variants' }, ...variantOptions]}
                          value={img.variantId ?? ALL}
                          onChange={(v) => update(img.mediaId, { variantId: v === ALL ? null : v })}
                        />
                      )}
                    </Stack>
                  </Group>
                </Paper>
              )}
            </SortableItem>
          ))}
        </SimpleGrid>
      </SortableList>
    </Stack>
  );
}
