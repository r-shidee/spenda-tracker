"use client";

import { useState, useEffect } from "react";
import { ViewTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import type { Database } from "@/lib/supabase/types";

const colorPresets = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
  "#6b7280", "#000000",
];

export default function AddPaymentMethodPage() {
  const router = useRouter();
  const supabase = createClient();
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState<"credit_card" | "ewallet" | "cash">("cash");
  const [color, setColor] = useState("#6366f1");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: memberRows } = await supabase
        .from("space_members")
        .select("space_id")
        .eq("user_id", user.id)
        .limit(1);
      const memberData = memberRows && memberRows.length > 0 ? memberRows[0] : null;
      if (memberData) setSpaceId(memberData.space_id);
    }
    load();
  }, []);

  async function save() {
    if (!spaceId || !name.trim()) return;
    setSaving(true);
    await supabase.from("payment_methods").insert({
      space_id: spaceId,
      name: name.trim(),
      type,
      color,
    });
    setSaving(false);
    router.back();
  }

  const typeIcon = type === "credit_card" ? "💳" : type === "ewallet" ? "📱" : "💵";

  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 py-4 pb-24">

      <div className="mb-4 text-center">
        <span className="text-5xl">{typeIcon}</span>
      </div>

      <Card className="mb-3">
        <CardContent className="space-y-3 p-4">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Name</p>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Maybank Visa"
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Type</p>
            <div className="grid grid-cols-3 gap-2">
              {(["credit_card", "ewallet", "cash"] as const).map((t) => (
                <button
                  key={t}
                  className={`rounded-[4px] border px-3 py-2 text-xs font-medium transition-colors ${
                    type === t
                      ? "border-foreground bg-foreground text-primary-foreground"
                      : "border-input bg-background text-muted-foreground hover:bg-accent"
                  }`}
                  onClick={() => setType(t)}
                >
                  {t === "credit_card" ? "💳 Card" : t === "ewallet" ? "📱 eWallet" : "💵 Cash"}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-3">
        <CardContent className="space-y-3 p-4">
          <p className="text-xs text-muted-foreground">Color</p>
          <div className="flex flex-wrap gap-2">
            {colorPresets.map((c) => (
              <button
                key={c}
                className={`h-8 w-8 rounded-full transition-all ${color === c ? "ring-2 ring-foreground ring-offset-2" : ""}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex-1" />

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background">
        <div className="mx-auto max-w-lg px-4 py-3">
          <Button
            className="w-full"
            onClick={save}
            disabled={saving || !name.trim()}
          >
            Add Payment Method
          </Button>
        </div>
      </div>
    </main>
    </ViewTransition>
  );
}
