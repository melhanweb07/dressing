import type { Request, Response } from "express";
import { supabase } from "../config/supabase.js";
import type { AuthenticatedRequest } from "../types/index.js";
import { AppError, fromSupabaseError } from "../utils/errors.js";
import { sendSuccess } from "../utils/http.js";
import { toPublicProduct, type DbProduct } from "../utils/product.js";

function userId(req: Request) {
  const user = (req as AuthenticatedRequest).user;
  if (!user) throw new AppError(401, "Authentication is required.");
  return user.id;
}

export async function getWishlist(req: Request, res: Response) {
  const { data, error } = await supabase.from("wishlist_items")
    .select("product_id, products!inner(*, categories(name))")
    .eq("user_id", userId(req))
    .eq("products.active", true);
  if (error) throw fromSupabaseError(error);
  const products = (data ?? []).flatMap((item) => {
    const product = item.products as unknown as DbProduct | null;
    return product ? [toPublicProduct(product)] : [];
  });
  return sendSuccess(res, products, "Wishlist fetched successfully.");
}

export async function addWishlistItem(req: Request, res: Response) {
  const { productId } = req.body as { productId: string };
  const { data: product, error: productError } = await supabase.from("products").select("id").eq("id", productId).eq("active", true).maybeSingle();
  if (productError) throw fromSupabaseError(productError);
  if (!product) throw new AppError(404, "Product not found.");
  const { error } = await supabase.from("wishlist_items").upsert(
    { user_id: userId(req), product_id: productId },
    { onConflict: "user_id,product_id", ignoreDuplicates: true },
  );
  if (error) throw fromSupabaseError(error);
  return sendSuccess(res, { productId }, "Product added to wishlist.", 201);
}

export async function removeWishlistItem(req: Request, res: Response) {
  const { error } = await supabase.from("wishlist_items").delete()
    .eq("user_id", userId(req)).eq("product_id", req.params.productId);
  if (error) throw fromSupabaseError(error);
  return sendSuccess(res, { productId: req.params.productId }, "Product removed from wishlist.");
}
