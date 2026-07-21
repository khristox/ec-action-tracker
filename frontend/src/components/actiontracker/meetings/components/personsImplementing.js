// src/components/actiontracker/meetings/components/personsImplementing.js

/**
 * Persons Implementing utilities for action tracker
 * Handles person selection, privacy, and data management
 */

// ==================== CONSTANTS ====================

// Label shown in place of a masked person's real name
const PRIVATE_NAME_LABEL = 'Private (System User)';
const PRIVATE_FIELD_LABEL = '••••••••';

// Source types for person selection
const SOURCE_TYPES = {
  SYSTEM_USER: 'system_user',
  EXTERNAL: 'external',
  UNKNOWN: 'unknown',
};

// ==================== UTILITY FUNCTIONS ====================

/**
 * Generate a unique row ID for a person entry
 */
const generateRowId = () => {
  return `row_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Check if a person row is from a private/system user source
 */
export const isPersonSourcePrivate = (row) => {
  if (!row) return false;
  if (row.source_type === SOURCE_TYPES.SYSTEM_USER) return true;
  if (row.assigned_to_id && !row.name) return true;
  if (row.is_private === true) return true;
  return false;
};

/**
 * Get display information for a person row with privacy protection
 * Completely camouflages phone and email for system users
 */
export const getPersonDisplayInfo = (row) => {
  if (!row) {
    return {
      displayName: '',
      displayEmail: '',
      displayPhone: '',
      isPrivate: false,
    };
  }

  const isPrivate = isPersonSourcePrivate(row);

  if (isPrivate) {
    return {
      displayName: PRIVATE_NAME_LABEL,
      displayEmail: PRIVATE_FIELD_LABEL,
      displayPhone: PRIVATE_FIELD_LABEL,
      isPrivate: true,
    };
  }

  return {
    displayName: row.name || '',
    displayEmail: row.email || '',
    displayPhone: row.phone || '',
    isPrivate: false,
  };
};

/**
 * Create an empty person object
 */
export const createEmptyPerson = () => {
  return {
    row_id: generateRowId(),
    name: '',
    email: '',
    phone: '',
    assigned_to_id: null,
    source_type: SOURCE_TYPES.EXTERNAL,
    is_private: false,
  };
};

/**
 * Update a person in the array
 */
export const updatePerson = (persons, rowId, patch) => {
  if (!persons || !Array.isArray(persons)) return [];
  return persons.map((person) => {
    if (person.row_id !== rowId) return person;
    if (patch.assigned_to_id === null) {
      return {
        ...person,
        ...patch,
        source_type: SOURCE_TYPES.EXTERNAL,
        is_private: false,
      };
    }
    return { ...person, ...patch };
  });
};

/**
 * Remove a person from the array
 */
export const removePerson = (persons, rowId) => {
  if (!persons || !Array.isArray(persons)) return [];
  return persons.filter((person) => person.row_id !== rowId);
};

/**
 * Handle person picked from AssignToSelector
 */
export const handlePersonPicked = (persons, rowId, picked) => {
  if (!persons || !Array.isArray(persons)) return [];
  
  return persons.map((person) => {
    if (person.row_id !== rowId) return person;

    if (!picked) {
      return {
        ...person,
        assigned_to_id: null,
        name: '',
        email: '',
        phone: '',
        source_type: SOURCE_TYPES.EXTERNAL,
        is_private: false,
      };
    }

    const isSystemUser = picked.is_system_user === true || picked.source === 'system_user';
    
    if (isSystemUser) {
      return {
        ...person,
        assigned_to_id: picked.id,
        name: PRIVATE_NAME_LABEL,
        email: PRIVATE_FIELD_LABEL,
        phone: PRIVATE_FIELD_LABEL,
        source_type: SOURCE_TYPES.SYSTEM_USER,
        is_private: true,
      };
    }

    return {
      ...person,
      assigned_to_id: picked.id,
      name: picked.name || '',
      email: picked.email || '',
      phone: picked.phone || '',
      source_type: SOURCE_TYPES.EXTERNAL,
      is_private: false,
    };
  });
};

/**
 * Build the payload for API submission
 */
export const buildPersonsPayload = (persons) => {
  if (!persons || !Array.isArray(persons)) {
    return { persons_implementing: [] };
  }

  const cleaned = persons.map((person) => {
    if (isPersonSourcePrivate(person)) {
      return {
        assigned_to_id: person.assigned_to_id,
        source_type: person.source_type || SOURCE_TYPES.SYSTEM_USER,
        is_private: true,
      };
    }

    return {
      name: person.name || '',
      email: person.email || '',
      phone: person.phone || '',
      assigned_to_id: person.assigned_to_id || null,
      source_type: person.source_type || SOURCE_TYPES.EXTERNAL,
      is_private: false,
    };
  });

  return { persons_implementing: cleaned };
};

/**
 * Parse persons from an action object (for editing)
 */
export const parsePersonsFromAction = (action) => {
  if (!action) return [];
  
  const personsData = action.persons_implementing || action.persons || [];
  
  if (!Array.isArray(personsData) || personsData.length === 0) {
    return [];
  }

  return personsData.map((person, index) => {
    const isPrivate = person.is_private === true || 
                      person.source_type === SOURCE_TYPES.SYSTEM_USER ||
                      (person.assigned_to_id && !person.name);

    return {
      row_id: person.row_id || `row_${Date.now()}_${index}`,
      name: isPrivate ? PRIVATE_NAME_LABEL : (person.name || ''),
      email: isPrivate ? PRIVATE_FIELD_LABEL : (person.email || ''),
      phone: isPrivate ? PRIVATE_FIELD_LABEL : (person.phone || ''),
      assigned_to_id: person.assigned_to_id || null,
      source_type: isPrivate ? SOURCE_TYPES.SYSTEM_USER : (person.source_type || SOURCE_TYPES.EXTERNAL),
      is_private: isPrivate,
    };
  });
};