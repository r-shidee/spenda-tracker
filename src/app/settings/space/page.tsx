"use client";

import { useState, useEffect } from "react";
import { ViewTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Database } from "@/lib/supabase/types";

type Space = Database["public"]["Tables"]["spaces"]["Row"];

export default function SpaceSettingsPage() {
  const supabase = createClient();
  const [space, setSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState(true);

  const [editingSpaceName, setEditingSpaceName] = useState(false);
  const [spaceName, setSpaceName] = useState("");
  const [editingStatementDay, setEditingStatementDay] = useState(false);
  const [statementDay, setStatementDay] = useState(1);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: memberData } = await supabase
        .from("space_members")
        .select("space_id, spaces!inner(*)")
        .eq("user_id", user.id)
        .single();

      if (!memberData) return;

      const spaceData = memberData.spaces as unknown as Space;
      setSpace(spaceData);
      setSpaceName(spaceData.name);
      setStatementDay(spaceData.statement_close_day);
    } finally {
      setLoading(false);
    }
  }

  async function updateSpaceName() {
    if (!space || !spaceName.trim()) return;
    await supabase.from("spaces").update({ name: spaceName.trim() }).eq("id", space.id);
    setEditingSpaceName(false);
    await loadData();
  }

  async function updateStatementDay() {
    if (!space) return;
    await supabase.from("spaces").update({ statement_close_day: statementDay }).eq("id", space.id);
    setEditingStatementDay(false);
    await loadData();
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
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Space</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Name</span>
            {editingSpaceName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={spaceName}
                  onChange={(e) => setSpaceName(e.target.value)}
                  className="h-8 w-36 text-sm"
                />
                <Button size="sm" onClick={updateSpaceName}>
                  Save
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{spaceName}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setEditingSpaceName(true)}
                >
                  ✏️
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Statement Close Day
            </span>
            {editingStatementDay ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={statementDay}
                  onChange={(e) => setStatementDay(parseInt(e.target.value) || 1)}
                  className="h-8 w-20 text-sm"
                />
                <Button size="sm" onClick={updateStatementDay}>
                  Save
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{statementDay}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setEditingStatementDay(true)}
                >
                  ✏️
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
    </ViewTransition>
  );
}
