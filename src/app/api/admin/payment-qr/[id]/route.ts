import { NextResponse } from "next/server";
import { isAdminAuthenticated, isPaymentQrUnlocked } from "@/lib/auth";
import { activatePaymentQr } from "@/lib/payment-qr";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";

type Params = { params: { id: string } };

export async function PATCH(request: Request, { params }: Params) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPaymentQrUnlocked()) {
    return NextResponse.json({ error: "Payment QR is locked", locked: true }, { status: 403 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let body: { upiId?: string; payeeName?: string } | null = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  try {
    const supabase = createServerClient();
    const { data: existing } = await supabase
      .from("payment_qr_codes")
      .select("id")
      .eq("id", params.id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "QR code not found" }, { status: 404 });
    }

    // If UPI details are provided, update them. Otherwise, activate this QR.
    if (body && (body.upiId !== undefined || body.payeeName !== undefined)) {
      const { error: updateError } = await supabase
        .from("payment_qr_codes")
        .update({
          upi_id: body.upiId?.trim() || null,
          payee_name: body.payeeName?.trim() || null,
        })
        .eq("id", params.id);

      if (updateError) {
        return NextResponse.json({ error: formatSupabaseError(updateError) }, { status: 500 });
      }
    } else {
      const result = await activatePaymentQr(supabase, params.id);
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
    }

    const { data, error } = await supabase
      .from("payment_qr_codes")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) {
      return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
    }

    return NextResponse.json({ code: data });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPaymentQrUnlocked()) {
    return NextResponse.json({ error: "Payment QR is locked", locked: true }, { status: 403 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const supabase = createServerClient();
    const { data: row, error: fetchError } = await supabase
      .from("payment_qr_codes")
      .select("id, is_active")
      .eq("id", params.id)
      .maybeSingle();

    if (fetchError || !row) {
      return NextResponse.json({ error: "QR code not found" }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from("payment_qr_codes")
      .delete()
      .eq("id", params.id);

    if (deleteError) {
      return NextResponse.json({ error: formatSupabaseError(deleteError) }, { status: 500 });
    }

    if (row.is_active) {
      const { data: next } = await supabase
        .from("payment_qr_codes")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (next) {
        await activatePaymentQr(supabase, next.id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err) }, { status: 500 });
  }
}
