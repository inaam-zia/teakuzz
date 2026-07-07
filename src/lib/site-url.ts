export function getSiteUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000";

  return url.replace(/\/$/, "");
}

export function getOrderUrl(tableNumber: number): string {
  return `${getSiteUrl()}/order/${tableNumber}`;
}

/** QR codes should point here — sets a scan cookie then redirects to order page. */
export function getScanUrl(tableNumber: number): string {
  return `${getSiteUrl()}/scan/${tableNumber}`;
}
