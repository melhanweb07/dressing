import { AppError } from "./errors.js";

type DbOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  phone: string;
  email: string | null;
  address: string;
  city: string;
  state: string;
  pincode: string;
  notes: string | null;
  admin_notes?: string | null;
  subtotal: number | string;
  delivery_charge: number | string;
  total: number | string;
  payment_status: string;
  payment_method: string;
  status: string;
  created_at: string;
  order_items?: Array<{
    id: string;
    product_id: string;
    product_name: string;
    image_url: string;
    unit_price: number | string;
    quantity: number;
    size: string;
    color: string;
  }>;
};

export function toOrder(row: DbOrder, includePrivate = false) {
  return {
    id: row.order_number,
    createdAt: row.created_at,
    customer: {
      name: row.customer_name,
      phone: includePrivate ? row.phone : undefined,
      email: includePrivate ? row.email ?? undefined : undefined,
      address: includePrivate ? row.address : undefined,
      city: includePrivate ? row.city : undefined,
      state: includePrivate ? row.state : undefined,
      pincode: includePrivate ? row.pincode : undefined,
      notes: includePrivate ? row.notes ?? undefined : undefined,
    },
    items: (row.order_items ?? []).map((item) => ({
      product: {
        id: item.product_id,
        name: item.product_name,
        image: item.image_url,
        price: Number(item.unit_price),
      },
      size: item.size,
      color: item.color,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      total: Number(item.unit_price) * item.quantity,
    })),
    subtotal: Number(row.subtotal),
    delivery: Number(row.delivery_charge),
    total: Number(row.total),
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    status: row.status,
    ...(includePrivate ? { adminNotes: row.admin_notes ?? null } : {}),
  };
}

export function toRpcItems(items: Array<{ product: { id: string }; size: string; color: string; quantity: number }>) {
  return items.map((item) => ({
    productId: item.product.id,
    size: item.size,
    color: item.color,
    quantity: item.quantity,
  }));
}

export function requireRpcId(value: unknown): string {
  if (typeof value !== "string") throw new AppError(500, "Order transaction returned an invalid result.");
  return value;
}
