// Single source of truth lives in packages/shared.
// All mobile screens import from @/types and get the shared definitions.
export type {
  Importer,
  Product,
  OrderStatus,
  Customer,
  Order,
  OrderItem,
  CartItem,
  StoreImporter,
  ShipmentBatch,
  ShipmentItem,
} from '@importflow/shared'

export {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_FLOW,
} from '@importflow/shared'
