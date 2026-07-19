// src/components/actiontracker/meetings/components/personsImplementing.js

/**
 * Parse persons implementing from an action object
 * @param {Object} action - The action object from the API
 * @returns {Array} Array of person objects with row_id, assigned_to_id, name, phone, email
 */
export const parsePersonsFromAction = (action) => {
  if (!action) return [];

  // If the action already has a persons_implementing array, use it
  if (Array.isArray(action.persons_implementing) && action.persons_implementing.length > 0) {
    return action.persons_implementing.map((p) => ({
      row_id: `p_${p.id || Math.random().toString(36).slice(2, 7)}`,
      assigned_to_id: p.assigned_to_id || p.id || null,
      name: p.name || p.full_name || '',
      phone: p.phone || p.telephone || '',
      email: p.email || ''
    }));
  }

  // Fallback: parse from legacy single assignee fields
  let parsedAssignment = null;

  if (action.assigned_to_name) {
    try {
      const data = typeof action.assigned_to_name === 'string'
        ? JSON.parse(action.assigned_to_name)
        : action.assigned_to_name;

      parsedAssignment = {
        type: data.type || 'manual',
        id: data.id,
        name: data.name || data.full_name || data.username,
        email: data.email,
        phone: data.phone || data.telephone,
        assigned_to_id: action.assigned_to_id || data.id,
        assigned_to_name: data
      };
    } catch (e) {
      parsedAssignment = {
        type: 'manual',
        id: null,
        name: action.assigned_to_name,
        email: '',
        phone: '',
        assigned_to_id: null,
        assigned_to_name: { name: action.assigned_to_name, type: 'manual' }
      };
    }
  } else if (action.assigned_to) {
    parsedAssignment = {
      type: 'user',
      id: action.assigned_to.id,
      name: action.assigned_to.full_name || action.assigned_to.username,
      email: action.assigned_to.email,
      phone: action.assigned_to.phone || action.assigned_to.telephone,
      assigned_to_id: action.assigned_to.id,
    };
  }

  if (parsedAssignment) {
    return [{
      row_id: `p_${parsedAssignment.assigned_to_id || 'legacy'}`,
      assigned_to_id: parsedAssignment.assigned_to_id || null,
      name: parsedAssignment.name || '',
      phone: parsedAssignment.phone || '',
      email: parsedAssignment.email || ''
    }];
  }

  return [];
};

/**
 * Build payload for persons implementing
 * @param {Array} persons - Array of person objects
 * @returns {Object} Object with persons_implementing, assigned_to_id, and assigned_to_name
 */
export const buildPersonsPayload = (persons) => {
  const cleanedPersons = (persons || [])
    .filter((p) => p.name?.trim() || p.email?.trim() || p.phone?.trim())
    .map((p) => ({
      id: p.assigned_to_id || null,
      name: p.name?.trim() || '',
      email: p.email?.trim() || '',
      phone: p.phone?.trim() || ''
    }));

  const firstPerson = cleanedPersons[0];

  return {
    persons_implementing: cleanedPersons,
    assigned_to_id: firstPerson?.id || null,
    assigned_to_name: firstPerson
      ? { 
          name: firstPerson.name, 
          email: firstPerson.email, 
          phone: firstPerson.phone, 
          type: firstPerson.id ? 'user' : 'manual' 
        }
      : null
  };
};

/**
 * Create an empty person row
 * @returns {Object} Empty person object
 */
export const createEmptyPerson = () => ({
  row_id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  assigned_to_id: null,
  name: '',
  phone: '',
  email: ''
});

/**
 * Add a person to the list
 * @param {Array} persons - Current list of persons
 * @returns {Array} New list with empty person added
 */
export const addPerson = (persons) => {
  return [...persons, createEmptyPerson()];
};

/**
 * Remove a person from the list
 * @param {Array} persons - Current list of persons
 * @param {string} rowId - ID of the person to remove
 * @returns {Array} New list without the person
 */
export const removePerson = (persons, rowId) => {
  return persons.filter((p) => p.row_id !== rowId);
};

/**
 * Update a person in the list
 * @param {Array} persons - Current list of persons
 * @param {string} rowId - ID of the person to update
 * @param {Object} patch - Properties to update
 * @returns {Array} New list with updated person
 */
export const updatePerson = (persons, rowId, patch) => {
  return persons.map((p) => (p.row_id === rowId ? { ...p, ...patch } : p));
};

/**
 * Handle person picked from selector
 * @param {Array} persons - Current list of persons
 * @param {string} rowId - ID of the person to update
 * @param {Object|null} picked - Picked user object or null
 * @returns {Array} New list with updated person
 */
export const handlePersonPicked = (persons, rowId, picked) => {
  if (!picked) {
    return updatePerson(persons, rowId, { assigned_to_id: null });
  }
  return updatePerson(persons, rowId, {
    assigned_to_id: picked.id || picked.assigned_to_id || null,
    name: picked.name || '',
    email: picked.email || '',
    phone: picked.phone || ''
  });
};