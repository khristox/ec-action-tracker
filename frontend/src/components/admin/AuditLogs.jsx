import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
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
  CircularProgress,
  InputAdornment,
  Tooltip,
  Card,
  CardContent,
  Tabs,
  Tab,
  Stack,
  Badge,
  useTheme,
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
  AdminPanelSettingsOutlined,
  FilterListOutlined,
  ClearOutlined,
  InfoOutlined,
  WarningAmberOutlined,
  ErrorOutline,
  CheckCircleOutline,
  CloseOutlined,
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { fetchAuditLogs, getAuditStats, exportAuditLogs } from '../../store/slices/auditSlice';
import { format } from 'date-fns';

const AuditLogs = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { logs, stats, isLoading, total, error } = useSelector((state) => state.audit);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: '',
  });
  const [selectedLog, setSelectedLog] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  // Load logs on mount and when filters change
  useEffect(() => {
    loadLogs();
    loadStats();
  }, [page, rowsPerPage, searchTerm, actionFilter, statusFilter, dateRange]);

  const loadLogs = () => {
    dispatch(fetchAuditLogs({
      page: page + 1,
      limit: rowsPerPage,
      search: searchTerm,
      action: actionFilter !== 'all' ? actionFilter : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      start_date: dateRange.startDate || undefined,
      end_date: dateRange.endDate || undefined,
    }));
  };

  const loadStats = () => {
    dispatch(getAuditStats());
  };

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
    setPage(0);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setActionFilter('all');
    setStatusFilter('all');
    setDateRange({ startDate: '', endDate: '' });
    setPage(0);
  };

  const handleViewDetails = (log) => {
    setSelectedLog(log);
    setDetailsDialogOpen(true);
  };

  const handleExport = async () => {
    try {
      await dispatch(exportAuditLogs({
        search: searchTerm,
        action: actionFilter !== 'all' ? actionFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        start_date: dateRange.startDate || undefined,
        end_date: dateRange.endDate || undefined,
      }));
      setSnackbarMessage('Export started. You will receive an email when ready.');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      setSnackbarMessage('Failed to export logs');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const handleRefresh = () => {
    loadLogs();
    loadStats();
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  // Get icon for action type
  const getActionIcon = (action) => {
    const actionLower = action?.toLowerCase() || '';
    if (actionLower.includes('login')) return <LoginOutlined fontSize="small" color="info" />;
    if (actionLower.includes('logout')) return <LogoutOutlined fontSize="small" color="warning" />;
    if (actionLower.includes('create')) return <CreateOutlined fontSize="small" color="success" />;
    if (actionLower.includes('update') || actionLower.includes('edit')) return <EditOutlined fontSize="small" color="primary" />;
    if (actionLower.includes('delete')) return <DeleteOutlined fontSize="small" color="error" />;
    return <InfoOutlined fontSize="small" color="action" />;
  };

  // Get color for status
  const getStatusColor = (status) => {
    if (status === 'success') return 'success';
    if (status === 'failure') return 'error';
    return 'default';
  };

  // Table columns
  const columns = [
    {
      field: 'timestamp',
      headerName: 'Timestamp',
      width: 180,
      valueGetter: (params) => params.row.timestamp ? new Date(params.row.timestamp).toLocaleString() : '—',
      renderCell: (params) => (
        <Tooltip title={params.row.timestamp ? new Date(params.row.timestamp).toLocaleString() : '—'}>
          <Typography variant="body2">
            {params.row.timestamp ? format(new Date(params.row.timestamp), 'MMM dd, HH:mm:ss') : '—'}
          </Typography>
        </Tooltip>
      ),
    },
    {
      field: 'user',
      headerName: 'User',
      width: 200,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
            {params.row.username?.[0]?.toUpperCase() || 'U'}
          </Avatar>
          <Box>
            <Typography variant="body2" fontWeight={500}>
              {params.row.username || 'System'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {params.row.user_email || params.row.username}
            </Typography>
          </Box>
        </Box>
      ),
    },
    {
      field: 'action',
      headerName: 'Action',
      width: 150,
      renderCell: (params) => (
        <Chip
          icon={getActionIcon(params.row.action)}
          label={params.row.action?.replace(/_/g, ' ') || '—'}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: 'resource_type',
      headerName: 'Resource',
      width: 150,
      renderCell: (params) => (
        <Typography variant="body2" color="text.secondary">
          {params.row.resource_type?.replace(/_/g, ' ') || '—'}
        </Typography>
      ),
    },
    {
      field: 'resource_id',
      headerName: 'Resource ID',
      width: 120,
      renderCell: (params) => (
        <Typography variant="caption" fontFamily="monospace">
          {params.row.resource_id?.slice(0, 8) || '—'}
        </Typography>
      ),
    },
    {
      field: 'ip_address',
      headerName: 'IP Address',
      width: 130,
      renderCell: (params) => (
        <Typography variant="body2" fontFamily="monospace">
          {params.row.ip_address || '—'}
        </Typography>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 100,
      renderCell: (params) => (
        <Chip
          label={params.row.status || 'success'}
          size="small"
          color={getStatusColor(params.row.status)}
          variant="outlined"
        />
      ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 80,
      sortable: false,
      renderCell: (params) => (
        <Tooltip title="View Details">
          <IconButton size="small" onClick={() => handleViewDetails(params.row)}>
            <VisibilityOutlined fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  // Stats cards
  const statCards = [
    { title: 'Total Events', value: stats?.total || 0, icon: <InfoOutlined />, color: 'primary.main' },
    { title: 'Successful', value: stats?.successful || 0, icon: <CheckCircleOutline />, color: 'success.main' },
    { title: 'Failed', value: stats?.failed || 0, icon: <ErrorOutline />, color: 'error.main' },
    { title: 'Unique Users', value: stats?.unique_users || 0, icon: <PersonOutline />, color: 'warning.main' },
  ];

  // Action types for filter
  const actionTypes = [
    { value: 'all', label: 'All Actions' },
    { value: 'login', label: 'Login' },
    { value: 'logout', label: 'Logout' },
    { value: 'create', label: 'Create' },
    { value: 'update', label: 'Update' },
    { value: 'delete', label: 'Delete' },
    { value: 'export', label: 'Export' },
    { value: 'import', label: 'Import' },
  ];

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Audit Logs
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Track system activity and user actions
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statCards.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography color="text.secondary" gutterBottom>
                      {stat.title}
                    </Typography>
                    <Typography variant="h4">{stat.value}</Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: stat.color, width: 48, height: 48 }}>
                    {stat.icon}
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              placeholder="Search users, actions, resources..."
              value={searchTerm}
              onChange={handleSearch}
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Action</InputLabel>
              <Select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                label="Action"
              >
                {actionTypes.map((action) => (
                  <MenuItem key={action.value} value={action.value}>
                    {action.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status"
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="success">Success</MenuItem>
                <MenuItem value="failure">Failure</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={2}>
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
          <Grid item xs={12} sm={2}>
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
          <Grid item xs={12} sm={1}>
            <Stack direction="row" spacing={1}>
              <Tooltip title="Clear Filters">
                <IconButton onClick={handleClearFilters} size="small">
                  <ClearOutlined />
                </IconButton>
              </Tooltip>
              <Tooltip title="Refresh">
                <IconButton onClick={handleRefresh} size="small">
                  <RefreshOutlined />
                </IconButton>
              </Tooltip>
              <Tooltip title="Export">
                <IconButton onClick={handleExport} size="small">
                  <DownloadOutlined />
                </IconButton>
              </Tooltip>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabs for different views */}
      <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 2 }}>
        <Tab label="All Events" />
        <Tab label="Login Activity" />
        <Tab label="Data Modifications" />
        <Tab label="Admin Actions" />
      </Tabs>

      {/* Audit Logs Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <Box sx={{ height: 600, width: '100%' }}>
          <DataGrid
            rows={logs || []}
            columns={columns}
            loading={isLoading}
            rowCount={total}
            paginationMode="server"
            pageSizeOptions={[25, 50, 100]}
            paginationModel={{ page, pageSize: rowsPerPage }}
            onPaginationModelChange={(model) => {
              setPage(model.page);
              setRowsPerPage(model.pageSize);
            }}
            disableRowSelectionOnClick
            sx={{
              '& .MuiDataGrid-cell': {
                borderBottom: '1px solid',
                borderColor: 'divider',
              },
            }}
          />
        </Box>
      </Paper>

      {/* Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SecurityOutlined />
            <Typography variant="h6">Audit Log Details</Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedLog && (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Timestamp</Typography>
                <Typography variant="body1">
                  {selectedLog.timestamp ? new Date(selectedLog.timestamp).toLocaleString() : '—'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">User</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar sx={{ width: 24, height: 24 }}>
                    {selectedLog.username?.[0]?.toUpperCase() || 'U'}
                  </Avatar>
                  <Typography variant="body1">
                    {selectedLog.username || 'System'} ({selectedLog.user_email || selectedLog.username})
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Action</Typography>
                <Chip
                  icon={getActionIcon(selectedLog.action)}
                  label={selectedLog.action}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                <Chip
                  label={selectedLog.status || 'success'}
                  size="small"
                  color={getStatusColor(selectedLog.status)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Resource Type</Typography>
                <Typography variant="body1">{selectedLog.resource_type || '—'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Resource ID</Typography>
                <Typography variant="body1" fontFamily="monospace">
                  {selectedLog.resource_id || '—'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">IP Address</Typography>
                <Typography variant="body1" fontFamily="monospace">
                  {selectedLog.ip_address || '—'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">User Agent</Typography>
                <Typography variant="body2">{selectedLog.user_agent || '—'}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">Details</Typography>
                <Paper sx={{ p: 2, bgcolor: 'background.default', mt: 1 }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {JSON.stringify(selectedLog.details || selectedLog.metadata || {}, null, 2)}
                  </pre>
                </Paper>
              </Grid>
              {selectedLog.error_message && (
                <Grid item xs={12}>
                  <Alert severity="error" icon={<ErrorOutline />}>
                    <Typography variant="subtitle2">Error Message</Typography>
                    <Typography variant="body2">{selectedLog.error_message}</Typography>
                  </Alert>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} variant="filled">
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default AuditLogs;