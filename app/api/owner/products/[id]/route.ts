import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'

import { requireOwner } from '@/lib/auth/require-owner'
import { db } from '@/lib/db'
import { categories, products } from '@/lib/db/schema'

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
categoryName: categories.name,
createdBy: products.createdBy,
createdAt: products.createdAt,
updatedAt: products.updatedAt,
})
.from(products)
.leftJoin(
categories,
eq(products.categoryId, categories.id),
)
.where(eq(products.id, productId))
.limit(1)

if (!product) {
  return NextResponse.json(
    { error: 'Product not found' },
    { status: 404 },
  )
}

return NextResponse.json(product)

} catch (error) {
console.error('Failed to fetch product:', error)

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

try {
const body = await request.json()

const updates: {
  categoryId?: number
  name?: string
  slug?: string
  description?: string
  price?: number
  compareAtPrice?: number | null
  image?: string
  stock?: number
  status?: string
  featured?: boolean
  updatedAt: Date
} = {
  updatedAt: new Date(),
}

if (body.categoryId !== undefined) {
  const categoryId = Number(body.categoryId)

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return NextResponse.json(
      { error: 'Invalid category ID' },
      { status: 400 },
    )
  }

  const [category] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1)

  if (!category) {
    return NextResponse.json(
      { error: 'Category not found' },
      { status: 404 },
    )
  }

  updates.categoryId = categoryId
}

if (body.name !== undefined) {
  if (
    typeof body.name !== 'string' ||
    !body.name.trim()
  ) {
    return NextResponse.json(
      { error: 'Name cannot be empty' },
      { status: 400 },
    )
  }

  updates.name = body.name.trim()
}

if (body.slug !== undefined) {
  if (
    typeof body.slug !== 'string' ||
    !body.slug.trim()
  ) {
    return NextResponse.json(
      { error: 'Slug cannot be empty' },
      { status: 400 },
    )
  }

  updates.slug = body.slug.trim()

  const existing = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.slug, updates.slug))
    .limit(1)

  if (
    existing.length > 0 &&
    existing[0].id !== productId
  ) {
    return NextResponse.json(
      { error: 'A product with this slug already exists' },
      { status: 409 },
    )
  }
}

if (body.description !== undefined) {
  if (
    typeof body.description !== 'string' ||
    !body.description.trim()
  ) {
    return NextResponse.json(
      { error: 'Description cannot be empty' },
      { status: 400 },
    )
  }

  updates.description = body.description.trim()
}

if (body.price !== undefined) {
  const price = Number(body.price)

  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json(
      { error: 'Invalid price' },
      { status: 400 },
    )
  }

  updates.price = price
}

if (body.compareAtPrice !== undefined) {
  if (
    body.compareAtPrice === null ||
    body.compareAtPrice === ''
  ) {
    updates.compareAtPrice = null
  } else {
    const compareAtPrice = Number(body.compareAtPrice)

    if (
      !Number.isFinite(compareAtPrice) ||
      compareAtPrice < 0
    ) {
      return NextResponse.json(
        { error: 'Invalid compare-at price' },
        { status: 400 },
      )
    }

    updates.compareAtPrice = compareAtPrice
  }
}

if (body.image !== undefined) {
  if (
    typeof body.image !== 'string' ||
    !body.image.trim()
  ) {
    return NextResponse.json(
      { error: 'Image cannot be empty' },
      { status: 400 },
    )
  }

  updates.image = body.image.trim()
}

if (body.stock !== undefined) {
  const stock = Number(body.stock)

  if (!Number.isInteger(stock) || stock < 0) {
    return NextResponse.json(
      { error: 'Invalid stock' },
      { status: 400 },
    )
  }

  updates.stock = stock
}

if (body.status !== undefined) {
  const allowedStatuses = [
    'draft',
    'published',
    'archived',
  ]

  if (
    typeof body.status !== 'string' ||
    !allowedStatuses.includes(body.status)
  ) {
    return NextResponse.json(
      { error: 'Invalid product status' },
      { status: 400 },
    )
  }

  updates.status = body.status
}

if (body.featured !== undefined) {
  if (typeof body.featured !== 'boolean') {
    return NextResponse.json(
      { error: 'Featured must be a boolean' },
      { status: 400 },
    )
  }

  updates.featured = body.featured
}

const [product] = await db
  .update(products)
  .set(updates)
  .where(eq(products.id, productId))
  .returning()

if (!product) {
  return NextResponse.json(
    { error: 'Product not found' },
    { status: 404 },
  )
}

return NextResponse.json(product)

} catch (error) {
console.error('Failed to update product:', error)

return NextResponse.json(
  { error: 'Failed to update product' },
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
.where(eq(products.id, productId))
.returning()

if (!product) {
  return NextResponse.json(
    { error: 'Product not found' },
    { status: 404 },
  )
}

return NextResponse.json(product)

} catch (error) {
console.error('Failed to archive product:', error)

return NextResponse.json(
  { error: 'Failed to archive product' },
  { status: 500 },
)

}
}