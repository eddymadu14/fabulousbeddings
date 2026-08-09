'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { orders, pageVisits, products } from '@/lib/db/schema'
import { desc, eq, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

export async function getOwnerProducts() { return db.select().from(products).where(eq(products.userId, await getUserId())).orderBy(desc(products.createdAt)) }
export async function addProduct(input: { name: string; category: string; description: string; price: number; compareAtPrice?: number; image: string; stock: number; status: string }) {
  const userId = await getUserId()
  await db.insert(products).values({ ...input, userId, slug: input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''), compareAtPrice: input.compareAtPrice || null })
  revalidatePath('/owner/products')
}
export async function getOwnerAnalytics() {
  const userId = await getUserId()
  const [productCount, orderCount, fulfilledCount, visitorCount, recentOrders] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(products).where(eq(products.userId, userId)),
    db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.userId, userId)),
    db.select({ count: sql<number>`count(*)` }).from(orders).where(sql`${orders.userId} = ${userId} and ${orders.status} = 'fulfilled'`),
    db.select({ count: sql<number>`count(*)` }).from(pageVisits),
    db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt)).limit(6),
  ])
  return { productCount: Number(productCount[0]?.count ?? 0), orderCount: Number(orderCount[0]?.count ?? 0), fulfilledCount: Number(fulfilledCount[0]?.count ?? 0), visitorCount: Number(visitorCount[0]?.count ?? 0), recentOrders }
}
