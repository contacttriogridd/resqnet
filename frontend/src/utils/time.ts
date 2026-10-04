/** Human-friendly time formatting. All functions accept ISO strings, Dates or epoch ms. */
type TimeInput = string | number | Date;

const toDate = (t: TimeInput) => (t instanceof Date ? t : new Date(t));

export function timeAgo(t: TimeInput, now = Date.now()): string {
  const diff = Math.round((now - toDate(t).getTime()) / 1000);
  if (diff < 0) return 'just now';
  if (diff < 45) return 'just now';
  if (diff < 90) return '1 minute ago';
  const min = Math.round(diff / 60);
  if (min < 60) return `${min} minutes ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return hr === 1 ? '1 hour ago' : `${hr} hours ago`;
  const days = Math.round(hr / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

export function clockTime(t: TimeInput): string {
  return toDate(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** e.g. "04 Oct 2026, 8:20 PM" */
export function dateTime(t: TimeInput): string {
  const d = toDate(t);
  const date = d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  return `${date}, ${clockTime(d)}`;
}

/** "10:42 AM" for today, otherwise full date and time. */
export function smartTime(t: TimeInput, now = new Date()): string {
  const d = toDate(t);
  return d.toDateString() === now.toDateString() ? clockTime(d) : dateTime(d);
}

export function timeUntil(t: TimeInput, now = Date.now()): string {
  const min = Math.round((toDate(t).getTime() - now) / 60_000);
  if (min <= 0) return 'expired';
  if (min < 60) return `in ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `in ${hr} h`;
  return `in ${Math.round(hr / 24)} days`;
}
