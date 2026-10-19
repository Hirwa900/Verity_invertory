export default function getBusinessDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Africa/Kigali',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function isDateOnly(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

export function monthStart(date = new Date()) {
  const today = getBusinessDate(date);
  return `${today.slice(0, 7)}-01`;
}
