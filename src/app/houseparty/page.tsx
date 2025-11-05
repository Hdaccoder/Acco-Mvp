// src/app/houseparty/page.tsx
export const dynamic = 'force-dynamic'; // ✅ valid Next.js page export
export const revalidate = 0;

import nextDynamic from 'next/dynamic';

// Load the interactive client component only on the client
const HousepartyClient = nextDynamic(() => import('./HousepartyClient'), {
  ssr: false, // prevents "window is not defined" during build/SSR
});

export default function Page() {
  return <HousepartyClient />;
}
