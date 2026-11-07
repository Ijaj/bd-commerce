'use client';
import { useState } from 'react';
import { dict, type Lang } from '~/i18n';
import s from './affiliate.module.css';
import { Dashboard } from './Dashboard';
import { DetailsTab } from './DetailsTab';
import { JoinCard } from './JoinCard';
import { LinksTab } from './LinksTab';
import { PayoutsTab } from './PayoutsTab';
import type { AffiliateMe, TabId } from './types';

const TABS: TabId[] = ['dash', 'links', 'pay', 'details'];

/** /account/affiliate body: join card until joined, then the four tabs from the portal mockup. */
export function AffiliateView({ lang, initial }: { lang: Lang; initial: AffiliateMe }) {
  const t = dict(lang).affiliate;
  const [me, setMe] = useState(initial);
  const [tab, setTab] = useState<TabId>('dash');

  if (!me.joined) return <JoinCard lang={lang} info={me} onJoined={setMe} />;

  return (
    <div className={s.wrap}>
      {me.status === 'suspended' ? (
        <p className={`${s.note} ${s.noteWarn}`} role="alert">
          {t.suspended}
        </p>
      ) : me.programEnabled === false ? (
        <p className={`${s.note} ${s.noteWarn}`}>{t.programOff}</p>
      ) : null}
      <div className={s.tabs} role="tablist" aria-label={t.tabsLabel}>
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`af-tab-${id}`}
            aria-selected={tab === id}
            aria-controls="af-panel"
            className={s.tab}
            onClick={() => setTab(id)}
          >
            {t.tabs[id]}
          </button>
        ))}
      </div>
      <div id="af-panel" role="tabpanel" aria-labelledby={`af-tab-${tab}`}>
        {tab === 'dash' ? <Dashboard lang={lang} me={me} /> : null}
        {tab === 'links' ? <LinksTab lang={lang} me={me} /> : null}
        {tab === 'pay' ? <PayoutsTab lang={lang} me={me} /> : null}
        {tab === 'details' ? <DetailsTab lang={lang} me={me} onChange={setMe} /> : null}
      </div>
    </div>
  );
}
