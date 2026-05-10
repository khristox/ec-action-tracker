// src/utils/dayMapping.js
import api from '../services/api';

// Cache for day mappings
let DAY_NAME_TO_UUID = {};
let UUID_TO_DAY_NAME = {};
let isLoaded = false;
let loadPromise = null;

// Fetch day attributes from the API
export const fetchDayAttributes = async () => {
  if (isLoaded) return { DAY_NAME_TO_UUID, UUID_TO_DAY_NAME };
  
  // Prevent multiple simultaneous requests
  if (loadPromise) return loadPromise;
  
  loadPromise = (async () => {
    try {
      const response = await api.get('/attribute-groups/RECURRING_MEETING/attributes', {
        params: {
          active_only: true,
          detail_level: 'limited',
          sort_by: 'sort_order',
          sort_order: 'asc',
          limit: 100
        }
      });
      
      const attributes = response.data?.items || response.data || [];
      
      // Filter only day attributes (those with RECURRENCE_DAY_ in code)
      const dayAttributes = attributes.filter(attr => 
        attr.code && attr.code.startsWith('RECURRENCE_DAY_')
      );
      
      // Build the mappings
      dayAttributes.forEach(attr => {
        // Extract day name from metadata or from name field
        let dayName = '';
        
        // Try to get from mextra_metadata
        if (attr.mextra_metadata && attr.mextra_metadata.value) {
          dayName = attr.mextra_metadata.value;
        } else if (attr.mextra_metadata && attr.mextra_metadata.day_name) {
          dayName = attr.mextra_metadata.day_name.toLowerCase();
        } else {
          // Fallback to name field
          dayName = attr.name.toLowerCase();
        }
        
        DAY_NAME_TO_UUID[dayName] = attr.id;
        UUID_TO_DAY_NAME[attr.id] = attr.name;
      });
      
      isLoaded = true;
      console.log('Day attributes loaded:', DAY_NAME_TO_UUID);
      return { DAY_NAME_TO_UUID, UUID_TO_DAY_NAME };
    } catch (error) {
      console.error('Failed to fetch day attributes:', error);
      // Fallback to hardcoded UUIDs from your data
      DAY_NAME_TO_UUID = {
        'monday': '76685763-c370-4d18-a96b-1ad103a3212f',
        'tuesday': 'a887d009-2664-4e2b-affb-26cae4c8bfa8',
        'wednesday': 'c43b16e9-c773-40d9-a004-cbe746635730',
        'thursday': '83ba8158-84a0-4d2b-9c4e-b411328843d7',
        'friday': '013ea5ff-a988-4e6b-b794-7a85b81e9034',
        'saturday': '9f89ab4e-75ff-4910-8867-f37e14de51e8',
        'sunday': '1738c0ae-3898-4ed2-9636-2697ecbad68a'
      };
      UUID_TO_DAY_NAME = Object.entries(DAY_NAME_TO_UUID).reduce((acc, [name, uuid]) => {
        acc[uuid] = name.charAt(0).toUpperCase() + name.slice(1);
        return acc;
      }, {});
      isLoaded = true;
      return { DAY_NAME_TO_UUID, UUID_TO_DAY_NAME };
    }
  })();
  
  return loadPromise;
};

// Convert day names to UUIDs for API submission
export const mapDaysToUUIDs = async (dayNames) => {
  if (!Array.isArray(dayNames)) return [];
  await fetchDayAttributes(); // Ensure mappings are loaded
  return dayNames
    .map(day => DAY_NAME_TO_UUID[day.toLowerCase()])
    .filter(uuid => uuid !== undefined);
};

// Convert UUIDs to day names for display
export const mapUUIDsToDays = async (uuids) => {
  if (!Array.isArray(uuids)) return [];
  await fetchDayAttributes(); // Ensure mappings are loaded
  return uuids
    .map(uuid => UUID_TO_DAY_NAME[uuid])
    .filter(day => day !== undefined);
};

// Synchronous version for when mappings are already loaded
export const mapDaysToUUIDsSync = (dayNames) => {
  if (!Array.isArray(dayNames)) return [];
  return dayNames
    .map(day => DAY_NAME_TO_UUID[day.toLowerCase()])
    .filter(uuid => uuid !== undefined);
};

// Synchronous version for when mappings are already loaded
export const mapUUIDsToDaysSync = (uuids) => {
  if (!Array.isArray(uuids)) return [];
  return uuids
    .map(uuid => UUID_TO_DAY_NAME[uuid])
    .filter(day => day !== undefined);
};

// Check if days are already UUIDs
export const areDaysUUIDs = (days) => {
  if (!Array.isArray(days) || days.length === 0) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return days.every(day => uuidRegex.test(day));
};

// Get all day options for UI components (async)
export const getDayOptions = async () => {
  await fetchDayAttributes();
  return [
    { id: DAY_NAME_TO_UUID['monday'], name: 'Monday', short: 'Mon', index: 1, value: 'monday' },
    { id: DAY_NAME_TO_UUID['tuesday'], name: 'Tuesday', short: 'Tue', index: 2, value: 'tuesday' },
    { id: DAY_NAME_TO_UUID['wednesday'], name: 'Wednesday', short: 'Wed', index: 3, value: 'wednesday' },
    { id: DAY_NAME_TO_UUID['thursday'], name: 'Thursday', short: 'Thu', index: 4, value: 'thursday' },
    { id: DAY_NAME_TO_UUID['friday'], name: 'Friday', short: 'Fri', index: 5, value: 'friday' },
    { id: DAY_NAME_TO_UUID['saturday'], name: 'Saturday', short: 'Sat', index: 6, value: 'saturday' },
    { id: DAY_NAME_TO_UUID['sunday'], name: 'Sunday', short: 'Sun', index: 0, value: 'sunday' }
  ];
};

// Get day options synchronously (will throw if not loaded)
export const getDayOptionsSync = () => {
  if (!isLoaded) {
    console.warn('Day options not loaded yet, call fetchDayAttributes() first');
    return [];
  }
  return [
    { id: DAY_NAME_TO_UUID['monday'], name: 'Monday', short: 'Mon', index: 1, value: 'monday' },
    { id: DAY_NAME_TO_UUID['tuesday'], name: 'Tuesday', short: 'Tue', index: 2, value: 'tuesday' },
    { id: DAY_NAME_TO_UUID['wednesday'], name: 'Wednesday', short: 'Wed', index: 3, value: 'wednesday' },
    { id: DAY_NAME_TO_UUID['thursday'], name: 'Thursday', short: 'Thu', index: 4, value: 'thursday' },
    { id: DAY_NAME_TO_UUID['friday'], name: 'Friday', short: 'Fri', index: 5, value: 'friday' },
    { id: DAY_NAME_TO_UUID['saturday'], name: 'Saturday', short: 'Sat', index: 6, value: 'saturday' },
    { id: DAY_NAME_TO_UUID['sunday'], name: 'Sunday', short: 'Sun', index: 0, value: 'sunday' }
  ];
};

// Helper to get UUID from day name (async)
export const getDayUUID = async (dayName) => {
  await fetchDayAttributes();
  return DAY_NAME_TO_UUID[dayName.toLowerCase()];
};

// Helper to get day name from UUID (async)
export const getDayName = async (uuid) => {
  await fetchDayAttributes();
  return UUID_TO_DAY_NAME[uuid];
};

// Check if mappings are loaded
export const isDayMappingLoaded = () => isLoaded;