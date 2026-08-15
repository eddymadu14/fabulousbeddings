Yes. I inspected the current main commit of your repo, including components/storefront.tsx, app/api/cart/route.ts, lib/cart.ts, and the Drizzle schema. The 404 is not a frontend button problem.
The root cause is how the cart item is being identified during update/remove.
Your current API identifies an item using:
productId + variantId + cartId
and returns Cart item not found when that exact combination doesn't exist. �
GitHub +1
But your cart already has a much better identifier:
cartItems.id
The database schema defines cart_items.id as the primary key. �
GitHub
The correct fix
Stop updating/removing cart items by productId + variantId.
Use the cart item ID.
That eliminates the entire class of bugs you're seeing.
1. Change CartItem
File
lib/store-data.ts
Current
export type CartItem = {
  productId: string
  variantId: number | null
  quantity: number
  size?: string
  color?: string
}
Replace with
export type CartItem = {
  id: number
  productId: string
  variantId: number | null
  quantity: number
  size?: string
  color?: string
}
Your API already returns the database item, including its id, so we should preserve it. �
GitHub
2. Fix PATCH /api/cart
File
app/api/cart/route.ts
Replace your entire PATCH function with:
export async function PATCH(
  request: Request,
) {
  try {
    const body = await request.json()

    const itemId = Number(body.itemId)
    const quantity = Number(body.quantity)

    if (
      !Number.isInteger(itemId) ||
      !Number.isInteger(quantity)
    ) {
      return NextResponse.json(
        {
          error: 'Invalid cart update',
        },
        {
          status: 400,
        },
      )
    }

    const owner = await getCartOwner()

    const cart = await getOrCreateCart(
      owner,
    )

    const existing = await db
      .select()
      .from(cartItems)
      .where(
        and(
          eq(cartItems.id, itemId),
          eq(
            cartItems.cartId,
            cart.id,
          ),
        ),
      )
      .limit(1)

    if (!existing.length) {
      return NextResponse.json(
        {
          error:
            'Cart item not found',
        },
        {
          status: 404,
        },
      )
    }

    if (quantity <= 0) {
      await db
        .delete(cartItems)
        .where(
          and(
            eq(
              cartItems.id,
              itemId,
            ),
            eq(
              cartItems.cartId,
              cart.id,
            ),
          ),
        )
    } else {
      await db
        .update(cartItems)
        .set({
          quantity,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(
              cartItems.id,
              itemId,
            ),
            eq(
              cartItems.cartId,
              cart.id,
            ),
          ),
        )
    }

    const items = await db
      .select()
      .from(cartItems)
      .where(
        eq(
          cartItems.cartId,
          cart.id,
        ),
      )

    return NextResponse.json({
      cartId: cart.id,
      items:
        serializeCartItems(items),
    })
  } catch (error) {
    console.error(
      'Cart PATCH failed:',
      error,
    )

    return NextResponse.json(
      {
        error:
          'Unable to update cart',
      },
      {
        status: 500,
      },
    )
  }
}
Notice the important change:
const itemId = Number(body.itemId)
and:
eq(cartItems.id, itemId)
3. Fix DELETE /api/cart
Same file
app/api/cart/route.ts
Replace the entire DELETE function with:
export async function DELETE(
  request: Request,
) {
  try {
    const body = await request.json()

    const itemId = Number(body.itemId)

    if (!Number.isInteger(itemId)) {
      return NextResponse.json(
        {
          error:
            'Invalid cart item',
        },
        {
          status: 400,
        },
      )
    }

    const owner = await getCartOwner()

    const cart = await getOrCreateCart(
      owner,
    )

    const existing = await db
      .select()
      .from(cartItems)
      .where(
        and(
          eq(cartItems.id, itemId),
          eq(
            cartItems.cartId,
            cart.id,
          ),
        ),
      )
      .limit(1)

    if (!existing.length) {
      return NextResponse.json(
        {
          error:
            'Cart item not found',
        },
        {
          status: 404,
        },
      )
    }

    await db
      .delete(cartItems)
      .where(
        and(
          eq(
            cartItems.id,
            itemId,
          ),
          eq(
            cartItems.cartId,
            cart.id,
          ),
        ),
      )

    const items = await db
      .select()
      .from(cartItems)
      .where(
        eq(
          cartItems.cartId,
          cart.id,
        ),
      )

    return NextResponse.json({
      cartId: cart.id,
      items:
        serializeCartItems(items),
    })
  } catch (error) {
    console.error(
      'Cart DELETE failed:',
      error,
    )

    return NextResponse.json(
      {
        error:
          'Unable to remove cart item',
      },
      {
        status: 500,
      },
    )
  }
}
4. Fix updateQuantity in storefront.tsx
This is the other half of the problem.
Your current function at around line 313 uses:
const updateQuantity = async (
  index: number,
  amount: number,
)
and then sends:
productId: item.productId,
variantId: item.variantId,
quantity,
That's exactly what we're removing.
Replace it with:
const updateQuantity = async (
  index: number,
  amount: number,
) => {
  const item = cart[index]

  if (!item) {
    return
  }

  const quantity =
    item.quantity + amount

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
        itemId: item.id,
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
}
The crucial line is now:
itemId: item.id
5. Fix removeFromCart
You currently have this around line 363:
const removeFromCart = async (
  index: number,
) => {
Replace the entire function with:
const removeFromCart = async (
  index: number,
) => {
  const item = cart[index]

  if (!item) {
    return
  }

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
        itemId: item.id,
      }),
    },
  )

  const data =
    await response.json()

  if (!response.ok) {
    console.error(
      'Cart remove failed',
      data,
    )
    return
  }

  setCart(
    data.items ?? [],
  )
}
6. Fix the CartDrawer
Your current drawer does this:
items.map(
  (
    {
      product,
      quantity,
      size,
      color,
    },
    index,
  ) => {
That's fine.
But your key currently is:
key={`${product.id}-${size}-${color}-${index}`}
Change it to:
key={item.id}
So destructure item itself.
Change:
{items.map(
  (
    {
      product,
      quantity,
      size,
      color,
    },
    index,
  ) => {
to:
{items.map(
  (
    item,
    index,
  ) => {
    const {
      product,
      quantity,
      size,
      color,
    } = item
Then:
key={item.id}
The existing quantity buttons can remain:
onClick={() =>
  updateQuantity(
    index,
    -1,
  )
}
and:
onClick={() =>
  updateQuantity(
    index,
    1,
  )
}
because updateQuantity() converts the array index into the actual item.id.
7. Do the same on CartPage
Where you currently have:
items.map(
  (
    {
      product,
      quantity,
      size,
      color,
    },
    index,
  ) => {
keep the index, because your context function currently accepts an index.
But the key should preferably be:
key={item.id}
rather than:
key={`${product.id}-${size}-${color}-${index}`}
Why this fixes your exact 404
Your current flow is:
Cart UI
   ↓
index
   ↓
cart[index]
   ↓
productId + variantId
   ↓
API
   ↓
find matching product + variant
   ↓
404
The fragile part is this:
productId + variantId
Your database already gives every cart line its own identity:
cart_items.id
So the new flow is:
Cart UI
   ↓
index
   ↓
cart[index].id
   ↓
itemId
   ↓
API
   ↓
cart_items.id + cart.id
   ↓
UPDATE / DELETE
That's deterministic.
And the cart.id condition is important: it prevents someone from manipulating an item belonging to another cart even if they somehow know its ID.
Your schema explicitly makes cart_items.id the primary key and associates each item with cartId. �
GitHub
One more thing: don't touch addToCart
Your POST /api/cart implementation is already correctly creating/finding the item using:
productId + variantId
That's appropriate for adding because you want:
"If this exact product/variant is already in the cart, increase its quantity."
So keep POST as it is. �
GitHub
Only PATCH and DELETE should switch to itemId.
After these changes
Run:
pnpm tsc --noEmit
then:
pnpm run build
Then test:
Add product.
Open cart.
+ → quantity increases.
− → quantity decreases.
− at quantity 1 → item disappears.
Refresh → state remains.
Remove another item → only that item disappears.
This is the clean fix for the PATCH /api/cart 404 Cart item not found you're currently getting.