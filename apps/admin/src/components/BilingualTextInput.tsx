import { Input, SimpleGrid, Textarea, TextInput } from '@mantine/core';

export interface BilingualValue {
  en: string;
  bn: string;
}

export interface BilingualTextInputProps {
  label?: string;
  description?: string;
  /** English is the required language; Bangla is optional (the shop falls back to English). */
  value: BilingualValue;
  onChange: (value: BilingualValue) => void;
  required?: boolean;
  /** Use a Textarea instead of a single-line input. */
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
  /** One error for the whole field, or per language. */
  error?: string | { en?: string; bn?: string };
}

/**
 * English + Bangla inputs side by side.
 *   <BilingualTextInput label="Title" required value={{en: f.titleEn, bn: f.titleBn}}
 *     onChange={(v) => setFields({titleEn: v.en, titleBn: v.bn})} />
 */
export function BilingualTextInput({
  label,
  description,
  value,
  onChange,
  required,
  multiline,
  rows = 3,
  maxLength,
  disabled,
  error,
}: BilingualTextInputProps) {
  const errEn = typeof error === 'string' ? error : error?.en;
  const errBn = typeof error === 'object' ? error?.bn : undefined;
  const common = { disabled, maxLength } as const;

  return (
    <Input.Wrapper label={label} description={description} required={required}>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" mt={4}>
        {multiline ? (
          <Textarea
            {...common}
            rows={rows}
            autosize
            minRows={rows}
            placeholder="English"
            aria-label={label ? `${label} (English)` : 'English'}
            value={value.en}
            error={errEn}
            onChange={(e) => onChange({ ...value, en: e.currentTarget.value })}
          />
        ) : (
          <TextInput
            {...common}
            placeholder="English"
            aria-label={label ? `${label} (English)` : 'English'}
            value={value.en}
            error={errEn}
            onChange={(e) => onChange({ ...value, en: e.currentTarget.value })}
          />
        )}
        {multiline ? (
          <Textarea
            {...common}
            lang="bn"
            rows={rows}
            autosize
            minRows={rows}
            placeholder="বাংলা (optional)"
            aria-label={label ? `${label} (Bangla)` : 'Bangla'}
            value={value.bn}
            error={errBn}
            onChange={(e) => onChange({ ...value, bn: e.currentTarget.value })}
          />
        ) : (
          <TextInput
            {...common}
            lang="bn"
            placeholder="বাংলা (optional)"
            aria-label={label ? `${label} (Bangla)` : 'Bangla'}
            value={value.bn}
            error={errBn}
            onChange={(e) => onChange({ ...value, bn: e.currentTarget.value })}
          />
        )}
      </SimpleGrid>
    </Input.Wrapper>
  );
}
