import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'

import { requireOwner } from '@/lib/auth/require-owner'
import { db } from '@/lib/db'
import { productImages, products } from '@/lib/db/schema'
import cloudinary from '@/lib/cloudinary'

type RouteContext = {
params: Promise<{
id: string
imageId: string
}>
}

function parsePositiveInteger(value: string) {
const number = Number(value)

if (!Number.isInteger(number) || number <= 0) {
return null
}

return number
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

const { id, imageId } = await params

const productId = parsePositiveInteger(id)
const parsedImageId = parsePositiveInteger(imageId)

if (!productId || !parsedImageId) {
return NextResponse.json(
{ error: 'Invalid product or image ID' },
{ status: 400 },
)
}

try {
const [product] = await db
.select({ id: products.id })
.from(products)
.where(eq(products.id, productId))
.limit(1)

if (!product) {
  return NextResponse.json(
    { error: 'Product not found' },
    { status: 404 },
  )
}

const [existingImage] = await db
  .select()
  .from(productImages)
  .where(
    and(
      eq(productImages.id, parsedImageId),
      eq(productImages.productId, productId),
    ),
  )
  .limit(1)

if (!existingImage) {
  return NextResponse.json(
    { error: 'Image not found' },
    { status: 404 },
  )
}

const body = await request.json()

const updates: {
  sortOrder?: number
} = {}

if (body.sortOrder !== undefined) {
  const sortOrder = Number(body.sortOrder)

  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    return NextResponse.json(
      { error: 'Invalid sort order' },
      { status: 400 },
    )
  }

  updates.sortOrder = sortOrder
}

if (Object.keys(updates).length === 0) {
  return NextResponse.json(
    { error: 'No valid fields to update' },
    { status: 400 },
  )
}

const [image] = await db
  .update(productImages)
  .set(updates)
  .where(
    and(
      eq(productImages.id, parsedImageId),
      eq(productImages.productId, productId),
    ),
  )
  .returning()

return NextResponse.json(image)

} catch (error) {
console.error('Failed to update product image:', error)

return NextResponse.json(
  { error: 'Failed to update product image' },
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

const { id, imageId } = await params

const productId = parsePositiveInteger(id)
const parsedImageId = parsePositiveInteger(imageId)

if (!productId || !parsedImageId) {
return NextResponse.json(
{ error: 'Invalid product or image ID' },
{ status: 400 },
)
}

try {
const [image] = await db
.select()
.from(productImages)
.where(
and(
eq(productImages.id, parsedImageId),
eq(productImages.productId, productId),
),
)
.limit(1)

if (!image) {
  return NextResponse.json(
    { error: 'Image not found' },
    { status: 404 },
  )
}

/*
 * Delete the Cloudinary asset first.
 *
 * Images created through our upload endpoint have
 * a publicId. Older/manual records may not have one,
 * so those can still be removed from the database.
 */
if (image.publicId) {
  const cloudinaryResult =
    await cloudinary.uploader.destroy(
      image.publicId,
      {
        resource_type: 'image',
        invalidate: true,
      },
    )

  if (
    cloudinaryResult.result !== 'ok' &&
    cloudinaryResult.result !== 'not found'
  ) {
    console.error(
      'Cloudinary image deletion failed:',
      cloudinaryResult,
    )

    return NextResponse.json(
      {
        error:
          'Unable to delete image from storage',
      },
      { status: 502 },
    )
  }
}

const [deletedImage] = await db
  .delete(productImages)
  .where(
    and(
      eq(productImages.id, parsedImageId),
      eq(productImages.productId, productId),
    ),
  )
  .returning()

if (!deletedImage) {
  return NextResponse.json(
    { error: 'Image could not be deleted' },
    { status: 500 },
  )
}

return NextResponse.json({
  success: true,
  image: deletedImage,
})

} catch (error) {
console.error('Failed to delete product image:', error)

return NextResponse.json(
  { error: 'Failed to delete product image' },
  { status: 500 },
)

}
}
