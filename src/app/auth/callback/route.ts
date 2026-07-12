import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_CATEGORIES = [
  { name: "Eating Out", icon: "🍽️", sort_order: 1 },
  { name: "Groceries", icon: "🛒", sort_order: 2 },
  { name: "Petrol", icon: "⛽", sort_order: 3 },
  { name: "Shopping", icon: "🛍️", sort_order: 4 },
  { name: "Utilities", icon: "💡", sort_order: 5 },
  { name: "Transport", icon: "🚗", sort_order: 6 },
  { name: "Entertainment", icon: "🎬", sort_order: 7 },
  { name: "Health", icon: "🏥", sort_order: 8 },
  { name: "Education", icon: "📚", sort_order: 9 },
  { name: "Household", icon: "🏠", sort_order: 10 },
  { name: "Clothing", icon: "👕", sort_order: 11 },
  { name: "Personal Care", icon: "💆", sort_order: 12 },
  { name: "Bank Fees", icon: "🏦", sort_order: 13 },
  { name: "Transfer", icon: "🔄", sort_order: 14 },
  { name: "Gift", icon: "🎁", sort_order: 15 },
];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      const user = data.session.user;

      // Check whitelist
      const whitelistedEmails = (process.env.WHITELISTED_EMAILS || "")
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);

      if (!whitelistedEmails.includes(user.email || "")) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/unauthorized`);
      }

      // Check if user has a space, if not create one
      const { data: memberData } = await supabase
        .from("space_members")
        .select("space_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!memberData) {
        const { data: spaceData } = await supabase
          .from("spaces")
          .insert({ name: "My Space" })
          .select("id")
          .single();

        if (spaceData) {
          await supabase.from("space_members").insert({
            space_id: spaceData.id,
            user_id: user.id,
            role: "owner",
          });

          const categoryInserts = DEFAULT_CATEGORIES.map((cat) => ({
            space_id: spaceData.id,
            ...cat,
            is_default: true,
          }));
          await supabase.from("categories").insert(categoryInserts);
        }
      }

      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/unauthorized`);
}
