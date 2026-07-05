import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const env = readFileSync(".env.local", "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("URL:", url);

const sb = createClient(url, key);
const { data, error } = await sb.from("menu_items").select("id").limit(1);

console.log(JSON.stringify({ data, error: error?.message }, null, 2));
