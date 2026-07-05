import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatSupabaseError } from "@/lib/supabase-errors";

const MIGRATION_SQL = `
alter table orders add column if not exists customer_phone text;
create index if not exists orders_customer_phone_idx on orders (customer_phone);
create table if not exists otp_verifications (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int default 0,
  created_at timestamptz default now()
);
create index if not exists otp_verifications_phone_idx on otp_verifications (phone, created_at desc);
`.trim();

export async function POST() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    return NextResponse.json(
      {
        error: "missing_db_url",
        message:
          "Add SUPABASE_DB_URL to .env.local (Supabase → Settings → Database → Connection string → URI), then try again.",
        sql: MIGRATION_SQL,
      },
      { status: 400 }
    );
  }

  try {
    const { default: pg } = await import("pg");
    const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    await client.query(MIGRATION_SQL);
    await client.end();

    return NextResponse.json({ ok: true, message: "Database updated successfully" });
  } catch (err) {
    return NextResponse.json({ error: formatSupabaseError(err), sql: MIGRATION_SQL }, { status: 500 });
  }
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ needsMigration: true, sql: MIGRATION_SQL });
  }

  try {
    const supabase = createServerClient();
    const { error: phoneError } = await supabase.from("orders").select("customer_phone").limit(1);
    const { error: otpError } = await supabase.from("otp_verifications").select("id").limit(1);

    const needsMigration =
      (!!phoneError &&
        (phoneError.message.includes("customer_phone") ||
          phoneError.message.includes("schema cache"))) ||
      (!!otpError &&
        (otpError.message.includes("otp_verifications") ||
          otpError.message.includes("schema cache")));

    return NextResponse.json({ needsMigration, sql: MIGRATION_SQL });
  } catch {
    return NextResponse.json({ needsMigration: true, sql: MIGRATION_SQL });
  }
}
