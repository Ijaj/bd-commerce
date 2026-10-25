import { setLang, t, useLang } from '~/i18n';

/** EN | বাংলা switch (C39), the mockup's `.sr-lang`. `dark` styles it for the gradient top bar. */
export function LangToggle({ dark = false }: { dark?: boolean }) {
  const lang = useLang();
  const btn = (value: 'en' | 'bn', label: string) => (
    <button key={value} type="button" aria-pressed={lang === value} onClick={() => setLang(value)}>
      {label}
    </button>
  );
  return (
    // biome-ignore lint/a11y/useSemanticElements: segmented button group, a fieldset would add a border and legend
    <div className={dark ? 'sr-lang dark' : 'sr-lang'} role="group" aria-label={t('language')}>
      {btn('en', t('langEn'))}
      {btn('bn', t('langBn'))}
    </div>
  );
}
