import { Icon } from '@bdc/ui';
import { Menu } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { api } from '~/api';
import { useCallQueueCount } from '~/features/orders/queries';
import { meQuery } from '~/lib/auth';
import { isActive, visibleNav } from '~/lib/nav';
import { ChangePasswordModal } from './ChangePasswordModal';
import { ThemeSwitch } from './ThemeSwitch';

const SITE_URL: string = import.meta.env.VITE_SITE_URL ?? 'http://localhost:3100';

function initials(name: string | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** Admin shell (plan/mockups/admin/shared/admin-core.js): 54px gradient top bar + 236px dark sidebar. */
export function AppLayout() {
  const { data: me } = useQuery(meQuery);
  const [sideOpen, setSideOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nav = visibleNav(me?.permissions ?? []);
  const callQueueCount = useCallQueueCount();

  async function logout() {
    await api.POST('/v1/admin/auth/logout').catch(() => undefined);
    qc.clear();
    void navigate({ to: '/login', search: {} });
  }

  return (
    <div className={sideOpen ? 'a-shell a-side-open' : 'a-shell'}>
      <aside className="a-side" aria-label="Main navigation">
        <nav>
          {nav.map((section) => (
            <div key={section.heading} className="a-nav-g">
              <div className="a-nav-h">{section.heading}</div>
              {section.items.map((item) => {
                const active = isActive(item.to, pathname);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={active ? 'a-nav-i active' : 'a-nav-i'}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setSideOpen(false)}
                  >
                    <Icon name={item.icon} size={17} />
                    <span className="a-sp">{item.label}</span>
                    {item.to === '/call-queue' && callQueueCount ? (
                      <span className="a-nav-n">{callQueueCount}</span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="a-side-f">ShopName admin</div>
      </aside>
      <button
        type="button"
        className="a-scrim-m"
        aria-label="Close navigation"
        tabIndex={-1}
        onClick={() => setSideOpen(false)}
      />

      <div className="a-main">
        <header className="a-top">
          <button
            type="button"
            className="a-btn ghost icon a-hb"
            aria-label="Toggle navigation"
            aria-expanded={sideOpen}
            onClick={() => setSideOpen((o) => !o)}
          >
            <Icon name="menu" />
          </button>
          <Link to="/" className="a-logo">
            <span className="wm">
              Shop<b>Name</b>
            </span>
            <em>Admin</em>
          </Link>
          <GlobalSearch canSearchProducts={me?.permissions.includes('products.view') ?? false} />
          <div className="a-top-r">
            <a
              className="a-btn ghost sm a-store"
              href={SITE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="store" />
              <span>View store</span>
            </a>
            <Notifications callQueueCount={callQueueCount} />
            <ThemeSwitch />
            <Menu position="bottom-end" width={220} withinPortal>
              <Menu.Target>
                <button type="button" className="a-btn ghost a-usr" aria-label="Account menu">
                  <span className="a-avatar sm">{initials(me?.name)}</span>
                  <span className="a-usr-n">
                    {me?.name ?? 'Account'}
                    <small>{me?.email}</small>
                  </span>
                </button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<Icon name="key" size={16} />}
                  onClick={() => setPwOpen(true)}
                >
                  Change password
                </Menu.Item>
                <Menu.Item leftSection={<Icon name="logout" size={16} />} onClick={logout}>
                  Log out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </div>
        </header>
        <main className="a-page">
          <Outlet />
        </main>
      </div>

      <ChangePasswordModal opened={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}

/** No global search API yet: Enter searches products (the one list with a text filter in the URL). */
function GlobalSearch({ canSearchProducts }: { canSearchProducts: boolean }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [focused, setFocused] = useState(false);
  return (
    <div className="a-gsearch">
      <span className="a-gs-i">
        <Icon name="search" />
      </span>
      <input
        type="search"
        placeholder="Search products…"
        autoComplete="off"
        aria-label="Global search"
        value={q}
        onChange={(e) => setQ(e.currentTarget.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') e.currentTarget.blur();
          if (e.key === 'Enter' && q.trim() && canSearchProducts) {
            void navigate({ to: '/catalog/products', search: { q: q.trim() } });
            e.currentTarget.blur();
          }
        }}
      />
      {focused && q.trim() && (
        <div className="a-gs-res">
          <div className="a-gs-none">
            {canSearchProducts
              ? `Press Enter to search products for “${q.trim()}”`
              : 'Search needs the products permission'}
          </div>
        </div>
      )}
    </div>
  );
}

/** Bell: the only live source today is the call queue. */
function Notifications({ callQueueCount }: { callQueueCount: number | undefined }) {
  const navigate = useNavigate();
  return (
    <Menu position="bottom-end" width={340} withinPortal>
      <Menu.Target>
        <button type="button" className="a-btn ghost icon" aria-label="Notifications">
          <Icon name="bell" />
          {callQueueCount ? <i className="a-dot-n">{callQueueCount}</i> : null}
        </button>
      </Menu.Target>
      <Menu.Dropdown>
        <div className="a-dd-h">Notifications</div>
        {callQueueCount ? (
          <Menu.Item
            leftSection={<Icon name="phone" size={16} />}
            onClick={() => void navigate({ to: '/call-queue' })}
          >
            {callQueueCount} order{callQueueCount === 1 ? '' : 's'} waiting in the call queue
          </Menu.Item>
        ) : (
          <div className="a-gs-none">No notifications</div>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
