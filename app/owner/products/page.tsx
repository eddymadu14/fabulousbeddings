import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getOwnerCategories, getOwnerProducts } from '@/app/actions/owner'
import { OwnerNav } from '@/components/owner-dashboard'
import {
  OwnerProductsManager,
} from '@/components/owner-products-manager'
export default async function OwnerProductsPage() { const session = await auth.api.getSession({ headers: await headers() }); if (!session?.user) redirect('/sign-in'); 
const [items, categoryOptions] = await Promise.all([
  getOwnerProducts(),
  getOwnerCategories(),
]) 
return <div className="min-h-screen bg-secondary lg:pl-64"><OwnerNav active="products" /><main className="mx-auto max-w-5xl px-5 py-10 lg:px-10"><div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-foreground">Catalog management</p><h1 className="mt-3 font-serif text-5xl">Add a product.</h1><p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">Create products, place them in the right collection, and keep your storefront fresh.</p></div><section className="mt-10 bg-background p-6 shadow-sm lg:p-8">

</section>
<OwnerProductsManager
  items={items}
  categories={categoryOptions}
/>
</main></div> }
