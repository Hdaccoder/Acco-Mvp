"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = { issuesHref?: string };

export default function NavLinks({ issuesHref }: Props) {
  const pathname = usePathname() ?? "";
  const isFood = pathname.startsWith("/food");

  const voteHref = isFood ? "/food/vote" : "/vote";
  const predsHref = isFood ? "/food/predictions" : "/predictions";

  return (
    <>
      <Link href={predsHref} className="hover:text-white">
        Predictions
      </Link>

      <Link
        href={voteHref}
        className="hover:text-black hover:bg-yellow-400/90 border border-yellow-400 text-yellow-300 rounded-lg px-3 py-1"
      >
        Vote
      </Link>

      {issuesHref && (
        <a href={issuesHref} className="hover:text-white">
          Issues?
        </a>
      )}
    </>
  );
}
