import { ActionIcon, Group, Image, Loader, Stack, Text } from '@mantine/core';
import { Dropzone, IMAGE_MIME_TYPE } from '@mantine/dropzone';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { errorMessage } from '~/api';

/** Shape returned by POST /v1/admin/media (GET/PATCH too). */
export interface MediaDto {
  id: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  alt: string | null;
  /** Signed imgproxy URL, 600px fit, webp. */
  url: string;
  /** 160px square thumbnail. */
  thumbUrl: string;
  createdAt: string;
}

const MAX_BYTES = 10 * 1024 * 1024;

/** Uploads one file through the API (multipart, cookie auth). Throws Error with the API message. */
export async function uploadMedia(file: File, alt?: string): Promise<MediaDto> {
  const body = new FormData();
  body.append('file', file);
  if (alt) body.append('alt', alt);
  const res = await fetch('/v1/admin/media', { method: 'POST', body, credentials: 'include' });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(errorMessage(json, `Upload failed (${res.status})`));
  return json as MediaDto;
}

type Common = { disabled?: boolean; label?: string; description?: string };
export type ImageUploadProps =
  | (Common & {
      multiple?: false;
      /** The current image, or null. */
      value: MediaDto | null;
      onChange: (value: MediaDto | null) => void;
    })
  | (Common & {
      multiple: true;
      /** Ordered list of images; new uploads are appended. */
      value: MediaDto[];
      onChange: (value: MediaDto[]) => void;
    });

/**
 * Dropzone that uploads to /v1/admin/media and shows thumbnails with a remove button.
 * Single mode holds one MediaDto|null, `multiple` mode an array. Store `.id` as the mediaId.
 *   <ImageUpload value={logo} onChange={setLogo} />
 *   <ImageUpload multiple value={images} onChange={setImages} />
 */
export function ImageUpload(props: ImageUploadProps) {
  const [busy, setBusy] = useState(0);
  const items = props.multiple ? props.value : props.value ? [props.value] : [];

  async function onDrop(files: File[]) {
    setBusy((n) => n + files.length);
    const uploaded: MediaDto[] = [];
    for (const file of files) {
      try {
        uploaded.push(await uploadMedia(file));
      } catch (e) {
        notifications.show({
          color: 'red',
          title: file.name,
          message: e instanceof Error ? e.message : 'Upload failed',
        });
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (!uploaded.length) return;
    if (props.multiple) props.onChange([...props.value, ...uploaded]);
    else props.onChange(uploaded[uploaded.length - 1] ?? null);
  }

  function remove(id: string) {
    if (props.multiple) props.onChange(props.value.filter((m) => m.id !== id));
    else props.onChange(null);
  }

  return (
    <Stack gap="xs">
      {props.label && (
        <div>
          <Text size="sm" fw={500}>
            {props.label}
          </Text>
          {props.description && (
            <Text size="xs" c="dimmed">
              {props.description}
            </Text>
          )}
        </div>
      )}
      {items.length > 0 && (
        <Group gap="xs">
          {items.map((m) => (
            <div key={m.id} style={{ position: 'relative' }}>
              <Image
                src={m.thumbUrl}
                alt={m.alt ?? ''}
                w={80}
                h={80}
                radius="sm"
                fit="cover"
                style={{ border: '1px solid var(--mantine-color-default-border)' }}
              />
              {!props.disabled && (
                <ActionIcon
                  size="xs"
                  color="red"
                  variant="filled"
                  radius="xl"
                  aria-label="Remove image"
                  style={{ position: 'absolute', top: -6, right: -6 }}
                  onClick={() => remove(m.id)}
                >
                  ×
                </ActionIcon>
              )}
            </div>
          ))}
        </Group>
      )}
      {!props.disabled && (props.multiple || items.length === 0) && (
        <Dropzone
          onDrop={onDrop}
          onReject={(r) =>
            notifications.show({
              color: 'red',
              message: `${r.length} file(s) rejected: images only (jpeg, png, webp, avif, gif), max 10 MB`,
            })
          }
          accept={IMAGE_MIME_TYPE}
          maxSize={MAX_BYTES}
          multiple={props.multiple === true}
          loading={busy > 0}
        >
          <Group justify="center" gap="xs" mih={56} style={{ pointerEvents: 'none' }}>
            {busy > 0 ? <Loader size="xs" /> : null}
            <Text size="sm" c="dimmed">
              {busy > 0
                ? 'Uploading...'
                : props.multiple
                  ? 'Drop images here or click to choose'
                  : 'Drop an image here or click to choose'}
            </Text>
          </Group>
        </Dropzone>
      )}
    </Stack>
  );
}
