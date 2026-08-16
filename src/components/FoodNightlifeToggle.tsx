"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function FoodNightlifeToggle() {
  const pathname = usePathname() || "";
  const isFood = pathname.startsWith("/food");
  return (
    <nav aria-label="Choose guide" className="flex shrink-0 overflow-hidden rounded-xl border border-neutral-700 p-0.5 text-sm">
      <Link href="/" aria-current={!isFood ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-lg px-3 ${!isFood ? "bg-yellow-400 font-semibold text-black" : "hover:bg-neutral-800"}`}>
        Nightlife
      </Link>
      <Link href="/food" aria-current={isFood ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-lg px-3 ${isFood ? "bg-yellow-400 font-semibold text-black" : "hover:bg-neutral-800"}`}>
        Food
      </Link>
    </nav>
  );
}
