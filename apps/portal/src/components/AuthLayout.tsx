import type { ReactNode } from 'react';
import { t } from '~/i18n';
import { LangToggle } from './LangToggle';

/** Mockup `.sr-login`: gradient page, centred card with the italic wordmark. */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="sr-login">
      <div className="sr-login-card sr-form">
        <LangToggle />
        <div className="sr-brand">
          Shop<b>Name</b>
          <small>{t('appName').replace(/^ShopName\s*/, '') || t('appName')}</small>
        </div>
        <h1 className="sr-auth-title">{title}</h1>
        {subtitle && <p className="a-hint sr-auth-sub">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
