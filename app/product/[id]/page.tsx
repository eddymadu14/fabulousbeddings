import { notFound } from 'next/navigation'

import {
  getPublishedCategories,
  getPublishedProduct,
  getPublishedProducts,
} from '@/lib/storefront'

import {
  ProductPage,
  StorefrontShell,
} from '@/components/storefront'

export async function generateStaticParams() {
  const products =
    await getPublishedProducts()

  return products.map(
    (product) => ({
      id: product.id,
    }),
  )
}

export default async function Page({
  params,
}: {
  params: Promise<{
    id: string
  }>
}) {
  const { id } =
    await params

  const [
    product,
    products,
    categories,
  ] = await Promise.all([
    getPublishedProduct(id),
    getPublishedProducts(),
    getPublishedCategories(),
  ])

  if (!product) {
    notFound()
  }

  return (
    <StorefrontShell
      products={products}
      categories={categories}
    >
      <ProductPage
        product={product}
      />
    </StorefrontShell>
  )
}