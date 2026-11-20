const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export type DailyTotal = {
  day: string;
  totalCentavos: number;
  count: number;
};

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function toLocalDayKey(ms: number): string {
  if (!Number.isFinite(ms)) {
    throw new RangeError('Timestamp must be finite.');
  }

  const date = new Date(ms);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayKey(nowMs = Date.now()): string {
  return toLocalDayKey(nowMs);
}

export function dayKeyToLocalDate(key: string): Date {
  const match = DAY_KEY_PATTERN.exec(key);
  if (!match) {
    throw new RangeError(`Invalid local day key: ${key}`);
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, monthIndex, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    throw new RangeError(`Invalid local day key: ${key}`);
  }

  return date;
}

export function isLocalDayKey(key: string): boolean {
  try {
    dayKeyToLocalDate(key);
    return true;
  } catch {
    return false;
  }
}

export function addDaysToKey(key: string, days: number): string {
  if (!Number.isInteger(days)) {
    throw new RangeError('Days must be an integer.');
  }

  const date = dayKeyToLocalDate(key);
  date.setDate(date.getDate() + days);
  return toLocalDayKey(date.getTime());
}

export function startOfWeekKey(key: string, weekStartsOn: 0 | 1 = 1): string {
  const dayOfWeek = dayKeyToLocalDate(key).getDay();
  const daysSinceStart = (dayOfWeek - weekStartsOn + 7) % 7;
  return addDaysToKey(key, -daysSinceStart);
}

export function endOfWeekKey(key: string, weekStartsOn: 0 | 1 = 1): string {
  return addDaysToKey(startOfWeekKey(key, weekStartsOn), 6);
}

export function startOfMonthKey(key: string): string {
  const date = dayKeyToLocalDate(key);
  return toLocalDayKey(new Date(date.getFullYear(), date.getMonth(), 1).getTime());
}

export function endOfMonthKey(key: string): string {
  const date = dayKeyToLocalDate(key);
  return toLocalDayKey(new Date(date.getFullYear(), date.getMonth() + 1, 0).getTime());
}

export function formatDayHeader(key: string, nowMs: number): string {
  const currentDay = todayKey(nowMs);
  if (key === currentDay) {
    return 'Today';
  }
  if (key === addDaysToKey(currentDay, -1)) {
    return 'Yesterday';
  }

  const date = dayKeyToLocalDate(key);
  return `${WEEKDAY_NAMES[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
}

export function fillMissingDays(
  rows: readonly DailyTotal[],
  fromKey: string,
  toKey: string
): DailyTotal[] {
  dayKeyToLocalDate(fromKey);
  dayKeyToLocalDate(toKey);
  if (fromKey > toKey) {
    throw new RangeError('The start day must not be after the end day.');
  }

  const byDay = new Map(rows.map((row) => [row.day, row]));
  const filled: DailyTotal[] = [];

  for (let day = fromKey; day <= toKey; day = addDaysToKey(day, 1)) {
    filled.push(byDay.get(day) ?? { day, totalCentavos: 0, count: 0 });
  }

  return filled;
}
