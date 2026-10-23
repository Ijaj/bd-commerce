import {
  Fieldset,
  NumberInput,
  SimpleGrid,
  Stack,
  Switch,
  Textarea,
  TextInput,
} from '@mantine/core';

/** Subset of JSON Schema produced by zod for the settings registry. */
export interface JsonSchema {
  type?: string | string[];
  format?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  anyOf?: JsonSchema[];
  minimum?: number;
  maximum?: number;
  maxLength?: number;
  description?: string;
  title?: string;
}

export function prettify(key: string): string {
  const spaced = key.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function nullableInner(schema: JsonSchema): JsonSchema | null {
  if (!schema.anyOf) return null;
  const rest = schema.anyOf.filter((s) => s.type !== 'null');
  return rest.length === 1 && rest.length < schema.anyOf.length ? (rest[0] ?? null) : null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO string -> value for <input type="datetime-local"> (local time). */
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

interface Props {
  schema: JsonSchema;
  value: unknown;
  onChange: (value: unknown) => void;
  label?: string;
  disabled?: boolean;
}

/**
 * Renders a form for a JSON Schema value: boolean switch, number input, text, date-time,
 * nullable fields and nested objects (en/bn objects show side by side).
 */
export function SchemaForm({ schema, value, onChange, label, disabled }: Props) {
  const inner = nullableInner(schema);
  const nullable = inner !== null;
  const s = inner ?? schema;
  const type = Array.isArray(s.type) ? s.type[0] : s.type;

  if (type === 'boolean') {
    return (
      <Switch
        label={label}
        checked={value === true}
        disabled={disabled}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
    );
  }

  if (type === 'integer' || type === 'number') {
    return (
      <NumberInput
        label={label}
        value={typeof value === 'number' ? value : ''}
        min={s.minimum}
        max={s.maximum}
        allowDecimal={type === 'number'}
        disabled={disabled}
        onChange={(v) => onChange(v === '' ? (nullable ? null : 0) : Number(v))}
      />
    );
  }

  if (type === 'string' && s.format === 'date-time') {
    return (
      <TextInput
        type="datetime-local"
        label={label}
        value={isoToLocalInput(typeof value === 'string' ? value : null)}
        disabled={disabled}
        onChange={(e) => onChange(localInputToIso(e.currentTarget.value))}
      />
    );
  }

  if (type === 'string') {
    const Input = (s.maxLength ?? 0) > 200 ? Textarea : TextInput;
    return (
      <Input
        label={label}
        value={typeof value === 'string' ? value : ''}
        maxLength={s.maxLength}
        disabled={disabled}
        onChange={(e) => {
          const text = e.currentTarget.value;
          onChange(nullable && text === '' ? null : text);
        }}
      />
    );
  }

  if (type === 'object' && s.properties) {
    const obj = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
    const entries = Object.entries(s.properties);
    const isLocalized = entries.length === 2 && 'en' in s.properties && 'bn' in s.properties;
    const fields = entries.map(([key, sub]) => (
      <SchemaForm
        key={key}
        schema={sub}
        label={isLocalized ? (key === 'en' ? 'English' : 'Bangla') : prettify(key)}
        value={obj[key]}
        disabled={disabled}
        onChange={(v) => onChange({ ...obj, [key]: v })}
      />
    ));
    const body = isLocalized ? (
      <SimpleGrid cols={{ base: 1, sm: 2 }}>{fields}</SimpleGrid>
    ) : (
      <Stack gap="sm">{fields}</Stack>
    );
    return label ? (
      <Fieldset legend={label} p="sm">
        {body}
      </Fieldset>
    ) : (
      body
    );
  }

  return (
    <Textarea
      label={label}
      description="Unsupported type, edit as JSON"
      value={JSON.stringify(value)}
      onChange={(e) => {
        try {
          onChange(JSON.parse(e.currentTarget.value));
        } catch {
          /* keep typing */
        }
      }}
    />
  );
}
