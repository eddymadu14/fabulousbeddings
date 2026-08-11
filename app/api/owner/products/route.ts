import { NextResponse } from 'next/server'
import { eq, desc } from 'drizzle-orm'

import { db } from '@/lib/db'
import { categories, products } from '@/lib/db/schema'
import { requireOwner } from '@/lib/auth/require-owner'

export async function GET() {
const owner = await requireOwner()

if (!owner) {
return NextResponse.json(
{ error: 'Unauthorized' },
{ status: 401 },
)
}

try {
const result = await db
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
.orderBy(desc(products.createdAt))

return NextResponse.json(result)

} catch (error) {
console.error('Failed to fetch products:', error)

return NextResponse.json(
  { error: 'Failed to fetch products' },
  { status: 500 },
)

}
}

export async function POST(request: Request) {
const owner = await requireOwner()

if (!owner) {
return NextResponse.json(
{ error: 'Unauthorized' },
{ status: 401 },
)
}

try {
const body = await request.json()

const name =
  typeof body.name === 'string'
    ? body.name.trim()
    : ''

const slug =
  typeof body.slug === 'string'
    ? body.slug.trim()
    : ''

const description =
  typeof body.description === 'string'
    ? body.description.trim()
    : ''

const categoryId = Number(body.categoryId)

const price = Number(body.price)

const compareAtPrice =
  body.compareAtPrice === null ||
  body.compareAtPrice === undefined ||
  body.compareAtPrice === ''
    ? null
    : Number(body.compareAtPrice)

const image =
  typeof body.image === 'string'
    ? body.image.trim()
    : ''

const stock =
  body.stock === undefined
    ? 0
    : Number(body.stock)

const status =
  typeof body.status === 'string'
    ? body.status
    : 'draft'

const featured =
  typeof body.featured === 'boolean'
    ? body.featured
    : false

if (!name || !slug || !description || !image) {
  return NextResponse.json(
    {
      error:
        'Name, slug, description and image are required',
    },
    { status: 400 },
  )
}

if (
  !Number.isInteger(categoryId) ||
  categoryId <= 0
) {
  return NextResponse.json(
    { error: 'Invalid category ID' },
    { status: 400 },
  )
}

if (!Number.isFinite(price) || price < 0) {
  return NextResponse.json(
    { error: 'Invalid price' },
    { status: 400 },
  )
}

if (
  compareAtPrice !== null &&
  (!Number.isFinite(compareAtPrice) ||
    compareAtPrice < 0)
) {
  return NextResponse.json(
    { error: 'Invalid compare-at price' },
    { status: 400 },
  )
}

if (!Number.isInteger(stock) || stock < 0) {
  return NextResponse.json(
    { error: 'Invalid stock' },
    { status: 400 },
  )
}

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

const existingProduct = await db
  .select({ id: products.id })
  .from(products)
  .where(eq(products.slug, slug))
  .limit(1)

if (existingProduct.length > 0) {
  return NextResponse.json(
    { error: 'A product with this slug already exists' },
    { status: 409 },
  )
}

const [product] = await db
  .insert(products)
  .values({
    categoryId,
    createdBy: owner.id,
    name,
    slug,
    description,
    price,
    compareAtPrice,
    image,
    stock,
    status,
    featured,
  })
  .returning()

return NextResponse.json(product, { status: 201 })

} catch (error) {
console.error('Failed to create product:', error)

return NextResponse.json(
  { error: 'Failed to create product' },
  { status: 500 },
)

}
}