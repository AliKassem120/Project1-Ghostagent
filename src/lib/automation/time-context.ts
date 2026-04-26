import { formatInTimeZone } from 'date-fns-tz';

export function nowInTimezone(timezone: string): Date {
  const iso = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd'T'HH:mm:ssXXX");
  return new Date(iso);
}

export function resolveRelativeDate(token: 'today' | 'tomorrow', timezone: string): string {
  const d = nowInTimezone(timezone);
  if (token === 'tomorrow') d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
