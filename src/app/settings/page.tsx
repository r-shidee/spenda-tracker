"use client";

import { useState, useEffect } from "react";
import { ViewTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LogOut, Home, Tag, CreditCard, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Database } from "@/lib/supabase/types";

type Space = Database["public"]["Tables"]["spaces"]["Row"];

const settingsItems = [
  { href: "/settings/space", label: "Space", description: "Name, statement close day", icon: Home },
  { href: "/settings/categories", label: "Categories", description: "Manage expense categories", icon: Tag },
  { href: "/settings/payment-methods", label: "Payment Methods", description: "Cards, wallets, cash", icon: CreditCard },
];

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [space, setSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: memberRows } = await supabase
        .from("space_members")
        .select("space_id, spaces!inner(*)")
        .eq("user_id", user.id)
        .limit(1);

      const memberData = memberRows && memberRows.length > 0 ? memberRows[0] : null;

      if (!memberData) return;
      setSpace(memberData.spaces as unknown as Space);
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

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
      <div className="space-y-2">
        {settingsItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-6">
        <CardContent className="pt-6">
          <Button
            variant="outline"
            className="w-full"
            onClick={signOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </main>
    </ViewTransition>
  );
}
