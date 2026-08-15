I inspected the current main commit, and the issue is obvious.
Your Header does call useSession(), but it never renders session anywhere. At lines 542–550, the session is obtained and then completely ignored; the right side only renders Search, Wishlist, and Cart. �
GitHub +1
So don't add another header or another session hook.
Fix: components/storefront.tsx
Replace the existing Header function
Find approximately lines 540–553:
function Header({ count, menuOpen, setMenuOpen, onCart }:
  { count: number; menuOpen: boolean; setMenuOpen: (value: boolean) => void; onCart: () => void }) {
  ...
}
Replace the entire function with this:
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
Why this is the correct fix
Your current code already has:
const {
  data: session,
} = useSession()
but then immediately renders:
<Search />
<Heart />
<ShoppingBag />
There is no conditional auth UI. That's why Login/Register never appeared. �
GitHub
Your auth-client.ts is also correctly configured:
'use client'

import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient()

export const {
  signIn,
  signUp,
  signOut,
  useSession,
} = authClient
So do not modify lib/auth-client.ts. �
GitHub
Expected behavior
Logged out:
Login   Register   Search   Wishlist   Cart
Logged in:
Hi, Edward   Sign out   Search   Wishlist   Cart
And because useSession() is reactive, the header should update when the Better Auth session changes. �
Gist
One thing I deliberately did NOT change
I did not touch:
app/page.tsx
lib/storefront.ts
lib/store-data.ts
app/api/cart
They aren't responsible for the missing login/register buttons.
Make only this Header replacement, then run:
pnpm tsc --noEmit
If that passes, test logged out → Login → return to home. The header should switch to the greeting/sign-out state.