/** Menu cards display ~80px; thumbs are 240px for retina + fast load. */
export function menuThumbUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("/menu/items/") && !imageUrl.includes("/thumbs/")) {
    return imageUrl.replace("/menu/items/", "/menu/items/thumbs/");
  }
  return imageUrl;
}
