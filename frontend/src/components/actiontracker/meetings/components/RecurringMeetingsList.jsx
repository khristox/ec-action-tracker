// src/components/actiontracker/meetings/components/RecurringMeetingsList.jsx
import { useState, useMemo, useRef, useCallback } from 'react';
import {
  Grid, Typography, Box, CircularProgress, Alert, Button, Stack, Paper,
  useMediaQuery, useTheme, TextField, InputAdornment,
  ToggleButton, ToggleButtonGroup, Chip, IconButton, MenuItem,
  FormControl, InputLabel, Select, Pagination, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TableSortLabel,
  alpha, Divider, SwipeableDrawer,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
  CalendarToday as CalendarIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Repeat as RepeatIcon,
  TuneRounded as TuneIcon,
  Close as Close,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
} from '@mui/icons-material';
import { RecurringMeetingCard } from './RecurringMeetingCard';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getStatusColor = (status) => {
  switch (status) {
    case 'active': return 'success';
    case 'inactive': return 'error';
    case 'completed': return 'info';
    default: return 'default';
  }
};

const getStatusIcon = (status) => {
  switch (status) {
    case 'active': return <CheckCircleIcon fontSize="small" />;
    case 'inactive': return <WarningIcon fontSize="small" />;
    case 'completed': return <CheckCircleIcon fontSize="small" />;
    default: return <RepeatIcon fontSize="small" />;
  }
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses', color: 'default' },
  { value: 'active', label: 'Active', color: 'success' },
  { value: 'inactive', label: 'Paused', color: 'warning' },
  { value: 'completed', label: 'Completed', color: 'info' },
];

const SORT_OPTIONS = [
  { value: 'next_date', label: 'Next date' },
  { value: 'title', label: 'Title' },
  { value: 'created', label: 'Date created' },
  { value: 'total', label: 'Total generated' },
];

// ─── Mobile Filters Drawer ────────────────────────────────────────────────────
const MobileFiltersDrawer = ({ 
  open, 
  onClose, 
  statusFilter, 
  setStatusFilter, 
  sortBy, 
  setSortBy, 
  sortOrder, 
  setSortOrder, 
  onApply 
}) => {
  const theme = useTheme();
  const [localStatus, setLocalStatus] = useState(statusFilter);
  const [localSortBy, setLocalSortBy] = useState(sortBy);
  const [localSortOrder, setLocalSortOrder] = useState(sortOrder);

  const handleApply = useCallback(() => {
    setStatusFilter(localStatus);
    setSortBy(localSortBy);
    setSortOrder(localSortOrder);
    onApply?.();
    onClose();
  }, [localStatus, localSortBy, localSortOrder, setStatusFilter, setSortBy, setSortOrder, onApply, onClose]);

  const handleReset = useCallback(() => {
    setLocalStatus('all');
    setLocalSortBy('next_date');
    setLocalSortOrder('asc');
  }, []);

  const handleSortOptionClick = useCallback((value) => {
    if (localSortBy === value) {
      setLocalSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setLocalSortBy(value);
      setLocalSortOrder('asc');
    }
  }, [localSortBy]);

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      onOpen={() => {}}
      disableSwipeToOpen
      slotProps={{
        paper: {
          sx: {
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            pb: 'env(safe-area-inset-bottom)',
            maxHeight: '85vh',
          }
        }
      }}
    >
      {/* Handle */}
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5, pb: 0.5 }}>
        <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: 'divider' }} />
      </Box>

      {/* Header */}
      <Stack 
        direction="row" 
        spacing={1}
        sx={{ 
          px: 2.5, 
          py: 1.5,
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Typography variant="h6" fontWeight={700}>Filters & Sort</Typography>
        <Stack direction="row" spacing={1}>
          <Button 
            size="small" 
            onClick={handleReset} 
            sx={{ textTransform: 'none', color: 'text.secondary' }}
          >
            Reset
          </Button>
          <IconButton size="small" onClick={onClose} aria-label="Close filters">
            <Close fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>

      <Divider />

      <Box sx={{ px: 2.5, py: 2.5, overflowY: 'auto' }}>
        {/* Status filter */}
        <Typography 
          variant="overline" 
          color="text.disabled" 
          sx={{ letterSpacing: 1.5, fontSize: '0.65rem', display: 'block', mb: 1.5 }}
        >
          Status
        </Typography>
        <Stack 
          direction="row" 
          spacing={1} 
          useFlexGap 
          sx={{ flexWrap: 'wrap', gap: 1, mb: 3 }}
        >
          {STATUS_OPTIONS.map(opt => (
            <Chip
              key={opt.value}
              label={opt.label}
              clickable
              color={localStatus === opt.value ? opt.color || 'primary' : 'default'}
              variant={localStatus === opt.value ? 'filled' : 'outlined'}
              onClick={() => setLocalStatus(opt.value)}
              sx={{ 
                borderRadius: 2, 
                fontWeight: localStatus === opt.value ? 700 : 400,
                '&:hover': {
                  transform: 'translateY(-1px)',
                  transition: 'transform 0.15s ease',
                }
              }}
            />
          ))}
        </Stack>

        {/* Sort by */}
        <Typography 
          variant="overline" 
          color="text.disabled" 
          sx={{ letterSpacing: 1.5, fontSize: '0.65rem', display: 'block', mb: 1.5 }}
        >
          Sort by
        </Typography>
        <Stack direction="column" spacing={1} sx={{ mb: 3 }}>
          {SORT_OPTIONS.map(opt => {
            const isActive = localSortBy === opt.value;
            return (
              <Paper
                key={opt.value}
                elevation={0}
                onClick={() => handleSortOptionClick(opt.value)}
                sx={{
                  p: 1.5, 
                  borderRadius: 2, 
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: isActive ? 'primary.main' : 'divider',
                  bgcolor: isActive ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: isActive ? 'primary.main' : 'text.secondary',
                    bgcolor: isActive ? alpha(theme.palette.primary.main, 0.08) : alpha(theme.palette.action.hover, 0.04),
                  }
                }}
              >
                <Typography variant="body2" fontWeight={isActive ? 600 : 400}>
                  {opt.label}
                </Typography>
                {isActive && (
                  <Stack 
                    direction="row" 
                    spacing={0.5} 
                    sx={{ alignItems: 'center' }}
                  >
                    <Typography variant="caption" color="primary.main" fontWeight={600}>
                      {localSortOrder === 'asc' ? 'Ascending' : 'Descending'}
                    </Typography>
                    {localSortOrder === 'asc' ? 
                      <ArrowUpwardIcon fontSize="small" color="primary" /> : 
                      <ArrowDownwardIcon fontSize="small" color="primary" />
                    }
                  </Stack>
                )}
              </Paper>
            );
          })}
        </Stack>
      </Box>

      {/* Apply button */}
      <Box sx={{ px: 2.5, pb: 2.5, pt: 1 }}>
        <Button
          variant="contained"
          fullWidth
          size="large"
          onClick={handleApply}
          sx={{ 
            borderRadius: 3, 
            textTransform: 'none', 
            fontWeight: 700, 
            py: 1.5,
            '&:hover': {
              transform: 'translateY(-2px)',
              transition: 'transform 0.2s ease',
            }
          }}
        >
          Apply filters
        </Button>
      </Box>
    </SwipeableDrawer>
  );
};

// ─── Stat Pill ────────────────────────────────────────────────────────────────
const StatPill = ({ label, value, color }) => (
  <Box sx={{
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center',
    px: 1.5, 
    py: 0.75,
    flex: 1, 
    minWidth: 0,
  }}>
    <Typography variant="h6" fontWeight={800} color={color} sx={{ lineHeight: 1.1 }}>
      {value}
    </Typography>
    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', whiteSpace: 'nowrap' }}>
      {label}
    </Typography>
  </Box>
);

// ─── Search Bar Component ─────────────────────────────────────────────────────
const SearchBar = ({ value, onChange, onClear }) => (
  <TextField
    placeholder="Search meetings…"
    value={value}
    onChange={onChange}
    size="small"
    sx={{
      flex: 1,
      '& .MuiOutlinedInput-root': { borderRadius: 2.5 },
    }}
    slotProps={{
      input: {
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon fontSize="small" color="action" />
          </InputAdornment>
        ),
        endAdornment: value && (
          <InputAdornment position="end">
            <IconButton size="small" onClick={onClear} edge="end" aria-label="Clear search">
              <ClearIcon fontSize="small" />
            </IconButton>
          </InputAdornment>
        ),
      }
    }}
  />
);

// ─── Main Component ───────────────────────────────────────────────────────────
export const RecurringMeetingsList = ({
  meetings = [],
  loading = false,
  error = null,
  onView,
  onEdit,
  onGenerate,
  onRefresh,
  totalCount = 0,
  onPageChange,
  currentPage = 1,
  rowsPerPage = 12,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery('(max-width:600px)');
  const isTablet = useMediaQuery('(max-width:960px)');

  const containerRef = useRef(null);
  const [internalPage, setInternalPage] = useState(1);
  const activePage = onPageChange ? currentPage : internalPage;

  const [viewMode, setViewMode] = useState('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('next_date');
  const [sortOrder, setSortOrder] = useState('asc');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const meetingsArray = Array.isArray(meetings) ? meetings : [];

  // Filter and sort
  const filteredAndSortedMeetings = useMemo(() => {
    let filtered = [...meetingsArray];

    if (searchTerm) {
      const q = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(m =>
        m.title?.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q) ||
        m.location_text?.toLowerCase().includes(q) ||
        m.recurrence_type?.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(m => m.status === statusFilter);
    }

    filtered.sort((a, b) => {
      let vA, vB;
      switch (sortBy) {
        case 'title': 
          vA = (a.title || '').toLowerCase(); 
          vB = (b.title || '').toLowerCase(); 
          break;
        case 'created': 
          vA = new Date(a.created_at || 0); 
          vB = new Date(b.created_at || 0); 
          break;
        case 'total': 
          vA = a.total_occurrences_generated || 0; 
          vB = b.total_occurrences_generated || 0; 
          break;
        default:
          vA = a.next_occurrence_date ? new Date(a.next_occurrence_date) : new Date(8640000000000000);
          vB = b.next_occurrence_date ? new Date(b.next_occurrence_date) : new Date(8640000000000000);
      }
      return sortOrder === 'asc' ? (vA > vB ? 1 : -1) : (vA < vB ? 1 : -1);
    });

    return filtered;
  }, [meetingsArray, searchTerm, statusFilter, sortBy, sortOrder]);

  const paginatedMeetings = useMemo(() => {
    const start = (activePage - 1) * rowsPerPage;
    return filteredAndSortedMeetings.slice(start, start + rowsPerPage);
  }, [filteredAndSortedMeetings, activePage, rowsPerPage]);

  const totalFilteredCount = filteredAndSortedMeetings.length;
  const totalPages = Math.ceil(totalFilteredCount / rowsPerPage);

  const stats = useMemo(() => ({
    total: meetingsArray.length,
    active: meetingsArray.filter(m => m.status === 'active' && m.next_occurrence_date).length,
    generated: meetingsArray.reduce((sum, m) => sum + (m.total_occurrences_generated || 0), 0),
    completed: meetingsArray.filter(m => m.status === 'completed').length,
    inactive: meetingsArray.filter(m => m.status === 'inactive').length,
  }), [meetingsArray]);

  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (sortBy !== 'next_date' ? 1 : 0);

  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value);
    if (onPageChange) onPageChange(1);
    else setInternalPage(1);
  }, [onPageChange]);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    if (onPageChange) onPageChange(1);
    else setInternalPage(1);
  }, [onPageChange]);

  const handlePageChange = useCallback((_, page) => {
    if (onPageChange) onPageChange(page);
    else setInternalPage(page);
    
    try {
      if (containerRef.current) {
        containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      let el = containerRef.current?.parentElement;
      while (el) {
        const { overflowY } = window.getComputedStyle(el);
        if (overflowY === 'auto' || overflowY === 'scroll') {
          el.scrollTo({ top: 0, behavior: 'smooth' });
          break;
        }
        el = el.parentElement;
      }
    } catch (e) {
      // fallback
    }
  }, [onPageChange]);

  const handleViewModeChange = useCallback((_, newMode) => {
    if (newMode) setViewMode(newMode);
  }, []);

  const handleStatusFilterChange = useCallback((e) => {
    setStatusFilter(e.target.value);
    if (onPageChange) onPageChange(1);
    else setInternalPage(1);
  }, [onPageChange]);

  const handleSortChange = useCallback((field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  }, [sortBy]);

  const renderTableRow = useCallback((meeting) => {
    const nextDate = meeting.next_occurrence_date
      ? new Date(meeting.next_occurrence_date).toLocaleDateString() : 'Ended';
    return (
      <TableRow 
        key={meeting.id} 
        hover 
        sx={{ cursor: 'pointer', '&:last-child td, &:last-child th': { border: 0 } }} 
        onClick={() => onView(meeting.id)}
      >
        <TableCell>
          <Stack spacing={0.5}>
            <Typography variant="body2" fontWeight={600}>{meeting.title}</Typography>
            {meeting.description && (
              <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 300 }}>
                {meeting.description}
              </Typography>
            )}
          </Stack>
        </TableCell>
        <TableCell>
          <Chip 
            label={meeting.recurrence_type || 'Weekly'} 
            size="small" 
            variant="outlined" 
            icon={<RepeatIcon fontSize="small" />} 
          />
        </TableCell>
        <TableCell>
          <Typography variant="body2">{nextDate}</Typography>
          {meeting.next_occurrence_date && (
            <Typography variant="caption" color="text.secondary">
              {new Date(meeting.next_occurrence_date).toLocaleTimeString()}
            </Typography>
          )}
        </TableCell>
        <TableCell>
          <Chip 
            label={meeting.status || 'Active'} 
            size="small" 
            color={getStatusColor(meeting.status)} 
            icon={getStatusIcon(meeting.status)} 
          />
        </TableCell>
        <TableCell align="center">
          <Typography variant="body2" fontWeight={600}>{meeting.total_occurrences_generated || 0}</Typography>
        </TableCell>
        <TableCell align="right">
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
            <Button 
              size="small" 
              variant="outlined" 
              onClick={(e) => { e.stopPropagation(); onGenerate(meeting.id); }}
              sx={{ textTransform: 'none' }}
            >
              Generate
            </Button>
            <Button 
              size="small" 
              variant="contained" 
              onClick={(e) => { e.stopPropagation(); onEdit(meeting.id); }}
              sx={{ textTransform: 'none' }}
            >
              Edit
            </Button>
          </Stack>
        </TableCell>
      </TableRow>
    );
  }, [onView, onGenerate, onEdit]);

  const renderListItem = useCallback((meeting) => {
    const nextDate = meeting.next_occurrence_date
      ? new Date(meeting.next_occurrence_date).toLocaleDateString() : 'Ended';
    return (
      <Paper 
        key={meeting.id} 
        sx={{
          p: 2, 
          mb: 1.5, 
          borderRadius: 2.5,
          border: '1px solid', 
          borderColor: 'divider',
          transition: 'all 0.2s ease',
          '&:hover': { 
            boxShadow: theme.shadows[3], 
            transform: 'translateY(-2px)',
            borderColor: 'primary.light',
          }
        }}
      >
        <Stack 
          direction="row" 
          spacing={2} 
          flexWrap="wrap"
          sx={{ 
            alignItems: 'flex-start',
            justifyContent: 'space-between' 
          }}
        >
          <Box sx={{ flex: 1, minWidth: '200px' }}>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 0.75, alignItems: 'center' }}>
              <Typography variant="subtitle2" fontWeight={700}>{meeting.title}</Typography>
              <Chip 
                label={meeting.status || 'Active'} 
                size="small" 
                color={getStatusColor(meeting.status)} 
              />
              <Chip 
                label={meeting.recurrence_type || 'Weekly'} 
                size="small" 
                variant="outlined" 
              />
            </Stack>
            {meeting.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {meeting.description}
              </Typography>
            )}
            <Stack direction="row" spacing={2} flexWrap="wrap">
              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                <CalendarIcon sx={{ fontSize: 14 }} color="action" />
                <Typography variant="caption" color="text.secondary">
                  Next: <strong>{nextDate}</strong>
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                <RepeatIcon sx={{ fontSize: 14 }} color="action" />
                <Typography variant="caption" color="text.secondary">
                  Generated: <strong>{meeting.total_occurrences_generated || 0}</strong>
                </Typography>
              </Stack>
            </Stack>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button 
              size="small" 
              variant="outlined" 
              onClick={() => onGenerate(meeting.id)}
              sx={{ textTransform: 'none' }}
            >
              Generate
            </Button>
            <Button 
              size="small" 
              variant="contained" 
              onClick={() => onEdit(meeting.id)}
              sx={{ textTransform: 'none' }}
            >
              Edit
            </Button>
          </Stack>
        </Stack>
      </Paper>
    );
  }, [theme, onGenerate, onEdit]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8, minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ py: 4, px: isMobile ? 2 : 0 }}>
        <Alert 
          severity="error" 
          action={onRefresh && (
            <Button color="inherit" size="small" onClick={onRefresh} startIcon={<RefreshIcon />}>
              Retry
            </Button>
          )} 
          sx={{ borderRadius: 2 }}
        >
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box 
      ref={containerRef} 
      sx={{
        px: { xs: 0, sm: 2, md: 3 },
        pb: { xs: 2, sm: 3 },
        maxWidth: { sm: '100%', md: 1400 },
        mx: 'auto',
      }}
    >
      {/* ── Stats bar ── */}
      <Box sx={{
        mx: { xs: 1.5, sm: 0 },
        mb: { xs: 2, sm: 2.5 },
        p: { xs: 1.25, sm: 2 },
        bgcolor: 'background.paper',
        borderRadius: 3,
        border: '1px solid', 
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'stretch',
        overflow: 'hidden',
      }}>
        <StatPill label="Total" value={stats.total} color="primary.main" />
        <Divider orientation="vertical" flexItem />
        <StatPill label="Active" value={stats.active} color="success.main" />
        <Divider orientation="vertical" flexItem />
        <StatPill label="Generated" value={stats.generated} color="info.main" />
        {!isMobile && (
          <>
            <Divider orientation="vertical" flexItem />
            <StatPill label="Completed" value={stats.completed} color="warning.main" />
            <Divider orientation="vertical" flexItem />
            <StatPill label="Paused" value={stats.inactive} color="error.main" />
          </>
        )}
      </Box>

      {/* ── Search & Filter bar ── */}
      <Box sx={{ px: { xs: 1.5, sm: 0 }, mb: { xs: 1.5, sm: 2.5 } }}>
        <Stack 
          direction="row" 
          spacing={1} 
          useFlexGap
          sx={{ 
            flexWrap: 'wrap', 
            gap: 1, 
            alignItems: 'center' 
          }}
        >
          {/* Search */}
          <SearchBar
            value={searchTerm}
            onChange={handleSearchChange}
            onClear={clearSearch}
          />

          {/* View toggle — hidden on mobile */}
          {!isMobile && (
            <ToggleButtonGroup 
              value={viewMode} 
              exclusive 
              onChange={handleViewModeChange} 
              size="small"
              sx={{ flexShrink: 0 }}
            >
              <ToggleButton value="grid" aria-label="Grid view">
                <ViewModuleIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="list" aria-label="List view">
                <ViewListIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="table" aria-label="Table view">
                <ViewListIcon fontSize="small" sx={{ transform: 'rotate(90deg)' }} />
              </ToggleButton>
            </ToggleButtonGroup>
          )}

          {/* Mobile: filter drawer trigger with badge */}
          {isMobile ? (
            <Box sx={{ position: 'relative', flexShrink: 0 }}>
              <IconButton
                onClick={() => setFiltersOpen(true)}
                sx={{
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: activeFilterCount > 0 ? 'primary.main' : 'divider',
                  bgcolor: activeFilterCount > 0 ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                  p: 1,
                  '&:hover': {
                    bgcolor: activeFilterCount > 0 ? alpha(theme.palette.primary.main, 0.12) : 'action.hover',
                  }
                }}
                aria-label="Open filters"
              >
                <TuneIcon fontSize="small" color={activeFilterCount > 0 ? 'primary' : 'action'} />
              </IconButton>
              {activeFilterCount > 0 && (
                <Box sx={{
                  position: 'absolute', 
                  top: -4, 
                  right: -4,
                  width: 18, 
                  height: 18, 
                  borderRadius: '50%',
                  bgcolor: 'primary.main', 
                  color: 'white',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: '0.6rem', 
                  fontWeight: 700,
                  boxShadow: theme.shadows[2],
                }}>
                  {activeFilterCount}
                </Box>
              )}
            </Box>
          ) : (
            /* Desktop: status filter inline */
            <FormControl size="small" sx={{ minWidth: 130, flexShrink: 0 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={handleStatusFilterChange}
                label="Status"
                sx={{ borderRadius: 2 }}
              >
                {STATUS_OPTIONS.map(opt => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Stack>

        {/* Active filter chips (mobile) */}
        {isMobile && (statusFilter !== 'all' || searchTerm) && (
          <Stack 
            direction="row" 
            spacing={1} 
            useFlexGap
            flexWrap="wrap"
            sx={{ mt: 1.25 }} 
          >
            {statusFilter !== 'all' && (
              <Chip
                label={statusFilter}
                size="small"
                color={getStatusColor(statusFilter)}
                onDelete={() => setStatusFilter('all')}
                sx={{ borderRadius: 1.5, textTransform: 'capitalize', fontWeight: 600 }}
              />
            )}
            {searchTerm && (
              <Chip
                label={`"${searchTerm}"`}
                size="small"
                variant="outlined"
                onDelete={clearSearch}
                sx={{ borderRadius: 1.5 }}
              />
            )}
          </Stack>
        )}
      </Box>

      {/* ── Results summary ── */}
      {meetingsArray.length > 0 && filteredAndSortedMeetings.length > 0 && (
        <Typography 
          variant="caption" 
          color="text.disabled" 
          sx={{ px: { xs: 1.5, sm: 0 }, mb: 1.5, display: 'block' }}
        >
          Showing {paginatedMeetings.length} of {totalFilteredCount} meetings
          {statusFilter !== 'all' && ` · Filtered by: ${statusFilter}`}
        </Typography>
      )}

      {/* ── No results ── */}
      {meetingsArray.length > 0 && filteredAndSortedMeetings.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8, px: 3 }}>
          <Typography fontSize={48} mb={1}>🔍</Typography>
          <Typography variant="h6" fontWeight={600} color="text.secondary" gutterBottom>
            No matches found
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Try adjusting your search or filters
          </Typography>
          <Button 
            onClick={() => { clearSearch(); setStatusFilter('all'); }} 
            variant="outlined" 
            sx={{ borderRadius: 2, textTransform: 'none' }}
          >
            Clear all filters
          </Button>
        </Box>
      )}

      {/* ── Empty state ── */}
      {meetingsArray.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8, px: 3 }}>
          <Typography fontSize={56} mb={1.5}>📅</Typography>
          <Typography variant="h6" fontWeight={600} color="text.secondary" gutterBottom>
            No recurring meetings
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320, mx: 'auto' }}>
            Create your first recurring meeting series to get started
          </Typography>
        </Box>
      )}

      {/* ── Grid View ── */}
      {viewMode === 'grid' && filteredAndSortedMeetings.length > 0 && (
        <Box
          sx={{
            px: { xs: 1.5, sm: 0 },
            display: 'grid',
            gridTemplateColumns: isMobile
              ? '1fr'
              : isTablet
                ? 'repeat(2, 1fr)'
                : 'repeat(3, 1fr)',
            gap: isMobile ? 1.5 : 2.5,
          }}
        >
          {paginatedMeetings.map((meeting) => (
            <RecurringMeetingCard
              key={meeting.id}
              meeting={meeting}
              onView={onView}
              onEdit={onEdit}
              onGenerate={onGenerate}
              showStats
            />
          ))}
        </Box>
      )}

      {/* ── List View ── */}
      {viewMode === 'list' && filteredAndSortedMeetings.length > 0 && (
        <Box sx={{ px: { xs: 1.5, sm: 0 } }}>
          {paginatedMeetings.map(renderListItem)}
        </Box>
      )}

      {/* ── Table View (desktop only) ── */}
      {viewMode === 'table' && filteredAndSortedMeetings.length > 0 && !isMobile && (
        <TableContainer 
          component={Paper} 
          sx={{ 
            borderRadius: 3, 
            overflowX: 'auto', 
            border: '1px solid', 
            borderColor: 'divider',
            '& .MuiTable-root': {
              minWidth: 750,
            }
          }} 
          elevation={0}
        >
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                {[
                  { field: 'title', label: 'Meeting', align: 'left' },
                  { field: null, label: 'Recurrence', align: 'left' },
                  { field: 'next_date', label: 'Next Date', align: 'left' },
                  { field: null, label: 'Status', align: 'left' },
                  { field: 'total', label: 'Generated', align: 'center' },
                  { field: null, label: 'Actions', align: 'right' },
                ].map(col => (
                  <TableCell 
                    key={col.label} 
                    align={col.align} 
                    sx={{ fontWeight: 700, py: 1.5 }}
                  >
                    {col.field ? (
                      <TableSortLabel
                        active={sortBy === col.field}
                        direction={sortBy === col.field ? sortOrder : 'asc'}
                        onClick={() => handleSortChange(col.field)}
                      >
                        {col.label}
                      </TableSortLabel>
                    ) : col.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedMeetings.map(renderTableRow)}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && filteredAndSortedMeetings.length > 0 && (
        <Box sx={{ display: 'flex', mt: 3, px: { xs: 1.5, sm: 0 }, justifyContent: 'center' }}>
          <Pagination
            count={totalPages}
            page={activePage}
            onChange={handlePageChange}
            color="primary"
            size={isMobile ? 'small' : 'medium'}
            showFirstButton
            showLastButton
            siblingCount={isMobile ? 0 : 1}
          />
        </Box>
      )}

      {/* ── Refresh ── */}
      {meetingsArray.length > 0 && filteredAndSortedMeetings.length > 0 && onRefresh && (
        <Box sx={{ display: 'flex', mt: 2, justifyContent: 'center' }}>
          <Button 
            variant="text" 
            onClick={onRefresh} 
            startIcon={<RefreshIcon />} 
            size="small" 
            sx={{ color: 'text.secondary', textTransform: 'none' }}
          >
            Refresh
          </Button>
        </Box>
      )}

      {/* ── Mobile filters drawer ── */}
      <MobileFiltersDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        onApply={() => { if (onPageChange) onPageChange(1); }}
      />
    </Box>
  );
};