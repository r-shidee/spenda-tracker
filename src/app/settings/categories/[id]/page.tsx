"use client";

import { useState, useEffect, use } from "react";
import { ViewTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2 } from "lucide-react";
import type { Database } from "@/lib/supabase/types";

type Category = Database["public"]["Tables"]["categories"]["Row"];

const COLORS = ["#ef4444","#f59e0b","#22c55e","#3b82f6","#8b5cf6","#ec4899","#14b8a6","#6b7280"];

export default function CategoryEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [editColor, setEditColor] = useState("#6b7280");

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("categories")
        .select("*")
        .eq("id", id)
        .single();

      if (data) {
        setCategory(data);
        setEditName(data.name);
        setEditIcon(data.icon || "");
        setEditColor(data.color || "#6b7280");
      }
      setLoading(false);
    }
    load();
  }, [id]);

  async function saveCategory() {
    if (!editName.trim()) return;
    setSaving(true);
    await supabase
      .from("categories")
      .update({ name: editName.trim(), icon: editIcon || null, color: editColor })
      .eq("id", id);
    setSaving(false);
    router.back();
  }

  async function deleteCategory() {
    const { count } = await supabase
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("category_id", id);

    if (count && count > 0) {
      alert(`Cannot delete: ${count} transaction(s) use this category.`);
      return;
    }
    await supabase.from("categories").delete().eq("id", id);
    router.push("/settings/categories");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Category not found.</p>
        <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 py-4 pb-24">

      {/* Icon */}
      <div className="mb-4 text-center">
        <span className="text-5xl">{editIcon || "💰"}</span>
      </div>

      {/* Name */}
      <Card className="mb-3">
        <CardContent className="space-y-3 p-4">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Name</p>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Category name"
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Icon (emoji)</p>
            <Input
              value={editIcon}
              onChange={(e) => setEditIcon(e.target.value)}
              placeholder="e.g. 🍽️"
            />
          </div>
        </CardContent>
      </Card>

      {/* Color */}
      <Card className="mb-3">
        <CardContent className="space-y-3 p-4">
          <p className="text-xs text-muted-foreground">Color</p>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                className={`h-8 w-8 rounded-full transition-all ${editColor === c ? "ring-2 ring-foreground ring-offset-2" : ""}`}
                style={{ backgroundColor: c }}
                onClick={() => setEditColor(c)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background">
        <div className="mx-auto flex max-w-lg gap-2 px-4 py-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={saveCategory}
            disabled={saving || !editName.trim()}
          >
            Save
          </Button>
          <AlertDialog>
            <AlertDialogTrigger
              className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="h-4 w-4" />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Category?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this category. Transactions using it will become uncategorized.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={deleteCategory}
                  className="bg-destructive text-destructive-foreground"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </main>
    </ViewTransition>
  );
}
