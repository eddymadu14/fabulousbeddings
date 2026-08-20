'use client'

import Link from 'next/link'
import {
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation'

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  Suspense
} from 'react'

import {
  Heart,
  Menu,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Star,
  X,
  ArrowRight,
  ChevronDown,
  Check,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react'

import {
  cartSubtotal,
  editorialImage,
  findProduct,
  formatPrice,
  getCartCount,
  getCartItems,
  heroImage,
  relatedProducts,
  testimonials,
  type CartItem,
  type Product,
  type StorefrontCategory,
} from '@/lib/store-data'


import {
  signOut,
  useSession,
} from '@/lib/auth-client'

type StorefrontData = {
  products: Product[]
  categories: StorefrontCategory[]

  cart: CartItem[]

  addToCart: (
    productId: string,
    size?: string,
    color?: string,
    quantity?:number,
      variantId?: number | null,

  ) => void



updateQuantity: (
  itemId: number,
  amount: number,
) => Promise<void>

removeFromCart: (
  itemId: number,
) => Promise<void>

  clearCart: () => void
}
const StorefrontDataContext =
  createContext<StorefrontData | null>(
    null,
  )

function useStorefrontData() {
  const context =
    useContext(
      StorefrontDataContext,
    )

  if (!context) {
    throw new Error(
      'useStorefrontData must be used inside StorefrontShell',
    )
  }

  return context
}

const navItems = [
  { label: 'Shop', href: '/shop' },

  {
    label: 'Bedding',
    href: '/shop?category=bedsheets',
  },

  {
    label: 'Pillows',
    href: '/shop?category=pillows',
  },

  {
    label: 'Duvets',
    href: '/shop?category=duvets',
  },

  {
    label: 'Our story',
    href: '/about',
  },
]



function getVariant(
  product: Product,
  size?: string,
  color?: string,
  variantId?: number | null,
) {
  // If an exact variant ID was supplied,
  // ALWAYS use it.
  if (variantId != null) {
    return product.variants.find(
      (variant) =>
        Number(variant.id) ===
        Number(variantId),
    )
  }

  // No variant ID supplied.
  // This is primarily for Quick Add.
  const defaultVariant =
    product.variants?.[0]

  return defaultVariant
}

export function StorefrontShell({
  children,
  products = [],
  categories = [],
}: {
  children: React.ReactNode
  products: Product[]
  categories: StorefrontCategory[]
}) {
  const [cart, setCart] =
    useState<CartItem[]>([])



useEffect(() => {
  let cancelled = false

  async function loadCart() {
    try {
      const response =
        await fetch(
          '/api/cart',
          {
            credentials:
              'include',
          },
        )

      if (!response.ok) {
        return
      }

      const data =
        await response.json()

      if (!cancelled) {
        setCart(
          data.items ?? [],
        )
      }
    } catch (error) {
      console.error(
        'Failed to load cart',
        error,
      )
    }
  }

  loadCart()

  return () => {
    cancelled = true
  }
}, [])


  const [wishlist, setWishlist] =
    useState<string[]>([])

  const [cartOpen, setCartOpen] =
    useState(false)

  const [menuOpen, setMenuOpen] =
    useState(false)

  const [toast, setToast] =
    useState('')

  const router =
    useRouter()

  const pathname =
    usePathname()

  const count =
    getCartCount(cart)

  const notify = (
    message: string,
  ) => {
    setToast(message)

    window.setTimeout(
      () => setToast(''),
      2600,
    )
  }



const addToCart = async (
  productId: string,
  size?: string,
  color?: string,
  quantity: number = 1,
  variantId?: number | null,
) => {
  const product = findProduct(
    products,
    productId,
  )

  if (!product) {
    return
  }

  
const variant =
  getVariant(
    product,
    size,
    color,
    variantId,
  )

const resolvedVariantId =
  variant?.id ?? null

const existingItem =
  cart.find(
    (item) =>
      String(item.productId) ===
        String(productId) &&
      Number(
        item.variantId ?? 0,
      ) ===
        Number(
          resolvedVariantId ?? 0,
        ),
  )
  
if (existingItem) {
  await updateQuantity(
    existingItem.id,
    quantity,
  )

  return
}

  const itemSize =
    size ??
    product.sizes[0] ??
    ''

  const itemColor =
    color ??
    product.colors[0] ??
    ''

  /*
   * If the caller explicitly supplied a
   * variantId, that variant is authoritative.
   *
   * This is what the product page uses.
   *
   * Quick Add can omit variantId and we
   * resolve the first/default variant.
   */
  let selectedVariant =
    variantId != null
      ? product.variants.find(
          (variant) =>
            Number(variant.id) ===
            Number(variantId),
        )
      : undefined

  /*
   * Quick Add fallback:
   * resolve the first variant matching
   * the product's default size/color.
   */
  if (!selectedVariant) {
    const colourName =
      itemColor.split(':')[0] ??
      itemColor

    selectedVariant =
      product.variants.find(
        (variant) => {
          const parts =
            variant.name
              .split(' — ')
              .map((part) =>
                part.trim(),
              )

          const variantSize =
            parts[0] ?? ''

          const variantColor =
            parts
              .slice(1)
              .join(' — ')

          return (
            variantSize ===
              itemSize &&
            (
              variantColor
                .toLowerCase() ===
                colourName.toLowerCase() ||
              variant.name
                .toLowerCase()
                .includes(
                  colourName.toLowerCase(),
                )
            )
          )
        },
      )
  }

 
  /*
   * IMPORTANT:
   *
   * Check the existing local cart first.
   *
   * Same product + same variant =
   * increase quantity.
   *
   * Different variant =
   * separate cart line.
   */

  if (existingItem) {
    await updateQuantity(
      existingItem.id,
      quantity,
    )

    notify(
      `${product.name} quantity updated`,
    )

    return
  }

  const response =
    await fetch(
      '/api/cart',
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          productId,
          variantId:
            resolvedVariantId,
          quantity: Math.max(
            1,
            quantity,
          ),
        }),
      },
    )

  if (!response.ok) {
    notify(
      'Unable to add item to your bag',
    )
    return
  }

  const data =
    await response.json()

  setCart(
    data.items ?? [],
  )

  notify(
    `${product.name} added to your bag`,
  )
}





const updateQuantity = async (
  itemId: number,
  amount: number,
) => {
  const currentItem = cart.find(
    (item) => item.id === itemId,
  )

  if (!currentItem) {
    console.error(
      'Cart item not found in local state',
      { itemId },
    )
    return
  }

  const quantity =
    currentItem.quantity + amount

  try {
    const response = await fetch(
      '/api/cart',
      {
        method: 'PATCH',
        headers: {
          'Content-Type':
            'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          itemId,
          quantity,
        }),
      },
    )

    const data =
      await response.json()

    if (!response.ok) {
      console.error(
        'Cart update failed',
        data,
      )
      return
    }

    setCart(
      data.items ?? [],
    )
  } catch (error) {
    console.error(
      'Failed to update cart quantity',
      error,
    )
  }
}



const removeFromCart = async (
  itemId: number,
) => {
  try {
    const response = await fetch(
      '/api/cart',
      {
        method: 'DELETE',
        headers: {
          'Content-Type':
            'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          itemId,
        }),
      },
    )

    const data =
      await response.json()

    if (!response.ok) {
      console.error(
        'Cart removal failed',
        data,
      )
      return
    }

    setCart(
      data.items ?? [],
    )
  } catch (error) {
    console.error(
      'Failed to remove cart item',
      error,
    )
  }
}

const clearCart = async () => {
  const items = [...cart]

  for (const item of items) {
    await fetch(
      '/api/cart',
      {
        method: 'DELETE',

        headers: {
          'Content-Type':
            'application/json',
        },

        credentials:
          'include',

       
body: JSON.stringify({
  itemId: item.id,
}),
      },
    )
  }

  setCart([])
}

  const toggleWishlist = (
    productId: string,
  ) => {
    setWishlist(
      (current) =>
        current.includes(productId)
          ? current.filter(
              (id) =>
                id !== productId,
            )
          : [
              ...current,
              productId,
            ],
    )

    notify(
      wishlist.includes(
        productId,
      )
        ? 'Removed from wishlist'
        : 'Saved to wishlist',
    )
  }



  return (
    <StorefrontDataContext.Provider
      value={{
        products,
        categories, 
        cart, 
        addToCart,
        updateQuantity,
        removeFromCart,
         clearCart,
      }}
    >
      <div className="min-h-screen bg-background text-foreground">
        <AnnouncementBar />

        <Header
          count={count}
          menuOpen={menuOpen}
          setMenuOpen={
            setMenuOpen
          }
          onCart={() =>
            setCartOpen(true)
          }
        />

        {menuOpen && (
          <MobileMenu
            onClose={() =>
              setMenuOpen(false)
            }
          />
        )}

        <main>
          {pathname ===
          '/shop' ? (
            <ShopPage
              onAdd={
                addToCart
              }
            />
          ) : (
            children
          )}
        </main>

        <Footer />

        <CartDrawer
          open={cartOpen}
          onClose={() =>
            setCartOpen(false)
          }
          cart={cart}
          updateQuantity={
            updateQuantity
          }
          removeFromCart={
            removeFromCart
          }
          onCheckout={() => {
            setCartOpen(false)
            router.push(
              '/checkout',
            )
          }}
        />

        {toast && (
          <div
            role="status"
            className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm text-primary-foreground shadow-xl"
          >
            <Check className="size-4" />

            {toast}
          </div>
        )}
      </div>
    </StorefrontDataContext.Provider>
  )
}

function AnnouncementBar() {
  return <div className="bg-primary px-4 py-2 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-primary-foreground">Complimentary delivery on orders over ₦150,000</div>
}


function Header({
  count,
  menuOpen,
  setMenuOpen,
  onCart,
}: {
  count: number
  menuOpen: boolean
  setMenuOpen: (value: boolean) => void
  onCart: () => void
}) {
  const {
    data: session,
  } = useSession()

  const router = useRouter()


  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-10">

        {/* Mobile menu */}
        <button
          type="button"
          className="rounded-full p-2 md:hidden"
          aria-label={
            menuOpen
              ? 'Close menu'
              : 'Open menu'
          }
          onClick={() =>
            setMenuOpen(!menuOpen)
          }
        >
          {menuOpen ? (
            <X />
          ) : (
            <Menu />
          )}
        </button>

        {/* Logo */}
        <Link
          href="/"
          className="font-serif text-2xl font-semibold tracking-tight text-primary md:text-[28px]"
        >
          fabulous
          <span className="font-sans text-[11px] font-medium uppercase tracking-[0.35em] text-accent-foreground">
            {' '}
            beddings
          </span>
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden items-center gap-7 md:flex">
          {navItems.map(
            (item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-primary"
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-1">

          {/* Authentication */}
          {session?.user ? (
            <>
              <span className="hidden max-w-[120px] truncate px-2 text-[10px] uppercase tracking-[0.1em] text-muted-foreground lg:block">
                Hi,{' '}
                {session.user.name ||
                  session.user.email}
              </span>

              <button
                type="button"
                onClick={async () => {
                  await signOut()
                  router.push('/')
                  router.refresh()
                }}
                className="hidden px-2 py-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-primary sm:block"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="px-2 py-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-primary"
              >
                Login
              </Link>

              <Link
                href="/sign-up"
                className="hidden px-2 py-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-primary sm:block"
              >
                Register
              </Link>
            </>
          )}

          {/* Search */}
          <Link
            href="/shop"
            aria-label="Search"
            className="rounded-full p-2.5 transition-colors hover:bg-muted"
          >
            <Search className="size-[18px]" />
          </Link>

          {/* Wishlist */}
          <Link
            href="/wishlist"
            aria-label="Wishlist"
            className="hidden rounded-full p-2.5 transition-colors hover:bg-muted sm:block"
          >
            <Heart className="size-[18px]" />
          </Link>

          {/* Cart */}
          <button
            type="button"
            onClick={onCart}
            aria-label={`Shopping bag with ${count} items`}
            className="relative rounded-full p-2.5 transition-colors hover:bg-muted"
          >
            <ShoppingBag className="size-[18px]" />

            {count > 0 && (
              <span className="absolute right-0 top-0 flex size-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  )
}


function MobileMenu({
  onClose,
}: {
  onClose: () => void
}) {
  const {
    data: session,
  } = useSession()

  return (
    <div className="border-b border-border bg-background px-6 py-5 md:hidden">
      <nav className="flex flex-col gap-4">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className="font-serif text-xl"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Mobile account actions */}
      <div className="mt-6 border-t border-border pt-5">
        {session?.user ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Hi,{' '}
              {session.user.name ||
                session.user.email}
            </p>

            <button
              type="button"
              onClick={async () => {
                await signOut()
                onClose()
                window.location.href = '/'
              }}
              className="text-left text-sm text-muted-foreground"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="flex gap-5">
            <Link
              href="/sign-in"
              onClick={onClose}
              className="text-sm text-muted-foreground"
            >
              Login
            </Link>

            <Link
              href="/sign-up"
              onClick={onClose}
              className="text-sm text-muted-foreground"
            >
              Register
            </Link>
          </div>
        )}
      </div>

      <div className="mt-5 flex gap-5 border-t border-border pt-5">
        <Link
          href="/contact"
          onClick={onClose}
          className="text-sm text-muted-foreground"
        >
          Contact
        </Link>

        <Link
          href="/wishlist"
          onClick={onClose}
          className="text-sm text-muted-foreground"
        >
          Wishlist
        </Link>

        <Link
          href="/cart"
          onClick={onClose}
          className="text-sm text-muted-foreground"
        >
          Cart
        </Link>
      </div>
    </div>
  )
}

function Footer() {
  return <footer className="mt-20 bg-primary px-5 py-14 text-primary-foreground lg:px-10"><div className="mx-auto max-w-7xl"><div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1.4fr]"><div><Link href="/" className="font-serif text-3xl">fabulous</Link><p className="mt-4 max-w-xs text-sm leading-6 text-primary-foreground/70">Beautiful bedding for the rituals that make a house feel like home.</p><div className="mt-6 flex gap-3"><a href="#" aria-label="Instagram" className="rounded-full border border-primary-foreground/25 px-3 py-2 font-mono text-[10px]">ig</a><a href="#" aria-label="Facebook" className="rounded-full border border-primary-foreground/25 px-3 py-2 font-mono text-[10px]">fb</a></div></div><div><h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary-foreground/50">Explore</h2><nav className="mt-4 flex flex-col gap-3 text-sm"><Link href="/shop">Shop all</Link><Link href="/shop?category=Bedding">Bedding</Link><Link href="/shop?category=Accessories">Accessories</Link><Link href="/about">Our story</Link></nav></div><div><h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary-foreground/50">Help</h2><nav className="mt-4 flex flex-col gap-3 text-sm"><Link href="/contact">Contact us</Link><Link href="/shipping">Shipping & returns</Link><Link href="/faq">FAQs</Link><Link href="/size-guide">Size guide</Link></nav></div><div><h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary-foreground/50">Stay in the know</h2><p className="mt-4 text-sm leading-6 text-primary-foreground/70">Seasonal notes, new arrivals and thoughtful home inspiration.</p><form className="mt-4 flex border-b border-primary-foreground/40 pb-2" onSubmit={(event) => event.preventDefault()}><input aria-label="Email address" placeholder="Your email address" type="email" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-primary-foreground/45" /><button aria-label="Subscribe"><ArrowRight className="size-4" /></button></form></div></div><div className="mt-14 flex flex-col gap-3 border-t border-primary-foreground/15 pt-5 text-[10px] uppercase tracking-[0.16em] text-primary-foreground/45 sm:flex-row sm:items-center sm:justify-between"><span>© 2024 Fabulous Beddings</span><span>Made for slow mornings</span></div></div></footer>
}


function CartDrawer({
  open,
  onClose,
  cart,
  updateQuantity,
  removeFromCart,
  onCheckout,
}: {
  open: boolean
  onClose: () => void
  cart: CartItem[]

 
updateQuantity: (
  itemId: number,
  amount: number,
) => Promise<void>

removeFromCart: (
  itemId: number,
) => Promise<void>

  onCheckout: () => void
}) {

  const {
    products,
  } = useStorefrontData()

  const items =
    getCartItems(
      cart,
      products,
    )

  const subtotal =
    cartSubtotal(
      cart,
      products,
    )

  if (!open) {
    return null
  }

  
  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Shopping bag"
    >
      {/* Overlay */}
      <button
        type="button"
        aria-label="Close shopping bag"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      {/* Drawer */}
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Your selection
            </p>

            <h2 className="mt-1 font-serif text-2xl">
              Shopping bag
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close shopping bag"
            className="rounded-full p-2 transition-colors hover:bg-muted"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <ShoppingBag className="size-10 text-muted-foreground/50" />

              <h3 className="mt-5 font-serif text-2xl">
                Your bag is empty
              </h3>

              <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
                Add something beautiful to your
                collection and it will appear here.
              </p>

              <Link
                href="/shop"
                onClick={onClose}
                className="mt-6 bg-primary px-5 py-3 text-xs uppercase tracking-[0.12em] text-primary-foreground"
              >
                Shop the collection
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {items.map(
                (
                  {
                    id,
                    product,
                    quantity,
                    size,
                    color,
                    variantId,
                  },
                ) => {
                  if (!product) {
                    return null
                  }

                  return (
                    <div
                      key={id}
                      className="flex gap-4 border-b border-border pb-6"
                    >
                      <Link
                        href={`/product/${product.id}`}
                        onClick={onClose}
                        className="shrink-0"
                      >
                        <img
                          src={product.image}
                          alt={product.name}
                          className="size-24 object-cover"
                        />
                      </Link>

                      <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
                        <div>
                          <div className="flex justify-between gap-3">
                            <div className="min-w-0">
                              <Link
                                href={`/product/${product.id}`}
                                onClick={onClose}
                              >
                                <h3 className="truncate font-serif text-lg">
                                  {product.name}
                                </h3>
                              </Link>

                              <p className="mt-1 text-xs text-muted-foreground">
                                {size}
                                {color
                                  ? ` · ${color}`
                                  : ''}
                              </p>
                            </div>

                            <span className="shrink-0 text-sm">
                             
{formatPrice(
  (
    product.variants.find(
      (variant) =>
        Number(variant.id) ===
        Number(variantId),
    )?.price ??
    product.price
  ) * quantity,
)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center border border-border">
                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(
                                  id,
                                  -1,
                                )
                              }
                              className="p-2 hover:bg-secondary"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="size-3" />
                            </button>

                            <span className="w-8 text-center text-xs">
                              {quantity}
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(
                                    id,
                                  1,
                                )
                              }
                              className="p-2 hover:bg-secondary"
                              aria-label="Increase quantity"
                            >
                              <Plus className="size-3" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              removeFromCart(id)
                            }}
                            className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-primary"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                },
              )}
            </div>
          )}
        </div>

        {/* Summary */}
        {items.length > 0 && (
          <div className="border-t border-border bg-secondary px-6 py-6">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Subtotal
              </span>

              <span>
                {formatPrice(subtotal)}
              </span>
            </div>

            <div className="mt-2 flex justify-between text-sm">
              <span className="text-muted-foreground">
                Delivery
              </span>

              <span>
                {subtotal >= 150000
                  ? 'Complimentary'
                  : 'Calculated at checkout'}
              </span>
            </div>

            <div className="mt-5 flex justify-between border-t border-border pt-5 font-serif text-xl">
              <span>Total</span>

              <span>
                {formatPrice(subtotal)}
              </span>
            </div>

            <button
              type="button"
              onClick={onCheckout}
              className="mt-6 flex w-full items-center justify-center gap-2 bg-primary py-4 text-xs uppercase tracking-[0.14em] text-primary-foreground"
            >
              Checkout
              <ArrowRight className="size-4" />
            </button>
          </div>
        )}
      </aside>
    </div>
  )
}
export function Hero() {
  return <section className="relative isolate min-h-[600px] overflow-hidden bg-secondary lg:min-h-[650px]"><img src={heroImage} alt="A softly made bed in a sunlit bedroom" className="absolute inset-0 size-full object-cover object-center" /><div className="absolute inset-0 bg-primary/35" /><div className="relative mx-auto flex min-h-[600px] max-w-7xl items-end px-5 pb-16 lg:min-h-[650px] lg:px-10 lg:pb-20"><div className="max-w-xl text-primary-foreground"><p className="font-mono text-[10px] uppercase tracking-[0.28em]">The art of a beautiful night</p><h1 className="mt-5 font-serif text-5xl leading-[0.95] tracking-tight sm:text-6xl lg:text-8xl">Your softest<br /><em className="font-normal">place to land.</em></h1><p className="mt-6 max-w-sm text-sm leading-6 text-primary-foreground/85">Thoughtfully made bedding for bedrooms that feel like a deep breath.</p><Link href="/shop" className="mt-8 inline-flex items-center gap-3 bg-primary-foreground px-6 py-4 text-xs font-medium uppercase tracking-[0.16em] text-primary transition-colors hover:bg-accent">Shop the collection <ArrowRight className="size-4" /></Link></div></div><div className="absolute bottom-6 right-6 hidden items-center gap-3 text-primary-foreground/80 md:flex"><span className="h-px w-12 bg-primary-foreground/50" /><span className="font-mono text-[10px] uppercase tracking-[0.2em]">Scroll to explore</span></div></section>
}

export function CategorySection() {
  const {
    categories,
  } = useStorefrontData()

  return (
    <section className="mx-auto max-w-7xl px-5 py-20 lg:px-10 lg:py-28">
      <div className="flex items-end justify-between gap-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent-foreground">
            Find your comfort
          </p>

          <h2 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">
            Shop by feeling
          </h2>
        </div>

        <Link
          href="/shop"
          className="hidden items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] md:flex"
        >
          View all

          <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
        {categories.map(
          (
            category,
            index,
          ) => (
            <Link
              key={
                category.id
              }
              href={`/shop?category=${encodeURIComponent(
                category.slug
              )}`}
              className={`group relative aspect-[0.8] overflow-hidden bg-muted ${
                index === 0
                  ? 'col-span-2 md:col-span-1'
                  : ''
              }`}
            >
              <img
                src={
                  category.image
                }
                alt={
                  category.name
                }
                className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105"
              />

              <div className="absolute inset-0 bg-primary/20 transition-colors group-hover:bg-primary/35" />

              <div className="absolute inset-x-4 bottom-4 text-primary-foreground">
                <p className="font-serif text-2xl">
                  {
                    category.name
                  }
                </p>

                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] opacity-80">
                  {
                    category.count
                  }
                </p>
              </div>
            </Link>
          ),
        )}
      </div>

      <Link
        href="/shop"
        className="mt-7 flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-[0.14em] md:hidden"
      >
        View all products

        <ArrowRight className="size-4" />
      </Link>
    </section>
  )
}

export function FeaturedProducts({
  onAdd,
}: {
  onAdd?: (
    id: string,
  ) => void
}) {
  const {
    products,
  } = useStorefrontData()

  const featuredProducts =
    products.filter(
      (product) =>
        product.featured,
    )

  return (
    <section className="bg-secondary/50 px-5 py-20 lg:px-10 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-end justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent-foreground">
              Quiet luxuries
            </p>

            <h2 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">
              The considered edit
            </h2>
          </div>

          <Link
            href="/shop"
            className="hidden items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] md:flex"
          >
            Shop all

            <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="mt-10 grid gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {featuredProducts.map(
            (product) => (
              <ProductCard
                key={product.id}
                product={
                  product
                }
                onAdd={
                  onAdd
                }
              />
            ),
          )}
        </div>
      </div>
    </section>
  )
}

export function ProductCard({
  product,
  onAdd,
  wishlist,
  onWishlist,
}: {
  product: Product

  
onAdd?: (
  productId: string,
  size?: string,
  color?: string,
  quantity?: number,
  variantId?: number | null,
) => void
  wishlist?: boolean
  onWishlist?: (id: string) => void
}) {
  const {
    addToCart,
  } = useStorefrontData()


const handleQuickAdd = () => {
  const defaultVariant =
    product.variants?.[0]

  if (onAdd) {
    onAdd(
      product.id,
      undefined,
      undefined,
      1,
      defaultVariant?.id ??
        null,
    )

    return
  }

  addToCart(
    product.id,
    undefined,
    undefined,
    1,
    defaultVariant?.id ??
      null,
  )
}

  return (
    <article className="group">
      <div className="relative overflow-hidden rounded-xl bg-muted">
        <Link
          href={`/product/${product.id}`}
        >
          <img
            src={product.image}
            alt={product.name}
            className="aspect-[0.92] w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        </Link>

        {product.badge && (
          <span className="absolute left-2.5 top-2.5 rounded-md bg-primary px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-primary-foreground">
            {product.badge}
          </span>
        )}

        {onWishlist && (
          <button
            type="button"
            aria-label={
              wishlist
                ? `Remove ${product.name} from wishlist`
                : `Add ${product.name} to wishlist`
            }
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onWishlist(product.id)
            }}
            className="absolute right-2.5 top-2.5 rounded-full bg-background/90 p-2 transition-colors hover:bg-background"
          >
            <Heart
              className={`size-3.5 ${
                wishlist
                  ? 'fill-accent text-accent'
                  : ''
              }`}
            />
          </button>
        )}

        <button
          type="button"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            handleQuickAdd()
          }}
          className="absolute inset-x-2.5 bottom-2.5 rounded-lg bg-background py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] opacity-100 transition-all md:translate-y-12 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100"
        >
          Quick add
        </button>
      </div>

      <Link
        href={`/product/${product.id}`}
        className="block"
      >
        <div className="mt-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-[13px] font-medium">
              {product.name}
            </h3>

            <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <Star className="size-2.5 fill-accent text-accent" />
              {product.rating}
              <span>
                ({product.reviews})
              </span>
            </div>
          </div>

          <div className="text-right text-[13px]">
            <span>
              {formatPrice(
                product.price,
              )}
            </span>

            {product.compareAt && (
              <span className="ml-1.5 text-[10px] text-muted-foreground line-through">
                {formatPrice(
                  product.compareAt,
                )}
              </span>
            )}
          </div>
        </div>
      </Link>
    </article>
  )
}

export function EditorialSection() {
  return <section className="mx-auto max-w-7xl px-5 py-20 lg:px-10 lg:py-28"><div className="grid items-center gap-10 md:grid-cols-2 md:gap-16"><div className="relative aspect-[0.95] overflow-hidden"><img src={editorialImage} alt="A quiet bedroom with layered neutral bedding" className="size-full object-cover" /><div className="absolute bottom-5 left-5 bg-background px-4 py-3"><span className="font-mono text-[9px] uppercase tracking-[0.18em]">Since 2018 · Lagos</span></div></div><div className="max-w-md"><p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent-foreground">Made for the everyday</p><h2 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">A softer way to live.</h2><p className="mt-6 text-sm leading-7 text-muted-foreground">We believe the bedroom is more than a room. It is where the day begins, where it ends, and where you return to yourself. Our bedding is designed to make that return feel a little more beautiful.</p><Link href="/about" className="mt-8 inline-flex items-center gap-3 border-b border-primary pb-2 text-xs font-medium uppercase tracking-[0.16em]">Our story <ArrowRight className="size-4" /></Link></div></div></section>
}

export function TestimonialSection() {
  return <section className="border-y border-border bg-secondary/50 px-5 py-20 lg:px-10 lg:py-24"><div className="mx-auto max-w-5xl text-center"><p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent-foreground">The good word</p><div className="mt-10 grid gap-8 md:grid-cols-3">{testimonials.map((item) => <figure key={item.name} className="flex flex-col items-center"><div className="flex gap-1 text-accent"><Star className="size-3 fill-current" /><Star className="size-3 fill-current" /><Star className="size-3 fill-current" /><Star className="size-3 fill-current" /><Star className="size-3 fill-current" /></div><blockquote className="mt-5 font-serif text-xl leading-7">“{item.quote}”</blockquote><figcaption className="mt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{item.name} · {item.location}</figcaption></figure>)}</div></div></section>
}

export function NewsletterSection() {
  return <section className="bg-accent px-5 py-16 text-accent-foreground lg:px-10"><div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 md:flex-row md:items-center"><div><p className="font-mono text-[10px] uppercase tracking-[0.24em]">A note from us</p><h2 className="mt-3 font-serif text-3xl sm:text-4xl">Make room for beautiful things.</h2></div><form className="flex w-full max-w-md border-b border-accent-foreground/50 pb-3" onSubmit={(event) => event.preventDefault()}><input type="email" required aria-label="Your email address" placeholder="Your email address" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-accent-foreground/60" /><button aria-label="Subscribe"><ArrowRight className="size-5" /></button></form></div></section>
}

export function ShopPageContent({
  onAdd,
}: {
  onAdd?: (id: string) => void
}) {
  const {
    products,
    categories,
  } = useStorefrontData()

  const router = useRouter()
  const searchParams = useSearchParams()

  const categoryFromUrl =
    searchParams.get('category') ?? 'All'

  const [
    category,
    setCategory,
  ] = useState<string>(
    categoryFromUrl,
  )

  const [
    sort,
    setSort,
  ] = useState('featured')

  const [
    mobileFilters,
    setMobileFilters,
  ] = useState(false)

  /*
   * Keep the selected category synchronized
   * with the URL.
   */
  useEffect(() => {
    setCategory(categoryFromUrl)
  }, [categoryFromUrl])

  /*
   * Filter products by the category slug.
   *
   * Products returned by storefront.ts have
   * category information attached to them.
   *
   * We resolve the selected category slug
   * to its category name, then compare that
   * against product.category.
   */
  const filteredProducts = useMemo(() => {
    if (category === 'All') {
      return products
    }

    const selectedCategory =
      categories.find(
        (item) =>
          item.slug === category,
      )

    if (!selectedCategory) {
      return []
    }

    const filtered =
      products.filter(
        (product) =>
          product.category ===
          selectedCategory.name,
      )

    return [...filtered].sort(
      (a, b) => {
        if (sort === 'low') {
          return a.price - b.price
        }

        if (sort === 'high') {
          return b.price - a.price
        }

        if (sort === 'featured') {
          return (
            Number(b.featured) -
            Number(a.featured)
          )
        }

        return 0
      },
    )
  }, [
    category,
    categories,
    products,
    sort,
  ])

  /*
   * Sort the complete product list when
   * "All" is selected.
   */
  const displayedProducts = useMemo(() => {
    if (category !== 'All') {
      return filteredProducts
    }

    return [...filteredProducts].sort(
      (a, b) => {
        if (sort === 'low') {
          return a.price - b.price
        }

        if (sort === 'high') {
          return b.price - a.price
        }

        if (sort === 'featured') {
          return (
            Number(b.featured) -
            Number(a.featured)
          )
        }

        return 0
      },
    )
  }, [
    category,
    filteredProducts,
    sort,
  ])

  const selectCategory = (
    slug: string,
  ) => {
    setCategory(slug)

    if (slug === 'All') {
      router.push('/shop')
    } else {
      router.push(
        `/shop?category=${encodeURIComponent(
          slug,
        )}`,
      )
    }

    setMobileFilters(false)
  }

  return (
    <div>
      <section className="bg-secondary px-5 py-14 lg:px-10 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent-foreground">
            The collection
          </p>

          <h1 className="mt-4 max-w-2xl font-serif text-5xl tracking-tight sm:text-6xl">
            Beautiful things for
            better rest.
          </h1>

          <p className="mt-5 max-w-md text-sm leading-6 text-muted-foreground">
            Explore our considered
            collection of bedding,
            pillows and finishing
            touches.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-10 lg:px-10">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-5">
          <button
            type="button"
            onClick={() =>
              setMobileFilters(
                (current) => !current,
              )
            }
            className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] md:hidden"
          >
            Filter

            <ChevronDown
              className={`size-4 transition-transform ${
                mobileFilters
                  ? 'rotate-180'
                  : ''
              }`}
            />
          </button>

          <p className="hidden text-sm text-muted-foreground md:block">
            {displayedProducts.length}{' '}
            {displayedProducts.length === 1
              ? 'piece'
              : 'pieces'}
          </p>

          <div className="flex items-center gap-3">
            <p className="hidden text-sm text-muted-foreground sm:block">
              Sort by
            </p>

            <select
              value={sort}
              onChange={(event) =>
                setSort(
                  event.target.value,
                )
              }
              aria-label="Sort products"
              className="bg-transparent text-xs font-medium uppercase tracking-[0.12em] outline-none"
            >
              <option value="featured">
                Featured
              </option>

              <option value="low">
                Price: low to high
              </option>

              <option value="high">
                Price: high to low
              </option>
            </select>
          </div>
        </div>

        {/* Categories */}
        <div
          className={`${
            mobileFilters
              ? 'flex'
              : 'hidden'
          } flex-wrap gap-2 border-b border-border py-5 md:flex`}
        >
          <button
            type="button"
            onClick={() =>
              selectCategory('All')
            }
            className={`border px-4 py-2 text-xs uppercase tracking-[0.12em] ${
              category === 'All'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:border-primary'
            }`}
          >
            All
          </button>

          {categories.map(
            (item) => (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  selectCategory(
                    item.slug,
                  )
                }
                className={`border px-4 py-2 text-xs uppercase tracking-[0.12em] ${
                  category ===
                  item.slug
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:border-primary'
                }`}
              >
                {item.name}
              </button>
            ),
          )}
        </div>

        {/* Products */}
        {displayedProducts.length > 0 ? (
<div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-4 lg:grid-cols-5 lg:gap-x-5">
            {displayedProducts.map(
              (product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAdd={onAdd}
                />
              ),
            )}
          </div>
        ) : (
          <div className="py-20 text-center">
            <p className="font-serif text-3xl">
              No products found
            </p>

            <p className="mt-3 text-sm text-muted-foreground">
              There are currently no
              published products in this
              category.
            </p>

            <button
              type="button"
              onClick={() =>
                selectCategory('All')
              }
              className="mt-6 bg-primary px-5 py-3 text-xs uppercase tracking-[0.12em] text-primary-foreground"
            >
              View all products
            </button>
          </div>
        )}
      </section>
    </div>
  )
}


export function ShopPage({
  onAdd,
}: {
  onAdd?: (id: string) => void
}) {
  return (
    <Suspense fallback={null}>
      <ShopPageContent
        onAdd={onAdd}
      />
    </Suspense>
  )
}





export function ProductPage({
  product,
}: {
  product: Product
}) {
  const {
    products,
    addToCart,
  } = useStorefrontData()

  const [
    selectedSize,
    setSelectedSize,
  ] = useState(
    product.sizes[0] ?? '',
  )

  const [
    selectedColor,
    setSelectedColor,
  ] = useState(
    product.colors[0] ?? '',
  )

  
const selectedVariant =
  product.variants.find(
    (variant) => {
      const parts =
        variant.name
          .split(' — ')
          .map((part) =>
            part.trim(),
          )

      const variantSize =
        parts[0] ?? ''

      const variantColor =
        parts
          .slice(1)
          .join(' — ')

      return (
        variantSize ===
          selectedSize &&
        variantColor
          .toLowerCase() ===
          selectedColor
            .toLowerCase()
      )
    },
  )

  const [
    quantity,
    setQuantity,
  ] = useState(1)

  const [
    added,
    setAdded,
  ] = useState(false)

  const related =
    relatedProducts(
      products,
      product,
    )

 

const handleAddToCart = () => {
  const selectedVariant =
    product.variants.find(
      (variant) => {
        const parts =
          variant.name
            .split(' — ')
            .map((part) =>
              part.trim(),
            )

        const variantSize =
          parts[0] ?? ''

        const variantColor =
          parts
            .slice(1)
            .join(' — ')

        const selectedColorName =
          selectedColor
            ?.split(':')[0] ??
          selectedColor

        return (
          variantSize ===
            selectedSize &&
          (
            variantColor
              .toLowerCase() ===
              selectedColorName.toLowerCase() ||
            variant.name
              .toLowerCase()
              .includes(
                selectedColorName.toLowerCase(),
              )
          )
        )
      },
    )

  addToCart(
    product.id,
    selectedSize,
    selectedColor,
    quantity,
    selectedVariant?.id ?? null,
  )

  setAdded(true)

  window.setTimeout(
    () => {
      setAdded(false)
    },
    2200,
  )
}

  const {
    data: session,
  } = useSession()
  return (
    <div>
      {/* =====================================================
          PRODUCT DETAILS
          ===================================================== */}

      <section className="mx-auto max-w-7xl px-5 py-10 lg:px-10 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          {/* =================================================
              PRODUCT IMAGE
              ================================================= */}

          <div className="bg-secondary">
            <div className="aspect-[4/5] overflow-hidden">
              <img
                src={product.image}
                alt={product.name}
                className="size-full object-cover"
              />
            </div>
          </div>

          {/* =================================================
              PRODUCT INFORMATION
              ================================================= */}

          <div className="flex flex-col justify-center">
            {/* Category */}

            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent-foreground">
              {product.category}
            </p>

            {/* Name */}

            <h1 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl lg:text-6xl">
              {product.name}
            </h1>

            {/* Rating */}

            <div className="mt-5 flex items-center gap-3">
              <div className="flex items-center gap-1">
                {Array.from({
                  length: 5,
                }).map(
                  (_, index) => (
                    <Star
                      key={index}
                      className="size-4 fill-current"
                    />
                  ),
                )}
              </div>

              <span className="text-xs text-muted-foreground">
                {product.rating.toFixed(
                  1,
                )}{' '}
                ·{' '}
                {product.reviews}{' '}
                reviews
              </span>
            </div>

            {/* Price */}

            <div className="mt-6 flex items-center gap-3">
              <span className="font-serif text-2xl">
                {formatPrice(
                  selectedVariant?.price ??
                  product.price,
                )}
              </span>

              {product.compareAt &&
                product.compareAt >
                  product.price && (
                  <span className="text-sm text-muted-foreground line-through">
                    {formatPrice(
                      product.compareAt,
                    )}
                  </span>
                )}
            </div>

            {/* Description */}

            <p className="mt-7 max-w-xl text-sm leading-7 text-muted-foreground">
              {
                product.description
              }
            </p>

            {/* =================================================
                MATERIAL
                ================================================= */}

            <div className="mt-8 border-y border-border py-5">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.14em]">
                  Material
                </span>

                <span className="text-sm text-muted-foreground">
                  {product.material}
                </span>
              </div>
            </div>

            {/* =================================================
                SIZE
                ================================================= */}

            {product.sizes.length >
              0 && (
              <div className="mt-8">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-[0.14em]">
                    Size
                  </p>

                  <span className="text-xs text-muted-foreground">
                    {selectedSize}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {product.sizes.map(
                    (size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() =>
                          setSelectedSize(
                            size,
                          )
                        }
                        className={`min-w-16 border px-4 py-3 text-xs uppercase tracking-[0.1em] transition-colors ${
                          selectedSize ===
                          size
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border hover:border-primary'
                        }`}
                      >
                        {size}
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}

            {/* =================================================
                COLOR
                ================================================= */}

            {product.colors.length >
              0 && (
              <div className="mt-7">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-[0.14em]">
                    Colour
                  </p>

                  <span className="text-xs text-muted-foreground">
                    {
                      selectedColor
                        ?.split(
                          ':',
                        )[0]
                    }
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-3">
                  {product.colors.map(
                    (color) => {
                      const [
                        colorName,
                        colorValue,
                      ] =
                        color.split(
                          ':',
                        )

                      return (
                        <button
                          key={
                            color
                          }
                          type="button"
                          aria-label={`Select ${colorName}`}
                          onClick={() =>
                            setSelectedColor(
                              color,
                            )
                          }
                          className={`flex size-9 items-center justify-center rounded-full border-2 transition-all ${
                            selectedColor ===
                            color
                              ? 'border-primary'
                              : 'border-transparent'
                          }`}
                        >
                          <span
                            className="size-7 rounded-full border border-black/10"
                            style={{
                              backgroundColor:
                                colorValue,
                            }}
                          />
                        </button>
                      )
                    },
                  )}
                </div>
              </div>
            )}

            {/* =================================================
                QUANTITY
                ================================================= */}

            <div className="mt-8">
              <p className="text-xs font-medium uppercase tracking-[0.14em]">
                Quantity
              </p>

              <div className="mt-3 flex w-fit items-center border border-border">
                <button
                  type="button"
                  onClick={() =>
                    setQuantity(
                      (current) =>
                        Math.max(
                          1,
                          current -
                            1,
                        ),
                    )
                  }
                  className="flex size-11 items-center justify-center hover:bg-secondary"
                  aria-label="Decrease quantity"
                >
                  <Minus className="size-4" />
                </button>

                <span className="flex size-11 items-center justify-center border-x border-border text-sm">
                  {quantity}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setQuantity(
                      (current) =>
                        current + 1,
                    )
                  }
                  className="flex size-11 items-center justify-center hover:bg-secondary"
                  aria-label="Increase quantity"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>

            {/* =================================================
                ADD TO CART
                ================================================= */}

                
{session?.user ? (
  <div className="hidden items-center gap-3 sm:flex">
    <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
      Hi,{' '}
      {session.user.name
        ?.split(' ')[0]}
    </span>

    <button
      type="button"
      onClick={() =>
        signOut()
      }
      className="text-[10px] uppercase tracking-[0.12em] hover:text-primary"
    >
      Sign out
    </button>
  </div>
) : (
  <div className="hidden items-center gap-3 sm:flex">
    <Link
      href="/sign-in"
      className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-primary"
    >
      Sign in
    </Link>

    <Link
      href="/sign-up"
      className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-primary"
    >
      Register
    </Link>
  </div>
)}

            <button
              type="button"
              onClick={
                handleAddToCart
              }
              className="mt-8 flex w-full items-center justify-center gap-2 bg-primary px-6 py-4 text-xs font-medium uppercase tracking-[0.14em] text-primary-foreground transition-opacity hover:opacity-90"
            >
              {added ? (
                <>
                  <Check className="size-4" />

                  Added to bag
                </>
              ) : (
                <>
                  <ShoppingBag className="size-4" />

                  Add to bag
                </>
              )}
            </button>

            {/* =================================================
                PRODUCT DETAILS
                ================================================= */}

            <div className="mt-8 space-y-4 border-t border-border pt-7">
              <details
                open
                className="border-b border-border pb-4"
              >
                <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.14em]">
                  Description
                </summary>

                <p className="mt-4 text-sm leading-7 text-muted-foreground">
                  {
                    product.description
                  }
                </p>
              </details>

              <details className="border-b border-border pb-4">
                <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.14em]">
                  Material & Care
                </summary>

                <p className="mt-4 text-sm leading-7 text-muted-foreground">
                  Made with{' '}
                  {
                    product.material
                  }
                  . Follow the care
                  instructions provided
                  with your product to
                  preserve its softness
                  and quality.
                </p>
              </details>

              <details className="border-b border-border pb-4">
                <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.14em]">
                  Delivery
                </summary>

                <p className="mt-4 text-sm leading-7 text-muted-foreground">
                  Delivery options and
                  estimated arrival times
                  are calculated during
                  checkout based on your
                  location.
                </p>
              </details>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          RELATED PRODUCTS
          ===================================================== */}

      {related.length > 0 && (
        <section className="bg-secondary/50 px-5 py-20 lg:px-10 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-end justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent-foreground">
                  You may also like
                </p>

                <h2 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">
                  More from the
                  collection
                </h2>
              </div>

              <Link
                href="/shop"
                className="hidden items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] md:flex"
              >
                Shop all

                <ArrowRight className="size-4" />
              </Link>
            </div>

            <div className="mt-10 grid gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {related.map(
                (relatedProduct) => (
                  <ProductCard
                    key={
                      relatedProduct.id
                    }
                    product={
                      relatedProduct
                    }
                  />
                ),
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

export function CartPage() {
  
  const {
    cart,
    products,
    updateQuantity,
    removeFromCart,
  } = useStorefrontData()

  const items =
    getCartItems(
      cart,
      products,
    )

  const subtotal =
    cartSubtotal(
      cart,
      products,
    )

  const itemCount =
    getCartCount(cart)

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 lg:px-10 lg:py-20">
      {/* =====================================================
          HEADER
          ===================================================== */}

      <div className="flex items-end justify-between border-b border-border pb-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Your selection
          </p>

          <h1 className="mt-3 font-serif text-5xl">
            Shopping bag
          </h1>
        </div>

        <span className="text-sm text-muted-foreground">
          {itemCount}{' '}
          {itemCount === 1
            ? 'item'
            : 'items'}
        </span>
      </div>

      {/* =====================================================
          CART
          ===================================================== */}

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_360px]">
        {items.length > 0 ? (
          <div className="flex flex-col gap-6">
            {items.map(
              (
                {
                  id,
                  product,
                  quantity,
                  size,
                  color,
                  variantId,
                },
                index,
              ) => {
                if (!product) {
                  return null
                }

                
const variant =
  variantId == null
    ? undefined
    : product.variants.find(
        (item) =>
          Number(item.id) ===
          Number(variantId),
      )

const unitPrice =
  variant?.price ??
  product.price

              const lineTotal =
  unitPrice * quantity
                return (
                  <div
                    key={`${product.id}-${size}-${color}-${variantId ?? 'default' }`}
                    className="flex gap-5 border-b border-border pb-6"
                  >
                    {/* Product image */}

                    <Link
                      href={`/product/${product.id}`}
                      className="shrink-0"
                    >
                      <img
                        src={
                          product.image
                        }
                        alt={
                          product.name
                        }
                        className="size-32 object-cover sm:size-40"
                      />
                    </Link>

                    {/* Product information */}

                    <div className="flex flex-1 flex-col justify-between gap-4">
                      <div className="flex justify-between gap-4">
                        <div>
                          <Link
                            href={`/product/${product.id}`}
                          >
                            <h2 className="font-serif text-2xl">
                              {
                                product.name
                              }
                            </h2>
                          </Link>

                          <div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
                            {size && (
                              <span>
                                Size:{' '}
                                {size}
                              </span>
                            )}

                            {color && (
                              <span>
                                Colour:{' '}
                                {color}
                              </span>
                            )}
                          </div>
                        </div>

                        <span className="shrink-0 text-sm">
                          {formatPrice(
                            lineTotal,
                          )}
                        </span>
                      </div>

                      {/* Quantity + remove */}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center border border-border">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                productId,
                                variantId,
                                      - 1,
                              )
                            }
                            className="p-2 hover:bg-secondary"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="size-3" />
                          </button>

                          <span className="w-8 text-center text-xs">
                            {
                              quantity
                            }
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                productId,
                                variantId,
                                  + 1,
                              )
                            }
                            className="p-2 hover:bg-secondary"
                            aria-label="Increase quantity"
                          >
                            <Plus className="size-3" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            removeFromCart(
                              productId,
                              variantId,
                            )
                          }
                          className="text-xs uppercase tracking-[0.12em] text-muted-foreground hover:text-primary"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                )
              },
            )}
          </div>
        ) : (
          /* =================================================
             EMPTY CART
             ================================================= */

          <div className="py-16 text-center lg:col-span-2">
            <ShoppingBag className="mx-auto size-10 text-muted-foreground/50" />

            <h2 className="mt-5 font-serif text-3xl">
              Your bag is empty
            </h2>

            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
              Discover something
              beautiful for your
              bedroom.
            </p>

            <Link
              href="/shop"
              className="mt-6 inline-flex bg-primary px-5 py-3 text-xs uppercase tracking-[0.12em] text-primary-foreground"
            >
              Shop the collection
            </Link>
          </div>
        )}

        {/* =====================================================
            ORDER SUMMARY
            ===================================================== */}

        {items.length > 0 && (
          <aside className="h-fit bg-secondary p-6">
            <h2 className="font-serif text-2xl">
              Order summary
            </h2>

            <div className="mt-6 flex flex-col gap-3 border-b border-border pb-5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Subtotal
                </span>

                <span>
                  {formatPrice(
                    subtotal,
                  )}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Delivery
                </span>

                <span>
                  {subtotal >=
                  150000
                    ? 'Complimentary'
                    : 'Calculated at checkout'}
                </span>
              </div>
            </div>

            <div className="mt-5 flex justify-between font-serif text-xl">
              <span>Total</span>

              <span>
                {formatPrice(
                  subtotal,
                )}
              </span>
            </div>

            <Link
              href="/checkout"
              className="mt-6 flex items-center justify-center gap-2 bg-primary py-4 text-xs uppercase tracking-[0.14em] text-primary-foreground"
            >
              Checkout

              <ArrowRight className="size-4" />
            </Link>
          </aside>
        )}
      </div>
    </div>
  )
}


export function CheckoutPage() {
  const {
    cart,
    products,
  } = useStorefrontData()

  const [placed, setPlaced] =
    useState(false)

  const [isSubmitting, setIsSubmitting] =
    useState(false)

  const [formError, setFormError] =
    useState('')

  const [checkout, setCheckout] =
    useState({
      email: '',
      firstName: '',
      lastName: '',
      address: '',
      city: '',
      state: '',
      phone: '',
    })
const [deliveryMethod, setDeliveryMethod] =
  useState<'standard'>('standard')

const [paymentMethod, setPaymentMethod] =
  useState<'pay_on_delivery' | 'card_bank'>(
    'pay_on_delivery',
  )
    
  const updateCheckoutField = (
    field: keyof typeof checkout,
    value: string,
  ) => {
    setCheckout((current) => ({
      ...current,
      [field]: value,
    }))
  }
  const items =
    getCartItems(
      cart,
      products,
    )

  const subtotal =
    cartSubtotal(
      cart,
      products,
    )

    
const FREE_DELIVERY_THRESHOLD = 150000

const STANDARD_DELIVERY_FEE = 5000

const delivery =
  subtotal >= FREE_DELIVERY_THRESHOLD
    ? 0
    : STANDARD_DELIVERY_FEE

const total =
  subtotal + delivery


  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    setFormError('')

    if (
      !checkout.email ||
      !checkout.firstName ||
      !checkout.lastName ||
      !checkout.address ||
      !checkout.city ||
      !checkout.state ||
      !checkout.phone
    ) {
      setFormError(
        'Please complete all required fields.',
      )
      return
    }

    setIsSubmitting(true)

    try {
   
      
const checkoutPayload = {
  customer: checkout,

  delivery: {
    method: deliveryMethod,
    fee: delivery,
  },

  payment: {
    method: paymentMethod,
  },

  subtotal,
  total,
}
      
console.log(
  'Checkout payload',
  checkoutPayload,
)
      console.log(
        'Checkout information:',
        checkout,
      )

      setPlaced(true)
    } catch (error) {
      console.error(
        'Checkout submission failed',
        error,
      )

      setFormError(
        'Something went wrong. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (placed) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-5 py-20 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-accent">
          <Check className="size-6" />
        </div>

        <h1 className="mt-7 font-serif text-5xl">
          Thank you.
        </h1>

        <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
          Your order is on its way to
          becoming part of your home.
          We&apos;ll send your confirmation
          details shortly.
        </p>

        <Link
          href="/shop"
          className="mt-8 bg-primary px-6 py-4 text-xs uppercase tracking-[0.14em] text-primary-foreground"
        >
          Continue shopping
        </Link>
      </div>
    )
  }

  /*
   * Customer shouldn't be able to checkout
   * with nothing in the cart.
   */

  if (items.length === 0) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-5 py-20 text-center">
        <ShoppingBag className="size-10 text-muted-foreground/50" />

        <h1 className="mt-5 font-serif text-4xl">
          Your bag is empty
        </h1>

        <p className="mt-3 text-sm text-muted-foreground">
          Add something to your bag
          before checking out.
        </p>

        <Link
          href="/shop"
          className="mt-7 bg-primary px-6 py-4 text-xs uppercase tracking-[0.14em] text-primary-foreground"
        >
          Shop the collection
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 lg:px-10 lg:py-20">
      {/* =====================================================
          BACK TO CART
          ===================================================== */}

      <Link
        href="/cart"
        className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
      >
        ← Back to bag
      </Link>

      <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_350px]">
        {/* ===================================================
            CHECKOUT FORM
            =================================================== */}

        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Almost home
          </p>

      

          <form
            className="mt-10 flex flex-col gap-8"
            onSubmit={
              handleSubmit
            }
          >
            {/* Contact */}

            <fieldset className="flex flex-col gap-4">
              <legend className="font-serif text-2xl">
                Contact details
              </legend>

            
<input
  required
  type="email"
  name="email"
  value={checkout.email}
  onChange={(event) =>
    updateCheckoutField(
      'email',
      event.target.value,
    )
  }
  placeholder="Email address"
  aria-label="Email address"
  autoComplete="email"
  className="border-b border-border bg-transparent px-0 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
/>
            </fieldset>

            {/* Delivery */}

            <fieldset className="flex flex-col gap-4">
              <legend className="font-serif text-2xl">
                Delivery address
              </legend>

              <div className="grid gap-4 sm:grid-cols-2">
             
<input
  required
  name="firstName"
  value={checkout.firstName}
  onChange={(event) =>
    updateCheckoutField(
      'firstName',
      event.target.value,
    )
  }
  placeholder="First name"
  aria-label="First name"
  autoComplete="given-name"
  className="border-b border-border bg-transparent px-0 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
/>

             <input
  required
  name="lastName"
  value={checkout.lastName}
  onChange={(event) =>
    updateCheckoutField(
      'lastName',
      event.target.value,
    )
  }
  placeholder="Last name"
  aria-label="Last name"
  autoComplete="family-name"
  className="border-b border-border bg-transparent px-0 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
/>
              </div>

           
<input
  required
  name="address"
  value={checkout.address}
  onChange={(event) =>
    updateCheckoutField(
      'address',
      event.target.value,
    )
  }
  placeholder="Street address"
  aria-label="Street address"
  autoComplete="street-address"
  className="border-b border-border bg-transparent px-0 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
/>

              <div className="grid gap-4 sm:grid-cols-2">
              
<input
  required
  name="city"
  value={checkout.city}
  onChange={(event) =>
    updateCheckoutField(
      'city',
      event.target.value,
    )
  }
  placeholder="City"
  aria-label="City"
  autoComplete="address-level2"
  className="border-b border-border bg-transparent px-0 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
/>

<input
  required
  name="state"
  value={checkout.state}
  onChange={(event) =>
    updateCheckoutField(
      'state',
      event.target.value,
    )
  }
  placeholder="State"
  aria-label="State"
  autoComplete="address-level1"
  className="border-b border-border bg-transparent px-0 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
/>
              </div>

<input
  required
  name="phone"
  type="tel"
  value={checkout.phone}
  onChange={(event) =>
    updateCheckoutField(
      'phone',
      event.target.value,
    )
  }
  placeholder="Phone number"
  aria-label="Phone number"
  autoComplete="tel"
  className="border-b border-border bg-transparent px-0 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
/>
            </fieldset>

            
<fieldset className="flex flex-col gap-4">
  <legend className="font-serif text-2xl p-2">
    Delivery
  </legend>

  <div className="border border-primary bg-secondary p-5">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium">
          Standard delivery
        </p>

        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Delivery to your address.
        </p>
      </div>

      <span className="text-sm">
        {delivery === 0
          ? 'Complimentary'
          : formatPrice(delivery)}
      </span>
    </div>
  </div>

  {subtotal >=
    FREE_DELIVERY_THRESHOLD && (
    <p className="text-xs text-muted-foreground">
      Your order qualifies for
      complimentary delivery.
    </p>
  )}
</fieldset>

            
<fieldset className="flex flex-col gap-4">

  <legend className="font-serif text-2xl p-2">
    Payment
  </legend>
                <div className="grid gap-4 sm:grid-cols-2">

  <button
    type="button"
    onClick={() =>
      setPaymentMethod(
        'pay_on_delivery',
      )
    }
    className={`flex items-start gap-4 border p-5 text-left transition ${
      paymentMethod ===
      'pay_on_delivery'
        ? 'border-primary bg-secondary'
        : 'border-border'
    }`}
  >
    <span
      className={`mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border ${
        paymentMethod ===
        'pay_on_delivery'
          ? 'border-primary'
          : 'border-border'
      }`}
    >
      {paymentMethod ===
        'pay_on_delivery' && (
        <span className="size-2 rounded-full bg-primary" />
      )}
    </span>

    <span>
      <span className="block text-sm font-medium">
        Pay on delivery
      </span>

      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
        Pay when your order is delivered.
      </span>
    </span>
  </button>

  <button
    type="button"
    onClick={() =>
      setPaymentMethod(
        'card_bank',
      )
    }
    className={`flex items-start gap-4 border p-5 text-left transition ${
      paymentMethod ===
      'card_bank'
        ? 'border-primary bg-secondary'
        : 'border-border'
    }`}
  >
    <span
      className={`mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border ${
        paymentMethod ===
        'card_bank'
          ? 'border-primary'
          : 'border-border'
      }`}
    >
      {paymentMethod ===
        'card_bank' && (
        <span className="size-2 rounded-full bg-primary" />
      )}
    </span>

    <span>
      <span className="block text-sm font-medium">
        Card / Bank
      </span>

      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
        Pay securely online.
      </span>
    </span>
  </button></div>
</fieldset>

            {/* Submit */}

{formError && (
  <p
    role="alert"
    className="text-sm text-destructive"
  >
    {formError}
  </p>
)}
            
<button
  type="submit"
  disabled={isSubmitting}
  className="bg-primary px-6 py-4 text-xs font-medium uppercase tracking-[0.14em] text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60 sm:self-start">
  
  {isSubmitting
    ? 'Processing...'
    : paymentMethod ===
        'card_bank'
      ? 'Continue to payment'
      : 'Place order'}

  <ArrowRight className="ml-2 inline size-4" />
</button>
          </form>
        </div>

        {/* ===================================================
            ORDER SUMMARY
            =================================================== */}

        <aside className="h-fit bg-secondary p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Your order
          </p>

          <div className="mt-6 flex flex-col gap-5">
            {items.map(
              (
                {
                  product,
                  quantity,
                  size,
                  color,
                  productId,
                  variantId,
                }) => {
                if (!product) {
                  return null
                }

                return (
                  <div
                    key={`${product.id}-${size}-${color}-${variantId ?? 'default'}`}
                    className="flex gap-4 border-b border-border pb-5"
                  >
                    <img
                      src={
                        product.image
                      }
                      alt={
                        product.name
                      }
                      className="size-16 shrink-0 object-cover"
                    />

                    <div className="flex-1">
                      <p className="text-sm">
                        {
                          product.name
                        }
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {size &&
                          `${size} · `}
                        {color &&
                          `${color} · `}
                        Qty {quantity}
                      </p>
                    </div>

                    <span className="text-sm">
                   
{formatPrice(
  (() => {
    const variant =
      variantId == null
        ? undefined
        : product.variants.find(
            (item) =>
              Number(item.id) ===
              Number(variantId),
          )

    return (
      (variant?.price ??
        product.price) *
      quantity
    )
  })(),
)}
                    </span>
                  </div>
                )
              },
            )}
          </div>

          {/* Totals */}

          <div className="mt-5 flex flex-col gap-3 border-b border-border pb-5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Subtotal
              </span>

              <span>
                {formatPrice(
                  subtotal,
                )}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Delivery
              </span>

              <span>
             
{delivery === 0
  ? 'Complimentary'
  : formatPrice(delivery)}

              </span>
            </div>
          </div>

          <div className="mt-5 flex justify-between font-serif text-xl">
            <span>Total</span>

            <span>
              {formatPrice(
                total,
              )}
            </span>
          </div>
        </aside>
      </div>
    </div>
  )
}
export function InfoPage({ type }: { type: 'about' | 'contact' }) {
  if (type === 'contact') return <div className="mx-auto max-w-7xl px-5 py-16 lg:px-10 lg:py-24"><div className="grid gap-12 md:grid-cols-2"><div><p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent-foreground">We&apos;d love to hear from you</p><h1 className="mt-4 font-serif text-6xl">Say hello.</h1><p className="mt-6 max-w-sm text-sm leading-7 text-muted-foreground">Whether you need help finding the right size or just want to talk bedding, our small team is here for you.</p><div className="mt-10 flex flex-col gap-5 text-sm"><p className="flex items-center gap-3"><Mail className="size-4 text-accent-foreground" /> hello@fabulousbeddings.com</p><p className="flex items-center gap-3">
    <Phone className="size-4 text-accent-foreground" /> +234 903 929 3158</p><p className="flex items-center gap-3">
      <MapPin className="size-4 text-accent-foreground" /> Abuja, Nigeria</p></div></div><form className="flex flex-col gap-5 bg-secondary p-6 sm:p-10" onSubmit={(event) => event.preventDefault()}><h2 className="font-serif text-3xl">Send a message</h2><input required placeholder="Your name" aria-label="Your name" className="border-b border-border bg-transparent px-0 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary" /><input required type="email" placeholder="Email address" aria-label="Email address" className="border-b border-border bg-transparent px-0 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary" /><textarea required placeholder="How can we help?" aria-label="Your message" rows={4} className="resize-none border-b border-border bg-transparent px-0 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary" /><button className="mt-3 bg-primary py-4 text-xs uppercase tracking-[0.14em] text-primary-foreground">Send message</button></form></div></div>
  return <div><section className="bg-secondary px-5 py-20 lg:px-10 lg:py-28"><div className="mx-auto max-w-7xl"><p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent-foreground">Our story · Lagos, Nigeria</p><h1 className="mt-5 max-w-3xl font-serif text-5xl leading-tight sm:text-7xl">The bedroom is where we return to ourselves.</h1></div></section><section className="mx-auto grid max-w-7xl gap-10 px-5 py-20 lg:grid-cols-2 lg:gap-20 lg:px-10 lg:py-28"><img src={editorialImage} alt="A sunlit bedroom styled with neutral textiles" className="aspect-[0.85] w-full object-cover" /><div className="flex flex-col justify-center"><p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent-foreground">A softer way to live</p><h2 className="mt-4 font-serif text-4xl">Beautiful bedding is a daily ritual.</h2><div className="mt-6 flex flex-col gap-5 text-sm leading-7 text-muted-foreground"><p>Fabulous began with a simple belief: that the things we use every day deserve to be as considered as the things we save for special occasions.</p><p>We source fabrics that feel wonderful against the skin, work with makers who care about the details, and design pieces that make home feel more like yours.</p><p>Because a good night&apos;s sleep is not an indulgence. It is the foundation for everything else.</p></div></div></section></div>
}

function ShopActions({ addToCart, wishlist, toggleWishlist }: { addToCart: (id: string) => void; wishlist: string[]; toggleWishlist: (id: string) => void }) {
  void addToCart; void wishlist; void toggleWishlist
  return null
}
