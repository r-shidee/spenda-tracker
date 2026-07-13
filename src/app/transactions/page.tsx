"use client";

import { useState, useEffect } from "react";
import { ViewTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type Category = Database["public"]["Tables"]["categories"]["Row"];
type PaymentMethod = Database["public"]["Tables"]["payment_methods"]["Row"];

const ownershipLabels: Record<string, string> = {
  self: "Self",
  shared: "Family",
  gift_spouse: "Gift / Treat",
  paid_for_others: "Reimbursable",
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string | null>(null);
  const [filterOwnership, setFilterOwnership] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"date" | "highest" | "lowest">("date");

  const supabase = createClient();

  async function loadData() {
    setLoading(true);

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

    const spaceId = memberData.space_id;

    const [txnsResult, catsResult, pmsResult] = await Promise.all([
      supabase
        .from("transactions")
        .select("*")
        .eq("space_id", spaceId)
        .eq("transaction_type", "expense")
        .eq("is_reimbursed", false)
        .order("transaction_date", { ascending: false }),
      supabase
        .from("categories")
        .select("*")
        .eq("space_id", spaceId)
        .order("sort_order"),
      supabase
        .from("payment_methods")
        .select("*")
        .eq("space_id", spaceId),
    ]);

    if (txnsResult.data) setTransactions(txnsResult.data);
    if (catsResult.data) setCategories(catsResult.data);
    if (pmsResult.data) setPaymentMethods(pmsResult.data);
    } finally {
    setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const formatAmount = (amount: number) =>
    `RM ${amount.toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const usedCategoryIds = [...new Set(transactions.map((t) => t.category_id).filter(Boolean))] as string[];
  const usedPmIds = [...new Set(transactions.map((t) => t.payment_method_id).filter(Boolean))] as string[];
  const usedOwnerships = [...new Set(transactions.map((t) => t.expense_ownership).filter(Boolean))];
  const usedCategories = categories.filter((c) => usedCategoryIds.includes(c.id));
  const usedPaymentMethods = paymentMethods.filter((p) => usedPmIds.includes(p.id));

  const filteredTransactions = transactions.filter((txn) => {
    if (filterCategory && txn.category_id !== filterCategory) return false;
    if (filterPaymentMethod && txn.payment_method_id !== filterPaymentMethod) return false;
    if (filterOwnership && txn.expense_ownership !== filterOwnership) return false;
    return true;
  });

  const totalFiltered = filteredTransactions.reduce((sum, t) => sum + Number(t.amount), 0);

  const sortedTransactions = sortBy === "highest"
    ? [...filteredTransactions].sort((a, b) => Number(b.amount) - Number(a.amount))
    : sortBy === "lowest"
    ? [...filteredTransactions].sort((a, b) => Number(a.amount) - Number(b.amount))
    : filteredTransactions;

  const grouped = sortedTransactions.reduce<Record<string, Transaction[]>>((acc, txn) => {
    const d = new Date(txn.transaction_date + "T00:00:00");
    const dateKey = d.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(txn);
    return acc;
  }, {});

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

      {/* Filter pills */}
      {(usedCategories.length > 0 || usedPaymentMethods.length > 0) && (
        <div className="sticky top-12 z-20 -mx-4 mb-2 space-y-2 border-b bg-background px-4 pb-3 pt-1 shadow-sm">
          {usedCategories.length > 0 && (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
              {usedCategories.map((cat) => (
                <button
                  key={cat.id}
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-lg transition-colors",
                    filterCategory === cat.id
                      ? "border-foreground bg-foreground text-primary-foreground"
                      : "border-input bg-background text-muted-foreground hover:bg-accent"
                  )}
                  onClick={() =>
                    setFilterCategory(filterCategory === cat.id ? null : cat.id)
                  }
                >
                  {cat.icon}
                </button>
              ))}
            </div>
          )}
          {/* Payment methods hidden for now */}
          {false && usedPaymentMethods.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {usedPaymentMethods.map((pm) => (
                <button
                  key={pm.id}
                  className={cn(
                    "rounded-[4px] border px-3 py-1.5 text-xs font-medium transition-colors",
                    filterPaymentMethod === pm.id
                      ? "border-foreground bg-foreground text-primary-foreground"
                      : "border-input bg-background text-muted-foreground hover:bg-accent"
                  )}
                  onClick={() =>
                    setFilterPaymentMethod(filterPaymentMethod === pm.id ? null : pm.id)
                  }
                >
                  <span
                    className="mr-1.5 inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: pm.color || "#6b7280" }}
                  />
                  {pm.name}
                </button>
              ))}
            </div>
          )}
          {usedOwnerships.length > 1 && (
            <div className="mx-auto grid w-2/3 grid-cols-2 gap-2">
              {usedOwnerships.map((o) => (
                <button
                  key={o}
                  className={cn(
                    "rounded-[4px] border px-3 py-1.5 text-xs font-medium transition-colors",
                    filterOwnership === o
                      ? "border-foreground bg-foreground text-primary-foreground"
                      : "border-input bg-background text-muted-foreground hover:bg-accent"
                  )}
                  onClick={() =>
                    setFilterOwnership(filterOwnership === o ? null : o)
                  }
                >
                  {ownershipLabels[o] || o}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? "s" : ""}
        </span>
        <span className="font-mono text-sm font-semibold">{formatAmount(totalFiltered)}</span>
      </div>

      {/* Sort pills */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        {(["date", "highest", "lowest"] as const).map((s) => (
          <button
            key={s}
            className={cn(
              "rounded-[4px] border px-3 py-1.5 text-xs font-medium transition-colors",
              sortBy === s
                ? "border-foreground bg-foreground text-primary-foreground"
                : "border-input bg-background text-muted-foreground hover:bg-accent"
            )}
            onClick={() => setSortBy(s)}
          >
            {s === "date" ? "📅 Date" : s === "highest" ? "⬆️ Highest" : "⬇️ Lowest"}
          </button>
        ))}
      </div>

      {filteredTransactions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">No transactions found.</p>
            <p className="text-xs text-muted-foreground">
              Tap + to add your first expense.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([dateKey, txns]) => {
            const dayTotal = txns.reduce((sum, t) => sum + Number(t.amount), 0);
            const showDateHeader = sortBy === "date";
            return (
              <div key={dateKey}>
                {showDateHeader && (
                  <div className="mb-2 flex flex-col items-center">
                    <span className="text-sm font-semibold">
                      {dateKey}
                    </span>
                    <div className="my-1 h-px w-full bg-border" />
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatAmount(dayTotal)}
                    </span>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  {txns.map((txn) => {
                    const cat = categories.find((c) => c.id === txn.category_id);
                    const pm = paymentMethods.find((p) => p.id === txn.payment_method_id);
                    return (
                      <Link key={txn.id} href={`/transactions/${txn.id}`}>
                        <Card className="relative overflow-hidden transition-colors hover:bg-muted/50">
                          <div
                            className="absolute left-0 top-0 h-full w-1.5"
                            style={{ backgroundColor: cat?.color || "transparent" }}
                          />
                          <CardContent className="flex items-center justify-between py-2 pl-4 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{cat?.icon || "💰"}</span>
                              <div>
                                <p className="text-sm font-medium">
                                  {txn.merchant_name}
                                </p>
                                <div className="flex items-center gap-1">
                                    <div className="flex items-center gap-1">
                                      <p className="text-xs text-muted-foreground">
                                        {cat?.name || "Uncategorized"}
                                      </p>
                                      <span className="text-xs text-muted-foreground">·</span>
                                      <span className="text-xs text-muted-foreground">
                                        {ownershipLabels[txn.expense_ownership] || txn.expense_ownership}
                                      </span>
                                    </div>
                                </div>
                              </div>
                            </div>
                            <span className="font-mono text-sm font-semibold">
                              {formatAmount(Number(txn.amount))}
                            </span>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
    </ViewTransition>
  );
}
