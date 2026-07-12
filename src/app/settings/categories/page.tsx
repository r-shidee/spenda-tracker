"use client";

import { useState, useEffect } from "react";
import { ViewTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Trash2 } from "lucide-react";
import type { Database } from "@/lib/supabase/types";

type Category = Database["public"]["Tables"]["categories"]["Row"];

export default function CategoriesSettingsPage() {
  const supabase = createClient();
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
        .select("*")
        .eq("space_id", memberData.space_id)
        .order("sort_order");

      if (cats) setCategories(cats);
    } finally {
      setLoading(false);
    }
  }

  async function addCategory() {
    if (!spaceId || !newCategoryName.trim()) return;
    await supabase.from("categories").insert({
      space_id: spaceId,
      name: newCategoryName.trim(),
      icon: newCategoryIcon || null,
      sort_order: categories.length + 1,
    });
    setNewCategoryName("");
    setNewCategoryIcon("");
    await loadData();
  }

  async function updateCategory(id: string) {
    if (!editCategoryName.trim()) return;
    await supabase.from("categories").update({ name: editCategoryName.trim() }).eq("id", id);
    setEditingCategory(null);
    await loadData();
  }

  async function deleteCategory(id: string) {
    const { count } = await supabase
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("category_id", id);

    if (count && count > 0) {
      alert(`Cannot delete: ${count} transaction(s) use this category.`);
      return;
    }
    await supabase.from("categories").delete().eq("id", id);
    await loadData();
  }

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
    <main className="mx-auto w-full max-w-lg px-4 pt-4 pb-4">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Add Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Icon"
              value={newCategoryIcon}
              onChange={(e) => setNewCategoryIcon(e.target.value)}
              className="h-8 w-16 text-sm"
            />
            <Input
              placeholder="Category name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="h-8 flex-1 text-sm"
            />
            <Button
              size="sm"
              onClick={addCategory}
              disabled={!newCategoryName.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {categories.map((cat) => (
          <Card key={cat.id}>
            <CardContent className="flex items-center justify-between p-3">
              {editingCategory === cat.id ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editCategoryName}
                    onChange={(e) => setEditCategoryName(e.target.value)}
                    className="h-8 w-40 text-sm"
                  />
                  <Button size="sm" onClick={() => updateCategory(cat.id)}>
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingCategory(null)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <span className="text-sm">
                    {cat.icon} {cat.name}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => {
                        setEditingCategory(cat.id);
                        setEditCategoryName(cat.name);
                      }}
                    >
                      ✏️
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-destructive hover:bg-muted"
                      >
                        <Trash2 className="h-3 w-3" />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Category?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteCategory(cat.id)}
                            className="bg-destructive text-destructive-foreground"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
    </ViewTransition>
  );
}
