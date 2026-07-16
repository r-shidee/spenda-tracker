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
import { Trash2 } from "lucide-react";
import type { Database } from "@/lib/supabase/types";

type PaymentMethod = Database["public"]["Tables"]["payment_methods"]["Row"];

const colorPresets = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
  "#6b7280", "#000000",
];

export default function PaymentMethodEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const [pm, setPm] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ccMethods, setCcMethods] = useState<PaymentMethod[]>([]);

  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<"credit_card" | "ewallet" | "cash">("cash");
  const [editColor, setEditColor] = useState("#6366f1");
  const [editActive, setEditActive] = useState(true);

  const [editBalance, setEditBalance] = useState("0");
  const [editAutoReload, setEditAutoReload] = useState(false);
  const [editReloadAmount, setEditReloadAmount] = useState("20");
  const [editReloadThreshold, setEditReloadThreshold] = useState("20");
  const [editLinkedPmId, setEditLinkedPmId] = useState<string | null>(null);
  const [editFeeRate, setEditFeeRate] = useState("1");

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
        setEditBalance(String(data.balance || 0));
        setEditAutoReload(data.auto_reload_enabled || false);
        setEditReloadAmount(String(data.reload_amount || 20));
        setEditReloadThreshold(String(data.reload_threshold || 20));
        setEditLinkedPmId(data.linked_payment_method_id || null);
        setEditFeeRate(String((data.fee_rate || 0.01) * 100));
      }

      const spaceId = data?.space_id;

      const { data: allPms } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("type", "credit_card")
        .eq("is_active", true)
        .eq("space_id", spaceId);

      if (allPms) setCcMethods(allPms);

      setLoading(false);
    }
    load();
  }, [id]);

  async function savePm() {
    if (!editName.trim()) return;
    setSaving(true);

    const updates: Record<string, unknown> = {
      name: editName.trim(),
      type: editType,
      color: editColor,
      is_active: editActive,
    };

    if (editType === "ewallet") {
      const balance = parseFloat(editBalance);
      updates.balance = isNaN(balance) ? 0 : balance;
      updates.auto_reload_enabled = editAutoReload;
      updates.reload_amount = parseFloat(editReloadAmount) || 20;
      updates.reload_threshold = parseFloat(editReloadThreshold) || 20;
      updates.linked_payment_method_id = editAutoReload ? editLinkedPmId : null;
      updates.fee_rate = (parseFloat(editFeeRate) || 1) / 100;
    }

    console.log("Saving:", JSON.stringify(updates));

    const { data, error } = await supabase
      .from("payment_methods")
      .update(updates)
      .eq("id", id)
      .select();

    if (error) {
      console.error("Save error:", error);
    } else {
      console.log("Saved:", data);
    }

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

  const pillClass = "rounded-[4px] border border-input bg-background px-3 py-2 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground";
  const pillActiveClass = "rounded-[4px] border border-foreground bg-foreground px-3 py-2 text-xs font-medium transition-colors text-primary-foreground";

  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 py-4 pb-24">

      <div className="mb-4 text-center">
        <span className="text-5xl">{typeIcon}</span>
      </div>

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
            <div className="rounded-[4px] border border-input bg-background px-3 py-2 text-xs font-medium text-muted-foreground">
              {editType === "credit_card" ? "💳 Credit Card" : editType === "ewallet" ? "📱 eWallet" : "💵 Cash"}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Status</p>
            <button
              className={editActive ? pillActiveClass : pillClass}
              onClick={() => setEditActive(!editActive)}
            >
              {editActive ? "Active" : "Inactive"}
            </button>
          </div>
        </CardContent>
      </Card>

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

      {editType === "ewallet" && (
        <>
          <Card className="mb-3">
            <CardContent className="space-y-3 p-4">
              <p className="text-xs text-muted-foreground">Balance</p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">RM</span>
                <Input
                  type="number"
                  step="0.01"
                  value={editBalance}
                  onChange={(e) => setEditBalance(e.target.value)}
                  className="flex-1"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Enter your balance as of your statement close date (e.g., 25th of each month)
              </p>
            </CardContent>
          </Card>

          <Card className="mb-3">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Auto Reload</p>
                <button
                  className={editAutoReload ? pillActiveClass : pillClass}
                  onClick={() => setEditAutoReload(!editAutoReload)}
                >
                  {editAutoReload ? "ON" : "OFF"}
                </button>
              </div>

              {editAutoReload && (
                <>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Reload Amount</p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">RM</span>
                      <Input
                        type="number"
                        step="1"
                        value={editReloadAmount}
                        onChange={(e) => setEditReloadAmount(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Reload When Below</p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">RM</span>
                      <Input
                        type="number"
                        step="1"
                        value={editReloadThreshold}
                        onChange={(e) => setEditReloadThreshold(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Reload From</p>
                    <div className="grid grid-cols-2 gap-2">
                      {ccMethods.map((cc) => (
                        <button
                          key={cc.id}
                          className={editLinkedPmId === cc.id ? pillActiveClass : pillClass}
                          onClick={() => setEditLinkedPmId(cc.id)}
                        >
                          💳 {cc.name}
                        </button>
                      ))}
                      {ccMethods.length === 0 && (
                        <p className="text-xs text-muted-foreground col-span-2">
                          No credit cards. Add one first.
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Fee Rate</p>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={editFeeRate}
                        onChange={(e) => setEditFeeRate(e.target.value)}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <div className="flex-1" />

      <div className="fixed bottom-16 left-0 right-0 z-50 border-t bg-background">
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
