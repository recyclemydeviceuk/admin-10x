// =========================================================
// 10X ADMIN — shared types.
// Order/customer shapes mirror 10x/lib/store/types.ts so the
// storefront and panel can share one backend later.
// =========================================================

/* -------------------------------------------------------------- orders */

export const ORDER_STAGES = [
  'placed',
  'confirmed',
  'packed',
  'shipped',
  'out_for_delivery',
  'delivered',
] as const;

export type OrderStage = (typeof ORDER_STAGES)[number];
export type OrderStatus = OrderStage | 'cancelled' | 'returned';

export const STAGE_LABEL: Record<OrderStatus, string> = {
  placed: 'Placed',
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
};

export type PaymentMethod = 'online' | 'cod';
export type PaymentStatus = 'paid' | 'pending' | 'refunded' | 'failed';

export type OrderItem = {
  sku: string;
  name: string;
  packets: string;
  quantity: number;
  price: number; // unit price in rupees
  /** Catalogue linkage — what stock decrements and reorders are keyed on. */
  productId?: string;
  tierId?: string;
  tierName?: string;
};

export type OrderEvent = {
  stage: OrderStage;
  at: string | null;
  note?: string;
};

export type OrderAddress = {
  fullName: string;
  phone: string;
  house: string;
  street: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
};

export type Shipment = {
  provider: 'shiprocket' | 'manual';
  shipmentId?: string;
  orderId?: string; // Shiprocket's order id
  awb?: string;
  courier?: string;
  status?: string;
  createdAt: string;
  pickupRequestedAt?: string;
  labelUrl?: string;
  invoiceUrl?: string;
  lastSyncedAt?: string;
};

export type Payment = {
  provider: 'cashfree' | 'cod';
  cfOrderId?: string;
  cfPaymentId?: string;
  method?: string; // upi / card / netbanking …
  capturedAt?: string;
  refunds?: { refundId: string; amount: number; at: string; note?: string }[];
};

export type Order = {
  id: string;
  reference: string;
  /** Assigned the first time the system invoice is generated, e.g. INV-2026-0042. */
  invoiceNo?: string;
  placedAt: string;
  status: OrderStatus;
  customerId: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  couponCode?: string;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  payment?: Payment;
  address: OrderAddress;
  timeline: OrderEvent[];
  shipment?: Shipment;
  courier?: string;
  trackingNumber?: string;
  estimatedDelivery?: string;
  subscriptionId?: string;
  /**
   * Order type, NOT a sales channel — everything sells on the website.
   * 'website' = one-time purchase, 'subscription' = a subscription cycle.
   */
  channel: 'website' | 'subscription';
  notes?: { by: string; at: string; text: string }[];
};

/* ----------------------------------------------------------- customers */

/** A saved delivery address from the customer's own address book. */
export type CustomerAddress = {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  house: string;
  street: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
};

export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  joinedAt: string;
  city: string;
  state: string;
  ordersCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  hasSubscription: boolean;
  marketingOptIn: boolean;
  /** Address book the customer manages on the storefront. */
  addresses?: CustomerAddress[];
};

/* ------------------------------------------------------------ products */

export type ProductTier = {
  id: string; // e.g. "10-pack"
  name: string;
  packets: number;
  oneTimePrice: number;
  subscribePrice: number;
  available: boolean;
  stock: number;
  lowStockAt: number;
};

/** Product-page hero copy — everything above the fold on the storefront. */
export type ProductStorefront = {
  /** Lead-in above the pack name, e.g. "10X Day Time —". */
  kicker: string;
  /** Line under the plan selector, e.g. "Skip or cancel anytime…". */
  subscriptionNote: string;
  /** Under the one-time price, e.g. "One-time purchase · incl. GST". */
  priceNote: string;
  /** Under the subscription price. */
  subscribePriceNote: string;
  /** Add-to-cart button label. */
  ctaLabel: string;
  /** "Perfect for …" sentence tail. */
  perfectFor: string;
  /** Bullet pointers under the description — any number. */
  benefits: string[];
};

export const DEFAULT_STOREFRONT: ProductStorefront = {
  kicker: '',
  subscriptionNote: 'Skip or cancel anytime, no login required.',
  priceNote: 'One-time purchase · incl. GST',
  subscribePriceNote: 'Every 4 weeks · skip or cancel anytime · incl. GST',
  ctaLabel: 'Add to Cart',
  perfectFor: '',
  benefits: [],
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  status: 'active' | 'draft' | 'archived';
  images: string[]; // urls (public/uploads or storefront assets)
  /** Photography for the dark and black looks; empty falls back to `images`. */
  imagesDark?: string[];
  video?: string;
  tiers: ProductTier[];
  seo: { title: string; description: string };
  /** Hero copy shown on the storefront product page. */
  storefront?: ProductStorefront;
  updatedAt: string;
};

/* ------------------------------------------------------------- coupons */

export type Coupon = {
  id: string;
  code: string;
  description: string;
  type: 'percent' | 'flat';
  value: number; // percent (1–100) or rupees
  minOrder: number;
  maxDiscount?: number; // cap for percent coupons
  usageLimit: number | null; // null = unlimited
  usedCount: number;
  perCustomerLimit: number | null;
  startsAt: string;
  expiresAt: string | null;
  active: boolean;
  createdBy: string;
};

/* ------------------------------------------------------- subscriptions */

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled';

export type Subscription = {
  id: string;
  reference: string;
  customerId: string;
  customerName: string;
  /** Catalogue linkage — the cycle order is raised against these. */
  productId?: string;
  tierId?: string;
  quantity?: number;
  sku: string;
  productName: string;
  packets: string;
  price: number;
  cadence: string;
  status: SubscriptionStatus;
  startedAt: string;
  nextDelivery: string | null;
  cyclesDelivered: number;
  /** Cashfree mandate state — read-only, the mandate lives with Cashfree. */
  autopay?: string;
  autopayLastCharge?: string;
  /** Customer chose pay on delivery — reminders stop. */
  autopayDeclined?: boolean;
  autopayReminders?: number;
  autopayLastReminderAt?: string | null;
};

/* ------------------------------------------------------------- returns */

export const RETURN_STATUSES = [
  'requested',
  'approved',
  'received',
  'refunded',
  'rejected',
] as const;

export type ReturnStatus = (typeof RETURN_STATUSES)[number];

export const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = {
  requested: 'Requested',
  approved: 'Pickup arranged',
  received: 'Received at warehouse',
  refunded: 'Refunded',
  rejected: 'Rejected',
};

export const RETURN_REASONS = [
  'Damaged in transit',
  'Wrong item received',
  'Quality not as expected',
  'Allergic reaction / medical',
  'Ordered by mistake',
  'Other',
] as const;

export type ReturnRequest = {
  id: string;
  reference: string; // RET-xxxx — what the customer sees
  orderId: string;
  orderReference: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  reason: string;
  description: string;
  photos: string[]; // /uploads/returns/…
  status: ReturnStatus;
  requestedAt: string;
  /** Refund amount in rupees (defaults to the order total). */
  amount: number;
  paymentMethod: PaymentMethod;
  /** Shiprocket return shipment (customer → warehouse). */
  pickup?: {
    srOrderId?: string;
    shipmentId?: string;
    awb?: string;
    courier?: string;
    scheduledAt?: string;
  };
  refund?: { refundId?: string; at: string; mode: 'cashfree' | 'manual' };
  rejectReason?: string;
  resolvedAt?: string;
  notes: { by: string; at: string; text: string }[];
};

/* ------------------------------------------------------------- queries */

export const QUERY_TOPICS = [
  { value: 'product', label: 'Product & ingredients' },
  { value: 'order', label: 'Order & delivery' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'refund', label: 'Returns & refunds' },
  { value: 'bulk', label: 'Bulk & corporate' },
  { value: 'stockist', label: 'Stocking 10X' },
  { value: 'other', label: 'Something else' },
  { value: 'callback', label: 'Call back request' },
] as const;

export type QueryTopic = (typeof QUERY_TOPICS)[number]['value'];

export const QUERY_STATUSES = ['new', 'open', 'answered', 'closed'] as const;
export type QueryStatus = (typeof QUERY_STATUSES)[number];

export const QUERY_STATUS_LABEL: Record<QueryStatus, string> = {
  new: 'New',
  open: 'Open',
  answered: 'Answered',
  closed: 'Closed',
};

/** A question asked on the storefront's contact form. */
export type CustomerQuery = {
  id: string;
  /** Human-facing reference given to the customer on submit. */
  reference: string;
  topic: QueryTopic;
  name: string;
  email: string;
  phone: string;
  /** Only meaningful for order and refund topics. */
  orderReference: string;
  message: string;
  status: QueryStatus;
  submittedAt: string;
  reply: string;
  answeredAt: string | null;
  answeredBy: string;
};

export function queryTopicLabel(topic: string): string {
  return QUERY_TOPICS.find((t) => t.value === topic)?.label ?? 'Something else';
}

/* ---------------------------------------------------------- team / rbac */

export type Role = {
  id: string;
  name: string;
  description: string;
  /** Permission ids from lib/permissions.ts. Super Admin uses ['*']. */
  permissions: string[];
  system: boolean; // system roles can't be deleted
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName?: string;
  protected?: boolean;
  avatarUrl?: string;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

/* ------------------------------------------------------------ settings */

export type Settings = {
  store: {
    name: string;
    supportEmail: string;
    supportPhone: string;
    freeShippingOver: number;
    flatShipping: number;
    codEnabled: boolean;
  };
  syncing: {
    autoShipments: boolean;
  };
  /** Where Shiprocket delivers returned parcels. */
  warehouse: {
    name: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
  };
};

/* -------------------------------------------------------------- money */

export function inr(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}
