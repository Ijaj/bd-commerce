import { Button, Group, Loader, MultiSelect, Pill, Stack, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { brandsQuery } from '~/features/brands/queries';
import { categoriesListQuery } from '~/features/categories/queries';
import { productSearchQuery } from './queries';

export interface ScopeValue {
  productIds: string[];
  categoryIds: string[];
  brandIds: string[];
}

/** Products come from a search box (too many to list); categories and brands are short lists. */
export function ScopePicker({
  value,
  onChange,
}: {
  value: ScopeValue;
  onChange: (v: ScopeValue) => void;
}) {
  const categories = useQuery(categoriesListQuery);
  const brands = useQuery(brandsQuery);
  const [search, setSearch] = useState('');
  const [q] = useDebouncedValue(search.trim(), 300);
  const found = useQuery(productSearchQuery(q));
  // The API only returns ids, so remember the titles of products picked in this session.
  const [titles, setTitles] = useState<Record<string, string>>({});

  const categoryOptions = useMemo(
    () =>
      (categories.data ?? []).map((c) => ({
        value: c.id,
        label: `${'  '.repeat(Math.max(0, c.level - 1))}${c.nameEn}`,
      })),
    [categories.data],
  );
  const brandOptions = useMemo(
    () => (brands.data ?? []).map((b) => ({ value: b.id, label: b.nameEn })),
    [brands.data],
  );

  return (
    <Stack gap="sm">
      <div>
        <TextInput
          label="Products"
          placeholder="Search by title (2+ letters)"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          rightSection={found.isFetching ? <Loader size="xs" /> : null}
        />
        {found.data?.items.map((p) => {
          const picked = value.productIds.includes(p.id);
          return (
            <Group key={p.id} justify="space-between" py={4}>
              <Text size="sm">{p.titleEn}</Text>
              <Button
                size="compact-xs"
                variant={picked ? 'filled' : 'light'}
                aria-label={`${picked ? 'Remove' : 'Add'} ${p.titleEn}`}
                onClick={() => {
                  setTitles((t) => ({ ...t, [p.id]: p.titleEn }));
                  onChange({
                    ...value,
                    productIds: picked
                      ? value.productIds.filter((x) => x !== p.id)
                      : [...value.productIds, p.id],
                  });
                }}
              >
                {picked ? 'Added' : 'Add'}
              </Button>
            </Group>
          );
        })}
        {value.productIds.length > 0 && (
          <Pill.Group mt="xs">
            {value.productIds.map((id) => (
              <Pill
                key={id}
                withRemoveButton
                onRemove={() =>
                  onChange({ ...value, productIds: value.productIds.filter((x) => x !== id) })
                }
              >
                {titles[id] ?? 'Product'}
              </Pill>
            ))}
          </Pill.Group>
        )}
      </div>
      <MultiSelect
        label="Categories"
        description="Includes sub-categories."
        placeholder="Pick categories"
        searchable
        clearable
        data={categoryOptions}
        value={value.categoryIds}
        onChange={(v) => onChange({ ...value, categoryIds: v })}
      />
      <MultiSelect
        label="Brands"
        placeholder="Pick brands"
        searchable
        clearable
        data={brandOptions}
        value={value.brandIds}
        onChange={(v) => onChange({ ...value, brandIds: v })}
      />
    </Stack>
  );
}
