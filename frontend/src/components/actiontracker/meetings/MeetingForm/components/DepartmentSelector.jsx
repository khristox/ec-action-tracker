// src/components/meetings/MeetingForm/components/DepartmentSelector.jsx
//
// ADJUST THIS IMPORT to wherever your axios instance lives (the one that logs
// "API Request:" from api.js). Everything else is self-contained.
import api from '../../../../../services/api';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ListSubheader,
  TextField,
  InputAdornment,
  Box,
  Stack,
  Typography,
  Chip,
  Avatar,
  IconButton,
  FormHelperText,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';

const ENDPOINT = '/auth/me/departments';

// ----------------------------------------------------------------------------
// Module-level cache + in-flight de-duplication.
//
// This is what stops the repeated /auth/me/departments calls. Two mounts (or
// React StrictMode's double-invoke in dev) now share one promise instead of
// firing one request each, and a remount reuses the cached list instead of
// clearing it and re-fetching — which is what made a selection appear to
// vanish while the list was momentarily empty.
// ----------------------------------------------------------------------------
let cache = null;
let inFlight = null;

// IMPORTANT: meetings.restricted_department_id has a foreign key to
// organization_nodes.id. /auth/me/departments returns the current user's
// *memberships*, whose own `id` is the membership row — not the node. Reading
// `id` first sends the membership id and the insert fails with
// ForeignKeyViolationError. Node-shaped keys are therefore checked first, and
// plain `id` is only the last resort (for when the endpoint really does return
// node objects).
const NODE_ID_KEYS = [
  'organization_node_id',
  'node_id',
  'department_id',
  'organization_id',
  'id',
];

const pickNodeId = (d) => {
  for (const key of NODE_ID_KEYS) {
    const v = d?.[key];
    if (v !== undefined && v !== null && v !== '') return String(v);
  }
  return '';
};

const normaliseDepartment = (d) => ({
  id: pickNodeId(d),
  name: d?.name ?? d?.department_name ?? d?.node_name ?? d?.title ?? 'Unnamed department',
  role: d?.role ?? d?.membership_role ?? d?.member_role ?? null,
  raw: d,
});

const extractList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.departments)) return payload.departments;
  return [];
};

const loadDepartments = ({ force = false } = {}) => {
  if (!force && cache) return Promise.resolve(cache);
  if (!force && inFlight) return inFlight;

  inFlight = api
    .get(ENDPOINT)
    .then((res) => {
      const raw = extractList(res?.data ?? res);

      // One-time dev log so the real payload shape is visible without a
      // network-tab hunt. Confirm which key holds the organization_nodes id,
      // then trim NODE_ID_KEYS to just that one.
      if (import.meta.env?.DEV && raw.length) {
        console.debug('[DepartmentSelector] raw record:', raw[0]);
      }

      const list = raw.map(normaliseDepartment).filter((d) => d.id);
      cache = list;
      return list;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
};

/** Call after the user joins/leaves a department elsewhere in the app. */
export const invalidateDepartmentCache = () => {
  cache = null;
  inFlight = null;
};

// ============================================================================
// Component
// ============================================================================

export const DepartmentSelector = ({
  value,
  onChange,
  disabled = false,
  required = false,
  error = false,
  helperText,
  label = 'Department',
}) => {
  const [departments, setDepartments] = useState(() => cache ?? []);
  const [loading, setLoading] = useState(() => !cache);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState('');

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchList = useCallback((opts) => {
    setLoading(true);
    setLoadError(null);
    return loadDepartments(opts)
      .then((list) => {
        if (!mountedRef.current) return;
        setDepartments(list);
      })
      .catch((err) => {
        if (!mountedRef.current) return;
        setLoadError(
          err?.response?.data?.detail ||
            err?.message ||
            'Could not load departments'
        );
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
  }, []);

  // Empty dependency array on purpose. fetchList is stable, and nothing about
  // this fetch depends on props — listing `onChange` or `value` here is what
  // makes the request loop.
  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // --------------------------------------------------------------------------
  // Controlled value.
  //
  // Always a string, never undefined, so MUI cannot flip the Select from
  // controlled to uncontrolled (the warning you were seeing at line 305).
  // --------------------------------------------------------------------------
  const selectedId = value === null || value === undefined ? '' : String(value);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return departments;
    return departments.filter((d) => d.name.toLowerCase().includes(q));
  }, [departments, search]);

  // If a department is selected but is not in the currently rendered list —
  // because the list is still loading, or the search filtered it out — render
  // a hidden MenuItem for it anyway. Without this the value is out of range,
  // MUI renders an empty control, and the selection looks like it was lost.
  const selectedIsRenderable = filtered.some((d) => d.id === selectedId);
  const selectedDepartment = departments.find((d) => d.id === selectedId);

  const handleChange = useCallback(
    (event) => {
      const next = event.target.value;
      const id = next === '' ? null : next;
      // Second argument is the full department object, so the parent can also
      // record the name (for the Review step) without a second lookup.
      const dept = id ? departments.find((d) => d.id === id) ?? null : null;
      onChange?.(id, dept);
    },
    [onChange, departments]
  );

  const handleRefresh = useCallback(
    (event) => {
      event.stopPropagation();
      fetchList({ force: true });
    },
    [fetchList]
  );

  const renderRow = (dept) => (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
      <Avatar sx={{ width: 28, height: 28, fontSize: 13 }}>
        {dept.name?.charAt(0)?.toUpperCase() || <BusinessIcon sx={{ fontSize: 16 }} />}
      </Avatar>
      <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
        {dept.name}
      </Typography>
      {dept.role && (
        <Chip
          label={dept.role}
          size="small"
          variant="outlined"
          sx={{ height: 20, textTransform: 'capitalize' }}
        />
      )}
    </Stack>
  );

  return (
    <FormControl
      fullWidth
      disabled={disabled}
      required={required}
      error={Boolean(error || loadError)}
    >
      <InputLabel id="department-selector-label">{label}</InputLabel>
      <Select
        labelId="department-selector-label"
        id="department-selector"
        label={label}
        value={selectedId}
        onChange={handleChange}
        // Close on select, and reset the search so the next open starts clean.
        onClose={() => setSearch('')}
        renderValue={() => {
          if (!selectedId) return null;
          if (selectedDepartment) return renderRow(selectedDepartment);
          // Selected but not yet loaded — show a placeholder rather than blank.
          return (
            <Typography variant="body2" color="text.secondary">
              {loading ? 'Loading…' : 'Selected department'}
            </Typography>
          );
        }}
        MenuProps={{
          autoFocus: false,
          PaperProps: { sx: { maxHeight: 380 } },
        }}
      >
        {/* Search. ListSubheader is not a menu item, so it will not be
            selected by MUI's type-ahead or arrow keys. */}
        <ListSubheader sx={{ p: 1, bgcolor: 'background.paper' }}>
          <TextField
            size="small"
            fullWidth
            autoFocus
            placeholder="Search departments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            // Stop the Select stealing keystrokes for its type-ahead, and
            // stop Escape/Space closing the menu while typing.
            onKeyDown={(e) => e.stopPropagation()}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
        </ListSubheader>

        {/* Keeps the controlled value in range while loading or filtering. */}
        {selectedId && !selectedIsRenderable && (
          <MenuItem value={selectedId} sx={{ display: 'none' }}>
            {selectedDepartment ? renderRow(selectedDepartment) : selectedId}
          </MenuItem>
        )}

        {loading && departments.length === 0 && (
          <MenuItem disabled>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <CircularProgress size={16} />
              <Typography variant="body2">Loading departments…</Typography>
            </Stack>
          </MenuItem>
        )}

        {!loading && filtered.length === 0 && (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              {search ? 'No departments match that search' : 'No departments available'}
            </Typography>
          </MenuItem>
        )}

        {filtered.map((dept) => (
          <MenuItem key={dept.id} value={dept.id}>
            {renderRow(dept)}
          </MenuItem>
        ))}

        {/* Footer: count + refresh. */}
        <ListSubheader
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            py: 0.5,
            bgcolor: 'background.paper',
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {filtered.length} available
          </Typography>
          <Tooltip title="Reload departments">
            <span>
              <IconButton size="small" onClick={handleRefresh} disabled={loading}>
                <RefreshIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>
        </ListSubheader>
      </Select>

      <FormHelperText>
        {loadError ||
          helperText ||
          'Only members of the selected department can access this meeting'}
      </FormHelperText>
    </FormControl>
  );
};

export default DepartmentSelector;