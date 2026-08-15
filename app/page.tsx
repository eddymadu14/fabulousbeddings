import {
  getPublishedCategories,
  getPublishedProducts,
} from '@/lib/storefront'

import {
  StorefrontShell,
  Hero,
  CategorySection,
  FeaturedProducts,
  EditorialSection,
  TestimonialSection,
  NewsletterSection,
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
      <Hero />

      <CategorySection />

      <FeaturedProducts />

      <EditorialSection />

      <TestimonialSection />

      <NewsletterSection />
    </StorefrontShell>
  )
}