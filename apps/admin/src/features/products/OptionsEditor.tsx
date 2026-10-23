import {
  ActionIcon,
  Button,
  ColorInput,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { SortableItem, SortableList } from './Sortable';
import { MAX_OPTIONS, newKey, type OptionDraft, type OptionValueDraft } from './variants';

interface Props {
  options: OptionDraft[];
  onChange: (options: OptionDraft[]) => void;
  disabled: boolean;
}

export const blankOption = (): OptionDraft => ({
  key: newKey(),
  nameEn: '',
  nameBn: '',
  values: [],
});
const blankValue = (): OptionValueDraft => ({
  key: newKey(),
  valueEn: '',
  valueBn: '',
  swatchHex: '',
});

/** Up to two option types (Q24), each with ordered values and an optional swatch colour. */
export function OptionsEditor({ options, onChange, disabled }: Props) {
  const patchOption = (key: string, patch: Partial<OptionDraft>) =>
    onChange(options.map((o) => (o.key === key ? { ...o, ...patch } : o)));
  const patchValue = (optKey: string, valKey: string, patch: Partial<OptionValueDraft>) =>
    onChange(
      options.map((o) =>
        o.key === optKey
          ? { ...o, values: o.values.map((v) => (v.key === valKey ? { ...v, ...patch } : v)) }
          : o,
      ),
    );

  return (
    <Stack gap="sm">
      {options.map((o, idx) => (
        <Paper key={o.key} withBorder p="sm">
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={600}>
              Option {idx + 1}
            </Text>
            {!disabled && (
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label={`Remove option ${idx + 1}`}
                onClick={() => onChange(options.filter((x) => x.key !== o.key))}
              >
                <IconTrash size={16} />
              </ActionIcon>
            )}
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2 }} mb="sm">
            <TextInput
              label="Name (English)"
              placeholder="e.g. Color"
              required
              maxLength={50}
              disabled={disabled}
              value={o.nameEn}
              onChange={(e) => patchOption(o.key, { nameEn: e.currentTarget.value })}
            />
            <TextInput
              label="Name (Bangla)"
              lang="bn"
              placeholder="e.g. রং"
              maxLength={50}
              disabled={disabled}
              value={o.nameBn}
              onChange={(e) => patchOption(o.key, { nameBn: e.currentTarget.value })}
            />
          </SimpleGrid>
          <Text size="xs" c="dimmed" mb={4}>
            Values (drag to reorder, swatch colour is optional)
          </Text>
          <SortableList
            items={o.values}
            getId={(v) => v.key}
            onReorder={(values) => patchOption(o.key, { values })}
          >
            <Stack gap={6}>
              {o.values.map((v, vi) => (
                <SortableItem key={v.key} id={v.key} disabled={disabled}>
                  {(handle) => (
                    <Group gap="xs" wrap="nowrap">
                      {handle}
                      <ColorInput
                        aria-label={`Swatch for value ${vi + 1}`}
                        placeholder="Swatch"
                        format="hex"
                        size="xs"
                        w={112}
                        disabled={disabled}
                        value={v.swatchHex}
                        onChange={(c) => patchValue(o.key, v.key, { swatchHex: c })}
                      />
                      <TextInput
                        aria-label={`Value ${vi + 1} (English)`}
                        placeholder="English"
                        size="xs"
                        style={{ flex: 1 }}
                        maxLength={100}
                        disabled={disabled}
                        value={v.valueEn}
                        onChange={(e) =>
                          patchValue(o.key, v.key, { valueEn: e.currentTarget.value })
                        }
                      />
                      <TextInput
                        aria-label={`Value ${vi + 1} (Bangla)`}
                        placeholder="বাংলা"
                        lang="bn"
                        size="xs"
                        style={{ flex: 1 }}
                        maxLength={100}
                        disabled={disabled}
                        value={v.valueBn}
                        onChange={(e) =>
                          patchValue(o.key, v.key, { valueBn: e.currentTarget.value })
                        }
                      />
                      {!disabled && (
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          aria-label={`Remove value ${vi + 1}`}
                          onClick={() =>
                            patchOption(o.key, { values: o.values.filter((x) => x.key !== v.key) })
                          }
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      )}
                    </Group>
                  )}
                </SortableItem>
              ))}
            </Stack>
          </SortableList>
          {!disabled && (
            <Button
              mt="xs"
              size="xs"
              variant="light"
              leftSection={<IconPlus size={14} />}
              onClick={() => patchOption(o.key, { values: [...o.values, blankValue()] })}
            >
              Add value
            </Button>
          )}
        </Paper>
      ))}
      {!disabled && options.length < MAX_OPTIONS && (
        <Button
          variant="default"
          size="xs"
          w="fit-content"
          leftSection={<IconPlus size={14} />}
          onClick={() => onChange([...options, blankOption()])}
        >
          Add option
        </Button>
      )}
    </Stack>
  );
}
