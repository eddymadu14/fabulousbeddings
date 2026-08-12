import {
  CategorySection,
  EditorialSection,
  FeaturedProducts,
  Hero,
  NewsletterSection,
  TestimonialSection,
  StorefrontShell,
} from '@/components/storefront'
import { getFeaturedProducts } from '@/lib/store-data'

export default async function Page() {
  const featuredProducts = await getFeaturedProducts()

  return (
    <StorefrontShell>
      <Hero />

      <CategorySection />

      <FeaturedProducts products={featuredProducts} />

      <EditorialSection />

      <TestimonialSection />

      <NewsletterSection />
    </StorefrontShell>
  )
}