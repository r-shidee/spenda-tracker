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
type PaymentMethod = Database["public"]["Tables"]["payment_methods"]["Row"];

const ownershipOptions = [
  { value: "self", label: "Self" },
  { value: "shared", label: "Family" },
  { value: "gift_spouse", label: "Gift / Treat" },
  { value: "paid_for_others", label: "Reimbursable" },
] as const;

const STEPS = ["amount", "datetime", "payment", "category", "details"] as const;
type Step = (typeof STEPS)[number];

export default function AddExpensePage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState("0.00");
  const [merchantName, setMerchantName] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [ownership, setOwnership] = useState<string>("self");
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [transactionTime, setTransactionTime] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: memberData } = await supabase
      .from("space_members")
      .select("space_id")
      .eq("user_id", user.id)
      .maybeSingle();

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
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) {
      setStep(STEPS[idx + 1]);
    }
  }

  function prevStep() {
    const idx = STEPS.indexOf(step);
    if (idx > 0) {
      setStep(STEPS[idx - 1]);
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

    const { error } = await supabase.from("transactions").insert({
      space_id: spaceId,
      user_id: user.id,
      amount: parseFloat(amount),
      merchant_name: merchantName.trim() || "Unnamed",
      transaction_date: transactionDate,
      transaction_time: transactionTime || null,
      category_id: categoryId,
      payment_method_id: paymentMethodId,
      expense_ownership: ownership as Database["public"]["Enums"]["expense_ownership"],
      transaction_type: "expense",
    });

    if (!error) {
      router.push("/");
      router.refresh();
    }
    setSaving(false);
  }

  const stepIndex = STEPS.indexOf(step);

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

  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
    <main className="mx-auto flex h-[calc(100vh-3rem-4rem)] w-full max-w-lg flex-col px-4 pt-4 pb-20 overflow-hidden">
      {/* Step indicator */}
      <div className="mb-4 flex items-center justify-center gap-2">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i <= stepIndex ? "w-6 bg-foreground" : "w-1.5 bg-muted"
            )}
          />
        ))}
      </div>

      {/* Step 1: Amount */}
      {step === "amount" && (
        <>
          <div className="flex flex-col items-center mb-4">
            <p className="mb-2 text-sm text-muted-foreground">Amount</p>
            <p className="text-6xl font-bold tracking-tight font-mono">RM {amount}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 pb-5">
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

      {/* Step 2: Date & Time */}
      {step === "datetime" && (
        <div className="flex flex-col items-center justify-center gap-6 flex-1">
          <div className="w-full max-w-xs space-y-4">
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

      {/* Step 3: Payment Method */}
      {step === "payment" && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="mb-6 text-sm text-muted-foreground">
            How did you pay?
          </p>
          <div className={cn(
            "grid gap-3 w-full max-w-sm",
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

      {/* Step 4: Category */}
      {step === "category" && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="mb-6 text-sm text-muted-foreground">
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
                onClick={() =>
                  setCategoryId(categoryId === cat.id ? null : cat.id)
                }
              >
                <span className="text-lg">{cat.icon}</span>
                <span className="text-[10px] leading-tight">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 5: Merchant + Ownership */}
      {step === "details" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
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
            <label className="mb-3 block text-sm text-muted-foreground">
              Who is this for?
            </label>
            <div className="grid grid-cols-2 gap-3">
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

      {/* Sticky bottom nav bar */}
      <div className="fixed bottom-20 left-0 right-0 z-40 border-t bg-background">
        <div className="mx-auto flex max-w-lg gap-3 px-4 py-3">
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
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </main>
    </ViewTransition>
  );
}
