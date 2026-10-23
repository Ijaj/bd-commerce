import {
  Button,
  ColorInput,
  Group,
  NumberInput,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconArrowsMove } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { BilingualTextInput } from '~/components/BilingualTextInput';
import { ImageUpload } from '~/components/ImageUpload';
import { useCan } from '~/lib/perm';
import { categoriesApi } from './api';
import { type CategoryFormValues, emptyFormValues, formToInput } from './form';
import { notifyError, notifyOk, refToMedia, useInvalidateCategories } from './queries';
import { categoryLabel } from './tree';
import type { Category } from './types';

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function valuesFrom(c: Category): CategoryFormValues {
  return {
    nameEn: c.nameEn,
    nameBn: c.nameBn ?? '',
    slug: c.slug,
    descriptionEn: c.descriptionEn ?? '',
    descriptionBn: c.descriptionBn ?? '',
    image: refToMedia(c.image),
    icon: refToMedia(c.icon),
    banner: refToMedia(c.banner),
    chipColor: c.chipColor ?? '',
    sort: c.sort,
    isActive: c.isActive,
    showOnHome: c.showOnHome,
    returnWindowDays: c.returnWindowDays ?? '',
    seoTitle: c.seoTitle ?? '',
    seoDescription: c.seoDescription ?? '',
  };
}

export interface CategoryFormProps {
  /** Existing category (edit) or null (create). */
  category: Category | null;
  /** Parent for create (null = main category). */
  parent: Category | null;
  categories: Category[];
  readOnly: boolean;
  onSaved: (c: Category, created: boolean) => void;
  onMove: () => void;
}

export function CategoryForm({
  category,
  parent,
  categories,
  readOnly,
  onSaved,
  onMove,
}: CategoryFormProps) {
  const invalidate = useInvalidateCategories();
  const canSetHome = useCan('categories.set_home');
  const level = category ? category.level : (parent?.level ?? 0) + 1;

  const form = useForm<CategoryFormValues>({
    initialValues: category ? valuesFrom(category) : emptyFormValues(),
    validate: {
      nameEn: (v) => (v.trim() ? null : 'English name is required'),
      slug: (v) =>
        !v.trim() || SLUG_RE.test(v.trim()) ? null : 'Lowercase letters, digits and hyphens only',
      image: (v) => (level === 1 && !v ? 'Main categories need an image' : null),
      chipColor: (v) =>
        !v.trim() || HEX_RE.test(v.trim()) ? null : 'Use a hex colour like #4f46e5',
    },
  });
  const set = form.setFieldValue;

  const save = useMutation({
    mutationFn: (v: CategoryFormValues) => {
      const input = formToInput(v, {
        level,
        canSetHome,
        original: category ?? undefined,
        parentId: parent?.id ?? null,
      });
      return category ? categoriesApi.update(category.id, input) : categoriesApi.create(input);
    },
    onSuccess: (saved) => {
      notifyOk(category ? 'Category saved' : 'Category created');
      invalidate();
      onSaved(saved, !category);
    },
    onError: (e) => notifyError(e, 'Could not save the category'),
  });

  const parentLabel = category
    ? category.parentId
      ? categoryLabel(categories, categories.find((c) => c.id === category.parentId) ?? category)
      : 'None (main category)'
    : parent
      ? categoryLabel(categories, parent)
      : 'None (main category)';

  return (
    <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <Stack gap="md">
          <Group align="flex-end" wrap="nowrap">
            <TextInput
              label="Parent"
              value={parentLabel}
              readOnly
              style={{ flex: 1 }}
              description={`Level ${level} of 4`}
            />
            {category && !readOnly && (
              <Button variant="default" leftSection={<IconArrowsMove size={14} />} onClick={onMove}>
                Move to...
              </Button>
            )}
          </Group>

          <BilingualTextInput
            label="Name"
            required
            maxLength={150}
            value={{ en: form.values.nameEn, bn: form.values.nameBn }}
            onChange={(v) => {
              set('nameEn', v.en);
              set('nameBn', v.bn);
            }}
            error={form.errors.nameEn as string | undefined}
          />
          <TextInput
            label="Slug"
            description={
              category
                ? 'Changing the slug changes the shop URL.'
                : 'Leave blank to generate it from the English name.'
            }
            placeholder="auto from name"
            {...form.getInputProps('slug')}
          />
          <BilingualTextInput
            label="Description"
            multiline
            rows={3}
            maxLength={5000}
            value={{ en: form.values.descriptionEn, bn: form.values.descriptionBn }}
            onChange={(v) => {
              set('descriptionEn', v.en);
              set('descriptionBn', v.bn);
            }}
          />

          <div>
            <ImageUpload
              label={level === 1 ? 'Image (required for main categories)' : 'Image'}
              value={form.values.image}
              onChange={(m) => set('image', m)}
              disabled={readOnly}
            />
            {form.errors.image && (
              <Text size="xs" c="red" mt={4}>
                {form.errors.image}
              </Text>
            )}
          </div>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <ImageUpload
              label="Icon"
              value={form.values.icon}
              onChange={(m) => set('icon', m)}
              disabled={readOnly}
            />
            <ImageUpload
              label="Banner"
              value={form.values.banner}
              onChange={(m) => set('banner', m)}
              disabled={readOnly}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <ColorInput
              label="Chip colour"
              format="hex"
              placeholder="#4f46e5"
              {...form.getInputProps('chipColor')}
            />
            <NumberInput
              label="Sort"
              description="Lower first"
              min={0}
              max={1_000_000}
              allowDecimal={false}
              {...form.getInputProps('sort')}
            />
            <NumberInput
              label="Return window (days)"
              description="Blank = shop default"
              min={0}
              max={365}
              allowDecimal={false}
              {...form.getInputProps('returnWindowDays')}
            />
          </SimpleGrid>
          <Group>
            <Switch label="Active" {...form.getInputProps('isActive', { type: 'checkbox' })} />
            {level === 1 && canSetHome && (
              <Switch
                label="Show on home page"
                {...form.getInputProps('showOnHome', { type: 'checkbox' })}
              />
            )}
          </Group>

          <TextInput label="SEO title" maxLength={200} {...form.getInputProps('seoTitle')} />
          <Textarea
            label="SEO description"
            autosize
            minRows={2}
            maxLength={500}
            {...form.getInputProps('seoDescription')}
          />
        </Stack>
      </fieldset>
      {!readOnly && (
        <Group justify="flex-end" mt="md">
          <Button type="submit" loading={save.isPending}>
            {category ? 'Save changes' : 'Create category'}
          </Button>
        </Group>
      )}
    </form>
  );
}
