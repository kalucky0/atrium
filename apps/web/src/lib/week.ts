export const HOURS = Array.from({ length: 11 }, (_, i) => i + 8);
export const DAY_LABELS = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"];

export type Interval = { start: Date; end: Date };

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function mondayOf(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - dow);
  return date;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function weekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function slotStart(day: Date, hour: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour);
}

export function parseWeek(week: string | undefined, now: Date): Date {
  if (week) {
    const m = week.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      if (!Number.isNaN(d.getTime())) return mondayOf(d);
    }
  }
  return mondayOf(now);
}

export function formatWeekParam(monday: Date): string {
  return `${monday.getFullYear()}-${pad2(monday.getMonth() + 1)}-${pad2(monday.getDate())}`;
}

export function weekLabel(monday: Date): string {
  const sun = addDays(monday, 6);
  return `${pad2(monday.getDate())}.${pad2(monday.getMonth() + 1)} – ${pad2(sun.getDate())}.${pad2(
    sun.getMonth() + 1,
  )}.${sun.getFullYear()}`;
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

function pgToDate(s: string): Date | null {
  let iso = s.trim().replace(" ", "T");
  iso = iso.replace(/([+-]\d{2})(\d{2})?$/, (_m, h: string, mm?: string) => `${h}:${mm ?? "00"}`);
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseDuring(during: string): Interval | null {
  const m = during.match(/[[(]\s*"?([^",]+?)"?\s*,\s*"?([^"\])]+?)"?\s*[\])]/);
  if (!m) return null;
  const start = pgToDate(m[1]);
  const end = pgToDate(m[2]);
  return start && end ? { start, end } : null;
}

export function formatTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function formatDuring(during: string): string {
  const iv = parseDuring(during);
  if (!iv) return during;
  const day = `${pad2(iv.start.getDate())}.${pad2(iv.start.getMonth() + 1)}`;
  return `${day} ${formatTime(iv.start)}–${formatTime(iv.end)}`;
}
