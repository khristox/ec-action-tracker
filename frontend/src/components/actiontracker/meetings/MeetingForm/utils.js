// src/components/meetings/MeetingForm/utils.js
import { addDays, addWeeks, addMonths, startOfDay, isAfter } from 'date-fns';
import { WEEK_DAYS, ADDRESS_LEVELS, BUILDING_LEVELS } from './constants.js';

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

export const calculateNextOccurrence = (recurrence, fromDate) => {
  if (!recurrence || !recurrence.enabled) return null;
  
  let nextDate = new Date(fromDate);
  const interval = recurrence.interval || 1;
  
  switch (recurrence.type) {
    case 'daily':
      nextDate = addDays(nextDate, interval);
      break;
    case 'weekly':
      if (recurrence.days && recurrence.days.length > 0) {
        const currentDay = nextDate.getDay();
        const dayIndices = recurrence.days.map(d => WEEK_DAYS.find(wd => wd.value === d)?.dayIndex);
        let daysToAdd = null;
        
        for (let i = 1; i <= 7; i++) {
          const nextDayIndex = (currentDay + i) % 7;
          if (dayIndices.includes(nextDayIndex)) {
            daysToAdd = i;
            break;
          }
        }
        
        if (daysToAdd !== null) {
          nextDate = addDays(nextDate, daysToAdd);
          if (interval > 1) {
            nextDate = addWeeks(nextDate, interval - 1);
          }
        } else {
          nextDate = addWeeks(nextDate, interval);
        }
      } else {
        nextDate = addWeeks(nextDate, interval);
      }
      break;
    case 'biweekly':
      nextDate = addWeeks(nextDate, interval * 2);
      break;
    case 'monthly':
      nextDate = addMonths(nextDate, interval);
      if (recurrence.day_of_month) {
        const targetDay = Math.min(recurrence.day_of_month, new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate());
        nextDate.setDate(targetDay);
      }
      break;
    case 'quarterly':
      nextDate = addMonths(nextDate, interval * 3);
      break;
    case 'yearly':
      nextDate = addMonths(nextDate, interval * 12);
      break;
    default:
      nextDate = addWeeks(nextDate, 1);
  }
  
  return nextDate;
};

export const formatRecurrenceSummary = (recurrence) => {
  if (!recurrence || !recurrence.enabled) return '';
  const type = recurrence.type;
  const interval = recurrence.interval || 1;
  
  if (type === 'weekly') {
    const days = recurrence.days?.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ');
    return `Every ${interval} week(s) on ${days}`;
  }
  if (type === 'biweekly') {
    const days = recurrence.days?.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ');
    return `Every ${interval * 2} weeks on ${days}`;
  }
  if (type === 'monthly') {
    return `Every ${interval} month(s) on day ${recurrence.day_of_month || 1}`;
  }
  return `Every ${interval} ${type}`;
};

/**
 * Generate preview occurrences for a recurring meeting
 * @param {Object} recurrence - The recurrence configuration
 * @param {Date|string} startDate - The start date of the first occurrence
 * @param {number} count - Number of occurrences to generate (default: 5)
 * @returns {Array<Date>} Array of occurrence dates
 */
export const generatePreviewOccurrences = (recurrence, startDate, count = 5) => {
  if (!recurrence || !recurrence.enabled) {
    return [];
  }

  const start = new Date(startDate);
  const occurrences = [start];
  let currentDate = start;

  for (let i = 1; i < count; i++) {
    const nextDate = calculateNextOccurrence(recurrence, currentDate);
    if (!nextDate) break;
    occurrences.push(nextDate);
    currentDate = nextDate;
  }

  return occurrences;
};

/**
 * Generate all occurrences within a date range
 * @param {Object} recurrence - The recurrence configuration
 * @param {Date|string} startDate - The start date
 * @param {Date|string} endDate - The end date (exclusive)
 * @param {number} maxOccurrences - Maximum number of occurrences to generate (default: 100)
 * @returns {Array<Date>} Array of occurrence dates within the range
 */
export const generateOccurrencesInRange = (recurrence, startDate, endDate, maxOccurrences = 100) => {
  if (!recurrence || !recurrence.enabled) {
    return [];
  }

  const start = startOfDay(new Date(startDate));
  const end = startOfDay(new Date(endDate));
  const occurrences = [];
  let currentDate = start;

  while (occurrences.length < maxOccurrences) {
    if (isAfter(currentDate, end)) break;
    occurrences.push(currentDate);
    const nextDate = calculateNextOccurrence(recurrence, currentDate);
    if (!nextDate) break;
    currentDate = nextDate;
  }

  return occurrences;
};

/**
 * Get the next N occurrences after a given date
 * @param {Object} recurrence - The recurrence configuration
 * @param {Date|string} fromDate - The date to start from
 * @param {number} count - Number of occurrences to generate
 * @returns {Array<Date>} Array of occurrence dates
 */
export const getNextOccurrences = (recurrence, fromDate, count = 5) => {
  if (!recurrence || !recurrence.enabled) {
    return [];
  }

  const from = new Date(fromDate);
  const occurrences = [];
  let currentDate = from;

  for (let i = 0; i < count; i++) {
    const nextDate = calculateNextOccurrence(recurrence, currentDate);
    if (!nextDate) break;
    occurrences.push(nextDate);
    currentDate = nextDate;
  }

  return occurrences;
};

/**
 * Get the nth occurrence after a given date
 * @param {Object} recurrence - The recurrence configuration
 * @param {Date|string} fromDate - The date to start from
 * @param {number} n - The index of the occurrence (1-based)
 * @returns {Date|null} The nth occurrence date or null
 */
export const getNthOccurrence = (recurrence, fromDate, n = 1) => {
  if (!recurrence || !recurrence.enabled || n < 1) {
    return null;
  }

  let currentDate = new Date(fromDate);
  for (let i = 0; i < n; i++) {
    const nextDate = calculateNextOccurrence(recurrence, currentDate);
    if (!nextDate) return null;
    currentDate = nextDate;
  }

  return currentDate;
};