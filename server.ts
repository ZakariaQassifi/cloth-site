import express, { type ErrorRequestHandler, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  AUTH_REQUIRED,
  INVALID_CREDENTIALS,
  MISSING_CREDENTIALS,
  TOO_MANY_ATTEMPTS,
} from './shared/adminAuthMessages';
import { sendOrderNotifications } from './server/orderNotifications';
import { warnIfUnconfigured } from './server/emailConfig';
import { assertSigningSecretIsSafe } from './server/adminAuth';
import { configureDatabase, prisma } from './server/db';
import { hashPassword } from './server/adminPassword';
import { LIMITS, isShortText, validateOrderCustomer, validateOrderItems, validateDisplayOrder } from './server/validation';
import { rateLimit } from './server/rateLimit';
import {
  InsufficientStockError,
  ProductUnavailableError,
  StockError,
  releaseStock,
  reReserveStock,
  reserveStock,
  syncOutOfStock,
} from './server/stock';
import {
  authenticateAdmin,
  bearerToken,
  clearLoginFailures,
  loginRetryAfterSeconds,
  recordLoginFailure,
  requireAdmin,
  signAdminToken,
  touchAdminLogin,
  verifyAdminToken,
  type AdminRequest,
} from './server/adminAuth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

/**
 * Cross-origin policy.
 *
 * The storefront is served from a different origin than the API, so CORS has to
 * permit it. `cors()` with no arguments reflects *any* origin, which is wider
 * than necessary: admin routes are guarded by a bearer token rather than a
 * cookie, so a hostile page cannot use this to sign an admin in, but there is no
 * reason to expose the API to every domain on the internet either.
 *
 * `CORS_ORIGINS` takes a comma-separated allowlist and switches the server to
 * strict mode. It is deliberately not defaulted to a guessed list: this server
 * does not know which domain the storefront is deployed on, and silently
 * blocking a real origin would break the shop. Unset means "allow any", with a
 * warning, so the gap is visible instead of hidden.
 */
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());

// Ensure uploads dir exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Serve static uploads
app.use('/uploads', express.static(uploadDir));

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // The extension is taken from the MIME type that `fileFilter` already
    // accepted, never from the client-supplied filename. Trusting
    // `originalname` would let a caller store `evil.php` or `x.html` inside the
    // served uploads directory just by naming the file that way.
    const ext = MIME_EXTENSIONS[file.mimetype] ?? '.bin';
    cb(null, 'prod-' + uniqueSuffix + ext);
  },
});

/** The only image types the store accepts, and the extension each is saved with. */
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (MIME_EXTENSIONS[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error('Invalid image format. Please upload JPG, PNG or WebP.'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter,
});

/**
 * Express 5 types a route parameter as `string | string[]`, because a pattern can
 * capture more than one segment. These routes all declare a single `:id`, so
 * normalise to the first segment instead of casting at every call site.
 */
const routeParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? '') : (value ?? '');

/** Readable message from an unknown thrown value. */
const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

/**
 * True for the transient SQLite/Prisma failures that appear when several
 * checkouts write at the same moment: `database is locked`, a busy timeout, or
 * an interactive transaction that ran out of time waiting for the write lock.
 * These are contention, not corruption, and are worth retrying or reporting as
 * a "try again" rather than as a server fault.
 */
const isTransientDbError = (error: unknown): boolean => {
  const message = errorMessage(error, '').toLowerCase();
  return (
    message.includes('database is locked') ||
    message.includes('database is busy') ||
    message.includes('sqlite_busy') ||
    message.includes('transaction already closed') ||
    message.includes('timed out') ||
    message.includes('timeout') ||
    message.includes('too many connections')
  );
};

const TRANSIENT_DB_MESSAGE =
  'The store is busy handling other orders. Please try again in a moment.';

/**
 * A message that is safe to show a shopper.
 *
 * Driver errors quote the query, the schema and absolute paths from the server
 * filesystem. Those must never reach the browser: they leak internals and read
 * as a crash rather than as anything the customer can act on. Recognised
 * business errors pass through untouched so the UI can explain what happened.
 */
const publicErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof StockError) return error.message;
  if (isTransientDbError(error)) return TRANSIENT_DB_MESSAGE;
  const message = errorMessage(error, '');
  // Unrecognised errors are logged in full server-side; the client gets the
  // generic fallback instead of a stack trace or a SQL fragment.
  return message && !/[\\/]|\bat \w+ \(|Invalid `|prisma\.|SELECT |INSERT |UPDATE /.test(message)
    ? message
    : fallback;
};

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: { category: true; images: true; variants: true };
}>;

/**
 * Clothing size runs in the order shoppers expect. Sizes outside the run
 * (One Size, 2XL, ...) keep a stable alphabetical order after the known ones.
 */
const SIZE_ORDER = ['xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl'];

const sortSizes = (sizes: string[]): string[] =>
  [...sizes].sort((a, b) => {
    const rankA = SIZE_ORDER.indexOf(a.trim().toLowerCase());
    const rankB = SIZE_ORDER.indexOf(b.trim().toLowerCase());
    if (rankA === -1 && rankB === -1) return a.localeCompare(b);
    if (rankA === -1) return 1;
    if (rankB === -1) return -1;
    return rankA - rankB;
  });

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&q=80&w=800';

// Authoritative shipping rules — must stay in sync with FREE_SHIPPING_THRESHOLD
// and SHIPPING_FLAT_RATE in src/data/order.ts so the charged total matches the
// total the customer was quoted at checkout.
const FREE_SHIPPING_THRESHOLD = 150;
const SHIPPING_FLAT_RATE = 15;

/** The store's only payment method. */
const PAYMENT_METHOD_CASH_ON_DELIVERY = 'CASH_ON_DELIVERY';

/** Shipping charged for a given subtotal; free above the threshold. */
const calculateShipping = (subtotal: number): number =>
  subtotal > FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT_RATE;

/** Lower-case, dash-separated identifier, matching how category slugs are stored. */
const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

/**
 * The single product shape every endpoint returns.
 *
 * Everything the storefront needs is resolved here — sale state, total stock,
 * the size/colour runs and the image list — so list, detail, create and update
 * responses can never drift apart.
 */
const formatProduct = (product: ProductWithRelations) => {
  const images = product.images.map((image) => image.imageUrl);
  const sizes = sortSizes(Array.from(new Set(product.variants.map((variant) => variant.size))));
  const colors = Array.from(new Set(product.variants.map((variant) => variant.color)));
  const stock = product.variants.reduce((sum, variant) => sum + variant.quantity, 0);
  const isOnSale = product.salePrice !== null && product.salePrice < product.price;

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description ?? '',
    price: product.price,
    salePrice: product.salePrice,
    shippingPrice: product.shippingPrice,
    isOnSale,
    categoryId: product.categoryId,
    category: product.category.name,
    categorySlug: product.category.slug,
    images: images.length > 0 ? images : [FALLBACK_IMAGE],
    hoverImageUrl: product.hoverImageUrl ?? null,
    details: product.details ?? null,
    shippingInfo: product.shippingInfo ?? null,
    sizes,
    colors,
    stock,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      size: variant.size,
      color: variant.color,
      quantity: variant.quantity,
      isInStock: variant.quantity > 0,
    })),
    // Effective availability: an admin flag hides the product, and zero stock
    // hides it too. Derived here as well as persisted, so a storefront response
    // can never show a stale value even mid-request.
    isOutOfStock: product.manualOutOfStock || stock <= 0,
    manualOutOfStock: product.manualOutOfStock,
    isActive: product.isActive,
    isVisible: product.isVisible,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
};

interface VariantInput {
  size: string;
  color: string;
  quantity: number;
}

/** Validate the images/variants payloads before they reach the database. */
function validateProductPayload(input: {
  images?: unknown;
  variants?: unknown;
}): string | null {
  if (input.images !== undefined) {
    if (!Array.isArray(input.images) || input.images.some((url) => typeof url !== 'string' || !url.trim())) {
      return 'images must be an array of image URLs';
    }
  }
  if (input.variants !== undefined) {
    if (!Array.isArray(input.variants) || input.variants.length === 0) {
      return 'variants must be a non-empty array';
    }
    const invalid = input.variants.some(
      (variant) =>
        typeof variant !== 'object' ||
        variant === null ||
        typeof (variant as VariantInput).size !== 'string' ||
        !(variant as VariantInput).size.trim() ||
        typeof (variant as VariantInput).color !== 'string' ||
        !(variant as VariantInput).color.trim() ||
        // Whole units only, and within a range a warehouse could plausibly
        // hold. A decimal would put fractional stock in the database and an
        // unbounded value lets one request set stock to a meaningless figure.
        !Number.isInteger(Number((variant as VariantInput).quantity)) ||
        Number((variant as VariantInput).quantity) < 0 ||
        Number((variant as VariantInput).quantity) > LIMITS.MAX_STOCK_QUANTITY
    );
    if (invalid) {
      return `each variant needs a size, a color and a whole quantity between 0 and ${LIMITS.MAX_STOCK_QUANTITY}`;
    }
    const seen = new Set<string>();
    const duplicate = input.variants.find((variant) => {
      const key = `${(variant as VariantInput).size.trim().toLowerCase()}::${(variant as VariantInput).color.trim().toLowerCase()}`;
      if (seen.has(key)) return true;
      seen.add(key);
      return false;
    });
    if (duplicate) {
      const { size, color } = duplicate as VariantInput;
      return `Duplicate variant: size ${size} in color ${color} can only be listed once`;
    }
  }
  return null;
}

/** Reject unknown category ids with a clear message instead of a database error. */
async function categoryExists(categoryId: string): Promise<boolean> {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  return Boolean(category);
}

// Standard Response Helper
const sendResponse = (
  res: Response,
  statusCode: number,
  success: boolean,
  message: string,
  data?: unknown
) => {
  return res.status(statusCode).json({
    success,
    message,
    ...(data !== undefined && { data }),
  });
};

// ----------------------------------------------------
// HEALTH CHECK
// ----------------------------------------------------
// ----------------------------------------------------
// HEALTH CHECK
// ----------------------------------------------------
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return sendResponse(res, 200, true, 'API and database are reachable', {
      database: 'connected',
      uptimeSeconds: Math.round(process.uptime()),
    });
  } catch (error: unknown) {
    return sendResponse(res, 503, false, errorMessage(error, 'Database unreachable'));
  }
});

// ----------------------------------------------------
// SETUP ADMIN ENDPOINT (FORCE RESET / INITIAL SEED)
// ----------------------------------------------------
app.get('/api/setup-admin', async (_req: Request, res: Response) => {
  try {
    const email = (process.env.ADMIN_EMAIL || 'admin@kinetic.com').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const passwordHash = await hashPassword(password);

    const admin = await prisma.adminUser.upsert({
      where: { email },
      update: { 
        passwordHash,
        name: 'Admin',
        role: 'ADMIN',
      },
      create: {
        email,
        name: 'Admin',
        passwordHash,
        role: 'ADMIN',
      },
    });

    return sendResponse(res, 200, true, 'Admin account configured successfully!', {
      email: admin.email,
      role: admin.role,
      passwordUsed: password,
    });
  } catch (error: unknown) {
    return sendResponse(res, 500, false, errorMessage(error, 'Failed to setup admin account'));
  }
});

// ----------------------------------------------------
// ADMIN AUTHENTICATION
// ----------------------------------------------------

/** Identify the caller for throttling; falls back to a bucket when unparsable. */
const loginThrottleKey = (req: Request): string => req.ip || req.socket.remoteAddress || 'unknown';

app.post('/api/admin/login', async (req: Request, res: Response) => {
  const throttleKey = loginThrottleKey(req);

  if (loginRetryAfterSeconds(throttleKey) > 0) {
    res.setHeader('Retry-After', String(loginRetryAfterSeconds(throttleKey)));
    return sendResponse(res, 429, false, TOO_MANY_ATTEMPTS);
  }

  const { email, password } = (req.body ?? {}) as { email?: unknown; password?: unknown };

  // Basic shape validation before touching the database.
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return sendResponse(res, 400, false, MISSING_CREDENTIALS);
  }

  try {
    const { admin } = await authenticateAdmin(email, password);

    // The same message is returned for an unknown address and a bad password so
    // the endpoint cannot be used to discover which admins exist.
    if (!admin) {
      recordLoginFailure(throttleKey);
      return sendResponse(res, 401, false, INVALID_CREDENTIALS);
    }

    clearLoginFailures(throttleKey);
    void touchAdminLogin(admin.adminId);

    const token = signAdminToken({
      sub: admin.adminId,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    });

    return sendResponse(res, 200, true, 'Admin login successful', {
      token,
      admin: { id: admin.adminId, email: admin.email, name: admin.name, role: admin.role },
    });
  } catch (error: unknown) {
    return sendResponse(res, 500, false, errorMessage(error, 'Unable to sign in right now.'));
  }
});

/** Session probe used on dashboard load to confirm a stored token is still valid. */
app.get('/api/admin/me', requireAdmin, (req: AdminRequest, res: Response) => {
  const admin = req.admin;
  return sendResponse(res, 200, true, 'Authenticated', {
    admin: admin
      ? { id: admin.adminId, email: admin.email, name: admin.name, role: admin.role }
      : null,
  });
});

/**
 * Logout.
 *
 * Sessions are stateless JWTs, so there is no server-side session to destroy;
 * the client discards the token. The endpoint exists so the sign-out intent is
 * explicit and centralised, and so a token blacklist can be added later without
 * changing the client contract.
 */
app.post('/api/admin/logout', requireAdmin, (_req: Request, res: Response) => {
  return sendResponse(res, 200, true, 'Signed out');
});

// ----------------------------------------------------
// UPLOAD API
// ----------------------------------------------------
// `requireAdmin` must come first. Middleware runs left to right, so putting the
// upload ahead of it meant multer wrote every file to disk and only then
// rejected the caller — an unauthenticated visitor could fill the disk with
// images while being told they were not allowed in.
app.post('/api/upload', requireAdmin, upload.array('images', 10), (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return sendResponse(res, 400, false, 'No image files uploaded');
    }

    const host = req.get('host') || 'localhost:5000';
    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const fileUrls = files.map((file) => `${protocol}://${host}/uploads/${file.filename}`);

    return sendResponse(res, 201, true, 'Images uploaded successfully', fileUrls);
  } catch (error: unknown) {
    next(error);
  }
});

// ----------------------------------------------------
// CATEGORIES API
// ----------------------------------------------------

app.get('/api/categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { admin } = req.query;

    // The public storefront reads visible rows only. `?admin=true` also returns
    // hidden categories, so it is a privileged view and needs a session.
    if (admin === 'true' && !verifyAdminToken(bearerToken(req))) {
      return sendResponse(res, 401, false, AUTH_REQUIRED);
    }

    const where: Prisma.CategoryWhereInput = {};
    if (admin !== 'true') {
      where.isVisible = true;
    }

    const categories = await prisma.category.findMany({
      where,
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    return sendResponse(res, 200, true, 'Categories fetched successfully', categories);
  } catch (error) {
    next(error);
  }
});

app.get('/api/categories/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = routeParam(req.params.id);
    const category = await prisma.category.findUnique({
      where: { id },
      include: { products: { include: { images: true, variants: true } } },
    });
    if (!category) {
      return sendResponse(res, 404, false, 'Category not found');
    }
    return sendResponse(res, 200, true, 'Category fetched successfully', category);
  } catch (error) {
    next(error);
  }
});

app.post('/api/categories', requireAdmin, async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const { name, slug, description, imageUrl, hoverImageUrl, isVisible, displayOrder } = req.body;
    // A whitespace-only name would render as a blank nav entry and produce a
    // meaningless URL slug, so it is treated as missing rather than stored.
    if (!isShortText(name)) {
      return sendResponse(res, 400, false, 'Name is required');
    }
    if (!isShortText(slug)) {
      return sendResponse(res, 400, false, 'Slug is required');
    }

    const orderError = validateDisplayOrder(displayOrder);
    if (orderError) {
      return sendResponse(res, 400, false, orderError);
    }

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description: description || '',
        imageUrl: imageUrl || null,
        hoverImageUrl: hoverImageUrl || null,
        isVisible: isVisible !== undefined ? Boolean(isVisible) : true,
        displayOrder: displayOrder !== undefined ? Number(displayOrder) : 0,
      },
    });
    return sendResponse(res, 201, true, 'Category created successfully', category);
  } catch (error) {
    next(error);
  }
});

app.put('/api/categories/:id', requireAdmin, async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const id = routeParam(req.params.id);
    const { name, slug, description, imageUrl, hoverImageUrl, isVisible, displayOrder } = req.body;

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
      return sendResponse(res, 404, false, 'Category not found');
    }

    // Reject blank names rather than storing them: `name && { name }` below
    // already ignores an empty string, but whitespace is truthy and would be
    // written through.
    if (name !== undefined && !isShortText(name)) {
      return sendResponse(res, 400, false, 'Name cannot be blank');
    }
    if (slug !== undefined && !isShortText(slug)) {
      return sendResponse(res, 400, false, 'Slug cannot be blank');
    }

    const orderError = validateDisplayOrder(displayOrder);
    if (orderError) {
      return sendResponse(res, 400, false, orderError);
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(slug && { slug }),
        ...(description !== undefined && { description }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(hoverImageUrl !== undefined && { hoverImageUrl }),
        ...(isVisible !== undefined && { isVisible: Boolean(isVisible) }),
        ...(displayOrder !== undefined && { displayOrder: Number(displayOrder) }),
      },
    });
    return sendResponse(res, 200, true, 'Category updated successfully', category);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/categories/:id', requireAdmin, async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const id = routeParam(req.params.id);
    const existing = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
    if (!existing) {
      return sendResponse(res, 404, false, 'Category not found');
    }

    if (existing._count.products > 0) {
      return sendResponse(
        res,
        400,
        false,
        `This category contains ${existing._count.products} products. Please move or reassign these products before deleting the category.`
      );
    }

    await prisma.category.delete({ where: { id } });
    return sendResponse(res, 200, true, 'Category deleted successfully');
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// SETTINGS API
// ----------------------------------------------------

/** Helper to parse JSON string fields safely. */
function parseJsonField<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/** Helper to stringify JSON fields safely. */
function stringifyJsonField<T>(value: T | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

app.get('/api/settings', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    let settings = await prisma.siteSettings.findUnique({ where: { id: 'default' } });

    // Create default settings if none exist
    if (!settings) {
      settings = await prisma.siteSettings.create({
        data: { id: 'default' },
      });
    }

    // Parse JSON fields for the response
    const response = {
      ...settings,
      socialLinks: parseJsonField<string[]>(settings.socialLinks, []),
      footerLinks: parseJsonField<Array<{ label: string; href: string }>>(settings.footerLinks, []),
      heroImages: parseJsonField<string[]>(settings.heroImages, []),
    };

    return sendResponse(res, 200, true, 'Settings fetched successfully', response);
  } catch (error) {
    next(error);
  }
});

app.put('/api/admin/settings', requireAdmin, async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const {
      storeName,
      logoUrl,
      copyrightText,
      contactEmail,
      contactPhone,
      contactAddress,
      socialLinks,
      footerLinks,
      metaTitle,
      metaDescription,
      metaKeywords,
      trackingId,
      customCss,
      customJs,
      heroTitle,
      heroSubtitle,
      heroImages,
      footerImageUrl,
    } = req.body;

    const settings = await prisma.siteSettings.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        storeName: storeName || 'KINETIC STUDIO',
        logoUrl,
        copyrightText: copyrightText || '© 2026 KINETIC STUDIO. All rights reserved.',
        contactEmail,
        contactPhone,
        contactAddress,
        socialLinks: stringifyJsonField(socialLinks),
        footerLinks: stringifyJsonField(footerLinks),
        metaTitle,
        metaDescription,
        metaKeywords,
        trackingId,
        customCss,
        customJs,
        heroTitle,
        heroSubtitle,
        heroImages: stringifyJsonField(heroImages),
        footerImageUrl,
      },
      update: {
        ...(storeName !== undefined && { storeName }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(copyrightText !== undefined && { copyrightText }),
        ...(contactEmail !== undefined && { contactEmail }),
        ...(contactPhone !== undefined && { contactPhone }),
        ...(contactAddress !== undefined && { contactAddress }),
        ...(socialLinks !== undefined && { socialLinks: stringifyJsonField(socialLinks) }),
        ...(footerLinks !== undefined && { footerLinks: stringifyJsonField(footerLinks) }),
        ...(metaTitle !== undefined && { metaTitle }),
        ...(metaDescription !== undefined && { metaDescription }),
        ...(metaKeywords !== undefined && { metaKeywords }),
        ...(trackingId !== undefined && { trackingId }),
        ...(customCss !== undefined && { customCss }),
        ...(customJs !== undefined && { customJs }),
        ...(heroTitle !== undefined && { heroTitle }),
        ...(heroSubtitle !== undefined && { heroSubtitle }),
        ...(heroImages !== undefined && { heroImages: stringifyJsonField(heroImages) }),
        ...(footerImageUrl !== undefined && { footerImageUrl }),
      },
    });

    // Parse JSON fields for the response
    const response = {
      ...settings,
      socialLinks: parseJsonField<string[]>(settings.socialLinks, []),
      footerLinks: parseJsonField<Array<{ label: string; href: string }>>(settings.footerLinks, []),
      heroImages: parseJsonField<string[]>(settings.heroImages, []),
    };

    return sendResponse(res, 200, true, 'Settings updated successfully', response);
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// PRODUCTS API & FILTERING
// ----------------------------------------------------

app.get('/api/products', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, size, color, minPrice, maxPrice, search, sale, sort, admin } = req.query;

    // `?admin=true` returns hidden and inactive products, which the storefront
    // must never see, so it requires a valid admin session.
    if (admin === 'true' && !verifyAdminToken(bearerToken(req))) {
      return sendResponse(res, 401, false, AUTH_REQUIRED);
    }

    const whereClause: Prisma.ProductWhereInput = {
      isActive: true,
    };

    if (admin !== 'true') {
      whereClause.isVisible = true;
    }

    // Slugs are stored lower-case, so comparing the slug keeps this
    // case-insensitive without `mode: 'insensitive'` (unsupported on SQLite).
    if (category && category !== 'All') {
      whereClause.category = {
        OR: [
          { name: { equals: String(category) } },
          { slug: { equals: slugify(String(category)) } },
        ],
      };
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: String(search) } },
        { description: { contains: String(search) } },
      ];
    }

    if (sale === 'true' || sale === '1') {
      whereClause.salePrice = { not: null };
    }

    if (minPrice || maxPrice) {
      whereClause.price = {};
      if (minPrice) whereClause.price.gte = parseFloat(String(minPrice));
      if (maxPrice) whereClause.price.lte = parseFloat(String(maxPrice));
    }

    if (size || color) {
      whereClause.variants = {
        some: {
          ...(size && { size: { equals: String(size) } }),
          ...(color && { color: { contains: String(color) } }),
          quantity: { gt: 0 },
        },
      };
    }

    let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' };
    if (sort === 'price-asc') {
      orderBy = { price: 'asc' };
    } else if (sort === 'price-desc') {
      orderBy = { price: 'desc' };
    } else if (sort === 'newest') {
      orderBy = { createdAt: 'desc' };
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        category: true,
        images: {
          orderBy: { isPrimary: 'desc' },
        },
        variants: true,
      },
      orderBy,
    });

    return sendResponse(res, 200, true, 'Products fetched successfully', products.map(formatProduct));
  } catch (error) {
    next(error);
  }
});

app.get('/api/products/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = routeParam(req.params.id);
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        images: {
          orderBy: { isPrimary: 'desc' },
        },
        variants: true,
      },
    });

    if (!product) {
      return sendResponse(res, 404, false, 'Product not found');
    }

    return sendResponse(res, 200, true, 'Product fetched successfully', formatProduct(product));
  } catch (error) {
    next(error);
  }
});

app.post('/api/products', requireAdmin, async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const { name, description, price, salePrice, shippingPrice, categoryId, images, hoverImageUrl, details, shippingInfo, variants, isOutOfStock, isActive, isVisible } = req.body;

    if (!name || typeof name !== 'string' || price === undefined || !categoryId) {
      return sendResponse(res, 400, false, 'Name, price, and categoryId are required');
    }

    const payloadError = validateProductPayload({ images, variants });
    if (payloadError) {
      return sendResponse(res, 400, false, payloadError);
    }

    if (!(await categoryExists(String(categoryId)))) {
      return sendResponse(res, 400, false, `Category ${categoryId} does not exist`);
    }

    const numPrice = Number(price);
    const numSalePrice = salePrice !== undefined && salePrice !== '' && salePrice !== null ? Number(salePrice) : null;
    const numShippingPrice = shippingPrice !== undefined && shippingPrice !== '' && shippingPrice !== null ? Number(shippingPrice) : 0;

    if (isNaN(numPrice) || numPrice <= 0) {
      return sendResponse(res, 400, false, 'Regular price must be greater than 0');
    }

    if (numSalePrice !== null) {
      if (isNaN(numSalePrice) || numSalePrice < 0) {
        return sendResponse(res, 400, false, 'Sale price cannot be negative');
      }
      if (numSalePrice >= numPrice) {
        return sendResponse(res, 400, false, 'Sale price must be lower than regular price');
      }
    }

    if (isNaN(numShippingPrice) || numShippingPrice < 0) {
      return sendResponse(res, 400, false, 'Shipping price cannot be negative');
    }

    const slug = `${slugify(String(name))}-${Date.now().toString().slice(-4)}`;

    const product = await prisma.product.create({
      data: {
        name,
        slug,
        description: description || '',
        price: numPrice,
        salePrice: numSalePrice,
        shippingPrice: numShippingPrice,
        categoryId,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        isVisible: isVisible !== undefined ? Boolean(isVisible) : true,
        // The admin switch records intent; the effective flag below is derived
        // from the variant quantities that are created alongside the product.
        manualOutOfStock: isOutOfStock !== undefined ? Boolean(isOutOfStock) : false,
        isOutOfStock: isOutOfStock !== undefined ? Boolean(isOutOfStock) : false,
        hoverImageUrl: hoverImageUrl || null,
        details: details || null,
        shippingInfo: shippingInfo || null,
        images: {
          create: images && Array.isArray(images) && images.length > 0
            ? images.map((url: string, index: number) => ({
                imageUrl: url,
                isPrimary: index === 0,
              }))
            : [{ imageUrl: FALLBACK_IMAGE, isPrimary: true }],
        },
        variants: {
          create: variants && Array.isArray(variants) && variants.length > 0
            ? variants.map((v: { size: string; color: string; quantity: number }) => ({
                size: v.size,
                color: v.color,
                quantity: Number(v.quantity) || 0,
              }))
            : [{ size: 'M', color: 'Black', quantity: 10 }],
        },
      },
      include: { images: true, variants: true, category: true },
    });

    return sendResponse(res, 201, true, 'Product created successfully', formatProduct(product));
  } catch (error: unknown) {
    next(error);
  }
});

app.put('/api/products/:id', requireAdmin, async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const id = routeParam(req.params.id);
    const { name, description, price, salePrice, shippingPrice, categoryId, isActive, isVisible, isOutOfStock, images, hoverImageUrl, details, shippingInfo, variants } = req.body;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return sendResponse(res, 404, false, 'Product not found');
    }

    const payloadError = validateProductPayload({ images, variants });
    if (payloadError) {
      return sendResponse(res, 400, false, payloadError);
    }

    if (categoryId && !(await categoryExists(String(categoryId)))) {
      return sendResponse(res, 400, false, `Category ${categoryId} does not exist`);
    }

    const numPrice = price !== undefined ? Number(price) : existing.price;
    // Only touch salePrice when the client actually sent the field, otherwise a
    // partial update would silently clear an existing discount.
    const numSalePrice =
      salePrice === undefined ? existing.salePrice : salePrice === '' || salePrice === null ? null : Number(salePrice);
    // Only touch shippingPrice when the client actually sent the field.
    const numShippingPrice =
      shippingPrice === undefined ? existing.shippingPrice : shippingPrice === '' || shippingPrice === null ? 0 : Number(shippingPrice);

    if (price !== undefined && (isNaN(numPrice) || numPrice <= 0)) {
      return sendResponse(res, 400, false, 'Regular price must be greater than 0');
    }

    if (numSalePrice !== null) {
      if (isNaN(numSalePrice) || numSalePrice < 0) {
        return sendResponse(res, 400, false, 'Sale price cannot be negative');
      }
      if (numSalePrice >= numPrice) {
        return sendResponse(res, 400, false, 'Sale price must be lower than regular price');
      }
    }

    if (isNaN(numShippingPrice) || numShippingPrice < 0) {
      return sendResponse(res, 400, false, 'Shipping price cannot be negative');
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (images && Array.isArray(images)) {
        await tx.productImage.deleteMany({ where: { productId: id } });
        await tx.productImage.createMany({
          data: images.map((url: string, index: number) => ({
            productId: id,
            imageUrl: url,
            isPrimary: index === 0,
          })),
        });
      }

      if (variants && Array.isArray(variants)) {
        // Upsert instead of delete-and-recreate. Rebuilding the table would reset
        // every variant id on each save, invalidating anything referencing them.
        const desired = variants.map((v: { size: string; color: string; quantity: number }) => ({
          size: v.size,
          color: v.color,
          quantity: Math.max(0, Math.floor(Number(v.quantity) || 0)),
        }));
        const current = await tx.productVariant.findMany({ where: { productId: id } });

        for (const variant of current) {
          const kept = desired.some((d) => d.size === variant.size && d.color === variant.color);
          if (!kept) await tx.productVariant.delete({ where: { id: variant.id } });
        }

        for (const variant of desired) {
          const match = current.find((c) => c.size === variant.size && c.color === variant.color);
          if (match) {
            if (match.quantity !== variant.quantity) {
              await tx.productVariant.update({
                where: { id: match.id },
                data: { quantity: variant.quantity },
              });
            }
          } else {
            await tx.productVariant.create({ data: { productId: id, ...variant } });
          }
        }
      }

      // Recompute the effective out-of-stock flag from the new quantities.
      await syncOutOfStock(tx, id);

      return await tx.product.update({
        where: { id },
        data: {
          ...(name && { name }),
          // Keep the public URL in step with the product name.
          ...(name && name !== existing.name && {
            slug: `${slugify(String(name))}-${Date.now().toString().slice(-4)}`,
          }),
          ...(description !== undefined && { description }),
          ...(price !== undefined && { price: numPrice }),
          ...(salePrice !== undefined && { salePrice: numSalePrice }),
          ...(shippingPrice !== undefined && { shippingPrice: numShippingPrice }),
          ...(categoryId && { categoryId }),
          ...(isActive !== undefined && { isActive: Boolean(isActive) }),
          ...(isVisible !== undefined && { isVisible: Boolean(isVisible) }),
          // The manual switch is stored separately; the effective flag is derived.
          ...(isOutOfStock !== undefined && { manualOutOfStock: Boolean(isOutOfStock) }),
          ...(hoverImageUrl !== undefined && { hoverImageUrl: hoverImageUrl || null }),
          ...(details !== undefined && { details: details || null }),
          ...(shippingInfo !== undefined && { shippingInfo: shippingInfo || null }),
        },
        include: { images: true, variants: true, category: true },
      });
    });

    return sendResponse(res, 200, true, 'Product updated successfully', formatProduct(updated));
  } catch (error: unknown) {
    next(error);
  }
});

app.delete('/api/products/:id', requireAdmin, async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const id = routeParam(req.params.id);
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return sendResponse(res, 404, false, 'Product not found');
    }

    await prisma.product.delete({ where: { id } });
    return sendResponse(res, 200, true, 'Product deleted successfully');
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// ORDERS API & STOCK VALIDATION
// ----------------------------------------------------

app.get('/api/orders', requireAdmin, async (_req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const orders = await prisma.order.findMany({
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    return sendResponse(res, 200, true, 'Orders fetched successfully', orders);
  } catch (error) {
    next(error);
  }
});

app.get('/api/orders/:id', requireAdmin, async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const id = routeParam(req.params.id);
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) {
      return sendResponse(res, 404, false, 'Order not found');
    }
    return sendResponse(res, 200, true, 'Order fetched successfully', order);
  } catch (error) {
    next(error);
  }
});

/**
 * Checkout throttle.
 *
 * Generous enough that a burst from one shopper (or a shared office IP) never
 * trips it, while stopping a script from using the store as a mail relay.
 */
const ORDER_RATE_LIMIT = { windowMs: 60_000, max: 20, bucket: 'orders' };

app.post('/api/orders', rateLimit(ORDER_RATE_LIMIT), async (req: Request, res: Response) => {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      customerCity,
      customerAddress,
      customerPostalCode,
      customerNotes,
      paymentMethod,
      items,
    } = req.body;

    const customerError = validateOrderCustomer({
      customerName, customerEmail, customerPhone, customerCity,
      customerAddress, customerPostalCode, customerNotes,
    });
    if (customerError) {
      return sendResponse(res, 400, false, customerError);
    }

    const itemsError = validateOrderItems(items);
    if (itemsError) {
      return sendResponse(res, 400, false, itemsError);
    }

    // Cash on Delivery is the only payment method the store accepts. Card
    // payments were removed, so anything else is rejected outright rather than
    // silently downgraded.
    if (paymentMethod && paymentMethod !== PAYMENT_METHOD_CASH_ON_DELIVERY) {
      return sendResponse(res, 400, false, `Unsupported payment method. Supported: ${PAYMENT_METHOD_CASH_ON_DELIVERY}`);
    }
    const pMethod = PAYMENT_METHOD_CASH_ON_DELIVERY;

    const result = await prisma.$transaction(async (tx) => {
      let calculatedTotal = 0;
      const orderItemsData: Prisma.OrderItemUncheckedCreateWithoutOrderInput[] = [];

      for (const item of items) {
        const { productId, size, color, quantity } = item;
        // Already validated above; re-checked so the transaction can never
        // reserve stock from a payload that slipped past the entry check.
        if (!productId || !size || !color || !Number.isInteger(quantity) || quantity <= 0) {
          throw new Error('Invalid order item details');
        }

        // Atomic compare-and-set: stock can never be driven below zero, even if
        // two customers check out the last unit at the same moment.
        const reservation = await reserveStock(tx, { productId, size, color, quantity });

        const variant = await tx.productVariant.findUnique({
          where: { id: reservation.variantId },
          include: { product: true },
        });
        if (!variant) {
          throw new ProductUnavailableError('Product variant disappeared during checkout');
        }

        const salePrice = variant.product.salePrice;
        const unitPrice = salePrice !== null && salePrice < variant.product.price ? salePrice : variant.product.price;
        const totalPrice = unitPrice * quantity;
        calculatedTotal += totalPrice;

        orderItemsData.push({
          productId: variant.product.id,
          productName: variant.product.name,
          productImage: '',
          size,
          color,
          quantity,
          unitPrice,
          totalPrice,
        });
      }

      for (const orderItem of orderItemsData) {
        // productId is a nullable FK, so guard rather than assume it is present.
        const primaryImg = orderItem.productId
          ? await tx.productImage.findFirst({
              where: { productId: orderItem.productId, isPrimary: true },
            })
          : null;
        orderItem.productImage = primaryImg ? primaryImg.imageUrl : FALLBACK_IMAGE;
      }

      const shipping = calculateShipping(calculatedTotal);
      const finalTotal = calculatedTotal + shipping;

      const order = await tx.order.create({
        data: {
          customerName,
          customerEmail,
          customerPhone,
          customerCity,
          customerAddress,
          customerPostalCode: customerPostalCode || null,
          customerNotes: customerNotes || '',
          subtotalPrice: calculatedTotal,
          shippingPrice: shipping,
          totalPrice: finalTotal,
          status: 'PENDING',
          paymentMethod: pMethod,
          items: {
            create: orderItemsData,
          },
        },
        include: { items: true },
      });

      return order;
    });

    // Notify the store by email. Deliberately not awaited: the order is already
    // committed, so a slow or failing mail server must not delay or fail the
    // customer's checkout. Failures are logged inside the module.
    void sendOrderNotifications(result);

    return sendResponse(res, 201, true, 'Order created successfully and stock updated', result);
  } catch (error: unknown) {
    // A business rule (not enough stock, product hidden) is the shopper's to fix
    // and gets a 400 with a specific reason. Write contention is neither their
    // fault nor actionable, so it becomes a 503 asking them to retry.
    if (error instanceof InsufficientStockError || error instanceof ProductUnavailableError) {
      return sendResponse(res, 400, false, error.message);
    }
    if (isTransientDbError(error)) {
      console.warn('Checkout hit database contention:', errorMessage(error, ''));
      return sendResponse(res, 503, false, TRANSIENT_DB_MESSAGE);
    }
    console.error('Order creation failed:', error);
    return sendResponse(res, 500, false, publicErrorMessage(error, 'Failed to create order'));
  }
});

app.put('/api/orders/:id', requireAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const id = routeParam(req.params.id);
    const { status } = req.body;

    const validStatuses = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    if (!status || !validStatuses.includes(status)) {
      return sendResponse(res, 400, false, `Invalid order status. Supported: ${validStatuses.join(', ')}`);
    }

    const existing = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) {
      return sendResponse(res, 404, false, 'Order not found');
    }

    const wasCancelled = existing.status === 'CANCELLED';
    const willBeCancelled = status === 'CANCELLED';

    /**
     * Inventory follows the status transition, and only the transition:
     *
     *  - into CANCELLED  -> put the reserved units back
     *  - out of CANCELLED -> take them out again
     *  - anything else   -> leave stock alone
     *
     * Gating on the transition is what makes repeated status updates safe: an
     * order cannot be cancelled twice and refund stock twice.
     */
    let stockRestored = 0;
    let stockReReserved = false;

    const updatedOrder = await prisma.$transaction(async (tx) => {
      if (!wasCancelled && willBeCancelled) {
        stockRestored = await releaseStock(tx, existing.items);
      } else if (wasCancelled && !willBeCancelled) {
        await reReserveStock(tx, existing.items);
        stockReReserved = true;
      }

      return tx.order.update({
        where: { id },
        data: { status },
        include: { items: true },
      });
    });

    return sendResponse(
      res,
      200,
      true,
      stockRestored > 0
        ? `Order cancelled and ${stockRestored} unit(s) returned to stock`
        : stockReReserved
          ? 'Order reinstated and stock reserved again'
          : 'Order status updated successfully',
      updatedOrder
    );
  } catch (error: unknown) {
    // Reinstating an order whose stock has since sold must not half-apply.
    // Reinstatement can legitimately fail: the units this order once held may
    // have been sold to someone else while it sat cancelled. That is a stock
    // rule, so it explains itself with a 400 rather than a generic error.
    if (error instanceof InsufficientStockError || error instanceof ProductUnavailableError) {
      return sendResponse(res, 400, false, error.message);
    }
    if (isTransientDbError(error)) {
      return sendResponse(res, 503, false, TRANSIENT_DB_MESSAGE);
    }
    console.error('Order status update failed:', error);
    return sendResponse(res, 500, false, publicErrorMessage(error, 'Failed to update order status'));
  }
});

/**
 * Upload-specific failures.
 *
 * Multer rejects a disallowed type by passing an error out of the middleware,
 * so it arrives here rather than in the route's own try/catch. Without this,
 * a mistyped file turned into a 500 instead of a fixable 400.
 */
const uploadErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return sendResponse(res, 400, false, 'File size exceeds the maximum limit of 5MB.');
    }
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      return sendResponse(res, 400, false, 'Too many files. Upload up to 10 images at a time.');
    }
    return sendResponse(res, 400, false, `Upload failed: ${err.message}`);
  }
  if (err instanceof Error && /Invalid image format/.test(err.message)) {
    return sendResponse(res, 400, false, err.message);
  }
  next(err);
};
app.use(uploadErrorHandler);

// Contact form endpoint
app.post('/api/contact', async (req: Request, res: Response) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    // Basic validation
    if (!name || !email || !subject || !message) {
      return sendResponse(res, 400, false, 'Missing required fields');
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      return sendResponse(res, 400, false, 'Invalid email format');
    }

    if (message.length < 10) {
      return sendResponse(res, 400, false, 'Message must be at least 10 characters');
    }

    // Store in database
    await prisma.contactMessage.create({
      data: {
        name,
        email,
        phone: phone || null,
        subject,
        message,
        locale: req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'en',
      },
    });

    // TODO: Send notification email to store owner
    // This can be implemented using the existing email infrastructure

    return sendResponse(res, 201, true, 'Message sent successfully');
  } catch (error: unknown) {
    console.error('Contact form error:', error);
    return sendResponse(res, 500, false, 'Failed to send message. Please try again.');
  }
});

// Unknown /api routes must not fall through to the SPA or an HTML error page.
app.use('/api', (req: Request, res: Response) => {
  return sendResponse(res, 404, false, `Endpoint ${req.method} ${req.originalUrl} not found`);
});

// Centralized Error Handling
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled server error:', err);
  const transient = isTransientDbError(err);
  return sendResponse(
    res,
    transient ? 503 : 500,
    false,
    publicErrorMessage(err, 'Something went wrong. Please try again.')
  );
});

// Serve static frontend SPA
const distPath = path.join(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/.*/, (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    return res.sendFile(path.join(distPath, 'index.html'));
  });
}

async function startServer() {
  try {
    await configureDatabase();
    assertSigningSecretIsSafe();
    warnIfUnconfigured();

    app.listen(PORT, () => {
      console.log(`🚀 Backend API server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
