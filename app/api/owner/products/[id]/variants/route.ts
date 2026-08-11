import { NextResponse } from 'next/server'
import { and, asc, eq } from 'drizzle-orm'

import { requireOwner } from '@/lib/auth/require-owner'
import { db } from '@/lib/db'
import { productVariants, products } from '@/lib/db/schema'

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

async function getProduct(productId: number) {
const [product] = await db
.select({ id: products.id })
.from(products)
.where(eq(products.id, productId))
.limit(1)

return product
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
const product = await getProduct(productId)

if (!product) {
  return NextResponse.json(
    { error: 'Product not found' },
    { status: 404 },
  )
}

const variants = await db
  .select()
  .from(productVariants)
  .where(eq(productVariants.productId, productId))
  .orderBy(asc(productVariants.id))

return NextResponse.json(variants)

} catch (error) {
console.error('Failed to fetch variants:', error)

return NextResponse.json(
  { error: 'Failed to fetch variants' },
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
const product = await getProduct(productId)

if (!product) {
  return NextResponse.json(
    { error: 'Product not found' },
    { status: 404 },
  )
}

const body = await request.json()

const name =
  typeof body.name === 'string'
    ? body.name.trim()
    : ''

const price = Number(body.price)

const stock =
  body.stock === undefined
    ? 0
    : Number(body.stock)

const active =
  typeof body.active === 'boolean'
    ? body.active
    : true

if (!name) {
  return NextResponse.json(
    { error: 'Variant name is required' },
    { status: 400 },
  )
}

if (!Number.isFinite(price) || price < 0) {
  return NextResponse.json(
    { error: 'Invalid variant price' },
    { status: 400 },
  )
}

if (!Number.isInteger(stock) || stock < 0) {
  return NextResponse.json(
    { error: 'Invalid variant stock' },
    { status: 400 },
  )
}

const existing = await db
  .select({ id: productVariants.id })
  .from(productVariants)
  .where(
    and(
      eq(productVariants.productId, productId),
      eq(productVariants.name, name),
    ),
  )
  .limit(1)

if (existing.length > 0) {
  return NextResponse.json(
    {
      error:
        'A variant with this name already exists for this product',
    },
    { status: 409 },
  )
}

const [variant] = await db
  .insert(productVariants)
  .values({
    productId,
    name,
    price,
    stock,
    active,
  })
  .returning()

return NextResponse.json(variant, { status: 201 })

} catch (error) {
console.error('Failed to create variant:', error)

return NextResponse.json(
  { error: 'Failed to create variant' },
  { status: 500 },
)

}
}