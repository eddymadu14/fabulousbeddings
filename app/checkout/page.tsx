import {
  Suspense,
} from 'react'

import {
  getPublishedCategories,
  getPublishedProducts,
} from '@/lib/storefront'

import {
  CheckoutPage,
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
      <Suspense
        fallback={
          <div className="flex min-h-[60vh] items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Loading checkout...
            </p>
          </div>
        }
      >
        <CheckoutPage />
      </Suspense>
    </StorefrontShell>
  )
}