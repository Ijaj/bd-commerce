import { Select, type SelectProps } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { categoriesQuery } from './queries';

/** Category picker showing the tree as indented options (flat list is already in tree order). */
export function CategorySelect(
  props: Omit<SelectProps, 'data' | 'value' | 'onChange'> & {
    value: string | null | undefined;
    onChange: (id: string | null) => void;
  },
) {
  const { value, onChange, ...rest } = props;
  const { data } = useQuery(categoriesQuery);
  const { items, levels } = useMemo(() => {
    const levels = new Map<string, number>();
    const items = (data ?? []).map((c) => {
      levels.set(c.id, c.level);
      return { value: c.id, label: c.nameEn };
    });
    return { items, levels };
  }, [data]);

  return (
    <Select
      placeholder="All categories"
      clearable
      searchable
      nothingFoundMessage="No categories"
      {...rest}
      data={items}
      value={value ?? null}
      onChange={onChange}
      renderOption={({ option }) => (
        <span style={{ paddingLeft: ((levels.get(option.value) ?? 1) - 1) * 14 }}>
          {option.label}
        </span>
      )}
    />
  );
}
