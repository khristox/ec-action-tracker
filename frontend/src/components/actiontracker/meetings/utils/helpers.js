// src/components/actiontracker/meetings/utils/helpers.js
import { alpha } from '@mui/material';
import { COLORS } from '../styles/colors';

// Status configuration without JSX
export const STATUS_CONFIG_MAP = {
  'ended': { label: 'Ended', iconName: 'StopCircleIcon', color: COLORS.ended, bgColor: alpha(COLORS.ended, 0.1) },
  'started': { label: 'In Progress', iconName: 'PlayCircleIcon', color: COLORS.started, bgColor: alpha(COLORS.started, 0.1) },
  'ongoing': { label: 'Ongoing', iconName: 'PlayCircleIcon', color: COLORS.ongoing, bgColor: alpha(COLORS.ongoing, 0.1) },
  'in_progress': { label: 'In Progress', iconName: 'PlayCircleIcon', color: COLORS.in_progress, bgColor: alpha(COLORS.in_progress, 0.1) },
  'pending': { label: 'Pending', iconName: 'PendingIcon', color: COLORS.pending, bgColor: alpha(COLORS.pending, 0.1) },
  'scheduled': { label: 'Scheduled', iconName: 'ScheduleOutlinedIcon', color: COLORS.scheduled, bgColor: alpha(COLORS.scheduled, 0.1) },
  'completed': { label: 'Completed', iconName: 'CheckCircleIcon', color: COLORS.completed, bgColor: alpha(COLORS.completed, 0.1) },
  'closed': { label: 'Closed', iconName: 'CheckCircleIcon', color: COLORS.closed, bgColor: alpha(COLORS.closed, 0.1) },
  'cancelled': { label: 'Cancelled', iconName: 'CancelIcon', color: COLORS.cancelled, bgColor: alpha(COLORS.cancelled, 0.1) },
  'awaiting': { label: 'Awaiting', iconName: 'AccessTimeIcon', color: COLORS.awaiting, bgColor: alpha(COLORS.awaiting, 0.1) },
  'postponed': { label: 'Postponed', iconName: 'AccessTimeIcon', color: COLORS.postponed, bgColor: alpha(COLORS.postponed, 0.1) },
  'active': { label: 'Active', iconName: 'RepeatIcon', color: COLORS.success, bgColor: alpha(COLORS.success, 0.1) },
  'inactive': { label: 'Inactive', iconName: 'WarningAmberIcon', color: COLORS.warning, bgColor: alpha(COLORS.warning, 0.1) }
};

// Get status configuration with enhanced null safety
export const getStatusConfig = (status) => {
  // Handle null/undefined
  if (!status) {
    return { 
      label: 'Pending', 
      iconName: 'PendingIcon',
      color: COLORS.pending, 
      bgColor: alpha(COLORS.pending, 0.1) 
    };
  }
  
  let statusCode = null;
  
  try {
    // Handle string status
    if (typeof status === 'string') {
      statusCode = status.toLowerCase();
    }
    // Handle status object with short_name
    else if (status.short_name) {
      statusCode = status.short_name.toLowerCase();
    }
    // Handle status object with code
    else if (status.code) {
      const codeParts = status.code.split('_');
      statusCode = codeParts[codeParts.length - 1].toLowerCase();
    }
    // Handle status object with name
    else if (status.name) {
      const nameParts = status.name.split(' - ');
      statusCode = nameParts[nameParts.length - 1].toLowerCase();
    }
    // Handle status with value
    else if (status.value) {
      statusCode = status.value.toLowerCase();
    }
  } catch (error) {
    console.warn('Error parsing status:', error);
    statusCode = null;
  }
  
  // Check if we have a matching config
  if (statusCode && STATUS_CONFIG_MAP[statusCode]) {
    return STATUS_CONFIG_MAP[statusCode];
  }
  
  // Return default config
  return { 
    label: statusCode || 'Unknown', 
    iconName: 'PendingIcon', 
    color: COLORS.secondary, 
    bgColor: alpha(COLORS.secondary, 0.1) 
  };
};

// Format date with validation
export const formatDate = (dateStr, fallback = 'Not scheduled') => {
  if (!dateStr) return fallback;
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return fallback;
    
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  } catch (error) {
    console.warn('Error formatting date:', error);
    return fallback;
  }
};

// Format time with validation
export const formatTime = (timeStr, fallback = 'TBD') => {
  if (!timeStr) return fallback;
  
  try {
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) return fallback;
    
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } catch (error) {
    console.warn('Error formatting time:', error);
    return fallback;
  }
};

// Format datetime with validation
export const formatDateTime = (dateStr, fallback = 'Not scheduled') => {
  if (!dateStr) return fallback;
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return fallback;
    
    return `${formatDate(dateStr)} at ${formatTime(dateStr)}`;
  } catch (error) {
    console.warn('Error formatting datetime:', error);
    return fallback;
  }
};

// Get recurrence description with enhanced safety
export const getRecurrenceDescription = (recurrence, fallback = 'Recurring meeting') => {
  // Handle null/undefined
  if (!recurrence || typeof recurrence !== 'object') {
    return fallback;
  }
  
  try {
    // Try to get recurrence data from different possible structures
    let interval = recurrence.recurrence_interval;
    let type = recurrence.recurrence_type;
    
    // Handle type as object with value
    if (type && typeof type === 'object') {
      type = type.value || type.code || type.name;
    }
    
    // Handle type as string
    if (type && typeof type === 'string') {
      type = type.toLowerCase();
    }
    
    // Handle interval as string
    if (interval && typeof interval === 'string') {
      interval = parseInt(interval, 10);
    }
    
    // Handle interval as number or default to 1
    const intervalNum = (interval && typeof interval === 'number') ? interval : 1;
    
    // Return description based on type
    if (type === 'weekly') {
      const days = recurrence.recurrence_days;
      if (days && Array.isArray(days) && days.length > 0) {
        const dayNames = days.map(d => {
          if (typeof d === 'object') return d.name || d.value;
          return d;
        }).join(', ');
        return `Every ${intervalNum} week(s) on ${dayNames}`;
      }
      return `Every ${intervalNum} week(s)`;
    }
    
    if (type === 'biweekly') {
      return `Every ${intervalNum * 2} weeks`;
    }
    
    if (type === 'monthly') {
      const dayOfMonth = recurrence.recurrence_day_of_month;
      if (dayOfMonth && dayOfMonth > 0) {
        return `Every ${intervalNum} month(s) on day ${dayOfMonth}`;
      }
      return `Every ${intervalNum} month(s)`;
    }
    
    if (type === 'daily') {
      return `Every ${intervalNum} day(s)`;
    }
    
    if (type === 'quarterly') {
      return `Every ${intervalNum * 3} month(s)`;
    }
    
    if (type === 'yearly') {
      return `Every year`;
    }
    
    // Fallback using just interval
    if (intervalNum === 1) return 'Weekly';
    if (intervalNum === 2) return 'Bi-weekly';
    if (intervalNum === 3) return 'Every 3 weeks';
    if (intervalNum === 4) return 'Monthly';
    if (intervalNum === 6) return 'Every 6 weeks';
    if (intervalNum === 8) return 'Every 2 months';
    if (intervalNum === 12) return 'Quarterly';
    if (intervalNum === 26) return 'Every 6 months';
    if (intervalNum === 52) return 'Yearly';
    
    return `Every ${intervalNum} weeks`;
    
  } catch (error) {
    console.warn('Error getting recurrence description:', error);
    return fallback;
  }
};

// Get recurrence type from interval
export const getRecurrenceTypeFromInterval = (interval) => {
  if (!interval) return 'weekly';
  
  const intervalNum = typeof interval === 'string' ? parseInt(interval, 10) : interval;
  
  if (intervalNum === 1) return 'weekly';
  if (intervalNum === 2) return 'biweekly';
  if (intervalNum === 4) return 'monthly';
  if (intervalNum === 12) return 'quarterly';
  if (intervalNum === 52) return 'yearly';
  
  return 'weekly';
};

// Get interval from recurrence type
export const getIntervalFromRecurrenceType = (type) => {
  if (!type) return 1;
  
  const typeStr = typeof type === 'string' ? type.toLowerCase() : type;
  
  const typeMap = {
    'daily': 1,
    'weekly': 1,
    'biweekly': 2,
    'monthly': 4,
    'quarterly': 12,
    'yearly': 52
  };
  
  return typeMap[typeStr] || 1;
};

// Get status chip color
export const getStatusColor = (status) => {
  const config = getStatusConfig(status);
  return config.color;
};

// Get status label
export const getStatusLabel = (status) => {
  const config = getStatusConfig(status);
  return config.label;
};

// Format duration between two dates
export const formatDuration = (startDate, endDate) => {
  if (!startDate || !endDate) return 'Duration not set';
  
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return 'Invalid dates';
    }
    
    const diffMs = end - start;
    const diffMins = Math.round(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
    }
    
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    
    if (mins === 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
    
    return `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''}`;
  } catch (error) {
    console.warn('Error formatting duration:', error);
    return 'Duration not set';
  }
};

// Check if date is in the past
export const isPastDate = (dateStr) => {
  if (!dateStr) return false;
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;
    
    return date < new Date();
  } catch (error) {
    return false;
  }
};

// Check if date is today
export const isToday = (dateStr) => {
  if (!dateStr) return false;
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;
    
    const today = new Date();
    return date.toDateString() === today.toDateString();
  } catch (error) {
    return false;
  }
};

// Get relative date (Today, Tomorrow, Yesterday, or formatted date)
export const getRelativeDate = (dateStr) => {
  if (!dateStr) return 'Not scheduled';
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Invalid date';
    
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    return formatDate(dateStr);
  } catch (error) {
    return formatDate(dateStr);
  }
};

// Sort meetings by next occurrence date
export const sortMeetingsByNextDate = (meetings) => {
  if (!meetings || !Array.isArray(meetings)) return [];
  
  return [...meetings].sort((a, b) => {
    const dateA = a.next_occurrence_date ? new Date(a.next_occurrence_date) : new Date(8640000000000000);
    const dateB = b.next_occurrence_date ? new Date(b.next_occurrence_date) : new Date(8640000000000000);
    return dateA - dateB;
  });
};

// Get meeting status from meeting object
export const getMeetingStatus = (meeting) => {
  if (!meeting) return 'pending';
  
  if (meeting.status === 'active' && meeting.next_occurrence_date) {
    return 'active';
  }
  if (meeting.status === 'active' && !meeting.next_occurrence_date) {
    return 'completed';
  }
  if (meeting.status === 'inactive') {
    return 'inactive';
  }
  
  return meeting.status || 'pending';
};