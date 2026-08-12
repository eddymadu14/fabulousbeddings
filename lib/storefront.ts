import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  categories,
  productImages,
  productVariants,
  products,
} from '@/lib/db/schema'
import type { Product } from '@/lib/store-data'

type PublishedProductRow = {
  product: typeof products.$inferSelect
  category: typeof categories.$inferSelect | null
  image: typeof productImages.$inferSelect | null
  variant: typeof productVariants.$inferSelect | null
}

/**
 * Creates a deterministic pseudo-random number from a product id.
 *
 * This means the same product keeps the same rating/review values
 * between renders instead of changing every time the page loads.
 */
function seededNumber(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453

  return value - Math.floor(value)
}

function getProductRating(productId: number): number {
  const random = seededNumber(productId)

  return Number((4.3 + random * 0.7).toFixed(1))
}

function getProductReviews(productId: number): number {
  const random = seededNumber(productId + 7919)

  return Math.floor(40 + random * 41)
}

/**
 * Recognized storefront colours.
 *
 * The database currently stores variant names as free-form text,
 * so we inspect the variant name and identify colour names when
 * possible.
 */
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
  const normalized = normalizeColourName(variantName)

  /*
   * Check longer colour names first.
   * This prevents "cream" from being selected before
   * something like "cream white".
   */
  const colourEntries = Object.entries(COLOR_MAP).sort(
    ([a], [b]) => b.length - a.length,
  )

  for (const [colourName, colourValue] of colourEntries) {
    const normalizedColour = normalizeColourName(colourName)

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
  const sizeVariants: string[] = []

  for (const variant of variants) {
    const colour = getColourFromVariantName(variant.name)

    /*
     * If the entire variant is a recognized colour, don't also
     * display it as a size.
     */
    if (colour) {
      continue
    }

    if (!sizeVariants.includes(variant.name)) {
      sizeVariants.push(variant.name)
    }
  }

  return sizeVariants
}

function getVariantColours(
  variants: typeof productVariants.$inferSelect[],
): string[] {
  const colours: string[] = []

  for (const variant of variants) {
    const colour = getColourFromVariantName(variant.name)

    if (!colour) {
      continue
    }

    /*
     * The existing Product interface expects colour strings.
     *
     * We store:
     *   colour name + colour grade
     *
     * Example:
     *   "black:#000000"
     */
    const value = `${colour.name}:${colour.value}`

    if (!colours.includes(value)) {
      colours.push(value)
    }
  }

  return colours
}

function normalizeProduct(
  product: typeof products.$inferSelect,
  category: typeof categories.$inferSelect | null,
  images: typeof productImages.$inferSelect[],
  variants: typeof productVariants.$inferSelect[],
): Product {
  const activeVariants = variants.filter(
    (variant) => variant.active,
  )

  const sortedImages = [...images].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )

  const variantPrices = activeVariants.map(
    (variant) => variant.price,
  )

  const displayPrice =
    variantPrices.length > 0
      ? Math.min(...variantPrices)
      : product.price

  return {
    id: String(product.id),

    name: product.name,

    category: category?.name ?? 'Accessories',

    price: displayPrice,

    compareAt:
      product.compareAtPrice !== null
        ? product.compareAtPrice
        : undefined,

    image:
      sortedImages[0]?.url ??
      product.image,

    /*
     * Demo/display ratings requested for the storefront.
     *
     * They are deterministic per product, so they won't jump
     * around every time the page renders.
     */
    rating: getProductRating(product.id),

    reviews: getProductReviews(product.id),

    description: product.description,

    sizes: getVariantSizes(activeVariants),

    colors: getVariantColours(activeVariants),

    material: 'Premium bedding',

    featured: product.featured,

    badge: undefined,
  }
}

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
      eq(products.categoryId, categories.id),
    )
    .leftJoin(
      productImages,
      eq(products.id, productImages.productId),
    )
    .leftJoin(
      productVariants,
      and(
        eq(products.id, productVariants.productId),
        eq(productVariants.active, true),
      ),
    )
    .where(eq(products.status, 'published'))
    .orderBy(
      asc(products.id),
      asc(productImages.sortOrder),
      asc(productVariants.id),
    )
}

export async function getPublishedProducts(): Promise<Product[]> {
  const rows = await getPublishedProductRows()

  const productMap = new Map<
    number,
    {
      product: typeof products.$inferSelect
      category: typeof categories.$inferSelect | null
      images: typeof productImages.$inferSelect[]
      variants: typeof productVariants.$inferSelect[]
    }
  >()

  for (const row of rows) {
    const productId = row.product.id

    let entry = productMap.get(productId)

    if (!entry) {
      entry = {
        product: row.product,
        category: row.category,
        images: [],
        variants: [],
      }

      productMap.set(productId, entry)
    }

    if (
      row.image &&
      !entry.images.some(
        (image) => image.id === row.image!.id,
      )
    ) {
      entry.images.push(row.image)
    }

    if (
      row.variant &&
      !entry.variants.some(
        (variant) => variant.id === row.variant!.id,
      )
    ) {
      entry.variants.push(row.variant)
    }
  }

  return Array.from(productMap.values()).map(
    ({ product, category, images, variants }) =>
      normalizeProduct(
        product,
        category,
        images,
        variants,
      ),
  )
}

export async function getPublishedProduct(
  id: string,
): Promise<Product | null> {
  const numericId = Number(id)

  if (!Number.isInteger(numericId)) {
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
      eq(products.categoryId, categories.id),
    )
    .leftJoin(
      productImages,
      eq(products.id, productImages.productId),
    )
    .leftJoin(
      productVariants,
      and(
        eq(products.id, productVariants.productId),
        eq(productVariants.active, true),
      ),
    )
    .where(
      and(
        eq(products.id, numericId),
        eq(products.status, 'published'),
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

  const images: typeof productImages.$inferSelect[] = []
  const variants: typeof productVariants.$inferSelect[] = []

  for (const row of rows) {
    if (
      row.image &&
      !images.some(
        (image) => image.id === row.image!.id,
      )
    ) {
      images.push(row.image)
    }

    if (
      row.variant &&
      !variants.some(
        (variant) => variant.id === row.variant!.id,
      )
    ) {
      variants.push(row.variant)
    }
  }

  return normalizeProduct(
    first.product,
    first.category,
    images,
    variants,
  )
}

export async function getFeaturedProducts(): Promise<Product[]> {
  const products = await getPublishedProducts()

  return products.filter((product) => product.featured)
}