export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthenticated = (message = "Sign in is required.") =>
  new AppError(401, "UNAUTHENTICATED", message);
export const forbidden = (message: string) =>
  new AppError(403, "FORBIDDEN", message);
export const notFound = (resource: string) =>
  new AppError(404, "NOT_FOUND", `${resource} was not found.`);
export const conflict = (code: string, message: string) =>
  new AppError(409, code, message);
export const unavailable = (message: string) =>
  new AppError(503, "IDENTITY_UNAVAILABLE", message);
