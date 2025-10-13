// src/app/vote/page.tsx
export const dynamic = "force-dynamic"; // keep it dynamic so Next won't try to fully prerender
export const revalidate = 0;

import { Suspense } from "react";
import VoteClient from "./VoteClient";

type PageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

export default function Page({ searchParams }: PageProps) {
  const initialVenue =
    typeof searchParams?.venue === "string" ? searchParams.venue : null;

  return (
    <Suspense fallback={<div className="p-4 text-neutral-400">Loading…</div>}>
      <VoteClient initialVenue={initialVenue} />
    </Suspense>
  );
}
