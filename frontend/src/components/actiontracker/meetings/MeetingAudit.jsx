// src/components/actiontracker/meetings/MeetingAudit.jsx
import React, { useState, useEffect } from 'react';
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
  useTheme
} from '@mui/material';
import {
  Info as   InfoIcon,
  History as HistoryIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  Person as PersonIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Update as UpdateIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
  Link as LinkIcon,
  Assignment as AssignmentIcon,
  People as PeopleIcon,
  Description as DescriptionIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  Difference as DifferenceIcon,
  Code as CodeIcon,
  ContentCopy as ContentCopyIcon,
  Check as CheckIcon,
  RemoveCircle as RemoveCircleIcon,
  AddCircle as AddCircleIcon
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

// Component to display field changes
const FieldChange = ({ field, oldValue, newValue }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  const formattedOld = formatValue(oldValue);
  const formattedNew = formatValue(newValue);
  const isOldJson = typeof oldValue === 'object' || isJsonString(formattedOld);
  const isNewJson = typeof newValue === 'object' || isJsonString(formattedNew);

  return (
    <Accordion expanded={expanded} onChange={() => setExpanded(!expanded)} sx={{ mb: 1 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <DifferenceIcon fontSize="small" color="primary" />
          <Typography variant="subtitle2" fontWeight={600}>
            {field}
          </Typography>
          <Chip 
            label={`${formattedOld !== formattedNew ? 'Changed' : 'No Change'}`} 
            size="small" 
            color={formattedOld !== formattedNew ? 'warning' : 'default'}
            sx={{ ml: 1 }}
          />
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: alpha(theme.palette.error.main, 0.04), height: '100%' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <RemoveCircleIcon fontSize="small" color="error" />
                <Typography variant="caption" color="error" fontWeight={600}>
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
                    bgcolor: 'background.paper',
                    borderRadius: 1,
                    maxHeight: 300,
                    overflow: 'auto',
                  }}
                >
                  {formattedOld}
                </Box>
              ) : (
                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                  {formattedOld}
                </Typography>
              )}
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: alpha(theme.palette.success.main, 0.04), height: '100%' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <AddCircleIcon fontSize="small" color="success" />
                <Typography variant="caption" color="success.main" fontWeight={600}>
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
                    bgcolor: 'background.paper',
                    borderRadius: 1,
                    maxHeight: 300,
                    overflow: 'auto',
                  }}
                >
                  {formattedNew}
                </Box>
              ) : (
                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
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
  const [viewMode, setViewMode] = useState('diff');

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
      <Alert severity="info" icon={<InfoIcon />}>
        No changes detected
      </Alert>
    );
  }

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
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
    return <AddIcon fontSize="small" color="success" />;
  }
  if (actionLower.includes('update') || actionLower.includes('edit') || actionLower.includes('modify')) {
    return <UpdateIcon fontSize="small" color="info" />;
  }
  if (actionLower.includes('delete') || actionLower.includes('remove')) {
    return <DeleteIcon fontSize="small" color="error" />;
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
    return <CancelIcon fontSize="small" color="error" />;
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
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

  useEffect(() => {
    fetchAuditLogs();
    fetchFilterOptions();
  }, [meetingId, page, searchTerm, filterAction, filterUser]);

  const fetchAuditLogs = async () => {
    if (!meetingId) return;
    
    setLoading(true);
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
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setError(err.response?.data?.detail || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const response = await api.get(`/action-tracker/meetings/${meetingId}/audit-logs/filters`);
      const data = response.data || {};
      setUsers(data.users || []);
      setActions(data.actions || []);
    } catch (err) {
      console.error('Error fetching filter options:', err);
    }
  };

  const handleRefresh = () => {
    fetchAuditLogs();
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

  if (loading && auditLogs.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ borderRadius: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Stack spacing={3}>
        {/* Header with filters */}
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <HistoryIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>
              Audit Logs
            </Typography>
            <Chip label={`${totalItems} entries`} size="small" variant="outlined" />
          </Stack>
          
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={handleSearchChange}
              sx={{ width: 250 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <Tooltip title="Filter">
              <IconButton onClick={handleFilterMenuOpen} size="small">
                <FilterListIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export CSV">
              <IconButton onClick={handleExportCSV} size="small">
                <DownloadIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton onClick={handleRefresh} size="small">
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
              />
            )}
            {filterUser && (
              <Chip
                label={`User: ${users.find(u => u.id === filterUser)?.name || filterUser}`}
                onDelete={() => setFilterUser('')}
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
            {searchTerm && (
              <Chip
                label={`Search: ${searchTerm}`}
                onDelete={() => setSearchTerm('')}
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
            <Button size="small" onClick={handleClearFilters}>Clear All</Button>
          </Stack>
        )}

        {/* Filter Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleFilterMenuClose}
          PaperProps={{ sx: { minWidth: 200, maxHeight: 400 } }}
        >
          <MenuItem disabled sx={{ opacity: 1, fontWeight: 600 }}>
            <Typography variant="subtitle2">Filter by Action</Typography>
          </MenuItem>
          <Divider />
          {actions.map((action) => (
            <MenuItem 
              key={action} 
              onClick={() => handleFilterActionChange(action)}
              selected={filterAction === action}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {getActionIcon(action)}
                <Typography variant="body2">{action}</Typography>
              </Box>
            </MenuItem>
          ))}
          
          <Divider sx={{ my: 1 }} />
          
          <MenuItem disabled sx={{ opacity: 1, fontWeight: 600 }}>
            <Typography variant="subtitle2">Filter by User</Typography>
          </MenuItem>
          <Divider />
          {users.map((user) => (
            <MenuItem 
              key={user.id} 
              onClick={() => handleFilterUserChange(user.id)}
              selected={filterUser === user.id}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                  {user.name?.[0] || user.email?.[0] || 'U'}
                </Avatar>
                <Typography variant="body2">{user.name || user.email}</Typography>
              </Box>
            </MenuItem>
          ))}
        </Menu>

        {/* Audit Logs Table */}
        {auditLogs.length === 0 ? (
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
            <HistoryIcon sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Audit Logs Found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              No activities have been logged for this meeting yet.
            </Typography>
          </Paper>
        ) : (
          <>
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f1f5f9' }}>
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
                    <TableRow key={log.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Tooltip title={formatTimestamp(log.timestamp)}>
                          <Typography variant="body2">
                            {formatTimestamp(log.timestamp)}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: '#6366f1' }}>
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
                          sx={{ height: 26, fontWeight: 500 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {log.table_name?.replace(/_/g, ' ') || 'Meeting'}
                        </Typography>
                        {log.record_id && (
                          <Typography variant="caption" color="text.secondary">
                            ID: {log.record_id.substring(0, 12)}...
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ maxWidth: 300 }}>
                          {log.changes_summary || 'No description'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="View Details">
                          <IconButton size="small" onClick={() => handleViewDetails(log)}>
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
                />
              </Box>
            )}
          </>
        )}
      </Stack>

      {/* Enhanced Details Dialog */}
      <Dialog 
        open={showDetailsDialog} 
        onClose={() => setShowDetailsDialog(false)} 
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Chip
                size="medium"
                label={selectedLog?.action}
                color={getActionColor(selectedLog?.action)}
                icon={getActionIcon(selectedLog?.action)}
              />
              <Typography variant="h6" fontWeight={700}>
                Audit Log Details
              </Typography>
            </Stack>
            <IconButton onClick={() => setShowDetailsDialog(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <Divider />
        <DialogContent>
          {selectedLog && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              {/* Tab navigation */}
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Stack direction="row" spacing={2}>
                  <Button 
                    variant={detailsTab === 0 ? 'contained' : 'text'}
                    onClick={() => setDetailsTab(0)}
                    startIcon={<InfoIcon />}
                  >
                    Overview
                  </Button>
                  <Button 
                    variant={detailsTab === 1 ? 'contained' : 'text'}
                    onClick={() => setDetailsTab(1)}
                    startIcon={<DifferenceIcon />}
                  >
                    Changes
                  </Button>
                  <Button 
                    variant={detailsTab === 2 ? 'contained' : 'text'}
                    onClick={() => setDetailsTab(2)}
                    startIcon={<CodeIcon />}
                  >
                    Raw Data
                  </Button>
                </Stack>
              </Box>

              {/* Overview Tab */}
              {detailsTab === 0 && (
                <Paper variant="outlined" sx={{ p: 3, bgcolor: '#f8fafc' }}>
                  <Grid container spacing={3}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">Timestamp</Typography>
                      <Typography variant="body1" fontWeight={500}>
                        {formatTimestamp(selectedLog.timestamp)}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">User</Typography>
                      <Typography variant="body1" fontWeight={500}>
                        {selectedLog.username || selectedLog.user_email || 'System'}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">IP Address</Typography>
                      <Typography variant="body2" fontFamily="monospace">
                        {selectedLog.ip_address || 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">Status</Typography>
                      <Chip 
                        label={selectedLog.status || 'SUCCESS'} 
                        size="small" 
                        color={selectedLog.status === 'FAILURE' ? 'error' : 'success'}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">Table</Typography>
                      <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                        {selectedLog.table_name?.replace(/_/g, ' ') || 'Meeting'}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">Record ID</Typography>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography variant="body2" fontFamily="monospace">
                          {selectedLog.record_id || 'N/A'}
                        </Typography>
                        {selectedLog.record_id && (
                          <Tooltip title={copied ? "Copied!" : "Copy ID"}>
                            <IconButton size="small" onClick={() => handleCopyJson(selectedLog.record_id)}>
                              {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </Grid>
                    {selectedLog.endpoint && (
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="caption" color="text.secondary">Endpoint</Typography>
                        <Typography variant="body2" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>
                          {selectedLog.endpoint}
                        </Typography>
                      </Grid>
                    )}
                    {selectedLog.changes_summary && (
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="caption" color="text.secondary">Summary</Typography>
                        <Alert severity="info" sx={{ mt: 0.5 }}>
                          {selectedLog.changes_summary}
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
                <Paper variant="outlined" sx={{ p: 3 }}>
                  <JsonDiffViewer 
                    oldData={selectedLog.old_values || selectedLog.old_data || {}}
                    newData={selectedLog.new_values || selectedLog.new_data || {}}
                  />
                </Paper>
              )}

              {/* Raw Data Tab */}
              {detailsTab === 2 && (
                <Paper variant="outlined" sx={{ p: 3 }}>
                  <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleCopyJson(selectedLog)}
                      startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
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
                      bgcolor: '#1e1e1e',
                      color: '#d4d4d4',
                      borderRadius: 2,
                      maxHeight: 500,
                      overflow: 'auto',
                    }}
                  >
                    {JSON.stringify({
                      id: selectedLog.id,
                      timestamp: selectedLog.timestamp,
                      action: selectedLog.action,
                      table_name: selectedLog.table_name,
                      record_id: selectedLog.record_id,
                      user: {
                        id: selectedLog.user_id,
                        name: selectedLog.username,
                        email: selectedLog.user_email
                      },
                      old_values: selectedLog.old_values || selectedLog.old_data,
                      new_values: selectedLog.new_values || selectedLog.new_data,
                      changes_summary: selectedLog.changes_summary,
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
        <DialogActions>
          <Button onClick={() => setShowDetailsDialog(false)} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MeetingAudit;