import type { Prisma, PrismaClient } from '../generated/prisma/client';

type Tx = Prisma.TransactionClient;
type ValueDef = { en: string; bn?: string; deltaTk?: number };
type OptionDef = { nameEn: string; nameBn?: string; values: ValueDef[] };
type AttrDef = {
  category: string;
  key: string;
  nameEn: string;
  nameBn?: string;
  type: 'number' | 'select' | 'multiselect';
  unit?: string;
  options?: { en: string; bn?: string }[];
};
type ProductDef = {
  code: string;
  slug: string;
  titleEn: string;
  titleBn?: string;
  brand?: string;
  category: string;
  extraCategories?: string[];
  status?: 'active' | 'draft';
  upcoming?: boolean;
  preorderDate?: string;
  priceTk: number;
  compareAtTk?: number;
  costTk?: number;
  options?: OptionDef[];
  attrs?: Record<string, string | number | string[]>;
};

const SEED = 20261023;
const PUBLISHED_AT = new Date('2026-10-01T00:00:00Z');

const CATEGORIES: {
  slug: string;
  nameEn: string;
  nameBn: string;
  parent?: string;
  chip?: string;
}[] = [
  { slug: 'electronics', nameEn: 'Electronics', nameBn: 'ইলেকট্রনিক্স', chip: '#2563eb' },
  { slug: 'phones', nameEn: 'Phones', nameBn: 'ফোন', parent: 'electronics' },
  { slug: 'smartphones', nameEn: 'Smartphones', nameBn: 'স্মার্টফোন', parent: 'phones' },
  { slug: 'appliances', nameEn: 'Appliances', nameBn: 'যন্ত্রপাতি', parent: 'electronics' },
  {
    slug: 'kitchen-appliances',
    nameEn: 'Kitchen Appliances',
    nameBn: 'রান্নাঘরের যন্ত্রপাতি',
    parent: 'appliances',
  },
  { slug: 'rice-cookers', nameEn: 'Rice Cookers', nameBn: 'রাইস কুকার', parent: 'kitchen-appliances' },
  { slug: 'solar-power', nameEn: 'Solar Power', nameBn: 'সোলার', parent: 'electronics' },
  { slug: 'solar-panels', nameEn: 'Panels', nameBn: 'সোলার প্যানেল', parent: 'solar-power' },
  { slug: 'solar-inverters', nameEn: 'Inverters', nameBn: 'ইনভার্টার', parent: 'solar-power' },
  { slug: 'fashion', nameEn: 'Fashion', nameBn: 'ফ্যাশন', chip: '#db2777' },
  { slug: 'men', nameEn: 'Men', nameBn: 'পুরুষ', parent: 'fashion' },
  { slug: 'panjabi', nameEn: 'Panjabi', nameBn: 'পাঞ্জাবি', parent: 'men' },
  { slug: 'women', nameEn: 'Women', nameBn: 'মহিলা', parent: 'fashion' },
  { slug: 'saree', nameEn: 'Saree', nameBn: 'শাড়ি', parent: 'women' },
  { slug: 'baby-kids', nameEn: 'Baby & Kids', nameBn: 'শিশু', chip: '#16a34a' },
  { slug: 'diapers', nameEn: 'Diapers', nameBn: 'ডায়াপার', parent: 'baby-kids' },
];

const BRANDS: { slug: string; nameEn: string; nameBn?: string }[] = [
  { slug: 'walton', nameEn: 'Walton', nameBn: 'ওয়ালটন' },
  { slug: 'samsung', nameEn: 'Samsung' },
  { slug: 'xiaomi', nameEn: 'Xiaomi' },
  { slug: 'vision', nameEn: 'Vision', nameBn: 'ভিশন' },
  { slug: 'aarong', nameEn: 'Aarong', nameBn: 'আড়ং' },
  { slug: 'yellow', nameEn: 'Yellow' },
  { slug: 'pampers', nameEn: 'Pampers' },
  { slug: 'jamuna', nameEn: 'Jamuna', nameBn: 'যমুনা' },
];

const ATTRIBUTES: AttrDef[] = [
  {
    category: 'smartphones',
    key: 'ram',
    nameEn: 'RAM',
    type: 'select',
    options: [{ en: '4 GB' }, { en: '6 GB' }, { en: '8 GB' }, { en: '12 GB' }],
  },
  {
    category: 'smartphones',
    key: 'storage',
    nameEn: 'Storage',
    nameBn: 'স্টোরেজ',
    type: 'select',
    options: [{ en: '64 GB' }, { en: '128 GB' }, { en: '256 GB' }],
  },
  {
    category: 'smartphones',
    key: 'network',
    nameEn: 'Network',
    nameBn: 'নেটওয়ার্ক',
    type: 'multiselect',
    options: [{ en: '4G' }, { en: '5G' }],
  },
  {
    category: 'electronics',
    key: 'warranty_months',
    nameEn: 'Warranty',
    nameBn: 'ওয়ারেন্টি',
    type: 'number',
    unit: 'months',
  },
  {
    category: 'panjabi',
    key: 'fabric',
    nameEn: 'Fabric',
    nameBn: 'কাপড়',
    type: 'select',
    options: [
      { en: 'Cotton', bn: 'সুতি' },
      { en: 'Silk', bn: 'সিল্ক' },
      { en: 'Linen', bn: 'লিনেন' },
    ],
  },
  {
    category: 'rice-cookers',
    key: 'capacity_l',
    nameEn: 'Capacity',
    nameBn: 'ধারণক্ষমতা',
    type: 'number',
    unit: 'L',
  },
];

const sizes = (): ValueDef[] => [{ en: 'M' }, { en: 'L' }, { en: 'XL' }];
const colors = (...names: ValueDef[]): OptionDef => ({
  nameEn: 'Color',
  nameBn: 'রঙ',
  values: names,
});
const sizeOption = (): OptionDef => ({ nameEn: 'Size', nameBn: 'সাইজ', values: sizes() });

const PRODUCTS: ProductDef[] = [
  // Smartphones
  {
    code: 'SAM-A15',
    slug: 'demo-samsung-galaxy-a15',
    titleEn: 'Samsung Galaxy A15',
    titleBn: 'স্যামসাং গ্যালাক্সি এ১৫',
    brand: 'samsung',
    category: 'smartphones',
    priceTk: 18999,
    compareAtTk: 21999,
    costTk: 16200,
    options: [
      colors(
        { en: 'Black', bn: 'কালো' },
        { en: 'Blue', bn: 'নীল' },
        { en: 'Light Green', bn: 'হালকা সবুজ' },
      ),
    ],
    attrs: { ram: '6 GB', storage: '128 GB', network: ['4G'], warranty_months: 12 },
  },
  {
    code: 'XIA-RN13',
    slug: 'demo-xiaomi-redmi-note-13',
    titleEn: 'Xiaomi Redmi Note 13',
    titleBn: 'শাওমি রেডমি নোট ১৩',
    brand: 'xiaomi',
    category: 'smartphones',
    priceTk: 22999,
    compareAtTk: 24999,
    costTk: 19800,
    options: [
      colors({ en: 'Midnight Black', bn: 'মধ্যরাতের কালো' }, { en: 'Ocean Blue', bn: 'সমুদ্র নীল' }),
    ],
    attrs: { ram: '8 GB', storage: '256 GB', network: ['5G'], warranty_months: 12 },
  },
  {
    code: 'WAL-N8',
    slug: 'demo-walton-primo-n8',
    titleEn: 'Walton Primo N8',
    titleBn: 'ওয়ালটন প্রাইমো এন৮',
    brand: 'walton',
    category: 'smartphones',
    priceTk: 9999,
    costTk: 8100,
    attrs: { ram: '4 GB', storage: '64 GB', network: ['4G'], warranty_months: 12 },
  },
  {
    code: 'SAM-S26',
    slug: 'demo-samsung-galaxy-s26',
    titleEn: 'Samsung Galaxy S26',
    brand: 'samsung',
    category: 'smartphones',
    upcoming: true,
    priceTk: 129999,
    attrs: { ram: '12 GB', storage: '256 GB', network: ['5G'], warranty_months: 12 },
  },
  {
    code: 'XIA-14TP',
    slug: 'demo-xiaomi-14t-pro',
    titleEn: 'Xiaomi 14T Pro',
    brand: 'xiaomi',
    category: 'smartphones',
    upcoming: true,
    priceTk: 74999,
    compareAtTk: 79999,
    attrs: { ram: '12 GB', storage: '256 GB', network: ['5G'], warranty_months: 12 },
  },
  {
    code: 'WAL-Z2',
    slug: 'demo-walton-primo-z2',
    titleEn: 'Walton Primo Z2',
    titleBn: 'ওয়ালটন প্রাইমো জেড২',
    brand: 'walton',
    category: 'smartphones',
    status: 'draft',
    priceTk: 12499,
    attrs: { ram: '6 GB', storage: '128 GB', network: ['4G'], warranty_months: 12 },
  },
  {
    code: 'WAL-X1',
    slug: 'demo-walton-primo-x1',
    titleEn: 'Walton Primo X1',
    titleBn: 'ওয়ালটন প্রাইমো এক্স১',
    brand: 'walton',
    category: 'smartphones',
    preorderDate: '2026-12-15',
    priceTk: 15999,
    attrs: { ram: '8 GB', storage: '128 GB', network: ['5G'], warranty_months: 12 },
  },
  // Rice cookers
  {
    code: 'WAL-RC-18',
    slug: 'demo-walton-rice-cooker-1-8l',
    titleEn: 'Walton 1.8L Rice Cooker',
    titleBn: 'ওয়ালটন ১.৮ লিটার রাইস কুকার',
    brand: 'walton',
    category: 'rice-cookers',
    priceTk: 3450,
    compareAtTk: 3990,
    costTk: 2600,
    attrs: { capacity_l: 1.8, warranty_months: 24 },
  },
  {
    code: 'VIS-RC-10',
    slug: 'demo-vision-rice-cooker-1l',
    titleEn: 'Vision 1.0L Rice Cooker',
    titleBn: 'ভিশন ১.০ লিটার রাইস কুকার',
    brand: 'vision',
    category: 'rice-cookers',
    priceTk: 2150,
    attrs: { capacity_l: 1, warranty_months: 12 },
  },
  {
    code: 'WAL-RC-28',
    slug: 'demo-walton-rice-cooker-2-8l',
    titleEn: 'Walton 2.8L Rice Cooker',
    titleBn: 'ওয়ালটন ২.৮ লিটার রাইস কুকার',
    brand: 'walton',
    category: 'rice-cookers',
    priceTk: 5490,
    costTk: 4100,
    options: [colors({ en: 'Silver', bn: 'রূপালি' }, { en: 'Black', bn: 'কালো' })],
    attrs: { capacity_l: 2.8, warranty_months: 24 },
  },
  {
    code: 'JAM-RC-22',
    slug: 'demo-jamuna-rice-cooker-2-2l',
    titleEn: 'Jamuna 2.2L Rice Cooker',
    titleBn: 'যমুনা ২.২ লিটার রাইস কুকার',
    brand: 'jamuna',
    category: 'rice-cookers',
    status: 'draft',
    priceTk: 4290,
    attrs: { capacity_l: 2.2, warranty_months: 12 },
  },
  // Kitchen and appliances
  {
    code: 'WAL-BLD-400',
    slug: 'demo-walton-blender-400w',
    titleEn: 'Walton Blender 400W',
    titleBn: 'ওয়ালটন ব্লেন্ডার ৪০০W',
    brand: 'walton',
    category: 'kitchen-appliances',
    extraCategories: ['appliances'],
    priceTk: 2290,
    compareAtTk: 2690,
    costTk: 1700,
    attrs: { warranty_months: 12 },
  },
  {
    code: 'WAL-IRN',
    slug: 'demo-walton-dry-iron',
    titleEn: 'Walton Dry Iron',
    titleBn: 'ওয়ালটন ড্রাই আয়রন',
    brand: 'walton',
    category: 'appliances',
    priceTk: 1190,
    compareAtTk: 1490,
    attrs: { warranty_months: 12 },
  },
  // Electronics
  {
    code: 'WAL-TV-43',
    slug: 'demo-walton-smart-led-tv-43',
    titleEn: 'Walton 43 inch Smart LED TV',
    titleBn: 'ওয়ালটন ৪৩ ইঞ্চি স্মার্ট এলইডি টিভি',
    brand: 'walton',
    category: 'electronics',
    priceTk: 32990,
    compareAtTk: 36990,
    costTk: 27500,
    attrs: { warranty_months: 24 },
  },
  {
    code: 'VIS-LED-9W',
    slug: 'demo-vision-led-bulb-9w',
    titleEn: 'Vision LED Bulb 9W',
    brand: 'vision',
    category: 'electronics',
    priceTk: 180,
    costTk: 90,
    attrs: { warranty_months: 6 },
  },
  // Solar
  {
    code: 'VIS-SP-330',
    slug: 'demo-vision-solar-panel-330w',
    titleEn: 'Vision Solar Panel 330W',
    titleBn: 'ভিশন সোলার প্যানেল ৩৩০W',
    brand: 'vision',
    category: 'solar-panels',
    priceTk: 14500,
    costTk: 11000,
    attrs: { warranty_months: 60 },
  },
  {
    code: 'VIS-SP-450',
    slug: 'demo-vision-solar-panel-450w',
    titleEn: 'Vision Solar Panel 450W',
    brand: 'vision',
    category: 'solar-panels',
    priceTk: 17900,
    costTk: 14000,
    attrs: { warranty_months: 60 },
  },
  {
    code: 'WAL-SP-550',
    slug: 'demo-walton-mono-solar-panel-550w',
    titleEn: 'Walton Mono Solar Panel 550W',
    brand: 'walton',
    category: 'solar-panels',
    priceTk: 22000,
    costTk: 17000,
    attrs: { warranty_months: 60 },
  },
  {
    code: 'VIS-INV-1K',
    slug: 'demo-vision-hybrid-inverter-1kva',
    titleEn: 'Vision Hybrid Inverter 1 kVA',
    titleBn: 'ভিশন হাইব্রিড ইনভার্টার ১ kVA',
    brand: 'vision',
    category: 'solar-inverters',
    priceTk: 18500,
    options: [
      {
        nameEn: 'Battery',
        nameBn: 'ব্যাটারি',
        values: [
          { en: 'No battery', bn: 'ব্যাটারি ছাড়া' },
          { en: '100Ah battery', bn: '১০০Ah ব্যাটারিসহ', deltaTk: 14000 },
        ],
      },
    ],
    attrs: { warranty_months: 24 },
  },
  {
    code: 'WAL-INV-2K',
    slug: 'demo-walton-pure-sine-inverter-2kva',
    titleEn: 'Walton Pure Sine Inverter 2 kVA',
    titleBn: 'ওয়ালটন পিওর সাইন ইনভার্টার ২ kVA',
    brand: 'walton',
    category: 'solar-inverters',
    priceTk: 38500,
    costTk: 31000,
    attrs: { warranty_months: 24 },
  },
  // Men / Panjabi
  {
    code: 'AAR-PJ-CLS',
    slug: 'demo-aarong-classic-panjabi',
    titleEn: 'Aarong Classic Panjabi',
    titleBn: 'আড়ং ক্লাসিক পাঞ্জাবি',
    brand: 'aarong',
    category: 'panjabi',
    priceTk: 2800,
    compareAtTk: 3200,
    costTk: 1600,
    options: [
      colors(
        { en: 'White', bn: 'সাদা' },
        { en: 'Sky Blue', bn: 'আকাশী' },
        { en: 'Maroon', bn: 'মেরুন' },
      ),
      sizeOption(),
    ],
    attrs: { fabric: 'Cotton' },
  },
  {
    code: 'YEL-PJ-LIN',
    slug: 'demo-yellow-linen-panjabi',
    titleEn: 'Yellow Linen Panjabi',
    titleBn: 'ইয়েলো লিনেন পাঞ্জাবি',
    brand: 'yellow',
    category: 'panjabi',
    priceTk: 3490,
    costTk: 2100,
    options: [colors({ en: 'Olive', bn: 'জলপাই' }, { en: 'Navy', bn: 'নেভি' }), sizeOption()],
    attrs: { fabric: 'Linen' },
  },
  {
    code: 'AAR-PJ-SLK',
    slug: 'demo-aarong-silk-panjabi',
    titleEn: 'Aarong Silk Panjabi',
    titleBn: 'আড়ং সিল্ক পাঞ্জাবি',
    brand: 'aarong',
    category: 'panjabi',
    priceTk: 6990,
    compareAtTk: 7990,
    costTk: 4800,
    options: [sizeOption()],
    attrs: { fabric: 'Silk' },
  },
  {
    code: 'YEL-PJ-PRM',
    slug: 'demo-yellow-premium-panjabi',
    titleEn: 'Yellow Premium Cotton Panjabi',
    brand: 'yellow',
    category: 'panjabi',
    status: 'draft',
    priceTk: 2490,
    options: [sizeOption()],
    attrs: { fabric: 'Cotton' },
  },
  // Women / Saree
  {
    code: 'AAR-SR-JAM',
    slug: 'demo-aarong-jamdani-saree',
    titleEn: 'Aarong Jamdani Saree',
    titleBn: 'আড়ং জামদানি শাড়ি',
    brand: 'aarong',
    category: 'saree',
    priceTk: 8500,
    compareAtTk: 9900,
    costTk: 6000,
    options: [colors({ en: 'Red', bn: 'লাল' }, { en: 'Green', bn: 'সবুজ' })],
  },
  {
    code: 'AAR-SR-CTN',
    slug: 'demo-aarong-handloom-cotton-saree',
    titleEn: 'Aarong Handloom Cotton Saree',
    titleBn: 'আড়ং হ্যান্ডলুম সুতি শাড়ি',
    brand: 'aarong',
    category: 'saree',
    priceTk: 2490,
    costTk: 1500,
    options: [
      colors({ en: 'Cream', bn: 'ক্রিম' }, { en: 'Navy', bn: 'নেভি' }, { en: 'Pink', bn: 'গোলাপি' }),
    ],
  },
  {
    code: 'AAR-SR-KTN',
    slug: 'demo-aarong-katan-silk-saree',
    titleEn: 'Aarong Katan Silk Saree',
    titleBn: 'আড়ং কাতান সিল্ক শাড়ি',
    brand: 'aarong',
    category: 'saree',
    priceTk: 12990,
    costTk: 9000,
  },
  // Baby & kids
  {
    code: 'PAM-BDRY',
    slug: 'demo-pampers-baby-dry-diapers',
    titleEn: 'Pampers Baby-Dry Diapers',
    titleBn: 'প্যাম্পার্স বেবি-ড্রাই ডায়াপার',
    brand: 'pampers',
    category: 'diapers',
    priceTk: 1450,
    compareAtTk: 1690,
    costTk: 1000,
    options: [
      {
        nameEn: 'Size',
        nameBn: 'সাইজ',
        values: [
          { en: 'Small', bn: 'ছোট' },
          { en: 'Medium', bn: 'মাঝারি' },
          { en: 'Large', bn: 'বড়' },
        ],
      },
    ],
  },
  {
    code: 'PAM-PNT-MEGA',
    slug: 'demo-pampers-pants-mega-pack',
    titleEn: 'Pampers Pants Mega Pack',
    brand: 'pampers',
    category: 'diapers',
    priceTk: 2890,
    costTk: 2100,
  },
  {
    code: 'PAM-WIP-72',
    slug: 'demo-pampers-baby-wipes-72',
    titleEn: 'Pampers Baby Wipes 72 pcs',
    brand: 'pampers',
    category: 'baby-kids',
    priceTk: 650,
    costTk: 430,
  },
];

// Sanity check: every category and option label used above must exist.
const SLUGS = new Set(CATEGORIES.map((c) => c.slug));
for (const p of PRODUCTS) {
  if (!SLUGS.has(p.category) || (p.extraCategories ?? []).some((s) => !SLUGS.has(s))) {
    throw new Error(`demo catalog: unknown category on ${p.slug}`);
  }
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const tk = (amount: number) => Math.round(amount * 100);
const abbr = (label: string) =>
  label
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 3);

export type DemoCatalogSummary = {
  categories: number;
  brands: number;
  products: number;
  variants: number;
};

/** Dev-only demo catalog. Idempotent: skips when any product with a `demo-` slug exists. */
export async function seedDemoCatalog(prisma: PrismaClient): Promise<DemoCatalogSummary | null> {
  const existing = await prisma.product.findFirst({
    where: { slug: { startsWith: 'demo-' } },
    select: { id: true },
  });
  if (existing) {
    console.log('demo catalog already seeded');
    return null;
  }
  const summary = await prisma.$transaction((tx) => insertAll(tx), { timeout: 120_000 });
  console.log(
    `demo catalog seeded: ${summary.categories} categories, ${summary.brands} brands, ` +
      `${summary.products} products, ${summary.variants} variants`,
  );
  return summary;
}

async function insertAll(tx: Tx): Promise<DemoCatalogSummary> {
  const seller = await tx.seller.findFirstOrThrow();
  const rand = mulberry32(SEED);

  const categories = new Map<string, { id: string; path: string; level: number }>();
  const siblingSort = new Map<string, number>();
  for (const def of CATEGORIES) {
    const parent = def.parent ? categories.get(def.parent) : undefined;
    if (def.parent && !parent) throw new Error(`demo catalog: parent ${def.parent} missing`);
    const level = parent ? parent.level + 1 : 1;
    const parentKey = def.parent ?? '';
    const sort = siblingSort.get(parentKey) ?? 0;
    siblingSort.set(parentKey, sort + 1);
    const row = await tx.category.create({
      data: {
        parentId: parent?.id ?? null,
        level,
        path: '',
        nameEn: def.nameEn,
        nameBn: def.nameBn,
        slug: def.slug,
        chipColor: level === 1 ? (def.chip ?? null) : null,
        showOnHome: level === 1,
        sort,
      },
    });
    const path = `${parent?.path ?? '/'}${row.id}/`;
    await tx.category.update({ where: { id: row.id }, data: { path } });
    categories.set(def.slug, { id: row.id, path, level });
  }

  const brands = new Map<string, string>();
  for (const def of BRANDS) {
    const row = await tx.brand.create({
      data: { nameEn: def.nameEn, nameBn: def.nameBn, slug: def.slug },
    });
    brands.set(def.slug, row.id);
  }

  const attributes = new Map<string, { id: string; options: Map<string, string> }>();
  for (const def of ATTRIBUTES) {
    const category = categories.get(def.category);
    if (!category) throw new Error(`demo catalog: category ${def.category} missing`);
    const row = await tx.categoryAttribute.create({
      data: {
        categoryId: category.id,
        key: def.key,
        nameEn: def.nameEn,
        nameBn: def.nameBn,
        type: def.type,
        unit: def.unit,
        options: {
          create: (def.options ?? []).map((o, i) => ({ valueEn: o.en, valueBn: o.bn, sort: i })),
        },
      },
      include: { options: true },
    });
    attributes.set(def.key, {
      id: row.id,
      options: new Map(row.options.map((o) => [o.valueEn, o.id])),
    });
  }

  let variantCount = 0;
  for (const def of PRODUCTS) {
    const primary = categories.get(def.category);
    if (!primary) throw new Error(`demo catalog: category ${def.category} missing`);
    const options = def.options ?? [];
    const status = def.status ?? 'active';

    const attributeValues: Prisma.ProductAttributeValueUncheckedCreateWithoutProductInput[] = [];
    for (const [key, raw] of Object.entries(def.attrs ?? {})) {
      const attribute = attributes.get(key);
      if (!attribute) throw new Error(`demo catalog: attribute ${key} missing`);
      for (const value of Array.isArray(raw) ? raw : [raw]) {
        if (typeof value === 'number') {
          attributeValues.push({ attributeId: attribute.id, valueNumber: value });
          continue;
        }
        const optionId = attribute.options.get(value);
        if (!optionId) throw new Error(`demo catalog: option ${value} missing for ${key}`);
        attributeValues.push({ attributeId: attribute.id, optionId });
      }
    }

    const product = await tx.product.create({
      data: {
        sellerId: seller.id,
        brandId: def.brand ? brands.get(def.brand) : null,
        primaryCategoryId: primary.id,
        titleEn: def.titleEn,
        titleBn: def.titleBn,
        slug: def.slug,
        shortDescriptionEn: `Genuine ${def.titleEn} with delivery across Bangladesh.`,
        descriptionHtmlEn: `<p>${def.titleEn} for everyday use.</p><ul><li>Genuine product from BD Commerce</li><li>Cash on delivery available</li></ul>`,
        descriptionHtmlBn: `<p>${def.titleBn ?? def.titleEn} — বাংলাদেশজুড়ে ডেলিভারি।</p>`,
        status,
        publishedAt: status === 'active' ? PUBLISHED_AT : null,
        hasVariants: options.length > 0,
        isUpcoming: def.upcoming ?? false,
        isPreorder: def.preorderDate !== undefined,
        preorderExpectedDate: def.preorderDate ? new Date(def.preorderDate) : null,
        categories: {
          create: [def.category, ...(def.extraCategories ?? [])].map((slug) => ({
            categoryId: categories.get(slug)?.id ?? '',
          })),
        },
        attributeValues: { create: attributeValues },
        options: {
          create: options.map((o, i) => ({
            position: i + 1,
            nameEn: o.nameEn,
            nameBn: o.nameBn,
            values: {
              create: o.values.map((v, j) => ({ valueEn: v.en, valueBn: v.bn, sort: j })),
            },
          })),
        },
      },
      include: {
        options: {
          orderBy: { position: 'asc' },
          include: { values: { orderBy: { sort: 'asc' } } },
        },
      },
    });

    // Cartesian product of option values; no options gives the single default variant.
    type Dim = { id: string; en: string; deltaTk: number };
    let combos: Dim[][] = [[]];
    product.options.forEach((opt, oi) => {
      const dim: Dim[] = opt.values.map((val, vi) => {
        const source = options[oi]?.values[vi];
        return { id: val.id, en: source?.en ?? '', deltaTk: source?.deltaTk ?? 0 };
      });
      combos = combos.flatMap((combo) => dim.map((d) => [...combo, d]));
    });

    for (const [index, combo] of combos.entries()) {
      const delta = combo.reduce((sum, d) => sum + d.deltaTk, 0);
      const sku = ['DEMO', def.code, ...combo.map((d) => abbr(d.en))].join('-');
      const onHandRoll = rand();
      const onHand =
        onHandRoll < 0.1
          ? 0
          : onHandRoll < 0.2
            ? 1 + Math.floor(rand() * 4)
            : 5 + Math.floor(rand() * 56);
      await tx.variant.create({
        data: {
          productId: product.id,
          sku,
          optionValue1Id: combo[0]?.id ?? null,
          optionValue2Id: combo[1]?.id ?? null,
          priceP: tk(def.priceTk + delta),
          compareAtP: def.compareAtTk ? tk(def.compareAtTk + delta) : null,
          costP: def.costTk ? tk(def.costTk + delta) : null,
          sort: index,
          inventory: { create: { onHand, reserved: 0, lowStockThreshold: 5 } },
          movements:
            onHand > 0
              ? { create: [{ qtyDelta: onHand, reason: 'import', note: 'demo seed' }] }
              : undefined,
        },
      });
      variantCount += 1;
    }
  }

  return {
    categories: CATEGORIES.length,
    brands: BRANDS.length,
    products: PRODUCTS.length,
    variants: variantCount,
  };
}
