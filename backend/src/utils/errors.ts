export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details: unknown[] = [],
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function fromSupabaseError(error: { message: string; code?: string; details?: string }): AppError {
  if (error.code === "23505") return new AppError(409, "A record with those details already exists.");
  if (error.code === "23503") return new AppError(409, "This record is referenced by other store data.");
  if (error.code === "P0001") return new AppError(409, error.message);
  if (error.code === "PGRST116") return new AppError(404, "The requested record was not found.");
  return new AppError(500, "The store database could not complete the request.");
}
