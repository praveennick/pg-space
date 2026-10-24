/** Keep ISO dates in storage; use day-first dates everywhere people see them. */
export function displayDate(value: string | null | undefined): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}

export function displayMonth(value: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  return match ? `${match[2]}-${match[1]}` : value;
}

export function parseDisplayMonth(value: string): string | null {
  const match = /^(0[1-9]|1[0-2])-(\d{4})$/.exec(value);
  return match ? `${match[2]}-${match[1]}` : null;
}

export function parseDisplayDate(value: string): string | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCDate() !== Number(day)
  )
    return null;
  return `${year}-${month}-${day}`;
}

export function displayDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value;
  return `${part("day")}-${part("month")}-${part("year")} ${part("hour")}:${part("minute")}`;
}
