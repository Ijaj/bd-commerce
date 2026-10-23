/** Single source of truth for the import/export file layout (C24: one row per variant). */

export interface ColumnDef {
  name: string;
  /** product = repeated on every row of a product, option = variant option, variant = per row. */
  scope: 'product' | 'option' | 'variant';
  /** Needed when a new product/variant is created (updates may leave it blank). */
  required: boolean;
  description: string;
  /** Values for the two rows of the downloadable template. */
  example: [string, string];
}

const c = (
  name: string,
  scope: ColumnDef['scope'],
  required: boolean,
  description: string,
  example: [string, string],
): ColumnDef => ({ name, scope, required, description, example });

export const COLUMNS: readonly ColumnDef[] = [
  c('product_slug', 'product', true, 'Groups rows into one product; matches an existing product.', [
    'cotton-tshirt',
    'cotton-tshirt',
  ]),
  c('title_en', 'product', true, 'English title (max 250).', ['Cotton T-shirt', 'Cotton T-shirt']),
  c('title_bn', 'product', false, 'Bangla title.', ['কটন টি-শার্ট', 'কটন টি-শার্ট']),
  c('status', 'product', false, 'draft, active or archived (default draft).', ['draft', 'draft']),
  c('brand_slug', 'product', false, 'Slug of an existing brand.', ['', '']),
  c('primary_category_slug', 'product', true, 'Slug of an existing category.', [
    'your-category-slug',
    'your-category-slug',
  ]),
  c('category_slugs', 'product', false, 'Extra category slugs separated by |.', ['', '']),
  c('fulfillment', 'product', false, 'stock or dropship (default stock).', ['stock', 'stock']),
  c('short_description_en', 'product', false, 'Plain text, max 1000.', ['Soft and light', '']),
  c('short_description_bn', 'product', false, 'Plain text, max 1000.', ['', '']),
  c('description_html_en', 'product', false, 'HTML, sanitized on import.', [
    '<p>100% cotton</p>',
    '',
  ]),
  c('description_html_bn', 'product', false, 'HTML, sanitized on import.', ['', '']),
  c('youtube_url', 'product', false, 'youtube.com/watch?v=, youtu.be/ or /shorts/ link.', ['', '']),
  c('weight_g', 'product', false, 'Product weight in grams.', ['200', '']),
  c('is_preorder', 'product', false, 'true or false.', ['false', 'false']),
  c('preorder_expected_date', 'product', false, 'YYYY-MM-DD.', ['', '']),
  c('is_upcoming', 'product', false, 'true or false.', ['false', 'false']),
  c('option1_name_en', 'option', false, 'First option type, same on every row (e.g. Color).', [
    'Color',
    'Color',
  ]),
  c('option1_name_bn', 'option', false, 'Bangla name of option 1.', ['রঙ', 'রঙ']),
  c('option1_value_en', 'option', false, 'Value of option 1 for this variant.', ['Red', 'Blue']),
  c('option1_value_bn', 'option', false, 'Bangla value of option 1.', ['লাল', 'নীল']),
  c('option2_name_en', 'option', false, 'Second option type (max 2 options).', ['', '']),
  c('option2_name_bn', 'option', false, 'Bangla name of option 2.', ['', '']),
  c('option2_value_en', 'option', false, 'Value of option 2 for this variant.', ['', '']),
  c('option2_value_bn', 'option', false, 'Bangla value of option 2.', ['', '']),
  c('sku', 'variant', true, 'Unique SKU (max 64); matches an existing variant.', [
    'TS-RED',
    'TS-BLUE',
  ]),
  c('barcode', 'variant', false, 'Barcode (max 64).', ['', '']),
  c('price', 'variant', true, 'Taka, up to 2 decimals, e.g. 1,250.50. No currency symbol.', [
    '450.00',
    '450.00',
  ]),
  c('compare_at_price', 'variant', false, 'Old price (above price).', ['', '']),
  c('sale_price', 'variant', false, 'Sale price (below price).', ['', '']),
  c('cost_price', 'variant', false, 'Cost; only exported/imported with products.view_cost.', [
    '',
    '',
  ]),
  c('weight_g_variant', 'variant', false, 'Variant weight in grams.', ['', '']),
  c('variant_active', 'variant', false, 'true or false (default true).', ['true', 'true']),
  c('on_hand', 'variant', false, 'Stock on hand; set via a stock movement. Blank = unchanged.', [
    '20',
    '10',
  ]),
  c('low_stock_threshold', 'variant', false, 'Low-stock alert level.', ['5', '5']),
];

export const ATTR_PREFIX = 'attr:';
export const COLUMN_NAMES = COLUMNS.map((x) => x.name);
export const COST_COLUMN = 'cost_price';
export const MAX_IMPORT_ROWS = 5000;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
