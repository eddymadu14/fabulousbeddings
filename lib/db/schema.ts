import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// ============================================================
// AUTHENTICATION
// ============================================================

export const user = pgTable('user', {
  id: text('id').primaryKey(),

  name: text('name').notNull(),

  email: text('email').notNull().unique(),

  emailVerified: boolean('emailVerified')
    .notNull()
    .default(false),

  image: text('image'),

  // Public registration always creates a customer.
  // Owner accounts must be promoted through protected server-side logic.
  role: text('role')
    .notNull()
    .default('customer'),

  createdAt: timestamp('createdAt')
    .notNull()
    .defaultNow(),

  updatedAt: timestamp('updatedAt')
    .notNull()
    .defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),

  expiresAt: timestamp('expiresAt').notNull(),

  token: text('token').notNull().unique(),

  createdAt: timestamp('createdAt')
    .notNull()
    .defaultNow(),

  updatedAt: timestamp('updatedAt')
    .notNull()
    .defaultNow(),

  ipAddress: text('ipAddress'),

  userAgent: text('userAgent'),

  userId: text('userId')
    .notNull()
    .references(() => user.id, {
      onDelete: 'cascade',
    }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),

  accountId: text('accountId').notNull(),

  providerId: text('providerId').notNull(),

  userId: text('userId')
    .notNull()
    .references(() => user.id, {
      onDelete: 'cascade',
    }),

  accessToken: text('accessToken'),

  refreshToken: text('refreshToken'),

  idToken: text('idToken'),

  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),

  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),

  scope: text('scope'),

  password: text('password'),

  createdAt: timestamp('createdAt')
    .notNull()
    .defaultNow(),

  updatedAt: timestamp('updatedAt')
    .notNull()
    .defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),

  identifier: text('identifier').notNull(),

  value: text('value').notNull(),

  expiresAt: timestamp('expiresAt').notNull(),

  createdAt: timestamp('createdAt')
    .defaultNow(),

  updatedAt: timestamp('updatedAt')
    .defaultNow(),
})


// ============================================================
// CATEGORIES
// ============================================================

export const categories = pgTable(
  'categories',
  {
    id: serial('id').primaryKey(),

    name: text('name').notNull(),

    slug: text('slug').notNull().unique(),

    description: text('description'),

    // Category image URL.
    image: text('image'),

    active: boolean('active')
      .notNull()
      .default(true),

    createdAt: timestamp('createdAt')
      .notNull()
      .defaultNow(),

    updatedAt: timestamp('updatedAt')
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('categories_slug_idx').on(table.slug),
  ],
)


// ============================================================
// PRODUCTS
// ============================================================

export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),

    categoryId: integer('categoryId')
      .notNull()
      .references(() => categories.id, {
        onDelete: 'restrict',
      }),

    // Owner who created/managed the product.
    createdBy: text('createdBy')
      .notNull()
      .references(() => user.id, {
        onDelete: 'restrict',
      }),

    name: text('name').notNull(),

    slug: text('slug').notNull().unique(),

    description: text('description').notNull(),

    // Base price.
    // Used when the product has no variant-specific price.
    price: integer('price').notNull(),

    // Optional original price for displaying discounts.
    compareAtPrice: integer('compareAtPrice'),

    // Main/thumbnail image.
    image: text('image').notNull(),

    // Overall product stock.
    // Useful for products without variants.
    stock: integer('stock')
      .notNull()
      .default(0),

    status: text('status')
      .notNull()
      .default('draft'),

    featured: boolean('featured')
      .notNull()
      .default(false),

    createdAt: timestamp('createdAt')
      .notNull()
      .defaultNow(),

    updatedAt: timestamp('updatedAt')
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('products_slug_idx').on(table.slug),
  ],
)


// ============================================================
// PRODUCT IMAGES
// ============================================================

export const productImages = pgTable('product_images', {
  id: serial('id').primaryKey(),

  productId: integer('productId')
    .notNull()
    .references(() => products.id, {
      onDelete: 'cascade',
    }),

  // URL returned by Cloudinary or another image service.
  url: text('url').notNull(),

  // Optional Cloudinary public ID.
  // Useful later when deleting/replacing images.
  publicId: text('publicId'),

  // Controls gallery ordering.
  sortOrder: integer('sortOrder')
    .notNull()
    .default(0),

  createdAt: timestamp('createdAt')
    .notNull()
    .defaultNow(),
})


// ============================================================
// PRODUCT VARIANTS
// ============================================================

export const productVariants = pgTable('product_variants', {
  id: serial('id').primaryKey(),

  productId: integer('productId')
    .notNull()
    .references(() => products.id, {
      onDelete: 'cascade',
    }),

  // Completely free-form.
  //
  // Examples:
  // "6 × 6"
  // "6 × 7"
  // "Extra Large"
  // "Standard"
  // "Custom"
  name: text('name').notNull(),

  // Every variant can have its own price.
  price: integer('price').notNull(),

  stock: integer('stock')
    .notNull()
    .default(0),

  active: boolean('active')
    .notNull()
    .default(true),

  createdAt: timestamp('createdAt')
    .notNull()
    .defaultNow(),

  updatedAt: timestamp('updatedAt')
    .notNull()
    .defaultNow(),
})


// ============================================================
// ANONYMOUS VISITORS
// ============================================================

export const visitorSessions = pgTable('visitor_sessions', {
  // Random ID stored in a secure cookie.
  id: text('id').primaryKey(),

  createdAt: timestamp('createdAt')
    .notNull()
    .defaultNow(),

  lastSeenAt: timestamp('lastSeenAt')
    .notNull()
    .defaultNow(),
})


// ============================================================
// CARTS
// ============================================================

export const carts = pgTable(
  'carts',
  {
    id: serial('id').primaryKey(),

    // Used when the shopper has no account.
    visitorId: text('visitorId')
      .references(() => visitorSessions.id, {
        onDelete: 'cascade',
      }),

    // Used after a shopper creates/logs into an account.
    userId: text('userId')
      .references(() => user.id, {
        onDelete: 'cascade',
      }),

    createdAt: timestamp('createdAt')
      .notNull()
      .defaultNow(),

    updatedAt: timestamp('updatedAt')
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('carts_visitor_id_idx').on(table.visitorId),

    uniqueIndex('carts_user_id_idx').on(table.userId),
  ],
)


// ============================================================
// CART ITEMS
// ============================================================

export const cartItems = pgTable('cart_items', {
  id: serial('id').primaryKey(),

  cartId: integer('cartId')
    .notNull()
    .references(() => carts.id, {
      onDelete: 'cascade',
    }),

  productId: integer('productId')
    .notNull()
    .references(() => products.id, {
      onDelete: 'restrict',
    }),

  // Exact variant selected by the customer.
  //
  // This is what allows:
  //
  // 6 × 6 → ₦120,000
  // 6 × 7 → ₦130,000
  // 8 × 8 → ₦160,000
  //
  // to be handled correctly.
  variantId: integer('variantId')
    .references(() => productVariants.id, {
      onDelete: 'restrict',
    }),

  quantity: integer('quantity')
    .notNull()
    .default(1),

  createdAt: timestamp('createdAt')
    .notNull()
    .defaultNow(),

  updatedAt: timestamp('updatedAt')
    .notNull()
    .defaultNow(),
})


// ============================================================
// ORDERS
// ============================================================

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),

  // Nullable because guests can checkout.
  userId: text('userId')
    .references(() => user.id, {
      onDelete: 'set null',
    }),

  // Useful for connecting a guest order to the visitor.
  visitorId: text('visitorId')
    .references(() => visitorSessions.id, {
      onDelete: 'set null',
    }),

  customerName: text('customerName').notNull(),

  customerEmail: text('customerEmail').notNull(),

  customerPhone: text('customerPhone'),

  total: integer('total').notNull(),

  status: text('status')
    .notNull()
    .default('pending'),

  createdAt: timestamp('createdAt')
    .notNull()
    .defaultNow(),

  fulfilledAt: timestamp('fulfilledAt'),
})


// ============================================================
// ORDER ITEMS
// ============================================================

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),

  orderId: integer('orderId')
    .notNull()
    .references(() => orders.id, {
      onDelete: 'cascade',
    }),

  productId: integer('productId')
    .references(() => products.id, {
      onDelete: 'set null',
    }),

  variantId: integer('variantId')
    .references(() => productVariants.id, {
      onDelete: 'set null',
    }),

  // Snapshot data.
  //
  // We store these because the product could later
  // be renamed or its price changed.
  productName: text('productName').notNull(),

  variantName: text('variantName'),

  unitPrice: integer('unitPrice').notNull(),

  quantity: integer('quantity').notNull(),
})


// ============================================================
// PAGE VISITS
// ============================================================

export const pageVisits = pgTable('page_visits', {
  id: serial('id').primaryKey(),

  // Registered visitor.
  userId: text('userId')
    .references(() => user.id, {
      onDelete: 'set null',
    }),

  // Anonymous visitor.
  visitorId: text('visitorId')
    .references(() => visitorSessions.id, {
      onDelete: 'set null',
    }),

  path: text('path').notNull(),

  createdAt: timestamp('createdAt')
    .notNull()
    .defaultNow(),
})