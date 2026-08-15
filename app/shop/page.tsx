import {
  getPublishedProducts,
  getPublishedCategories,
} from '@/lib/storefront'


import {
  StorefrontShell,
} from '@/components/storefront'


export const dynamic = 'force-dynamic'


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