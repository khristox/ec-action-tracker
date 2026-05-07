// src/components/actiontracker/meetings/hooks/useStatusInfo.js
import { useMemo } from 'react';
import { getStatusConfig } from '../utils/helpers';

export const useStatusInfo = (status) => {
  return useMemo(() => {
    return getStatusConfig(status);
  }, [status]);
};