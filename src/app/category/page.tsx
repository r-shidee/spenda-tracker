"use client";

import { useState, useEffect } from "react";
import { ViewTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

interface CategoryTotal {
  category_id: string;
  category_name: string;
  category_icon: string | null;
  total: number;
  count: number;
}

export default function CategoryPage() {
  const supabase = createClient();
  const [categoryTotals, setCategoryTotals] = useState<CategoryTotal[]>([]);
  const [totalToPay, setTotalToPay] = useState(0);
  const [ewalletSpending, setEwalletSpending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [useStatementCycle, setUseStatementCycle] = useState(true);

  async function loadData() {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: memberRows } = await supabase
        .from("space_members")
        .select("space_id, spaces!inner(statement_close_day)")
        .eq("user_id", user.id)
        .limit(1);

      const memberData = memberRows && memberRows.length > 0 ? memberRows[0] : null;
      if (!memberData) return;

      const spaceId = memberData.space_id;
      const closeDay = (memberData.spaces as unknown as { statement_close_day: number }).statement_close_day;

      const now = new Date();
      let startDate: Date;
      let endDate: Date;

      if (useStatementCycle) {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, closeDay);
        endDate = new Date(now.getFullYear(), now.getMonth(), closeDay);
        if (now.getDate() < closeDay) {
          endDate = new Date(now.getFullYear(), now.getMonth(), closeDay);
        }
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }

      const startStr = startDate.toISOString().split("T")[0];
      const endStr = endDate.toISOString().split("T")[0];

      const [{ data: txns }, { data: cats }, { data: pms }] = await Promise.all([
        supabase
          .from("transactions")
          .select("category_id, amount, payment_method_id, transaction_type")
          .eq("space_id", spaceId)
          .gte("transaction_date", startStr)
          .lte("transaction_date", endStr)
          .eq("is_reimbursed", false),
        supabase
          .from("categories")
          .select("id, name, icon")
          .eq("space_id", spaceId)
          .order("sort_order"),
        supabase
          .from("payment_methods")
          .select("id, type")
          .eq("space_id", spaceId),
      ]);

      if (txns && cats && pms) {
        const pmMap = new Map(pms.map(p => [p.id, p.type]));

        const ccTxns = txns.filter(t => pmMap.get(t.payment_method_id || "") === "credit_card");
        const ewalletTxns = txns.filter(t => pmMap.get(t.payment_method_id || "") === "ewallet" && t.transaction_type === "expense");

        const ccTotal = ccTxns.reduce((sum, t) => sum + Number(t.amount), 0);
        setTotalToPay(ccTotal);

        const ewalletTotal = ewalletTxns.reduce((sum, t) => sum + Number(t.amount), 0);
        setEwalletSpending(ewalletTotal);

        const catMap = new Map<string, { name: string; icon: string | null; total: number; count: number }>();
        for (const cat of cats) {
          catMap.set(cat.id, { name: cat.name, icon: cat.icon, total: 0, count: 0 });
        }
        for (const txn of ccTxns) {
          if (txn.category_id) {
            const entry = catMap.get(txn.category_id);
            if (entry) {
              entry.total += Number(txn.amount);
              entry.count += 1;
            }
          }
        }

        const breakdown: CategoryTotal[] = Array.from(catMap.entries())
          .map(([id, v]) => ({
            category_id: id,
            category_name: v.name,
            category_icon: v.icon,
            total: v.total,
            count: v.count,
          }))
          .filter((c) => c.total > 0)
          .sort((a, b) => b.total - a.total);

        setCategoryTotals(breakdown);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [useStatementCycle]);

  const formatAmount = (amount: number) =>
    `RM ${amount.toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

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
      <div className="mb-4 flex items-center justify-center">
        <div className="grid grid-cols-2 gap-2">
          <button
            className={cn(
              "rounded-[4px] border px-4 py-2 text-sm font-medium transition-colors",
              useStatementCycle
                ? "border-foreground bg-foreground text-primary-foreground"
                : "border-input bg-background text-muted-foreground hover:bg-accent"
            )}
            onClick={() => setUseStatementCycle(true)}
          >
            Statement
          </button>
          <button
            className={cn(
              "rounded-[4px] border px-4 py-2 text-sm font-medium transition-colors",
              !useStatementCycle
                ? "border-foreground bg-foreground text-primary-foreground"
                : "border-input bg-background text-muted-foreground hover:bg-accent"
            )}
            onClick={() => setUseStatementCycle(false)}
          >
            Monthly
          </button>
        </div>
      </div>

      <div className="mb-6 text-center">
        <p className="text-sm text-muted-foreground">Total to Pay</p>
        <p className="text-4xl font-bold tracking-tight font-mono">
          {formatAmount(totalToPay)}
        </p>
      </div>

      {ewalletSpending > 0 && (
        <div className="mb-4">
          <Card className="border-dashed">
            <CardContent className="flex items-center justify-between py-3 pl-4 pr-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">📱</span>
                <span className="text-sm font-medium">eWallet Spending</span>
              </div>
              <span className="font-mono text-sm font-semibold">
                {formatAmount(ewalletSpending)}
              </span>
            </CardContent>
          </Card>
        </div>
      )}

      {categoryTotals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">No spending this period.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {categoryTotals.map((cat) => {
            const pct = totalToPay > 0 ? (cat.total / totalToPay) * 100 : 0;
            return (
              <Link key={cat.category_id} href={`/category/${cat.category_id}`}>
                <Card className="transition-colors hover:bg-muted/50">
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{cat.category_icon || "💰"}</span>
                        <div>
                          <p className="text-sm font-medium">{cat.category_name}</p>
                          <p className="text-xs text-muted-foreground">{cat.count} transaction{cat.count !== 1 ? "s" : ""}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm font-semibold">{formatAmount(cat.total)}</p>
                        <p className="font-mono text-xs text-muted-foreground">{pct.toFixed(1)}%</p>
                      </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-foreground/80 transition-all"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </main>
    </ViewTransition>
  );
}
