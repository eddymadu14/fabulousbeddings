import {
  getPublishedCategories,
  getPublishedProducts,
} from '@/lib/storefront'

import {
  CartPage,
  StorefrontShell,
} from '@/components/storefront'

export default async function Page() {
  const [
    products,
    categories,
  ] = await Promise.all([
    getPublishedProducts(),
    getPublishedCategories(),
  ])

  return (
    <StorefrontShell
      products={products}
      categories={categories}
    >
      <CartPage />
    </StorefrontShell>
  )
}