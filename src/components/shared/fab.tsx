"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

export function FAB() {
  return (
    <Link
      href="/add"
      className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-transform hover:scale-105 active:scale-95 md:right-8"
    >
      <Plus className="h-6 w-6" />
    </Link>
  );
}
