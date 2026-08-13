adds quantity 1.
Cart drawer
This is definitely broken in the latest commit.

CartDrawer calculates items, then does:

if (!open) {
  return null
}}

and immediately after that there is only:

// keep the rest of your existing JSX
There is no JSX returned when open === true. That's why clicking the bag doesn't render the drawer.

Let's fix both properly.

1. Fix addToCart
File
components/storefront.tsx

Find your current addToCart around line 156 and replace the whole function with:

const addToCart = (
  productId: string,
  size?: string,
  color?: string,
  quantity: number = 1,
) => {
  const product = findProduct(
    products,
    productId,
  )


  if (!product) {
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


  const amount = Math.max(
    1,
    quantity,
  )


  setCart((current) => {
    const existingIndex =
      current.findIndex(
        (entry) =>
          entry.productId === productId &&
          entry.size === itemSize &&
          entry.color === itemColor,
      )


    if (existingIndex === -1) {
      return [
        ...current,
        {
          productId,
          quantity: amount,
          size: itemSize,
          color: itemColor,
        },
      ]
    }


    return current.map(
      (entry, index) =>
        index === existingIndex
          ? {
              ...entry,
              quantity:
                entry.quantity + amount,
            }
          : entry,

Also update the context type at the top.

Change:

addToCart: (
  productId: string,
  size?: string,
  color?: string,
) => void

to:

addToCart: (
  productId: string,
  size?: string,
  color?: string,
  quantity?: number,
) => void
2. Make Quick Add actually usable

Your current ProductCard has:

<button
  onClick={() => onAdd?.(product.id)}
  className="absolute inset-x-3 bottom-3 translate-y-14 bg-background py-3 text-xs font-medium uppercase tracking-[0.12em] opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100"
>
  Quick add
</button>

That's the wrong UX for a mobile store.

Replace the entire button with:

<button
  type="button"
  onClick={(event) => {
    event.preventDefault()
    event.stopPropagation()
    onAdd?.(product.id)
  }}
  className="absolute inset-x-3 bottom-3 bg-background py-3 text-xs font-medium uppercase tracking-[0.12em] opacity-100 transition-all md:translate-y-14 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100"
>
  Quick add
</button>

Now:

Desktop → hover reveals Quick add.
Mobile → Quick add is always visible.
Clicking it won't accidentally activate the product <Link>.

This is especially important because the button is physically inside the product image area while the product itself is also linked.

3. Fix the CartDrawer

This is the big one.

File
components/storefront.tsx

Find:

function CartDrawer({

It currently ends prematurely around line 400.

Replace the entire CartDrawer function with this:

function CartDrawer({
  open,
  onClose,
  cart,