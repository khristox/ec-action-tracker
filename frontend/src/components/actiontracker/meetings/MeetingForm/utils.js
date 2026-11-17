// src/components/meetings/MeetingForm/utils.js
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  getDaysInMonth,
  differenceInCalendarWeeks,
  isAfter,
  isBefore,
  startOfDay,
  startOfMonth,
  getDate,
} from 'date-fns';
import { ADDRESS_LEVELS, BUILDING_LEVELS } from './constants.js';

export const hexAlpha = (color, opacity) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
  if (result) {
    const [r, g, b] = [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return color;
};

export const getLevelInfo = (location) => {
  if (!location) return null;

  if (location?.location_mode === 'buildings') {
    return BUILDING_LEVELS.find(l => l.level === location.level);
  }
  return ADDRESS_LEVELS.find(l => l.level === location?.level);
};

export const safeScrollToTop = () => {
  if (typeof window !== 'undefined' && window.scrollTo) {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      window.scrollTo(0, 0);
    }
  }
};

/* -------------------------------------------------------------------------- */
/*  Recurrence (modelled on Zoom's recurring meetings)                        */
/* -------------------------------------------------------------------------- */

// Zoom-style limits per recurrence type.
export const RECURRENCE_LIMITS = {
  daily: { max: 15, unit: 'day(s)' },
  weekly: { max: 12, unit: 'week(s)' },
  monthly: { max: 3, unit: 'month(s)' },
};

// Maximum number of occurrences in a series.
export const MAX_OCCURRENCES = 50;

const DEFAULT_OCCURRENCES = 10;
const MAX_SCAN_DAYS = 8000;
const MAX_SCAN_MONTHS = 1200;

const DAY_INDEX = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const DAY_NAMES = Object.keys(DAY_INDEX);

const MONTHLY_WEEK_INDEX = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  last: -1,
};

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

const ordinal = (n) => {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'}`;
};

/**
 * Default recurrence for a given start date. The weekday / day of month
 * come from the start date (like Zoom) instead of being hard-coded.
 */
export const getDefaultRecurrence = (startDate) => {
  const parsed = startDate ? new Date(startDate) : new Date();
  const d = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const weekday = DAY_NAMES[d.getDay()];
  const dom = getDate(d);
  const nth = ['first', 'second', 'third', 'fourth'][Math.min(Math.ceil(dom / 7), 4) - 1];
  const isLastWeek = dom + 7 > getDaysInMonth(d);

  return {
    enabled: true,
    type: 'weekly',
    interval: 1,
    days: [weekday],
    day_of_month: dom,

    monthly_pattern: 'day_of_month',
    monthly_week: isLastWeek ? 'last' : nth,
    monthly_day: weekday,

    end_option: 'after',
    end_date: null,
    max_occurrences: DEFAULT_OCCURRENCES,
  };
};

/**
 * Brings any stored/legacy recurrence in line with the Zoom-style model:
 *  - biweekly  -> weekly with interval x 2
 *  - quarterly -> monthly with interval x 3
 *  - unknown   -> weekly
 *  - interval is capped per type
 *  - "never" end (or no end) -> "after N occurrences"
 *  - occurrences are capped at MAX_OCCURRENCES
 * The function is idempotent.
 */
export const normalizeRecurrence = (recurrence) => {
  if (!recurrence) return recurrence;

  const next = { ...recurrence };
  let interval = Math.max(1, parseInt(next.interval, 10) || 1);

  if (next.type === 'biweekly') {
    next.type = 'weekly';
    interval *= 2;
  } else if (next.type === 'quarterly') {
    next.type = 'monthly';
    interval *= 3;
  } else if (!RECURRENCE_LIMITS[next.type]) {
    next.type = 'weekly';
  }

  next.interval = Math.min(interval, RECURRENCE_LIMITS[next.type].max);

  if (!next.end_option || next.end_option === 'never') {
    next.end_option = 'after';
    next.end_date = null;
    next.max_occurrences = DEFAULT_OCCURRENCES;
  }

  if (next.end_option === 'after' && next.max_occurrences !== '') {
    const m = Number(next.max_occurrences);
    if (!Number.isInteger(m) || m < 1) {
      next.max_occurrences = DEFAULT_OCCURRENCES;
    } else if (m > MAX_OCCURRENCES) {
      next.max_occurrences = MAX_OCCURRENCES;
    }
  }

  return next;
};

export const isLegacyRecurrence = (recurrence) =>
  !!recurrence &&
  JSON.stringify(normalizeRecurrence(recurrence)) !== JSON.stringify(recurrence);

// n-th (1-4) or last (-1) given weekday of the month containing `monthDate`.
const nthWeekdayOfMonth = (monthDate, weekdayIdx, nth) => {
  if (nth === -1) {
    const last = endOfMonth(monthDate);
    const diff = (last.getDay() - weekdayIdx + 7) % 7;
    return startOfDay(addDays(last, -diff));
  }
  const first = startOfMonth(monthDate);
  const offset = (weekdayIdx - first.getDay() + 7) % 7;
  const date = addDays(first, offset + (nth - 1) * 7);
  return date.getMonth() === first.getMonth() ? startOfDay(date) : null;
};

/**
 * Core engine. The start date is always the first occurrence; every later
 * occurrence follows the recurrence rule. Honors end date and max occurrences.
 *
 * options:
 *  - limit:     max number of dates to return
 *  - until:     inclusive upper bound date
 *  - ignoreMax: ignore recurrence.max_occurrences (used for "next after X")
 */
const buildOccurrences = (
  recurrence,
  startInput,
  { limit = MAX_OCCURRENCES, until = null, ignoreMax = false } = {}
) => {
  const r = normalizeRecurrence(recurrence);
  if (!r || !r.enabled) return [];

  const start = new Date(startInput);
  if (Number.isNaN(start.getTime())) return [];

  const startDay = startOfDay(start);
  const interval = r.interval;

  // Keep the time of day of the start date.
  const atStartTime = (day) => {
    const out = new Date(day);
    out.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds());
    return out;
  };

  let cap = limit;
  if (!ignoreMax && r.end_option === 'after') {
    const m = Number(r.max_occurrences);
    if (Number.isInteger(m) && m >= 1) cap = Math.min(cap, m);
  }
  if (cap < 1) return [];

  let endLimit = until ? startOfDay(new Date(until)) : null;
  if (r.end_option === 'on' && r.end_date) {
    const e = startOfDay(new Date(r.end_date));
    if (!Number.isNaN(e.getTime()) && (!endLimit || isBefore(e, endLimit))) endLimit = e;
  }

  const out = [];
  // Returns false when generation should stop.
  const accept = (day) => {
    if (endLimit && isAfter(day, endLimit)) return false;
    out.push(atStartTime(day));
    return out.length < cap;
  };

  if (!accept(startDay)) return out;

  switch (r.type) {
    case 'daily': {
      for (let k = 1; k <= MAX_SCAN_DAYS; k++) {
        if (!accept(addDays(startDay, k * interval))) break;
      }
      break;
    }

    case 'weekly': {
      let dayIdxs = (r.days || [])
        .map((d) => DAY_INDEX[d])
        .filter((i) => i !== undefined);
      if (dayIdxs.length === 0) dayIdxs = [startDay.getDay()];

      for (let k = 1; k <= MAX_SCAN_DAYS; k++) {
        const day = addDays(startDay, k);
        const weeksApart = differenceInCalendarWeeks(day, startDay);
        if (weeksApart % interval === 0 && dayIdxs.includes(day.getDay())) {
          if (!accept(day)) break;
        }
      }
      break;
    }

    case 'monthly': {
      const base = startOfMonth(startDay);
      for (let k = 0; k <= MAX_SCAN_MONTHS; k++) {
        const monthDate = addMonths(base, k * interval);
        let candidate;

        if (r.monthly_pattern === 'relative_weekday') {
          const weekdayIdx = DAY_INDEX[r.monthly_day] ?? startDay.getDay();
          const nth = MONTHLY_WEEK_INDEX[r.monthly_week] ?? 1;
          candidate = nthWeekdayOfMonth(monthDate, weekdayIdx, nth);
        } else {
          const daysInMonth = getDaysInMonth(monthDate);
          const dom =
            r.day_of_month === 'last'
              ? daysInMonth
              : Math.min(Number(r.day_of_month) || startDay.getDate(), daysInMonth);
          candidate = new Date(monthDate.getFullYear(), monthDate.getMonth(), dom);
        }

        if (!candidate || !isAfter(candidate, startDay)) continue;
        if (!accept(candidate)) break;
      }
      break;
    }

    default:
      break;
  }

  return out;
};

/**
 * First occurrence strictly after `fromDate`, using `fromDate` as the anchor.
 */
export const calculateNextOccurrence = (recurrence, fromDate) => {
  if (!recurrence || !recurrence.enabled) return null;
  const result = buildOccurrences(recurrence, fromDate, { limit: 2, ignoreMax: true });
  return result[1] || null;
};

/**
 * Zoom-style summary, e.g.
 *  "Occurs every 2 weeks on Mon, Wed until Dec 3, 2026"
 *  "Occurs every month on the last Friday for 10 occurrence(s)"
 */
export const formatRecurrenceSummary = (recurrence) => {
  if (!recurrence || !recurrence.enabled) return '';

  const r = normalizeRecurrence(recurrence);
  const unit = { daily: 'day', weekly: 'week', monthly: 'month' }[r.type];
  let text = r.interval === 1 ? `Occurs every ${unit}` : `Occurs every ${r.interval} ${unit}s`;

  if (r.type === 'weekly') {
    const days = (r.days || [])
      .filter((d) => DAY_INDEX[d] !== undefined)
      .sort((a, b) => DAY_INDEX[a] - DAY_INDEX[b])
      .map((d) => capitalize(d).slice(0, 3));
    if (days.length) text += ` on ${days.join(', ')}`;
  }

  if (r.type === 'monthly') {
    if (r.monthly_pattern === 'relative_weekday') {
      text += ` on the ${r.monthly_week || 'first'} ${capitalize(r.monthly_day || 'monday')}`;
    } else if (r.day_of_month === 'last') {
      text += ' on the last day';
    } else {
      text += ` on the ${ordinal(Number(r.day_of_month) || 1)}`;
    }
  }

  if (r.end_option === 'on' && r.end_date) {
    const end = new Date(r.end_date);
    if (!Number.isNaN(end.getTime())) text += ` until ${format(end, 'MMM d, yyyy')}`;
  } else if (r.end_option === 'after') {
    const m = Number(r.max_occurrences);
    if (Number.isInteger(m) && m >= 1) text += ` for ${m} occurrence(s)`;
  }

  return text;
};

/**
 * Generate preview occurrences for a recurring meeting.
 * The start date is the first occurrence; end date / max occurrences are honored.
 * @param {Object} recurrence - The recurrence configuration
 * @param {Date|string} startDate - The start date of the first occurrence
 * @param {number} count - Number of occurrences to generate (default: 5)
 * @returns {Array<Date>} Array of occurrence dates
 */
export const generatePreviewOccurrences = (recurrence, startDate, count = 5) => {
  if (!recurrence || !recurrence.enabled) return [];
  return buildOccurrences(recurrence, startDate, { limit: count });
};

/**
 * Generate all occurrences within a date range (end date is inclusive).
 * @param {Object} recurrence - The recurrence configuration
 * @param {Date|string} startDate - The start date
 * @param {Date|string} endDate - The last date to include
 * @param {number} maxOccurrences - Maximum number of occurrences to generate (default: 100)
 * @returns {Array<Date>} Array of occurrence dates within the range
 */
export const generateOccurrencesInRange = (recurrence, startDate, endDate, maxOccurrences = 100) => {
  if (!recurrence || !recurrence.enabled) return [];
  return buildOccurrences(recurrence, startDate, { limit: maxOccurrences, until: endDate });
};

/**
 * Get the next N occurrences after a given date
 * @param {Object} recurrence - The recurrence configuration
 * @param {Date|string} fromDate - The date to start from
 * @param {number} count - Number of occurrences to generate
 * @returns {Array<Date>} Array of occurrence dates
 */
export const getNextOccurrences = (recurrence, fromDate, count = 5) => {
  if (!recurrence || !recurrence.enabled) return [];
  return buildOccurrences(recurrence, fromDate, { limit: count + 1, ignoreMax: true }).slice(1);
};

/**
 * Get the nth occurrence after a given date
 * @param {Object} recurrence - The recurrence configuration
 * @param {Date|string} fromDate - The date to start from
 * @param {number} n - The index of the occurrence (1-based)
 * @returns {Date|null} The nth occurrence date or null
 */
export const getNthOccurrence = (recurrence, fromDate, n = 1) => {
  if (!recurrence || !recurrence.enabled || n < 1) return null;
  const result = buildOccurrences(recurrence, fromDate, { limit: n + 1, ignoreMax: true });
  return result[n] || null;
};
