import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { categories } from '@/lib/db/schema'
import { asc, eq } from 'drizzle-orm'
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
.select()
.from(categories)
.orderBy(asc(categories.name))

return NextResponse.json(result)

} catch (error) {
console.error('Failed to fetch categories:', error)

return NextResponse.json(
  { error: 'Failed to fetch categories' },
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

const name = typeof body.name === 'string'
  ? body.name.trim()
  : ''

const slug = typeof body.slug === 'string'
  ? body.slug.trim()
  : ''

const description =
  typeof body.description === 'string'
    ? body.description.trim()
    : null

const image =
  typeof body.image === 'string'
    ? body.image.trim()
    : null

const active =
  typeof body.active === 'boolean'
    ? body.active
    : true

if (!name || !slug) {
  return NextResponse.json(
    { error: 'Name and slug are required' },
    { status: 400 },
  )
}

const existing = await db
  .select({ id: categories.id })
  .from(categories)
  .where(eq(categories.slug, slug))
  .limit(1)

if (existing.length > 0) {
  return NextResponse.json(
    { error: 'A category with this slug already exists' },
    { status: 409 },
  )
}

const [category] = await db
  .insert(categories)
  .values({
    name,
    slug,
    description,
    image,
    active,
  })
  .returning()

return NextResponse.json(category, { status: 201 })

} catch (error) {
console.error('Failed to create category:', error)

return NextResponse.json(
  { error: 'Failed to create category' },
  { status: 500 },
)

}
}