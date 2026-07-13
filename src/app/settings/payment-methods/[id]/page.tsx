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

type PaymentMethod = Database["public"]["Tables"]["payment_methods"]["Row"];

const colorPresets = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
  "#6b7280", "#000000",
];

const typeLabels: Record<string, string> = {
  credit_card: "Credit Card",
  ewallet: "eWallet",
  cash: "Cash",
};

export default function PaymentMethodEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const [pm, setPm] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<"credit_card" | "ewallet" | "cash">("cash");
  const [editColor, setEditColor] = useState("#6366f1");
  const [editActive, setEditActive] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("id", id)
        .single();

      if (data) {
        setPm(data);
        setEditName(data.name);
        setEditType(data.type as "credit_card" | "ewallet" | "cash");
        setEditColor(data.color || "#6366f1");
        setEditActive(data.is_active);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  async function savePm() {
    if (!editName.trim()) return;
    setSaving(true);
    await supabase
      .from("payment_methods")
      .update({ name: editName.trim(), type: editType, color: editColor, is_active: editActive })
      .eq("id", id);
    setSaving(false);
    router.back();
  }

  async function deletePm() {
    await supabase
      .from("transactions")
      .update({ payment_method_id: null })
      .eq("payment_method_id", id);
    await supabase.from("payment_methods").delete().eq("id", id);
    router.push("/settings/payment-methods");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!pm) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Payment method not found.</p>
        <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  const typeIcon = editType === "credit_card" ? "💳" : editType === "ewallet" ? "📱" : "💵";

  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 py-4 pb-24">

      {/* Icon */}
      <div className="mb-4 text-center">
        <span className="text-5xl">{typeIcon}</span>
      </div>

      {/* Name */}
      <Card className="mb-3">
        <CardContent className="space-y-3 p-4">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Name</p>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Payment method name"
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Type</p>
            <div className="grid grid-cols-3 gap-2">
              {(["credit_card", "ewallet", "cash"] as const).map((t) => (
                <button
                  key={t}
                  className={`rounded-[4px] border px-3 py-2 text-xs font-medium transition-colors ${
                    editType === t
                      ? "border-foreground bg-foreground text-primary-foreground"
                      : "border-input bg-background text-muted-foreground hover:bg-accent"
                  }`}
                  onClick={() => setEditType(t)}
                >
                  {t === "credit_card" ? "💳 Card" : t === "ewallet" ? "📱 eWallet" : "💵 Cash"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Status</p>
            <button
              className={`w-full rounded-[4px] border px-3 py-2 text-xs font-medium transition-colors ${
                editActive
                  ? "border-foreground bg-foreground text-primary-foreground"
                  : "border-input bg-background text-muted-foreground hover:bg-accent"
              }`}
              onClick={() => setEditActive(!editActive)}
            >
              {editActive ? "Active" : "Inactive"}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Color */}
      <Card className="mb-3">
        <CardContent className="space-y-3 p-4">
          <p className="text-xs text-muted-foreground">Color</p>
          <div className="flex flex-wrap gap-2">
            {colorPresets.map((c) => (
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
            onClick={savePm}
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
                <AlertDialogTitle>Delete Payment Method?</AlertDialogTitle>
                <AlertDialogDescription>
                  Transactions using this method will have their payment method cleared.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={deletePm}
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
