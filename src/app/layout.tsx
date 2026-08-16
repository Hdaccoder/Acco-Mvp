import "./globals.css";
import FoodNightlifeToggle from "@/components/FoodNightlifeToggle";
import NavLinks from "@/components/NavLinks";
import TopBrandLink from "@/components/TopBrandLink";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import Script from "next/script";

export const metadata: Metadata = {
  title: { default: "Acco — Popular near you", template: "%s · Acco" },
  description: "See what is popular near you now and what is forecast to be busy later.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = { themeColor: "#0a0a0a", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const adsPublisher = process.env.NEXT_PUBLIC_ADSENSE_PUB || "";
  const leftSlot = process.env.NEXT_PUBLIC_ADSENSE_LEFT_SLOT || "";
  const rightSlot = process.env.NEXT_PUBLIC_ADSENSE_RIGHT_SLOT || "";
  const showAds = Boolean(adsPublisher && adsPublisher !== "ca-pub-0000000000000000");
  const issuesHref = `mailto:paul.is.in.power@gmail.com?subject=${encodeURIComponent("Acco issue")}&body=${encodeURIComponent("Describe the problem:\n\nSteps to reproduce:\n\nWhat I expected:\n\nDevice and browser:\n")}`;

  return (
    <html lang="en">
      <head>
        {showAds && <Script id="adsbygoogle-loader" src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsPublisher}`} strategy="lazyOnload" async crossOrigin="anonymous" />}
      </head>
      <body className="min-h-screen bg-neutral-950 text-white antialiased">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <header className="sticky top-0 z-20 border-b border-neutral-900 bg-neutral-950/90 backdrop-blur">
          <div className="mx-auto max-w-4xl px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2 sm:justify-between">
                <TopBrandLink />
                <FoodNightlifeToggle />
              </div>
              <nav aria-label="Primary navigation" className="flex flex-wrap items-center gap-2 text-sm text-neutral-300 sm:justify-end sm:gap-4">
                <NavLinks issuesHref={issuesHref} />
              </nav>
            </div>
          </div>
        </header>

        {showAds && (
          <>
            <aside aria-label="Advertisement" className="fixed left-4 top-24 z-10 hidden h-[600px] w-[160px] xl:block">
              <ins className="adsbygoogle block h-[600px] w-[160px]" data-ad-client={adsPublisher} data-ad-slot={leftSlot} data-ad-format="vertical" data-full-width-responsive="false" />
            </aside>
            <aside aria-label="Advertisement" className="fixed right-4 top-24 z-10 hidden h-[600px] w-[160px] xl:block">
              <ins className="adsbygoogle block h-[600px] w-[160px]" data-ad-client={adsPublisher} data-ad-slot={rightSlot} data-ad-format="vertical" data-full-width-responsive="false" />
            </aside>
          </>
        )}

        <main id="main-content" tabIndex={-1} className="mx-auto min-h-[70vh] max-w-4xl px-4 py-6 sm:py-8">{children}</main>
        <footer className="border-t border-neutral-900 text-xs text-neutral-400">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-5">
            <span>© {new Date().getFullYear()} Acco</span>
            <div className="flex items-center gap-4">
              <a href="/privacy" className="hover:text-white">Privacy</a>
              <a href="/terms" className="hover:text-white">Terms</a>
              <a href={issuesHref} className="hover:text-white">Report an issue</a>
            </div>
          </div>
        </footer>
        <ServiceWorkerRegistration />
        <Analytics />
      </body>
    </html>
  );
}
