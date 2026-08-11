import { NextResponse } from 'next/server'
import { and, eq, ne } from 'drizzle-orm'

import { requireOwner } from '@/lib/auth/require-owner'
import { db } from '@/lib/db'
import {
categories,
productImages,
products,
} from '@/lib/db/schema'
import cloudinary from '@/lib/cloudinary'

type RouteContext = {
params: Promise<{
id: string
}>
}

function parseProductId(id: string) {
const productId = Number(id)

if (!Number.isInteger(productId) || productId <= 0) {
return null
}

return productId
}

function parseIds(value: FormDataEntryValue | null) {
if (typeof value !== 'string' || !value.trim()) {
return []
}

return value
.split(',')
.map(Number)
.filter(
(id) => Number.isInteger(id) && id > 0,
)
}

async function uploadImage(
file: File,
productId: number,
) {
if (!file.type.startsWith('image/')) {
throw new Error(
"Invalid image file: ${file.name}",
)
}

const MAX_FILE_SIZE = 5 * 1024 * 1024

if (file.size > MAX_FILE_SIZE) {
throw new Error(
"${file.name} is larger than 5MB",
)
}

const buffer = Buffer.from(
await file.arrayBuffer(),
)

return new Promise<{
secureUrl: string
publicId: string
}>((resolve, reject) => {
const uploadStream =
cloudinary.uploader.upload_stream(
{
folder: "fabulous-beddings/products/${productId}",
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
}

async function deleteCloudinaryImage(
publicId: string | null,
) {
if (!publicId) {
return
}

try {
await cloudinary.uploader.destroy(
publicId,
{
resource_type: 'image',
invalidate: true,
},
)
} catch (error) {
console.error(
"Failed to delete Cloudinary image ${publicId}:",
error,
)
}
}

export async function GET(
_request: Request,
{ params }: RouteContext,
) {
const owner = await requireOwner()

if (!owner) {
return NextResponse.json(
{ error: 'Unauthorized' },
{ status: 401 },
)
}

const { id } = await params
const productId = parseProductId(id)

if (!productId) {
return NextResponse.json(
{ error: 'Invalid product ID' },
{ status: 400 },
)
}

try {
const [product] = await db
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
categoryName: categories.name,
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
and(
eq(products.id, productId),
eq(products.createdBy, owner.id),
),
)
.limit(1)

if (!product) {
  return NextResponse.json(
    { error: 'Product not found' },
    { status: 404 },
  )
}

const images = await db
  .select({
    id: productImages.id,
    url: productImages.url,
    publicId: productImages.publicId,
    sortOrder:
      productImages.sortOrder,
  })
  .from(productImages)
  .where(
    eq(
      productImages.productId,
      productId,
    ),
  )
  .orderBy(productImages.sortOrder)

return NextResponse.json({
  ...product,
  images,
})

} catch (error) {
console.error(
'Failed to fetch product:',
error,
)

return NextResponse.json(
  { error: 'Failed to fetch product' },
  { status: 500 },
)

}
}

export async function PATCH(
request: Request,
{ params }: RouteContext,
) {
const owner = await requireOwner()

if (!owner) {
return NextResponse.json(
{ error: 'Unauthorized' },
{ status: 401 },
)
}

const { id } = await params
const productId = parseProductId(id)

if (!productId) {
return NextResponse.json(
{ error: 'Invalid product ID' },
{ status: 400 },
)
}

const uploadedImages: {
secureUrl: string
publicId: string
}[] = []

try {
const [existingProduct] = await db
.select({
id: products.id,
image: products.image,
createdBy: products.createdBy,
})
.from(products)
.where(
and(
eq(products.id, productId),
eq(products.createdBy, owner.id),
),
)
.limit(1)

if (!existingProduct) {
  return NextResponse.json(
    { error: 'Product not found' },
    { status: 404 },
  )
}

const formData = await request.formData()

const nameValue = formData.get('name')
const categoryIdValue =
  formData.get('categoryId')
const descriptionValue =
  formData.get('description')
const priceValue = formData.get('price')
const compareAtPriceValue =
  formData.get('compareAtPrice')
const stockValue = formData.get('stock')
const statusValue = formData.get('status')

if (
  typeof nameValue !== 'string' ||
  !nameValue.trim()
) {
  return NextResponse.json(
    { error: 'Name cannot be empty' },
    { status: 400 },
  )
}

if (
  typeof descriptionValue !== 'string' ||
  !descriptionValue.trim()
) {
  return NextResponse.json(
    {
      error:
        'Description cannot be empty',
    },
    { status: 400 },
  )
}

const categoryId = Number(
  categoryIdValue,
)

if (
  !Number.isInteger(categoryId) ||
  categoryId <= 0
) {
  return NextResponse.json(
    { error: 'Invalid category ID' },
    { status: 400 },
  )
}

const [category] = await db
  .select({ id: categories.id })
  .from(categories)
  .where(
    eq(categories.id, categoryId),
  )
  .limit(1)

if (!category) {
  return NextResponse.json(
    { error: 'Category not found' },
    { status: 404 },
  )
}

const price = Number(priceValue)

if (!Number.isFinite(price) || price < 0) {
  return NextResponse.json(
    { error: 'Invalid price' },
    { status: 400 },
  )
}

const compareAtPrice =
  compareAtPriceValue === null ||
  compareAtPriceValue === ''
    ? null
    : Number(compareAtPriceValue)

if (
  compareAtPrice !== null &&
  (!Number.isFinite(compareAtPrice) ||
    compareAtPrice < 0)
) {
  return NextResponse.json(
    {
      error:
        'Invalid compare-at price',
    },
    { status: 400 },
  )
}

const stock = Number(stockValue)

if (
  !Number.isInteger(stock) ||
  stock < 0
) {
  return NextResponse.json(
    { error: 'Invalid stock' },
    { status: 400 },
  )
}

const status =
  typeof statusValue === 'string'
    ? statusValue
    : 'draft'

const allowedStatuses = [
  'draft',
  'published',
  'archived',
]

if (!allowedStatuses.includes(status)) {
  return NextResponse.json(
    { error: 'Invalid product status' },
    { status: 400 },
  )
}

const removeImageIds = parseIds(
  formData.get('removeImageIds'),
)

const primaryImageIdValue =
  formData.get('primaryImageId')

const primaryImageId =
  primaryImageIdValue &&
  typeof primaryImageIdValue === 'string'
    ? Number(primaryImageIdValue)
    : null

const newFiles = formData
  .getAll('images')
  .filter(
    (value): value is File =>
      value instanceof File &&
      value.size > 0,
  )

const existingImages = await db
  .select({
    id: productImages.id,
    url: productImages.url,
    publicId:
      productImages.publicId,
    sortOrder:
      productImages.sortOrder,
  })
  .from(productImages)
  .where(
    eq(
      productImages.productId,
      productId,
    ),
  )
  .orderBy(productImages.sortOrder)

const existingImageMap =
  new Map(
    existingImages.map((image) => [
      image.id,
      image,
    ]),
  )

for (const imageId of removeImageIds) {
  if (!existingImageMap.has(imageId)) {
    return NextResponse.json(
      {
        error:
          'One or more images do not belong to this product',
      },
      { status: 400 },
    )
  }
}

if (
  primaryImageId !== null &&
  !existingImageMap.has(primaryImageId) &&
  primaryImageId >= 0
) {
  return NextResponse.json(
    {
      error:
        'Selected primary image was not found',
    },
    { status: 400 },
  )
}

/*
 * Upload new images before changing the database.
 * If anything fails, we clean them up.
 */
for (const file of newFiles) {
  uploadedImages.push(
    await uploadImage(
      file,
      productId,
    ),
  )
}

const remainingImages =
  existingImages.filter(
    (image) =>
      !removeImageIds.includes(
        image.id,
      ),
  )

if (
  remainingImages.length +
    uploadedImages.length ===
  0
) {
  throw new Error(
    'A product must have at least one image',
  )
}

let selectedPrimaryUrl =
  existingProduct.image

if (
  primaryImageId !== null &&
  primaryImageId >= 0
) {
  const primaryImage =
    existingImageMap.get(
      primaryImageId,
    )

  if (primaryImage) {
    selectedPrimaryUrl =
      primaryImage.url
  }
}

if (
  primaryImageId === null &&
  remainingImages.length === 0 &&
  uploadedImages.length > 0
) {
  selectedPrimaryUrl =
    uploadedImages[0].secureUrl
}

if (
  primaryImageId !== null &&
  primaryImageId < 0
) {
  const newImageIndex =
    Math.abs(primaryImageId) - 1

  if (
    uploadedImages[newImageIndex]
  ) {
    selectedPrimaryUrl =
      uploadedImages[
        newImageIndex
      ].secureUrl
  }
}

const [updatedProduct] =
  await db.transaction(
    async (tx) => {
      const [updated] = await tx
        .update(products)
        .set({
          categoryId,
          name: nameValue.trim(),
          description:
            descriptionValue.trim(),
          price,
          compareAtPrice,
          image: selectedPrimaryUrl,
          stock,
          status,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(
              products.id,
              productId,
            ),
            eq(
              products.createdBy,
              owner.id,
            ),
          ),
        )
        .returning()

      if (!updated) {
        throw new Error(
          'Failed to update product',
        )
      }

      if (removeImageIds.length) {
        await tx
          .delete(productImages)
          .where(
            and(
              eq(
                productImages.productId,
                productId,
              ),
              ...removeImageIds.map(
                (imageId) =>
                  eq(
                    productImages.id,
                    imageId,
                  ),
              ),
            ),
          )
      }

      if (uploadedImages.length) {
        const currentMax =
          remainingImages.reduce(
            (max, image) =>
              Math.max(
                max,
                image.sortOrder,
              ),
            -1,
          )

        await tx
          .insert(productImages)
          .values(
            uploadedImages.map(
              (image, index) => ({
                productId,
                url: image.secureUrl,
                publicId:
                  image.publicId,
                sortOrder:
                  currentMax +
                  index +
                  1,
              }),
            ),
          )
      }

      return [updated]
    },
  )

/*
 * Database is now successful.
 * Cloudinary deletion happens afterward.
 */
await Promise.all(
  removeImageIds.map(
    async (imageId) => {
      const image =
        existingImageMap.get(
          imageId,
        )

      await deleteCloudinaryImage(
        image?.publicId ?? null,
      )
    },
  ),
)

const images = await db
  .select({
    id: productImages.id,
    url: productImages.url,
    publicId:
      productImages.publicId,
    sortOrder:
      productImages.sortOrder,
  })
  .from(productImages)
  .where(
    eq(
      productImages.productId,
      productId,
    ),
  )
  .orderBy(productImages.sortOrder)

return NextResponse.json({
  ...updatedProduct,
  images,
})

} catch (error) {
await Promise.all(
uploadedImages.map(
(image) =>
deleteCloudinaryImage(
image.publicId,
),
),
)

console.error(
  'Failed to update product:',
  error,
)

return NextResponse.json(
  {
    error:
      error instanceof Error
        ? error.message
        : 'Failed to update product',
  },
  { status: 500 },
)

}
}

export async function DELETE(
_request: Request,
{ params }: RouteContext,
) {
const owner = await requireOwner()

if (!owner) {
return NextResponse.json(
{ error: 'Unauthorized' },
{ status: 401 },
)
}

const { id } = await params
const productId = parseProductId(id)

if (!productId) {
return NextResponse.json(
{ error: 'Invalid product ID' },
{ status: 400 },
)
}

try {
const [product] = await db
.update(products)
.set({
status: 'archived',
updatedAt: new Date(),
})
.where(
and(
eq(products.id, productId),
eq(products.createdBy, owner.id),
),
)
.returning()

if (!product) {
  return NextResponse.json(
    { error: 'Product not found' },
    { status: 404 },
  )
}

return NextResponse.json(product)

} catch (error) {
console.error(
'Failed to archive product:',
error,
)

return NextResponse.json(
  { error: 'Failed to archive product' },
  { status: 500 },
)

}
}