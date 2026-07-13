"use client";

import { useState, useEffect } from "react";
import { ViewTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";
import type { Database } from "@/lib/supabase/types";

type Category = Database["public"]["Tables"]["categories"]["Row"];

export default function CategoriesSettingsPage() {
  const supabase = createClient();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: memberRows } = await supabase
        .from("space_members")
        .select("space_id")
        .eq("user_id", user.id)
        .limit(1);
      const memberData = memberRows && memberRows.length > 0 ? memberRows[0] : null;
      if (!memberData) return;
      const { data: cats } = await supabase
        .from("categories")
        .select("*")
        .eq("space_id", memberData.space_id)
        .order("sort_order");
      if (cats) setCategories(cats);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
    <main className="mx-auto w-full max-w-lg px-4 py-4 pb-4">
      <Link href="/settings/categories/add" transitionTypes={["nav-forward"]}>
        <Card className="mb-3 transition-colors hover:bg-muted/50">
          <CardContent className="flex items-center justify-between py-3 px-4">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Plus className="h-4 w-4" />
              Add Category
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>

      <div className="flex flex-col gap-2">
        {categories.map((cat) => (
          <Link key={cat.id} href={`/settings/categories/${cat.id}`} transitionTypes={["nav-forward"]}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardContent className="flex items-center justify-between py-3 px-4">
                <span className="flex items-center gap-2 text-sm">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: cat.color || "#6b7280" }}
                  />
                  {cat.icon} {cat.name}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
    </ViewTransition>
  );
}
