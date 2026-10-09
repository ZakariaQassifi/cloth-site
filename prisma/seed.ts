/**
 * Database seed.
 *
 * Reads the catalog snapshot in `prisma/fixtures/catalog.json` and rebuilds the
 * database from it. The seed is intentionally self-contained: it never imports
 * storefront modules, so the storefront and the database cannot drift apart.
 *
 * Usage: npm run db:seed   (destructive — replaces all catalog data)
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../server/adminPassword';

const prisma = new PrismaClient();

/**
 * Credentials for the staff account created by the seed.
 *
 * Defaults exist so a fresh clone can sign in, but they are development-only:
 * set ADMIN_EMAIL and ADMIN_PASSWORD before seeding any shared database. The
 * password is hashed here and only the digest is stored.
 */
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@kinetic.com').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Store Administrator';

interface FixtureVariant {
  size: string;
  color: string;
  quantity: number;
}

interface FixtureProduct {
  name: string;
  description: string;
  price: number;
  salePrice: number | null;
  shippingPrice: number;
  category: string;
  images: string[];
  variants: FixtureVariant[];
}

interface FixtureCategory {
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  hoverImageUrl: string | null;
  displayOrder: number;
}

interface CatalogFixture {
  categories: FixtureCategory[];
  products: FixtureProduct[];
}

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

function loadCatalog(): CatalogFixture {
  const fixturePath = path.join(process.cwd(), 'prisma', 'fixtures', 'catalog.json');
  const catalog: CatalogFixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
  if (!Array.isArray(catalog.products) || catalog.products.length === 0) {
    throw new Error(`No products found in ${fixturePath}`);
  }
  return catalog;
}

async function main() {
  const force = process.argv.includes('--force');
  console.log(`Starting database seed check (force=${force})...`);

  // Force creation or updating of the Admin account with the fresh password hash
  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  
  const admin = await prisma.adminUser.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      passwordHash,
      name: ADMIN_NAME,
      role: 'ADMIN',
    },
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      name: ADMIN_NAME,
      role: 'ADMIN',
    },
  });

  console.log(`✅ Admin account configured/updated: ${admin.email}`);

  const existingCount = await prisma.product.count();
  if (existingCount > 0 && !force) {
    console.log(
      `Database already contains ${existingCount} products. Skipping catalog re-seeding to preserve data.`
    );
    return;
  }

  if (force) {
    console.warn('⚠️  Force re-seed requested. Clearing catalog tables (preserving users and orders)...');
    await prisma.productVariant.deleteMany();
    await prisma.productImage.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
  }

  console.log('Seeding catalog from fixtures...');
  const catalog = loadCatalog();

  const categoryIds = new Map<string, string>();
  for (const category of catalog.categories) {
    const slug = category.slug || slugify(category.name);
    let categoryRecord = await prisma.category.findUnique({ where: { slug } });
    if (!categoryRecord) {
      categoryRecord = await prisma.category.create({
        data: {
          name: category.name,
          slug,
          description: category.description,
          imageUrl: category.imageUrl,
          hoverImageUrl: category.hoverImageUrl,
          displayOrder: category.displayOrder,
        },
      });
    }
    categoryIds.set(category.name, categoryRecord.id);
  }
  console.log(`Categories ready (${categoryIds.size})`);

  for (const product of catalog.products) {
    const variantMap = new Map<string, FixtureVariant>();
    for (const variant of product.variants) {
      const key = `${variant.size}::${variant.color}`;
      const existing = variantMap.get(key);
      variantMap.set(
        key,
        existing
          ? { ...variant, quantity: existing.quantity + Number(variant.quantity || 0) }
          : { ...variant, quantity: Number(variant.quantity) || 0 }
      );
    }

    const created = await prisma.product.create({
      data: {
        name: product.name,
        slug: `${slugify(product.name)}-${Date.now().toString().slice(-4)}-${Math.floor(
          Math.random() * 90 + 10
        )}`,
        description: product.description,
        price: product.price,
        salePrice: product.salePrice,
        shippingPrice: product.shippingPrice,
        categoryId: categoryIds.get(product.category) ?? Array.from(categoryIds.values())[0],
        isActive: true,
        isVisible: true,
        isOutOfStock: false,
        images: {
          create: product.images.map((imageUrl, index) => ({ imageUrl, isPrimary: index === 0 })),
        },
        variants: {
          create: Array.from(variantMap.values()),
        },
      },
    });
    console.log(`Created product: ${created.name} (${variantMap.size} variants)`);
  }

  console.log(`Seeding completed: ${catalog.products.length} products processed.`);
}

main()
  .catch((error) => {
    console.error('Error during database seeding:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });