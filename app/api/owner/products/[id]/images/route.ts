import { NextResponse } from 'next/server'
import { asc, eq } from 'drizzle-orm'

import { requireOwner } from '@/lib/auth/require-owner'
import { db } from '@/lib/db'
import { productImages, products } from '@/lib/db/schema'

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

const images = await db
  .select()
  .from(productImages)
  .where(eq(productImages.productId, productId))
  .orderBy(asc(productImages.sortOrder), asc(productImages.id))

return NextResponse.json(images)

} catch (error) {
console.error('Failed to fetch product images:', error)

return NextResponse.json(
  { error: 'Failed to fetch product images' },
  { status: 500 },
)

}
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

const body = await request.json()

const url =
  typeof body.url === 'string'
    ? body.url.trim()
    : ''

const publicId =
  typeof body.publicId === 'string'
    ? body.publicId.trim()
    : null

const sortOrder =
  body.sortOrder === undefined
    ? 0
    : Number(body.sortOrder)

if (!url) {
  return NextResponse.json(
    { error: 'Image URL is required' },
    { status: 400 },
  )
}

if (!Number.isInteger(sortOrder) || sortOrder < 0) {
  return NextResponse.json(
    { error: 'Invalid sort order' },
    { status: 400 },
  )
}

const [image] = await db
  .insert(productImages)
  .values({
    productId,
    url,
    publicId,
    sortOrder,
  })
  .returning()

return NextResponse.json(image, { status: 201 })

} catch (error) {
console.error('Failed to create product image:', error)

return NextResponse.json(
  { error: 'Failed to create product image' },
  { status: 500 },
)

}
}