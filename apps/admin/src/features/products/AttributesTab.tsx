import {
  Alert,
  Loader,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { type AttrValue, type AttrValues, missingRequired } from './attributes';
import type { CategoryAttribute } from './types';

interface Props {
  attributes: CategoryAttribute[];
  loading: boolean;
  values: AttrValues;
  onChange: (values: AttrValues) => void;
  disabled: boolean;
}

function AttributeInput({
  attr,
  value,
  onChange,
  disabled,
}: {
  attr: CategoryAttribute;
  value: AttrValue | undefined;
  onChange: (v: AttrValue) => void;
  disabled: boolean;
}) {
  const common = { label: attr.nameEn, required: attr.isRequired, disabled } as const;
  const options = attr.options.map((o) => ({ value: o.id, label: o.valueEn }));
  switch (attr.type) {
    case 'text':
      return (
        <TextInput
          {...common}
          value={value?.text ?? ''}
          onChange={(e) => onChange({ text: e.currentTarget.value })}
        />
      );
    case 'number':
      return (
        <NumberInput
          {...common}
          rightSection={attr.unit ? <Text size="xs">{attr.unit}</Text> : undefined}
          rightSectionWidth={attr.unit ? 44 : undefined}
          value={value?.number ?? ''}
          onChange={(v) => onChange({ number: typeof v === 'number' ? v : null })}
        />
      );
    case 'select':
      return (
        <Select
          {...common}
          clearable={!attr.isRequired}
          searchable
          data={options}
          value={value?.optionIds?.[0] ?? null}
          onChange={(v) => onChange({ optionIds: v ? [v] : [] })}
        />
      );
    case 'multiselect':
      return (
        <MultiSelect
          {...common}
          searchable
          data={options}
          value={value?.optionIds ?? []}
          onChange={(v) => onChange({ optionIds: v })}
        />
      );
    case 'boolean':
      return (
        <Select
          {...common}
          clearable
          data={[
            { value: 'true', label: 'Yes' },
            { value: 'false', label: 'No' },
          ]}
          value={value?.bool === undefined || value.bool === null ? null : String(value.bool)}
          onChange={(v) => onChange({ bool: v === null ? null : v === 'true' })}
        />
      );
  }
}

export function AttributesTab({ attributes, loading, values, onChange, disabled }: Props) {
  if (loading) return <Loader size="sm" aria-label="Loading attributes" />;
  if (!attributes.length) {
    return (
      <Text c="dimmed" size="sm">
        The selected categories define no attributes.
      </Text>
    );
  }
  const missing = missingRequired(attributes, values);
  return (
    <Stack gap="md" maw={560}>
      <Text size="sm" c="dimmed">
        Inherited from the selected categories and their parents.
      </Text>
      {missing.length > 0 && (
        <Alert color="yellow" variant="light">
          Required before publishing: {missing.map((a) => a.nameEn).join(', ')}
        </Alert>
      )}
      {attributes.map((a) => (
        <AttributeInput
          key={a.id}
          attr={a}
          disabled={disabled}
          value={values[a.id]}
          onChange={(v) => onChange({ ...values, [a.id]: v })}
        />
      ))}
    </Stack>
  );
}
