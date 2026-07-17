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

type Installment = Database["public"]["Tables"]["installments"]["Row"];
type Category = Database["public"]["Tables"]["categories"]["Row"];
type PaymentMethod = Database["public"]["Tables"]["payment_methods"]["Row"];

export default function InstallmentEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const [installment, setInstallment] = useState<Installment | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editTotalMonths, setEditTotalMonths] = useState("");
  const [editElapsed, setEditElapsed] = useState("");
  const [editBillingDay, setEditBillingDay] = useState("");
  const [editPmId, setEditPmId] = useState<string | null>(null);
  const [editCatId, setEditCatId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: inst } = await supabase
        .from("installments")
        .select("*")
        .eq("id", id)
        .single();

      if (inst) {
        setInstallment(inst);
        setEditName(inst.name);
        setEditAmount(String(inst.amount_per_month));
        setEditTotalMonths(String(inst.total_months));
        setEditElapsed(String(inst.months_elapsed));
        setEditBillingDay(String(inst.billing_day));
        setEditPmId(inst.payment_method_id);
        setEditCatId(inst.category_id);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: memberRows } = await supabase
          .from("space_members")
          .select("space_id")
          .eq("user_id", user.id)
          .limit(1);
        const spaceId = memberRows?.[0]?.space_id;
        if (spaceId) {
          const [cats, pms] = await Promise.all([
            supabase.from("categories").select("id, name, icon").eq("space_id", spaceId).order("sort_order"),
            supabase.from("payment_methods").select("id, name, type").eq("space_id", spaceId).eq("type", "credit_card"),
          ]);
          if (cats.data) setCategories(cats.data);
          if (pms.data) setPaymentMethods(pms.data);
        }
      }
      setLoading(false);
    }
    load();
  }, [id]);

  async function saveInstallment() {
    if (!editName.trim() || parseFloat(editAmount) === 0) return;
    setSaving(true);
    await supabase
      .from("installments")
      .update({
        name: editName.trim(),
        amount_per_month: parseFloat(editAmount),
        total_months: parseInt(editTotalMonths) || 24,
        months_elapsed: parseInt(editElapsed) || 0,
        billing_day: parseInt(editBillingDay) || 25,
        payment_method_id: editPmId,
        category_id: editCatId,
      })
      .eq("id", id);
    setSaving(false);
    router.back();
  }

  async function deleteInstallment() {
    await supabase.from("installments").delete().eq("id", id);
    router.push("/installments");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!installment) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Installment not found.</p>
        <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  const remaining = parseInt(editTotalMonths) - parseInt(editElapsed);
  const remainingTotal = remaining * parseFloat(editAmount || "0");

  const formatAmount = (amount: number) =>
    `RM ${amount.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 py-4 pb-24">
      <div className="mb-6 text-center">
        <p className="text-4xl font-bold tracking-tight font-mono">
          {formatAmount(remainingTotal)}
        </p>
        <p className="text-xs text-muted-foreground">
          {remaining} months remaining · {formatAmount(parseFloat(editAmount || "0"))}/mo
        </p>
      </div>

      <Card className="mb-3">
        <CardContent className="space-y-3 p-4">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Name</p>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Installment name" />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Amount per month</p>
            <Input type="number" step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-3">
        <CardContent className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Total months</p>
              <Input type="number" min={1} value={editTotalMonths} onChange={(e) => setEditTotalMonths(e.target.value)} />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Months elapsed</p>
              <Input type="number" min={0} value={editElapsed} onChange={(e) => setEditElapsed(e.target.value)} />
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Billing day</p>
            <Input type="number" min={1} max={31} value={editBillingDay} onChange={(e) => setEditBillingDay(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-3">
        <CardContent className="space-y-3 p-4">
          <p className="text-xs text-muted-foreground">Payment method</p>
          <div className="flex flex-wrap gap-2">
            {paymentMethods.map((pm) => (
              <button
                key={pm.id}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  editPmId === pm.id
                    ? "border-foreground bg-foreground text-primary-foreground"
                    : "border-input bg-background text-muted-foreground"
                }`}
                onClick={() => setEditPmId(editPmId === pm.id ? null : pm.id)}
              >
                💳 {pm.name}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-3">
        <CardContent className="space-y-3 p-4">
          <p className="text-xs text-muted-foreground">Category</p>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  editCatId === cat.id
                    ? "border-foreground bg-foreground text-primary-foreground"
                    : "border-input bg-background text-muted-foreground"
                }`}
                onClick={() => setEditCatId(editCatId === cat.id ? null : cat.id)}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex-1" />

      <div className="fixed bottom-16 left-0 right-0 z-50 border-t bg-background">
        <div className="mx-auto flex max-w-lg gap-2 px-4 py-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={saveInstallment}
            disabled={saving || !editName.trim() || parseFloat(editAmount) === 0}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger
              className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="h-4 w-4" />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Installment?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this installment record.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={deleteInstallment}
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
