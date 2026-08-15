import { and, asc, eq, count } from 'drizzle-orm'

import { db } from '@/lib/db'

import {
  categories,
  productImages,
  productVariants,
  products,
} from '@/lib/db/schema'

import type {
  Product,
  StorefrontCategory,
} from '@/lib/store-data'

type PublishedProductRow = {
  product: typeof products.$inferSelect
  category: typeof categories.$inferSelect | null
  image: typeof productImages.$inferSelect | null
  variant: typeof productVariants.$inferSelect | null
}

/* ============================================================
   DISPLAY HELPERS
   ============================================================ */

function seededNumber(seed: number): number {
  const value =
    Math.sin(seed * 12.9898) * 43758.5453

  return value - Math.floor(value)
}

function getProductRating(productId: number): number {
  const random = seededNumber(productId)

  return Number(
    (4.3 + random * 0.7).toFixed(1),
  )
}

function getProductReviews(productId: number): number {
  const random = seededNumber(productId + 7919)

  return Math.floor(40 + random * 41)
}

/*
 * IMPORTANT:
 *
 * These ratings/reviews are currently generated because your
 * database does not yet have product reviews/rating fields.
 *
 * When reviews are implemented, replace these functions with
 * actual database values.
 */

/* ============================================================
   COLOUR HANDLING
   ============================================================ */

const COLOR_MAP: Record<string, string> = {
  black: '#000000',
  white: '#FFFFFF',
  cream: '#FFFDD0',
  ivory: '#FFFFF0',
  beige: '#F5F5DC',
  brown: '#8B4513',
  chocolate: '#7B3F00',
  tan: '#D2B48C',
  nude: '#E3BC9A',

  pink: '#FFC0CB',
  blush: '#DE5D83',
  rose: '#FF007F',

  red: '#FF0000',
  burgundy: '#800020',
  maroon: '#800000',

  orange: '#FFA500',
  peach: '#FFE5B4',
  yellow: '#FFFF00',
  gold: '#D4AF37',

  green: '#008000',
  olive: '#808000',
  mint: '#98FF98',

  blue: '#0000FF',
  navy: '#000080',
  sky: '#87CEEB',

  teal: '#008080',
  turquoise: '#40E0D0',

  purple: '#800080',
  violet: '#8F00FF',
  lavender: '#E6E6FA',

  grey: '#808080',
  gray: '#808080',
  silver: '#C0C0C0',
  charcoal: '#36454F',

  creamwhite: '#FFFDD0',
}

function normalizeColourName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[-_/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getColourFromVariantName(
  variantName: string,
): {
  name: string
  value: string
} | null {
  const normalized =
    normalizeColourName(variantName)

  const colourEntries = Object.entries(
    COLOR_MAP,
  ).sort(
    ([a], [b]) => b.length - a.length,
  )

  for (const [
    colourName,
    colourValue,
  ] of colourEntries) {
    const normalizedColour =
      normalizeColourName(colourName)

    if (
      normalized === normalizedColour ||
      normalized.includes(normalizedColour)
    ) {
      return {
        name: colourName,
        value: colourValue,
      }
    }
  }

  return null
}

function getVariantSizes(
  variants: typeof productVariants.$inferSelect[],
): string[] {
  const sizes: string[] = []

  for (const variant of variants) {
    const colour =
      getColourFromVariantName(variant.name)

    /*
     * If this variant is actually a colour,
     * don't treat it as a size.
     */
    if (colour) {
      continue
    }

    if (!sizes.includes(variant.name)) {
      sizes.push(variant.name)
    }
  }

  return sizes
}

function getVariantColours(
  variants: typeof productVariants.$inferSelect[],
): string[] {
  const colours: string[] = []

  for (const variant of variants) {
    const colour =
      getColourFromVariantName(variant.name)

    if (!colour) {
      continue
    }

    const value =
      `${colour.name}:${colour.value}`

    if (!colours.includes(value)) {
      colours.push(value)
    }
  }

  return colours
}

/* ============================================================
   PRODUCT NORMALIZATION
   ============================================================ */

function normalizeProduct(
  product: typeof products.$inferSelect,
  category: typeof categories.$inferSelect | null,
  images: typeof productImages.$inferSelect[],
  variants: typeof productVariants.$inferSelect[],
): Product {
  const activeVariants =
    variants.filter(
      (variant) => variant.active,
    )

  const sortedImages =
    [...images].sort(
      (a, b) =>
        a.sortOrder - b.sortOrder,
    )

  const variantPrices =
    activeVariants.map(
      (variant) => variant.price,
    )

  const displayPrice =
    variantPrices.length > 0
      ? Math.min(...variantPrices)
      : product.price

      
const normalizedVariants =
  activeVariants.map(
    (variant) => ({
      id: variant.id,
      name: variant.name,
      price: variant.price,
      stock: variant.stock,
    }),
  )

  return {
    id: String(product.id),

    name: product.name,

    category:
      category?.name ?? 'Uncategorized',

    price: displayPrice,

    compareAt:
      product.compareAtPrice ??
      undefined,

    image:
      sortedImages[0]?.url ??
      product.image,

    rating:
      getProductRating(product.id),

    reviews:
      getProductReviews(product.id),

    description:
      product.description,

    sizes:
      getVariantSizes(activeVariants),

    colors:
      getVariantColours(activeVariants),

    /*
     * Your database currently doesn't contain
     * a material column.
     */
    variants: normalizedVariants,

    material: 'Premium bedding',

    featured:
      product.featured,

    /*
     * Badge is currently not stored in the database.
     *
     * We intentionally do not invent one.
     */
    badge: undefined,
  }
}

/* ============================================================
   PRODUCT ROW QUERY
   ============================================================ */

async function getPublishedProductRows(): Promise<
  PublishedProductRow[]
> {
  return db
    .select({
      product: products,
      category: categories,
      image: productImages,
      variant: productVariants,
    })

    .from(products)

    .leftJoin(
      categories,
      eq(
        products.categoryId,
        categories.id,
      ),
    )

    .leftJoin(
      productImages,
      eq(
        products.id,
        productImages.productId,
      ),
    )

    .leftJoin(
      productVariants,
      and(
        eq(
          products.id,
          productVariants.productId,
        ),
        eq(
          productVariants.active,
          true,
        ),
      ),
    )

    .where(
      eq(
        products.status,
        'published',
      ),
    )

    .orderBy(
      asc(products.id),
      asc(productImages.sortOrder),
      asc(productVariants.id),
    )
}

/* ============================================================
   NORMALIZE MULTIPLE PRODUCT ROWS
   ============================================================ */

function normalizeProductRows(
  rows: PublishedProductRow[],
): Product[] {
  const productMap = new Map<
    number,
    {
      product: typeof products.$inferSelect
      category:
        | typeof categories.$inferSelect
        | null
      images:
        typeof productImages.$inferSelect[]
      variants:
        typeof productVariants.$inferSelect[]
    }
  >()

  for (const row of rows) {
    const productId =
      row.product.id

    let entry =
      productMap.get(productId)

    if (!entry) {
      entry = {
        product: row.product,

        category:
          row.category,

        images: [],

        variants: [],
      }

      productMap.set(
        productId,
        entry,
      )
    }

    if (
      row.image &&
      !entry.images.some(
        (image) =>
          image.id === row.image!.id,
      )
    ) {
      entry.images.push(
        row.image,
      )
    }

    if (
      row.variant &&
      !entry.variants.some(
        (variant) =>
          variant.id ===
          row.variant!.id,
      )
    ) {
      entry.variants.push(
        row.variant,
      )
    }
  }

  return Array.from(
    productMap.values(),
  ).map(
    ({
      product,
      category,
      images,
      variants,
    }) =>
      normalizeProduct(
        product,
        category,
        images,
        variants,
      ),
  )
}

/* ============================================================
   PUBLIC PRODUCT FUNCTIONS
   ============================================================ */

export async function getPublishedProducts(): Promise<Product[]> {
  const rows =
    await getPublishedProductRows()

  return normalizeProductRows(rows)
}

export async function getFeaturedProducts(): Promise<Product[]> {
  const products =
    await getPublishedProducts()

  return products.filter(
    (product) =>
      product.featured,
  )
}

export async function getPublishedProductsByCategory(
  categoryId: number,
): Promise<Product[]> {
  const rows = await db
    .select({
      product: products,
      category: categories,
      image: productImages,
      variant: productVariants,
    })

    .from(products)

    .innerJoin(
      categories,
      eq(
        products.categoryId,
        categories.id,
      ),
    )

    .leftJoin(
      productImages,
      eq(
        products.id,
        productImages.productId,
      ),
    )

    .leftJoin(
      productVariants,
      and(
        eq(
          products.id,
          productVariants.productId,
        ),
        eq(
          productVariants.active,
          true,
        ),
      ),
    )

    .where(
      and(
        eq(
          products.status,
          'published',
        ),
        eq(
          products.categoryId,
          categoryId,
        ),
      ),
    )

    .orderBy(
      asc(productImages.sortOrder),
      asc(productVariants.id),
    )

  return normalizeProductRows(rows)
}

export async function getPublishedProduct(
  id: string,
): Promise<Product | null> {
  const numericId =
    Number(id)

  if (
    !Number.isInteger(
      numericId,
    )
  ) {
    return null
  }

  const rows = await db
    .select({
      product: products,
      category: categories,
      image: productImages,
      variant: productVariants,
    })

    .from(products)

    .leftJoin(
      categories,
      eq(
        products.categoryId,
        categories.id,
      ),
    )

    .leftJoin(
      productImages,
      eq(
        products.id,
        productImages.productId,
      ),
    )

    .leftJoin(
      productVariants,
      and(
        eq(
          products.id,
          productVariants.productId,
        ),
        eq(
          productVariants.active,
          true,
        ),
      ),
    )

    .where(
      and(
        eq(
          products.id,
          numericId,
        ),
        eq(
          products.status,
          'published',
        ),
      ),
    )

    .orderBy(
      asc(productImages.sortOrder),
      asc(productVariants.id),
    )

  if (rows.length === 0) {
    return null
  }

  const first = rows[0]

  const images:
    typeof productImages.$inferSelect[] =
    []

  const variants:
    typeof productVariants.$inferSelect[] =
    []

  for (const row of rows) {
    if (
      row.image &&
      !images.some(
        (image) =>
          image.id ===
          row.image!.id,
      )
    ) {
      images.push(
        row.image,
      )
    }

    if (
      row.variant &&
      !variants.some(
        (variant) =>
          variant.id ===
          row.variant!.id,
      )
    ) {
      variants.push(
        row.variant,
      )
    }
  }

  return normalizeProduct(
    first.product,
    first.category,
    images,
    variants,
  )
}

/* ============================================================
   CATEGORIES
   ============================================================ */

export async function getPublishedCategories(): Promise<
  StorefrontCategory[]
> {
  const rows = await db
    .select({
      category: categories,
      productCount: count(
        products.id,
      ),
    })

    .from(categories)

    .leftJoin(
      products,
      and(
        eq(
          products.categoryId,
          categories.id,
        ),
        eq(
          products.status,
          'published',
        ),
      ),
    )

    .where(
      eq(
        categories.active,
        true,
      ),
    )

    .groupBy(
      categories.id,
    )

    .orderBy(
      asc(categories.id),
    )

  return rows.map(
    ({
      category,
      productCount,
    }) => ({
      id: category.id,

      name: category.name,

      slug: category.slug,

      image:
        category.image ??
        '/placeholder-category.jpg',

      count:
        `${productCount} ${
          productCount === 1
            ? 'piece'
            : 'pieces'
        }`,
    }),
  )
}