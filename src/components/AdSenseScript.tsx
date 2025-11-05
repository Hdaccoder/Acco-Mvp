"use client";
import Script from "next/script";

export default function AdSenseScript() {
  // If you add a consent banner later, gate this component behind consent.
  return (
    <Script
      id="adsbygoogle-init"
      strategy="afterInteractive"
      async
      src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6165963433025644"
      crossOrigin="anonymous"
    />
  );
}
