import { Button, Group } from '@mantine/core';
import { setLang, t, useLang } from '~/i18n';

/** EN | বাংলা switch (C39). `dark` styles it for the navy top bar. */
export function LangToggle({ dark = false }: { dark?: boolean }) {
  const lang = useLang();
  const btn = (value: 'en' | 'bn', label: string) => (
    <Button
      key={value}
      size="compact-sm"
      variant={lang === value ? 'filled' : 'subtle'}
      color={dark ? 'gray' : 'indigo'}
      aria-pressed={lang === value}
      onClick={() => setLang(value)}
    >
      {label}
    </Button>
  );
  return (
    <Group gap={2} wrap="nowrap" role="group" aria-label={t('language')}>
      {btn('en', t('langEn'))}
      {btn('bn', t('langBn'))}
    </Group>
  );
}
