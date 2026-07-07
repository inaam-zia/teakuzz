import { unstable_noStore as noStore } from "next/cache";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import type { Offer, OfferItem } from "@/lib/types";

type OfferRow = Offer & {
  offer_items: (OfferItem & {
    menu_item: OfferItem["menu_item"] | OfferItem["menu_item"][];
  })[];
};

function normalizeOffer(row: OfferRow): Offer {
  const offerItems = (row.offer_items ?? []).map((oi) => {
    const menu = Array.isArray(oi.menu_item) ? oi.menu_item[0] : oi.menu_item;
    return {
      id: oi.id,
      offer_id: oi.offer_id,
      menu_item_id: oi.menu_item_id,
      quantity: oi.quantity,
      menu_item: menu ?? undefined,
    };
  });

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    price: Number(row.price),
    image_url: row.image_url,
    active: row.active,
    sort_order: row.sort_order,
    created_at: row.created_at,
    offer_items: offerItems,
  };
}

const OFFER_SELECT = `
  id, name, description, price, image_url, active, sort_order, created_at,
  offer_items (
    id, offer_id, menu_item_id, quantity,
    menu_item:menu_items ( id, name, price, available, image_url )
  )
`;

export function formatOfferIncludes(offer: Offer): string {
  return offer.offer_items
    .map((oi) => {
      const name = oi.menu_item?.name ?? "Item";
      return oi.quantity > 1 ? `${name} ×${oi.quantity}` : name;
    })
    .join(", ");
}

export async function listOffers(activeOnly = false): Promise<Offer[]> {
  noStore();

  if (!isSupabaseConfigured()) return [];

  const supabase = createServerClient();
  let query = supabase.from("offers").select(OFFER_SELECT).order("sort_order");

  if (activeOnly) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[offers] nested query failed:", error.message);
    return listOffersFallback(supabase, activeOnly);
  }

  if (!data) return [];

  return (data as OfferRow[])
    .map(normalizeOffer)
    .filter((o) => !activeOnly || o.offer_items.length > 0);
}

async function listOffersFallback(
  supabase: ReturnType<typeof createServerClient>,
  activeOnly: boolean
): Promise<Offer[]> {
  let offerQuery = supabase
    .from("offers")
    .select("id, name, description, price, image_url, active, sort_order, created_at")
    .order("sort_order");

  if (activeOnly) {
    offerQuery = offerQuery.eq("active", true);
  }

  const { data: offerRows, error: offerError } = await offerQuery;
  if (offerError || !offerRows?.length) {
    if (offerError) console.error("[offers] fallback offers query:", offerError.message);
    return [];
  }

  const offerIds = offerRows.map((o) => o.id);
  const { data: itemRows, error: itemError } = await supabase
    .from("offer_items")
    .select("id, offer_id, menu_item_id, quantity")
    .in("offer_id", offerIds);

  if (itemError) {
    console.error("[offers] fallback items query:", itemError.message);
    return [];
  }

  const menuIds = Array.from(new Set((itemRows ?? []).map((r) => r.menu_item_id)));
  const { data: menuRows } = menuIds.length
    ? await supabase
        .from("menu_items")
        .select("id, name, price, available, image_url")
        .in("id", menuIds)
    : { data: [] };

  const menuMap = new Map((menuRows ?? []).map((m) => [m.id, m]));
  const itemsByOffer = new Map<string, OfferItem[]>();

  for (const row of itemRows ?? []) {
    const list = itemsByOffer.get(row.offer_id) ?? [];
    list.push({
      id: row.id,
      offer_id: row.offer_id,
      menu_item_id: row.menu_item_id,
      quantity: row.quantity,
      menu_item: menuMap.get(row.menu_item_id),
    });
    itemsByOffer.set(row.offer_id, list);
  }

  return offerRows
    .map((row) =>
      normalizeOffer({
        ...row,
        description: row.description ?? "",
        offer_items: (itemsByOffer.get(row.id) ?? []).map((oi) => ({
          ...oi,
          menu_item: oi.menu_item,
        })),
      } as OfferRow)
    )
    .filter((o) => !activeOnly || o.offer_items.length > 0);
}

export async function getOfferById(id: string): Promise<Offer | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("offers")
    .select(OFFER_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return normalizeOffer(data as OfferRow);
}

export function buildComboOrderName(offer: Offer): string {
  const includes = formatOfferIncludes(offer);
  return includes ? `Combo: ${offer.name} (${includes})` : `Combo: ${offer.name}`;
}
