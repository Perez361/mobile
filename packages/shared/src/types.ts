export interface Importer {
  id: string
  email: string | null
  business_name: string | null
  full_name: string | null
  username: string | null
  phone: string | null
  location: string | null
  store_slug: string | null
  created_at: string
}

export interface Product {
  id: string
  importer_id: string
  name: string
  slug: string
  price: number
  description: string | null
  image_url: string | null
  shipping_tag: string | null
  tracking_number: string | null
  supplier_name: string | null
  supplier_url: string | null
  created_at: string
}

export type OrderStatus =
  | 'pending'
  | 'product_paid'
  | 'processing'
  | 'arrived'
  | 'shipping_billed'
  | 'shipping_paid'
  | 'delivered'
  | 'cancelled'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending:         'Pending',
  product_paid:    'Product Paid',
  processing:      'Processing',
  arrived:         'Arrived',
  shipping_billed: 'Shipping Billed',
  shipping_paid:   'Shipping Paid',
  delivered:       'Delivered',
  cancelled:       'Cancelled',
}

export const ORDER_STATUS_FLOW: Partial<Record<OrderStatus, OrderStatus>> = {
  pending:         'product_paid',
  product_paid:    'processing',
  processing:      'arrived',
  arrived:         'shipping_billed',
  shipping_billed: 'shipping_paid',
  shipping_paid:   'delivered',
}

export interface Customer {
  id: string
  store_id: string
  user_id: string
  full_name: string | null
  username: string | null
  email: string | null
  contact: string | null
  location: string | null
  shipping_address: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  customer_id: string
  store_id: string
  total: number
  shipping_fee: number | null
  status: OrderStatus
  product_paid: boolean
  product_payment_reference: string | null
  payment_reference: string | null
  momo_number: string | null
  shipping_note: string | null
  shipping_billed_at: string | null
  shipping_paid_at: string | null
  created_at: string
  updated_at: string
  customers?: Pick<Customer, 'full_name' | 'username' | 'contact' | 'email' | 'location'>
  order_items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  price: number
  products?: Pick<Product, 'id' | 'name' | 'image_url'>
}

export interface CartItem {
  id: string
  cart_id: string
  product_id: string
  quantity: number
  products: Pick<Product, 'name' | 'price' | 'image_url'>
}

export interface StoreImporter {
  id: string
  business_name: string | null
  store_slug: string
  phone: string | null
  location: string | null
}

export interface ShipmentBatch {
  id: string
  importer_id: string
  name: string
  shipping_company: string | null
  status: 'open' | 'received' | 'reconciled'
  notes: string | null
  created_at: string
  updated_at: string
  shipment_items?: ShipmentItem[]
}

export interface ShipmentItem {
  id: string
  batch_id: string
  tracking_number: string
  product_id: string | null
  status: 'pending' | 'received' | 'missing' | 'extra'
  freight_cost: number | null
  weight_kg: number | null
  notes: string | null
  created_at: string
}
