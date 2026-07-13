"use client";

import { useState, useEffect } from "react";
import { ViewTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
  const [totalSpending, setTotalSpending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [useStatementCycle, setUseStatementCycle] = useState(false);
  const [statementCloseDay, setStatementCloseDay] = useState(1);

  useEffect(() => {
    loadData();
  }, [useStatementCycle]);

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
      setStatementCloseDay(closeDay);

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

      const { data: txns } = await supabase
        .from("transactions")
        .select("category_id, amount")
        .eq("space_id", spaceId)
        .gte("transaction_date", startStr)
        .lte("transaction_date", endStr)
        .eq("transaction_type", "expense")
        .eq("is_reimbursed", false);

      const { data: cats } = await supabase
        .from("categories")
        .select("id, name, icon")
        .eq("space_id", spaceId)
        .order("sort_order");

      if (txns && cats) {
        const total = txns.reduce((sum, t) => sum + Number(t.amount), 0);
        setTotalSpending(total);

        const catMap = new Map<string, { name: string; icon: string | null; total: number; count: number }>();
        for (const cat of cats) {
          catMap.set(cat.id, { name: cat.name, icon: cat.icon, total: 0, count: 0 });
        }
        for (const txn of txns) {
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
          .sort((a, b) => b.total - a.total);

        setCategoryTotals(breakdown);
      }
    } finally {
      setLoading(false);
    }
  }

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
    <main className="mx-auto w-full max-w-lg px-4 pt-4 pb-4">
      {/* Period Toggle */}
      <div className="mb-6 flex items-center justify-center">
        <div className="grid grid-cols-2 gap-2">
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
        </div>
      </div>

      {/* Total */}
      <div className="mb-8 text-center">
        <p className="text-sm text-muted-foreground">Total Spending</p>
        <p className="text-4xl font-bold tracking-tight font-mono">
          {formatAmount(totalSpending)}
        </p>
      </div>

      {/* Category List */}
      {categoryTotals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">No spending this period.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {categoryTotals.map((cat) => {
            const pct = totalSpending > 0 ? (cat.total / totalSpending) * 100 : 0;
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
