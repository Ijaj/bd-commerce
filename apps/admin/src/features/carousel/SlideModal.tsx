import { Button, Group, Modal, Select, Stack, Switch, Text, TextInput } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { useMutation } from '@tanstack/react-query';
import { ImageUpload, type MediaDto } from '~/components/ImageUpload';
import { notifyError, notifyOk } from '~/features/categories/queries';
import { type CarouselLang, type CarouselMedia, type CarouselSlide, carouselApi } from './api';
import { isoToLocal, LANG_OPTIONS, localToIso, toInput, validateLink } from './logic';
import { useInvalidateCarousel } from './queries';

interface Values {
  title: string;
  imageDesktop: MediaDto | null;
  imageMobile: MediaDto | null;
  linkUrl: string;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  lang: CarouselLang;
}

/** Saved media in the shape ImageUpload shows; only id and urls matter for display. */
function toMedia(m: CarouselMedia | null): MediaDto | null {
  return m
    ? {
        id: m.id,
        mime: '',
        width: 0,
        height: 0,
        bytes: 0,
        alt: null,
        url: m.url,
        thumbUrl: m.thumbUrl,
        createdAt: '',
      }
    : null;
}

/** Create (slide = null) or edit a carousel slide. */
export function SlideModal({
  slide,
  onClose,
}: {
  slide: CarouselSlide | null;
  onClose: () => void;
}) {
  const invalidate = useInvalidateCarousel();
  const form = useForm<Values>({
    initialValues: {
      title: slide?.title ?? '',
      imageDesktop: toMedia(slide?.imageDesktop ?? null),
      imageMobile: toMedia(slide?.imageMobile ?? null),
      linkUrl: slide?.linkUrl ?? '',
      startsAt: isoToLocal(slide?.startsAt ?? null),
      endsAt: isoToLocal(slide?.endsAt ?? null),
      isActive: slide?.isActive ?? true,
      lang: slide?.lang ?? 'all',
    },
    validate: {
      title: (v) => (v.trim() ? null : 'Title is required'),
      imageDesktop: (v) => (v ? null : 'Desktop image is required'),
      linkUrl: (v) => validateLink(v),
      endsAt: (v, values) => {
        if (!v || !values.startsAt) return null;
        const s = localToIso(values.startsAt);
        const e = localToIso(v);
        return s && e && Date.parse(e) <= Date.parse(s) ? 'Must be after the start time' : null;
      },
    },
  });

  const save = useMutation({
    mutationFn: (v: Values) => {
      const body = toInput({
        title: v.title,
        imageDesktopId: v.imageDesktop?.id ?? null,
        imageMobileId: v.imageMobile?.id ?? null,
        linkUrl: v.linkUrl,
        startsAt: v.startsAt,
        endsAt: v.endsAt,
        isActive: v.isActive,
        lang: v.lang,
      });
      return slide ? carouselApi.update(slide.id, body) : carouselApi.create(body);
    },
    onSuccess: () => {
      notifyOk(slide ? 'Slide saved' : 'Slide added');
      invalidate();
      onClose();
    },
    onError: (e) => notifyError(e, 'Could not save the slide'),
  });

  return (
    <Modal
      opened
      onClose={onClose}
      title={slide ? `Edit slide: ${slide.title}` : 'Add slide'}
      centered
      size="lg"
    >
      <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
        <Stack>
          <TextInput label="Title" required maxLength={120} {...form.getInputProps('title')} />
          <ImageUpload
            label="Desktop image"
            description="Required. Wide banners work best; the shop crops to fit."
            value={form.values.imageDesktop}
            onChange={(m) => form.setFieldValue('imageDesktop', m)}
          />
          {form.errors.imageDesktop && (
            <Text c="red" size="xs">
              {form.errors.imageDesktop}
            </Text>
          )}
          <ImageUpload
            label="Mobile image"
            description="Optional. Shown on phones; falls back to the desktop image."
            value={form.values.imageMobile}
            onChange={(m) => form.setFieldValue('imageMobile', m)}
          />
          <TextInput
            label="Link"
            description="Optional. /p/product-slug, /c/category-slug or an https:// URL."
            placeholder="/c/women-clothing"
            {...form.getInputProps('linkUrl')}
          />
          <Group grow align="flex-start">
            <DateTimePicker
              label="Starts at"
              description="Empty = starts now"
              clearable
              valueFormat="DD MMM YYYY HH:mm"
              value={form.values.startsAt}
              onChange={(v) => form.setFieldValue('startsAt', v)}
            />
            <DateTimePicker
              label="Ends at"
              description="Empty = never ends"
              clearable
              valueFormat="DD MMM YYYY HH:mm"
              value={form.values.endsAt}
              onChange={(v) => form.setFieldValue('endsAt', v)}
              error={form.errors.endsAt as string | undefined}
            />
          </Group>
          <Select
            label="Language"
            data={LANG_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            allowDeselect={false}
            {...form.getInputProps('lang')}
          />
          <Switch label="Active" {...form.getInputProps('isActive', { type: 'checkbox' })} />
        </Stack>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            {slide ? 'Save' : 'Add slide'}
          </Button>
        </Group>
      </form>
    </Modal>
  );
}
