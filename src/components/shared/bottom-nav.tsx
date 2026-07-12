"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Receipt, FileDown, Settings, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/add", label: "Add", icon: Plus, isAdd: true },
  { href: "/import", label: "Import", icon: FileDown },
  { href: "/settings", label: "Settings", icon: Settings },
];

const HIDDEN_PATHS = ["/login", "/unauthorized"];

export function BottomNav() {
  const pathname = usePathname();

  if (HIDDEN_PATHS.includes(pathname)) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2">
        {navItems.map((item) => {
          if (item.isAdd) {
            return (
              <Link
                key={item.href}
                href={item.href}
                transitionTypes={["nav-forward"]}
                className="flex h-14 w-14 -mt-4 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-transform hover:scale-105 active:scale-95"
              >
                <Plus className="h-6 w-6" />
              </Link>
            );
          }

          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              transitionTypes={["nav-forward"]}
              className={cn(
                "flex flex-col items-center gap-1 text-xs transition-colors",
                isActive
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
