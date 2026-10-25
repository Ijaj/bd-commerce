import { Button, Group, Modal, Stack, Switch, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation } from '@tanstack/react-query';
import { BilingualTextInput } from '~/components/BilingualTextInput';
import { ImageUpload, type MediaDto } from '~/components/ImageUpload';
import { notifyError, notifyOk, refToMedia } from '~/features/categories/queries';
import { brandsApi } from './api';
import classes from './BrandsPage.module.css';
import { type Brand, useInvalidateBrands } from './queries';

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

interface Values {
  nameEn: string;
  nameBn: string;
  slug: string;
  logo: MediaDto | null;
  active: boolean;
}

/** Create (brand = null) or edit a brand. */
export function BrandModal({
  brand,
  readOnly,
  onClose,
}: {
  brand: Brand | null;
  readOnly: boolean;
  onClose: () => void;
}) {
  const invalidate = useInvalidateBrands();
  const form = useForm<Values>({
    initialValues: {
      nameEn: brand?.nameEn ?? '',
      nameBn: brand?.nameBn ?? '',
      slug: brand?.slug ?? '',
      logo:
        brand?.logoMediaId && brand.logoUrl
          ? refToMedia({ mediaId: brand.logoMediaId, url: brand.logoUrl })
          : null,
      active: brand?.active ?? true,
    },
    validate: {
      nameEn: (v) => (v.trim() ? null : 'English name is required'),
      slug: (v) =>
        !v.trim() || SLUG_RE.test(v.trim()) ? null : 'Lowercase letters, digits and hyphens only',
    },
  });

  const save = useMutation({
    mutationFn: (v: Values) => {
      const slug = v.slug.trim();
      const body = {
        nameEn: v.nameEn.trim(),
        nameBn: v.nameBn.trim() || null,
        logoMediaId: v.logo?.id ?? null,
        active: v.active,
        ...(slug && slug !== brand?.slug ? { slug } : {}),
      };
      return brand ? brandsApi.update(brand.id, body) : brandsApi.create(body);
    },
    onSuccess: () => {
      notifyOk(brand ? 'Brand saved' : 'Brand created');
      invalidate();
      onClose();
    },
    onError: (e) => notifyError(e, 'Could not save the brand'),
  });

  return (
    <Modal
      opened
      onClose={onClose}
      title={brand ? `Edit brand: ${brand.nameEn}` : 'Add brand'}
      centered
      size="lg"
    >
      <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
        <fieldset disabled={readOnly} className={classes.fieldset}>
          <Stack>
            <BilingualTextInput
              label="Name"
              required
              maxLength={100}
              value={{ en: form.values.nameEn, bn: form.values.nameBn }}
              onChange={(v) => {
                form.setFieldValue('nameEn', v.en);
                form.setFieldValue('nameBn', v.bn);
              }}
              error={form.errors.nameEn as string | undefined}
            />
            <TextInput
              label="Slug"
              description="Leave blank to generate it from the English name."
              placeholder="auto from name"
              {...form.getInputProps('slug')}
            />
            <ImageUpload
              label="Logo"
              value={form.values.logo}
              onChange={(m) => form.setFieldValue('logo', m)}
              disabled={readOnly}
            />
            <Switch label="Active" {...form.getInputProps('active', { type: 'checkbox' })} />
          </Stack>
        </fieldset>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            {readOnly ? 'Close' : 'Cancel'}
          </Button>
          {!readOnly && (
            <Button type="submit" loading={save.isPending}>
              {brand ? 'Save' : 'Add brand'}
            </Button>
          )}
        </Group>
      </form>
    </Modal>
  );
}
