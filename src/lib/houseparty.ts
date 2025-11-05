// src/lib/houseparty.ts
import { z } from 'zod';
import { nightKey as getNightKey } from './dates';

export const PartyKind = ['pres', 'afters', 'all-night'] as const;

export const housepartySchema = z.object({
  name: z.string().min(3, 'Name is too short').max(60, 'Name is too long'),
  kind: z.enum(PartyKind),
  startsAt: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid start time' }),
  endsAt: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid end time' }),
  address: z.string().min(3).max(200),
  notes: z.string().max(500).optional().default(''),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
});

/**
 * Validates, enforces "tonight", and normalizes for Firestore.
 */
export function prepareHouseparty(input: z.infer<typeof housepartySchema>) {
  const parsed = housepartySchema.parse(input);

  const starts = new Date(parsed.startsAt);
  const ends = new Date(parsed.endsAt);

  if (Number.isNaN(+starts) || Number.isNaN(+ends)) {
    throw new Error('Invalid date(s).');
  }
  if (ends <= starts) {
    throw new Error('End time must be after start time.');
  }

  // Require "tonight"
  const nkFromStart = getNightKey(starts);
  const nkNow = getNightKey(new Date());
  if (nkFromStart !== nkNow) {
    throw new Error('Houseparties are only for tonight. Please pick times for this evening.');
  }

  return {
    nightKey: nkFromStart,
    name: parsed.name.trim(),
    kind: parsed.kind,
    startsAt: starts.toISOString(),
    endsAt: ends.toISOString(),
    address: parsed.address.trim(),
    notes: (parsed.notes ?? '').trim(),
    location: parsed.location,
    createdAt: new Date().toISOString(),
    status: 'active' as const,
  };
}
