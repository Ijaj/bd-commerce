import type { Metadata, Viewport } from 'next';
import { Hind_Siliguri, Poppins } from 'next/font/google';
import type { ReactNode } from 'react';
import { AnnouncementBar } from '~/components/shell/AnnouncementBar';
import { BottomNav } from '~/components/shell/BottomNav';
import { Footer } from '~/components/shell/Footer';
import { Header } from '~/components/shell/Header';
import { Maintenance } from '~/components/shell/Maintenance';
import { UtilityBar } from '~/components/shell/UtilityBar';
import { ServiceWorkerRegister } from '~/features/account/ServiceWorkerRegister';
import { dict } from '~/i18n';
import { getSite } from '~/lib/api';
import { SITE_URL } from '~/lib/env';
import { type LangProps, routeParams } from '~/lib/lang';
import '~/styles/tokens.css';
import '~/styles/base.css';

// Fonts per brand D. Q113: regular weight, 700 only for h1, current breadcrumb and logo. Font choice may change later (owner).
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-poppins',
  display: 'swap',
});
const hind = Hind_Siliguri({
  subsets: ['bengali', 'latin'],
  weight: ['400', '700'],
  variable: '--font-hind',
  display: 'swap',
});

export const dynamicParams = false;
// Safety net: if the API was down at build time (getSite fails open), static pages still refresh.
export const revalidate = 60;
export function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'bn' }];
}

export async function generateMetadata({ params }: LangProps): Promise<Metadata> {
  const { lang } = await routeParams(params);
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: 'ShopName', template: '%s | ShopName' },
    description: dict(lang).footer.about,
    applicationName: 'ShopName',
    manifest: '/manifest.webmanifest',
    icons: { icon: '/icons/icon.svg', apple: '/icons/apple-touch-icon.png' },
    openGraph: { siteName: 'ShopName', locale: lang === 'bn' ? 'bn_BD' : 'en_BD', type: 'website' },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#312e81' },
    { media: '(prefers-color-scheme: dark)', color: '#1e1b4b' },
  ],
};

/**
 * Runs in <head> before first paint: theme = bdc_theme cookie, else the system preference.
 * Done client-side on purpose: reading cookies() in the layout would make every page dynamic
 * and kill ISR caching of catalog pages.
 */
const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )bdc_theme=(light|dark)/);var t=m?m[1]:(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t}catch(e){}})()`;

export default async function RootLayout({
  children,
  params,
}: LangProps & { children: ReactNode }) {
  const { lang } = await routeParams(params);
  const site = await getSite();
  const d = dict(lang);

  return (
    <html lang={lang} className={`${poppins.variable} ${hind.variable}`} suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static constant, no user input */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {site?.maintenance.enabled ? (
          <Maintenance lang={lang} site={site} />
        ) : (
          <>
            <a className="skip" href="#main">
              {d.skip}
            </a>
            <AnnouncementBar lang={lang} site={site} />
            <UtilityBar lang={lang} hotline={site?.contact?.hotline} />
            <Header lang={lang} />
            <main id="main">{children}</main>
            <Footer lang={lang} contact={site?.contact} />
            <BottomNav lang={lang} />
            <ServiceWorkerRegister />
          </>
        )}
      </body>
    </html>
  );
}
