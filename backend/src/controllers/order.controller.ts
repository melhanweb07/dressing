import type { Request, Response } from "express";
import { supabase } from "../config/supabase.js";
import type { AuthenticatedRequest } from "../types/index.js";
import { AppError, fromSupabaseError } from "../utils/errors.js";
import { sendSuccess } from "../utils/http.js";
import { requireRpcId, toOrder, toRpcItems } from "../utils/order.js";

const orderSelect = "*, order_items(id, product_id, product_name, image_url, unit_price, quantity, size, color)";

function throwDatabaseError(error: { message: string; code?: string; details?: string }) {
  throw fromSupabaseError(error);
}

function orderReference(req: Request): string {
  const reference = req.params.id;
  return Array.isArray(reference) ? reference[0] : reference;
}

async function findOrder(reference: string) {
  let request = supabase.from("orders").select(orderSelect);
  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(reference)) request = request.eq("id", reference);
  else request = request.eq("order_number", reference);
  const { data, error } = await request.maybeSingle();
  if (error) throwDatabaseError(error);
  if (!data) throw new AppError(404, "Order not found.");
  return data;
}

export async function createOrder(req: Request, res: Response) {
  const body = req.body as {
    customer: Record<string, unknown>;
    items: Array<{ product: { id: string }; size: string; color: string; quantity: number }>;
    paymentMethod: "gpay" | "cod";
  };
  const { data: orderId, error: rpcError } = await supabase.rpc("create_store_order", {
    p_customer: body.customer,
    p_items: toRpcItems(body.items),
    p_payment_method: body.paymentMethod,
  });
  if (rpcError) throwDatabaseError(rpcError);
  const order = await findOrder(requireRpcId(orderId));
  return sendSuccess(res, toOrder(order), "Order placed successfully. Payment is pending.", 201);
}

export async function trackOrder(req: Request, res: Response) {
  const { orderId, phone } = res.locals.validatedQuery as { orderId: string; phone: string };
  let request = supabase.from("orders").select(orderSelect);
  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(orderId)) request = request.eq("id", orderId);
  else request = request.eq("order_number", orderId);
  const { data, error } = await request.eq("phone", phone).maybeSingle();
  if (error) throwDatabaseError(error);
  if (!data) throw new AppError(404, "We couldn't find an order matching those details.");
  return sendSuccess(res, toOrder(data), "Order fetched successfully.");
}

export async function listAdminOrders(_req: Request, res: Response) {
  const query = res.locals.validatedQuery as { search?: string; status?: string; page: number; limit: number };
  let request = supabase.from("orders").select(orderSelect, { count: "exact" }).order("created_at", { ascending: false });
  if (query.status) request = request.eq("status", query.status);
  if (query.search) {
    const escaped = query.search.replace(/[%_,()]/g, "");
    request = request.or(`order_number.ilike.%${escaped}%,phone.ilike.%${escaped}%,customer_name.ilike.%${escaped}%`);
  }
  const from = (query.page - 1) * query.limit;
  const { data, error, count } = await request.range(from, from + query.limit - 1);
  if (error) throwDatabaseError(error);
  const orders = (data ?? []).map((order) => toOrder(order, true));
  return sendSuccess(res, {
      items: orders,
      page: query.page,
      limit: query.limit,
      total: count ?? 0,
      pages: Math.ceil((count ?? 0) / query.limit),
    }, "Orders fetched successfully.");
}

export async function getAdminOrder(req: Request, res: Response) {
  const order = await findOrder(orderReference(req));
  return sendSuccess(res, toOrder(order, true), "Order fetched successfully.");
}

export async function getOrderHistory(req: Request, res: Response) {
  const order = await findOrder(orderReference(req));
  const { data, error } = await supabase.from("order_history").select("event_type, previous_value, new_value, created_at")
    .eq("order_id", order.id).order("created_at", { ascending: false });
  if (error) throwDatabaseError(error);
  return sendSuccess(res, data ?? [], "Order history fetched successfully.");
}

export async function updateOrderStatus(req: Request, res: Response) {
  const { status } = req.body as { status: string };
  const { data, error } = await supabase.rpc("set_order_status", {
    p_order_ref: orderReference(req),
    p_status: status,
    p_changed_by: (req as AuthenticatedRequest).user?.id ?? null,
  });
  if (error) throwDatabaseError(error);
  const order = await findOrder(requireRpcId(data));
  return sendSuccess(res, toOrder(order, true), "Order status updated successfully.");
}

export async function updatePaymentStatus(req: Request, res: Response) {
  const { paymentStatus } = req.body as { paymentStatus: string };
  const { data: orderId, error } = await supabase.rpc("set_order_payment_status", {
    p_order_ref: orderReference(req),
    p_payment_status: paymentStatus,
    p_verified_by: (req as AuthenticatedRequest).user?.id ?? null,
  });
  if (error) throwDatabaseError(error);
  const order = await findOrder(requireRpcId(orderId));
  return sendSuccess(res, toOrder(order, true), "Payment status updated successfully.");
}

export async function updateOrderNotes(req: Request, res: Response) {
  const { adminNotes } = req.body as { adminNotes: string | null };
  const existing = await findOrder(orderReference(req));
  const { data, error } = await supabase.from("orders").update({ admin_notes: adminNotes })
    .eq("id", existing.id).select(orderSelect).maybeSingle();
  if (error) throwDatabaseError(error);
  if (!data) throw new AppError(404, "Order not found.");
  return sendSuccess(res, toOrder(data, true), "Order notes updated successfully.");
}

export async function patchAdminOrder(req: Request, res: Response) {
  const patch = req.body as { status?: string; paymentStatus?: string; adminNotes?: string | null };
  let order = await findOrder(orderReference(req));
  if (patch.status === "Cancelled" && patch.paymentStatus === "Verified") {
    throw new AppError(409, "A cancelled order cannot be marked as paid.");
  }
  if (patch.status !== undefined && patch.status !== order.status) {
    const { data, error } = await supabase.rpc("set_order_status", {
      p_order_ref: orderReference(req),
      p_status: patch.status,
      p_changed_by: (req as AuthenticatedRequest).user?.id ?? null,
    });
    if (error) throwDatabaseError(error);
    order = await findOrder(requireRpcId(data));
  }
  if (patch.paymentStatus !== undefined) {
    const { data: orderId, error } = await supabase.rpc("set_order_payment_status", {
      p_order_ref: orderReference(req),
      p_payment_status: patch.paymentStatus,
      p_verified_by: (req as AuthenticatedRequest).user?.id ?? null,
    });
    if (error) throwDatabaseError(error);
    order = await findOrder(requireRpcId(orderId));
  }
  if (patch.adminNotes !== undefined) {
    const { data, error } = await supabase.from("orders").update({ admin_notes: patch.adminNotes })
      .eq("id", order.id).select(orderSelect).single();
    if (error) throwDatabaseError(error);
    order = data;
  }
  return sendSuccess(res, toOrder(order, true), "Order updated successfully.");
}

export async function getCustomerOrder(req: Request, res: Response) {
  const user = (req as AuthenticatedRequest).user;
  if (!user) throw new AppError(401, "Authentication is required.");
  const { data, error } = await supabase.from("orders").select(orderSelect).eq("id", req.params.id).eq("customer_user_id", user.id).maybeSingle();
  if (error) throwDatabaseError(error);
  if (!data) throw new AppError(404, "Order not found.");
  return sendSuccess(res, toOrder(data), "Order fetched successfully.");
}
