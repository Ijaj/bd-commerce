import { Icon } from '@bdc/ui';
import type { ReactNode } from 'react';
import { ThemeSwitch } from '~/features/shell/ThemeSwitch';
import classes from './AuthLayout.module.css';

/** Login / 2FA split screen (plan/mockups/admin/login.html): brand panel left, form card right. */
export function AuthLayout({
  title,
  subtitle,
  children,
  width = 380,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  width?: number;
}) {
  return (
    <div className={classes.wrap}>
      <section className={classes.art}>
        <div className={classes.wm}>
          Shop<b>Name</b>
        </div>
        <div>
          <h2>Run the shop. Ship the orders.</h2>
          <p>
            Staff-only admin panel. All sign-ins are logged and protected by two-factor
            authentication.
          </p>
          <ul>
            <li>
              <Icon name="lock" />
              Authenticator-app 2FA on every account
            </li>
            <li>
              <Icon name="device" />
              New-device login alerts
            </li>
          </ul>
        </div>
        <div className={classes.foot}>ShopName admin</div>
      </section>
      <section className={classes.form}>
        <ThemeSwitch className={classes.top} />
        <div className={classes.card} style={{ maxWidth: width }}>
          <div className={`${classes.wm} ${classes.mobileWm}`}>
            Shop<b>Name</b>
          </div>
          <h1>{title}</h1>
          {subtitle && <p className={classes.sub}>{subtitle}</p>}
          {children}
        </div>
      </section>
    </div>
  );
}
