// src/components/admin/AuditLogs.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Container,
  Typography,
  Paper,
  TextField,
  Button,
  IconButton,
  Chip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  InputAdornment,
  Tooltip,
  Card,
  CardContent,
  Tabs,
  Tab,
  Stack,
  useTheme,
  Divider,
  Badge,
  Zoom,
  Fade,
  Grow,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  alpha,
  Checkbox,
  FormControlLabel,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
} from '@mui/material';
import {
  SearchOutlined,
  RefreshOutlined,
  DownloadOutlined,
  VisibilityOutlined,
  PersonOutline,
  LoginOutlined,
  LogoutOutlined,
  CreateOutlined,
  DeleteOutlined,
  EditOutlined,
  SecurityOutlined,
  ClearOutlined,
  InfoOutlined,
  ErrorOutline,
  CheckCircleOutline,
  FilterListOutlined,
  CalendarTodayOutlined,
  ComputerOutlined,
  StorageOutlined,
  TrendingUpOutlined,
  CloseOutlined,
  ExpandMoreOutlined,
  DifferenceOutlined,
  AddCircleOutline,
  RemoveCircleOutline,
  ChangeCircleOutlined,
  CodeOutlined,
  ContentCopyOutlined,
  PictureAsPdfOutlined,
  TableChartOutlined,
  ViewColumnOutlined,
  DragHandleOutlined,
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { motion, AnimatePresence } from 'framer-motion';
import { format, subDays, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Import Redux actions
import { 
  fetchAuditLogs, 
  getAuditStats,
} from '../../store/slices/auditSlice';

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

// Column configuration
const ALL_COLUMNS = [
  { id: 'timestamp', header: 'Timestamp', width: 180, visible: true },
  { id: 'user', header: 'User', width: 200, visible: true },
  { id: 'action', header: 'Action', width: 180, visible: true },
  { id: 'table_name', header: 'Resource', width: 180, visible: true },
  { id: 'record_id', header: 'Record ID', width: 150, visible: false },
  { id: 'changes_summary', header: 'Changes', width: 300, visible: true },
  { id: 'status', header: 'Status', width: 100, visible: true },
  { id: 'ip_address', header: 'IP Address', width: 140, visible: false },
  { id: 'endpoint', header: 'Endpoint', width: 200, visible: false },
  { id: 'user_agent', header: 'User Agent', width: 250, visible: false },
];

// Helper function to parse JSON safely
const safeJsonParse = (data) => {
  if (!data) return null;
  try {
    return typeof data === 'string' ? JSON.parse(data) : data;
  } catch (e) {
    return data;
  }
};

// Helper to get values from either old_values/old_data or new_values/new_data
const getOldValues = (log) => {
  return safeJsonParse(log.old_values) || safeJsonParse(log.old_data) || {};
};

const getNewValues = (log) => {
  return safeJsonParse(log.new_values) || safeJsonParse(log.new_data) || {};
};

const getExtraData = (log) => {
  return safeJsonParse(log.extra_data) || {};
};

// Component to display field changes
const FieldChange = ({ field, oldValue, newValue }) => {
  const theme = useTheme();

  const formatValue = (value) => {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return String(value);
  };

  const formattedOld = formatValue(oldValue);
  const formattedNew = formatValue(newValue);

  return (
    <Box sx={{ mb: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1, overflow: 'hidden' }}>
      <Box sx={{ 
        p: 1.5, 
        bgcolor: alpha(theme.palette.primary.main, 0.08),
        borderBottom: `1px solid ${theme.palette.divider}`,
        display: 'flex',
        alignItems: 'center',
        gap: 1
      }}>
        <ChangeCircleOutlined fontSize="small" color="primary" />
        <Typography variant="subtitle2" fontWeight={600}>
          {field}
        </Typography>
      </Box>
      
      <Grid container>
        <Grid size={{ xs: 12, md: 6 }}>
          <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.error.main, 0.04), height: '100%' }}>
            <Typography variant="caption" color="error" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <RemoveCircleOutline fontSize="small" />
              Old Value
            </Typography>
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
                maxHeight: 200,
                overflow: 'auto',
              }}
            >
              {formattedOld}
            </Box>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.success.main, 0.04), height: '100%' }}>
            <Typography variant="caption" color="success.main" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <AddCircleOutline fontSize="small" />
              New Value
            </Typography>
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
                maxHeight: 200,
                overflow: 'auto',
              }}
            >
              {formattedNew}
            </Box>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

// Component to compare objects deeply and show differences
const ObjectDiff = ({ oldObject, newObject }) => {
  const theme = useTheme();

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

  const differences = getDifferences(oldObject, newObject);

  if (differences.length === 0) {
    return (
      <Alert severity="info" icon={<InfoOutlined />}>
        No changes detected in this audit log
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

// JSON Diff Viewer component
const JsonDiffViewer = ({ log }) => {
  const [viewMode, setViewMode] = useState('diff');
  
  const oldData = getOldValues(log);
  const newData = getNewValues(log);
  const extraData = getExtraData(log);

  if (!oldData && !newData) {
    return (
      <Alert severity="info">
        No structured data available for comparison
      </Alert>
    );
  }

  return (
    <Box>
      <Tabs value={viewMode} onChange={(e, v) => setViewMode(v)} sx={{ mb: 2 }}>
        <Tab label="Changes View" value="diff" icon={<DifferenceOutlined />} iconPosition="start" />
        <Tab label="Old Values" value="old" icon={<RemoveCircleOutline />} iconPosition="start" />
        <Tab label="New Values" value="new" icon={<AddCircleOutline />} iconPosition="start" />
        {extraData && Object.keys(extraData).length > 0 && (
          <Tab label="Extra Data" value="extra" icon={<InfoOutlined />} iconPosition="start" />
        )}
      </Tabs>

      {viewMode === 'diff' && (
        <ObjectDiff oldObject={oldData} newObject={newData} />
      )}

      {viewMode === 'old' && oldData && (
        <Paper variant="outlined" sx={{ p: 2, bgcolor: alpha(theme.palette.error.main, 0.04) }}>
          <Typography variant="subtitle2" color="error" gutterBottom>
            Old Values
          </Typography>
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
              maxHeight: 400,
              overflow: 'auto',
            }}
          >
            {JSON.stringify(oldData, null, 2)}
          </Box>
        </Paper>
      )}

      {viewMode === 'new' && newData && (
        <Paper variant="outlined" sx={{ p: 2, bgcolor: alpha(theme.palette.success.main, 0.04) }}>
          <Typography variant="subtitle2" color="success.main" gutterBottom>
            New Values
          </Typography>
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
              maxHeight: 400,
              overflow: 'auto',
            }}
          >
            {JSON.stringify(newData, null, 2)}
          </Box>
        </Paper>
      )}

      {viewMode === 'extra' && extraData && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Extra Data (Meeting ID, etc.)
          </Typography>
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
              maxHeight: 400,
              overflow: 'auto',
            }}
          >
            {JSON.stringify(extraData, null, 2)}
          </Box>
        </Paper>
      )}
    </Box>
  );
};

// Helper functions for colors and icons
const getActionIcon = (action) => {
  const actionUpper = action?.toUpperCase() || '';
  if (actionUpper.includes('LOGIN')) return <LoginOutlined fontSize="small" />;
  if (actionUpper.includes('LOGOUT')) return <LogoutOutlined fontSize="small" />;
  if (actionUpper.includes('CREATE')) return <CreateOutlined fontSize="small" />;
  if (actionUpper.includes('UPDATE')) return <EditOutlined fontSize="small" />;
  if (actionUpper.includes('DELETE')) return <DeleteOutlined fontSize="small" />;
  return <InfoOutlined fontSize="small" />;
};

const getActionColor = (action) => {
  const actionUpper = action?.toUpperCase() || '';
  if (actionUpper.includes('LOGIN')) return 'info';
  if (actionUpper.includes('LOGOUT')) return 'warning';
  if (actionUpper.includes('CREATE')) return 'success';
  if (actionUpper.includes('UPDATE')) return 'primary';
  if (actionUpper.includes('DELETE')) return 'error';
  return 'default';
};

const getStatusColor = (status) => {
  const statusUpper = status?.toUpperCase() || '';
  if (statusUpper === 'SUCCESS') return 'success';
  if (statusUpper === 'FAILURE') return 'error';
  return 'default';
};

// Column Management Drawer
const ColumnManager = ({ open, onClose, columns, onToggleColumn }) => {
  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: 320, p: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ViewColumnOutlined />
          Manage Columns
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <List>
          {columns.map((col) => (
            <ListItem key={col.id} disablePadding>
              <ListItemButton onClick={() => onToggleColumn(col.id)}>
                <ListItemIcon>
                  <Checkbox
                    edge="start"
                    checked={col.visible}
                    tabIndex={-1}
                    disableRipple
                  />
                </ListItemIcon>
                <ListItemText 
                  primary={col.header}
                  secondary={`Width: ${col.width}px`}
                />
                <DragHandleOutlined color="action" />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
    </Drawer>
  );
};

// Enhanced details dialog
const EnhancedDetailsDialog = ({ open, log, onClose }) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!log) return null;

  const oldData = getOldValues(log);
  const newData = getNewValues(log);
  const extraData = getExtraData(log);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SecurityOutlined color="primary" />
            <Typography variant="h6">Audit Log Details</Typography>
            <Chip 
              label={log.action} 
              size="small" 
              color={getActionColor(log.action)}
              variant="filled"
            />
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseOutlined />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 2 }}>
          <Tab label="Overview" icon={<InfoOutlined />} iconPosition="start" />
          <Tab label="Changes" icon={<DifferenceOutlined />} iconPosition="start" />
          <Tab label="Raw Data" icon={<CodeOutlined />} iconPosition="start" />
        </Tabs>

        {activeTab === 0 && (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="subtitle2" color="text.secondary">Timestamp</Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {log.timestamp ? format(parseISO(log.timestamp), 'PPpp') : '—'}
              </Typography>
              
              <Typography variant="subtitle2" color="text.secondary">User</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Avatar sx={{ width: 28, height: 28 }}>
                  {log.username?.[0]?.toUpperCase() || 'U'}
                </Avatar>
                <Typography variant="body1">
                  {log.username || 'System'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ({log.user_email || 'No email'})
                </Typography>
              </Box>
              
              <Typography variant="subtitle2" color="text.secondary">IP Address</Typography>
              <Typography variant="body1" fontFamily="monospace" sx={{ mb: 2 }}>
                {log.ip_address || '—'}
              </Typography>
            </Grid>
            
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="subtitle2" color="text.secondary">Resource</Typography>
              <Typography variant="body1" sx={{ textTransform: 'capitalize', mb: 2 }}>
                {log.table_name?.replace(/_/g, ' ') || '—'}
              </Typography>
              
              <Typography variant="subtitle2" color="text.secondary">Record ID</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Typography variant="body1" fontFamily="monospace">
                  {log.record_id || '—'}
                </Typography>
                {log.record_id && (
                  <Tooltip title={copied ? "Copied!" : "Copy ID"}>
                    <IconButton size="small" onClick={() => handleCopy(log.record_id)}>
                      <ContentCopyOutlined fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
              
              <Typography variant="subtitle2" color="text.secondary">Status</Typography>
              <Chip 
                label={log.status || 'SUCCESS'} 
                color={getStatusColor(log.status)}
                size="small"
                sx={{ mb: 2 }}
              />
            </Grid>
            
            {log.changes_summary && (
              <Grid size={12}>
                <Typography variant="subtitle2" color="text.secondary">Summary</Typography>
                <Alert severity="info" sx={{ mt: 0.5 }}>
                  {log.changes_summary}
                </Alert>
              </Grid>
            )}
            
            {log.endpoint && (
              <Grid size={12}>
                <Typography variant="subtitle2" color="text.secondary">Endpoint</Typography>
                <Typography variant="body2" fontFamily="monospace" sx={{ mb: 1, wordBreak: 'break-all' }}>
                  {log.endpoint}
                </Typography>
              </Grid>
            )}
            
            {log.error_message && (
              <Grid size={12}>
                <Alert severity="error" icon={<ErrorOutline />}>
                  <Typography variant="subtitle2" gutterBottom>Error Message</Typography>
                  <Typography variant="body2">{log.error_message}</Typography>
                </Alert>
              </Grid>
            )}
          </Grid>
        )}

        {activeTab === 1 && (
          <JsonDiffViewer log={log} />
        )}

        {activeTab === 2 && (
          <Box>
            <Button
              variant="outlined"
              size="small"
              onClick={() => handleCopy(JSON.stringify({ old_data: oldData, new_data: newData, extra_data: extraData }, null, 2))}
              sx={{ mb: 2 }}
            >
              Copy Full JSON
            </Button>
            <Box
              component="pre"
              sx={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                m: 0,
                p: 2,
                bgcolor: 'background.default',
                borderRadius: 1,
                maxHeight: 500,
                overflow: 'auto',
              }}
            >
              {JSON.stringify({ 
                id: log.id,
                timestamp: log.timestamp,
                user: log.username,
                email: log.user_email,
                action: log.action,
                table: log.table_name,
                record_id: log.record_id,
                old_values: oldData,
                new_values: newData,
                extra_data: extraData,
                ip_address: log.ip_address,
                endpoint: log.endpoint,
                changes_summary: log.changes_summary,
                status: log.status
              }, null, 2)}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Export functions with column filtering
const exportToExcel = (logs, columns, filename = 'audit_logs') => {
  // Get only visible columns
  const visibleColumns = columns.filter(col => col.visible);
  
  const exportData = logs.map(log => {
    const row = {};
    visibleColumns.forEach(col => {
      switch(col.id) {
        case 'timestamp':
          row[col.header] = log.timestamp ? format(parseISO(log.timestamp), 'yyyy-MM-dd HH:mm:ss') : '';
          break;
        case 'user':
          row[col.header] = log.username || 'System';
          break;
        case 'action':
          row[col.header] = log.action || '';
          break;
        case 'table_name':
          row[col.header] = log.table_name || '';
          break;
        case 'record_id':
          row[col.header] = log.record_id || '';
          break;
        case 'changes_summary':
          row[col.header] = log.changes_summary || '';
          break;
        case 'status':
          row[col.header] = log.status || '';
          break;
        case 'ip_address':
          row[col.header] = log.ip_address || '';
          break;
        case 'endpoint':
          row[col.header] = log.endpoint || '';
          break;
        case 'user_agent':
          row[col.header] = log.user_agent || '';
          break;
        default:
          row[col.header] = log[col.id] || '';
      }
    });
    return row;
  });
  
  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Audit Logs');
  XLSX.writeFile(wb, `${filename}_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.xlsx`);
};

const exportToPDF = (logs, columns, filename = 'audit_logs') => {
  // Get only visible columns
  const visibleColumns = columns.filter(col => col.visible);
  
  const doc = new jsPDF('landscape');
  
  doc.setFontSize(16);
  doc.text('Audit Logs Report', 14, 15);
  doc.setFontSize(10);
  doc.text(`Generated: ${format(new Date(), 'PPpp')}`, 14, 25);
  doc.text(`Total Records: ${logs.length}`, 14, 32);
  
  // Prepare table headers from visible columns
  const headers = visibleColumns.map(col => col.header);
  
  // Prepare table data
  const tableData = logs.map(log => {
    return visibleColumns.map(col => {
      switch(col.id) {
        case 'timestamp':
          return log.timestamp ? format(parseISO(log.timestamp), 'yyyy-MM-dd HH:mm:ss') : '';
        case 'user':
          return log.username || 'System';
        case 'action':
          return log.action || '';
        case 'table_name':
          return log.table_name || '';
        case 'record_id':
          return log.record_id || '';
        case 'changes_summary':
          // Truncate long summaries for PDF
          const summary = log.changes_summary || '';
          return summary.length > 60 ? summary.substring(0, 57) + '...' : summary;
        case 'status':
          return log.status || '';
        case 'ip_address':
          return log.ip_address || '';
        case 'endpoint':
          const endpoint = log.endpoint || '';
          return endpoint.length > 40 ? endpoint.substring(0, 37) + '...' : endpoint;
        case 'user_agent':
          const userAgent = log.user_agent || '';
          return userAgent.length > 50 ? userAgent.substring(0, 47) + '...' : userAgent;
        default:
          return log[col.id] || '';
      }
    });
  });
  
  autoTable(doc, {
    head: [headers],
    body: tableData,
    startY: 40,
    styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [240, 240, 240] },
    columnStyles: {
      0: { cellWidth: 35 }, // timestamp
      1: { cellWidth: 30 }, // user
      2: { cellWidth: 25 }, // action
      3: { cellWidth: 25 }, // table
      4: { cellWidth: 30 }, // changes summary
      5: { cellWidth: 15 }, // status
    },
    margin: { left: 10, right: 10 },
    tableWidth: 'auto',
  });
  
  doc.save(`${filename}_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.pdf`);
};

// Main Component
const AuditLogs = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { logs, stats, isLoading, total, error } = useSelector((state) => state.audit || { 
    logs: [], 
    stats: {}, 
    isLoading: false, 
    total: 0, 
    error: null 
  });

  // State management
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [selectedLog, setSelectedLog] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [exportLoading, setExportLoading] = useState(false);
  const [quickDateRange, setQuickDateRange] = useState('7d');
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);
  const [columns, setColumns] = useState(ALL_COLUMNS);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(0);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load data on filter changes
  useEffect(() => {
    loadLogs();
    loadStats();
  }, [page, rowsPerPage, debouncedSearch, actionFilter, statusFilter, dateRange, activeTab]);

  const loadLogs = useCallback(() => {
    let tabActionFilter = actionFilter;
    if (activeTab === 1) tabActionFilter = 'login';
    if (activeTab === 2) tabActionFilter = 'update';
    if (activeTab === 3) tabActionFilter = 'create,delete';
    if (activeTab === 4) tabActionFilter = 'admin';

    dispatch(fetchAuditLogs({
      page: page + 1,
      limit: rowsPerPage,
      search: debouncedSearch || undefined,
      action: tabActionFilter !== 'all' ? tabActionFilter : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      start_date: dateRange.startDate || undefined,
      end_date: dateRange.endDate || undefined,
    }));
  }, [dispatch, page, rowsPerPage, debouncedSearch, actionFilter, statusFilter, dateRange, activeTab]);

  const loadStats = useCallback(() => {
    dispatch(getAuditStats({ days: 30 }));
  }, [dispatch]);

  const handleViewDetails = (log) => {
    setSelectedLog(log);
    setDetailsDialogOpen(true);
  };

  const handleRefresh = () => {
    loadLogs();
    loadStats();
  };

  const handleExport = async (format) => {
    setExportLoading(true);
    try {
      const currentLogs = logs;
      
      if (format === 'excel') {
        exportToExcel(currentLogs, columns, 'audit_logs');
        showSnackbar('Excel export completed successfully', 'success');
      } else if (format === 'pdf') {
        exportToPDF(currentLogs, columns, 'audit_logs');
        showSnackbar('PDF export completed successfully', 'success');
      }
    } catch (error) {
      console.error('Export error:', error);
      showSnackbar(error.message || `Failed to export as ${format}`, 'error');
    } finally {
      setExportLoading(false);
    }
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setActionFilter('all');
    setStatusFilter('all');
    setDateRange({ startDate: '', endDate: '' });
    setQuickDateRange('7d');
    setPage(0);
    setActiveTab(0);
  };

  const handleQuickDateRange = (range) => {
    setQuickDateRange(range);
    const endDate = new Date();
    let startDate = new Date();
    
    switch(range) {
      case '24h':
        startDate = subDays(endDate, 1);
        break;
      case '7d':
        startDate = subDays(endDate, 7);
        break;
      case '30d':
        startDate = subDays(endDate, 30);
        break;
      case '90d':
        startDate = subDays(endDate, 90);
        break;
      default:
        return;
    }
    
    setDateRange({
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd')
    });
    setPage(0);
  };

  const handleToggleColumn = (columnId) => {
    setColumns(columns.map(col => 
      col.id === columnId ? { ...col, visible: !col.visible } : col
    ));
  };

  // Generate dynamic columns for DataGrid based on visible columns
  const dynamicColumns = useMemo(() => {
    const visibleColumns = columns.filter(col => col.visible);
    
    const columnMap = {
      timestamp: (params) => (
        <Tooltip title={params.row.timestamp ? format(parseISO(params.row.timestamp), 'PPpp') : '—'}>
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {params.row.timestamp ? format(parseISO(params.row.timestamp), 'MMM dd, HH:mm:ss') : '—'}
          </Typography>
        </Tooltip>
      ),
      user: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.875rem' }}>
            {params.row.username?.[0]?.toUpperCase() || 'U'}
          </Avatar>
          <Box>
            <Typography variant="body2" fontWeight={500}>
              {params.row.username || 'System'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {params.row.user_email || ''}
            </Typography>
          </Box>
        </Box>
      ),
      action: (params) => (
        <Chip
          icon={getActionIcon(params.row.action)}
          label={params.row.action?.replace(/_/g, ' ') || '—'}
          size="small"
          color={getActionColor(params.row.action)}
          variant="outlined"
          sx={{ textTransform: 'capitalize' }}
        />
      ),
      table_name: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <StorageOutlined fontSize="small" color="action" />
          <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
            {params.row.table_name?.replace(/_/g, ' ') || '—'}
          </Typography>
        </Box>
      ),
      record_id: (params) => (
        <Typography variant="caption" fontFamily="monospace" sx={{ opacity: 0.7 }}>
          {params.row.record_id?.slice(0, 12) || '—'}
          {params.row.record_id?.length > 12 && '...'}
        </Typography>
      ),
      changes_summary: (params) => (
        <Tooltip title={params.row.changes_summary || 'No changes'}>
          <Typography variant="body2" noWrap sx={{ maxWidth: 280 }}>
            {params.row.changes_summary || '—'}
          </Typography>
        </Tooltip>
      ),
      status: (params) => (
        <Chip
          label={params.row.status || 'SUCCESS'}
          size="small"
          color={getStatusColor(params.row.status)}
          variant="filled"
          sx={{ fontWeight: 500 }}
        />
      ),
      ip_address: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ComputerOutlined fontSize="small" color="action" />
          <Typography variant="body2" fontFamily="monospace">
            {params.row.ip_address || '—'}
          </Typography>
        </Box>
      ),
      endpoint: (params) => (
        <Tooltip title={params.row.endpoint}>
          <Typography variant="caption" noWrap sx={{ maxWidth: 180 }}>
            {params.row.endpoint || '—'}
          </Typography>
        </Tooltip>
      ),
      user_agent: (params) => (
        <Tooltip title={params.row.user_agent}>
          <Typography variant="caption" noWrap sx={{ maxWidth: 230 }}>
            {params.row.user_agent || '—'}
          </Typography>
        </Tooltip>
      ),
    };
    
    const gridColumns = visibleColumns.map(col => ({
      field: col.id,
      headerName: col.header,
      width: col.width,
      renderCell: columnMap[col.id] || ((params) => params.row[col.id] || '—'),
    }));
    
    // Add actions column
    gridColumns.push({
      field: 'actions',
      headerName: '',
      width: 80,
      sortable: false,
      renderCell: (params) => (
        <Tooltip title="View Details with Changes">
          <IconButton 
            size="small" 
            onClick={() => handleViewDetails(params.row)}
            sx={{ '&:hover': { transform: 'scale(1.1)' } }}
          >
            <VisibilityOutlined fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    });
    
    return gridColumns;
  }, [columns]);

  // Stats cards
  const statCards = useMemo(() => [
    { 
      title: 'Total Events', 
      value: stats?.total_events || stats?.total || total || 0, 
      icon: <TrendingUpOutlined />, 
      color: theme.palette.primary.main,
    },
    { 
      title: 'Successful', 
      value: stats?.successful || 0, 
      icon: <CheckCircleOutline />, 
      color: theme.palette.success.main,
    },
    { 
      title: 'Failed', 
      value: stats?.failed || 0, 
      icon: <ErrorOutline />, 
      color: theme.palette.error.main,
    },
    { 
      title: 'Updates', 
      value: logs.filter(l => l.action?.toUpperCase().includes('UPDATE')).length, 
      icon: <EditOutlined />, 
      color: theme.palette.info.main,
    },
  ], [stats, total, logs, theme]);

  const actionTypes = [
    { value: 'all', label: 'All Actions' },
    { value: 'login', label: 'Login' },
    { value: 'logout', label: 'Logout' },
    { value: 'create', label: 'Create' },
    { value: 'update', label: 'Update' },
    { value: 'delete', label: 'Delete' },
  ];

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <AnimatePresence mode="wait">
        <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
          {/* Header */}
          <motion.div variants={fadeInUp}>
            <Box sx={{ mb: 4 }}>
              <Typography variant="h4" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <SecurityOutlined sx={{ fontSize: 40, color: 'primary.main' }} />
                Audit Logs
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Track and monitor all system activities, user actions, and data changes
              </Typography>
            </Box>
          </motion.div>

          {/* Stats Cards */}
          <motion.div variants={fadeInUp}>
            <Grid container spacing={3} sx={{ mb: 4 }}>
              {statCards.map((stat, index) => (
                <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
                  <Zoom in={true} style={{ transitionDelay: `${index * 100}ms` }}>
                    <Card sx={{ height: '100%', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography color="text.secondary" gutterBottom variant="body2">
                              {stat.title}
                            </Typography>
                            <Typography variant="h3" fontWeight={700}>
                              {stat.value.toLocaleString()}
                            </Typography>
                          </Box>
                          <Avatar sx={{ bgcolor: stat.color, width: 56, height: 56 }}>
                            {stat.icon}
                          </Avatar>
                        </Box>
                      </CardContent>
                    </Card>
                  </Zoom>
                </Grid>
              ))}
            </Grid>
          </motion.div>

          {/* Filters */}
          <motion.div variants={fadeInUp}>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <FilterListOutlined color="action" />
                <Typography variant="h6">Filters</Typography>
                <Box sx={{ flex: 1 }} />
                <Button 
                  size="small" 
                  startIcon={<ViewColumnOutlined />}
                  onClick={() => setColumnManagerOpen(true)}
                >
                  Manage Columns
                </Button>
                {(searchTerm || actionFilter !== 'all' || statusFilter !== 'all' || dateRange.startDate) && (
                  <Button size="small" onClick={handleClearFilters} startIcon={<ClearOutlined />}>
                    Clear All
                  </Button>
                )}
              </Stack>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField
                    fullWidth
                    placeholder="Search users, actions, resources..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    size="small"
                    InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment> }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Action</InputLabel>
                    <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} label="Action">
                      {actionTypes.map((action) => (
                        <MenuItem key={action.value} value={action.value}>{action.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Status</InputLabel>
                    <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} label="Status">
                      <MenuItem value="all">All Status</MenuItem>
                      <MenuItem value="SUCCESS">Success</MenuItem>
                      <MenuItem value="FAILURE">Failure</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Quick Range</InputLabel>
                    <Select value={quickDateRange} onChange={(e) => handleQuickDateRange(e.target.value)} label="Quick Range">
                      <MenuItem value="24h">Last 24 Hours</MenuItem>
                      <MenuItem value="7d">Last 7 Days</MenuItem>
                      <MenuItem value="30d">Last 30 Days</MenuItem>
                      <MenuItem value="90d">Last 90 Days</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 6, sm: 6, md: 1.5 }}>
                  <TextField 
                    fullWidth 
                    type="date" 
                    label="Start Date" 
                    size="small" 
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    InputLabelProps={{ shrink: true }} 
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 6, md: 1.5 }}>
                  <TextField 
                    fullWidth 
                    type="date" 
                    label="End Date" 
                    size="small" 
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    InputLabelProps={{ shrink: true }} 
                  />
                </Grid>
              </Grid>
              <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
                <Button variant="outlined" startIcon={<RefreshOutlined />} onClick={handleRefresh} size="small">
                  Refresh
                </Button>
                <Button 
                  variant="contained" 
                  startIcon={<TableChartOutlined />} 
                  onClick={() => handleExport('excel')} 
                  size="small" 
                  disabled={exportLoading}
                >
                  Export Excel
                </Button>
                <Button 
                  variant="contained" 
                  startIcon={<PictureAsPdfOutlined />} 
                  onClick={() => handleExport('pdf')} 
                  size="small" 
                  disabled={exportLoading}
                  sx={{ bgcolor: '#dc2626', '&:hover': { bgcolor: '#b91c1c' } }}
                >
                  Export PDF
                </Button>
              </Stack>
            </Paper>
          </motion.div>

          {/* Tabs */}
          <motion.div variants={fadeInUp}>
            <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 2 }}>
              <Tab label="All Events" />
              <Tab label="Login Activity" />
              <Tab label="Data Updates" />
              <Tab label="Create/Delete" />
              <Tab label="Admin Actions" />
            </Tabs>
          </motion.div>

          {/* Data Grid */}
          <motion.div variants={fadeInUp}>
            <Paper sx={{ width: '100%', overflow: 'hidden', position: 'relative' }}>
              {error && (
                <Alert severity="error" sx={{ m: 2 }}>
                  {typeof error === 'string' ? error : error?.message || 'Failed to load audit logs'}
                </Alert>
              )}
              <Box sx={{ height: 600, width: '100%' }}>
                <DataGrid
                  rows={logs || []}
                  columns={dynamicColumns}
                  loading={isLoading}
                  rowCount={total || 0}
                  paginationMode="server"
                  pageSizeOptions={[25, 50, 100]}
                  paginationModel={{ page, pageSize: rowsPerPage }}
                  onPaginationModelChange={(model) => { setPage(model.page); setRowsPerPage(model.pageSize); }}
                  disableRowSelectionOnClick
                  getRowId={(row) => row.id || `${row.timestamp}-${row.action}`}
                  sx={{
                    '& .MuiDataGrid-cell': { borderBottom: '1px solid', borderColor: 'divider' },
                    '& .MuiDataGrid-row:hover': { backgroundColor: 'action.hover', cursor: 'pointer' },
                  }}
                  onRowClick={(params) => handleViewDetails(params.row)}
                />
              </Box>
            </Paper>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Column Manager Drawer */}
      <ColumnManager
        open={columnManagerOpen}
        onClose={() => setColumnManagerOpen(false)}
        columns={columns}
        onToggleColumn={handleToggleColumn}
      />

      {/* Details Dialog */}
      <EnhancedDetailsDialog
        open={detailsDialogOpen}
        log={selectedLog}
        onClose={() => setDetailsDialogOpen(false)}
      />

      {/* Snackbar */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }} 
        TransitionComponent={Fade}
      >
        <Alert onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default AuditLogs;