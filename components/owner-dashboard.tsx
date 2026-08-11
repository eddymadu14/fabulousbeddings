'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { addProduct } from '@/app/actions/owner'

type ProductCategory = {
id: number
name: string
slug: string
}

export type EditableProduct = {
id: number
categoryId: number
category: string | null
createdBy: string
name: string
slug: string
description: string
price: number
compareAtPrice: number | null
image: string
stock: number
status: string
featured: boolean
}

type ProductFormProps = {
categories: ProductCategory[]
product?: EditableProduct | null
onUpdated?: (product: EditableProduct) => void
onCancelEdit?: () => void
}

export function OwnerNav({
active,
}: {
active: 'analytics' | 'products'
}) {
return (
<aside className="border-b border-border bg-primary px-5 py-5 text-primary-foreground lg:fixed lg:inset-y-0 lg:w-64 lg:border-b-0 lg:px-7 lg:py-8">
<Link
href="/"
className="font-serif text-3xl"
>
fabulous
</Link>

  <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.22em] text-primary-foreground/55">
    Owner studio
  </p>

  <nav className="mt-10 flex gap-5 lg:flex-col">
    {[
      ['analytics', 'Analytics'],
      ['products', 'Products'],
    ].map(([key, label]) => (
      <Link
        key={key}
        href={`/owner/${key}`}
        className={`text-sm ${
          active === key
            ? 'text-accent'
            : 'text-primary-foreground/70'
        }`}
      >
        {label}
      </Link>
    ))}
  </nav>

  <Link
    href="/"
    className="mt-10 block text-xs text-primary-foreground/50"
  >
    Back to storefront
  </Link>
</aside>

)
}

type ProductImage = {
id: number
url: string
publicId: string | null
sortOrder: number
}


export function ProductForm({
categories,
product = null,
onUpdated,
onCancelEdit,
}: ProductFormProps) {
const [saving, setSaving] =
useState(false)

const [message, setMessage] =
useState('')

const [selectedFiles, setSelectedFiles] =
useState<File[]>([])

const [existingImages, setExistingImages] =
useState<ProductImage[]>([])

const [removedImageIds, setRemovedImageIds] =
useState<number[]>([])

const [primaryImageId, setPrimaryImageId] =
useState<number | null>(null)

const [primaryNewImageIndex, setPrimaryNewImageIndex] =
useState<number | null>(null)

const [name, setName] =
useState('')

const [category, setCategory] =
useState('')

const [description, setDescription] =
useState('')

const [price, setPrice] =
useState('')

const [compareAtPrice, setCompareAtPrice] =
useState('')

const [stock, setStock] =
useState('')

const [status, setStatus] =
useState('published')

useEffect(() => {
if (!product) {
setName('')
setCategory('')
setDescription('')
setPrice('')
setCompareAtPrice('')
setStock('')
setStatus('published')
setExistingImages([])
setRemovedImageIds([])
setPrimaryImageId(null)
setPrimaryNewImageIndex(null)
setSelectedFiles([])
setMessage('')
return
}

setName(product.name)
setCategory(product.category ?? '')
setDescription(product.description)
setPrice(String(product.price))
setCompareAtPrice(
  product.compareAtPrice === null
    ? ''
    : String(product.compareAtPrice),
)
setStock(String(product.stock))
setStatus(product.status)
setRemovedImageIds([])
setPrimaryImageId(null)
setPrimaryNewImageIndex(null)
setSelectedFiles([])
setMessage('')

async function loadImages() {
  try {
    const response = await fetch(
      `/api/owner/products/${product.id}`,
      {
        cache: 'no-store',
      },
    )

    const data = await response.json()

    if (!response.ok) {
      throw new Error(
        data.error ??
          'Failed to load product images',
      )
    }

    setExistingImages(
      data.images ?? [],
    )
  } catch (error) {
    console.error(
      'Failed to load product images:',
      error,
    )

    setMessage(
      'Failed to load product images.',
    )
  }
}

loadImages()

}, [product])

function handleFiles(
event: React.ChangeEvent<HTMLInputElement>,
) {
const files = Array.from(
event.target.files ?? [],
)

if (!files.length) {
  return
}

const invalidFile = files.find(
  (file) =>
    !file.type.startsWith('image/'),
)

if (invalidFile) {
  setMessage(
    `${invalidFile.name} is not an image file.`,
  )
  event.target.value = ''
  return
}

const oversizedFile = files.find(
  (file) =>
    file.size > 5 * 1024 * 1024,
)

if (oversizedFile) {
  setMessage(
    `${oversizedFile.name} is larger than 5MB.`,
  )
  event.target.value = ''
  return
}

setSelectedFiles(files)
setPrimaryNewImageIndex(
  product && files.length > 0
    ? null
    : 0,
)
setMessage('')

}

function removeNewFile(index: number) {
setSelectedFiles((current) =>
current.filter(
(_, fileIndex) =>
fileIndex !== index,
),
)

setPrimaryNewImageIndex(
  (current) => {
    if (current === null) {
      return null
    }

    if (current === index) {
      return null
    }

    if (current > index) {
      return current - 1
    }

    return current
  },
)

}

function removeExistingImage(
imageId: number,
) {
const remaining =
existingImages.filter(
(image) =>
image.id !== imageId,
)

if (
  remaining.length === 0 &&
  selectedFiles.length === 0
) {
  setMessage(
    'A product must have at least one image.',
  )
  return
}

setRemovedImageIds(
  (current) =>
    current.includes(imageId)
      ? current
      : [...current, imageId],
)

if (
  primaryImageId === imageId
) {
  setPrimaryImageId(null)
}

}

function restoreExistingImage(
imageId: number,
) {
setRemovedImageIds(
(current) =>
current.filter(
(id) => id !== imageId,
),
)
}

async function submit(
event: React.FormEvent<HTMLFormElement>,
) {
event.preventDefault()

const formElement =
  event.currentTarget

if (!product) {
  if (!selectedFiles.length) {
    setMessage(
      'Please select at least one product image.',
    )
    return
  }

  setSaving(true)
  setMessage('')

  try {
    await addProduct({
      name: name.trim(),
      category,
      description: description.trim(),
      price: Number(price),
      compareAtPrice:
        Number(compareAtPrice) ||
        undefined,
      stock: Number(stock),
      status,
      images: selectedFiles,
    })

    formElement.reset()
    setSelectedFiles([])
    setMessage(
      'Product created successfully.',
    )
  } catch (error) {
    console.error(
      'Failed to create product:',
      error,
    )

    setMessage(
      error instanceof Error
        ? error.message
        : 'Failed to create product.',
    )
  } finally {
    setSaving(false)
  }

  return
}

setSaving(true)
setMessage('')

try {
  const selectedCategory =
    categories.find(
      (item) =>
        item.name === category,
    )

  if (!selectedCategory) {
    throw new Error(
      'Selected category was not found.',
    )
  }

  const formData =
    new FormData()

  formData.append(
    'name',
    name.trim(),
  )

  formData.append(
    'categoryId',
    String(selectedCategory.id),
  )

  formData.append(
    'description',
    description.trim(),
  )

  formData.append(
    'price',
    price,
  )

  formData.append(
    'compareAtPrice',
    compareAtPrice,
  )

  formData.append(
    'stock',
    stock,
  )

  formData.append(
    'status',
    status,
  )

  if (removedImageIds.length) {
    formData.append(
      'removeImageIds',
      removedImageIds.join(','),
    )
  }

  if (
    primaryImageId !== null
  ) {
    formData.append(
      'primaryImageId',
      String(primaryImageId),
    )
  } else if (
    primaryNewImageIndex !== null
  ) {
    formData.append(
      'primaryImageId',
      String(
        -(primaryNewImageIndex + 1),
      ),
    )
  }

  for (const file of selectedFiles) {
    formData.append(
      'images',
      file,
    )
  }

  const response = await fetch(
    `/api/owner/products/${product.id}`,
    {
      method: 'PATCH',
      body: formData,
    },
  )

  const data =
    await response.json()

  if (!response.ok) {
    throw new Error(
      data.error ??
        'Failed to update product',
    )
  }

  onUpdated?.({
    ...product,
    ...data,
    category:
      selectedCategory.name,
    categoryId:
      selectedCategory.id,
  })

  setMessage(
    'Product updated successfully.',
  )

  setSelectedFiles([])
  setRemovedImageIds([])
  setPrimaryImageId(null)
  setPrimaryNewImageIndex(null)
  setExistingImages(
    data.images ?? [],
  )
} catch (error) {
  console.error(
    'Failed to update product:',
    error,
  )

  setMessage(
    error instanceof Error
      ? error.message
      : 'Failed to update product.',
  )
} finally {
  setSaving(false)
}

}

return (
<form
onSubmit={submit}
className="grid gap-5 md:grid-cols-2"
>
<label className="flex flex-col gap-2 text-sm">
Product name

    <input
      name="name"
      value={name}
      onChange={(event) =>
        setName(event.target.value)
      }
      required
      disabled={saving}
      className="border border-border bg-background px-4 py-3"
      placeholder="Cloud Nine Percale Set"
    />
  </label>

  <label className="flex flex-col gap-2 text-sm">
    Category

    <select
      name="category"
      value={category}
      onChange={(event) =>
        setCategory(event.target.value)
      }
      required
      disabled={saving}
      className="border border-border bg-background px-4 py-3"
    >
      <option value="">
        Select a category
      </option>

      {categories.map(
        (item) => (
          <option
            key={item.id}
            value={item.name}
          >
            {item.name}
          </option>
        ),
      )}
    </select>
  </label>

  <label className="flex flex-col gap-2 text-sm md:col-span-2">
    Description

    <textarea
      name="description"
      value={description}
      onChange={(event) =>
        setDescription(
          event.target.value,
        )
      }
      required
      disabled={saving}
      rows={4}
      className="border border-border bg-background px-4 py-3"
    />
  </label>

  <label className="flex flex-col gap-2 text-sm">
    Price (NGN)

    <input
      name="price"
      type="number"
      min="0"
      value={price}
      onChange={(event) =>
        setPrice(event.target.value)
      }
      required
      disabled={saving}
      className="border border-border bg-background px-4 py-3"
    />
  </label>

  <label className="flex flex-col gap-2 text-sm">
    Compare-at price

    <input
      name="compareAtPrice"
      type="number"
      min="0"
      value={compareAtPrice}
      onChange={(event) =>
        setCompareAtPrice(
          event.target.value,
        )
      }
      disabled={saving}
      className="border border-border bg-background px-4 py-3"
    />
  </label>

  <label className="flex flex-col gap-2 text-sm">
    Stock

    <input
      name="stock"
      type="number"
      min="0"
      value={stock}
      onChange={(event) =>
        setStock(event.target.value)
      }
      required
      disabled={saving}
      className="border border-border bg-background px-4 py-3"
    />
  </label>

  <label className="flex flex-col gap-2 text-sm">
    Status

    <select
      name="status"
      value={status}
      onChange={(event) =>
        setStatus(event.target.value)
      }
      disabled={saving}
      className="border border-border bg-background px-4 py-3"
    >
      <option value="published">
        Published
      </option>
      <option value="draft">
        Draft
      </option>
      <option value="archived">
        Archived
      </option>
    </select>
  </label>

  <div className="space-y-4 md:col-span-2">
    <div>
      <p className="text-sm font-medium">
        Product images
      </p>

      <p className="mt-1 text-xs text-muted-foreground">
        Choose a primary image, remove
        existing images, or add new ones.
      </p>
    </div>

    {product &&
      existingImages.length > 0 && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {existingImages.map(
            (image) => {
              const removed =
                removedImageIds.includes(
                  image.id,
                )

              return (
                <div
                  key={image.id}
                  className={`overflow-hidden border ${
                    removed
                      ? 'border-destructive opacity-40'
                      : 'border-border'
                  }`}
                >
                  <img
                    src={image.url}
                    alt=""
                    className="aspect-square w-full object-cover"
                  />

                  <div className="space-y-2 p-2">
                    <button
                      type="button"
                      disabled={
                        saving ||
                        removed
                      }
                      onClick={() =>
                        setPrimaryImageId(
                          image.id,
                        )
                      }
                      className="w-full border border-border px-2 py-1 text-[10px] uppercase tracking-wider"
                    >
                      {primaryImageId ===
                      image.id
                        ? 'Primary'
                        : 'Make primary'}
                    </button>

                    {removed ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          restoreExistingImage(
                            image.id,
                          )
                        }
                        className="w-full text-xs"
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          removeExistingImage(
                            image.id,
                          )
                        }
                        className="w-full text-xs text-destructive"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              )
            },
          )}
        </div>
      )}

    <label className="flex cursor-pointer items-center justify-center border border-dashed border-border p-8 text-sm hover:bg-muted">
      <input
        type="file"
        accept="image/*"
        multiple
        disabled={saving}
        onChange={handleFiles}
        className="hidden"
      />

      {saving
        ? 'Saving...'
        : 'Choose additional images'}
    </label>

    {selectedFiles.length > 0 && (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {selectedFiles.map(
          (file, index) => (
            <div
              key={`${file.name}-${file.size}-${index}`}
              className="overflow-hidden border border-border"
            >
              <img
                src={URL.createObjectURL(
                  file,
                )}
                alt={file.name}
                className="aspect-square w-full object-cover"
              />

              <div className="space-y-2 p-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    setPrimaryNewImageIndex(
                      index,
                    )
                  }
                  className="w-full border border-border px-2 py-1 text-[10px] uppercase tracking-wider"
                >
                  {primaryNewImageIndex ===
                  index
                    ? 'Primary'
                    : 'Make primary'}
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    removeNewFile(
                      index,
                    )
                  }
                  className="w-full text-xs text-destructive"
                >
                  Remove
                </button>
              </div>
            </div>
          ),
        )}
      </div>
    )}
  </div>

  {message && (
    <p
      role="status"
      className="text-sm md:col-span-2"
    >
      {message}
    </p>
  )}

  <div className="flex gap-3 md:col-span-2">
    <button
      type="submit"
      disabled={saving}
      className="bg-primary px-5 py-3 text-xs uppercase tracking-[0.15em] text-primary-foreground disabled:opacity-50"
    >
      {saving
        ? product
          ? 'Updating product...'
          : 'Creating product...'
        : product
          ? 'Update product'
          : 'Add product to catalog'}
    </button>

    {product && (
      <button
        type="button"
        disabled={saving}
        onClick={onCancelEdit}
        className="border border-border px-5 py-3 text-xs uppercase tracking-[0.15em]"
      >
        Cancel
      </button>
    )}
  </div>
</form>

)
}