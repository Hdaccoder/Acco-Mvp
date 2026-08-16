export const dynamic = "force-dynamic";
export const revalidate = 0;

import VoteClient from "./VoteClient";

type PageProps = { searchParams: Promise<{ venue?: string | string[] }> };

export default async function VotePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialVenue = typeof params.venue === "string" ? params.venue : null;
  return <VoteClient initialVenue={initialVenue} />;
}
