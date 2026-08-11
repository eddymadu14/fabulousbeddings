import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { categories } from '@/lib/db/schema'
import { requireOwner } from '@/lib/auth/require-owner'



type RouteContext = {
params: Promise<{
id: string
}>
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
const categoryId = Number(id)

if (!Number.isInteger(categoryId) || categoryId <= 0) {
return NextResponse.json(
{ error: 'Invalid category ID' },
{ status: 400 },
)
}

try {
const [category] = await db
.select()
.from(categories)
.where(eq(categories.id, categoryId))
.limit(1)

if (!category) {
  return NextResponse.json(
    { error: 'Category not found' },
    { status: 404 },
  )
}

return NextResponse.json(category)

} catch (error) {
console.error('Failed to fetch category:', error)

return NextResponse.json(
  { error: 'Failed to fetch category' },
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
const categoryId = Number(id)

if (!Number.isInteger(categoryId) || categoryId <= 0) {
return NextResponse.json(
{ error: 'Invalid category ID' },
{ status: 400 },
)
}

try {
const body = await request.json()

const updates: {
  name?: string
  slug?: string
  description?: string | null
  image?: string | null
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
}

if (body.description !== undefined) {
  updates.description =
    typeof body.description === 'string'
      ? body.description.trim() || null
      : null
}

if (body.image !== undefined) {
  updates.image =
    typeof body.image === 'string'
      ? body.image.trim() || null
      : null
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

if (updates.slug !== undefined) {
  const existing = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, updates.slug))
    .limit(1)

  if (
    existing.length > 0 &&
    existing[0].id !== categoryId
  ) {
    return NextResponse.json(
      { error: 'A category with this slug already exists' },
      { status: 409 },
    )
  }
}

const [category] = await db
  .update(categories)
  .set(updates)
  .where(eq(categories.id, categoryId))
  .returning()

if (!category) {
  return NextResponse.json(
    { error: 'Category not found' },
    { status: 404 },
  )
}

return NextResponse.json(category)

} catch (error) {
console.error('Failed to update category:', error)

return NextResponse.json(
  { error: 'Failed to update category' },
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
const categoryId = Number(id)

if (!Number.isInteger(categoryId) || categoryId <= 0) {
return NextResponse.json(
{ error: 'Invalid category ID' },
{ status: 400 },
)
}

try {
const [category] = await db
.update(categories)
.set({
active: false,
updatedAt: new Date(),
})
.where(eq(categories.id, categoryId))
.returning()

if (!category) {
  return NextResponse.json(
    { error: 'Category not found' },
    { status: 404 },
  )
}

return NextResponse.json(category)

} catch (error) {
console.error('Failed to deactivate category:', error)

return NextResponse.json(
  { error: 'Failed to deactivate category' },
  { status: 500 },
)

}
}