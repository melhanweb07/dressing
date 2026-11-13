import { Router } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { env } from "../config/env.js";
import { supabase } from "../config/supabase.js";
import * as auth from "../controllers/auth.controller.js";
import * as categories from "../controllers/category.controller.js";
import * as orders from "../controllers/order.controller.js";
import * as products from "../controllers/product.controller.js";
import * as settings from "../controllers/settings.controller.js";
import * as uploads from "../controllers/upload.controller.js";
import * as wishlist from "../controllers/wishlist.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireCustomer } from "../middleware/customer.middleware.js";
import { validateBody, validateQuery } from "../middleware/validate.middleware.js";
import { validateUuidParam } from "../middleware/params.middleware.js";
import {
  categoryInputSchema, categoryPatchSchema, listOrdersSchema, listProductsSchema, loginSchema,
  orderAdminPatchSchema, orderInputSchema, orderNotesSchema, orderStatusSchema, paymentStatusSchema,
  productInputSchema, productPatchSchema, productStatusSchema, settingsInputSchema, trackOrderSchema,
  refreshSchema, uploadTypeSchema, wishlistInputSchema,
} from "../validators/schemas.js";
import { sendSuccess } from "../utils/http.js";
import { AppError } from "../utils/errors.js";

export const apiRouter = Router();

const authRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
const orderRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.ORDER_RATE_LIMIT_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 6, fields: 4, parts: 10 },
  fileFilter: (_req, file, callback) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      callback(new AppError(415, "Only JPEG, PNG, and WebP image files are accepted."));
      return;
    }
    callback(null, true);
  },
});

apiRouter.get("/health", (_req, res) => sendSuccess(res, { status: "ok" }, "API is healthy."));

apiRouter.post("/auth/admin/login", authRateLimit, validateBody(loginSchema), auth.login);
apiRouter.post("/auth/login", authRateLimit, validateBody(loginSchema), auth.login);
apiRouter.post("/auth/refresh", authRateLimit, validateBody(refreshSchema), auth.refresh);
apiRouter.get("/auth/session", authenticate, auth.session);
apiRouter.post("/auth/logout", authenticate, auth.logout);

apiRouter.get("/products", validateQuery(listProductsSchema), products.listProducts);
apiRouter.get("/products/:id", validateUuidParam(), products.getProduct);
apiRouter.post("/products", authenticate, requireAdmin, validateBody(productInputSchema), products.createProduct);
apiRouter.put("/products/:id", authenticate, requireAdmin, validateUuidParam(), validateBody(productInputSchema), products.updateProduct);
apiRouter.patch("/products/:id", authenticate, requireAdmin, validateUuidParam(), validateBody(productPatchSchema), products.updateProduct);
apiRouter.patch("/products/:id/status", authenticate, requireAdmin, validateUuidParam(), validateBody(productStatusSchema), products.updateProductStatus);
apiRouter.delete("/products/:id", authenticate, requireAdmin, validateUuidParam(), products.deleteProduct);

apiRouter.get("/admin/products", authenticate, requireAdmin, products.listAdminProducts);
apiRouter.post("/admin/products", authenticate, requireAdmin, validateBody(productInputSchema), products.createProduct);
apiRouter.put("/admin/products/:id", authenticate, requireAdmin, validateUuidParam(), validateBody(productInputSchema), products.updateProduct);
apiRouter.patch("/admin/products/:id", authenticate, requireAdmin, validateUuidParam(), validateBody(productPatchSchema), products.updateProduct);
apiRouter.patch("/admin/products/:id/status", authenticate, requireAdmin, validateUuidParam(), validateBody(productStatusSchema), products.updateProductStatus);
apiRouter.delete("/admin/products/:id", authenticate, requireAdmin, validateUuidParam(), products.deleteProduct);

apiRouter.get("/categories", categories.listCategories);
apiRouter.get("/categories/:id", validateUuidParam(), categories.getCategory);
apiRouter.post("/categories", authenticate, requireAdmin, validateBody(categoryInputSchema), categories.createCategory);
apiRouter.put("/categories/:id", authenticate, requireAdmin, validateUuidParam(), validateBody(categoryInputSchema), categories.updateCategory);
apiRouter.patch("/categories/:id", authenticate, requireAdmin, validateUuidParam(), validateBody(categoryPatchSchema), categories.updateCategory);
apiRouter.delete("/categories/:id", authenticate, requireAdmin, validateUuidParam(), categories.deleteCategory);
apiRouter.get("/admin/categories", authenticate, requireAdmin, categories.listAdminCategories);
apiRouter.post("/admin/categories", authenticate, requireAdmin, validateBody(categoryInputSchema), categories.createCategory);
apiRouter.put("/admin/categories/:id", authenticate, requireAdmin, validateUuidParam(), validateBody(categoryInputSchema), categories.updateCategory);
apiRouter.patch("/admin/categories/:id", authenticate, requireAdmin, validateUuidParam(), validateBody(categoryPatchSchema), categories.updateCategory);
apiRouter.delete("/admin/categories/:id", authenticate, requireAdmin, validateUuidParam(), categories.deleteCategory);

apiRouter.post("/orders", orderRateLimit, validateBody(orderInputSchema), orders.createOrder);
apiRouter.get("/orders/track", validateQuery(trackOrderSchema), orders.trackOrder);
apiRouter.get("/orders/track/:orderId", (req, res, next) => {
  const parsed = trackOrderSchema.safeParse({ orderId: req.params.orderId, phone: req.query.phone });
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Query validation failed.",
      errors: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
    return;
  }
  res.locals.validatedQuery = parsed.data;
  orders.trackOrder(req, res).catch(next);
});
apiRouter.get("/orders/:id", validateQuery(trackOrderSchema.omit({ orderId: true })), (req, res, next) => {
  res.locals.validatedQuery = { ...(res.locals.validatedQuery as object), orderId: req.params.id };
  return orders.trackOrder(req, res).catch(next);
});
apiRouter.get("/admin/orders", authenticate, requireAdmin, validateQuery(listOrdersSchema), orders.listAdminOrders);
apiRouter.get("/admin/orders/:id", authenticate, requireAdmin, orders.getAdminOrder);
apiRouter.get("/admin/orders/:id/history", authenticate, requireAdmin, orders.getOrderHistory);
apiRouter.patch("/admin/orders/:id/status", authenticate, requireAdmin, validateBody(orderStatusSchema), orders.updateOrderStatus);
apiRouter.patch("/admin/orders/:id/payment", authenticate, requireAdmin, validateBody(paymentStatusSchema), orders.updatePaymentStatus);
apiRouter.patch("/admin/orders/:id/notes", authenticate, requireAdmin, validateBody(orderNotesSchema), orders.updateOrderNotes);
apiRouter.patch("/admin/orders/:id", authenticate, requireAdmin, validateBody(orderAdminPatchSchema), orders.patchAdminOrder);

apiRouter.get("/wishlist", authenticate, requireCustomer, wishlist.getWishlist);
apiRouter.post("/wishlist", authenticate, requireCustomer, validateBody(wishlistInputSchema), wishlist.addWishlistItem);
apiRouter.delete("/wishlist/:productId", authenticate, requireCustomer, validateUuidParam("productId"), wishlist.removeWishlistItem);

apiRouter.get("/settings", settings.getSettings);
apiRouter.get("/store/settings", settings.getSettings);
apiRouter.put("/admin/settings", authenticate, requireAdmin, validateBody(settingsInputSchema), settings.updateSettings);
apiRouter.patch("/admin/settings", authenticate, requireAdmin, validateBody(settingsInputSchema), settings.updateSettings);
apiRouter.put("/admin/store/settings", authenticate, requireAdmin, validateBody(settingsInputSchema), settings.updateSettings);
apiRouter.patch("/admin/store/settings", authenticate, requireAdmin, validateBody(settingsInputSchema), settings.updateSettings);

apiRouter.post("/admin/uploads", authenticate, requireAdmin, upload.array("files", 6), (req, _res, next) => {
  const parsed = uploadTypeSchema.safeParse(req.body.type);
  if (!parsed.success) {
    next(new AppError(400, "Upload type must be products, categories, or store."));
    return;
  }
  next();
}, uploads.uploadImages);
apiRouter.delete("/admin/uploads", authenticate, requireAdmin, (req, _res, next) => {
  if (typeof req.body?.path !== "string") {
    next(new AppError(400, "Image path is required."));
    return;
  }
  next();
}, uploads.deleteUploadedImage);

apiRouter.get("/admin/overview", authenticate, requireAdmin, async (_req, res) => {
  const { data, error } = await supabase.rpc("admin_store_overview");
  if (error) throw error;
  return sendSuccess(res, data, "Store overview fetched successfully.");
});
