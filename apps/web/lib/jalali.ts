/**
 * Jalali ↔ Gregorian date-only helpers (Asia/Tehran display contract).
 * Storage stays Gregorian YYYY-MM-DD; UI shows Jalali with Persian digits.
 */
import * as jalaali from "jalaali-js";

import { toLatinDigits, toPersianDigits } from "./persian-digits";

export type GregorianDateOnly = {
  year: number;
  month: number;
  day: number;
};

export type JalaliDateOnly = {
  jy: number;
  jm: number;
  jd: number;
};

const JALALI_MONTH_NAMES = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
] as const;

const WEEKDAY_LABELS = ["ش", "ی", "د", "س", "چ", "پ", "ج"] as const;

/** Default half-window for year jump UI (today±50 → ~101 years). */
export const JALALI_YEAR_RANGE_RADIUS = 50;

export function jalaliMonthName(jm: number): string {
  return JALALI_MONTH_NAMES[jm - 1] ?? "";
}

/** All 12 Jalali month names (index 0 = Farvardin). */
export function jalaliMonthNames(): readonly string[] {
  return JALALI_MONTH_NAMES;
}

/**
 * Inclusive Jalali year window centered on `centerJy`.
 * Picker year list uses this (e.g. view year ±50).
 */
export function jalaliYearRange(
  centerJy: number,
  radius: number = JALALI_YEAR_RANGE_RADIUS,
): { min: number; max: number } {
  return { min: centerJy - radius, max: centerJy + radius };
}

/** Descending years in `jalaliYearRange` for year-list UI. */
export function jalaliYearsAround(
  centerJy: number,
  radius: number = JALALI_YEAR_RANGE_RADIUS,
): number[] {
  const { min, max } = jalaliYearRange(centerJy, radius);
  const years: number[] = [];
  for (let y = max; y >= min; y -= 1) years.push(y);
  return years;
}

/** Set month/year on a Jalali date, clamping `jd` to the target month length. */
export function setJalaliMonthYear(
  j: JalaliDateOnly,
  jm: number,
  jy: number,
): JalaliDateOnly {
  const maxDay = jalaliMonthLength(jy, jm);
  return { jy, jm, jd: Math.min(j.jd, maxDay) };
}

export function jalaliWeekdayLabels(): readonly string[] {
  return WEEKDAY_LABELS;
}

/** Parse ISO date-only `YYYY-MM-DD` (Gregorian). */
export function parseGregorianDateOnly(
  value: string | null | undefined,
): GregorianDateOnly | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!isValidGregorian(year, month, day)) return null;
  return { year, month, day };
}

export function formatGregorianDateOnly(d: GregorianDateOnly): string {
  const mm = String(d.month).padStart(2, "0");
  const dd = String(d.day).padStart(2, "0");
  return `${d.year}-${mm}-${dd}`;
}

export function isValidGregorian(
  year: number,
  month: number,
  day: number,
): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

export function gregorianToJalali(d: GregorianDateOnly): JalaliDateOnly {
  return jalaali.toJalaali(d.year, d.month, d.day);
}

export function jalaliToGregorian(j: JalaliDateOnly): GregorianDateOnly | null {
  if (!jalaali.isValidJalaaliDate(j.jy, j.jm, j.jd)) return null;
  const g = jalaali.toGregorian(j.jy, j.jm, j.jd);
  return { year: g.gy, month: g.gm, day: g.gd };
}

/** Display as Persian-digit Jalali: «۱۴۰۵/۰۴/۲۵» */
export function formatJalaliDisplay(j: JalaliDateOnly): string {
  const jm = String(j.jm).padStart(2, "0");
  const jd = String(j.jd).padStart(2, "0");
  return toPersianDigits(`${j.jy}/${jm}/${jd}`);
}

export function formatJalaliDisplayFromGregorian(
  value: string | null | undefined,
): string {
  const g = parseGregorianDateOnly(value);
  if (!g) return "";
  return formatJalaliDisplay(gregorianToJalali(g));
}

/**
 * Parse typed Jalali entry (Latin or Persian digits).
 * Accepts `YYYY/MM/DD` or `YYYY-MM-DD` with 1–2 digit month/day.
 */
export function parseJalaliInput(raw: string): JalaliDateOnly | null {
  const latin = toLatinDigits(raw.trim());
  const m = /^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/.exec(latin);
  if (!m) return null;
  const jy = Number(m[1]);
  const jm = Number(m[2]);
  const jd = Number(m[3]);
  if (!jalaali.isValidJalaaliDate(jy, jm, jd)) return null;
  return { jy, jm, jd };
}

/** Parse typed `H:mm` / `HH:mm` (Latin or Persian digits) → zero-padded Latin `HH:mm`. */
export function parseTimeInput(raw: string): string | null {
  const latin = toLatinDigits(raw.trim());
  const m = /^(\d{1,2}):(\d{2})$/.exec(latin);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function jalaliMonthLength(jy: number, jm: number): number {
  return jalaali.jalaaliMonthLength(jy, jm);
}

/** Saturday-first weekday index for first day of Jalali month (0=Sat … 6=Fri). */
export function jalaliMonthStartWeekday(jy: number, jm: number): number {
  const g = jalaali.toGregorian(jy, jm, 1);
  // JS: 0=Sun … 6=Sat → convert to Sat-first
  const sunFirst = new Date(Date.UTC(g.gy, g.gm - 1, g.gd)).getUTCDay();
  return (sunFirst + 1) % 7;
}

export function addJalaliMonths(j: JalaliDateOnly, delta: number): JalaliDateOnly {
  let jy = j.jy;
  let jm = j.jm;
  const jd = j.jd;
  jm += delta;
  while (jm > 12) {
    jm -= 12;
    jy += 1;
  }
  while (jm < 1) {
    jm += 12;
    jy -= 1;
  }
  const maxDay = jalaliMonthLength(jy, jm);
  return { jy, jm, jd: Math.min(jd, maxDay) };
}

export function addJalaliDays(j: JalaliDateOnly, delta: number): JalaliDateOnly {
  const g = jalaliToGregorian(j);
  if (!g) return j;
  const dt = new Date(Date.UTC(g.year, g.month - 1, g.day));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return gregorianToJalali({
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
  });
}

/** Today's Gregorian date-only in Asia/Tehran calendar day. */
export function todayGregorianInTehran(): GregorianDateOnly {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  return { year, month, day };
}

export function todayJalaliInTehran(): JalaliDateOnly {
  return gregorianToJalali(todayGregorianInTehran());
}

export type GregorianDateTimeParts = {
  /** Gregorian `YYYY-MM-DD` storage. */
  date?: string;
  /** 24h `HH:mm`. */
  time?: string;
};

/**
 * Convert JalaliDateTimePicker parts to an ISO instant.
 * Interprets date+time as Asia/Tehran wall clock (fixed UTC+03:30; no DST).
 * Incomplete or invalid parts → null.
 */
export function gregorianDateTimePartsToIso(
  parts: GregorianDateTimeParts | null | undefined,
): string | null {
  if (!parts?.date || !parts.time) return null;
  const g = parseGregorianDateOnly(parts.date);
  if (!g) return null;
  const tm = /^(\d{2}):(\d{2})$/.exec(parts.time.trim());
  if (!tm) return null;
  const hour = Number(tm[1]);
  const minute = Number(tm[2]);
  if (hour > 23 || minute > 59) return null;
  // Asia/Tehran is permanently UTC+03:30 (DST abolished 2022).
  const TEHRAN_OFFSET_MS = (3 * 60 + 30) * 60 * 1000;
  const utcMs =
    Date.UTC(g.year, g.month - 1, g.day, hour, minute, 0, 0) - TEHRAN_OFFSET_MS;
  const d = new Date(utcMs);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Display an ISO instant as Jalali date + Persian time (Asia/Tehran).
 * Example: «۱۴۰۵/۰۴/۲۶ ۱۴:۳۰»
 */
export function formatJalaliDateTimeFromIso(
  iso: string | null | undefined,
): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const year = Number(dateParts.find((p) => p.type === "year")?.value);
  const month = Number(dateParts.find((p) => p.type === "month")?.value);
  const day = Number(dateParts.find((p) => p.type === "day")?.value);
  if (!year || !month || !day) return "";

  const timeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tehran",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hour = timeParts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = timeParts.find((p) => p.type === "minute")?.value ?? "00";

  const jalali = formatJalaliDisplay(
    gregorianToJalali({ year, month, day }),
  );
  return `${jalali} ${toPersianDigits(`${hour}:${minute}`)}`;
}
