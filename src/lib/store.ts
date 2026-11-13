import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, Product } from "../types";

type StoreState = {
  cart: CartItem[];
  wishlist: string[];
  addToCart: (product: Product, size: string, color: string) => void;
  setQuantity: (id: string, size: string, color: string, quantity: number) => void;
  removeFromCart: (id: string, size: string, color: string) => void;
  toggleWishlist: (id: string) => void;
  clearCart: () => void;
};

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      cart: [],
      wishlist: [],
      addToCart: (product, size, color) =>
        set((state) => {
          if (product.stock < 1) return state;
          const found = state.cart.find(
            (item) => item.product.id === product.id && item.size === size && item.color === color,
          );
          if (found) {
            return {
              cart: state.cart.map((item) =>
                item === found
                  ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) }
                  : item,
              ),
            };
          }
          return { cart: [...state.cart, { product, size, color, quantity: 1 }] };
        }),
      setQuantity: (id, size, color, quantity) =>
        set((state) => ({
          cart: state.cart.map((item) =>
            item.product.id === id && item.size === size && item.color === color
              ? { ...item, quantity: Math.max(1, Math.min(quantity, item.product.stock)) }
              : item,
          ),
        })),
      removeFromCart: (id, size, color) =>
        set((state) => ({
          cart: state.cart.filter(
            (item) => !(item.product.id === id && item.size === size && item.color === color),
          ),
        })),
      toggleWishlist: (id) =>
        set((state) => ({
          wishlist: state.wishlist.includes(id)
            ? state.wishlist.filter((item) => item !== id)
            : [...state.wishlist, id],
        })),
      clearCart: () => set({ cart: [] }),
    }),
    { name: "aavya-store" },
  ),
);
