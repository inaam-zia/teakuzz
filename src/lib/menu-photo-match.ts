/** Normalize menu item names / filenames for matching photos. */
export function normalizeMenuKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\.[a-z0-9]+$/i, "") // drop extension
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function slugifyMenuKey(value: string): string {
  return normalizeMenuKey(value).replace(/\s+/g, "-");
}

export type MenuMatchTarget = {
  id: string;
  name: string;
};

/**
 * Match an image filename to a menu item.
 * Accepts exact name, slug (`cold-coffee`), or underscores (`Cold_Coffee.jpg`).
 */
export function matchMenuItemByFilename(
  filename: string,
  items: MenuMatchTarget[]
): MenuMatchTarget | null {
  const key = normalizeMenuKey(filename);
  const slug = slugifyMenuKey(filename);
  if (!key) return null;

  const byKey = new Map<string, MenuMatchTarget>();
  for (const item of items) {
    byKey.set(normalizeMenuKey(item.name), item);
    byKey.set(slugifyMenuKey(item.name), item);
    byKey.set(item.id.toLowerCase(), item);
  }

  return byKey.get(key) || byKey.get(slug) || null;
}
