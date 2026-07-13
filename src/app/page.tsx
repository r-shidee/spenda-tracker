"use client";

import { useState, useEffect } from "react";
import { ViewTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type Category = Database["public"]["Tables"]["categories"]["Row"];
type PaymentMethod = Database["public"]["Tables"]["payment_methods"]["Row"];

interface CategoryTotal {
  category_id: string;
  category_name: string;
  category_icon: string | null;
  total: number;
}

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categoryTotals, setCategoryTotals] = useState<CategoryTotal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [useStatementCycle, setUseStatementCycle] = useState(false);
  const [statementCloseDay, setStatementCloseDay] = useState(1);
  const [totalSpending, setTotalSpending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string | null>(null);
  const [filterOwnership, setFilterOwnership] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, [useStatementCycle]);

  async function loadData() {
    setLoading(true);

    try {
    // Get current user's space
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    let { data: memberRows } = await supabase
      .from("space_members")
      .select("space_id, spaces!inner(statement_close_day)")
      .eq("user_id", user.id)
      .limit(1);

    let memberData = memberRows && memberRows.length > 0 ? memberRows[0] : null;

    // Auto-create space if first login
    if (!memberData) {
      const { data: spaceData } = await supabase
        .from("spaces")
        .insert({ name: "My Space" })
        .select("id")
        .single();

      if (spaceData) {
        await supabase.from("space_members").insert({
          space_id: spaceData.id,
          user_id: user.id,
          role: "owner",
        });

        const defaultCategories = [
          { name: "Eating Out", icon: "🍽️", sort_order: 1 },
          { name: "Groceries", icon: "🛒", sort_order: 2 },
          { name: "Petrol", icon: "⛽", sort_order: 3 },
          { name: "Shopping", icon: "🛍️", sort_order: 4 },
          { name: "Utilities", icon: "💡", sort_order: 5 },
          { name: "Transport", icon: "🚗", sort_order: 6 },
          { name: "Entertainment", icon: "🎬", sort_order: 7 },
          { name: "Health", icon: "🏥", sort_order: 8 },
          { name: "Education", icon: "📚", sort_order: 9 },
          { name: "Household", icon: "🏠", sort_order: 10 },
          { name: "Clothing", icon: "👕", sort_order: 11 },
          { name: "Personal Care", icon: "💆", sort_order: 12 },
          { name: "Bank Fees", icon: "🏦", sort_order: 13 },
          { name: "Transfer", icon: "🔄", sort_order: 14 },
          { name: "Gift", icon: "🎁", sort_order: 15 },
        ];
        await supabase.from("categories").insert(
          defaultCategories.map((cat) => ({
            space_id: spaceData.id,
            ...cat,
            is_default: true,
          }))
        );

        // Re-fetch member data
        const { data: newMemberRows } = await supabase
          .from("space_members")
          .select("space_id, spaces!inner(statement_close_day)")
          .eq("user_id", user.id)
          .limit(1);
        memberData = newMemberRows && newMemberRows.length > 0 ? newMemberRows[0] : null;
      }
    }

    if (!memberData) {
      setLoading(false);
      return;
    }

    const spaceId = memberData.space_id;
    const closeDay = (memberData.spaces as unknown as { statement_close_day: number }).statement_close_day;
    setStatementCloseDay(closeDay);

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    if (useStatementCycle) {
      // Statement cycle: closeDay of previous month to closeDay of current month
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, closeDay);
      endDate = new Date(now.getFullYear(), now.getMonth(), closeDay);
      // If we haven't reached closeDay this month, endDate is this month's closeDay
      if (now.getDate() < closeDay) {
        endDate = new Date(now.getFullYear(), now.getMonth(), closeDay);
      }
    } else {
      // Calendar month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    const startStr = startDate.toISOString().split("T")[0];
    const endStr = endDate.toISOString().split("T")[0];

    // Fetch transactions
    const { data: txns } = await supabase
      .from("transactions")
      .select("*")
      .eq("space_id", spaceId)
      .gte("transaction_date", startStr)
      .lte("transaction_date", endStr)
      .eq("transaction_type", "expense")
      .eq("is_reimbursed", false)
      .order("transaction_date", { ascending: false });

    // Fetch categories
    const { data: cats } = await supabase
      .from("categories")
      .select("*")
      .eq("space_id", spaceId)
      .order("sort_order");

    // Fetch payment methods
    const { data: pms } = await supabase
      .from("payment_methods")
      .select("*")
      .eq("space_id", spaceId);

    if (txns) {
      setTransactions(txns);

      // Calculate total
      const total = txns.reduce((sum, t) => sum + Number(t.amount), 0);
      setTotalSpending(total);

      // Calculate category breakdown
      const catMap = new Map<string, { name: string; icon: string | null; total: number }>();
      for (const cat of cats || []) {
        catMap.set(cat.id, { name: cat.name, icon: cat.icon, total: 0 });
      }
      for (const txn of txns) {
        if (txn.category_id) {
          const entry = catMap.get(txn.category_id);
          if (entry) {
            entry.total += Number(txn.amount);
          }
        }
      }
      const breakdown: CategoryTotal[] = Array.from(catMap.entries())
        .filter(([, v]) => v.total > 0)
        .map(([id, v]) => ({
          category_id: id,
          category_name: v.name,
          category_icon: v.icon,
          total: v.total,
        }))
        .sort((a, b) => b.total - a.total);

      setCategoryTotals(breakdown);
    }

    if (cats) setCategories(cats);
    if (pms) setPaymentMethods(pms);
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  }

  const formatAmount = (amount: number) =>
    `RM ${amount.toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-MY", {
      day: "numeric",
      month: "short",
    });
  };

  const ownershipLabels: Record<string, string> = {
    self: "Self",
    shared: "Family",
    gift_spouse: "Gift / Treat",
    paid_for_others: "Reimbursable",
  };

  // Derive unique categories, payment methods, and ownerships from current transactions
  const usedCategoryIds = [...new Set(transactions.map((t) => t.category_id).filter(Boolean))] as string[];
  const usedPmIds = [...new Set(transactions.map((t) => t.payment_method_id).filter(Boolean))] as string[];
  const usedOwnerships = [...new Set(transactions.map((t) => t.expense_ownership).filter(Boolean))];
  const usedCategories = categories.filter((c) => usedCategoryIds.includes(c.id));
  const usedPaymentMethods = paymentMethods.filter((p) => usedPmIds.includes(p.id));

  // Apply filters
  const filteredTransactions = transactions.filter((txn) => {
    if (filterCategory && txn.category_id !== filterCategory) return false;
    if (filterPaymentMethod && txn.payment_method_id !== filterPaymentMethod) return false;
    if (filterOwnership && txn.expense_ownership !== filterOwnership) return false;
    return true;
  });

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
    <main className="mx-auto w-full max-w-lg px-4 pt-4">
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

      {/* Total Spending */}
      <div className="mb-8 text-center">
        <p className="text-sm text-muted-foreground">Total Spending</p>
        <p className="text-4xl font-bold tracking-tight font-mono">
          {formatAmount(totalSpending)}
        </p>
      </div>

      {/* Category Breakdown */}
      {categoryTotals.length > 0 && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">
              By Category
            </h2>
            <div className="space-y-3">
              {categoryTotals.map((cat) => (
                <div key={cat.category_id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span>{cat.category_icon}</span>
                      {cat.category_name}
                    </span>
                      <span className="font-mono text-sm font-medium">
                      {formatAmount(cat.total)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-foreground/80"
                      style={{
                        width: `${Math.min(
                          (cat.total / totalSpending) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions by Date */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          Transactions
        </h2>
        <Link
          href="/transactions"
          transitionTypes={["nav-forward"]}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          View All
        </Link>
      </div>

      {/* Filter pills */}
      {(usedCategories.length > 0 || usedPaymentMethods.length > 0) && (
        <div className="mb-4 space-y-2">
          {usedCategories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {usedCategories.map((cat) => (
                <button
                  key={cat.id}
                  className={cn(
                    "rounded-[4px] border px-3 py-1.5 text-xs font-medium transition-colors",
                    filterCategory === cat.id
                      ? "border-foreground bg-foreground text-primary-foreground"
                      : "border-input bg-background text-muted-foreground hover:bg-accent"
                  )}
                  onClick={() =>
                    setFilterCategory(filterCategory === cat.id ? null : cat.id)
                  }
                >
                  {cat.icon} {cat.name}
                </button>
              ))}
            </div>
          )}
          {usedPaymentMethods.length > 0 && (
            <div className="flex flex-wrap gap-2">
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
            <div className="flex flex-wrap gap-2">
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

      {filteredTransactions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">
              No transactions this period.
            </p>
            <p className="text-xs text-muted-foreground">
              Tap + to add your first expense.
            </p>
          </CardContent>
        </Card>
      ) : (
        (() => {
          // Group by date (limited to 5)
          const limited = filteredTransactions.slice(0, 5);
          const grouped = limited.reduce<Record<string, typeof limited>>((acc, txn) => {
            const dateKey = txn.transaction_date;
            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(txn);
            return acc;
          }, {});

          const formatDateHeader = (dateStr: string) => {
            const d = new Date(dateStr + "T00:00:00");
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const txnDate = new Date(dateStr + "T00:00:00");

            if (txnDate.getTime() === today.getTime()) return "Today";
            if (txnDate.getTime() === yesterday.getTime()) return "Yesterday";
            return d.toLocaleDateString("en-MY", {
              weekday: "short",
              day: "numeric",
              month: "short",
            });
          };

          return (
            <div className="space-y-4">
              {Object.entries(grouped).map(([dateKey, txns]) => {
                const dayTotal = txns.reduce((sum, t) => sum + Number(t.amount), 0);
                return (
                  <div key={dateKey}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        {formatDateHeader(dateKey)}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatAmount(dayTotal)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {txns.map((txn) => {
                        const cat = categories.find((c) => c.id === txn.category_id);
                        const pm = paymentMethods.find((p) => p.id === txn.payment_method_id);
                        return (
                          <Link key={txn.id} href={`/transactions/${txn.id}`}>
                            <Card className="relative overflow-hidden transition-colors hover:bg-muted/50">
                              <div
                                className="absolute left-0 top-0 h-full w-1.5"
                                style={{ backgroundColor: pm?.color || "transparent" }}
                              />
                              <CardContent className="flex items-center justify-between py-3 pl-5 pr-3">
                                <div className="flex items-center gap-3">
                                  <span className="text-lg">{cat?.icon || "💰"}</span>
                                  <div>
                                    <p className="text-sm font-medium">
                                      {txn.merchant_name}
                                    </p>
                                    <div className="flex items-center gap-1.5">
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
          );
        })()
      )}
    </main>
    </ViewTransition>
  );
}
