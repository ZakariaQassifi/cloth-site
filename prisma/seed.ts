/**
 * Database seed.
 *
 * Reads the catalog snapshot in `prisma/fixtures/catalog.json` and rebuilds the
 * database from it. The seed is intentionally self-contained: it never imports
 * frontend modules, so the storefront and the database cannot drift apart.
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
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@kinetic.com').toLowerCase();
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
  console.log('Starting database seeding...');
  const catalog = loadCatalog();

  // Order matters: children before parents, because foreign keys restrict deletes.
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  const categoryIds = new Map<string, string>();
  for (const category of catalog.categories) {
    const created = await prisma.category.create({
      data: {
        name: category.name,
        slug: category.slug || slugify(category.name),
        description: category.description,
        imageUrl: category.imageUrl,
        hoverImageUrl: category.hoverImageUrl,
        displayOrder: category.displayOrder,
      },
    });
    categoryIds.set(created.name, created.id);
  }
  console.log(`Created ${categoryIds.size} categories`);

  for (const product of catalog.products) {
    // The unique (productId, size, color) index rejects duplicate variants, so
    // collapse any repeats in the fixture before writing.
    const variantMap = new Map<string, FixtureVariant>();
    for (const variant of product.variants) {
      const key = `${variant.size}::${variant.color}`;
      const existing = variantMap.get(key);
      variantMap.set(key, existing
        ? { ...variant, quantity: existing.quantity + Number(variant.quantity || 0) }
        : { ...variant, quantity: Number(variant.quantity) || 0 });
    }

    const created = await prisma.product.create({
      data: {
        name: product.name,
        slug: `${slugify(product.name)}-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 90 + 10)}`,
        description: product.description,
        price: product.price,
        salePrice: product.salePrice,
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

  // Staff account for the dashboard. Stored as a bcrypt digest, never plain text.
  const existingAdmin = await prisma.adminUser.findUnique({ where: { email: ADMIN_EMAIL } });
  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  if (existingAdmin) {
    await prisma.adminUser.update({
      where: { email: ADMIN_EMAIL },
      data: { passwordHash, name: ADMIN_NAME },
    });
    console.log(`Updated admin account: ${ADMIN_EMAIL}`);
  } else {
    await prisma.adminUser.create({
      data: { email: ADMIN_EMAIL, passwordHash, name: ADMIN_NAME },
    });
    console.log(`Created admin account: ${ADMIN_EMAIL}`);
  }

  console.log(`Seeding completed: ${catalog.products.length} products.`);
}

main()
  .catch((error) => {
    console.error('Error during database seeding:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });