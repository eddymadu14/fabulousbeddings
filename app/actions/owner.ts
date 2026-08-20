'use server'

import { desc, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/lib/db'
import {
categories,
orders,
pageVisits,
productImages,
productVariants,
products,
} from '@/lib/db/schema'
import { requireOwner } from '@/lib/auth/require-owner'

import cloudinary from '@/lib/cloudinary'




export async function getOwnerProducts() {
  const owner = await requireOwner()

  if (!owner) {
    throw new Error('Unauthorized')
  }

  const items = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      description: products.description,
      price: products.price,
      compareAtPrice:
        products.compareAtPrice,
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
      eq(
        products.categoryId,
        categories.id,
      ),
    )
    .where(
      eq(
        products.createdBy,
        owner.id,
      ),
    )
    .orderBy(
      desc(products.createdAt),
    )

  if (!items.length) {
    return []
  }

  const variants =
    await db
      .select({
        id: productVariants.id,
        productId:
          productVariants.productId,
        name: productVariants.name,
        price: productVariants.price,
        stock: productVariants.stock,
        active:
          productVariants.active,
      })
      .from(productVariants)

  return items.map((product) => ({
    ...product,

    variants: variants.filter(
      (variant) =>
        variant.productId ===
        product.id,
    ),
  }))
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
  variants?: {
    size: string
    color: string
    price: number
    stock: number
  }[]
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

const variants = input.variants ?? []

for (const variant of variants) {
  const size = variant.size.trim()
  const color = variant.color.trim()

  if (!size || !color) {
    throw new Error(
      'Every variant must have both a size and color',
    )
  }

  if (
    !Number.isFinite(variant.price) ||
    variant.price < 0
  ) {
    throw new Error(
      `Invalid price for ${size} / ${color}`,
    )
  }

  if (
    !Number.isInteger(variant.stock) ||
    variant.stock < 0
  ) {
    throw new Error(
      `Invalid stock for ${size} / ${color}`,
    )
  }
}

const variantNames = variants.map(
  (variant) =>
    `${variant.size.trim()} — ${variant.color.trim()}`,
)

if (
  new Set(variantNames).size !==
  variantNames.length
) {
  throw new Error(
    'Duplicate size/color variants are not allowed',
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
`Invalid image file: ${file.name}`,
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


/*
 * Store every uploaded image in product_images.
 */



const result = await db.transaction(
  async (tx) => {
    const [product] = await tx
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

    await tx
      .insert(productImages)
      .values(
        uploadedImages.map(
          (image, index) => ({
            productId: product.id,
            url: image.secureUrl,
            publicId: image.publicId,
            sortOrder: index,
          }),
        ),
      )

    if (variants.length) {
      await tx
        .insert(productVariants)
        .values(
          variants.map((variant) => ({
            productId: product.id,
            name: `${variant.size.trim()} — ${variant.color.trim()}`,
            price: variant.price,
            stock: variant.stock,
            active: true,
          })),
        )
    }

    return product
  },
)

revalidatePath('/owner/products')
revalidatePath('/')
revalidatePath('/shop')

return result

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
`Failed to clean up Cloudinary image ${image.publicId}:`,
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
  .where(eq(orders.orderStatus, 'fulfilled')),

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

export async function createCategory(input: {
  name: string
}) {
  const owner = await requireOwner()

  if (!owner) {
    throw new Error('Unauthorized')
  }

  const name = input.name.trim()

  if (!name) {
    throw new Error('Category name is required')
  }

  if (name.length > 80) {
    throw new Error(
      'Category name must be 80 characters or less',
    )
  }

  const slugBase = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  if (!slugBase) {
    throw new Error('Category name is invalid')
  }

  const existing = await db
    .select({
      id: categories.id,
    })
    .from(categories)
    .where(eq(categories.name, name))
    .limit(1)

  if (existing.length) {
    throw new Error(
      `Category "${name}" already exists`,
    )
  }

  let slug = slugBase

  const existingSlug = await db
    .select({
      id: categories.id,
    })
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1)

  if (existingSlug.length) {
    slug = `${slugBase}-${Date.now()}`
  }

  const [category] = await db
    .insert(categories)
    .values({
      name,
      slug,
      active: true,
    })
    .returning({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
    })

  if (!category) {
    throw new Error(
      'Failed to create category',
    )
  }

  revalidatePath('/owner/products')
  revalidatePath('/')

  return category
}