"use client";

import { useState, useEffect, use } from "react";
import { ViewTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type Category = Database["public"]["Tables"]["categories"]["Row"];
type PaymentMethod = Database["public"]["Tables"]["payment_methods"]["Row"];

const ownershipLabels: Record<string, string> = {
  self: "Self",
  shared: "Family",
  gift_spouse: "Gift / Treat Spouse",
  paid_for_others: "Paid for Others (Reimbursable)",
};

export default function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(
    null
  );
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Transaction>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTransaction();
  }, [id]);

  async function loadTransaction() {
    const { data: txn } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", id)
      .single();

    if (!txn) {
      setLoading(false);
      return;
    }

    setTransaction(txn);
    setEditData(txn);

    // Load related data
    const [catResult, pmResult] = await Promise.all([
      txn.category_id
        ? supabase
            .from("categories")
            .select("*")
            .eq("id", txn.category_id)
            .single()
        : Promise.resolve({ data: null }),
      txn.payment_method_id
        ? supabase
            .from("payment_methods")
            .select("*")
            .eq("id", txn.payment_method_id)
            .single()
        : Promise.resolve({ data: null }),
    ]);

    if (catResult.data) setCategory(catResult.data);
    if (pmResult.data) setPaymentMethod(pmResult.data);

    // Load options for editing
    if (txn.space_id) {
      const [cats, pms] = await Promise.all([
        supabase
          .from("categories")
          .select("*")
          .eq("space_id", txn.space_id)
          .order("sort_order"),
        supabase
          .from("payment_methods")
          .select("*")
          .eq("space_id", txn.space_id)
          .eq("is_active", true)
          .order("name"),
      ]);
      if (cats.data) setCategories(cats.data);
      if (pms.data) setPaymentMethods(pms.data);
    }

    setLoading(false);
  }

  async function handleSave() {
    if (!transaction) return;
    setSaving(true);

    const { error } = await supabase
      .from("transactions")
      .update({
        amount: editData.amount,
        currency: editData.currency,
        merchant_name: editData.merchant_name,
        transaction_date: editData.transaction_date,
        transaction_time: editData.transaction_time,
        category_id: editData.category_id,
        payment_method_id: editData.payment_method_id || null,
        transaction_type: editData.transaction_type,
        expense_ownership: editData.expense_ownership,
        is_reimbursed: editData.is_reimbursed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transaction.id);

    if (error) {
      console.error("Save error:", error);
      alert("Failed to save: " + error.message);
    } else {
      setEditing(false);
      await loadTransaction();
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!transaction) return;

    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", transaction.id);

    if (!error) {
      router.push("/");
      router.refresh();
    }
  }

  const formatAmount = (amount: number) =>
    `RM ${amount.toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const pillClass = cn(
    "rounded-[4px] border border-input bg-background px-4 py-2.5 text-sm font-medium transition-colors",
    "hover:bg-accent hover:text-accent-foreground"
  );

  const pillActiveClass = cn(
    "rounded-[4px] border border-foreground bg-foreground px-4 py-2.5 text-sm font-medium transition-colors text-primary-foreground"
  );

  const ownershipOptions = [
    { value: "self" as const, label: "Self" },
    { value: "shared" as const, label: "Family" },
    { value: "gift_spouse" as const, label: "Gift / Treat" },
    { value: "paid_for_others" as const, label: "Reimbursable" },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Transaction not found.</p>
        <Button variant="outline" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 pt-4 pb-24">

      {/* Amount */}
      <div className="mb-6 text-center">
        <p className="text-4xl font-bold tracking-tight font-mono">
          {editing ? (
            <Input
              type="number"
              value={editData.amount || ""}
              onChange={(e) =>
                setEditData({ ...editData, amount: parseFloat(e.target.value) || 0 })
              }
              className="text-center text-4xl font-bold font-mono"
            />
          ) : (
            formatAmount(Number(transaction.amount))
          )}
        </p>
      </div>

      {/* Details */}
      <Card className="mb-6">
        <CardContent className="space-y-4 p-4">
          {/* Merchant */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Merchant</span>
            {editing ? (
              <Input
                value={editData.merchant_name || ""}
                onChange={(e) =>
                  setEditData({ ...editData, merchant_name: e.target.value })
                }
                className="w-48 text-right"
              />
            ) : (
              <span className="text-sm font-medium">
                {transaction.merchant_name}
              </span>
            )}
          </div>

          {/* Date */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Date</span>
            {editing ? (
              <Input
                type="date"
                value={editData.transaction_date || ""}
                onChange={(e) =>
                  setEditData({ ...editData, transaction_date: e.target.value })
                }
                className="w-48 text-right"
              />
            ) : (
              <span className="text-sm font-medium">
                {new Date(transaction.transaction_date).toLocaleDateString(
                  "en-MY",
                  { day: "numeric", month: "short", year: "numeric" }
                )}
              </span>
            )}
          </div>

          {/* Category */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Category</span>
            {editing ? (
              <span className="text-sm font-medium">
                {category?.icon} {category?.name || "Uncategorized"}
              </span>
            ) : (
              <span className="text-sm font-medium">
                {category?.icon} {category?.name || "Uncategorized"}
              </span>
            )}
          </div>
          {editing && (
            <div className="flex flex-wrap gap-2 pt-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  className={cn(
                    editData.category_id === cat.id ? pillActiveClass : pillClass,
                    "text-xs py-1.5 px-3"
                  )}
                  onClick={() =>
                    setEditData({ ...editData, category_id: cat.id })
                  }
                >
                  {cat.icon} {cat.name}
                </button>
              ))}
            </div>
          )}

          {/* Payment Method */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Payment</span>
            {editing ? (
              <span className="text-sm font-medium">
                {paymentMethod?.name || "None"}
              </span>
            ) : (
              <span className="text-sm font-medium">
                {paymentMethod?.name || "None"}
              </span>
            )}
          </div>
          {editing && (
            <div className="flex flex-wrap gap-2 pt-1">
              {paymentMethods.map((pm) => (
                <button
                  key={pm.id}
                  className={cn(
                    editData.payment_method_id === pm.id ? pillActiveClass : pillClass,
                    "text-xs py-1.5 px-3"
                  )}
                  onClick={() =>
                    setEditData({ ...editData, payment_method_id: pm.id })
                  }
                >
                  {pm.type === "credit_card" && "💳 "}
                  {pm.type === "ewallet" && "📱 "}
                  {pm.type === "cash" && "💵 "}
                  {pm.name}
                </button>
              ))}
            </div>
          )}

          {/* Ownership */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Ownership</span>
            {editing ? (
              <span className="text-sm font-medium">
                {ownershipOptions.find(o => o.value === editData.expense_ownership)?.label || "Self"}
              </span>
            ) : (
              <span className="text-sm font-medium">
                {ownershipLabels[transaction.expense_ownership]}
              </span>
            )}
          </div>
          {editing && (
            <div className="flex flex-wrap gap-2 pt-1">
              {ownershipOptions.map((opt) => (
                <button
                  key={opt.value}
                  className={cn(
                    editData.expense_ownership === opt.value ? pillActiveClass : pillClass,
                    "text-xs py-1.5 px-3"
                  )}
                  onClick={() =>
                    setEditData({ ...editData, expense_ownership: opt.value })
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Reimbursed toggle (only for paid_for_others) */}
          {transaction.expense_ownership === "paid_for_others" && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Reimbursed</span>
              <Switch
                checked={editing ? editData.is_reimbursed || false : transaction.is_reimbursed}
                onCheckedChange={(checked) =>
                  setEditData({ ...editData, is_reimbursed: checked })
                }
                disabled={!editing}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-20 left-0 right-0 z-40 border-t bg-background">
        <div className="mx-auto flex max-w-lg gap-3 px-4 py-3">
          {editing ? (
            <>
              <Button
                variant="outline"
                className="flex-1 h-12"
                onClick={() => {
                  setEditing(false);
                  setEditData(transaction);
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-12"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                className="flex-1 h-12"
                onClick={() => setEditing(true)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger
                  className="flex flex-1 h-12 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. The transaction will be
                      permanently deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>
    </main>
    </ViewTransition>
  );
}
