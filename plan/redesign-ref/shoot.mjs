import { createRequire } from 'node:module';
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(new URL('../../e2e/package.json', import.meta.url));
const { chromium } = require('@playwright/test');

const BASE = 'http://localhost:3100';
const OUT = new URL('./current', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];
const WIDTHS = [
  { w: 390, h: 844, dsf: 2, mobile: true, touch: true },
  { w: 1280, h: 800, dsf: 1, mobile: false, touch: false },
];

async function gotoPage(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    console.log('  networkidle failed, falling back to load:', url, e.message.split('\n')[0]);
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  }
}

async function fullShot(page, name) {
  let y = 0;
  let h = await page.evaluate(() => document.body.scrollHeight);
  while (y < h) {
    y += 400;
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await sleep(150);
    h = await page.evaluate(() => document.body.scrollHeight);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(800);
  await page.screenshot({ path: join(OUT, name), fullPage: true });
  console.log('  saved', name, `(scroll height ${h})`);
}

async function shoot(page, key, width, url) {
  const name = `${key}-${width}.png`;
  try {
    console.log(`[${width}] ${key} ${url}`);
    await gotoPage(page, BASE + url);
    await fullShot(page, name);
  } catch (e) {
    const msg = e.message.split('\n')[0];
    failures.push(`${key}-${width}: ${msg}`);
    console.log('  FAIL', key, width, msg);
  }
}

async function addToCart(page, width) {
  try {
    const candidates = await page.getByRole('button', { name: /add to (cart|bag)/i }).all();
    let btn = null;
    for (const b of candidates) {
      if (await b.isVisible()) {
        btn = b;
        break;
      }
    }
    if (!btn) throw new Error('no visible add-to-cart button');
    if (await btn.isDisabled()) {
      console.log(`  [${width}] add-to-cart disabled, selecting variant options`);
      for (const sel of await page.locator('select').all()) {
        try {
          await sel.selectOption({ index: 1 });
        } catch {}
      }
      for (const radio of await page.locator('input[type="radio"]:not(:disabled)').all()) {
        try {
          if (!(await radio.isChecked())) await radio.check({ force: true });
        } catch {}
      }
      await sleep(500);
    }
    await btn.click({ timeout: 10000 });
    await sleep(1500);
    console.log(`  [${width}] added to cart`);
  } catch (e) {
    const msg = e.message.split('\n')[0];
    failures.push(`add-to-cart-${width}: ${msg}`);
    console.log('  FAIL add-to-cart', width, msg);
  }
}

async function discover(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await gotoPage(page, BASE + '/');
  await page
    .waitForSelector('a[href^="/c/"], a[href^="/p/"]', { timeout: 15000 })
    .catch(() => {});
  const info = await page.evaluate(() => {
    const cat = document.querySelector('a[href^="/c/"]')?.getAttribute('href') ?? null;
    const prod = document.querySelector('a[href^="/p/"]')?.getAttribute('href') ?? null;
    return { cat, prod };
  });
  // search query: pick a query that returns product links
  const slugWords = (info.prod ?? '')
    .replace('/p/', '')
    .split(/[-/?]/)
    .filter((w) => w.length >= 4);
  let search = null;
  for (const q of ['a', ...slugWords.slice(0, 2), 'e']) {
    await gotoPage(page, `${BASE}/search?q=${encodeURIComponent(q)}`);
    const n = await page.locator('a[href^="/p/"]').count();
    console.log(`  search q=${q}: ${n} product links`);
    if (n > 0) {
      search = q;
      break;
    }
  }
  await ctx.close();
  return { ...info, search: search ?? 'a' };
}

const browser = await chromium.launch({ headless: true });
console.log('API health:', await fetch('http://localhost:4000/health').then((r) => r.status).catch((e) => e.message));

const info = await discover(browser);
console.log('URLs:', info);

for (const cfg of WIDTHS) {
  const W = cfg.w;
  const ctx = await browser.newContext({
    viewport: { width: cfg.w, height: cfg.h },
    deviceScaleFactor: cfg.dsf,
    isMobile: cfg.mobile,
    hasTouch: cfg.touch,
  });
  const page = await ctx.newPage();

  await shoot(page, 'home', W, '/');
  if (info.cat) await shoot(page, 'category', W, info.cat);
  else failures.push(`category-${W}: no /c/ link on home`);
  if (info.prod) {
    await shoot(page, 'product', W, info.prod);
    await addToCart(page, W);
  } else failures.push(`product-${W}: no /p/ link on home`);
  await shoot(page, 'cart', W, '/cart');
  await shoot(page, 'checkout', W, '/checkout');
  await shoot(page, 'search', W, `/search?q=${encodeURIComponent(info.search)}`);
  await shoot(page, 'offers', W, '/offers');
  await shoot(page, 'track', W, '/track');
  await shoot(page, 'login', W, '/login');
  await shoot(page, 'signup', W, '/signup');
  await shoot(page, '404', W, '/this-page-does-not-exist');

  await ctx.close();
}

await browser.close();

console.log('\nFailures:', failures.length ? failures : 'none');
console.log('\nOutput:');
for (const f of readdirSync(OUT).sort()) {
  console.log(`  ${f}  ${statSync(join(OUT, f)).size} bytes`);
}
