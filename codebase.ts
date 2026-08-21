I inspected the current main repo. The UI is concentrated in components/storefront.tsx, while authentication is in components/auth-form.tsx. The product pipeline currently loads all product images from the database but throws away everything except the first image when normalizing the product. �
GitHub +1
Here is the clean implementation I recommend.
1. Password preview — login + register
File
components/auth-form.tsx
Your current password field is a plain type="password" input with no visibility state. �
GitHub
Replace the whole file with
'use client'

import {
  useState,
} from 'react'

import {
  Eye,
  EyeOff,
} from 'lucide-react'

import {
  useRouter,
} from 'next/navigation'

import {
  signIn,
  signUp,
} from '@/lib/auth-client'

export function AuthForm({
  mode,
}: {
  mode:
    | 'sign-in'
    | 'sign-up'
}) {
  const router =
    useRouter()

  const [
    error,
    setError,
  ] = useState('')

  const [
    loading,
    setLoading,
  ] = useState(false)

  const [
    showPassword,
    setShowPassword,
  ] = useState(false)

  async function submit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setLoading(true)
    setError('')

    const data =
      Object.fromEntries(
        new FormData(
          event.currentTarget,
        ),
      )

    const result =
      mode === 'sign-in'
        ? await signIn.email({
            email: String(
              data.email,
            ),
            password: String(
              data.password,
            ),
          })
        : await signUp.email({
            email: String(
              data.email,
            ),
            password: String(
              data.password,
            ),
            name: String(
              data.name,
            ),
          })

    setLoading(false)

    if (result.error) {
      setError(
        result.error.message ||
          'Unable to continue',
      )
      return
    }

    if (
      mode === 'sign-up'
    ) {
      router.push('/')
      router.refresh()
      return
    }

    try {
      const response =
        await fetch(
          '/api/auth/redirect',
        )

      if (!response.ok) {
        throw new Error(
          'Unable to determine account role',
        )
      }

      const redirectData =
        await response.json()

      router.push(
        redirectData.destination,
      )

      router.refresh()
    } catch {
      setError(
        'Unable to determine account type',
      )
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-5"
    >
      {mode === 'sign-up' && (
        <label className="flex flex-col gap-2 text-sm">
          Name

          <input
            name="name"
            required
            className="border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
          />
        </label>
      )}

      <label className="flex flex-col gap-2 text-sm">
        Email

        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
        />
      </label>

      <label className="flex flex-col gap-2 text-sm">
        Password

        <div className="relative">
          <input
            name="password"
            type={
              showPassword
                ? 'text'
                : 'password'
            }
            minLength={8}
            required
            autoComplete={
              mode === 'sign-in'
                ? 'current-password'
                : 'new-password'
            }
            className="w-full border border-border bg-background px-4 py-3 pr-11 text-sm outline-none focus:border-primary"
          />

          <button
            type="button"
            onClick={() =>
              setShowPassword(
                (current) =>
                  !current,
              )
            }
            aria-label={
              showPassword
                ? 'Hide password'
                : 'Show password'
            }
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-primary"
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
      </label>

      {error && (
        <p
          role="alert"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="bg-primary px-5 py-3 text-xs font-medium uppercase tracking-[0.16em] text-primary-foreground disabled:opacity-60"
      >
        {loading
          ? 'Please wait…'
          : mode === 'sign-in'
            ? 'Sign in'
            : 'Create account'}
      </button>
    </form>
  )
}
This works for both /sign-in and /sign-up because they both use the same AuthForm. �
GitHub +2
2. Category filter should be a dropdown by default
Currently your shop page has a mobile Filter button and category buttons underneath it. On desktop those category buttons are always visible. �
GitHub +1
I would simplify this considerably.
File
components/storefront.tsx
Inside ShopPageContent, replace the current category section beginning around:
{/* Categories */}
<div
  className={`${
    mobileFilters
      ? 'flex'
      : 'hidden'
  } ...`}
>
with:
{/* Category filter */}
<div className="border-b border-border py-5">
  <div className="flex items-center justify-between gap-4">
    <label
      htmlFor="category-filter"
      className="text-xs font-medium uppercase tracking-[0.14em]"
    >
      Category
    </label>

    <div className="relative">
      <select
        id="category-filter"
        value={category}
        onChange={(event) =>
          selectCategory(
            event.target.value,
          )
        }
        className="min-w-[180px] appearance-none border border-border bg-background px-4 py-2.5 pr-9 text-xs uppercase tracking-[0.1em] outline-none focus:border-primary"
      >
        <option value="All">
          All products
        </option>

        {categories.map(
          (item) => (
            <option
              key={item.id}
              value={item.slug}
            >
              {item.name}
            </option>
          ),
        )}
      </select>

      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2" />
    </div>
  </div>
</div>
You can then remove:
const [
  mobileFilters,
  setMobileFilters,
] = useState(false)
and remove the mobile Filter button.
Also remove:
setMobileFilters(false)
from selectCategory().
Your category selection logic itself is already good because it maps the URL slug to the database category. �
GitHub
The resulting UI is much cleaner:
Category                 [ All products ▼ ]
and:
Category                 [ Bedding ▼ ]
on mobile and desktop.
3. Product page — display ALL product images in carousel
This needs a small data-layer change first.
Step 3A — Add images to Product
File
lib/store-data.ts
Current Product only exposes:
image: string
even though your database has productImages and getPublishedProduct() already collects all of them. �
GitHub +1
Change:
image: string
to:
image: string
images: string[]
So:
export type Product = {
  id: string
  name: string
  category: string
  price: number
  compareAt?: number

  image: string
  images: string[]

  badge?: string
  rating: number
  reviews: number
  description: string
  sizes: string[]
  colors: string[]
  material: string
  featured?: boolean
  variants: ProductVariant[]
}
Step 3B — Actually expose all images
File
lib/storefront.ts
Inside normalizeProduct(), you already have:
const sortedImages =
  [...images].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder,
  )
Then you're currently returning only:
image:
  sortedImages[0]?.url ??
  product.image,
Change that to:
const imageUrls =
  sortedImages.length > 0
    ? sortedImages.map(
        (image) => image.url,
      )
    : [product.image]
Then return:
image:
  imageUrls[0] ??
  product.image,

images:
  imageUrls,
So that portion becomes:
const sortedImages =
  [...images].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder,
  )

const imageUrls =
  sortedImages.length > 0
    ? sortedImages.map(
        (image) => image.url,
      )
    : [product.image]
and:
return {
  id: String(product.id),

  name: product.name,

  category:
    category?.name ??
    'Uncategorized',

  price: displayPrice,

  compareAt:
    product.compareAtPrice ??
    undefined,

  image:
    imageUrls[0] ??
    product.image,

  images:
    imageUrls,

  rating:
    getProductRating(
      product.id,
    ),

  reviews:
    getProductReviews(
      product.id,
    ),

  description:
    product.description,

  sizes:
    getVariantSizes(
      activeVariants,
    ),

  colors:
    getVariantColours(
      activeVariants,
    ),

  variants:
    normalizedVariants,

  material:
    'Premium bedding',

  featured:
    product.featured,

  badge: undefined,
}
This is the correct approach because your current database query already joins productImages, orders them by sortOrder, and collects them. �
GitHub
4. Product image carousel
File
components/storefront.tsx
Add these imports:
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react'
You currently already import ChevronDown; we're simply adding the two carousel arrows. �
GitHub
Inside ProductPage, after:
const {
  products,
  addToCart,
} = useStorefrontData()
add:
const [
  activeImage,
  setActiveImage,
] = useState(0)

const productImages =
  product.images?.length
    ? product.images
    : [product.image]
Then replace the current product image block:
<div className="bg-secondary">
  <div className="aspect-[4/5] overflow-hidden">
    <img
      src={product.image}
      alt={product.name}
      className="size-full object-cover"
    />
  </div>
</div>
with:
<div className="bg-secondary">
  <div className="relative aspect-[4/5] overflow-hidden">
    <img
      src={
        productImages[
          activeImage
        ]
      }
      alt={`${product.name} ${
        activeImage + 1
      }`}
      className="size-full object-cover transition-opacity duration-300"
    />

    {productImages.length >
      1 && (
      <>
        <button
          type="button"
          onClick={() =>
            setActiveImage(
              (current) =>
                current === 0
                  ? productImages.length -
                    1
                  : current - 1,
            )
          }
          aria-label="Previous product image"
          className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow-sm transition hover:bg-background"
        >
          <ChevronLeft className="size-4" />
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveImage(
              (current) =>
                current ===
                productImages.length - 1
                  ? 0
                  : current + 1,
            )
          }
          aria-label="Next product image"
          className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow-sm transition hover:bg-background"
        >
          <ChevronRight className="size-4" />
        </button>
      </>
    )}
  </div>

  {productImages.length > 1 && (
    <div className="flex gap-2 overflow-x-auto p-3">
      {productImages.map(
        (image, index) => (
          <button
            key={`${image}-${index}`}
            type="button"
            onClick={() =>
              setActiveImage(index)
            }
            aria-label={`View product image ${
              index + 1
            }`}
            className={`size-16 shrink-0 overflow-hidden border-2 transition ${
              activeImage === index
                ? 'border-primary'
                : 'border-transparent'
            }`}
          >
            <img
              src={image}
              alt=""
              className="size-full object-cover"
            />
          </button>
        ),
      )}
    </div>
  )}
</div>
Now you have:
        ┌──────────────────────┐
        │                      │
        │      MAIN IMAGE      │
        │                      │
        │   ←              →   │
        │                      │
        └──────────────────────┘

       [img] [img] [img] [img]
The arrows work on mobile, desktop, and touch users can also select the thumbnails.
5. Reduce product-page typography
I agree with you here. The current product title is too aggressive:
text-4xl sm:text-5xl lg:text-6xl
That's 36 → 48 → 60px, which is more editorial/landing-page typography than normal ecommerce product-detail typography. �
GitHub
I'd use:
Product title
Replace:
<h1 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl lg:text-6xl">
with:
<h1 className="mt-3 max-w-xl font-serif text-3xl leading-tight tracking-tight sm:text-4xl lg:text-[42px]">
So:
Mobile       30px
Tablet       36px
Desktop      42px
That's much more appropriate.
Product price
Replace:
<span className="font-serif text-2xl">
with:
<span className="font-serif text-xl sm:text-2xl">
Description
Keep:
text-sm leading-7
That's already a good ecommerce body size.
Material value
Current:
text-sm
Keep it.
Product option labels
Keep:
text-xs
That's appropriate for labels like Size, Colour and Quantity. �
GitHub
Product detail headings
Current:
text-xs
Keep them.
So the standard becomes:
Element
Recommended
Product title
30–42px
Price
20–24px
Body
14px
Labels
12px
Micro labels
10px
Buttons
12px
Rating
12px
That will make the product page feel much less oversized.
6. More from the collection — exactly 2 products
Your current related section uses:
sm:grid-cols-2
lg:grid-cols-3
so desktop shows three products. �
GitHub
Change:
<div className="mt-10 grid gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
to:
<div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10">
I'd also change the related heading because the current:
text-4xl sm:text-5xl
is unnecessarily large.
Use:
<h2 className="mt-3 font-serif text-2xl tracking-tight sm:text-3xl">
  More from the
  collection
</h2>
The result:
More from the collection

┌──────────────┐ ┌──────────────┐
│              │ │              │
│   Product    │ │   Product    │
│              │ │              │
└──────────────┘ └──────────────┘
Exactly two.
One important TypeScript consequence
Once you add:
images: string[]
to Product, any manually constructed Product objects elsewhere in the repo will need an images property.
Your main database normalization path is already centralized in lib/storefront.ts, so this should be minimal. But run:
pnpm tsc --noEmit
after the changes.
Then:
pnpm run build
Don't skip the build. Your repo has previously had Vercel-only prerender/type failures.
Final file map
components/
├── auth-form.tsx          ← password preview
└── storefront.tsx         ← filter, carousel, typography, related grid

lib/
├── store-data.ts          ← Product.images
└── storefront.ts          ← expose all DB product images
The most important architectural point is don't try to build the carousel directly from the current product.image. Your DB already has multiple productImages; the current normalization layer is simply discarding them. Fixing that layer gives the product page access to the complete image set without creating a second database query. �
GitHub