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

interface CategoryTotal {
  category_id: string;
  category_name: string;
  category_icon: string | null;
  total: number;
}

export default function DashboardPage() {
  const [ccTransactions, setCcTransactions] = useState<Transaction[]>([]);
  const [ewalletTransactions, setEwalletTransactions] = useState<Transaction[]>([]);
  const [categoryTotals, setCategoryTotals] = useState<CategoryTotal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [useStatementCycle, setUseStatementCycle] = useState(true);
  const [totalToPay, setTotalToPay] = useState(0);
  const [ewalletSpending, setEwalletSpending] = useState(0);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  async function loadData() {
    setLoading(true);

    try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: memberRows } = await supabase
      .from("space_members")
      .select("space_id, spaces!inner(statement_close_day)")
      .eq("user_id", user.id)
      .limit(1);

    let memberData = memberRows && memberRows.length > 0 ? memberRows[0] : null;

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
      .select("*")
      .eq("space_id", spaceId)
      .gte("transaction_date", startStr)
      .lte("transaction_date", endStr)
      .eq("is_reimbursed", false)
      .order("transaction_date", { ascending: false });

    const { data: cats } = await supabase
      .from("categories")
      .select("*")
      .eq("space_id", spaceId)
      .order("sort_order");

    const { data: pms } = await supabase
      .from("payment_methods")
      .select("*")
      .eq("space_id", spaceId);

    if (txns && pms) {
      const pmMap = new Map(pms.map(p => [p.id, p]));
      const ccTxns = txns.filter(t => {
        const pm = pmMap.get(t.payment_method_id || "");
        return pm?.type === "credit_card";
      });
      const ewalletTxns = txns.filter(t => {
        const pm = pmMap.get(t.payment_method_id || "");
        return pm?.type === "ewallet";
      });

      setCcTransactions(ccTxns);
      setEwalletTransactions(ewalletTxns);

      const ccTotal = ccTxns.reduce((sum, t) => sum + Number(t.amount), 0);
      setTotalToPay(ccTotal);

      const ewalletTotal = ewalletTxns
        .filter(t => t.transaction_type === "expense")
        .reduce((sum, t) => sum + Number(t.amount), 0);
      setEwalletSpending(ewalletTotal);

      const catMap = new Map<string, { name: string; icon: string | null; total: number }>();
      for (const cat of cats || []) {
        catMap.set(cat.id, { name: cat.name, icon: cat.icon, total: 0 });
      }
      for (const txn of ccTxns) {
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

  useEffect(() => {
    loadData();
  }, [useStatementCycle]);

  const formatAmount = (amount: number) =>
    `RM ${amount.toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const ownershipLabels: Record<string, string> = {
    self: "Self",
    shared: "Family",
    gift_spouse: "Gift / Treat",
    paid_for_others: "Reimbursable",
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const displayTransactions = ewalletTransactions.filter(t => t.transaction_type === "expense");

  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
    <main className="mx-auto w-full max-w-lg px-4 py-4">
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

      {categoryTotals.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {categoryTotals.map((cat) => (
            <Link key={cat.category_id} href={`/category/${cat.category_id}`} transitionTypes={["nav-forward"]}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center justify-between py-2 pl-4 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{cat.category_icon || "💰"}</span>
                    <span className="text-sm font-medium">{cat.category_name}</span>
                  </div>
                  <span className="font-mono text-sm font-semibold">
                    {formatAmount(cat.total)}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-semibold">
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

      {displayTransactions.length === 0 && ccTransactions.length === 0 ? (
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
          const allDisplay = [...ccTransactions, ...ewalletTransactions.filter(t => t.transaction_type === "expense")];
          const sorted = allDisplay.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date) || (b.transaction_time || "").localeCompare(a.transaction_time || ""));
          const limited = sorted.slice(0, 5);
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
                                      <p className="text-xs text-muted-foreground">
                                        {cat?.name || "Uncategorized"}
                                      </p>
                                      <span className="text-xs text-muted-foreground">·</span>
                                      <span className="text-xs text-muted-foreground">
                                        {ownershipLabels[txn.expense_ownership] || txn.expense_ownership}
                                      </span>
                                      {pm && (
                                        <>
                                          <span className="text-xs text-muted-foreground">·</span>
                                          <span className="text-xs text-muted-foreground">
                                            {pm.type === "credit_card" ? "💳" : pm.type === "ewallet" ? "📱" : "💵"} {pm.name}
                                          </span>
                                        </>
                                      )}
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
