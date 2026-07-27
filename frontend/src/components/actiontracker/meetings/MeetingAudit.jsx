// src/components/actiontracker/meetings/MeetingAudit.jsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  Paper,
  Typography,
  Box,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  CircularProgress,
  Avatar,
  Tooltip,
  IconButton,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  Pagination,
  Button,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  alpha,
  useTheme,
  Fade
} from '@mui/material';
import {
  Info as InfoIcon,
  History as HistoryIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  Person as PersonIcon,
  Edit as Edit,
  Delete as Delete,
  Add as Add,
  Update as UpdateIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as Cancel,
  Schedule as ScheduleIcon,
  Link as LinkIcon,
  Assignment as AssignmentIcon,
  People as PeopleIcon,
  Description as DescriptionIcon,
  Close as Close,
  ExpandMore as ExpandMoreIcon,
  Difference as DifferenceIcon,
  Code as CodeIcon,
  ContentCopy as ContentCopyIcon,
  Check as CheckIcon,
  RemoveCircle as RemoveCircleIcon,
  AddCircle as AddCircleIcon,
  Construction as ConstructionIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import api from '../../../services/api';

// Helper function to format values for display
const formatValue = (value) => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string' && value.length > 200) return value.substring(0, 200) + '...';
  return String(value);
};

// Helper function to detect if value is JSON
const isJsonString = (str) => {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
};

// Helper: pull the entity table name from whichever field the payload provides
const getEntityLabel = (log) => (log.table_name || log.entity_type || 'meeting');

// Helper: pull the entity/record id from whichever field the payload provides
const getEntityId = (log) => (log.record_id || log.entity_id || null);

// Helper: pull the human-readable description from whichever field the payload provides
const getDescription = (log) => (log.changes_summary || log.details || null);

// Component to display field changes
const FieldChange = ({ field, oldValue, newValue }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [expanded, setExpanded] = useState(false);

  const formattedOld = formatValue(oldValue);
  const formattedNew = formatValue(newValue);
  const isOldJson = typeof oldValue === 'object' || isJsonString(formattedOld);
  const isNewJson = typeof newValue === 'object' || isJsonString(formattedNew);

  return (
    <Accordion 
      expanded={expanded} 
      onChange={() => setExpanded(!expanded)} 
      sx={{ 
        mb: 1,
        bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'transparent',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : alpha(theme.palette.divider, 0.1)}`,
        borderRadius: 2,
        '&:before': { display: 'none' },
      }}
    >
      <AccordionSummary 
        expandIcon={<ExpandMoreIcon sx={{ color: isDark ? '#9CA3AF' : 'text.secondary' }} />}
        sx={{
          '&:hover': {
            bgcolor: isDark ? 'rgba(255,255,255,0.04)' : alpha(theme.palette.primary.main, 0.02),
          },
          borderRadius: 2,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <DifferenceIcon fontSize="small" sx={{ color: isDark ? '#818CF8' : 'primary.main' }} />
          <Typography variant="subtitle2" fontWeight={600} sx={{ color: isDark ? '#E5E7EB' : 'text.primary' }}>
            {field}
          </Typography>
          <Chip 
            label={`${formattedOld !== formattedNew ? 'Changed' : 'No Change'}`} 
            size="small" 
            color={formattedOld !== formattedNew ? 'warning' : 'default'}
            sx={{ 
              ml: 1,
              ...(isDark && {
                '& .MuiChip-label': { color: '#D1D5DB' },
              })
            }}
          />
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper 
              variant="outlined" 
              sx={{ 
                p: 2, 
                bgcolor: isDark ? alpha('#EF4444', 0.06) : alpha(theme.palette.error.main, 0.04),
                borderColor: isDark ? alpha('#EF4444', 0.15) : alpha(theme.palette.error.main, 0.1),
                height: '100%',
                borderRadius: 2,
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <RemoveCircleIcon fontSize="small" sx={{ color: isDark ? '#F87171' : 'error.main' }} />
                <Typography variant="caption" sx={{ color: isDark ? '#F87171' : 'error.main' }} fontWeight={600}>
                  Old Value
                </Typography>
              </Stack>
              {isOldJson ? (
                <Box
                  component="pre"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    m: 0,
                    p: 1,
                    bgcolor: isDark ? 'rgba(0,0,0,0.3)' : 'background.paper',
                    borderRadius: 1,
                    maxHeight: 300,
                    overflow: 'auto',
                    color: isDark ? '#D1D5DB' : 'text.primary',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'divider'}`,
                  }}
                >
                  {formattedOld}
                </Box>
              ) : (
                <Typography variant="body2" sx={{ wordBreak: 'break-all', color: isDark ? '#D1D5DB' : 'text.primary' }}>
                  {formattedOld}
                </Typography>
              )}
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper 
              variant="outlined" 
              sx={{ 
                p: 2, 
                bgcolor: isDark ? alpha('#10B981', 0.06) : alpha(theme.palette.success.main, 0.04),
                borderColor: isDark ? alpha('#10B981', 0.15) : alpha(theme.palette.success.main, 0.1),
                height: '100%',
                borderRadius: 2,
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <AddCircleIcon fontSize="small" sx={{ color: isDark ? '#34D399' : 'success.main' }} />
                <Typography variant="caption" sx={{ color: isDark ? '#34D399' : 'success.main' }} fontWeight={600}>
                  New Value
                </Typography>
              </Stack>
              {isNewJson ? (
                <Box
                  component="pre"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    m: 0,
                    p: 1,
                    bgcolor: isDark ? 'rgba(0,0,0,0.3)' : 'background.paper',
                    borderRadius: 1,
                    maxHeight: 300,
                    overflow: 'auto',
                    color: isDark ? '#D1D5DB' : 'text.primary',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'divider'}`,
                  }}
                >
                  {formattedNew}
                </Box>
              ) : (
                <Typography variant="body2" sx={{ wordBreak: 'break-all', color: isDark ? '#D1D5DB' : 'text.primary' }}>
                  {formattedNew}
                </Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
};

// Component to display JSON diff
const JsonDiffViewer = ({ oldData, newData }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const getDifferences = (oldObj, newObj, path = '') => {
    const differences = [];
    const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);

    for (const key of allKeys) {
      const oldVal = oldObj?.[key];
      const newVal = newObj?.[key];
      const currentPath = path ? `${path}.${key}` : key;

      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        if (typeof oldVal === 'object' && typeof newVal === 'object' && oldVal !== null && newVal !== null) {
          const nestedDiffs = getDifferences(oldVal, newVal, currentPath);
          if (nestedDiffs.length > 0) {
            differences.push(...nestedDiffs);
          }
        } else {
          differences.push({
            field: currentPath,
            oldValue: oldVal,
            newValue: newVal,
          });
        }
      }
    }
    return differences;
  };

  const differences = getDifferences(oldData, newData);

  if (differences.length === 0) {
    return (
      <Alert 
        severity="info" 
        icon={<InfoIcon />}
        sx={{
          bgcolor: isDark ? alpha('#3B82F6', 0.08) : undefined,
          color: isDark ? '#93C5FD' : undefined,
          '& .MuiAlert-icon': {
            color: isDark ? '#60A5FA' : undefined,
          },
          borderRadius: 2,
        }}
      >
        No changes detected
      </Alert>
    );
  }

  return (
    <Box>
      <Alert 
        severity="info" 
        sx={{ 
          mb: 2,
          bgcolor: isDark ? alpha('#3B82F6', 0.08) : undefined,
          color: isDark ? '#93C5FD' : undefined,
          '& .MuiAlert-icon': {
            color: isDark ? '#60A5FA' : undefined,
          },
          borderRadius: 2,
        }}
      >
        Found {differences.length} field change{differences.length !== 1 ? 's' : ''}
      </Alert>
      {differences.map((diff, idx) => (
        <FieldChange
          key={idx}
          field={diff.field}
          oldValue={diff.oldValue}
          newValue={diff.newValue}
        />
      ))}
    </Box>
  );
};

const getActionIcon = (action) => {
  const actionLower = action?.toLowerCase() || '';
  
  if (actionLower.includes('create') || actionLower.includes('add')) {
    return <Add fontSize="small" color="success" />;
  }
  if (actionLower.includes('update') || actionLower.includes('edit') || actionLower.includes('modify')) {
    return <UpdateIcon fontSize="small" color="info" />;
  }
  if (actionLower.includes('delete') || actionLower.includes('remove')) {
    return <Delete fontSize="small" color="error" />;
  }
  if (actionLower.includes('status')) {
    return <ScheduleIcon fontSize="small" color="warning" />;
  }
  if (actionLower.includes('assign') || actionLower.includes('assigned')) {
    return <AssignmentIcon fontSize="small" color="primary" />;
  }
  if (actionLower.includes('participant')) {
    return <PeopleIcon fontSize="small" color="secondary" />;
  }
  if (actionLower.includes('minutes')) {
    return <DescriptionIcon fontSize="small" color="success" />;
  }
  if (actionLower.includes('link')) {
    return <LinkIcon fontSize="small" color="info" />;
  }
  if (actionLower.includes('complete')) {
    return <CheckCircleIcon fontSize="small" color="success" />;
  }
  if (actionLower.includes('cancel')) {
    return <Cancel fontSize="small" color="error" />;
  }
  
  return <HistoryIcon fontSize="small" />;
};

const getActionColor = (action) => {
  const actionLower = action?.toLowerCase() || '';
  
  if (actionLower.includes('create') || actionLower.includes('add')) {
    return 'success';
  }
  if (actionLower.includes('update') || actionLower.includes('edit') || actionLower.includes('modify')) {
    return 'info';
  }
  if (actionLower.includes('delete') || actionLower.includes('remove')) {
    return 'error';
  }
  if (actionLower.includes('status')) {
    return 'warning';
  }
  if (actionLower.includes('assign') || actionLower.includes('assigned')) {
    return 'primary';
  }
  if (actionLower.includes('participant')) {
    return 'secondary';
  }
  if (actionLower.includes('minutes')) {
    return 'success';
  }
  if (actionLower.includes('complete')) {
    return 'success';
  }
  if (actionLower.includes('cancel')) {
    return 'error';
  }
  
  return 'default';
};

const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'Unknown time';
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  if (isToday) {
    return `Today at ${format(date, 'h:mm:ss a')}`;
  }
  return format(date, 'MMM d, yyyy • h:mm:ss a');
};

const MeetingAudit = ({ meetingId }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [featureAvailable, setFeatureAvailable] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [users, setUsers] = useState([]);
  const [actions, setActions] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [detailsTab, setDetailsTab] = useState(0);
  const [copied, setCopied] = useState(false);

  const itemsPerPage = 20;

  const fetchAuditLogs = useCallback(async () => {
    if (!meetingId) return;
    
    setLoading(true);
    setError(null);

    try {
      const params = {
        skip: (page - 1) * itemsPerPage,
        limit: itemsPerPage,
        ...(searchTerm && { search: searchTerm }),
        ...(filterAction && { action: filterAction }),
        ...(filterUser && { user_id: filterUser })
      };
      
      const response = await api.get(`/action-tracker/meetings/${meetingId}/audit-logs`, { params });
      const data = response.data?.items || response.data || [];
      setAuditLogs(data);
      setTotalPages(response.data?.pages || Math.ceil((response.data?.total || 0) / itemsPerPage) || 1);
      setTotalItems(response.data?.total || data.length);
      setFeatureAvailable(true);
    } catch (err) {
      if (err.response?.status === 404) {
        setFeatureAvailable(false);
        setError(null);
        setAuditLogs([]);
      } else {
        console.error('Error fetching audit logs:', err);
        setError(err.response?.data?.detail || 'Failed to load audit logs');
      }
    } finally {
      setLoading(false);
    }
  }, [meetingId, page, searchTerm, filterAction, filterUser]);

  const fetchFilterOptions = useCallback(async () => {
    try {
      const response = await api.get(`/action-tracker/meetings/${meetingId}/audit-logs/filters`);
      const data = response.data || {};
      setUsers(data.users || []);
      setActions(data.actions || []);
    } catch (err) {
      if (err.response?.status !== 404) {
        console.debug('Filter options not available:', err.message);
      }
    }
  }, [meetingId]);

  useEffect(() => {
    fetchAuditLogs();
    fetchFilterOptions();
  }, [fetchAuditLogs, fetchFilterOptions]);

  const handleRefresh = () => {
    setFeatureAvailable(true);
    fetchAuditLogs();
    fetchFilterOptions();
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setPage(1);
  };

  const handleFilterActionChange = (action) => {
    setFilterAction(action === filterAction ? '' : action);
    setPage(1);
    handleFilterMenuClose();
  };

  const handleFilterUserChange = (userId) => {
    setFilterUser(userId === filterUser ? '' : userId);
    setPage(1);
    handleFilterMenuClose();
  };

  const handleFilterMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleFilterMenuClose = () => {
    setAnchorEl(null);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterAction('');
    setFilterUser('');
    setPage(1);
  };

  const handleViewDetails = (log) => {
    setSelectedLog(log);
    setDetailsTab(0);
    setShowDetailsDialog(true);
  };

  const handleExportCSV = async () => {
    try {
      const response = await api.get(`/action-tracker/meetings/${meetingId}/audit-logs/export`, {
        params: { format: 'csv' },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `meeting_${meetingId}_audit_logs_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting audit logs:', err);
    }
  };

  const handleCopyJson = async (data) => {
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Show "Coming Soon" when feature is not available (404)
  if (!featureAvailable && !loading) {
    return (
      <Fade in timeout={400}>
        <Paper 
          sx={{ 
            p: { xs: 4, sm: 6 }, 
            textAlign: 'center', 
            borderRadius: 3,
            border: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : theme.palette.divider}`,
            bgcolor: isDark ? alpha(theme.palette.background.paper, 0.5) : alpha(theme.palette.background.paper, 0.8),
          }}
        >
          <ConstructionIcon 
            sx={{ 
              fontSize: 64, 
              color: isDark ? '#FCD34D' : theme.palette.warning.main,
              opacity: 0.6,
              mb: 2
            }} 
          />
          <Typography variant="h5" gutterBottom fontWeight={600} sx={{ color: isDark ? '#F3F4F6' : 'text.primary' }}>
            Audit Logs Coming Soon
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 450, mx: 'auto', mb: 3 }}>
            The audit logs feature is currently under development. 
            You'll be able to see all security and activity logs for this meeting here soon.
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            size="small"
            sx={{ 
              borderRadius: 2,
              borderColor: isDark ? 'rgba(255,255,255,0.2)' : undefined,
              color: isDark ? '#D1D5DB' : undefined,
              '&:hover': {
                borderColor: isDark ? 'rgba(255,255,255,0.3)' : undefined,
                bgcolor: isDark ? 'rgba(255,255,255,0.05)' : undefined,
              }
            }}
          >
            Check Again
          </Button>
        </Paper>
      </Fade>
    );
  }

  if (loading && auditLogs.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ color: isDark ? '#818CF8' : 'primary.main' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert 
        severity="error" 
        sx={{ 
          borderRadius: 2,
          bgcolor: isDark ? alpha('#EF4444', 0.08) : undefined,
          color: isDark ? '#FCA5A5' : undefined,
          '& .MuiAlert-icon': {
            color: isDark ? '#F87171' : undefined,
          },
        }}
        action={
          <Button color="inherit" size="small" onClick={handleRefresh}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  if (auditLogs.length === 0) {
    return (
      <Paper sx={{ 
        p: 6, 
        textAlign: 'center', 
        borderRadius: 3,
        bgcolor: isDark ? alpha(theme.palette.background.paper, 0.5) : undefined,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : theme.palette.divider}`,
      }}>
        <HistoryIcon sx={{ fontSize: 64, color: isDark ? '#4B5563' : '#cbd5e1', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No Audit Logs Found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No activities have been logged for this meeting yet.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      <Stack spacing={3}>
        {/* Header with filters */}
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <HistoryIcon sx={{ color: isDark ? '#818CF8' : 'primary.main' }} />
            <Typography variant="h6" fontWeight={700} sx={{ color: isDark ? '#F3F4F6' : 'text.primary' }}>
              Audit Logs
            </Typography>
            <Chip 
              label={`${totalItems} entries`} 
              size="small" 
              variant="outlined"
              sx={{
                color: isDark ? '#D1D5DB' : undefined,
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : undefined,
              }}
            />
          </Stack>
          
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={handleSearchChange}
              sx={{ 
                width: 250,
                '& .MuiOutlinedInput-root': {
                  color: isDark ? '#D1D5DB' : undefined,
                  '& fieldset': {
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : undefined,
                  },
                  '&:hover fieldset': {
                    borderColor: isDark ? 'rgba(255,255,255,0.2)' : undefined,
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: isDark ? '#818CF8' : undefined,
                  },
                },
                '& .MuiInputLabel-root': {
                  color: isDark ? '#9CA3AF' : undefined,
                },
                '& .MuiInputAdornment-root': {
                  color: isDark ? '#9CA3AF' : undefined,
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: isDark ? '#9CA3AF' : undefined }} />
                  </InputAdornment>
                ),
              }}
            />
            <Tooltip title="Filter">
              <IconButton 
                onClick={handleFilterMenuOpen} 
                size="small"
                sx={{ color: isDark ? '#D1D5DB' : undefined }}
              >
                <FilterListIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export CSV">
              <IconButton 
                onClick={handleExportCSV} 
                size="small"
                sx={{ color: isDark ? '#D1D5DB' : undefined }}
              >
                <DownloadIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton 
                onClick={handleRefresh} 
                size="small"
                sx={{ color: isDark ? '#D1D5DB' : undefined }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {/* Active Filters */}
        {(filterAction || filterUser || searchTerm) && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {filterAction && (
              <Chip
                label={`Action: ${filterAction}`}
                onDelete={() => setFilterAction('')}
                size="small"
                color="primary"
                variant="outlined"
                sx={{
                  color: isDark ? '#D1D5DB' : undefined,
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : undefined,
                }}
              />
            )}
            {filterUser && (
              <Chip
                label={`User: ${users.find(u => u.id === filterUser)?.name || filterUser}`}
                onDelete={() => setFilterUser('')}
                size="small"
                color="primary"
                variant="outlined"
                sx={{
                  color: isDark ? '#D1D5DB' : undefined,
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : undefined,
                }}
              />
            )}
            {searchTerm && (
              <Chip
                label={`Search: ${searchTerm}`}
                onDelete={() => setSearchTerm('')}
                size="small"
                color="primary"
                variant="outlined"
                sx={{
                  color: isDark ? '#D1D5DB' : undefined,
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : undefined,
                }}
              />
            )}
            <Button 
              size="small" 
              onClick={handleClearFilters}
              sx={{ 
                color: isDark ? '#D1D5DB' : undefined,
                '&:hover': {
                  bgcolor: isDark ? 'rgba(255,255,255,0.05)' : undefined,
                }
              }}
            >
              Clear All
            </Button>
          </Stack>
        )}

        {/* Filter Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleFilterMenuClose}
          PaperProps={{ 
            sx: { 
              minWidth: 200, 
              maxHeight: 400,
              bgcolor: isDark ? '#1F2937' : undefined,
              border: isDark ? '1px solid rgba(255,255,255,0.06)' : undefined,
            }
          }}
        >
          <MenuItem disabled sx={{ opacity: 1, fontWeight: 600 }}>
            <Typography variant="subtitle2" sx={{ color: isDark ? '#F3F4F6' : 'text.primary' }}>
              Filter by Action
            </Typography>
          </MenuItem>
          <Divider sx={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : undefined }} />
          {actions.map((action) => (
            <MenuItem 
              key={action} 
              onClick={() => handleFilterActionChange(action)}
              selected={filterAction === action}
              sx={{
                color: isDark ? '#D1D5DB' : undefined,
                '&.Mui-selected': {
                  bgcolor: isDark ? 'rgba(129, 140, 248, 0.15)' : undefined,
                },
                '&:hover': {
                  bgcolor: isDark ? 'rgba(255,255,255,0.05)' : undefined,
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {getActionIcon(action)}
                <Typography variant="body2">{action}</Typography>
              </Box>
            </MenuItem>
          ))}
          
          <Divider sx={{ my: 1, borderColor: isDark ? 'rgba(255,255,255,0.06)' : undefined }} />
          
          <MenuItem disabled sx={{ opacity: 1, fontWeight: 600 }}>
            <Typography variant="subtitle2" sx={{ color: isDark ? '#F3F4F6' : 'text.primary' }}>
              Filter by User
            </Typography>
          </MenuItem>
          <Divider sx={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : undefined }} />
          {users.map((user) => (
            <MenuItem 
              key={user.id} 
              onClick={() => handleFilterUserChange(user.id)}
              selected={filterUser === user.id}
              sx={{
                color: isDark ? '#D1D5DB' : undefined,
                '&.Mui-selected': {
                  bgcolor: isDark ? 'rgba(129, 140, 248, 0.15)' : undefined,
                },
                '&:hover': {
                  bgcolor: isDark ? 'rgba(255,255,255,0.05)' : undefined,
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar 
                  sx={{ 
                    width: 24, 
                    height: 24, 
                    fontSize: '0.75rem',
                    bgcolor: isDark ? '#4B5563' : undefined,
                    color: isDark ? '#D1D5DB' : undefined,
                  }}
                >
                  {user.name?.[0] || user.email?.[0] || 'U'}
                </Avatar>
                <Typography variant="body2">{user.name || user.email}</Typography>
              </Box>
            </MenuItem>
          ))}
        </Menu>

        {/* Audit Logs Table */}
        <TableContainer 
          component={Paper} 
          variant="outlined" 
          sx={{ 
            borderRadius: 2,
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : undefined,
            bgcolor: isDark ? 'transparent' : undefined,
          }}
        >
          <Table>
            <TableHead>
              <TableRow sx={{ 
                bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#f1f5f9',
                '& .MuiTableCell-root': {
                  color: isDark ? '#D1D5DB' : undefined,
                  borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : undefined,
                }
              }}>
                <TableCell sx={{ fontWeight: 700 }}>Timestamp</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>User</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Entity</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {auditLogs.map((log) => (
                <TableRow 
                  key={log.id} 
                  hover
                  sx={{
                    '&:hover': {
                      bgcolor: isDark ? 'rgba(255,255,255,0.02)' : undefined,
                    },
                    '& .MuiTableCell-root': {
                      borderBottom: isDark ? '1px solid rgba(255,255,255,0.04)' : undefined,
                      color: isDark ? '#D1D5DB' : undefined,
                    }
                  }}
                >
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title={formatTimestamp(log.timestamp)}>
                      <Typography variant="body2">
                        {formatTimestamp(log.timestamp)}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Avatar 
                        sx={{ 
                          width: 28, 
                          height: 28, 
                          fontSize: '0.75rem', 
                          bgcolor: isDark ? '#4B5563' : '#6366f1',
                          color: isDark ? '#D1D5DB' : '#fff',
                        }}
                      >
                        {log.username?.[0] || log.user_email?.[0] || 'U'}
                      </Avatar>
                      <Typography variant="body2">
                        {log.username || log.user_email || 'System'}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={log.action}
                      color={getActionColor(log.action)}
                      icon={getActionIcon(log.action)}
                      sx={{ 
                        height: 26, 
                        fontWeight: 500,
                        ...(isDark && {
                          '& .MuiChip-label': { color: '#D1D5DB' },
                          '& .MuiChip-icon': { color: '#D1D5DB' },
                        })
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {getEntityLabel(log).replace(/_/g, ' ')}
                    </Typography>
                    {getEntityId(log) && (
                      <Typography variant="caption" color="text.secondary">
                        ID: {getEntityId(log).substring(0, 12)}...
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ maxWidth: 300 }}>
                      {getDescription(log) || 'No description'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="View Details">
                      <IconButton 
                        size="small" 
                        onClick={() => handleViewDetails(log)}
                        sx={{ color: isDark ? '#9CA3AF' : undefined }}
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(e, value) => setPage(value)}
              color="primary"
              size="large"
              sx={{
                '& .MuiPaginationItem-root': {
                  color: isDark ? '#D1D5DB' : undefined,
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : undefined,
                },
                '& .MuiPaginationItem-root.Mui-selected': {
                  bgcolor: isDark ? 'rgba(129, 140, 248, 0.2)' : undefined,
                  color: isDark ? '#818CF8' : undefined,
                },
                '& .MuiPaginationItem-root:hover': {
                  bgcolor: isDark ? 'rgba(255,255,255,0.05)' : undefined,
                },
              }}
            />
          </Box>
        )}
      </Stack>

      {/* Enhanced Details Dialog */}
      <Dialog 
        open={showDetailsDialog} 
        onClose={() => setShowDetailsDialog(false)} 
        maxWidth="lg" 
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: isDark ? '#1F2937' : undefined,
            borderRadius: 3,
            border: isDark ? '1px solid rgba(255,255,255,0.06)' : undefined,
          }
        }}
      >
        <DialogTitle sx={{ pb: 1, color: isDark ? '#F3F4F6' : undefined }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Chip
                size="medium"
                label={selectedLog?.action}
                color={getActionColor(selectedLog?.action)}
                icon={getActionIcon(selectedLog?.action)}
                sx={{
                  ...(isDark && {
                    '& .MuiChip-label': { color: '#D1D5DB' },
                    '& .MuiChip-icon': { color: '#D1D5DB' },
                  })
                }}
              />
              <Typography variant="h6" fontWeight={700}>
                Audit Log Details
              </Typography>
            </Stack>
            <IconButton 
              onClick={() => setShowDetailsDialog(false)} 
              size="small"
              sx={{ color: isDark ? '#9CA3AF' : undefined }}
            >
              <Close />
            </IconButton>
          </Stack>
        </DialogTitle>
        <Divider sx={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : undefined }} />
        <DialogContent>
          {selectedLog && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              {/* Tab navigation */}
              <Box sx={{ 
                borderBottom: 1, 
                borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'divider',
              }}>
                <Stack direction="row" spacing={2}>
                  <Button 
                    variant={detailsTab === 0 ? 'contained' : 'text'}
                    onClick={() => setDetailsTab(0)}
                    startIcon={<InfoIcon />}
                    sx={{
                      ...(detailsTab === 0 && {
                        bgcolor: isDark ? '#818CF8' : undefined,
                        '&:hover': {
                          bgcolor: isDark ? '#6366F1' : undefined,
                        },
                      }),
                      ...(detailsTab !== 0 && {
                        color: isDark ? '#D1D5DB' : undefined,
                      }),
                      borderRadius: 2,
                    }}
                  >
                    Overview
                  </Button>
                  <Button 
                    variant={detailsTab === 1 ? 'contained' : 'text'}
                    onClick={() => setDetailsTab(1)}
                    startIcon={<DifferenceIcon />}
                    sx={{
                      ...(detailsTab === 1 && {
                        bgcolor: isDark ? '#818CF8' : undefined,
                        '&:hover': {
                          bgcolor: isDark ? '#6366F1' : undefined,
                        },
                      }),
                      ...(detailsTab !== 1 && {
                        color: isDark ? '#D1D5DB' : undefined,
                      }),
                      borderRadius: 2,
                    }}
                  >
                    Changes
                  </Button>
                  <Button 
                    variant={detailsTab === 2 ? 'contained' : 'text'}
                    onClick={() => setDetailsTab(2)}
                    startIcon={<CodeIcon />}
                    sx={{
                      ...(detailsTab === 2 && {
                        bgcolor: isDark ? '#818CF8' : undefined,
                        '&:hover': {
                          bgcolor: isDark ? '#6366F1' : undefined,
                        },
                      }),
                      ...(detailsTab !== 2 && {
                        color: isDark ? '#D1D5DB' : undefined,
                      }),
                      borderRadius: 2,
                    }}
                  >
                    Raw Data
                  </Button>
                </Stack>
              </Box>

              {/* Overview Tab */}
              {detailsTab === 0 && (
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    p: 3, 
                    bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc',
                    borderColor: isDark ? 'rgba(255,255,255,0.06)' : undefined,
                    borderRadius: 2,
                  }}
                >
                  <Grid container spacing={3}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">Timestamp</Typography>
                      <Typography variant="body1" fontWeight={500} sx={{ color: isDark ? '#E5E7EB' : 'text.primary' }}>
                        {formatTimestamp(selectedLog.timestamp)}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">User</Typography>
                      <Typography variant="body1" fontWeight={500} sx={{ color: isDark ? '#E5E7EB' : 'text.primary' }}>
                        {selectedLog.username || selectedLog.user_email || selectedLog.user_id || 'System'}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">IP Address</Typography>
                      <Typography variant="body2" fontFamily="monospace" sx={{ color: isDark ? '#D1D5DB' : 'text.primary' }}>
                        {selectedLog.ip_address || 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">Status</Typography>
                      <Chip 
                        label={selectedLog.status || 'SUCCESS'} 
                        size="small" 
                        color={selectedLog.status === 'FAILURE' ? 'error' : 'success'}
                        sx={{
                          ...(isDark && {
                            '& .MuiChip-label': { color: '#D1D5DB' },
                          })
                        }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">Table</Typography>
                      <Typography variant="body2" sx={{ textTransform: 'capitalize', color: isDark ? '#D1D5DB' : 'text.primary' }}>
                        {getEntityLabel(selectedLog).replace(/_/g, ' ')}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">Record ID</Typography>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography variant="body2" fontFamily="monospace" sx={{ color: isDark ? '#D1D5DB' : 'text.primary' }}>
                          {getEntityId(selectedLog) || 'N/A'}
                        </Typography>
                        {getEntityId(selectedLog) && (
                          <Tooltip title={copied ? "Copied!" : "Copy ID"}>
                            <IconButton 
                              size="small" 
                              onClick={() => handleCopyJson(getEntityId(selectedLog))}
                              sx={{ color: isDark ? '#9CA3AF' : undefined }}
                            >
                              {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </Grid>
                    {selectedLog.endpoint && (
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="caption" color="text.secondary">Endpoint</Typography>
                        <Typography variant="body2" fontFamily="monospace" sx={{ wordBreak: 'break-all', color: isDark ? '#D1D5DB' : 'text.primary' }}>
                          {selectedLog.endpoint}
                        </Typography>
                      </Grid>
                    )}
                    {getDescription(selectedLog) && (
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="caption" color="text.secondary">Summary</Typography>
                        <Alert 
                          severity="info" 
                          sx={{ 
                            mt: 0.5,
                            bgcolor: isDark ? alpha('#3B82F6', 0.08) : undefined,
                            color: isDark ? '#93C5FD' : undefined,
                            '& .MuiAlert-icon': {
                              color: isDark ? '#60A5FA' : undefined,
                            },
                            borderRadius: 2,
                          }}
                        >
                          {getDescription(selectedLog)}
                        </Alert>
                      </Grid>
                    )}
                    {selectedLog.user_agent && (
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="caption" color="text.secondary">User Agent</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all', display: 'block' }}>
                          {selectedLog.user_agent}
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </Paper>
              )}

              {/* Changes Tab */}
              {detailsTab === 1 && (
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    p: 3,
                    borderColor: isDark ? 'rgba(255,255,255,0.06)' : undefined,
                    borderRadius: 2,
                  }}
                >
                  <JsonDiffViewer 
                    oldData={selectedLog.old_values || selectedLog.old_data || {}}
                    newData={selectedLog.new_values || selectedLog.new_data || {}}
                  />
                </Paper>
              )}

              {/* Raw Data Tab */}
              {detailsTab === 2 && (
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    p: 3,
                    borderColor: isDark ? 'rgba(255,255,255,0.06)' : undefined,
                    borderRadius: 2,
                  }}
                >
                  <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleCopyJson(selectedLog)}
                      startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
                      sx={{
                        borderColor: isDark ? 'rgba(255,255,255,0.12)' : undefined,
                        color: isDark ? '#D1D5DB' : undefined,
                        '&:hover': {
                          borderColor: isDark ? 'rgba(255,255,255,0.2)' : undefined,
                          bgcolor: isDark ? 'rgba(255,255,255,0.05)' : undefined,
                        },
                      }}
                    >
                      {copied ? 'Copied!' : 'Copy Full JSON'}
                    </Button>
                  </Stack>
                  <Box
                    component="pre"
                    sx={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      m: 0,
                      p: 2,
                      bgcolor: isDark ? '#111827' : '#1e1e1e',
                      color: isDark ? '#D1D5DB' : '#d4d4d4',
                      borderRadius: 2,
                      maxHeight: 500,
                      overflow: 'auto',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'transparent'}`,
                    }}
                  >
                    {JSON.stringify({
                      id: selectedLog.id,
                      timestamp: selectedLog.timestamp,
                      action: selectedLog.action,
                      table_name: getEntityLabel(selectedLog),
                      record_id: getEntityId(selectedLog),
                      user: {
                        id: selectedLog.user_id,
                        name: selectedLog.username,
                        email: selectedLog.user_email
                      },
                      old_values: selectedLog.old_values || selectedLog.old_data,
                      new_values: selectedLog.new_values || selectedLog.new_data,
                      changes_summary: getDescription(selectedLog),
                      ip_address: selectedLog.ip_address,
                      endpoint: selectedLog.endpoint,
                      user_agent: selectedLog.user_agent,
                      status: selectedLog.status,
                      duration_ms: selectedLog.duration_ms,
                      extra_data: selectedLog.extra_data
                    }, null, 2)}
                  </Box>
                </Paper>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: isDark ? '1px solid rgba(255,255,255,0.06)' : undefined }}>
          <Button 
            onClick={() => setShowDetailsDialog(false)} 
            variant="contained"
            sx={{
              bgcolor: isDark ? '#818CF8' : undefined,
              '&:hover': {
                bgcolor: isDark ? '#6366F1' : undefined,
              },
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MeetingAudit;