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

export default function AddInstallmentPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<string>("name");
  const [name, setName] = useState("");
  const [amountPerMonth, setAmountPerMonth] = useState("0.00");
  const [totalMonths, setTotalMonths] = useState("24");
  const [monthsElapsed, setMonthsElapsed] = useState("0");
  const [billingDay, setBillingDay] = useState("25");
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: memberRows } = await supabase
      .from("space_members")
      .select("space_id, spaces!inner(statement_close_day)")
      .eq("user_id", user.id)
      .limit(1);
    const memberData = memberRows?.[0];
    if (!memberData) return;

    setSpaceId(memberData.space_id);
    const closeDay = (memberData.spaces as unknown as { statement_close_day: number }).statement_close_day;
    setBillingDay(String(closeDay));

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
        .eq("type", "credit_card")
        .order("name"),
    ]);

    if (cats.data) setCategories(cats.data);
    if (pms.data) setPaymentMethods(pms.data);
  }

  useEffect(() => { loadData(); }, []);

  function handleAmountInput(digit: string) {
    setAmountPerMonth((prev) => {
      const clean = prev.replace(".", "");
      const newClean = clean + digit;
      const padded = newClean.padStart(3, "0");
      const intPart = padded.slice(0, -2);
      const decPart = padded.slice(-2);
      return `${parseInt(intPart)}.${decPart}`;
    });
  }

  function handleAmountDelete() {
    setAmountPerMonth((prev) => {
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
    const steps: readonly string[] = ["name", "amount", "total", "elapsed", "billing", "payment", "category"];
    const idx = steps.indexOf(step);
    if (idx < steps.length - 1) {
      setStep(steps[idx + 1] as typeof step);
    }
  }

  function prevStep() {
    const steps: readonly string[] = ["name", "amount", "total", "elapsed", "billing", "payment", "category"];
    const idx = steps.indexOf(step);
    if (idx > 0) {
      setStep(steps[idx - 1] as typeof step);
    } else {
      router.back();
    }
  }

  async function handleSave() {
    if (!spaceId || parseFloat(amountPerMonth) === 0 || !name.trim()) return;
    setSaving(true);

    const { error } = await supabase.from("installments").insert({
      space_id: spaceId,
      name: name.trim(),
      total_months: parseInt(totalMonths) || 24,
      months_elapsed: parseInt(monthsElapsed) || 0,
      amount_per_month: parseFloat(amountPerMonth),
      billing_day: parseInt(billingDay) || 25,
      payment_method_id: paymentMethodId,
      category_id: categoryId,
    });

    if (error) {
      setSaving(false);
      return;
    }

    router.push("/installments");
    router.refresh();
  }

  const allSteps: readonly string[] = ["name", "amount", "total", "elapsed", "billing", "payment", "category"];
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

      {step === "name" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-sm text-muted-foreground">Installment name</p>
          <div className="w-full max-w-xs">
            <Input
              placeholder="e.g. 3Cat - 19/24"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 text-base text-center"
              autoFocus
            />
          </div>
        </div>
      )}

      {step === "amount" && (
        <>
          <div className="flex flex-col items-center mb-4">
            <p className="mb-2 text-sm text-muted-foreground">Amount per month</p>
            <p className="text-6xl font-bold tracking-tight font-mono">RM {amountPerMonth}</p>
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

      {step === "total" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-sm text-muted-foreground">Total months</p>
          <div className="flex items-center gap-6">
            <button
              className="h-14 w-14 rounded-full border text-2xl font-medium"
              onClick={() => setTotalMonths(String(Math.max(1, parseInt(totalMonths) - 1)))}
            >
              −
            </button>
            <p className="text-5xl font-bold font-mono w-24 text-center">{totalMonths}</p>
            <button
              className="h-14 w-14 rounded-full border text-2xl font-medium"
              onClick={() => setTotalMonths(String(parseInt(totalMonths) + 1))}
            >
              +
            </button>
          </div>
        </div>
      )}

      {step === "elapsed" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-sm text-muted-foreground">Months already paid</p>
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            How many months have already been charged?
          </p>
          <div className="flex items-center gap-6">
            <button
              className="h-14 w-14 rounded-full border text-2xl font-medium"
              onClick={() => setMonthsElapsed(String(Math.max(0, parseInt(monthsElapsed) - 1)))}
            >
              −
            </button>
            <p className="text-5xl font-bold font-mono w-24 text-center">{monthsElapsed}</p>
            <button
              className="h-14 w-14 rounded-full border text-2xl font-medium"
              onClick={() => setMonthsElapsed(String(Math.min(parseInt(totalMonths), parseInt(monthsElapsed) + 1)))}
            >
              +
            </button>
          </div>
        </div>
      )}

      {step === "billing" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-sm text-muted-foreground">Billing day of month</p>
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            Day of the month this installment is charged to your CC
          </p>
          <div className="w-full max-w-xs">
            <Input
              type="number"
              min={1}
              max={31}
              value={billingDay}
              onChange={(e) => setBillingDay(e.target.value)}
              className="h-12 text-base text-center text-2xl font-mono"
            />
          </div>
        </div>
      )}

      {step === "payment" && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="mb-4 text-sm text-muted-foreground">
            Which credit card?
          </p>
          <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
            {paymentMethods.map((pm) => (
              <button
                key={pm.id}
                className={cn(
                  paymentMethodId === pm.id ? pillActiveClass : pillClass,
                  "flex flex-col items-center gap-0.5 py-3"
                )}
                onClick={() => setPaymentMethodId(paymentMethodId === pm.id ? null : pm.id)}
              >
                <span className="text-2xl">💳</span>
                <span>{pm.name}</span>
              </button>
            ))}
            {paymentMethods.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-2 text-center">
                No credit cards. Add one in Settings.
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
                onClick={() => setCategoryId(categoryId === cat.id ? null : cat.id)}
              >
                <span className="text-lg">{cat.icon}</span>
                <span className="text-[10px] leading-tight">{cat.name}</span>
              </button>
            ))}
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
          {step === "category" ? (
            <Button
              className="flex-1 h-12"
              onClick={handleSave}
              disabled={saving || !name.trim() || parseFloat(amountPerMonth) === 0}
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
              disabled={step === "amount" && parseFloat(amountPerMonth) === 0}
            >
              {step === "payment" && !paymentMethodId ? "Skip" : step === "category" && !categoryId ? "Skip" : "Next"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </main>
    </ViewTransition>
  );
}
