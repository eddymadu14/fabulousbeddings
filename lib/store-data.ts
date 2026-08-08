export type Category = 'Bedding' | 'Pillows' | 'Duvets' | 'Accessories'

export type Product = {
  id: string
  name: string
  category: Category
  price: number
  compareAt?: number
  image: string
  badge?: string
  rating: number
  reviews: number
  description: string
  sizes: string[]
  colors: string[]
  material: string
  featured?: boolean
}

export const products: Product[] = [
  {
    id: 'satin-cloud-set',
    name: 'Satin Cloud Bedding Set',
    category: 'Bedding',
    price: 98500,
    compareAt: 120000,
    image: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=1000&q=85',
    badge: 'Bestseller',
    rating: 4.9,
    reviews: 84,
    description: 'A luminous hotel-inspired set that brings a quiet, polished softness to your bedroom.',
    sizes: ['Queen', 'King', 'Super King'],
    colors: ['Pearl', 'Sand', 'Mauve'],
    material: '600 thread count cotton sateen',
    featured: true,
  },
  {
    id: 'signature-duvet',
    name: 'Signature Duvet',
    category: 'Duvets',
    price: 68000,
    image: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1000&q=85',
    badge: 'New',
    rating: 4.8,
    reviews: 42,
    description: 'Cloud-like warmth with a breathable finish for the kind of sleep you look forward to.',
    sizes: ['Queen', 'King'],
    colors: ['Ivory', 'Ash'],
    material: 'Premium microfiber fill',
    featured: true,
  },
  {
    id: 'silk-touch-pillow',
    name: 'Silk Touch Pillow Pair',
    category: 'Pillows',
    price: 24500,
    image: 'https://images.unsplash.com/photo-1616627561950-9f746e330187?auto=format&fit=crop&w=1000&q=85',
    rating: 4.7,
    reviews: 31,
    description: 'Supportive, soft and finished in a smooth cover for a beautifully restful night.',
    sizes: ['Standard', 'King'],
    colors: ['White', 'Blush'],
    material: 'Microfiber and cotton blend',
    featured: true,
  },
  {
    id: 'linen-throw',
    name: 'Linen Fringe Throw',
    category: 'Accessories',
    price: 32000,
    compareAt: 39000,
    image: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=1000&q=85',
    badge: 'Sale',
    rating: 4.6,
    reviews: 18,
    description: 'A tactile finishing layer with a relaxed fringe and an easy, lived-in drape.',
    sizes: ['One size'],
    colors: ['Oat', 'Rose'],
    material: 'Washed linen blend',
  },
  {
    id: 'hotel-sheet-set',
    name: 'Hotel Sheet Set',
    category: 'Bedding',
    price: 75000,
    image: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1000&q=85',
    rating: 4.8,
    reviews: 57,
    description: 'Crisp, cool and quietly luxurious sheets inspired by five-star stays.',
    sizes: ['Queen', 'King'],
    colors: ['White', 'Champagne'],
    material: '400 thread count cotton',
  },
  {
    id: 'velvet-cushion',
    name: 'Velvet Accent Cushion',
    category: 'Accessories',
    price: 18000,
    image: 'https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=1000&q=85',
    rating: 4.5,
    reviews: 22,
    description: 'A jewel-toned accent to make your bed feel more collected and considered.',
    sizes: ['18 x 18 in'],
    colors: ['Cocoa', 'Olive', 'Blush'],
    material: 'Cotton velvet',
  },
]

export const categories = [
  { name: 'Bedding', count: '24 pieces', image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=900&q=85' },
  { name: 'Pillows', count: '12 pieces', image: 'https://images.unsplash.com/photo-1582562124811-c09040d0a901?auto=format&fit=crop&w=900&q=85' },
  { name: 'Duvets', count: '8 pieces', image: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=900&q=85' },
  { name: 'Accessories', count: '16 pieces', image: 'https://images.unsplash.com/photo-1617104678098-de229db51175?auto=format&fit=crop&w=900&q=85' },
]

export const formatPrice = (price: number) => `₦${price.toLocaleString('en-NG')}`

export const findProduct = (id: string) => products.find((product) => product.id === id)

export const relatedProducts = (product: Product) => products.filter((item) => item.id !== product.id && item.category === product.category).slice(0, 3)

export type CartItem = { productId: string; quantity: number; size: string; color: string }

export const cartSubtotal = (cart: CartItem[]) => cart.reduce((total, item) => total + (findProduct(item.productId)?.price ?? 0) * item.quantity, 0)

export const getCartItems = (cart: CartItem[]) => cart.map((item) => ({ ...item, product: findProduct(item.productId) })).filter((item) => item.product)

export const getCartCount = (cart: CartItem[]) => cart.reduce((total, item) => total + item.quantity, 0)

export const getCartPreview = () => [
  { productId: 'satin-cloud-set', quantity: 1, size: 'King', color: 'Pearl' },
  { productId: 'silk-touch-pillow', quantity: 1, size: 'Standard', color: 'White' },
] as CartItem[]

export const heroImage = 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1800&q=90'

export const editorialImage = 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=85'

export const testimonials = [
  { quote: 'The quality is absolutely beautiful. My room feels like a boutique hotel now.', name: 'Amara O.', location: 'Lagos' },
  { quote: 'Everything arrived beautifully wrapped and the bedding is even softer than I expected.', name: 'Tolu A.', location: 'Abuja' },
  { quote: 'Finally, bedding that feels considered and luxurious without being over the top.', name: 'Nneka E.', location: 'Port Harcourt' },
]
