











Now:
cartLoaded = false
      ↓
Loading your bag...
rather than:
cartLoaded = false
      ↓
Your bag is empty ❌
5. Fix CartDrawer
Same principle.
Currently it does:
{items.length === 0 ? (
  <div>
    Your bag is empty
  </div>
) : (
  ...
)}
�
GitHub
Get:
const {
  products,
  cartLoaded,
} = useStorefrontData()
Then:
{!cartLoaded ? (
  <div className="flex h-full items-center justify-center text-center">
    <p className="text-sm text-muted-foreground">
      Loading your bag...
    </p>
  </div>
) : items.length === 0 ? (
  <div className="flex h-full flex-col items-center justify-center text-center">
    {/* existing empty-cart UI */}
  </div>
) : (
  <div className="flex flex-col gap-6">
    {/* existing cart items */}
  </div>
)}
6. Don't forget CheckoutPage
Your checkout page has the same problem because it currently checks:
if (items.length === 0) {
  return (
    ...
    Your bag is empty
  )
}
The current checkout implementation confirms that this empty-state check happens before the actual cart has necessarily finished loading. �
GitHub
So in CheckoutPage():
const {
  cart,
  products,
  cartLoaded,
} = useStorefrontData()
Then before:
if (items.length === 0)
add:
if (!cartLoaded) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-5 py-20">
      <p className="text-sm text-muted-foreground">
        Loading your bag...
      </p>
    </div>
  )
}
Then your existing:
if (items.length === 0) {
can remain exactly as the confirmed-empty state.
One more improvement
When adding/removing/updating items, cartLoaded should remain true.
For example:
setCart(data.items ?? [])
doesn't need to touch cartLoaded, because the cart has already been loaded.
So your state semantics become clean:
cartLoaded = false
    ↓
We don't know yet

cartLoaded = true
    ↓
cart = []          → genuinely empty
cart = [items...]  → genuinely populated
That's the correct model.
Final behavior
Before:
Checkout
 ↓
Your bag is empty
 ↓
0.2–1 sec later
 ↓
Product appears
After:
Checkout
 ↓
Loading your bag...
 ↓
API returns
 ↓
┌─────────────────────────────┐
│ cartLoaded = true            │
├─────────────────────────────┤
│ items > 0 → show products   │
│ items = 0 → show empty bag  │
└─────────────────────────────┘
This is the fix I'd use rather than adding arbitrary delays. **Never solve an asynchronous state problem with setTimeout; explicitly represent the loading state.**