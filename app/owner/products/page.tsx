import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getOwnerCategories, getOwnerProducts } from '@/app/actions/owner'
import { OwnerNav, ProductForm } from '@/components/owner-dashboard'
export default async function OwnerProductsPage() { const session = await auth.api.getSession({ headers: await headers() }); if (!session?.user) redirect('/sign-in'); 
const [items, categoryOptions] = await Promise.all([
  getOwnerProducts(),
  getOwnerCategories(),
]) 
return <div className="min-h-screen bg-secondary lg:pl-64"><OwnerNav active="products" /><main className="mx-auto max-w-5xl px-5 py-10 lg:px-10"><div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-foreground">Catalog management</p><h1 className="mt-3 font-serif text-5xl">Add a product.</h1><p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">Create products, place them in the right collection, and keep your storefront fresh.</p></div><section className="mt-10 bg-background p-6 shadow-sm lg:p-8">
<ProductForm categories={categoryOptions} /></section><section className="mt-10"><h2 className="font-serif text-3xl">Your products <span className="text-muted-foreground">({items.length})</span></h2><div className="mt-5 grid gap-3">{items.map((item) => <div key={item.id} className="flex items-center gap-4 border-b border-border py-4"><img src={item.image} alt="" className="size-16 object-cover" /><div className="min-w-0 flex-1"><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.category} · {item.status} · {item.stock} in stock</p></div><p className="text-sm">₦{item.price.toLocaleString()}</p></div>)}</div></section></main></div> }
