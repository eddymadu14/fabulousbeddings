'use server'

import { desc, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/lib/db'
import {
categories,
orders,
pageVisits,
productImages,
products,
} from '@/lib/db/schema'
import { requireOwner } from '@/lib/auth/require-owner'

import cloudinary from '@/lib/cloudinary'

export async function getOwnerProducts() {
const owner = await requireOwner()

if (!owner) {
throw new Error('Unauthorized')
}

return db
  .select({
    id: products.id,
    name: products.name,
    slug: products.slug,
    description: products.description,
    price: products.price,
    compareAtPrice: products.compareAtPrice,
    image: products.image,
    stock: products.stock,
    status: products.status,
    featured: products.featured,
    categoryId: products.categoryId,
    category: categories.name,
    createdBy: products.createdBy,
    createdAt: products.createdAt,
    updatedAt: products.updatedAt,
  })
  .from(products)
  .leftJoin(
    categories,
    eq(products.categoryId, categories.id),
  )
  .where(eq(products.createdBy, owner.id))
  .orderBy(desc(products.createdAt))
}


export async function addProduct(input: {
name: string
category: string
description: string
price: number
compareAtPrice?: number
stock: number
status: string
images: File[]
}) {
const owner = await requireOwner()

if (!owner) {
throw new Error('Unauthorized')
}

if (!input.images.length) {
throw new Error(
'At least one product image is required',
)
}

const categoryName = input.category.trim()

if (!categoryName) {
throw new Error('Product category is required')
}

const [category] = await db
.select({
id: categories.id,
})
.from(categories)
.where(eq(categories.name, categoryName))
.limit(1)

if (!category) {
throw new Error(
`Category "${categoryName}" was not found`,
)
}

const slug = input.name
.trim()
.toLowerCase()
.replace(/[^a-z0-9]+/g, '-')
.replace(/(^-|-$)/g, '')

if (!slug) {
throw new Error('Product name is invalid')
}

const uploadedImages: {
secureUrl: string
publicId: string
}[] = []

try {
/*
* Upload all images first.
*
* This allows us to know the primary image URL
* before creating the product because products.image
* is required by the current schema.
*/
for (const file of input.images) {
if (!file.type.startsWith('image/')) {
throw new Error(
"Invalid image file: ${file.name}",
)
}

  const MAX_FILE_SIZE = 5 * 1024 * 1024

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `${file.name} is larger than 5MB`,
    )
  }

  const buffer = Buffer.from(
    await file.arrayBuffer(),
  )

  const uploadResult =
    await new Promise<{
      secureUrl: string
      publicId: string
    }>((resolve, reject) => {
      const uploadStream =
        cloudinary.uploader.upload_stream(
          {
            folder: 'fabulous-beddings/products',
            resource_type: 'image',
          },
          (error, result) => {
            if (error || !result) {
              reject(
                error ??
                  new Error(
                    'Cloudinary upload failed',
                  ),
              )

              return
            }

            resolve({
              secureUrl: result.secure_url,
              publicId: result.public_id,
            })
          },
        )

      uploadStream.end(buffer)
    })

  uploadedImages.push(uploadResult)
}

const primaryImage = uploadedImages[0]

/*
 * Create the product using the first Cloudinary
 * image as the primary image.
 */
const [product] = await db
  .insert(products)
  .values({
    createdBy: owner.id,
    categoryId: category.id,
    name: input.name.trim(),
    slug,
    description: input.description.trim(),
    price: input.price,
    compareAtPrice:
      input.compareAtPrice ?? null,
    image: primaryImage.secureUrl,
    stock: input.stock,
    status: input.status,
  })
  .returning()

if (!product) {
  throw new Error(
    'Failed to create product',
  )
}

/*
 * Store every uploaded image in product_images.
 */
await db.insert(productImages).values(
  uploadedImages.map((image, index) => ({
    productId: product.id,
    url: image.secureUrl,
    publicId: image.publicId,
    sortOrder: index,
  })),
)

revalidatePath('/owner/products')
revalidatePath('/')

return product

} catch (error) {
/*
* If anything fails after Cloudinary uploads,
* remove every uploaded image so we don't leave
* orphaned files in Cloudinary.
*/
await Promise.all(
uploadedImages.map(async (image) => {
try {
await cloudinary.uploader.destroy(
image.publicId,
{
resource_type: 'image',
invalidate: true,
},
)
} catch (cleanupError) {
console.error(
"Failed to clean up Cloudinary image ${image.publicId}:",
cleanupError,
)
}
}),
)

throw error

}
}

export async function getOwnerAnalytics() {
const owner = await requireOwner()

if (!owner) {
throw new Error('Unauthorized')
}

const [
productCount,
orderCount,
fulfilledCount,
visitorCount,
recentOrders,
] = await Promise.all([
db
.select({
count: sql<number>`count(*)`,
})
.from(products)
.where(eq(products.createdBy, owner.id)),

db
  .select({
    count: sql<number>`count(*)`,
  })
  .from(orders),

db
  .select({
    count: sql<number>`count(*)`,
  })
  .from(orders)
  .where(eq(orders.status, 'fulfilled')),

db
  .select({
    count: sql<number>`count(*)`,
  })
  .from(pageVisits),

db
  .select()
  .from(orders)
  .orderBy(desc(orders.createdAt))
  .limit(6),

])

return {
productCount: Number(
productCount[0]?.count ?? 0,
),

orderCount: Number(
  orderCount[0]?.count ?? 0,
),

fulfilledCount: Number(
  fulfilledCount[0]?.count ?? 0,
),

visitorCount: Number(
  visitorCount[0]?.count ?? 0,
),

recentOrders,

}
}


export async function getOwnerCategories() {
  const owner = await requireOwner()

  if (!owner) {
    throw new Error('Unauthorized')
  }

  return db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
    })
    .from(categories)
    .where(eq(categories.active, true))
    .orderBy(categories.name)
}