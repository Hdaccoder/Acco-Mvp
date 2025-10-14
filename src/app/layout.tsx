// src/app/layout.tsx
import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react"; 

export const metadata: Metadata = {
  title: "Acco — Tonight in Ormskirk",
  description: "See which bars & clubs are hot tonight based on real votes.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Pre-baked "mailto" with a short issue template
  const issuesHref =
    "mailto:paul.is.in.power@gmail.com" +
    "?subject=" +
    encodeURIComponent("Acco issue") +
    "&body=" +
    encodeURIComponent(
      [
        "Describe the problem:",
        "",
        "Steps to reproduce:",
        "",
        "What I expected to happen:",
        "",
        "Device/Browser (optional):",
        "",
        "Screenshot link (optional):",
        "",
      ].join("\n")
    );

  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-white">
        {/* Top nav */}
        <header className="sticky top-0 z-20 backdrop-blur bg-neutral-950/70 border-b border-neutral-900">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="font-semibold tracking-tight">
              Acco
            </Link>

            <nav className="flex items-center gap-4 text-sm text-neutral-300">
              <Link href="/predictions" className="hover:text-white">
                Predictions
              </Link>

              <Link
                href="/vote"
                className="hover:text-black hover:bg-yellow-400/90 border border-yellow-400 text-yellow-300 rounded-lg px-3 py-1"
              >
                Vote
              </Link>

              <Link href="/privacy" className="hover:text-white hidden sm:inline">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-white hidden sm:inline">
                Terms
              </Link>

              <a href={issuesHref} className="hover:text-white">
                Issues?
              </a>
            </nav>
          </div>
        </header>

        {/* Page content */}
        <main className="max-w-3xl mx-auto px-4 py-5">{children}</main>

        {/* Footer (lightweight, optional links duplicated for mobile) */}
        <footer className="border-t border-neutral-900 text-neutral-400 text-xs">
          <div className="max-w-3xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
            <span>© {new Date().getFullYear()} Acco</span>
            <div className="flex items-center gap-4">
              <Link href="/privacy" className="hover:text-white sm:hidden">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-white sm:hidden">
                Terms
              </Link>
              <a href={issuesHref} className="hover:text-white">
                Report an issue
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
