"use client";

import { useState, useEffect } from "react";
import { ViewTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

type Category = Database["public"]["Tables"]["categories"]["Row"];
type Subcategory = Database["public"]["Tables"]["subcategories"]["Row"];
type PaymentMethod = Database["public"]["Tables"]["payment_methods"]["Row"];

const ownershipOptions = [
  { value: "self", label: "Self" },
  { value: "shared", label: "Family" },
  { value: "gift_spouse", label: "Gift / Treat" },
  { value: "paid_for_others", label: "Reimbursable" },
] as const;

export default function AddExpensePage() {
  const router = useRouter();
  const supabase = createClient();

  const [amount, setAmount] = useState("0.00");
  const [merchantName, setMerchantName] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [ownership, setOwnership] = useState<string>("self");
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [transactionTime, setTransactionTime] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [step, setStep] = useState<"amount" | "datetime" | "payment" | "category" | "subcategory" | "details">("amount");

  async function loadData() {
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
    setSpaceId(memberData.space_id);

    const [cats, pms] = await Promise.all([
      supabase
        .from("categories")
        .select("*")
        .eq("space_id", memberData.space_id)
        .order("sort_order"),
      supabase
        .from("payment_methods")
        .select("*")
        .eq("space_id", memberData.space_id)
        .eq("is_active", true)
        .order("name"),
    ]);

    if (cats.data) setCategories(cats.data);
    if (pms.data) setPaymentMethods(pms.data);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function loadSubcategories(catId: string) {
    const { data } = await supabase
      .from("subcategories")
      .select("*")
      .eq("category_id", catId)
      .order("sort_order");

    setSubcategories(data || []);
  }

  function handleAmountInput(digit: string) {
    setAmount((prev) => {
      const clean = prev.replace(".", "");
      const newClean = clean + digit;
      const padded = newClean.padStart(3, "0");
      const intPart = padded.slice(0, -2);
      const decPart = padded.slice(-2);
      return `${parseInt(intPart)}.${decPart}`;
    });
  }

  function handleAmountDelete() {
    setAmount((prev) => {
      const clean = prev.replace(".", "");
      if (clean.length <= 1) return "0.00";
      const newClean = clean.slice(0, -1);
      const padded = newClean.padStart(3, "0");
      const intPart = padded.slice(0, -2);
      const decPart = padded.slice(-2);
      return `${parseInt(intPart)}.${decPart}`;
    });
  }

  function nextStep() {
    if (step === "category" && categoryId) {
      loadSubcategories(categoryId);
      setStep("subcategory");
      return;
    }
    if (step === "subcategory") {
      setStep("details");
      return;
    }
    const steps = ["amount", "datetime", "payment", "category", "details"] as const;
    const idx = steps.indexOf(step as typeof steps[number]);
    if (idx < steps.length - 1) {
      setStep(steps[idx + 1] as typeof steps[number]);
    }
  }

  function prevStep() {
    if (step === "subcategory") {
      setStep("category");
      return;
    }
    const steps = ["amount", "datetime", "payment", "category", "details"] as const;
    const idx = steps.indexOf(step as typeof steps[number]);
    if (idx > 0) {
      setStep(steps[idx - 1] as typeof steps[number]);
    } else {
      router.back();
    }
  }

  async function handleSave() {
    if (!spaceId || parseFloat(amount) === 0) return;
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const selectedPm = paymentMethods.find(p => p.id === paymentMethodId);
    const spendAmount = parseFloat(amount);

    const { error } = await supabase.from("transactions").insert({
      space_id: spaceId,
      user_id: user.id,
      amount: spendAmount,
      merchant_name: merchantName.trim() || "Unnamed",
      transaction_date: transactionDate,
      transaction_time: transactionTime || null,
      category_id: categoryId,
      subcategory_id: subcategories.length > 0 ? subcategoryId : null,
      payment_method_id: paymentMethodId,
      expense_ownership: ownership as Database["public"]["Enums"]["expense_ownership"],
      transaction_type: "expense",
    });

    if (error) {
      setSaving(false);
      return;
    }

    if (selectedPm?.type === "ewallet") {
      const currentBalance = Number(selectedPm.balance) || 0;
      const newBalance = currentBalance - spendAmount;

      await supabase
        .from("payment_methods")
        .update({ balance: newBalance })
        .eq("id", selectedPm.id);

      if (selectedPm.auto_reload_enabled && newBalance < Number(selectedPm.reload_threshold)) {
        const linkedPmId = selectedPm.linked_payment_method_id;
        if (linkedPmId) {
          const reloadAmount = Number(selectedPm.reload_amount) || 20;
          const feeRate = Number(selectedPm.fee_rate) || 0.01;
          const feeAmount = Math.round(reloadAmount * feeRate * 100) / 100;

          const { error: reloadErr1 } = await supabase.from("transactions").insert({
            space_id: spaceId,
            user_id: user.id,
            amount: reloadAmount,
            merchant_name: "Auto-reload",
            transaction_date: transactionDate,
            transaction_time: transactionTime || null,
            category_id: null,
            payment_method_id: linkedPmId,
            expense_ownership: "self",
            transaction_type: "transfer",
          });

          const { error: reloadErr2 } = await supabase.from("transactions").insert({
            space_id: spaceId,
            user_id: user.id,
            amount: feeAmount,
            merchant_name: "Reload fee",
            transaction_date: transactionDate,
            transaction_time: transactionTime || null,
            category_id: null,
            payment_method_id: linkedPmId,
            expense_ownership: "self",
            transaction_type: "expense",
          });

          if (!reloadErr1 && !reloadErr2) {
            const updatedBalance = newBalance + reloadAmount;
            await supabase
              .from("payment_methods")
              .update({ balance: updatedBalance })
              .eq("id", selectedPm.id);
          }
        }
      }
    }

    router.push("/");
    router.refresh();
    setSaving(false);
  }

  const allSteps = subcategories.length > 0
    ? ["amount", "datetime", "payment", "category", "subcategory", "details"]
    : ["amount", "datetime", "payment", "category", "details"];
  const stepIndex = allSteps.indexOf(step);

  const pillClass = cn(
    "rounded-[4px] border border-input bg-background px-4 py-2.5 text-sm font-medium transition-colors",
    "hover:bg-accent hover:text-accent-foreground"
  );

  const pillActiveClass = cn(
    "rounded-[4px] border border-foreground bg-foreground px-4 py-2.5 text-sm font-medium transition-colors text-primary-foreground"
  );

  const keypad = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    [".", "0", "⌫"],
  ];

  const selectedPm = paymentMethods.find(p => p.id === paymentMethodId);

  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
    <main className="mx-auto flex h-[calc(100vh-3rem-4rem)] w-full max-w-lg flex-col px-4 py-4 pb-20 overflow-hidden">
      <div className="mb-4 flex items-center justify-center gap-2">
        {allSteps.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i <= stepIndex ? "w-6 bg-foreground" : "w-1.5 bg-muted"
            )}
          />
        ))}
      </div>

      {step === "amount" && (
        <>
          <div className="flex flex-col items-center mb-4">
            <p className="mb-2 text-sm text-muted-foreground">Amount</p>
            <p className="text-6xl font-bold tracking-tight font-mono">RM {amount}</p>
            {selectedPm?.type === "ewallet" && (
              <p className="mt-2 text-xs text-muted-foreground">
                Balance: RM {Number(selectedPm.balance || 0).toFixed(2)}
              </p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 pb-4">
            {keypad.flat().map((key) => (
              <Button
                key={key}
                variant="outline"
                className="h-16 text-lg font-medium"
                onClick={() => {
                  if (key === "⌫") handleAmountDelete();
                  else handleAmountInput(key);
                }}
              >
                {key}
              </Button>
            ))}
          </div>
        </>
      )}

      {step === "datetime" && (
        <div className="flex flex-col items-center justify-center gap-4 flex-1">
          <div className="w-full max-w-xs space-y-3">
            <div>
              <label className="mb-2 block text-sm text-muted-foreground">
                Date
              </label>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="flex h-12 w-full rounded-[4px] border border-input bg-background px-3 py-2 text-base"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-muted-foreground">
                Time <span className="text-xs">(optional)</span>
              </label>
              <input
                type="time"
                value={transactionTime}
                onChange={(e) => setTransactionTime(e.target.value)}
                className="flex h-12 w-full rounded-[4px] border border-input bg-background px-3 py-2 text-base"
              />
            </div>
          </div>
        </div>
      )}

      {step === "payment" && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="mb-4 text-sm text-muted-foreground">
            How did you pay?
          </p>
          <div className={cn(
            "grid gap-2 w-full max-w-sm",
            paymentMethods.length <= 3 ? "grid-cols-3" : "grid-cols-3"
          )}>
            {paymentMethods.map((pm) => (
              <button
                key={pm.id}
                className={cn(
                  paymentMethodId === pm.id ? pillActiveClass : pillClass,
                  "flex flex-col items-center gap-0.5 py-2"
                )}
                onClick={() =>
                  setPaymentMethodId(
                    paymentMethodId === pm.id ? null : pm.id
                  )
                }
              >
                <span className={cn(
                  paymentMethods.length <= 9 ? "text-2xl" : "text-base"
                )}>
                  {pm.type === "credit_card" && "💳"}
                  {pm.type === "ewallet" && "📱"}
                  {pm.type === "cash" && "💵"}
                </span>
                <span>{pm.name}</span>
                {pm.type === "ewallet" && (
                  <span className="text-[10px] text-muted-foreground">
                    RM {Number(pm.balance || 0).toFixed(2)}
                  </span>
                )}
              </button>
            ))}
            {paymentMethods.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-3 text-center">
                No payment methods yet. Add one in Settings.
              </p>
            )}
          </div>
        </div>
      )}

      {step === "category" && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="mb-4 text-sm text-muted-foreground">
            What category?
          </p>
          <div className="grid grid-cols-3 gap-2 w-full max-w-sm">
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={cn(
                  categoryId === cat.id ? pillActiveClass : pillClass,
                  "flex flex-col items-center gap-0.5 py-2"
                )}
                onClick={() => {
                  setCategoryId(categoryId === cat.id ? null : cat.id);
                  setSubcategoryId(null);
                }}
              >
                <span className="text-lg">{cat.icon}</span>
                <span className="text-[10px] leading-tight">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "subcategory" && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="mb-2 text-sm text-muted-foreground">
            {categories.find(c => c.id === categoryId)?.icon}{" "}
            {categories.find(c => c.id === categoryId)?.name}
          </p>
          <p className="mb-4 text-sm text-muted-foreground">
            Pick a subcategory <span className="text-xs">(optional)</span>
          </p>
          <div className="grid grid-cols-3 gap-2 w-full max-w-sm">
            {subcategories.map((sub) => (
              <button
                key={sub.id}
                className={cn(
                  subcategoryId === sub.id ? pillActiveClass : pillClass,
                  "flex flex-col items-center gap-0.5 py-2"
                )}
                onClick={() =>
                  setSubcategoryId(subcategoryId === sub.id ? null : sub.id)
                }
              >
                <span className="text-lg">{sub.icon || "📌"}</span>
                <span className="text-[10px] leading-tight">{sub.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "details" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-full max-w-xs">
            <label className="mb-2 block text-sm text-muted-foreground">
              Where did you spend?
            </label>
            <Input
              placeholder="Merchant name"
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              className="h-12 text-base"
              autoFocus
            />
          </div>
          <div className="w-full max-w-xs">
            <label className="mb-2 block text-sm text-muted-foreground">
              Who is this for?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ownershipOptions.map((opt) => (
                <button
                  key={opt.value}
                  className={cn(
                    ownership === opt.value ? pillActiveClass : pillClass,
                    "text-center"
                  )}
                  onClick={() => setOwnership(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-20 left-0 right-0 z-40 border-t bg-background">
        <div className="mx-auto flex max-w-lg gap-2 px-4 py-2">
          <Button
            variant="outline"
            className="flex-1 h-12"
            onClick={prevStep}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          {step === "details" ? (
            <Button
              className="flex-1 h-12"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                "Saving..."
              ) : (
                <>
                  Save
                  <Check className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          ) : (
            <Button
              className="flex-1 h-12"
              onClick={nextStep}
              disabled={step === "amount" && parseFloat(amount) === 0}
            >
              {step === "subcategory" ? "Skip" : "Next"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </main>
    </ViewTransition>
  );
}
