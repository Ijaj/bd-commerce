import { Badge, CloseButton, Group, Select, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import { Section, type SectionProps } from './fields';
import type { TargetRef } from './form';
import { ProductSelect, useBrandOptions, useCategoryOptions } from './pickers';

type TargetType = TargetRef['targetType'];
type Mode = TargetRef['mode'];

const TYPE_NOUN: Record<TargetType, string> = {
  product: 'Product',
  category: 'Category',
  brand: 'Brand',
};

export function ScopeSection({ v, set, disabled, issues }: SectionProps) {
  const [mode, setMode] = useState<Mode>('include');
  const [kind, setKind] = useState<TargetType>('product');
  const cats = useCategoryOptions();
  const brands = useBrandOptions();

  const add = (t: Omit<TargetRef, 'mode'>) => {
    if (v.targets.some((x) => x.targetType === t.targetType && x.targetId === t.targetId)) return;
    set({ targets: [...v.targets, { ...t, mode }] });
  };
  const remove = (t: TargetRef) =>
    set({
      targets: v.targets.filter(
        (x) => !(x.targetType === t.targetType && x.targetId === t.targetId),
      ),
    });

  const labelOf = (opts: { value: string; label: string }[], id: string) =>
    opts.find((o) => o.value === id)?.label.replace(/^[\s↳]+/, '') ?? null;

  const groups: { mode: Mode; title: string; items: TargetRef[] }[] = [
    { mode: 'include', title: 'Only these', items: v.targets.filter((t) => t.mode === 'include') },
    {
      mode: 'exclude',
      title: 'Except these',
      items: v.targets.filter((t) => t.mode === 'exclude'),
    },
  ];

  return (
    <Section title="Scope" issues={issues}>
      <Text size="sm" c="dimmed">
        Which products the discount applies to. With no "only" entries, every product qualifies. A
        category covers its sub-categories.
      </Text>
      <Group align="flex-end" grow>
        <Select
          label="Rule"
          allowDeselect={false}
          disabled={disabled}
          data={[
            { value: 'include', label: 'Only these' },
            { value: 'exclude', label: 'Except these' },
          ]}
          value={mode}
          onChange={(m) => setMode((m ?? 'include') as Mode)}
        />
        <Select
          label="Type"
          allowDeselect={false}
          disabled={disabled}
          data={(Object.keys(TYPE_NOUN) as TargetType[]).map((k) => ({
            value: k,
            label: TYPE_NOUN[k],
          }))}
          value={kind}
          onChange={(k) => setKind((k ?? 'product') as TargetType)}
        />
        {kind === 'product' && (
          <ProductSelect
            label="Product"
            disabled={disabled}
            onPick={(p) => add({ targetType: 'product', targetId: p.id, label: p.title })}
          />
        )}
        {kind === 'category' && (
          <Select
            label="Category"
            placeholder="Pick a category"
            searchable
            disabled={disabled}
            value={null}
            data={cats.options}
            onChange={(id) =>
              id && add({ targetType: 'category', targetId: id, label: labelOf(cats.options, id) })
            }
          />
        )}
        {kind === 'brand' && (
          <Select
            label="Brand"
            placeholder="Pick a brand"
            searchable
            disabled={disabled}
            value={null}
            data={brands.options}
            onChange={(id) =>
              id && add({ targetType: 'brand', targetId: id, label: labelOf(brands.options, id) })
            }
          />
        )}
      </Group>
      {groups.map(
        (g) =>
          g.items.length > 0 && (
            <Stack key={g.mode} gap={4}>
              <Text size="sm">{g.title}</Text>
              <Group gap="xs">
                {g.items.map((t) => (
                  <Badge
                    key={`${t.targetType}:${t.targetId}`}
                    variant="light"
                    color={g.mode === 'include' ? 'blue' : 'red'}
                    size="lg"
                    tt="none"
                    rightSection={
                      disabled ? undefined : (
                        <CloseButton
                          size="xs"
                          aria-label={`Remove ${t.label ?? t.targetType}`}
                          onClick={() => remove(t)}
                        />
                      )
                    }
                  >
                    {TYPE_NOUN[t.targetType]}: {t.label ?? 'deleted item'}
                  </Badge>
                ))}
              </Group>
            </Stack>
          ),
      )}
    </Section>
  );
}
