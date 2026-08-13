import {
  getPublishedProducts,
  getPublishedCategories,
   getPublishedProductsByCategory,
} from '@/lib/storefront'

import {
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
      <div />
    </StorefrontShell>
  )
}