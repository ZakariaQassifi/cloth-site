/**
 * Product domain model — the single source of truth for product shape.
 *
 * Every layer of the app (cards, detail page, filters, cart, checkout, order
 * confirmation) reads products through this module, so swapping the data source
 * (local fixture -> REST API -> database) never requires a UI rewrite.
 */

/** A concrete size/colour combination that carries its own stock level. */
export interface ProductVariant {
  id: string;
  size: string;
  color: string;
  quantity: number;
}

/** Raw product payload as it may arrive from an API or database. */
export interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  salePrice?: number | null;
  /**
   * Shipping charged for one unit of this product, set per product by the admin.
   * Charged per unit, so two of a product ship for twice this amount.
   */
  shippingPrice?: number | null;
  images: string[];
  hoverImageUrl?: string | null;
  category: string;
  categoryId?: string;
  /** Distinct sizes offered for this product. */
  sizes?: string[];
  /** Distinct colours offered for this product. */
  colors?: string[];
  /** Per-variant stock records. */
  variants?: ProductVariant[];
  /** Sum of all variant quantities. */
  stock?: number;
  isOutOfStock?: boolean;
  isActive?: boolean;
  isVisible?: boolean;
  createdAt?: string | Date;
}

export const FALLBACK_PRODUCT_IMAGE =
  'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&q=80&w=800';

const FALLBACK_SIZES = ['S', 'M', 'L', 'XL'];

/**
 * Colour names are accepted as swatch values so the storefront can render a
 * colour even when the stored value is a name rather than a hex code.
 */
const NAMED_COLORS: Record<string, string> = {
  black: '#0f0f0f',
  white: '#ffffff',
  grey: '#8a8a8a',
  gray: '#8a8a8a',
  blue: '#1d4ed8',
  navy: '#1e3a8a',
  red: '#dc2626',
  green: '#16a34a',
  olive: '#4d7c0f',
  beige: '#e7e0d3',
  cream: '#f5f2ea',
  brown: '#854d0e',
  tan: '#d6b48c',
  yellow: '#eab308',
  purple: '#7c3aed',
  pink: '#ec4899',
  orange: '#f97316',
  grey_melange: '#9ca3af',
  heather: '#b0b0b0',
};

/**
 * Shades currently stored in the database mapped back to readable labels.
 * Purely presentational: it lets the UI say "Black" instead of "#0f0f0f".
 */
const STORED_COLOR_LABELS: Record<string, string> = {
  '#0f0f0f': 'Black',
  '#f8f8f8': 'White',
  '#ffffff': 'White',
  '#e0e0e0': 'Light Grey',
  '#666666': 'Grey',
  '#2a2a2a': 'Charcoal',
  '#1e293b': 'Navy',
  '#854d0e': 'Brown',
};

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNCTIONAL_COLOR = /^(rgb|rgba|hsl|hsla)\(/i;

/** True when the value can be handed to CSS `background-color` as-is. */
export function isCssColor(value: string): boolean {
  return HEX_COLOR.test(value) || FUNCTIONAL_COLOR.test(value);
}

/**
 * Resolve any stored colour value (hex or name) into a value CSS can render.
 * Prevents invisible swatches when colours are stored as names.
 */
export function toSwatchColor(value: string): string {
  if (!value) return '#cccccc';
  if (isCssColor(value)) return value;
  return NAMED_COLORS[value.trim().toLowerCase().replace(/[\s-]+/g, '_')] ?? '#cccccc';
}

/**
 * Display name for a stored colour.
 * The database keeps raw swatch values (for example `#0f0f0f`), so the UI shows
 * a readable label while still sending the stored value to the API.
 */
export function toColorName(value: string): string {
  if (!value) return '';
  const key = value.trim().toLowerCase();
  if (isCssColor(value)) {
    if (STORED_COLOR_LABELS[key]) return STORED_COLOR_LABELS[key];
    for (const [name, hex] of Object.entries(NAMED_COLORS)) {
      if (hex.toLowerCase() === key) {
        return name.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
      }
    }
    return value;
  }
  return value;
}

/** The price a customer actually pays for a single unit. */
export function getUnitPrice(product: Product): number {
  const sale = product.salePrice;
  if (sale !== null && sale !== undefined && sale < product.price) return sale;
  return product.price;
}

/** True when the product has a genuine discount applied. */
export function isProductOnSale(product: Product): boolean {
  const sale = product.salePrice;
  return sale !== null && sale !== undefined && sale < product.price;
}

/** Whole-number discount percentage, or 0 when not on sale. */
export function getDiscountPercent(product: Product): number {
  if (!isProductOnSale(product) || !product.price) return 0;
  return Math.round(((product.price - (product.salePrice as number)) / product.price) * 100);
}

/**
 * Shipping charged for a single unit of this product.
 *
 * Read from the product rather than a store-wide rate, so a bulky jacket and a
 * cotton tee can each carry their own delivery cost. A missing or invalid value
 * means "no shipping charge" rather than an error.
 */
export function getShippingPrice(product: Product): number {
  const shipping = Number(product.shippingPrice);
  return Number.isFinite(shipping) && shipping > 0 ? shipping : 0;
}

/** Sum of all variant stock. */
export function getProductStock(product: Product): number {
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    return product.variants.reduce((sum, variant) => sum + (Number(variant.quantity) || 0), 0);
  }
  return Number(product.stock) || 0;
}

/** True when the product cannot be purchased at all. */
export function isProductOutOfStock(product: Product): boolean {
  return Boolean(product.isOutOfStock) || getProductStock(product) <= 0;
}

/** Distinct sizes, falling back to a standard size run when none are recorded. */
export function getProductSizes(product: Product): string[] {
  if (Array.isArray(product.sizes) && product.sizes.length > 0) return product.sizes;
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    return Array.from(new Set(product.variants.map((variant) => variant.size)));
  }
  return FALLBACK_SIZES;
}

/** Distinct colours, falling back to the first variant colour when none exist. */
export function getProductColors(product: Product): string[] {
  if (Array.isArray(product.colors) && product.colors.length > 0) return product.colors;
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    return Array.from(new Set(product.variants.map((variant) => variant.color)));
  }
  return [];
}

/** Stock available for a specific size/colour pair. */
export function getVariantStock(product: Product, size: string, color: string): number {
  if (!Array.isArray(product.variants) || product.variants.length === 0) {
    return isProductOutOfStock(product) ? 0 : Number(product.stock) || 0;
  }
  const match =
    product.variants.find((variant) => variant.size === size && variant.color === color) ??
    product.variants.find(
      (variant) => variant.size === size && variant.color.toLowerCase().includes(color.toLowerCase())
    );
  return match ? Number(match.quantity) || 0 : 0;
}

/** Gallery images, guaranteed non-empty so `<img src>` is never undefined. */
export function getProductImages(product: Product): string[] {
  const images = (product.images ?? []).filter(
    (image): image is string => typeof image === 'string' && image.trim().length > 0
  );
  return images.length > 0 ? images : [FALLBACK_PRODUCT_IMAGE];
}

/** Primary (first) gallery image. */
export function getPrimaryImage(product: Product): string {
  return getProductImages(product)[0];
}

export function getProductDescription(product: Product): string {
  const description = product.description?.trim();
  return description
    ? description
    : 'Meticulously crafted with a focus on architectural lines and premium hand-feel. Designed for modern versatility and lasting durability.';
}

/**
 * Coerce an arbitrary API/database payload into a valid `Product`.
 * Guarantees arrays, numbers and gallery entries are always present so no
 * component has to defend against `undefined`.
 */
export function normalizeProduct(raw: Partial<Product> & { id: string; name: string }): Product {
  const variants = Array.isArray(raw.variants) ? raw.variants : [];
  const images = getProductImages(raw as Product);

  return {
    id: raw.id,
    name: raw.name ?? 'Unnamed product',
    description: raw.description ?? '',
    price: Number(raw.price) || 0,
    salePrice: raw.salePrice === undefined || raw.salePrice === null ? null : Number(raw.salePrice),
    shippingPrice: getShippingPrice(raw as Product),
    images,
    category: raw.category ?? 'Uncategorised',
    categoryId: raw.categoryId,
    sizes: getProductSizes({ ...(raw as Product), variants }),
    colors: getProductColors({ ...(raw as Product), variants }),
    variants,
    stock: raw.stock ?? variants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0),
    isOutOfStock: Boolean(raw.isOutOfStock),
    isActive: raw.isActive !== false,
    isVisible: raw.isVisible !== false,
    createdAt: raw.createdAt,
  };
}
