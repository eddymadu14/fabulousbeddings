import {
  getPublishedCategories,
  getPublishedProducts,
} from '@/lib/storefront'

import {
  InfoPage,
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
      <InfoPage type="contact" />
    </StorefrontShell>
  )
}