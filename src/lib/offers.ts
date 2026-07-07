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
  if (!isSupabaseConfigured()) return [];

  const supabase = createServerClient();
  let query = supabase.from("offers").select(OFFER_SELECT).order("sort_order");

  if (activeOnly) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as OfferRow[])
    .map(normalizeOffer)
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
