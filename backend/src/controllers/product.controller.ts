import type { Request, Response } from "express";
import { supabase } from "../config/supabase.js";
import { fromSupabaseError, AppError } from "../utils/errors.js";
import { isUuid, sendSuccess } from "../utils/http.js";
import { toProductWrite, toPublicProduct, type DbProduct } from "../utils/product.js";
import { removeUnusedPublicImages } from "../services/storage.service.js";

const productFields = "*, categories!inner(name, visible)";
const adminProductFields = "*, categories(name)";

function queryError(error: { message: string; code?: string; details?: string }) {
  throw fromSupabaseError(error);
}

export async function listProducts(_req: Request, res: Response) {
  const query = res.locals.validatedQuery as {
    search?: string; category?: string; minPrice?: number; maxPrice?: number;
    size?: string; color?: string; sort: string; page: number; limit: number;
  };
  let categoryId: string | undefined;
  if (query.category) {
    let result = isUuid(query.category)
      ? await supabase.from("categories").select("id").eq("id", query.category).maybeSingle()
      : await supabase.from("categories").select("id").eq("slug", query.category.toLowerCase()).maybeSingle();
    if (result.error) queryError(result.error);
    if (!result.data && !isUuid(query.category)) {
      result = await supabase.from("categories").select("id").eq("name", query.category).maybeSingle();
      if (result.error) queryError(result.error);
    }
    if (!result.data) return sendSuccess(res, { items: [], page: query.page, limit: query.limit, total: 0, pages: 0 }, "Products fetched successfully.");
    categoryId = result.data.id;
  }

  let request = supabase.from("products").select(productFields, { count: "exact" }).eq("active", true);
  request = request.eq("categories.visible", true);
  if (query.search) {
    const term = query.search.replace(/[%_(),]/g, "");
    request = request.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
  }
  if (categoryId) request = request.eq("category_id", categoryId);
  if (query.size) request = request.contains("sizes", [query.size]);
  if (query.color) request = request.contains("colors", [query.color]);
  if (query.minPrice !== undefined) request = request.gte("effective_price", query.minPrice);
  if (query.maxPrice !== undefined) request = request.lte("effective_price", query.maxPrice);
  if (query.sort === "price_asc") request = request.order("effective_price", { ascending: true });
  else if (query.sort === "price_desc") request = request.order("effective_price", { ascending: false });
  else if (query.sort === "newest") request = request.order("created_at", { ascending: false });
  else if (query.sort === "popularity") request = request.order("popularity", { ascending: false }).order("created_at", { ascending: false });
  else request = request.order("featured", { ascending: false }).order("created_at", { ascending: false });
  const from = (query.page - 1) * query.limit;
  const { data, error, count } = await request.range(from, from + query.limit - 1);
  if (error) queryError(error);
  const total = count ?? 0;
  return sendSuccess(res, {
    items: ((data ?? []) as DbProduct[]).map(toPublicProduct),
    page: query.page,
    limit: query.limit,
    total,
    pages: Math.ceil(total / query.limit),
  }, "Products fetched successfully.");
}

export async function getProduct(req: Request, res: Response) {
  const { data, error } = await supabase.from("products").select(productFields).eq("id", req.params.id).eq("active", true).eq("categories.visible", true).maybeSingle();
  if (error) queryError(error);
  if (!data) throw new AppError(404, "Product not found.");
  return sendSuccess(res, toPublicProduct(data as DbProduct), "Product fetched successfully.");
}

export async function listAdminProducts(_req: Request, res: Response) {
  const { data, error } = await supabase.from("products").select(adminProductFields).order("created_at", { ascending: false });
  if (error) queryError(error);
  return sendSuccess(res, ((data ?? []) as DbProduct[]).map(toPublicProduct), "Products fetched successfully.");
}

export async function createProduct(req: Request, res: Response) {
  const value = req.body as Record<string, unknown>;
  const { data, error } = await supabase.from("products").insert(toProductWrite(value)).select(productFields).single();
  if (error) queryError(error);
  return sendSuccess(res, toPublicProduct(data as DbProduct), "Product created successfully.", 201);
}

export async function updateProduct(req: Request, res: Response) {
  const { data: current, error: currentError } = await supabase.from("products").select("images, price, discount_price").eq("id", req.params.id).maybeSingle();
  if (currentError) queryError(currentError);
  if (!current) throw new AppError(404, "Product not found.");
  const patch = req.body as Record<string, unknown>;
  const nextPrice = patch.price === undefined ? Number(current.price) : Number(patch.price);
  const nextDiscount = patch.discountPrice === undefined
    ? current.discount_price === null ? null : Number(current.discount_price)
    : patch.discountPrice === null ? null : Number(patch.discountPrice);
  if (nextDiscount !== null && nextDiscount >= nextPrice) {
    throw new AppError(400, "Discount price must be lower than the regular price.");
  }
  const { data, error } = await supabase.from("products").update(toProductWrite(patch))
    .eq("id", req.params.id).select(productFields).maybeSingle();
  if (error) queryError(error);
  if (!data) throw new AppError(404, "Product not found.");
  const updatedImages = data.images as string[];
  await removeUnusedPublicImages((current.images as string[]).filter((image) => !updatedImages.includes(image)));
  return sendSuccess(res, toPublicProduct(data as DbProduct), "Product updated successfully.");
}

export async function updateProductStatus(req: Request, res: Response) {
  const { active } = req.body as { active: boolean };
  const { data, error } = await supabase.from("products").update({ active }).eq("id", req.params.id).select(productFields).maybeSingle();
  if (error) queryError(error);
  if (!data) throw new AppError(404, "Product not found.");
  return sendSuccess(res, toPublicProduct(data as DbProduct), "Product visibility updated successfully.");
}

export async function deleteProduct(req: Request, res: Response) {
  const { data, error } = await supabase.from("products").update({ active: false }).eq("id", req.params.id).select("id").maybeSingle();
  if (error) queryError(error);
  if (!data) throw new AppError(404, "Product not found.");
  return sendSuccess(res, { id: data.id, active: false }, "Product archived successfully.");
}
