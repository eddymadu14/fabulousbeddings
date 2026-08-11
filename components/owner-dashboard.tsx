'use client'
import Link from 'next/link'
import { useState } from 'react'
import { addProduct } from '@/app/actions/owner'

type ProductCategory = {
  id: number
  name: string
  slug: string
}
export function OwnerNav({ active }: { active: 'analytics' | 'products' }) { return <aside className="border-b border-border bg-primary px-5 py-5 text-primary-foreground lg:fixed lg:inset-y-0 lg:w-64 lg:border-b-0 lg:px-7 lg:py-8"><Link href="/" className="font-serif text-3xl">fabulous</Link><p className="mt-1 font-mono text-[9px] uppercase tracking-[0.22em] text-primary-foreground/55">Owner studio</p><nav className="mt-10 flex gap-5 lg:flex-col">{[['analytics','Analytics'],['products','Products']].map(([key,label]) => <Link key={key} href={`/owner/${key}`} className={`text-sm ${active === key ? 'text-accent' : 'text-primary-foreground/70'}`}>{label}</Link>)}</nav><Link href="/" className="mt-10 block text-xs text-primary-foreground/50">Back to storefront</Link></aside> }


export function ProductForm({
  categories,
}: {
  categories: ProductCategory[]
}) {
const [saving, setSaving] = useState(false)
const [message, setMessage] = useState('')
const [selectedFiles, setSelectedFiles] = useState<File[]>([])

function handleFiles(
event: React.ChangeEvent<HTMLInputElement>,
) {
const files = Array.from(event.target.files ?? [])

if (!files.length) {
  return
}

const invalidFile = files.find(
  (file) => !file.type.startsWith('image/'),
)

if (invalidFile) {
  setMessage(
    `${invalidFile.name} is not an image file.`,
  )
  event.target.value = ''
  return
}

const oversizedFile = files.find(
  (file) => file.size > 5 * 1024 * 1024,
)

if (oversizedFile) {
  setMessage(
    `${oversizedFile.name} is larger than 5MB.`,
  )
  event.target.value = ''
  return
}

setSelectedFiles(files)
setMessage('')

}

function removeFile(index: number) {
setSelectedFiles((current) =>
current.filter(
(_, fileIndex) => fileIndex !== index,
),
)
}

async function submit(
event: React.FormEvent<HTMLFormElement>,
) {
event.preventDefault()

const formElement = event.currentTarget

if (selectedFiles.length === 0) {
setMessage(
'Please select at least one product image.',
)
return
}

setSaving(true)
setMessage('')

try {
const form = new FormData(formElement)

await addProduct({
  name: String(form.get('name')),
  category: String(form.get('category')),
  description: String(form.get('description')),
  price: Number(form.get('price')),
  compareAtPrice:
    Number(form.get('compareAtPrice')) || undefined,
  stock: Number(form.get('stock')),
  status: String(form.get('status')),
  images: selectedFiles,
})

formElement.reset()
setSelectedFiles([])
setMessage('Product created successfully.')

} catch (error) {
console.error(
'Failed to create product:',
error,
)

setMessage(
  error instanceof Error
    ? error.message
    : 'Failed to create product. Please try again.',
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
  required
  disabled={saving}
  className="border border-border bg-background px-4 py-3"
>
  <option value="">
    Select a category
  </option>

  {categories.map((category) => (
    <option
      key={category.id}
      value={category.name}
    >
      {category.name}
    </option>
  ))}
</select>
  </label>

  <label className="flex flex-col gap-2 text-sm md:col-span-2">
    Description

    <textarea
      name="description"
      required
      disabled={saving}
      rows={4}
      className="border border-border bg-background px-4 py-3"
      placeholder="Describe the fabric, finish and feeling."
    />
  </label>

  <label className="flex flex-col gap-2 text-sm">
    Price (NGN)

    <input
      name="price"
      type="number"
      min="0"
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
      required
      disabled={saving}
      className="border border-border bg-background px-4 py-3"
    />
  </label>

  <label className="flex flex-col gap-2 text-sm">
    Status

    <select
      name="status"
      disabled={saving}
      className="border border-border bg-background px-4 py-3"
    >
      <option value="published">
        Published
      </option>

      <option value="draft">
        Draft
      </option>
    </select>
  </label>

  <div className="space-y-4 md:col-span-2">
    <div>
      <p className="text-sm font-medium">
        Product images
      </p>

      <p className="mt-1 text-xs text-muted-foreground">
        Select one or more images. The first image
        becomes the primary product image.
      </p>
    </div>

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
        ? 'Creating product...'
        : 'Choose product images'}
    </label>

    {selectedFiles.length > 0 && (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {selectedFiles.map((file, index) => (
          <div
            key={`${file.name}-${file.size}-${index}`}
            className="overflow-hidden border border-border"
          >
            <img
              src={URL.createObjectURL(file)}
              alt={file.name}
              className="aspect-square w-full object-cover"
            />

            <div className="flex items-center justify-between p-2">
              <span className="text-[10px] uppercase tracking-wider">
                {index === 0
                  ? 'Primary'
                  : `Image ${index + 1}`}
              </span>

              {!saving && (
                <button
                  type="button"
                  onClick={() =>
                    removeFile(index)
                  }
                  className="text-xs text-destructive"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
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

  <button
    type="submit"
    disabled={saving}
    className="bg-primary px-5 py-3 text-xs uppercase tracking-[0.15em] text-primary-foreground disabled:opacity-50 md:col-span-2"
  >
    {saving
      ? 'Creating product...'
      : 'Add product to catalog'}
  </button>
</form>

)
}

