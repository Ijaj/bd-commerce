import { CloseButton, Group, Loader, Select, Text } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { categoryOptions } from '~/features/products/categoryTree';
import {
  brandsQuery,
  categoriesQuery,
  productDetailQuery,
  productListQuery,
} from '~/features/products/queries';
import { customerLookupQuery } from './queries';

/** Search products by title/SKU; picking one calls onPick and clears the box for the next one. */
export function ProductSelect({
  onPick,
  label,
  placeholder = 'Search products by title or SKU',
  disabled,
}: {
  onPick: (p: { id: string; title: string }) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [q] = useDebouncedValue(search.trim(), 250);
  const list = useQuery({
    ...productListQuery({
      page: 1,
      pageSize: 15,
      q,
      sort: 'title',
      order: 'asc',
    }),
    enabled: q.length >= 2,
  });
  const items = list.data?.items ?? [];
  return (
    <Select
      label={label}
      placeholder={placeholder}
      searchable
      disabled={disabled}
      value={null}
      searchValue={search}
      onSearchChange={setSearch}
      data={items.map((p) => ({ value: p.id, label: p.titleEn }))}
      filter={({ options }) => options}
      nothingFoundMessage={q.length < 2 ? 'Type at least 2 letters' : 'No products found'}
      rightSection={list.isFetching ? <Loader size="xs" /> : undefined}
      onChange={(id) => {
        const p = items.find((x) => x.id === id);
        if (p) onPick({ id: p.id, title: p.titleEn });
        setSearch('');
      }}
    />
  );
}

/** Product title for an id (cached detail query); the id's head while it loads. */
export function ProductName({ id }: { id: string }) {
  const q = useQuery(productDetailQuery(id));
  return <Text span>{q.data?.titleEn ?? `${id.slice(0, 8)}...`}</Text>;
}

export function ProductIdList({
  ids,
  onRemove,
  disabled,
}: {
  ids: string[];
  onRemove: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <>
      {ids.map((id) => (
        <Group key={id} gap="xs" wrap="nowrap">
          <Text size="sm">
            <ProductName id={id} />
          </Text>
          {!disabled && (
            <CloseButton size="xs" aria-label="Remove product" onClick={() => onRemove(id)} />
          )}
        </Group>
      ))}
    </>
  );
}

/** Options for a category Select (indented tree order). */
export function useCategoryOptions() {
  const q = useQuery(categoriesQuery);
  return { options: categoryOptions(q.data), loading: q.isLoading };
}

export function useBrandOptions() {
  const q = useQuery(brandsQuery);
  return {
    options: (q.data ?? []).map((b) => ({ value: b.id, label: b.nameEn })),
    loading: q.isLoading,
  };
}

/** Search customers by name/phone/email (2+ characters). */
export function CustomerSelect({
  onPick,
  label = 'Add customer',
  disabled,
}: {
  onPick: (c: { id: string; name: string; phone: string | null; email: string | null }) => void;
  label?: string;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [q] = useDebouncedValue(search.trim(), 300);
  const res = useQuery({ ...customerLookupQuery(q), enabled: q.length >= 2 });
  const items = res.data?.items ?? [];
  return (
    <Select
      label={label}
      placeholder="Name, phone or email"
      searchable
      disabled={disabled}
      value={null}
      searchValue={search}
      onSearchChange={setSearch}
      data={items.map((c) => ({
        value: c.id,
        label: `${c.name}${c.phone ? ` - ${c.phone}` : ''}`,
      }))}
      filter={({ options }) => options}
      nothingFoundMessage={q.length < 2 ? 'Type at least 2 characters' : 'No customers found'}
      rightSection={res.isFetching ? <Loader size="xs" /> : undefined}
      onChange={(id) => {
        const c = items.find((x) => x.id === id);
        if (c) onPick(c);
        setSearch('');
      }}
    />
  );
}
