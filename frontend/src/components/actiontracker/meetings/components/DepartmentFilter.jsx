// src/components/actiontracker/meetings/components/DepartmentFilter.jsx
//
// Lets someone in a higher-level department narrow the meetings list to one
// department, optionally including everything below it.
// ADJUST this import to wherever your axios instance lives.
import api from '../../../../services/api';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material';

/**
 * Props
 *   value            department id or '' for "All departments"
 *   includeChildren  boolean
 *   onChange({ departmentId, includeChildren })
 *
 * Renders nothing when the user has only one department and no sub-departments,
 * because there is nothing to filter by.
 */
export const DepartmentFilter = ({ value = '', includeChildren = true, onChange, size = 'small' }) => {
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    let active = true;
    api
      .get('/auth/me/accessible-departments')
      .then((res) => {
        if (!active) return;
        const list = Array.isArray(res?.data) ? res.data : [];
        setDepartments(list);
      })
      .catch(() => active && setDepartments([]));
    return () => {
      active = false;
    };
  }, []);

  // Indent by depth relative to the shallowest department the user can see.
  const options = useMemo(() => {
    const minLevel = departments.reduce((m, d) => Math.min(m, d.level ?? 0), Infinity);
    return departments.map((d) => ({
      id: String(d.id),
      name: d.name,
      indent: Math.max(0, (d.level ?? 0) - (Number.isFinite(minLevel) ? minLevel : 0)),
    }));
  }, [departments]);

  if (options.length <= 1) return null;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
      <FormControl size={size} sx={{ minWidth: 220 }}>
        <InputLabel id="meeting-department-filter-label">Department</InputLabel>
        <Select
          labelId="meeting-department-filter-label"
          label="Department"
          value={value || ''}
          onChange={(e) => onChange?.({ departmentId: e.target.value || '', includeChildren })}
        >
          <MenuItem value="">All departments</MenuItem>
          {options.map((o) => (
            <MenuItem key={o.id} value={o.id} sx={{ pl: 2 + o.indent * 2 }}>
              {o.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={includeChildren}
            disabled={!value}
            onChange={(e) => onChange?.({ departmentId: value || '', includeChildren: e.target.checked })}
          />
        }
        label="Include sub-departments"
      />
    </Box>
  );
};

export default DepartmentFilter;
