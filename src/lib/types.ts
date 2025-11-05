// --- Houseparty types ---
export type PartyKind = 'pres' | 'afters' | 'all-night';

export interface Houseparty {
  id?: string;
  nightKey: string;            // e.g., "2025-11-05"
  kind: PartyKind;
  startsAt: string;            // ISO 8601
  endsAt: string;              // ISO 8601
  address: string;             // free text, optional precision
  location: { lat: number; lng: number };
  createdAt: string;           // ISO 8601
  status: 'active' | 'removed';
}
