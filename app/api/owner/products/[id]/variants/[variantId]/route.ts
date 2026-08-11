import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'

import { requireOwner } from '@/lib/auth/require-owner'
import { db } from '@/lib/db'
import { productVariants, products } from '@/lib/db/schema'

type RouteContext = {
params: Promise<{
id: string
variantId: string
}>
}

function parsePositiveInteger(value: string) {
const number = Number(value)

if (!Number.isInteger(number) || number <= 0) {
return null
}

return number
}

async function productExists(productId: number) {
const [product] = await db
.select({ id: products.id })
.from(products)
.where(eq(products.id, productId))
.limit(1)

return Boolean(product)
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

const { id, variantId } = await params

const productId = parsePositiveInteger(id)
const parsedVariantId = parsePositiveInteger(variantId)

if (!productId || !parsedVariantId) {
return NextResponse.json(
{ error: 'Invalid product or variant ID' },
{ status: 400 },
)
}

try {
if (!(await productExists(productId))) {
return NextResponse.json(
{ error: 'Product not found' },
{ status: 404 },
)
}

const [existingVariant] = await db
  .select()
  .from(productVariants)
  .where(
    and(
      eq(productVariants.id, parsedVariantId),
      eq(productVariants.productId, productId),
    ),
  )
  .limit(1)

if (!existingVariant) {
  return NextResponse.json(
    { error: 'Variant not found' },
    { status: 404 },
  )
}

const body = await request.json()

const updates: {
  name?: string
  price?: number
  stock?: number
  active?: boolean
  updatedAt: Date
} = {
  updatedAt: new Date(),
}

if (body.name !== undefined) {
  if (
    typeof body.name !== 'string' ||
    !body.name.trim()
  ) {
    return NextResponse.json(
      { error: 'Variant name cannot be empty' },
      { status: 400 },
    )
  }

  const name = body.name.trim()

  const duplicate = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.productId, productId),
        eq(productVariants.name, name),
      ),
    )
    .limit(1)

  if (
    duplicate.length > 0 &&
    duplicate[0].id !== parsedVariantId
  ) {
    return NextResponse.json(
      {
        error:
          'A variant with this name already exists for this product',
      },
      { status: 409 },
    )
  }

  updates.name = name
}

if (body.price !== undefined) {
  const price = Number(body.price)

  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json(
      { error: 'Invalid variant price' },
      { status: 400 },
    )
  }

  updates.price = price
}

if (body.stock !== undefined) {
  const stock = Number(body.stock)

  if (!Number.isInteger(stock) || stock < 0) {
    return NextResponse.json(
      { error: 'Invalid variant stock' },
      { status: 400 },
    )
  }

  updates.stock = stock
}

if (body.active !== undefined) {
  if (typeof body.active !== 'boolean') {
    return NextResponse.json(
      { error: 'Active must be a boolean' },
      { status: 400 },
    )
  }

  updates.active = body.active
}

const [variant] = await db
  .update(productVariants)
  .set(updates)
  .where(
    and(
      eq(productVariants.id, parsedVariantId),
      eq(productVariants.productId, productId),
    ),
  )
  .returning()

if (!variant) {
  return NextResponse.json(
    { error: 'Variant not found' },
    { status: 404 },
  )
}

return NextResponse.json(variant)

} catch (error) {
console.error('Failed to update variant:', error)

return NextResponse.json(
  { error: 'Failed to update variant' },
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

const { id, variantId } = await params

const productId = parsePositiveInteger(id)
const parsedVariantId = parsePositiveInteger(variantId)

if (!productId || !parsedVariantId) {
return NextResponse.json(
{ error: 'Invalid product or variant ID' },
{ status: 400 },
)
}

try {
const [variant] = await db
.update(productVariants)
.set({
active: false,
updatedAt: new Date(),
})
.where(
and(
eq(productVariants.id, parsedVariantId),
eq(productVariants.productId, productId),
),
)
.returning()

if (!variant) {
  return NextResponse.json(
    { error: 'Variant not found' },
    { status: 404 },
  )
}

return NextResponse.json(variant)

} catch (error) {
console.error('Failed to deactivate variant:', error)

return NextResponse.json(
  { error: 'Failed to deactivate variant' },
  { status: 500 },
)

}
}