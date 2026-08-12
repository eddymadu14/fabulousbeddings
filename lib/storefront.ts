import { and, asc, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  categories,
  productImages,
  products,
  productVariants,
} from '@/lib/db/schema'

type ProductRow = {
  id: number
  name: string
  slug: string
  description: string
  price: number
  compareAtPrice: number | null
  stock: number
  status: string
  featured: boolean
  categoryId: number

  categoryName: string | null

  imageId: number | null
  imageUrl: string | null
  imagePublicId: string | null
  imageSortOrder: number | null

  variantId: number | null
  variantName: string | null
  variantPrice: number | null
  variantStock: number | null
  variantActive: boolean | null
}

export type StorefrontProduct = {
  id: number
  name: string
  slug: string
  description: string
  price: number
  compareAtPrice: number | null
  stock: number
  status: string
  featured: boolean
  categoryId: number
  categoryName: string | null

  images: {
    id: number
    url: string
    publicId: string | null
    sortOrder: number
  }[]

  variants: {
    id: number
    name: string
    price: number
    stock: number
    active: boolean
  }[]
}

/**
 * Fetch the raw published product rows from the database.
 *
 * Because products can have multiple images and variants,
 * the query can return multiple rows for the same product.
 * normalizeProducts() converts those rows into one product
 * object containing images[] and variants[].
 */
async function getPublishedProductsRows(): Promise<ProductRow[]> {
  return db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      description: products.description,
      price: products.price,
      compareAtPrice: products.compareAtPrice,
      stock: products.stock,
      status: products.status,
      featured: products.featured,
      categoryId: products.categoryId,

      categoryName: categories.name,

      imageId: productImages.id,
      imageUrl: productImages.url,
      imagePublicId: productImages.publicId,
      imageSortOrder: productImages.sortOrder,

      variantId: productVariants.id,
      variantName: productVariants.name,
      variantPrice: productVariants.price,
      variantStock: productVariants.stock,
      variantActive: productVariants.active,
    })
    .from(products)
    .leftJoin(
      categories,
      eq(products.categoryId, categories.id),
    )
    .leftJoin(
      productImages,
      eq(productImages.productId, products.id),
    )
    .leftJoin(
      productVariants,
      eq(productVariants.productId, products.id),
    )
    .where(
      eq(products.status, 'published'),
    )
    .orderBy(
      asc(products.id),
      asc(productImages.sortOrder),
      asc(productVariants.id),
    )
}

/**
 * Convert the joined database rows into the clean
 * product structure consumed by the storefront.
 */
function normalizeProducts(
  rows: ProductRow[],
): StorefrontProduct[] {
  const productMap = new Map<
    number,
    StorefrontProduct
  >()

  for (const row of rows) {
    let product = productMap.get(row.id)

    if (!product) {
      product = {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        price: row.price,
        compareAtPrice: row.compareAtPrice,
        stock: row.stock,
        status: row.status,
        featured: row.featured,
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        images: [],
        variants: [],
      }

      productMap.set(row.id, product)
    }

    if (
      row.imageId !== null &&
      row.imageUrl !== null &&
      !product.images.some(
        (image) => image.id === row.imageId,
      )
    ) {
      product.images.push({
        id: row.imageId,
        url: row.imageUrl,
        publicId: row.imagePublicId,
        sortOrder: row.imageSortOrder ?? 0,
      })
    }

    if (
      row.variantId !== null &&
      row.variantName !== null &&
      row.variantPrice !== null &&
      row.variantStock !== null &&
      row.variantActive !== null &&
      !product.variants.some(
        (variant) => variant.id === row.variantId,
      )
    ) {
      product.variants.push({
        id: row.variantId,
        name: row.variantName,
        price: row.variantPrice,
        stock: row.variantStock,
        active: row.variantActive,
      })
    }
  }

  return Array.from(productMap.values())
}

/**
 * Return all published products in storefront-ready format.
 */
export async function getPublishedProducts(): Promise<
  StorefrontProduct[]
> {
  const rows = await getPublishedProductsRows()

  return normalizeProducts(rows)
}

/**
 * Return only published products marked as featured.
 */
export async function getFeaturedProducts(): Promise<
  StorefrontProduct[]
> {
  const products = await getPublishedProducts()

  return products.filter(
    (product) => product.featured,
  )
}

/**
 * Find one published product by its slug.
 */
export async function getPublishedProductBySlug(
  slug: string,
): Promise<StorefrontProduct | null> {
  const products = await getPublishedProducts()

  return (
    products.find(
      (product) => product.slug === slug,
    ) ?? null
  )
}

/**
 * Return published products belonging to a category.
 */
export async function getPublishedProductsByCategory(
  categoryId: number,
): Promise<StorefrontProduct[]> {
  const products = await getPublishedProducts()

  return products.filter(
    (product) =>
      product.categoryId === categoryId,
  )
}

/**
 * Return active categories that have at least one
 * published product.
 */
export async function getStorefrontCategories() {
  const publishedProducts =
    await getPublishedProducts()

  const categoryIds = new Set(
    publishedProducts.map(
      (product) => product.categoryId,
    ),
  )

  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
    })
    .from(categories)
    .orderBy(asc(categories.name))

  return rows.filter((category) =>
    categoryIds.has(category.id),
  )
}