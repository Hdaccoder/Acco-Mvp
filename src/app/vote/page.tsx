// src/app/vote/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Suspense, use as reactUse } from "react";
import VoteClient from "./VoteClient";

type PageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

export default function Page({ searchParams }: PageProps) {
  // In newer Next versions `searchParams` may be a Promise — unwrap with React.use
  const sp: any = reactUse(searchParams as any);
  const initialVenue = typeof sp?.venue === "string" ? sp.venue : null;

  return (
    <Suspense fallback={<div className="p-4 text-neutral-400">Loading…</div>}>
      <VoteClient initialVenue={initialVenue} />
    </Suspense>
  );
}
