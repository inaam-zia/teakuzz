# Cafe QR Ordering

A simple web app for small cafes. Customers scan a QR code at their table and order from their phone. The cafe owner manages everything from a browser — **nothing to install on the cafe computer**.

## How it works

| Who | What they do |
|-----|-------------|
| **Customer** | Scans QR → opens `/order/3` (table 3) → picks items → places order |
| **Admin** | Opens `/admin/login` → manages menu, sees live orders, searches history |

## One-time setup (you do this once, not the cafe)

Everything runs in the cloud. The cafe only needs a browser bookmark.

### 1. Create a free Supabase database

1. Go to [supabase.com](https://supabase.com) and create a free project
2. Open **SQL Editor** → paste and run `supabase/schema.sql`
3. Go to **Settings → API** and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Deploy to Vercel (free)

1. Push this folder to GitHub
2. Go to [vercel.com](https://vercel.com) → Import project
3. Add environment variables from `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_PASSWORD` (pick a strong password for your friend)
   - `NEXT_PUBLIC_CAFE_NAME` (e.g. "Sunrise Cafe")
4. Deploy — you get a URL like `https://your-cafe.vercel.app`

### 3. Print QR codes

For each table, create a QR code pointing to:

```
https://your-cafe.vercel.app/order/1
https://your-cafe.vercel.app/order/2
...etc
```

Use any free QR generator and print them for each table.

### 4. Give your friend two links

- **Admin panel:** `https://your-cafe.vercel.app/admin/login`
- **Password:** the `ADMIN_PASSWORD` you set

That's it. No software on their computer.

## Local development (optional)

Only if you want to test before deploying:

```bash
cp .env.example .env.local
# fill in your Supabase keys and password
npm install
npm run dev
```

Open http://localhost:3000

## Features

- QR ordering per table (each scan = new order)
- Mobile-friendly customer menu
- Admin: add/edit/hide menu items
- Live orders with auto-refresh
- Order history with date and table filters
- Optional customer name on orders

## Tech

- Next.js (hosted on Vercel)
- Supabase (hosted database)
- No local server needed at the cafe
