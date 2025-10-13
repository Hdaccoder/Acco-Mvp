import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";

export const metadata = {
  title: "Acco — Tonight in Ormskirk",
  description: "See which bars & clubs are hot tonight based on real votes.",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-white">
        <header className="sticky top-0 z-10 backdrop-blur bg-neutral-950/60 border-b border-neutral-800">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="font-semibold">Acco</Link>
            <Link
              href="/vote"
              className="px-3 py-1.5 rounded-xl border border-yellow-400 text-yellow-300 hover:bg-yellow-400/10"
            >
              Vote
            </Link>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-4 min-h-[calc(100vh-56px)]">
          {children}
        </main>

        {/* Register service worker only in production */}
        {process.env.NODE_ENV === "production" && (
          <script
            dangerouslySetInnerHTML={{
              __html: `if('serviceWorker'in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{});});}`,
            }}
          />
        )}
      </body>
    </html>
  );
}
