import { Stack, Tabs, TextInput } from '@mantine/core';
import { HtmlEditor } from '~/components/HtmlEditor';
import type { FormTabProps } from './tabProps';

export function DescriptionTab({ form, set, disabled }: FormTabProps) {
  return (
    <Stack gap="md">
      <Tabs defaultValue="en" variant="pills">
        <Tabs.List mb="sm">
          <Tabs.Tab value="en">English</Tabs.Tab>
          <Tabs.Tab value="bn">বাংলা</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="en">
          <HtmlEditor
            label="Description (English)"
            disabled={disabled}
            value={form.descEn}
            onChange={(html) => set({ descEn: html })}
            minHeight={260}
          />
        </Tabs.Panel>
        <Tabs.Panel value="bn">
          <HtmlEditor
            label="Description (Bangla)"
            disabled={disabled}
            value={form.descBn}
            onChange={(html) => set({ descBn: html })}
            minHeight={260}
          />
        </Tabs.Panel>
      </Tabs>
      <TextInput
        label="YouTube URL"
        description="Optional product video (watch, youtu.be or shorts link)."
        placeholder="https://www.youtube.com/watch?v=..."
        disabled={disabled}
        value={form.youtubeUrl}
        onChange={(e) => set({ youtubeUrl: e.currentTarget.value })}
      />
    </Stack>
  );
}
