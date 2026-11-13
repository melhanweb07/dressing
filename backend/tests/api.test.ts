import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

describe("API", () => {
  it("returns a standard health response", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "API is healthy.",
      data: { status: "ok" },
    });
  });

  it("validates product list pagination", async () => {
    const response = await request(app).get("/api/products?page=0");
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "page" }),
    ]));
  });

  it("rejects admin product reads without an authenticated admin", async () => {
    const response = await request(app).get("/api/admin/products");
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false, message: "Authentication is required." });
  });

  it("rejects admin payment updates without an authenticated admin", async () => {
    const response = await request(app)
      .patch("/api/admin/orders/c2cb585e-8335-4fde-922a-43396dc4ae31/payment")
      .send({ paymentStatus: "Verified" });
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("rejects malformed product identifiers", async () => {
    const response = await request(app).get("/api/products/not-a-uuid");
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ success: false, message: "Invalid resource identifier." });
  });

  it("rejects invalid order quantity before accessing the database", async () => {
    const response = await request(app).post("/api/orders").send({
      customer: {
        name: "Test Customer",
        phone: "9876543210",
        email: "",
        address: "12 Example Road",
        city: "Jaipur",
        state: "Rajasthan",
        pincode: "302001",
      },
      items: [{
        product: { id: "c2cb585e-8335-4fde-922a-43396dc4ae31" },
        size: "M",
        color: "Rose",
        quantity: 0,
      }],
      subtotal: 1,
      total: 1,
      delivery: 0,
    });
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("returns a consistent not-found response", async () => {
    const response = await request(app).get("/api/not-a-route");
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      message: "The requested endpoint was not found.",
      errors: [],
    });
  });
});
