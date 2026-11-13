import { z } from "zod";

const uuid = z.string().uuid();
const slug = z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const phone = z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number.");
const url = z.string().url().max(2048);

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(256),
});
export const refreshSchema = z.object({ refreshToken: z.string().min(1).max(4096) });

const productFieldsSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug,
  description: z.string().trim().max(10000).default(""),
  categoryId: uuid,
  price: z.number().finite().positive().max(10_000_000),
  discountPrice: z.number().finite().positive().max(10_000_000).nullable().optional(),
  sku: z.string().trim().min(1).max(80),
  images: z.array(url).max(12).default([]),
  sizes: z.array(z.string().trim().min(1).max(30)).max(30).default([]),
  colors: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
  material: z.string().trim().max(200).default(""),
  stock: z.number().int().min(0).max(1_000_000).default(0),
  featured: z.boolean().default(false),
  active: z.boolean().default(true),
});

export const productInputSchema = productFieldsSchema.refine((value) => value.discountPrice == null || value.discountPrice < value.price, {
  path: ["discountPrice"],
  message: "Discount price must be lower than the regular price.",
});

export const productPatchSchema = productFieldsSchema.partial()
  .refine((value) => Object.keys(value).length > 0, { message: "At least one product field is required." })
  .refine((value) => value.discountPrice == null || value.price === undefined || value.discountPrice < value.price, {
    path: ["discountPrice"],
    message: "Discount price must be lower than the regular price.",
  });

export const productStatusSchema = z.object({ active: z.boolean() });

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug,
  image: url.nullable().optional(),
  visible: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(100_000).default(0),
});

export const categoryPatchSchema = categoryInputSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one category field is required.",
});

export const orderInputSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(120),
    phone,
    email: z.union([z.literal(""), z.string().trim().email().max(254)]).optional(),
    address: z.string().trim().min(8).max(500),
    city: z.string().trim().min(2).max(100),
    state: z.string().trim().min(2).max(100),
    pincode: z.string().trim().regex(/^\d{6}$/),
    notes: z.string().trim().max(1000).optional(),
  }),
  items: z.array(z.object({
    product: z.object({ id: uuid }),
    size: z.string().trim().min(1).max(30),
    color: z.string().trim().min(1).max(50),
    quantity: z.number().int().min(1).max(50),
  })).min(1).max(50),
  paymentMethod: z.enum(["gpay", "cod"]).default("gpay"),
}).strict();

export const trackOrderSchema = z.object({
  orderId: z.string().trim().min(1).max(50),
  phone,
});

export const listProductsSchema = z.object({
  search: z.string().trim().max(120).optional(),
  category: z.string().trim().max(120).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  size: z.string().trim().max(30).optional(),
  color: z.string().trim().max(50).optional(),
  sort: z.enum(["featured", "price_asc", "price_desc", "newest", "popularity"]).default("featured"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
}).refine((query) => query.minPrice === undefined || query.maxPrice === undefined || query.minPrice <= query.maxPrice, {
  path: ["minPrice"],
  message: "Minimum price cannot exceed maximum price.",
});

export const listOrdersSchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(["Pending Confirmation", "Confirmed", "Processing", "Packed", "Shipped", "Out for Delivery", "Delivered", "Cancelled"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const orderStatusSchema = z.object({
  status: z.enum(["Pending Confirmation", "Confirmed", "Processing", "Packed", "Shipped", "Out for Delivery", "Delivered", "Cancelled"]),
});

export const paymentStatusSchema = z.object({
  paymentStatus: z.enum(["Pending", "Payment Reported", "Verified", "Failed", "Refunded"]),
});

export const orderNotesSchema = z.object({ adminNotes: z.string().trim().max(2000).nullable() });

export const orderAdminPatchSchema = z.object({
  status: orderStatusSchema.shape.status.optional(),
  paymentStatus: paymentStatusSchema.shape.paymentStatus.optional(),
  adminNotes: z.string().trim().max(2000).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: "At least one order field is required." });

export const wishlistInputSchema = z.object({ productId: uuid });

export const settingsInputSchema = z.object({
  shopName: z.string().trim().min(1).max(120).optional(),
  logoUrl: url.nullable().optional(),
  contactNumber: z.string().trim().max(30).optional(),
  whatsappNumber: z.string().trim().max(30).optional(),
  gpayNumber: z.string().trim().max(80).optional(),
  address: z.string().trim().max(1000).optional(),
  deliveryCharge: z.number().finite().min(0).max(100_000).optional(),
  freeDeliveryThreshold: z.number().finite().min(0).max(10_000_000).optional(),
  instagramUrl: url.nullable().optional(),
  facebookUrl: url.nullable().optional(),
  shippingInfo: z.string().trim().max(5000).optional(),
  returnPolicy: z.string().trim().max(5000).optional(),
  codEnabled: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: "At least one setting is required." });

export const uploadTypeSchema = z.enum(["products", "categories", "store"]);
