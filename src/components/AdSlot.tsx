"use client";
import { useEffect } from "react";

type Props = {
  /** Your AdSense slot id string, e.g. "1234567890" */
  slot: string;
  /** Optional: fixed size for rails or “block” for responsive inline */
  style?: React.CSSProperties;
  className?: string;
};

export default function AdSlot({ slot, style, className }: Props) {
  useEffect(() => {
    // @ts-ignore
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  }, []);

  return (
    <ins
      className={`adsbygoogle ${className ?? ""}`}
      style={{ display: "block", ...(style || {}) }}
      data-ad-client="ca-pub-6165963433025644"
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
