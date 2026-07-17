"use client";

import { useState, useEffect, use } from "react";
import { ViewTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type Category = Database["public"]["Tables"]["categories"]["Row"];
type PaymentMethod = Database["public"]["Tables"]["payment_methods"]["Row"];
type Subcategory = Database["public"]["Tables"]["subcategories"]["Row"];

const ownershipLabels: Record<string, string> = {
  self: "Self",
  shared: "Family",
  gift_spouse: "Gift / Treat",
  paid_for_others: "Reimbursable",
};

export default function CategoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = createClient();
  const [category, setCategory] = useState<Category | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [useStatementCycle, setUseStatementCycle] = useState(true);
  const [filterOwnership, setFilterOwnership] = useState<string | null>(null);
  const [filterSubcategory, setFilterSubcategory] = useState<string | null>(null);

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

      const { data: cat } = await supabase
        .from("categories")
        .select("*")
        .eq("id", id)
        .single();

      if (cat) setCategory(cat);

      const [{ data: txns }, { data: pms }, { data: subcats }] = await Promise.all([
        supabase
          .from("transactions")
          .select("*")
          .eq("space_id", spaceId)
          .eq("category_id", id)
          .eq("is_reimbursed", false)
          .gte("transaction_date", startStr)
          .lte("transaction_date", endStr)
          .order("transaction_date", { ascending: false }),
        supabase
          .from("payment_methods")
          .select("*")
          .eq("space_id", spaceId),
        supabase
          .from("subcategories")
          .select("*")
          .eq("space_id", spaceId)
          .eq("category_id", id)
          .order("sort_order"),
      ]);

      if (txns) setTransactions(txns);
      if (pms) setPaymentMethods(pms);
      if (subcats) setSubcategories(subcats);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    setFilterSubcategory(null);
  }, [id, useStatementCycle]);

  const formatAmount = (amount: number) =>
    `RM ${amount.toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const pmMap = new Map(paymentMethods.map(p => [p.id, p]));

  const ccTransactions = transactions.filter(t => {
    const pm = pmMap.get(t.payment_method_id || "");
    return pm?.type === "credit_card";
  });

  const ewalletTransactions = transactions.filter(t => {
    const pm = pmMap.get(t.payment_method_id || "");
    return pm?.type === "ewallet" && t.transaction_type === "expense";
  });

  const filteredCcTransactions = filterOwnership
    ? ccTransactions.filter((t) => t.expense_ownership === filterOwnership)
    : ccTransactions;

  const filteredEwalletTransactions = filterOwnership
    ? ewalletTransactions.filter((t) => t.expense_ownership === filterOwnership)
    : ewalletTransactions;

  const finalCcTransactions = filterSubcategory
    ? filteredCcTransactions.filter((t) => t.subcategory_id === filterSubcategory)
    : filteredCcTransactions;

  const finalEwalletTransactions = filterSubcategory
    ? filteredEwalletTransactions.filter((t) => t.subcategory_id === filterSubcategory)
    : filteredEwalletTransactions;

  const totalToPay = finalCcTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
  const ewalletTotal = finalEwalletTransactions.reduce((sum, t) => sum + Number(t.amount), 0);

  const usedOwnerships = [...new Set(transactions.map((t) => t.expense_ownership).filter(Boolean))];

  const groupedCc = finalCcTransactions.reduce<Record<string, Transaction[]>>((acc, txn) => {
    const dateKey = txn.transaction_date;
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(txn);
    return acc;
  }, {});

  const groupedEwallet = finalEwalletTransactions.reduce<Record<string, Transaction[]>>((acc, txn) => {
    const dateKey = txn.transaction_date;
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(txn);
    return acc;
  }, {});

  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
    <main className="mx-auto w-full max-w-lg px-4 py-4 pb-4">
      <div className="mb-6 text-center">
        <span className="text-3xl">{category?.icon || "💰"}</span>
        <h1 className="mt-2 text-lg font-medium">{category?.name || "Category"}</h1>
        <p className="font-mono text-2xl font-bold tracking-tight">
          {formatAmount(totalToPay)}
        </p>
        <p className="text-xs text-muted-foreground">
          {finalCcTransactions.length} CC transaction{finalCcTransactions.length !== 1 ? "s" : ""}
          {ewalletTotal > 0 && ` · ${finalEwalletTransactions.length} eWallet`}
        </p>
      </div>

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

      {usedOwnerships.length > 1 && (
        <div className="mx-auto mb-4 grid w-2/3 grid-cols-2 gap-2">
          {usedOwnerships.map((o) => (
            <button
              key={o}
              className={cn(
                "rounded-[4px] border px-3 py-1.5 text-xs font-medium transition-colors",
                filterOwnership === o
                  ? "border-foreground bg-foreground text-primary-foreground"
                  : "border-input bg-background text-muted-foreground hover:bg-accent"
              )}
              onClick={() => setFilterOwnership(filterOwnership === o ? null : o)}
            >
              {ownershipLabels[o] || o}
            </button>
          ))}
        </div>
      )}

      {subcategories.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 justify-center">
          <button
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filterSubcategory === null
                ? "border-foreground bg-foreground text-primary-foreground"
                : "border-input bg-background text-muted-foreground hover:bg-accent"
            )}
            onClick={() => setFilterSubcategory(null)}
          >
            All
          </button>
          {subcategories.map((sub) => (
            <button
              key={sub.id}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filterSubcategory === sub.id
                  ? "border-foreground bg-foreground text-primary-foreground"
                  : "border-input bg-background text-muted-foreground hover:bg-accent"
              )}
              onClick={() => setFilterSubcategory(filterSubcategory === sub.id ? null : sub.id)}
            >
              {sub.name}
            </button>
          ))}
        </div>
      )}

      {ewalletTotal > 0 && (
        <div className="mb-4">
          <Card className="border-dashed">
            <CardContent className="flex items-center justify-between py-3 pl-4 pr-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">📱</span>
                <span className="text-sm font-medium">eWallet Spending</span>
              </div>
              <span className="font-mono text-sm font-semibold">
                {formatAmount(ewalletTotal)}
              </span>
            </CardContent>
          </Card>
        </div>
      )}

      {Object.keys(groupedCc).length === 0 && Object.keys(groupedEwallet).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">No transactions.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedCc).map(([dateKey, txns]) => {
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
                    const pm = paymentMethods.find((p) => p.id === txn.payment_method_id);
                    const sub = subcategories.find((s) => s.id === txn.subcategory_id);
                    return (
                      <Link key={txn.id} href={`/transactions/${txn.id}`}>
                        <Card className="relative overflow-hidden transition-colors hover:bg-muted/50">
                          <div
                            className="absolute left-0 top-0 h-full w-1.5"
                            style={{ backgroundColor: category?.color || "transparent" }}
                          />
                          <CardContent className="flex items-center justify-between py-3 pl-5 pr-3">
                            <div className="flex items-center gap-3">
                              <div>
                                <p className="text-sm font-medium">
                                  {txn.merchant_name}
                                </p>
                                <div className="flex items-center gap-1.5">
                                  {sub && (
                                    <>
                                      <p className="text-xs text-muted-foreground">
                                        {sub.name}
                                      </p>
                                      <span className="text-xs text-muted-foreground">·</span>
                                    </>
                                  )}
                                  <p className="text-xs text-muted-foreground">
                                    {pm?.name || "Unknown"}
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

          {Object.keys(groupedEwallet).length > 0 && (
            <>
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs">eWallet</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              {Object.entries(groupedEwallet).map(([dateKey, txns]) => {
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
                    const pm = paymentMethods.find((p) => p.id === txn.payment_method_id);
                    const sub = subcategories.find((s) => s.id === txn.subcategory_id);
                    return (
                      <Link key={txn.id} href={`/transactions/${txn.id}`}>
                        <Card className="relative overflow-hidden transition-colors hover:bg-muted/50">
                          <div
                            className="absolute left-0 top-0 h-full w-1.5"
                            style={{ backgroundColor: category?.color || "transparent" }}
                          />
                          <CardContent className="flex items-center justify-between py-3 pl-5 pr-3">
                            <div className="flex items-center gap-3">
                              <div>
                                <p className="text-sm font-medium">
                                  {txn.merchant_name}
                                </p>
                                <div className="flex items-center gap-1.5">
                                  {sub && (
                                    <>
                                      <p className="text-xs text-muted-foreground">
                                        {sub.name}
                                      </p>
                                      <span className="text-xs text-muted-foreground">·</span>
                                    </>
                                  )}
                                  <p className="text-xs text-muted-foreground">
                                    {pm?.name || "Unknown"}
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
            </>
          )}
        </div>
      )}
    </main>
    </ViewTransition>
  );
}
