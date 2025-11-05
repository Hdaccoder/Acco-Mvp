"use client";

import { PropsWithChildren } from "react";
import AdSlot from "./AdSlot";

/**
 * A 3-column grid:
 * - hidden rails on mobile
 * - sticky side ads on desktop
 */
export default function SideRails({ children }: PropsWithChildren) {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-3">
      <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_220px] gap-4">
        {/* LEFT RAIL (desktop only) */}
        <aside className="hidden lg:block">
          <div className="sticky top-4">
            {/* Replace with your created LEFT RAIL slot id */}
            <AdSlot slot="7546804796" style={{ minHeight: 600, width: "100%" }} />
          </div>
        </aside>

        {/* CONTENT */}
        <main>{children}</main>

        {/* RIGHT RAIL (desktop only) */}
        <aside className="hidden lg:block">
          <div className="sticky top-4">
            {/* Replace with your created RIGHT RAIL slot id */}
            <AdSlot slot="2524087565" style={{ minHeight: 600, width: "100%" }} />
          </div>
        </aside>
      </div>
    </div>
  );
}
