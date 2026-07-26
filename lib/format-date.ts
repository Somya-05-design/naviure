const LOCALE = "en-IN";
const TIME_ZONE = "Asia/Kolkata";

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: TIME_ZONE,
};

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: TIME_ZONE,
};

function toDate(value: string | Date | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Stable across SSR and client — always uses en-IN + Asia/Kolkata. */
export function formatDateTime(value: string | Date | number): string {
  return toDate(value).toLocaleString(LOCALE, DATE_TIME_OPTIONS);
}

/** Stable across SSR and client — date only, en-IN + Asia/Kolkata. */
export function formatDate(value: string | Date | number): string {
  return toDate(value).toLocaleDateString(LOCALE, DATE_OPTIONS);
}

/** Stable number formatting for client components that SSR. */
export function formatNumber(value: number): string {
  return value.toLocaleString(LOCALE);
}
