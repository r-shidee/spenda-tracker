"use client";

import { useState, useEffect, use } from "react";
import { ViewTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
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

export default function CategoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = createClient();
  const [category, setCategory] = useState<Category | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

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

      const { data: cat } = await supabase
        .from("categories")
        .select("*")
        .eq("id", id)
        .single();

      if (cat) setCategory(cat);

      const { data: txns } = await supabase
        .from("transactions")
        .select("*")
        .eq("space_id", spaceId)
        .eq("category_id", id)
        .eq("transaction_type", "expense")
        .eq("is_reimbursed", false)
        .order("transaction_date", { ascending: false });

      if (txns) setTransactions(txns);

      const { data: pms } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("space_id", spaceId);

      if (pms) setPaymentMethods(pms);
    } finally {
      setLoading(false);
    }
  }

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

  const total = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

  // Group by date
  const grouped = transactions.reduce<Record<string, Transaction[]>>((acc, txn) => {
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
    <main className="mx-auto w-full max-w-lg px-4 pt-4 pb-4">
      {/* Header */}
      <div className="mb-6 text-center">
        <span className="text-3xl">{category?.icon || "💰"}</span>
        <h1 className="mt-2 text-lg font-medium">{category?.name || "Category"}</h1>
        <p className="font-mono text-2xl font-bold tracking-tight">
          {formatAmount(total)}
        </p>
        <p className="text-xs text-muted-foreground">
          {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Transactions */}
      {Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">No transactions.</p>
          </CardContent>
        </Card>
      ) : (
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
                              <div>
                                <p className="text-sm font-medium">
                                  {txn.merchant_name}
                                </p>
                                <div className="flex items-center gap-1.5">
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
        </div>
      )}
    </main>
    </ViewTransition>
  );
}
