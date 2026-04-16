import { createContext, useContext } from 'react'

// ─── Cart ─────────────────────────────────────────────────────────────────────

export interface CartProduct {
  id: string
  name: string
  price: number
  image_url?: string | null
}

export interface CartItem {
  id: string
  product_id: string
  quantity: number
  products: CartProduct
}

export interface CartData {
  cartItems: CartItem[]
  cartCount: number
  cartLoading: boolean
  addToCart: (productId: string, product: CartProduct) => Promise<void>
  removeFromCart: (cartItemId: string) => Promise<void>
  updateQuantity: (cartItemId: string, quantity: number) => Promise<void>
  clearCart: () => Promise<void>
  refreshCart: () => Promise<void>
}

export const CartContext = createContext<CartData>({
  cartItems: [], cartCount: 0, cartLoading: false,
  addToCart: async () => {}, removeFromCart: async () => {},
  updateQuantity: async () => {}, clearCart: async () => {}, refreshCart: async () => {},
})

export function useCart() { return useContext(CartContext) }

// ─── Customer ─────────────────────────────────────────────────────────────────

export interface CustomerData {
  customerId: string | null
  storeId: string | null
  customerName: string
  customerAvatar: string | null
  isLoggedIn: boolean
  loading: boolean
  refresh: () => void
}

export const CustomerContext = createContext<CustomerData>({
  customerId: null, storeId: null, customerName: '',
  customerAvatar: null, isLoggedIn: false, loading: true,
  refresh: () => {},
})

export function useCustomer() { return useContext(CustomerContext) }
