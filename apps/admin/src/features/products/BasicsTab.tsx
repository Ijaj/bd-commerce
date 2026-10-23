import { Input, MultiSelect, SegmentedControl, Select, Stack, TextInput } from '@mantine/core';
import { BilingualTextInput } from '~/components/BilingualTextInput';
import type { SelectOption } from './categoryTree';
import type { FormTabProps } from './tabProps';

interface Props extends FormTabProps {
  categories: SelectOption[];
  brands: SelectOption[];
  slugPlaceholder?: string;
}

export function BasicsTab({ form, set, disabled, categories, brands }: Props) {
  return (
    <Stack gap="md">
      <BilingualTextInput
        label="Title"
        required
        disabled={disabled}
        value={{ en: form.titleEn, bn: form.titleBn }}
        onChange={(v) => set({ titleEn: v.en, titleBn: v.bn })}
        maxLength={250}
      />
      <BilingualTextInput
        label="Short description"
        multiline
        rows={2}
        disabled={disabled}
        value={{ en: form.shortEn, bn: form.shortBn }}
        onChange={(v) => set({ shortEn: v.en, shortBn: v.bn })}
        maxLength={1000}
      />
      <TextInput
        label="Slug"
        description="Used in the product URL. Leave empty to generate it from the title."
        disabled={disabled}
        value={form.slug}
        onChange={(e) => set({ slug: e.currentTarget.value })}
        maxLength={120}
      />
      <Select
        label="Brand"
        placeholder="No brand"
        clearable
        searchable
        disabled={disabled}
        data={brands}
        value={form.brandId}
        onChange={(v) => set({ brandId: v })}
      />
      <Select
        label="Primary category"
        required
        searchable
        disabled={disabled}
        placeholder="Choose a category"
        data={categories}
        value={form.primaryCategoryId}
        onChange={(v) =>
          set({
            primaryCategoryId: v,
            extraCategoryIds: form.extraCategoryIds.filter((id) => id !== v),
          })
        }
      />
      <MultiSelect
        label="Additional categories"
        description="The product also appears in these."
        searchable
        clearable
        disabled={disabled}
        data={categories.filter((c) => c.value !== form.primaryCategoryId)}
        value={form.extraCategoryIds}
        onChange={(v) => set({ extraCategoryIds: v })}
      />
      <Input.Wrapper label="Fulfillment">
        <div>
          <SegmentedControl
            mt={4}
            disabled={disabled}
            data={[
              { value: 'stock', label: 'From stock' },
              { value: 'dropship', label: 'Dropship' },
            ]}
            value={form.fulfillment}
            onChange={(v) => set({ fulfillment: v as 'stock' | 'dropship' })}
          />
        </div>
      </Input.Wrapper>
    </Stack>
  );
}
