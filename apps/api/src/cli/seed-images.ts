import sharp from 'sharp';
import { ObjectStorage } from '../media/object-storage';
import { uuidv7 } from '../media/uuid';
import type { PrismaService } from '../prisma/prisma.service';

// Dev-only: downloads real photos from public keyless APIs (DummyJSON product photos, Wikimedia
// Commons search) and attaches them to products, categories and carousel slides, so the storefront
// is not blank. Every run first removes the previous `media/seed/` images, then refills.

type Src = { dj?: string; wiki?: string };
type Pic = { url: string; alt: string };

const UA = 'bd-commerce-dev-seed/1.0';
const FALLBACK: Src = { dj: 'groceries' };
const BY_CATEGORY: Record<string, Src> = {
  smartphones: { dj: 'smartphones' },
  phones: { dj: 'smartphones' },
  electronics: { dj: 'laptops' },
  appliances: { wiki: 'electric kettle' },
  'kitchen-appliances': { wiki: 'blender kitchen' },
  'rice-cookers': { wiki: 'rice cooker' },
  'solar-power': { wiki: 'solar panel roof' },
  'solar-panels': { wiki: 'solar panel roof' },
  panels: { wiki: 'solar panel roof' },
  'solar-inverters': { wiki: 'solar inverter' },
  inverters: { wiki: 'solar inverter' },
  fashion: { dj: 'mens-shirts' },
  men: { dj: 'mens-shirts' },
  panjabi: { wiki: 'kurta' },
  women: { dj: 'womens-dresses' },
  saree: { wiki: 'saree' },
  'baby-kids': { wiki: 'baby toys' },
  diapers: { wiki: 'diaper baby' },
};
const SLIDES: { title: string; link: string; wiki: string }[] = [
  { title: 'New arrivals', link: '/search', wiki: 'shopping bazaar market' },
  { title: 'Go solar: panels and inverters', link: '/search', wiki: 'solar panels on house roof' },
  { title: 'Festive fashion', link: '/search', wiki: 'saree' },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cache = new Map<string, Pic[]>();

async function djPics(slug: string): Promise<Pic[]> {
  const res = await fetch(
    `https://dummyjson.com/products/category/${slug}?limit=30&select=title,images`,
  );
  if (!res.ok) return [];
  const body = (await res.json()) as { products: { title: string; images: string[] }[] };
  return body.products.flatMap((p) => p.images.slice(0, 3).map((url) => ({ url, alt: p.title })));
}

async function wikiPics(query: string): Promise<Pic[]> {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  const params = {
    action: 'query',
    generator: 'search',
    gsrnamespace: '6',
    gsrlimit: '12',
    gsrsearch: `${query} filetype:bitmap`,
    prop: 'imageinfo',
    iiprop: 'url|mime|size',
    iiurlwidth: '1000',
    format: 'json',
  };
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) return [];
  const body = (await res.json()) as {
    query?: {
      pages: Record<
        string,
        {
          title: string;
          imageinfo: { mime: string; width: number; thumburl?: string; url: string }[];
        }
      >;
    };
  };
  return Object.values(body.query?.pages ?? {}).flatMap((p) => {
    const info = p.imageinfo[0];
    if (!info || !/^image\/(jpeg|png)$/.test(info.mime) || info.width < 600) return [];
    return [
      { url: info.thumburl ?? info.url, alt: p.title.replace(/^File:/, '').replace(/\.\w+$/, '') },
    ];
  });
}

async function pool(src: Src): Promise<Pic[]> {
  const key = JSON.stringify(src);
  const hit = cache.get(key);
  if (hit) return hit;
  let pics: Pic[] = [];
  try {
    if (src.dj) pics = await djPics(src.dj);
    else if (src.wiki) pics = await wikiPics(src.wiki);
  } catch {
    pics = [];
  }
  if (pics.length === 0 && src !== FALLBACK) pics = await pool(FALLBACK);
  cache.set(key, pics);
  return pics;
}

export async function seedImages(prisma: PrismaService, storage: ObjectStorage) {
  const stats = { removed: 0, downloaded: 0, products: 0, categories: 0, slides: 0, failed: 0 };

  // 1. remove earlier seeded images (generated placeholders or previous downloads)
  const old = await prisma.media.findMany({
    where: { storageKey: { startsWith: 'media/seed/' } },
    select: { id: true, storageKey: true },
  });
  const oldIds = old.map((m) => m.id);
  if (oldIds.length) {
    await prisma.productImage.deleteMany({ where: { mediaId: { in: oldIds } } });
    await prisma.carouselSlide.deleteMany({
      where: {
        OR: [{ imageDesktopMediaId: { in: oldIds } }, { imageMobileMediaId: { in: oldIds } }],
      },
    });
    await prisma.category.updateMany({
      where: { imageMediaId: { in: oldIds } },
      data: { imageMediaId: null },
    });
    await prisma.category.updateMany({
      where: { iconMediaId: { in: oldIds } },
      data: { iconMediaId: null },
    });
    await prisma.category.updateMany({
      where: { bannerMediaId: { in: oldIds } },
      data: { bannerMediaId: null },
    });
    await prisma.brand.updateMany({
      where: { logoMediaId: { in: oldIds } },
      data: { logoMediaId: null },
    });
    await prisma.media.deleteMany({ where: { id: { in: oldIds } } });
    for (const m of old) await storage.delete(m.storageKey).catch(() => undefined);
    stats.removed = old.length;
  }

  // 2. download, re-encode to JPEG (max 1600 px), upload, record
  const store = async (pic: Pic): Promise<string | null> => {
    try {
      const res = await fetch(pic.url, { headers: { 'user-agent': UA } });
      if (!res.ok) throw new Error(String(res.status));
      const raw = Buffer.from(await res.arrayBuffer());
      const { data, info } = await sharp(raw, { limitInputPixels: 40_000_000 })
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 85 })
        .toBuffer({ resolveWithObject: true });
      const key = `media/seed/${uuidv7()}.jpg`;
      await storage.put(key, data, 'image/jpeg');
      const media = await prisma.media.create({
        data: {
          storageKey: key,
          mime: 'image/jpeg',
          width: info.width,
          height: info.height,
          bytes: data.length,
          alt: pic.alt,
        },
      });
      stats.downloaded++;
      return media.id;
    } catch {
      stats.failed++;
      return null;
    }
  };

  // 3. products: category source, rotate through the pool so neighbours differ
  const products = await prisma.product.findMany({
    where: { images: { none: {} } },
    select: { id: true, titleEn: true, primaryCategory: { select: { slug: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const cursor = new Map<string, number>();
  for (const p of products) {
    const slug = p.primaryCategory.slug;
    const pics = await pool(BY_CATEGORY[slug] ?? FALLBACK);
    if (!pics.length) continue;
    const start = cursor.get(slug) ?? 0;
    cursor.set(slug, start + 2);
    let sort = 0;
    for (let i = 0; i < 2; i++) {
      const pic = pics[(start + i) % pics.length];
      const mediaId = pic ? await store(pic) : null;
      if (mediaId) {
        await prisma.productImage.create({
          data: { productId: p.id, mediaId, sort: sort++, alt: p.titleEn },
        });
      }
    }
    if (sort) stats.products++;
    await sleep(150);
  }

  // 4. categories: tile + banner
  const cats = await prisma.category.findMany({
    where: { imageMediaId: null },
    select: { id: true, slug: true },
  });
  for (const c of cats) {
    const pics = await pool(BY_CATEGORY[c.slug] ?? FALLBACK);
    if (!pics.length) continue;
    const first = pics[0];
    const second = pics[Math.min(1, pics.length - 1)];
    if (!first || !second) continue;
    const imageMediaId = await store(first);
    const bannerMediaId = await store(second);
    await prisma.category.update({ where: { id: c.id }, data: { imageMediaId, bannerMediaId } });
    stats.categories++;
    await sleep(150);
  }

  // 5. carousel (only when empty): wide photos
  if ((await prisma.carouselSlide.count()) === 0) {
    for (const [i, s] of SLIDES.entries()) {
      const wide = (await pool({ wiki: s.wiki })).slice(0, 4);
      const lead = wide[0];
      const imageDesktopMediaId = lead ? await store(lead) : null;
      if (!imageDesktopMediaId) continue;
      await prisma.carouselSlide.create({
        data: { title: s.title, imageDesktopMediaId, linkUrl: s.link, sort: i },
      });
      stats.slides++;
    }
  }
  return stats;
}
