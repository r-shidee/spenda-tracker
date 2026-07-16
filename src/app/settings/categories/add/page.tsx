"use client";

import { useState, useEffect } from "react";
import { ViewTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import type { Database } from "@/lib/supabase/types";

const COLORS = ["#ef4444","#f59e0b","#22c55e","#3b82f6","#8b5cf6","#ec4899","#14b8a6","#6b7280"];

export default function AddCategoryPage() {
  const router = useRouter();
  const supabase = createClient();
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [categories, setCategories] = useState<{ id: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState("#6b7280");

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
      setSpaceId(memberData.space_id);
      const { data: cats } = await supabase
        .from("categories")
        .select("id")
        .eq("space_id", memberData.space_id);
      if (cats) setCategories(cats);
    }
    load();
  }, []);

  async function save() {
    if (!spaceId || !name.trim()) return;
    setSaving(true);
    await supabase.from("categories").insert({
      space_id: spaceId,
      name: name.trim(),
      icon: icon || null,
      color,
      sort_order: categories.length + 1,
    });
    setSaving(false);
    router.back();
  }

  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 py-4 pb-24">

      <div className="mb-4 text-center">
        <span className="text-5xl">{icon || "💰"}</span>
      </div>

      <Card className="mb-3">
        <CardContent className="space-y-3 p-4">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Name</p>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Category name"
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Icon (emoji)</p>
            <Input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="e.g. 🍽️"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-3">
        <CardContent className="space-y-3 p-4">
          <p className="text-xs text-muted-foreground">Color</p>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                className={`h-8 w-8 rounded-full transition-all ${color === c ? "ring-2 ring-foreground ring-offset-2" : ""}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex-1" />

      <div className="fixed bottom-16 left-0 right-0 z-50 border-t bg-background">
        <div className="mx-auto max-w-lg px-4 py-3">
          <Button
            className="w-full"
            onClick={save}
            disabled={saving || !name.trim()}
          >
            Add Category
          </Button>
        </div>
      </div>
    </main>
    </ViewTransition>
  );
}
