import type { Request, Response } from "express";
import { supabase } from "../config/supabase.js";
import { fromSupabaseError, AppError } from "../utils/errors.js";
import { sendSuccess } from "../utils/http.js";
import { toProductWrite } from "../utils/product.js";
import { removeUnusedPublicImages } from "../services/storage.service.js";

export async function listCategories(_req: Request, res: Response) {
  const { data, error } = await supabase.from("categories").select("*").eq("visible", true).order("sort_order").order("name");
  if (error) throw fromSupabaseError(error);
  return sendSuccess(res, data ?? [], "Categories fetched successfully.");
}

export async function listAdminCategories(_req: Request, res: Response) {
  const { data, error } = await supabase.from("categories").select("*").order("sort_order").order("name");
  if (error) throw fromSupabaseError(error);
  return sendSuccess(res, data ?? [], "Categories fetched successfully.");
}

export async function getCategory(req: Request, res: Response) {
  const { data, error } = await supabase.from("categories").select("*").eq("id", req.params.id).maybeSingle();
  if (error) throw fromSupabaseError(error);
  if (!data) throw new AppError(404, "Category not found.");
  return sendSuccess(res, data, "Category fetched successfully.");
}

export async function createCategory(req: Request, res: Response) {
  const { data, error } = await supabase.from("categories").insert(toProductWrite(req.body)).select("*").single();
  if (error) throw fromSupabaseError(error);
  return sendSuccess(res, data, "Category created successfully.", 201);
}

export async function updateCategory(req: Request, res: Response) {
  const { data: current, error: currentError } = await supabase.from("categories").select("image").eq("id", req.params.id).maybeSingle();
  if (currentError) throw fromSupabaseError(currentError);
  if (!current) throw new AppError(404, "Category not found.");
  const { data, error } = await supabase.from("categories").update(toProductWrite(req.body)).eq("id", req.params.id).select("*").maybeSingle();
  if (error) throw fromSupabaseError(error);
  if (!data) throw new AppError(404, "Category not found.");
  if (current.image && current.image !== data.image) await removeUnusedPublicImages([current.image]);
  return sendSuccess(res, data, "Category updated successfully.");
}

export async function deleteCategory(req: Request, res: Response) {
  const { count, error: countError } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("category_id", req.params.id);
  if (countError) throw fromSupabaseError(countError);
  if ((count ?? 0) > 0) throw new AppError(409, "Reassign or archive this category's products before deleting it.");
  const { data, error } = await supabase.from("categories").delete().eq("id", req.params.id).select("id").maybeSingle();
  if (error) throw fromSupabaseError(error);
  if (!data) throw new AppError(404, "Category not found.");
  return sendSuccess(res, { id: data.id }, "Category deleted successfully.");
}
