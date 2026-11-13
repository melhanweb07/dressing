import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.response.use((response) => {
  const body: unknown = response.data;
  if (body && typeof body === "object" && "success" in body && body.success === true && "data" in body) {
    response.data = body.data;
  }
  return response;
});

export function getApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || error.message || "Unable to connect to the store.";
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}
