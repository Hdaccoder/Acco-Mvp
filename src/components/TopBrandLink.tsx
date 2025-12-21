"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function TopBrandLink() {
  const pathname = usePathname() || "/";
  const isFood = pathname.startsWith("/food");
  return (
    <Link href={isFood ? "/food" : "/"} className="font-semibold tracking-tight">
      Acco
    </Link>
  );
}
