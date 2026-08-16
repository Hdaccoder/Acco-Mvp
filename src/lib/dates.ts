export const LONDON_TZ = "Europe/London";

const londonDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

function keyFromUtcDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function londonCalendarParts(date: Date) {
  const parts = Object.fromEntries(
    londonDateFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
  };
}

/** The local night starts at 05:00 London time and survives DST/server time-zone changes. */
export function nightKey(date = new Date()) {
  const { year, month, day, hour } = londonCalendarParts(date);
  const londonCalendarDate = new Date(Date.UTC(year, month - 1, day));
  if (hour < 5) londonCalendarDate.setUTCDate(londonCalendarDate.getUTCDate() - 1);
  return keyFromUtcDate(londonCalendarDate);
}

export function dateFromNightKey(key: string) {
  return new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(4, 6)) - 1, Number(key.slice(6, 8))));
}

/** Returns a calendar-night key relative to the current London night. */
export function nightKeyAtOffset(offset: number, from = new Date()) {
  const date = dateFromNightKey(nightKey(from));
  date.setUTCDate(date.getUTCDate() + offset);
  return keyFromUtcDate(date);
}
