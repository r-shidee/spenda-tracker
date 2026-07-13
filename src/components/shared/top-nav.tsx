"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

const HIDDEN_PATHS = ["/login", "/unauthorized"];
const SHOW_BACK_PATHS = ["/add", "/settings", "/import"];

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();

  const isHidden = HIDDEN_PATHS.includes(pathname);
  const showBack =
    SHOW_BACK_PATHS.some((p) => pathname.startsWith(p)) ||
    /^\/transactions\/[^/]+$/.test(pathname);

  if (isHidden) return null;

  return (
    <nav
      className="sticky top-0 z-50 bg-black text-white"
      style={{ viewTransitionName: "top-nav" }}
    >
      <div className="mx-auto flex h-12 max-w-lg items-center px-4">
        <div className="flex w-10 items-center">
          {showBack && (
            <button
              onClick={() => router.back()}
              className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-white/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="flex-1 text-center">
          <Link
            href="/"
            className="font-mono text-lg font-bold lowercase tracking-widest"
          >
            spenda
          </Link>
        </div>

        <div className="w-10" />
      </div>
    </nav>
  );
}
