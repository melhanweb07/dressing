import { env } from "../config/env.js";
import { supabase } from "../config/supabase.js";
import { AppError, fromSupabaseError } from "../utils/errors.js";

function getManagedPath(publicUrl: string): string | null {
  try {
    const url = new URL(publicUrl);
    const projectUrl = new URL(env.SUPABASE_URL);
    const prefix = `/storage/v1/object/public/${env.SUPABASE_STORAGE_BUCKET}/`;
    if (url.origin !== projectUrl.origin || !url.pathname.startsWith(prefix)) return null;
    return decodeURIComponent(url.pathname.slice(prefix.length));
  } catch {
    return null;
  }
}

export async function removeUnusedPublicImages(publicUrls: string[], failIfReferenced = false) {
  for (const publicUrl of new Set(publicUrls)) {
    const path = getManagedPath(publicUrl);
    if (!path) continue;

    const [products, categories, settings, orderItems] = await Promise.all([
      supabase.from("products").select("id", { count: "exact", head: true }).contains("images", [publicUrl]),
      supabase.from("categories").select("id", { count: "exact", head: true }).eq("image", publicUrl),
      supabase.from("store_settings").select("id", { count: "exact", head: true }).eq("logo_url", publicUrl),
      supabase.from("order_items").select("id", { count: "exact", head: true }).eq("image_url", publicUrl),
    ]);
    const queryError = products.error ?? categories.error ?? settings.error ?? orderItems.error;
    if (queryError) throw fromSupabaseError(queryError);
    const isReferenced = [products.count, categories.count, settings.count, orderItems.count].some((count) => (count ?? 0) > 0);
    if (isReferenced) {
      if (failIfReferenced) throw new AppError(409, "This image is still referenced by store or order data.");
      continue;
    }

    const { error } = await supabase.storage.from(env.SUPABASE_STORAGE_BUCKET).remove([path]);
    if (error) throw new AppError(502, "The unused image could not be removed from storage.");
  }
}
