// src/app/layout.tsx
import "./globals.css";
import Link from "next/link";
import FoodNightlifeToggle from "@/components/FoodNightlifeToggle";
import NavLinks from "@/components/NavLinks";
import TopBrandLink from "@/components/TopBrandLink";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Acco — Tonight in Ormskirk",
  // keep generic metadata title; the page itself will display the user's city where available
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
  // ---- AdSense config via envs ----
  const ADS_PUB = process.env.NEXT_PUBLIC_ADSENSE_PUB ?? "";
  const LEFT_SLOT = process.env.NEXT_PUBLIC_ADSENSE_LEFT_SLOT ?? "";
  const RIGHT_SLOT = process.env.NEXT_PUBLIC_ADSENSE_RIGHT_SLOT ?? "";

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
      <head>
        {/* --- Google AdSense loader (site-wide) --- */}
        {ADS_PUB && ADS_PUB !== 'ca-pub-0000000000000000' && (
          <Script
            id="adsbygoogle-loader"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS_PUB}`}
            strategy="afterInteractive"
            async
            crossOrigin="anonymous"
          />
        )}
      </head>

      <body className="min-h-screen bg-neutral-950 text-white">
        {/* Top nav */}
        <header className="sticky top-0 z-20 backdrop-blur bg-neutral-950/70 border-b border-neutral-900">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            {/* Client component decides whether to link to / or /food based on path */}
            <TopBrandLink />

            <nav className="flex items-center gap-4 text-sm text-neutral-300">
              <FoodNightlifeToggle />
              <NavLinks issuesHref={issuesHref} />
            </nav>
          </div>
        </header>

        {/* --- Side rails (hidden on <xl). 
             We keep them OUTSIDE the max-width container so they sit at the edges. --- */}
        {ADS_PUB && (
          <>
            {/* Left rail */}
            <aside className="hidden xl:block fixed top-24 left-4 z-10">
              <ins
                className="adsbygoogle"
                style={{ display: "block", width: 160, height: 600 }}
                data-ad-client={ADS_PUB}
                data-ad-slot={LEFT_SLOT}
                data-ad-format="vertical"
                data-full-width-responsive="false"
              />
              {/* AdSense needs a push() after the ins appears */}
              <Script id="ads-left-push" strategy="afterInteractive">
                {`(function(){try{const el=document.querySelector('ins[data-ad-slot="${LEFT_SLOT}"]'); if(el && el.clientWidth>0){(window.adsbygoogle=window.adsbygoogle||[]).push({});}}catch(e){/* ignore */}})();`}
              </Script>
            </aside>

            {/* Right rail */}
            <aside className="hidden xl:block fixed top-24 right-4 z-10">
              <ins
                className="adsbygoogle"
                style={{ display: "block", width: 160, height: 600 }}
                data-ad-client={ADS_PUB}
                data-ad-slot={RIGHT_SLOT}
                data-ad-format="vertical"
                data-full-width-responsive="false"
              />
              <Script id="ads-right-push" strategy="afterInteractive">
                {`(function(){try{const el=document.querySelector('ins[data-ad-slot="${RIGHT_SLOT}"]'); if(el && el.clientWidth>0){(window.adsbygoogle=window.adsbygoogle||[]).push({});}}catch(e){/* ignore */}})();`}
              </Script>
            </aside>
          </>
        )}

        {/* Page content (kept at 3xl so side rails have space on xl screens) */}
        <main className="max-w-3xl mx-auto px-4 py-5">{children}</main>

        {/* Footer */}
        <footer className="border-t border-neutral-900 text-neutral-400 text-xs">
          <div className="max-w-3xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
            <span>© {new Date().getFullYear()} Paul In Power</span>
            <div className="flex items-center gap-4">

              <a href={issuesHref} className="hover:text-white">
                Report an issue
              </a>
            </div>
          </div>
        </footer>

        {/* In development, unregister any previously-registered service workers so cached CSS doesn't persist. */}
        <Script id="dev-unregister-sw" strategy="afterInteractive">
          {`(function(){try{if(location.hostname==='localhost'||location.hostname==='127.0.0.1'){navigator.serviceWorker.getRegistrations().then(r=>r.forEach(reg=>reg.unregister())).then(()=>{console.log('dev: unregistered service workers');try{var links=document.querySelectorAll('link[rel=stylesheet]');links.forEach(l=>{var href=l.href; if(href && href.indexOf('?_sw')===-1){l.href=href+ (href.indexOf('?')===-1? '?_sw=' : '&_sw=') + Date.now();}});}catch(e){}});}}catch(e){/* ignore */}})()`}
        </Script>

        <Analytics />
      </body>
    </html>
  );
}
