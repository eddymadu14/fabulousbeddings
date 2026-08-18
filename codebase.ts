Yes. I re-inspected the current main branch, and I’m going to give you the patch against the actual line ranges that exist now—not generic instructions.
The key point is: your API is already expecting itemId, but storefront.tsx is still sending productId + variantId. That is the direct cause of the 404 Cart item not found. �
GitHub +1
We also have a second problem: your subtotal uses product.price and ignores variant.price, even though your schema explicitly supports variant-specific pricing. �
GitHub +1
1. components/storefront.tsx
PATCH A — Change the cart context types
File:
components/storefront.tsx
Current lines 68–77
You currently have:
updateQuantity: (
  productId: string,
  variantId: number | null,
  amount: number,
) => void

removeFromCart: (
  productId: string,
  variantId: number | null,
) => void
Replace lines 68–77 with:
updateQuantity: (
  itemId: number,
  amount: number,
) => Promise<void>

removeFromCart: (
  itemId: number,
) => Promise<void>
This matches the database/API identity: cart_items.id. �
GitHub +1
2. Replace updateQuantity
File:
components/storefront.tsx
Current lines 318–390
Delete the entire existing updateQuantity function.
Replace it with:
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
Why
Your API currently does:
const itemId = Number(body.itemId)
and then:
eq(cartItems.id, itemId)
So this is the contract it requires. �
GitHub
3. Replace removeFromCart
File:
components/storefront.tsx
Current lines 392–436
Delete the entire current function.
Replace it with:
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
Your DELETE API already expects itemId, so this makes the frontend and backend consistent. �
GitHub
4. Fix clearCart
File:
components/storefront.tsx
Current lines 438–466
Your current implementation loops through the cart and sends:
productId
variantId
Change the body inside that fetch.
Replace:
body: JSON.stringify({
  productId:
    item.productId,

  variantId:
    item.variantId,
}),
With:
body: JSON.stringify({
  itemId: item.id,
}),
So the whole function becomes:
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
        credentials: 'include',
        body: JSON.stringify({
          itemId: item.id,
        }),
      },
    )
  }

  setCart([])
}
5. Fix CartDrawer type
File:
components/storefront.tsx
Current lines 821–830
You currently have:
updateQuantity: (
  productId: string,
  variantId: number | null,
  amount: number,
) => void

removeFromCart: (
  productId: string,
  variantId: number | null,
) => void
Replace with:
updateQuantity: (
  itemId: number,
  amount: number,
) => Promise<void>

removeFromCart: (
  itemId: number,
) => Promise<void>
6. Fix CartDrawer destructuring
File:
components/storefront.tsx
Current lines 914–924
You currently have:
{
  product,
  quantity,
  size,
  color,
  productId,
  variantId,
}
Replace with:
{
  id,
  product,
  quantity,
  size,
  color,
  variantId,
}
You don't need productId for cart mutation anymore.
7. Fix CartDrawer key
File:
components/storefront.tsx
Current line 930
You have:
key={`${product.id}-${size}-${color}-${variantId ?? 'default'}`}
Change it to:
key={id}
This is better because id is the actual unique database cart-item identity.
8. Fix CartDrawer price
File:
components/storefront.tsx
Current lines 963–967
You currently have:
{formatPrice(
  product.price *
    quantity,
)}
Replace with:
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
This means:
variant selected
→ variant.price

no variant
→ product.price
Your schema explicitly allows each variant to have its own price. �
GitHub
9. Fix CartDrawer minus button
File:
components/storefront.tsx
Current lines 975–980
Replace:
updateQuantity(
  productId,
  variantId,
  -1,
)
with:
updateQuantity(
  id,
  -1,
)
10. Fix CartDrawer plus button
File:
components/storefront.tsx
Current lines 992–997
Replace:
updateQuantity(
  productId,
  variantId,
  1,
)
with:
updateQuantity(
  id,
  1,
)
11. Fix CartDrawer Remove
This one is particularly important.
File:
components/storefront.tsx
Current lines 1005–1017
You currently have:
onClick={() => {
  updateQuantity(
    productId,
    variantId,
    -1,
  )
}}
That is not remove.
Replace the entire onClick with:
onClick={() =>
  removeFromCart(id)
}
So:
<button
  type="button"
  onClick={() =>
    removeFromCart(id)
  }
  className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-primary"
>
  Remove
</button>
12. Fix CartDrawer total
Your subtotal calculation itself will be fixed in lib/store-data.ts below.
Therefore do not manually calculate the total in CartDrawer.
This:
{formatPrice(subtotal)}
can remain.
Your existing subtotal is already coming from:
cartSubtotal(
  cart,
  products,
)
�
GitHub
Once cartSubtotal() is fixed, the drawer total updates automatically.
13. Fix lib/store-data.ts
This is the second major fix.
File:
lib/store-data.ts
Current lines 69–80
Current code:
export function cartSubtotal(
  cart: CartItem[],
  products: Product[],
): number {
  return cart.reduce((total, item) => {
    const product = findProduct(products, item.productId)
    return (
      total +
      (product?.price ?? 0) * item.quantity
    )
  }, 0)
}
Replace the entire function with:
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
This fixes your incorrect totals.
Your current implementation literally uses only:
product.price * item.quantity
despite your ProductVariant containing its own price. �
GitHub +1
14. Fix CartPage
Now we need to apply exactly the same identity correction to the full /cart page.
Find:
export function CartPage
in:
components/storefront.tsx
Your cart items are currently mapped from getCartItems().
Where you have something equivalent to:
{
  product,
  quantity,
  size,
  color,
  productId,
  variantId,
}
change it to:
{
  id,
  product,
  quantity,
  size,
  color,
  variantId,
}
Then:
Minus
Change:
updateQuantity(
  productId,
  variantId,
  -1,
)
to:
updateQuantity(
  id,
  -1,
)
Plus
Change:
updateQuantity(
  productId,
  variantId,
  1,
)
to:
updateQuantity(
  id,
  1,
)
Remove
Change:
updateQuantity(
  productId,
  variantId,
  -1,
)
to:
removeFromCart(id)
This is the same underlying bug as the drawer.
15. Fix the CartPage line price
Where CartPage currently has:
formatPrice(
  product.price *
    quantity,
)
replace with:
formatPrice(
  (
    product.variants.find(
      (variant) =>
        Number(variant.id) ===
        Number(variantId),
    )?.price ??
    product.price
  ) * quantity,
)
Now the number beside each item and the subtotal are using the same variant price.
16. Do NOT modify app/api/cart/route.ts
This is important.
After inspecting the current API, you don't need to rewrite the PATCH or DELETE API.
The API is already doing the correct thing:
const itemId = Number(body.itemId)
and:
eq(cartItems.id, itemId)
and:
eq(cartItems.cartId, cart.id)
for both PATCH and DELETE. �
GitHub
The frontend was simply not obeying that contract.
So:
app/api/cart/route.ts
Leave it alone for this fix.
17. There is another cart problem: visitor → user merge
This is separate from the button failure.
File:
lib/cart.ts
Current lines 19–65
Your current getOrCreateCart() does this:
if (owner.userId) {
  find user cart
} else {
  find visitor cart
}
It does not merge a visitor cart when the user logs in. �
GitHub
That means:
Visitor
↓
Cart #12
↓
Login
↓
User Cart #25
The visitor cart can be abandoned.
Do not patch this yet with a random frontend effect.
We should implement a proper server-side merge after the basic cart mutations are working.
18. One thing I would NOT change
Your database schema is actually reasonable for the cart.
You already have:
cartItems.id
cartItems.cartId
cartItems.productId
cartItems.variantId
cartItems.quantity
and the appropriate foreign keys. �
GitHub
So do not create another cart-item identifier.
Use:
cartItems.id
everywhere for mutations.
19. Your exact implementation order
Do it in this order.
File 1
components/storefront.tsx
Apply:
Context type
updateQuantity
removeFromCart
clearCart
CartDrawer types
CartDrawer id
CartDrawer key
CartDrawer price
CartDrawer minus
CartDrawer plus
CartDrawer remove
CartPage minus
CartPage plus
CartPage remove
CartPage price
File 2
lib/store-data.ts
Replace cartSubtotal().
File 3
app/api/cart/route.ts
No changes.
File 4
lib/cart.ts
Don't change yet. We'll do the visitor→user merge as the next cart-persistence patch after the basic operations pass.
20. Then test exactly this
Run:
pnpm tsc --noEmit
Then:
pnpm dev
Test 1
Add:
Product A
Qty 1
Cart:
Qty 1
Click +.
Expected:
Qty 2
Test 2
Click -.
Expected:
Qty 1
Test 3
Click Remove.
Expected:
Cart empty
Test 4
Add two different variants:
King / Pearl
Queen / Pearl
They must remain two separate cart lines.
Test 5
If:
Variant A = ₦120,000
Qty = 2
Cart must display:
₦240,000
not the base product price.
Test 6
Refresh the page.
Expected:
Cart still there
Test 7
Open the cart drawer.
The same quantity and total must appear.
This is the clean fix. The API already has the correct itemId contract; we're bringing storefront.tsx into compliance instead of changing the backend unnecessarily. The variant-price correction then makes the displayed line totals and subtotal mathematically consistent. �
GitHub +1
After these patches pass tsc, the next patch should be visitor-cart → authenticated-user-cart merging, then we move to the checkout/order/payment pipeline.