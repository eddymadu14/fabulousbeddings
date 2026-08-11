'use client'

import { useState } from 'react'

import {
ProductForm,
type EditableProduct,
} from '@/components/owner-dashboard'

type ProductCategory = {
id: number
name: string
slug: string
}

type Product = EditableProduct

type Props = {
items: Product[]
categories: ProductCategory[]
}

export function OwnerProductsManager({
items: initialItems,
categories,
}: Props) {
const [items, setItems] = useState(initialItems)
const [editingProduct, setEditingProduct] =
useState<Product | null>(null)
const [deletingId, setDeletingId] =
useState<number | null>(null)

async function handleDelete(id: number) {
const confirmed = window.confirm(
'Archive this product?',
)

if (!confirmed) {
  return
}

setDeletingId(id)

try {
  const response = await fetch(
    `/api/owner/products/${id}`,
    {
      method: 'DELETE',
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.error ?? 'Failed to archive product',
    )
  }

  setItems((current) =>
    current.filter(
      (product) => product.id !== id,
    ),
  )

  if (editingProduct?.id === id) {
    setEditingProduct(null)
  }
} catch (error) {
  console.error(
    'Failed to archive product:',
    error,
  )

  window.alert(
    error instanceof Error
      ? error.message
      : 'Failed to archive product.',
  )
} finally {
  setDeletingId(null)
}

}

function handleUpdated(
updatedProduct: EditableProduct,
) {
setItems((current) =>
current.map((product) =>
product.id === updatedProduct.id
? updatedProduct
: product,
),
)

setEditingProduct(null)

}

return (
<>
<section className="mt-10 bg-background p-6 shadow-sm lg:p-8">
<ProductForm
categories={categories}
product={editingProduct}
onUpdated={handleUpdated}
onCancelEdit={() =>
setEditingProduct(null)
}
/>
</section>

  <section className="mt-10">
    <h2 className="font-serif text-3xl">
      Your products{' '}
      <span className="text-muted-foreground">
        ({items.length})
      </span>
    </h2>

    <div className="mt-5 grid gap-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex flex-wrap items-center gap-4 border-b border-border py-4"
        >
          <img
            src={item.image}
            alt={item.name}
            className="size-16 object-cover"
          />

          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {item.name}
            </p>

            <p className="text-xs text-muted-foreground">
              {item.category ?? 'Uncategorized'} ·{' '}
              {item.status} · {item.stock} in stock
            </p>
          </div>

          <p className="text-sm">
            ₦{item.price.toLocaleString()}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                setEditingProduct(item)
              }
              className="border border-border px-3 py-2 text-xs uppercase tracking-wider"
            >
              Edit
            </button>

            <button
              type="button"
              disabled={
                deletingId === item.id
              }
              onClick={() =>
                handleDelete(item.id)
              }
              className="border border-destructive px-3 py-2 text-xs uppercase tracking-wider text-destructive disabled:opacity-50"
            >
              {deletingId === item.id
                ? 'Archiving...'
                : 'Delete'}
            </button>
          </div>
        </div>
      ))}
    </div>
  </section>
</>

)
}