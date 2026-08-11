import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'

import { requireOwner } from '@/lib/auth/require-owner'
import { db } from '@/lib/db'
import { productImages, products } from '@/lib/db/schema'
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

export async function POST(
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

const formData = await request.formData()
const file = formData.get('file')

if (!(file instanceof File)) {
  return NextResponse.json(
    { error: 'Image file is required' },
    { status: 400 },
  )
}

if (!file.type.startsWith('image/')) {
  return NextResponse.json(
    { error: 'Only image files are allowed' },
    { status: 400 },
  )
}

const MAX_FILE_SIZE = 5 * 1024 * 1024

if (file.size > MAX_FILE_SIZE) {
  return NextResponse.json(
    { error: 'Image must be smaller than 5MB' },
    { status: 400 },
  )
}

const sortOrderValue = formData.get('sortOrder')

const sortOrder =
  sortOrderValue === null
    ? 0
    : Number(sortOrderValue)

if (!Number.isInteger(sortOrder) || sortOrder < 0) {
  return NextResponse.json(
    { error: 'Invalid sort order' },
    { status: 400 },
  )
}

const arrayBuffer = await file.arrayBuffer()
const buffer = Buffer.from(arrayBuffer)

const uploadResult = await new Promise<{
  secure_url: string
  public_id: string
}>((resolve, reject) => {
  const uploadStream = cloudinary.uploader.upload_stream(
    {
      folder: `fabulous-beddings/products/${productId}`,
      resource_type: 'image',
    },
    (error, result) => {
      if (error || !result) {
        reject(
          error ?? new Error('Cloudinary upload failed'),
        )
        return
      }

      resolve({
        secure_url: result.secure_url,
        public_id: result.public_id,
      })
    },
  )

  uploadStream.end(buffer)
})

try {
  const [image] = await db
    .insert(productImages)
    .values({
      productId,
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      sortOrder,
    })
    .returning()

  return NextResponse.json(image, { status: 201 })
} catch (error) {
  try {
    await cloudinary.uploader.destroy(
      uploadResult.public_id,
      {
        resource_type: 'image',
        invalidate: true,
      },
    )
  } catch (cleanupError) {
    console.error(
      'Failed to clean up Cloudinary image:',
      cleanupError,
    )
  }

  console.error(
    'Database insert failed after Cloudinary upload:',
    error,
  )

  return NextResponse.json(
    { error: 'Failed to save uploaded image' },
    { status: 500 },
  )
}

} catch (error) {
console.error(
'Failed to upload product image:',
error,
)

return NextResponse.json(
  { error: 'Failed to upload product image' },
  { status: 500 },
)

}
}