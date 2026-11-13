import type { Request, Response } from "express";
import { supabase } from "../config/supabase.js";
import { AppError, fromSupabaseError } from "../utils/errors.js";
import { sendSuccess } from "../utils/http.js";
import { removeUnusedPublicImages } from "../services/storage.service.js";

function publicSettings(row: Record<string, unknown>) {
  return {
    shopName: row.shop_name,
    logoUrl: row.logo_url,
    contactNumber: row.contact_number,
    whatsappNumber: row.whatsapp_number,
    gpayNumber: row.gpay_number,
    address: row.address,
    deliveryCharge: Number(row.delivery_charge),
    freeDeliveryThreshold: Number(row.free_delivery_threshold),
    instagramUrl: row.instagram_url,
    facebookUrl: row.facebook_url,
    shippingInfo: row.shipping_info,
    returnPolicy: row.return_policy,
    codEnabled: row.cod_enabled,
  };
}

export async function getSettings(_req: Request, res: Response) {
  const { data, error } = await supabase.from("store_settings").select("*").eq("id", "main").maybeSingle();
  if (error) throw fromSupabaseError(error);
  if (!data) throw new AppError(503, "Store settings have not been configured.");
  return sendSuccess(res, publicSettings(data), "Store settings fetched successfully.");
}

export async function updateSettings(req: Request, res: Response) {
  const value = req.body as Record<string, unknown>;
  const { data: current, error: currentError } = await supabase.from("store_settings").select("logo_url").eq("id", "main").maybeSingle();
  if (currentError) throw fromSupabaseError(currentError);
  if (!current) throw new AppError(503, "Store settings have not been initialized.");
  const fields: Record<string, string> = {
    shopName: "shop_name",
    logoUrl: "logo_url",
    contactNumber: "contact_number",
    whatsappNumber: "whatsapp_number",
    gpayNumber: "gpay_number",
    address: "address",
    deliveryCharge: "delivery_charge",
    freeDeliveryThreshold: "free_delivery_threshold",
    instagramUrl: "instagram_url",
    facebookUrl: "facebook_url",
    shippingInfo: "shipping_info",
    returnPolicy: "return_policy",
    codEnabled: "cod_enabled",
  };
  const update = Object.fromEntries(Object.entries(value).map(([key, item]) => [fields[key] ?? key, item]));
  const { data, error } = await supabase.from("store_settings").update(update).eq("id", "main").select("*").maybeSingle();
  if (error) throw fromSupabaseError(error);
  if (!data) throw new AppError(503, "Store settings have not been initialized.");
  if (current.logo_url && current.logo_url !== data.logo_url) await removeUnusedPublicImages([current.logo_url]);
  return sendSuccess(res, publicSettings(data), "Store settings updated successfully.");
}
