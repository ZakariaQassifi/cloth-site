/**
 * Shared transport types for every backend call.
 *
 * `ApiResult` is the envelope the REST layer returns, so services and UI never
 * need to guess whether a response succeeded.
 */

import type { OrderStatus, PaymentMethod } from '../data/order';

export type { OrderStatus, PaymentMethod };

export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
}

export interface ApiFailure {
  success: false;
  message: string;
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

/** Category as consumed by the storefront and admin. */
export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  hoverImageUrl?: string | null;
  isVisible: boolean;
  displayOrder: number;
  createdAt?: string;
  _count?: { products: number };
}

/** Admin-facing product payload (includes fields hidden from the storefront). */
export interface AdminProduct {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  price: number;
  salePrice?: number | null;
  shippingPrice?: number;
  categoryId?: string;
  category: string;
  images: string[];
  hoverImageUrl?: string | null;
  details?: string | null;
  shippingInfo?: string | null;
  colors?: string[];
  sizes?: string[];
  variants: Array<{ id?: string; size: string; color: string; quantity: number }>;
  /** Effective availability: manual flag OR zero total stock. Read-only. */
  isOutOfStock?: boolean;
  /** The admin's explicit switch. Only this value may be written back. */
  manualOutOfStock?: boolean;
  isActive?: boolean;
  isVisible?: boolean;
  createdAt?: string;
}

export interface AdminOrderItem {
  id?: string;
  orderId?: string;
  productId?: string | null;
  productName: string;
  productImage: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface AdminOrder {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCity: string;
  customerAddress: string;
  customerPostalCode?: string | null;
  customerNotes?: string | null;
  /** Sum of the order lines, before shipping. */
  subtotalPrice: number;
  shippingPrice: number;
  /** `subtotalPrice + shippingPrice`. */
  totalPrice: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  createdAt: string;
  updatedAt?: string;
  items?: AdminOrderItem[];
}

export interface AdminStats {
  totalProducts: number;
  totalOrders: number;
  pendingOrders: number;
  deliveredOrders: number;
  outOfStock: number;
  totalSales: number;
  recentOrders: AdminOrder[];
  products: AdminProduct[];
  categories: Category[];
  orders: AdminOrder[];
}

export interface ProductQuery {
  category?: string;
  size?: string;
  color?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  sale?: boolean;
  sort?: string;
  admin?: boolean;
}

export interface ProductInput {
  name: string;
  description?: string;
  price: number;
  salePrice?: number | null;
  shippingPrice?: number;
  categoryId: string;
  images?: string[];
  hoverImageUrl?: string | null;
  details?: string | null;
  shippingInfo?: string | null;
  variants?: Array<{ size: string; color: string; quantity: number }>;
  isOutOfStock?: boolean;
  isActive?: boolean;
  isVisible?: boolean;
}

export interface CategoryInput {
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string | null;
  hoverImageUrl?: string | null;
  isVisible?: boolean;
  displayOrder?: number;
}

/** Discount behaviour a promo code applies. */
export type PromoDiscountType = 'PERCENTAGE' | 'FIXED';

/** Promo code as surfaced to the admin dashboard. */
export interface PromoCode {
  id: string;
  /** Shoppers type this into checkout; stored upper-case. */
  code: string;
  discountType: PromoDiscountType;
  /** Percentage (0-100) or absolute money off, per `discountType`. */
  discountValue: number;
  /** Minimum item units in the cart for the code to be applicable. */
  minProductsCount: number;
  /** Max uses; null = unlimited. */
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  /** ISO timestamp, or null when the code never expires. */
  expiresAt: string | null;
  createdAt?: string;
}

/** Payload the admin dashboard sends to create or update a promo code. */
export interface PromoCodeInput {
  code: string;
  discountType: PromoDiscountType;
  discountValue: number;
  minProductsCount: number;
  /** Omit/null for unlimited uses. */
  usageLimit?: number | null;
  isActive?: boolean;
  /** ISO timestamp, or null for no expiry. */
  expiresAt?: string | null;
}

/** Global site settings as consumed by the storefront and admin. */
export interface SiteSettings {
  id: string;
  storeName: string;
  brandName: string;
  logoUrl?: string | null;
  copyrightText?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactAddress?: string | null;
  businessHours?: string | null;
  socialLinks?: string | null;
  footerLinks?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string | null;
  trackingId?: string | null;
  customCss?: string | null;
  customJs?: string | null;
  heroTitle?: string | null;
  heroSubtitle?: string | null;
  heroImages?: string | null;
  footerImageUrl?: string | null;
  showEmailSupport?: boolean;
  showPhoneSupport?: boolean;
  showVisitUs?: boolean;
  showBusinessHours?: boolean;
  flatShippingRate?: number;
  freeShippingThreshold?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Input for updating site settings. */
export interface SiteSettingsInput {
  storeName?: string;
  brandName?: string;
  logoUrl?: string | null;
  copyrightText?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactAddress?: string | null;
  businessHours?: string | null;
  socialLinks?: string | null;
  footerLinks?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string | null;
  trackingId?: string | null;
  customCss?: string | null;
  customJs?: string | null;
  heroTitle?: string | null;
  heroSubtitle?: string | null;
  heroImages?: string | null;
  footerImageUrl?: string | null;
  showEmailSupport?: boolean;
  showPhoneSupport?: boolean;
  showVisitUs?: boolean;
  showBusinessHours?: boolean;
  flatShippingRate?: number;
  freeShippingThreshold?: number | null;
}

/** Normalises a rejected response into a readable message. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}