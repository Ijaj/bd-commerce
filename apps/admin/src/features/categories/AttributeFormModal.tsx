import { Alert, Button, Group, Modal, Select, Stack, Switch, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { BilingualTextInput } from '~/components/BilingualTextInput';
import { categoriesApi } from './api';
import { conflictBody } from './http';
import { notifyError, notifyOk, useInvalidateCategories } from './queries';
import {
  ATTRIBUTE_TYPES,
  type Attribute,
  type AttributeInput,
  type AttributeType,
  type AttributeUsageBody,
  hasOptions,
} from './types';

export const ATTRIBUTE_KEY_RE = /^[a-z][a-z0-9_]*$/;

interface Values {
  key: string;
  nameEn: string;
  nameBn: string;
  type: AttributeType;
  unit: string;
  isFilterable: boolean;
  isRequired: boolean;
}

/** Create (attribute = null) or edit one own attribute. The key can only be set on create. */
export function AttributeFormModal({
  categoryId,
  attribute,
  opened,
  nextSort,
  onClose,
}: {
  categoryId: string;
  attribute: Attribute | null;
  opened: boolean;
  nextSort: number;
  onClose: () => void;
}) {
  const invalidate = useInvalidateCategories();
  const [typeConflict, setTypeConflict] = useState<AttributeUsageBody | null>(null);
  const editing = !!attribute;

  const form = useForm<Values>({
    mode: 'controlled',
    initialValues: {
      key: attribute?.key ?? '',
      nameEn: attribute?.nameEn ?? '',
      nameBn: attribute?.nameBn ?? '',
      type: attribute?.type ?? 'text',
      unit: attribute?.unit ?? '',
      isFilterable: attribute?.isFilterable ?? false,
      isRequired: attribute?.isRequired ?? false,
    },
    validate: {
      nameEn: (v) => (v.trim() ? null : 'Name is required'),
      key: (v) =>
        editing
          ? null
          : ATTRIBUTE_KEY_RE.test(v.trim())
            ? null
            : 'snake_case: start with a letter, then lowercase letters, digits, underscores',
    },
  });

  const save = useMutation({
    mutationFn: async ({ force }: { force: boolean }) => {
      const v = form.values;
      const body = {
        nameEn: v.nameEn.trim(),
        nameBn: v.nameBn.trim() || null,
        type: v.type,
        unit: v.unit.trim() || null,
        isFilterable: v.isFilterable,
        isRequired: v.isRequired,
      };
      if (attribute)
        return categoriesApi.updateAttribute(attribute.id, body satisfies AttributeInput, force);
      return categoriesApi.createAttribute(categoryId, {
        ...body,
        key: v.key.trim(),
        sort: nextSort,
      });
    },
    onSuccess: () => {
      notifyOk(editing ? 'Attribute saved' : 'Attribute added');
      invalidate();
      setTypeConflict(null);
      onClose();
    },
    onError: (e) => {
      const c = conflictBody<AttributeUsageBody>(e);
      if (c && typeof c.valueCount === 'number') setTypeConflict(c);
      else notifyError(e, 'Could not save the attribute');
    },
  });

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title={editing ? `Edit attribute: ${attribute?.nameEn}` : 'Add attribute'}
        centered
        size="lg"
      >
        <form onSubmit={form.onSubmit(() => save.mutate({ force: false }))}>
          <Stack>
            <TextInput
              label="Key"
              description={
                editing
                  ? 'Fixed after creation (imports and product values refer to it).'
                  : 'snake_case, e.g. screen_size. Cannot be changed later.'
              }
              required
              disabled={editing}
              {...form.getInputProps('key')}
            />
            <BilingualTextInput
              label="Name"
              required
              value={{ en: form.values.nameEn, bn: form.values.nameBn }}
              onChange={(v) => {
                form.setFieldValue('nameEn', v.en);
                form.setFieldValue('nameBn', v.bn);
              }}
              error={form.errors.nameEn as string | undefined}
              maxLength={100}
            />
            <Group grow align="flex-start">
              <Select
                label="Type"
                data={ATTRIBUTE_TYPES}
                allowDeselect={false}
                {...form.getInputProps('type')}
              />
              <TextInput
                label="Unit"
                description="Optional, e.g. cm, GB"
                maxLength={20}
                {...form.getInputProps('unit')}
              />
            </Group>
            {hasOptions(form.values.type) && (
              <Text size="xs" c="dimmed">
                {editing
                  ? 'Edit the choices in the Options section of the attribute.'
                  : 'Save the attribute first, then add its options.'}
              </Text>
            )}
            <Group>
              <Switch
                label="Filterable in the shop"
                {...form.getInputProps('isFilterable', { type: 'checkbox' })}
              />
              <Switch
                label="Required on products"
                {...form.getInputProps('isRequired', { type: 'checkbox' })}
              />
            </Group>
            <Group justify="flex-end">
              <Button variant="default" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" loading={save.isPending && !typeConflict}>
                {editing ? 'Save' : 'Add attribute'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={!!typeConflict}
        onClose={() => setTypeConflict(null)}
        title="Changing the type drops values"
        centered
      >
        <Stack>
          <Alert color="yellow" variant="light">
            {typeConflict?.valueCount} stored value{typeConflict?.valueCount === 1 ? '' : 's'} on{' '}
            {typeConflict?.productCount} product{typeConflict?.productCount === 1 ? '' : 's'} would
            be deleted (and the options, if the new type has none).
          </Alert>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setTypeConflict(null)}>
              Keep current type
            </Button>
            <Button
              color="red"
              loading={save.isPending}
              onClick={() => save.mutate({ force: true })}
            >
              Change type anyway
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
