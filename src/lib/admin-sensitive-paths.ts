/** Admin paths that stay open without the Payment QR password. */
export const OPEN_ADMIN_PATHS = [
  "/admin/orders",
  "/admin/dashboard",
  "/admin/customers",
  "/admin/menu",
] as const;

export function isSensitiveAdminPath(pathname: string): boolean {
  if (!pathname.startsWith("/admin")) return false;
  if (pathname === "/admin/login") return false;
  if (pathname === "/admin" || pathname === "/admin/") return false;

  return !OPEN_ADMIN_PATHS.some(
    (open) => pathname === open || pathname.startsWith(`${open}/`)
  );
}
