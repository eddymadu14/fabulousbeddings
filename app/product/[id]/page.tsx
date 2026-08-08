import { notFound } from 'next/navigation'
import { ProductPage, StorefrontShell } from '@/components/storefront'
import { findProduct, products } from '@/lib/store-data'

export function generateStaticParams() {
  return products.map((product) => ({ id: product.id }))
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const product = findProduct(id)
  if (!product) notFound()
  return <StorefrontShell><ProductPage product={product} /></StorefrontShell>
}
