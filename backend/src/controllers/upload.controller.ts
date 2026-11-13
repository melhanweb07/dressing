import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { env } from "../config/env.js";
import { supabase } from "../config/supabase.js";
import { AppError } from "../utils/errors.js";
import { sendSuccess } from "../utils/http.js";
import { removeUnusedPublicImages } from "../services/storage.service.js";

type UploadedFile = Express.Multer.File;

function extensionFromMagic(buffer: Buffer): { mime: string; extension: string } | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { mime: "image/png", extension: "png" };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", extension: "jpg" };
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return { mime: "image/webp", extension: "webp" };
  }
  return null;
}

export async function uploadImages(req: Request, res: Response) {
  const files = req.files as UploadedFile[] | undefined;
  if (!files?.length) throw new AppError(400, "Choose at least one image to upload.");
  const type = req.body.type as "products" | "categories" | "store";
  const uploaded: Array<{ path: string; publicUrl: string }> = [];
  for (const file of files) {
    const actualType = extensionFromMagic(file.buffer);
    if (!actualType || actualType.mime !== file.mimetype) {
      if (uploaded.length) await supabase.storage.from(env.SUPABASE_STORAGE_BUCKET).remove(uploaded.map((item) => item.path));
      throw new AppError(415, "Only valid JPEG, PNG, and WebP image files are accepted.");
    }
    const path = `${type}/${randomUUID()}.${actualType.extension}`;
    const { error } = await supabase.storage.from(env.SUPABASE_STORAGE_BUCKET).upload(path, file.buffer, {
      contentType: actualType.mime,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) {
      if (uploaded.length) await supabase.storage.from(env.SUPABASE_STORAGE_BUCKET).remove(uploaded.map((item) => item.path));
      throw new AppError(502, "Image storage could not complete the upload.");
    }
    const { data } = supabase.storage.from(env.SUPABASE_STORAGE_BUCKET).getPublicUrl(path);
    uploaded.push({ path, publicUrl: data.publicUrl });
  }
  return sendSuccess(res, uploaded.map((item) => item.publicUrl), "Images uploaded successfully.", 201);
}

export async function deleteUploadedImage(req: Request, res: Response) {
  const path = req.body.path as string;
  const allowedPrefix = /^(products|categories|store)\/[0-9a-f-]{36}\.(jpg|png|webp)$/i;
  if (!allowedPrefix.test(path)) throw new AppError(400, "Invalid store image path.");
  const { data } = supabase.storage.from(env.SUPABASE_STORAGE_BUCKET).getPublicUrl(path);
  await removeUnusedPublicImages([data.publicUrl], true);
  return sendSuccess(res, { path }, "Image deleted successfully.");
}

export { extensionFromMagic };
