"use client";

import { useState, useEffect } from "react";
import { ViewTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import type { Database } from "@/lib/supabase/types";

type Installment = Database["public"]["Tables"]["installments"]["Row"];
type Category = Database["public"]["Tables"]["categories"]["Row"];
type PaymentMethod = Database["public"]["Tables"]["payment_methods"]["Row"];

export default function InstallmentsPage() {
  const supabase = createClient();
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: memberRows } = await supabase
      .from("space_members")
      .select("space_id")
      .eq("user_id", user.id)
      .limit(1);
    const spaceId = memberRows?.[0]?.space_id;
    if (!spaceId) { setLoading(false); return; }

    const [instResult, catResult, pmResult] = await Promise.all([
      supabase
        .from("installments")
        .select("*")
        .eq("space_id", spaceId)
        .order("created_at", { ascending: false }),
      supabase
        .from("categories")
        .select("*")
        .eq("space_id", spaceId),
      supabase
        .from("payment_methods")
        .select("*")
        .eq("space_id", spaceId),
    ]);

    if (instResult.data) {
      const now = new Date();
      const toUpdate: { id: string; months_elapsed: number; is_completed: boolean }[] = [];

      for (const inst of instResult.data) {
        if (inst.is_completed) continue;
        const billingDay = inst.billing_day;
        const today = now.getDate();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const billingDateThisMonth = new Date(currentYear, currentMonth, billingDay);
        if (now > billingDateThisMonth && inst.months_elapsed < inst.total_months) {
          const newElapsed = inst.months_elapsed + 1;
          const completed = newElapsed >= inst.total_months;
          toUpdate.push({ id: inst.id, months_elapsed: newElapsed, is_completed: completed });
          inst.months_elapsed = newElapsed;
          inst.is_completed = completed;
        }
      }

      if (toUpdate.length > 0) {
        for (const u of toUpdate) {
          await supabase
            .from("installments")
            .update({ months_elapsed: u.months_elapsed, is_completed: u.is_completed })
            .eq("id", u.id);
        }
      }

      setInstallments(instResult.data);
    }
    if (catResult.data) setCategories(catResult.data);
    if (pmResult.data) setPaymentMethods(pmResult.data);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  const formatAmount = (amount: number) =>
    `RM ${amount.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const catMap = new Map(categories.map(c => [c.id, c]));
  const pmMap = new Map(paymentMethods.map(p => [p.id, p]));

  const activeInstallments = installments.filter(i => !i.is_completed);
  const completedInstallments = installments.filter(i => i.is_completed);

  const totalRemaining = activeInstallments.reduce(
    (sum, i) => sum + (i.total_months - i.months_elapsed) * Number(i.amount_per_month), 0
  );

  const getNextBillingDate = (inst: Installment) => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), inst.billing_day);
    if (now.getDate() >= inst.billing_day) {
      d.setMonth(d.getMonth() + 1);
    }
    return d;
  };

  const getEndDate = (inst: Installment) => {
    const next = getNextBillingDate(inst);
    const remaining = inst.total_months - inst.months_elapsed;
    const end = new Date(next);
    end.setMonth(end.getMonth() + remaining - 1);
    return end;
  };

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });

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
      <div className="mb-6 text-center">
        <p className="text-sm text-muted-foreground">Total Remaining</p>
        <p className="text-4xl font-bold tracking-tight font-mono">
          {formatAmount(totalRemaining)}
        </p>
        <p className="text-xs text-muted-foreground">
          {activeInstallments.length} active installment{activeInstallments.length !== 1 ? "s" : ""}
        </p>
      </div>

      {activeInstallments.length === 0 && completedInstallments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">No installments yet.</p>
            <p className="text-xs text-muted-foreground">Tap + to add your first installment.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {activeInstallments.map((inst) => {
            const cat = catMap.get(inst.category_id || "");
            const pm = pmMap.get(inst.payment_method_id || "");
            const remaining = inst.total_months - inst.months_elapsed;
            const remainingTotal = remaining * Number(inst.amount_per_month);
            const progress = (inst.months_elapsed / inst.total_months) * 100;
            const nextBilling = getNextBillingDate(inst);
            const endDate = getEndDate(inst);

            return (
              <Link key={inst.id} href={`/installments/${inst.id}`} transitionTypes={["nav-forward"]}>
                <Card className="transition-colors hover:bg-muted/50">
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{cat?.icon || "🔄"}</span>
                        <div>
                          <p className="text-sm font-medium">{inst.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Month {inst.months_elapsed} of {inst.total_months}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm font-semibold">{formatAmount(remainingTotal)}</p>
                        <p className="text-xs text-muted-foreground">{formatAmount(Number(inst.amount_per_month))}/mo</p>
                      </div>
                    </div>
                    <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-foreground/80 transition-all"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Next: {formatDate(nextBilling)}</span>
                      {pm && <span>💳 {pm.name}</span>}
                      <span>Ends: {formatDate(endDate)}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}

          {completedInstallments.length > 0 && (
            <>
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs">Completed</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              {completedInstallments.map((inst) => {
                const cat = catMap.get(inst.category_id || "");
                const pm = pmMap.get(inst.payment_method_id || "");
                return (
                  <Card key={inst.id} className="opacity-50">
                    <CardContent className="flex items-center justify-between py-3 pl-4 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{cat?.icon || "🔄"}</span>
                        <div>
                          <p className="text-sm font-medium">{inst.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {inst.total_months} months · {pm?.name || ""}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">Done</span>
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}
        </div>
      )}

      <div className="fixed bottom-16 right-4 z-40">
        <Link
          href="/installments/add"
          transitionTypes={["nav-forward"]}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          <Plus className="h-6 w-6" />
        </Link>
      </div>
    </main>
    </ViewTransition>
  );
}
