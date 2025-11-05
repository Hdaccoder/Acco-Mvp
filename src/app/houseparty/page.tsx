// src/app/houseparty/page.tsx
export const dynamicMode = 'force-dynamic';  // 👈 renamed to avoid conflict
export const revalidate = 0;

import dynamicImport from 'next/dynamic';     // 👈 alias import

// Load the interactive client component only on the client
const HousepartyClient = dynamicImport(() => import('./HousepartyClient'), {
  ssr: false, // ⬅ prevents "window is not defined" during build/SSR
});

export default function Page() {
  return <HousepartyClient />;
}
