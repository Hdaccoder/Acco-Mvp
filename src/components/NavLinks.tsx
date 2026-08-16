"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = { issuesHref?: string };

export default function NavLinks({ issuesHref }: Props) {
  const pathname = usePathname() || "";
  const isFood = pathname.startsWith("/food");
  const forecastHref = isFood ? "/food/predictions" : "/predictions";
  const voteHref = isFood ? "/food/vote" : "/vote";
  return (
    <>
      <Link href={forecastHref} aria-current={pathname === forecastHref ? "page" : undefined} className="inline-flex min-h-11 items-center rounded-lg px-3 hover:bg-neutral-800 hover:text-white">Forecast</Link>
      <Link href={voteHref} aria-current={pathname === voteHref ? "page" : undefined} className="inline-flex min-h-11 items-center rounded-lg border border-yellow-400 px-3 font-semibold text-yellow-200 hover:bg-yellow-400 hover:text-black">Vote</Link>
      {issuesHref && <a href={issuesHref} className="hidden min-h-11 items-center rounded-lg px-3 hover:bg-neutral-800 hover:text-white sm:inline-flex">Help</a>}
    </>
  );
}
