// Lucky number picker: seeded by date + name + roll, with "spread-out" rules
// that avoid commonly played combinations (birthdays, runs, patterns).
// Every combination still has exactly the same odds of winning.

export type Game = {
  id: string;
  name: string;
  max: number;
  color: string;
  drawDays: number[]; // 0 = Sunday ... 6 = Saturday
};

// PCSO major lotto draw days. Draws are held in the evening, usually 9 PM.
// PCSO may change or skip draws on holidays (Holy Week, Christmas, New Year).
export const GAMES: Game[] = [
  { id: '6/42', name: 'Lotto', max: 42, color: '#F2B705', drawDays: [2, 4, 6] }, // Tue Thu Sat
  { id: '6/45', name: 'Mega Lotto', max: 45, color: '#2EA36B', drawDays: [1, 3, 5] }, // Mon Wed Fri
  { id: '6/49', name: 'Super Lotto', max: 49, color: '#2F7FD8', drawDays: [2, 4, 0] }, // Tue Thu Sun
  { id: '6/55', name: 'Grand Lotto', max: 55, color: '#8A4FD6', drawDays: [1, 3, 6] }, // Mon Wed Sat
  { id: '6/58', name: 'Ultra Lotto', max: 58, color: '#D6402B', drawDays: [2, 5, 0] }, // Tue Fri Sun
];

export const DRAW_TIME_LABEL = '9 PM';

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function combinations(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

function hash(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function isSpreadOut(nums: number[]): boolean {
  // At least two numbers above 31 (not all birthday numbers)
  if (nums.filter((n) => n > 31).length < 2) return false;

  // No three or more consecutive numbers
  let run = 1;
  for (let i = 1; i < nums.length; i++) {
    run = nums[i] === nums[i - 1] + 1 ? run + 1 : 1;
    if (run >= 3) return false;
  }

  // Spread across at least three blocks of ten
  const blocks = new Set(nums.map((n) => Math.floor((n - 1) / 10)));
  if (blocks.size < 3) return false;

  // No even steps like 5-10-15-20-25-30
  const gaps = nums.slice(1).map((n, i) => n - nums[i]);
  if (gaps.every((g) => g === gaps[0])) return false;

  // Not all even or all odd
  if (nums.every((n) => n % 2 === 0) || nums.every((n) => n % 2 === 1)) return false;

  return true;
}

export function pickNumbers(seedText: string, max: number): number[] {
  const rng = mulberry32(hash(seedText));
  let nums: number[] = [];
  for (let tries = 0; tries < 500; tries++) {
    const pool = Array.from({ length: max }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    nums = pool.slice(0, 6).sort((a, b) => a - b);
    if (isSpreadOut(nums)) return nums;
  }
  return nums;
}

export function pickForGame(game: Game, dateKey: string, name: string, roll: number): number[] {
  const who = name.trim().toLowerCase();
  return pickNumbers(`${dateKey}|${who}|${roll}|${game.id}`, game.max);
}

export function formatNumbers(nums: number[]): string {
  return nums.map((n) => String(n).padStart(2, '0')).join('-');
}

// ---------- Philippine time (UTC+8, no daylight saving) ----------
// Computed directly instead of relying on Intl time zone support in Hermes.

const PH_OFFSET_MS = 8 * 60 * 60 * 1000;

function toManila(date: Date): Date {
  return new Date(date.getTime() + PH_OFFSET_MS);
}

/** YYYY-MM-DD in Philippine time for any moment. */
export function manilaDateKeyFor(date: Date): string {
  return toManila(date).toISOString().slice(0, 10);
}

export function manilaDateKey(): string {
  return manilaDateKeyFor(new Date());
}

/** Day of week (0 = Sunday) for a YYYY-MM-DD key. */
export function weekdayFromKey(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay();
}

export function prettyDateFromKey(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function manilaPrettyDate(): string {
  return prettyDateFromKey(manilaDateKey());
}

// ---------- Draw schedule ----------

export function isDrawDay(game: Game, weekday: number): boolean {
  return game.drawDays.includes(weekday);
}

/** Days until the game's next draw after today (1 to 7). */
export function daysUntilNextDraw(game: Game, weekday: number): number {
  for (let i = 1; i <= 7; i++) {
    if (isDrawDay(game, (weekday + i) % 7)) return i;
  }
  return 7;
}

/** "Tomorrow" or a short day name like "Fri". */
export function nextDrawLabel(game: Game, weekday: number): string {
  const days = daysUntilNextDraw(game, weekday);
  if (days === 1) return 'Tomorrow';
  return WEEKDAYS_SHORT[(weekday + days) % 7];
}

/** Games drawn on a weekday, in the standard 6/42 → 6/58 order. */
export function gamesDrawnOn(weekday: number): Game[] {
  return GAMES.filter((g) => isDrawDay(g, weekday));
}

/** Games not drawn on a weekday, soonest next draw first. */
export function gamesNotDrawnOn(weekday: number): Game[] {
  return GAMES.filter((g) => !isDrawDay(g, weekday)).sort(
    (a, b) => daysUntilNextDraw(a, weekday) - daysUntilNextDraw(b, weekday),
  );
}