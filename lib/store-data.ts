

export type StorefrontCategory = {
  id: number
  name: string
  slug: string
  image: string
  count: string
}


export type ProductVariant = {
  id: number
  name: string
  price: number
  stock: number
}

export type Product = {
  id: string
  name: string
  category: string
  price: number
  compareAt?: number
  image: string
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

export type CartItem = {
  id:number
  productId: string
  variantId: number | null
  quantity: number
  size?: string
  color?: string
}

export const formatPrice = (price: number) =>
  `₦${price.toLocaleString('en-NG')}`


export function findProduct(
  products: Product[],
  id: string | number,
): Product | undefined {
  const productId = String(id)

  return products.find(
    (product) =>
      String(product.id) === productId,
  )
}

export function relatedProducts(
  products: Product[],
  product: Product,
): Product[] {
  return products
    .filter(
      (item) =>
        item.id !== product.id &&
        item.category === product.category,
    )
    .slice(0, 3)
}


export function cartSubtotal(
  cart: CartItem[],
  products: Product[],
): number {
  return cart.reduce(
    (total, item) => {
      const product =
        findProduct(
          products,
          item.productId,
        )

      if (!product) {
        return total
      }

      const variant =
        item.variantId == null
          ? undefined
          : product.variants.find(
              (variant) =>
                Number(variant.id) ===
                Number(item.variantId),
            )

      const unitPrice =
        variant?.price ??
        product.price

      return (
        total +
        unitPrice *
          item.quantity
      )
    },
    0,
  )
}

export function getCartItems(
  cart: CartItem[],
  products: Product[],
) {
  return cart
    .map((item) => ({
      ...item,
      product: findProduct(products, item.productId),
    }))
    .filter(
      (
        item,
      ): item is typeof item & { product: Product } =>
        Boolean(item.product),
    )
}

export function getCartCount(cart: CartItem[]): number {
  return cart.reduce(
    (total, item) => total + item.quantity,
    0,
  )
}

/*
 * These are marketing/content assets.
 *
 * They are not product/catalog data, so keeping them here is fine.
 */

export const heroImage =
  'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1800&q=90'

export const editorialImage =
  'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=85'

export const testimonials = [
  {
    quote:
      'The quality is absolutely beautiful. My room feels like a boutique hotel now.',
    name: 'Amara O.',
    location: 'Lagos',
  },
  {
    quote:
      'Everything arrived beautifully wrapped and the bedding is even softer than I expected.',
    name: 'Tolu A.',
    location: 'Abuja',
  },
  {
    quote:
      'Finally, bedding that feels considered and luxurious without being over the top.',
    name: 'Nneka E.',
    location: 'Port Harcourt',
  },
]

