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
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

type PaymentMethod = Database["public"]["Tables"]["payment_methods"]["Row"];

const colorPresets = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
  "#6b7280", "#000000",
];

export default function PaymentMethodsSettingsPage() {
  const supabase = createClient();
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  const [newPmName, setNewPmName] = useState("");
  const [newPmType, setNewPmType] = useState<"credit_card" | "ewallet" | "cash">("cash");
  const [newPmColor, setNewPmColor] = useState("#6366f1");
  const [editingPmColor, setEditingPmColor] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: memberData } = await supabase
        .from("space_members")
        .select("space_id")
        .eq("user_id", user.id)
        .single();

      if (!memberData) return;
      setSpaceId(memberData.space_id);

      const { data: pms } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("space_id", memberData.space_id)
        .order("name");

      if (pms) setPaymentMethods(pms);
    } finally {
      setLoading(false);
    }
  }

  async function addPaymentMethod() {
    if (!spaceId || !newPmName.trim()) return;
    await supabase.from("payment_methods").insert({
      space_id: spaceId,
      name: newPmName.trim(),
      type: newPmType,
      color: newPmColor,
    });
    setNewPmName("");
    setNewPmColor("#6366f1");
    await loadData();
  }

  async function updatePmColor(id: string, color: string) {
    await supabase.from("payment_methods").update({ color }).eq("id", id);
    setEditingPmColor(null);
    await loadData();
  }

  async function togglePaymentMethodActive(id: string, current: boolean) {
    await supabase.from("payment_methods").update({ is_active: !current }).eq("id", id);
    await loadData();
  }

  async function deletePaymentMethod(id: string) {
    await supabase
      .from("transactions")
      .update({ payment_method_id: null })
      .eq("payment_method_id", id);
    await supabase.from("payment_methods").delete().eq("id", id);
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
          <CardTitle className="text-base">Add Payment Method</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <select
              value={newPmType}
              onChange={(e) =>
                setNewPmType(e.target.value as "credit_card" | "ewallet" | "cash")
              }
              className="h-8 rounded-md border bg-transparent px-2 text-sm"
            >
              <option value="cash">Cash</option>
              <option value="credit_card">Credit Card</option>
              <option value="ewallet">eWallet</option>
            </select>
            <Input
              placeholder="Method name"
              value={newPmName}
              onChange={(e) => setNewPmName(e.target.value)}
              className="h-8 flex-1 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Color</span>
            <div className="flex flex-wrap gap-1.5">
              {colorPresets.map((c) => (
                <button
                  key={c}
                  className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: newPmColor === c ? "hsl(var(--foreground))" : "transparent",
                  }}
                  onClick={() => setNewPmColor(c)}
                />
              ))}
            </div>
          </div>
          <Button
            size="sm"
            className="w-full"
            onClick={addPaymentMethod}
            disabled={!newPmName.trim()}
          >
            <Plus className="mr-1 h-4 w-4" /> Add Payment Method
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {paymentMethods.map((pm) => (
          <Card key={pm.id}>
            <CardContent className="flex items-center justify-between p-3">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: pm.color || "#6b7280" }}
                />
                <span className="text-xs text-muted-foreground">
                  {pm.type === "credit_card" ? "💳" : pm.type === "ewallet" ? "📱" : "💵"}
                </span>
                <span className="text-sm">{pm.name}</span>
                {!pm.is_active && (
                  <span className="text-xs text-muted-foreground">(inactive)</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {editingPmColor === pm.id ? (
                  <div className="flex items-center gap-1">
                    <div className="flex gap-1">
                      {colorPresets.map((c) => (
                        <button
                          key={c}
                          className="h-4 w-4 rounded-full border-2 transition-transform hover:scale-110"
                          style={{
                            backgroundColor: c,
                            borderColor: pm.color === c ? "hsl(var(--foreground))" : "transparent",
                          }}
                          onClick={() => updatePmColor(pm.id, c)}
                        />
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => setEditingPmColor(null)}
                    >
                      Done
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => setEditingPmColor(pm.id)}
                    >
                      Color
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => togglePaymentMethodActive(pm.id, pm.is_active)}
                    >
                      {pm.is_active ? "Deactivate" : "Activate"}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-destructive hover:bg-muted"
                      >
                        <Trash2 className="h-3 w-3" />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Payment Method?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Existing transactions using this method will have their
                            payment method cleared.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deletePaymentMethod(pm.id)}
                            className="bg-destructive text-destructive-foreground"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
    </ViewTransition>
  );
}
