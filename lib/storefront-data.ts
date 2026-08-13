import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  categories as categoriesTable,
  productImages,
  productVariants,
  products as productsTable,
} from '@/lib/db/schema'
import type { Product } from '@/lib/store-data'

/**
 * Converts database products into the existing
 * storefront Product shape.
 *
 * This is the boundary between the database
 * and the existing storefront logic.
 */
export async function getStoreProducts(): Promise<Product[]> {
  const rows = await db
    .select({
      product: productsTable,
      category: categoriesTable,
      image: productImages,
      variant: productVariants,
    })
    .from(productsTable)
    .leftJoin(
      categoriesTable,
      eq(productsTable.categoryId, categoriesTable.id),
    )
    .leftJoin(
      productImages,
      eq(productsTable.id, productImages.productId),
    )
    .leftJoin(
      productVariants,
      and(
        eq(productsTable.id, productVariants.productId),
        eq(productVariants.active, true),
      ),
    )
    .where(eq(productsTable.status, 'published'))
    .orderBy(
      asc(productsTable.createdAt),
      asc(productImages.sortOrder),
      asc(productVariants.id),
    )

  const productMap = new Map<number, Product>()

  for (const row of rows) {
    const product = row.product

    if (!productMap.has(product.id)) {
      const firstImage = row.image?.url ?? product.image

      productMap.set(product.id, {
        id: String(product.id),
        name: product.name,

        category: row.category?.name ?? '',

        price: product.price,

        compareAt:
          product.compareAtPrice ?? undefined,

        image: firstImage,

        badge: product.featured
          ? 'Featured'
          : undefined,

        rating: 0,

        reviews: 0,

        description: product.description,

        sizes: [],

        colors: [],

        material: '',

        featured: product.featured,
      })
    }

    const current = productMap.get(product.id)!

    /*
     * If the product has images, use the first
     * ordered image as the storefront image.
     */
    if (
      row.image &&
      !current.image
    ) {
      current.image = row.image.url
    }

    /*
     * Existing storefront Product expects sizes.
     *
     * If your variant names represent sizes,
     * they are mapped here.
     */
    if (
      row.variant &&
      !current.sizes.includes(row.variant.name)
    ) {
      current.sizes.push(row.variant.name)
    }
  }

  return Array.from(productMap.values())
}