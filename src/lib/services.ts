import { authApi, ordersApi, productsApi, storeSettingsApi } from "./apiServices";
import { demoProducts } from "../data/products";
import type { Order, Product, StoreSettings } from "../types";

const demoOrdersKey = "aavya-demo-orders";

export async function getProducts(): Promise<Product[]> {
  if (import.meta.env.DEV) return demoProducts;
  return productsApi.list();
}

export async function getStoreSettings(): Promise<StoreSettings | null> {
  if (import.meta.env.DEV) return null;
  return storeSettingsApi.get();
}

export async function submitOrder(order: Omit<Order, "id" | "createdAt" | "paymentStatus" | "status">): Promise<Order> {
  if (!import.meta.env.DEV) {
    return ordersApi.create(order);
  }
  const orders = JSON.parse(localStorage.getItem(demoOrdersKey) || "[]") as Order[];
  const newOrder: Order = {
    ...order,
    id: `AAV-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    paymentStatus: "Pending",
    status: "Pending Confirmation",
  };
  localStorage.setItem(demoOrdersKey, JSON.stringify([newOrder, ...orders]));
  return newOrder;
}

export async function trackOrder(orderId: string, phone: string): Promise<Order> {
  if (!import.meta.env.DEV) {
    return ordersApi.track(orderId, phone);
  }
  const orders = JSON.parse(localStorage.getItem(demoOrdersKey) || "[]") as Order[];
  const order = orders.find((item) => item.id === orderId.trim() && item.customer.phone === phone.trim());
  if (!order) throw new Error("We couldn't find an order matching those details.");
  return order;
}

export async function adminLogin(email: string, password: string): Promise<string> {
  const session = await authApi.login(email, password);
  localStorage.setItem("aavya-admin-refresh-token", session.refreshToken);
  return session.token;
}

export async function adminLogout(): Promise<void> {
  const token = localStorage.getItem("aavya-admin-token");
  try {
    if (token) await authApi.logout(token);
  } finally {
    localStorage.removeItem("aavya-admin-token");
    localStorage.removeItem("aavya-admin-refresh-token");
  }
}
