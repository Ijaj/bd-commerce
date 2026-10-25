import { Icon } from '@bdc/ui';
import { useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { Outlet, useNavigate } from '@tanstack/react-router';
import { api } from '~/api';
import { LangToggle } from '~/components/LangToggle';
import { t } from '~/i18n';

/** Mockup `.sr-shell`: sticky gradient top bar, padded main area; the tab bar is fixed to the bottom. */
export function PortalFrame() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme('light');

  async function logout() {
    await api.POST('/v1/admin/auth/logout').catch(() => undefined);
    qc.clear();
    void navigate({ to: '/login', search: {} });
  }

  return (
    <div className="sr-shell">
      <header className="sr-top">
        <div className="sr-brand">
          Shop<b>Name</b> <small>Partner</small>
        </div>
        <div className="sr-who">
          <LangToggle dark />
          <button
            type="button"
            className="a-btn sm icon sr-who-btn"
            aria-label={t('darkMode')}
            onClick={() => setColorScheme(scheme === 'dark' ? 'light' : 'dark')}
          >
            <Icon name={scheme === 'dark' ? 'sun' : 'moon'} size={16} />
          </button>
          <button
            type="button"
            className="a-btn sm icon sr-who-btn"
            aria-label={t('signOut')}
            onClick={() => void logout()}
          >
            <Icon name="logout" size={16} />
          </button>
        </div>
      </header>
      <main className="sr-main">
        <Outlet />
      </main>
    </div>
  );
}
