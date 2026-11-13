import { api } from "./api";
import type { Category, Order, Product, StoreSettings } from "../types";

export const authApi = {
  login: async (email: string, password: string) => {
    const { data } = await api.post<{ token: string; refreshToken: string; expiresAt?: number }>("/auth/admin/login", { email, password });
    return data;
  },
  refresh: async (refreshToken: string) =>
    (await api.post<{ token: string; refreshToken: string; expiresAt?: number }>("/auth/refresh", { refreshToken })).data,
  logout: async (token: string) =>
    api.post("/auth/logout", undefined, { headers: { Authorization: `Bearer ${token}` } }),
};

export const productsApi = {
  list: async () => {
    const { data } = await api.get<Product[] | { items: Product[] }>("/products");
    return Array.isArray(data) ? data : data.items;
  },
  get: async (id: string) => (await api.get<Product>(`/products/${encodeURIComponent(id)}`)).data,
  create: async (product: Record<string, unknown>, token: string) =>
    (await api.post<Product>("/admin/products", product, { headers: { Authorization: `Bearer ${token}` } })).data,
  update: async (id: string, product: Record<string, unknown>, token: string) =>
    (await api.patch<Product>(`/admin/products/${encodeURIComponent(id)}`, product, { headers: { Authorization: `Bearer ${token}` } })).data,
  remove: async (id: string, token: string) =>
    api.delete(`/admin/products/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } }),
};

export const categoriesApi = {
  list: async () => {
    const { data } = await api.get<Array<Record<string, unknown>>>("/categories");
    return data.map((item) => ({
      id: String(item.id),
      name: String(item.name),
      image: String(item.image ?? ""),
      visible: Boolean(item.visible),
    })) as Category[];
  },
  create: async (category: Record<string, unknown>, token: string) =>
    (await api.post<Category>("/admin/categories", category, { headers: { Authorization: `Bearer ${token}` } })).data,
  update: async (id: string, category: Record<string, unknown>, token: string) =>
    (await api.patch<Category>(`/admin/categories/${encodeURIComponent(id)}`, category, { headers: { Authorization: `Bearer ${token}` } })).data,
  remove: async (id: string, token: string) =>
    api.delete(`/admin/categories/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } }),
};

export const ordersApi = {
  create: async (order: Omit<Order, "id" | "createdAt" | "paymentStatus" | "status">) =>
    (await api.post<Order>("/orders", {
      customer: order.customer,
      items: order.items.map((item) => ({
        product: { id: item.product.id },
        size: item.size,
        color: item.color,
        quantity: item.quantity,
      })),
      paymentMethod: "gpay",
    })).data,
  track: async (orderId: string, phone: string) =>
    (await api.get<Order>("/orders/track", { params: { orderId, phone } })).data,
  listAdmin: async (token: string) => {
    const { data } = await api.get<Order[] | { items: Order[] }>("/admin/orders", { headers: { Authorization: `Bearer ${token}` } });
    return Array.isArray(data) ? data : data.items;
  },
  updateAdmin: async (id: string, update: Partial<Pick<Order, "status" | "paymentStatus">>, token: string) =>
    (await api.patch<Order>(`/admin/orders/${encodeURIComponent(id)}`, update, { headers: { Authorization: `Bearer ${token}` } })).data,
};

export const wishlistApi = {
  list: async () => (await api.get<Product[]>("/wishlist")).data,
  add: async (productId: string) => api.post("/wishlist", { productId }),
  remove: async (productId: string) => api.delete(`/wishlist/${encodeURIComponent(productId)}`),
};

export const storeSettingsApi = {
  get: async () => (await api.get<StoreSettings>("/store/settings")).data,
  update: async (settings: Partial<StoreSettings>, token: string) =>
    (await api.patch<StoreSettings>("/admin/store/settings", settings, { headers: { Authorization: `Bearer ${token}` } })).data,
};

export const uploadApi = {
  images: async (files: File[], type: "products" | "categories" | "store", token: string) => {
    const form = new FormData();
    form.append("type", type);
    files.forEach((file) => form.append("files", file));
    return (await api.post<string[]>("/admin/uploads", form, {
      headers: { Authorization: `Bearer ${token}` },
    })).data;
  },
  removeImage: async (path: string, token: string) =>
    (await api.delete("/admin/uploads", {
      data: { path },
      headers: { Authorization: `Bearer ${token}` },
    })).data,
};
