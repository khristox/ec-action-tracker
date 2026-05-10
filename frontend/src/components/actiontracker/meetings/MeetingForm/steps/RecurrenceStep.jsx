// src/components/meetings/MeetingForm/steps/RecurrenceStep.jsx
import React from 'react';
import { RecurrenceSection } from '../components/RecurrenceSection';

export const RecurrenceStep = ({ recurrence, setRecurrence, startDate, mappingsLoading }) => {
  if (mappingsLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading recurrence settings...</p>
        </div>
      </div>
    );
  }

  return (
    <RecurrenceSection
      recurrence={recurrence}
      setRecurrence={setRecurrence}
      startDate={startDate}
    />
  );
};