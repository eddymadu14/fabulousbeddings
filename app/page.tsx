'use client'

import { CategorySection, EditorialSection, FeaturedProducts, Hero, NewsletterSection, TestimonialSection, StorefrontShell } from '@/components/storefront'

export default function Page() {
  return <StorefrontShell><Hero /><CategorySection /><FeaturedProducts /><EditorialSection /><TestimonialSection /><NewsletterSection /></StorefrontShell>
}
