// src/components/actiontracker/meetings/MeetingForm/constants.js

/**
 * @typedef {Object} Step
 * @property {string} label - Step label
 * @property {string} description - Step description
 */

/**
 * @typedef {Object} WeekDay
 * @property {string} value - Day value (lowercase)
 * @property {string} label - Short label (1-2 chars)
 * @property {string} full - Full day name
 * @property {number} dayIndex - JavaScript day index (0-6, Sunday=0)
 */

/**
 * @typedef {Object} LevelInfo
 * @property {number} level - Level number
 * @property {string} name - Level name
 * @property {string} icon - Icon name (string, not JSX)
 * @property {string} color - Hex color code
 */

/**
 * @typedef {Object} RecurrenceType
 * @property {string} value - Type value
 * @property {string} label - Display label
 * @property {string} icon - Emoji icon
 * @property {string} description - Human-readable description
 * @property {string} intervalText - Text for interval field
 */

// ============================================================================
// STEP CONFIGURATION
// ============================================================================

/** @type {Step[]} */
export const STEPS = [
  { 
    label: 'Meeting Details', 
    description: 'Basic info, date, location' 
  },
  { 
    label: 'Participants', 
    description: 'Add attendees and roles' 
  },
  { 
    label: 'Recurrence', 
    description: 'Set up recurring schedule' 
  },
  { 
    label: 'Review & Submit', 
    description: 'Verify all information' 
  },
];

// ============================================================================
// WEEK DAYS
// ============================================================================

/** @type {WeekDay[]} */
export const WEEK_DAYS = [
  { value: 'monday', label: 'M', full: 'Monday', dayIndex: 1 },
  { value: 'tuesday', label: 'T', full: 'Tuesday', dayIndex: 2 },
  { value: 'wednesday', label: 'W', full: 'Wednesday', dayIndex: 3 },
  { value: 'thursday', label: 'T', full: 'Thursday', dayIndex: 4 },
  { value: 'friday', label: 'F', full: 'Friday', dayIndex: 5 },
  { value: 'saturday', label: 'S', full: 'Saturday', dayIndex: 6 },
  { value: 'sunday', label: 'S', full: 'Sunday', dayIndex: 0 }
];

// Helper to get day by value
export const getDayByValue = (value) => WEEK_DAYS.find(day => day.value === value);

// Helper to get day by index
export const getDayByIndex = (index) => WEEK_DAYS.find(day => day.dayIndex === index);

// ============================================================================
// LOCATION LEVELS
// ============================================================================

/** @type {LevelInfo[]} */
export const ADDRESS_LEVELS = [
  { level: 1, name: 'Country', icon: 'PublicIcon', color: '#4CAF50' },
  { level: 2, name: 'Region', icon: 'FlagIcon', color: '#2196F3' },
  { level: 3, name: 'District', icon: 'TerrainIcon', color: '#9C27B0' },
  { level: 4, name: 'County', icon: 'BusinessIcon', color: '#FF9800' },
  { level: 5, name: 'Subcounty', icon: 'HomeIcon', color: '#795548' },
  { level: 6, name: 'Parish', icon: 'LocationIcon', color: '#607D8B' },
  { level: 7, name: 'Village', icon: 'HomeIcon', color: '#8BC34A' },
];

/** @type {LevelInfo[]} */
export const BUILDING_LEVELS = [
  { level: 11, name: 'Office', icon: 'ApartmentIcon', color: '#E91E63' },
  { level: 12, name: 'Building', icon: 'BusinessIcon', color: '#3F51B5' },
  { level: 13, name: 'Room', icon: 'MeetingRoomIcon', color: '#009688' },
  { level: 14, name: 'Conference', icon: 'EventSeatIcon', color: '#673AB7' },
];

// Combined location levels (useful for lookup)
export const ALL_LOCATION_LEVELS = [...ADDRESS_LEVELS, ...BUILDING_LEVELS];

/**
 * Get location level info by level number
 * @param {number} level - Level number
 * @param {string} mode - 'address' or 'buildings'
 * @returns {LevelInfo | undefined}
 */
export const getLocationLevel = (level, mode = 'address') => {
  const levels = mode === 'buildings' ? BUILDING_LEVELS : ADDRESS_LEVELS;
  return levels.find(l => l.level === level);
};

// ============================================================================
// RECURRENCE CONFIGURATION
// ============================================================================

/** @type {RecurrenceType[]} */
export const RECURRENCE_TYPES = [
  { value: 'daily', label: 'Daily', icon: '📅', description: 'Repeats every day', intervalText: 'day(s)' },
  { value: 'weekly', label: 'Weekly', icon: '📆', description: 'Repeats every week on selected days', intervalText: 'week(s)' },
  { value: 'biweekly', label: 'Bi-Weekly', icon: '🔄', description: 'Repeats every two weeks', intervalText: 'week(s)' },
  { value: 'monthly', label: 'Monthly', icon: '📅', description: 'Repeats every month on selected date', intervalText: 'month(s)' },
  { value: 'quarterly', label: 'Quarterly', icon: '📊', description: 'Repeats every 3 months', intervalText: 'quarter(s)' },
  { value: 'yearly', label: 'Yearly', icon: '🎉', description: 'Repeats every year', intervalText: 'year(s)' }
];

// Recurrence type lookup helpers
export const getRecurrenceType = (value) => RECURRENCE_TYPES.find(t => t.value === value);
export const getRecurrenceIntervalText = (type) => getRecurrenceType(type)?.intervalText || 'time(s)';

/** @type {Array<{value: string, label: string}>} */
export const END_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'after', label: 'After X occurrences' },
  { value: 'on', label: 'On date' }
];

// Recurrence presets for quick selection
export const RECURRENCE_PRESETS = {
  daily: { type: 'daily', interval: 1 },
  weekly: { type: 'weekly', interval: 1, days: ['monday'] },
  biweekly: { type: 'biweekly', interval: 1, days: ['monday'] },
  monthly: { type: 'monthly', interval: 1, day_of_month: 1 },
  quarterly: { type: 'quarterly', interval: 1 },
  yearly: { type: 'yearly', interval: 1 },
};

// ============================================================================
// VISIBILITY & ACCESS
// ============================================================================

/** @type {Array<{value: string, label: string, description: string, color: string}>} */
export const VISIBILITY_OPTIONS = [
  { value: 'open', label: 'Open to All', description: 'Anyone can view and join this meeting', color: '#4CAF50' },
  { value: 'department', label: 'Department Only', description: 'Restricted to selected department only', color: '#FF9800' }
];

// Visibility helper
export const isRestrictedVisibility = (visibility) => visibility === 'department';

// ============================================================================
// PARTICIPANT CONFIGURATION
// ============================================================================

/** @type {Array<{value: string, label: string, icon?: string}>} */
export const PARTICIPANT_TABS = [
  { value: 'existing', label: 'Existing Users', icon: 'PersonSearchIcon' },
  { value: 'manual', label: 'Add Manually', icon: 'PersonAddIcon' },
  { value: 'lists', label: 'Participant Lists', icon: 'ListAltIcon' }
];

// Maximum participants per meeting
export const MAX_PARTICIPANTS = 100;

// Participant roles
export const PARTICIPANT_ROLES = {
  CHAIRPERSON: 'chairperson',
  SECRETARY: 'secretary',
  MEMBER: 'member',
  OBSERVER: 'observer',
};

/** @type {Array<{value: string, label: string, color: string}>} */
export const PARTICIPANT_ROLES_OPTIONS = [
  { value: PARTICIPANT_ROLES.CHAIRPERSON, label: 'Chairperson', color: '#1976D2' },
  { value: PARTICIPANT_ROLES.SECRETARY, label: 'Secretary', color: '#DC004E' },
  { value: PARTICIPANT_ROLES.MEMBER, label: 'Member', color: '#2E7D32' },
  { value: PARTICIPANT_ROLES.OBSERVER, label: 'Observer', color: '#ED6C02' },
];

// ============================================================================
// MEETING CONSTANTS
// ============================================================================

// Meeting statuses
export const MEETING_STATUSES = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  POSTPONED: 'postponed',
};

/** @type {Array<{value: string, label: string, color: string}>} */
export const MEETING_STATUS_OPTIONS = [
  { value: MEETING_STATUSES.DRAFT, label: 'Draft', color: '#9E9E9E' },
  { value: MEETING_STATUSES.SCHEDULED, label: 'Scheduled', color: '#2196F3' },
  { value: MEETING_STATUSES.ONGOING, label: 'Ongoing', color: '#FF9800' },
  { value: MEETING_STATUSES.COMPLETED, label: 'Completed', color: '#4CAF50' },
  { value: MEETING_STATUSES.CANCELLED, label: 'Cancelled', color: '#F44336' },
  { value: MEETING_STATUSES.POSTPONED, label: 'Postponed', color: '#9C27B0' },
];

// ============================================================================
// LOCATION CONSTANTS
// ============================================================================

export const LOCATION_MODES = {
  ADDRESS: 'address',
  STRUCTURE: 'structure',
  BUILDINGS: 'buildings',
};

/** @type {Array<{value: string, label: string, icon: string}>} */
export const LOCATION_MODE_OPTIONS = [
  { value: LOCATION_MODES.ADDRESS, label: 'Address', icon: 'PublicIcon' },
  { value: LOCATION_MODES.STRUCTURE, label: 'Structure', icon: 'StructureIcon' },
];

// ============================================================================
// FORM VALIDATION
// ============================================================================

export const VALIDATION_RULES = {
  TITLE: {
    required: true,
    minLength: 3,
    maxLength: 200,
  },
  DESCRIPTION: {
    required: false,
    maxLength: 5000,
  },
  AGENDA: {
    required: false,
    maxLength: 50000,
  },
};

// ============================================================================
// DEFAULT VALUES
// ============================================================================

export const DEFAULT_RECURRENCE = {
  enabled: false,
  type: 'weekly',
  interval: 1,
  days: ['monday'],
  day_of_month: 1,
  end_option: 'never',
  end_date: null,
  max_occurrences: null,
};

export const DEFAULT_MEETING_FORM = {
  title: '',
  description: '',
  meeting_date: null,
  start_time: null,
  end_time: null,
  location_text: '',
  location_id: null,
  location_details: null,
  agenda: '',
  secretary_name: '',
  gps_latitude: '',
  gps_longitude: '',
};

// ============================================================================
// EXPORT ALL
// ============================================================================

export default {
  STEPS,
  WEEK_DAYS,
  ADDRESS_LEVELS,
  BUILDING_LEVELS,
  ALL_LOCATION_LEVELS,
  RECURRENCE_TYPES,
  END_OPTIONS,
  RECURRENCE_PRESETS,
  VISIBILITY_OPTIONS,
  PARTICIPANT_TABS,
  PARTICIPANT_ROLES,
  PARTICIPANT_ROLES_OPTIONS,
  MEETING_STATUSES,
  MEETING_STATUS_OPTIONS,
  LOCATION_MODES,
  LOCATION_MODE_OPTIONS,
  VALIDATION_RULES,
  DEFAULT_RECURRENCE,
  DEFAULT_MEETING_FORM,
  MAX_PARTICIPANTS,
  // Helpers
  getDayByValue,
  getDayByIndex,
  getLocationLevel,
  getRecurrenceType,
  getRecurrenceIntervalText,
  isRestrictedVisibility,
};