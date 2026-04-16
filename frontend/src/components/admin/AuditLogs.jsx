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
  Skeleton,
  Divider,
  Badge,
  Zoom,
  Fade,
  Grow,
  CircularProgress,
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
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchAuditLogs, getAuditStats, exportAuditLogs } from '../../store/slices/auditSlice';
import { format, subDays, parseISO } from 'date-fns';

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

const AuditLogs = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { logs, stats, isLoading, total, error } = useSelector((state) => state.audit || { logs: [], stats: {}, isLoading: false, total: 0, error: null });

  // State management
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: '',
  });
  const [selectedLog, setSelectedLog] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  const [exportLoading, setExportLoading] = useState(false);
  const [quickDateRange, setQuickDateRange] = useState('7d');

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
    // Map tab to action filter
    let tabActionFilter = actionFilter;
    if (activeTab === 1) tabActionFilter = 'login';
    if (activeTab === 2) tabActionFilter = 'create,update,delete';
    if (activeTab === 3) tabActionFilter = 'admin';

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

  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
    setPage(0);
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

  const handleViewDetails = (log) => {
    setSelectedLog(log);
    setDetailsDialogOpen(true);
  };

  const handleRefresh = () => {
    loadLogs();
    loadStats();
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const result = await dispatch(exportAuditLogs({
        search: debouncedSearch || undefined,
        action: actionFilter !== 'all' ? actionFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        start_date: dateRange.startDate || undefined,
        end_date: dateRange.endDate || undefined,
      })).unwrap();
      
      showSnackbar('Export completed successfully', 'success');
    } catch (error) {
      showSnackbar(error.message || 'Failed to export logs', 'error');
    } finally {
      setExportLoading(false);
    }
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  const getActionIcon = (action) => {
    const actionLower = action?.toLowerCase() || '';
    if (actionLower.includes('login')) return <LoginOutlined fontSize="small" />;
    if (actionLower.includes('logout')) return <LogoutOutlined fontSize="small" />;
    if (actionLower.includes('create')) return <CreateOutlined fontSize="small" />;
    if (actionLower.includes('update') || actionLower.includes('edit')) return <EditOutlined fontSize="small" />;
    if (actionLower.includes('delete')) return <DeleteOutlined fontSize="small" />;
    return <InfoOutlined fontSize="small" />;
  };

  const getActionColor = (action) => {
    const actionLower = action?.toLowerCase() || '';
    if (actionLower.includes('login')) return 'info';
    if (actionLower.includes('logout')) return 'warning';
    if (actionLower.includes('create')) return 'success';
    if (actionLower.includes('update')) return 'primary';
    if (actionLower.includes('delete')) return 'error';
    return 'default';
  };

  const getStatusColor = (status) => {
    if (status === 'success') return 'success';
    if (status === 'failure') return 'error';
    return 'default';
  };

  // Memoized columns definition
  const columns = useMemo(() => [
    {
      field: 'timestamp',
      headerName: 'Timestamp',
      width: 180,
      renderCell: (params) => (
        <Tooltip title={params.row.timestamp ? format(parseISO(params.row.timestamp), 'PPpp') : '—'}>
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {params.row.timestamp ? format(parseISO(params.row.timestamp), 'MMM dd, HH:mm:ss') : '—'}
          </Typography>
        </Tooltip>
      ),
    },
    {
      field: 'user',
      headerName: 'User',
      width: 220,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.875rem' }}>
            {params.row.user_email?.[0]?.toUpperCase() || params.row.username?.[0]?.toUpperCase() || 'U'}
          </Avatar>
          <Box>
            <Typography variant="body2" fontWeight={500}>
              {params.row.user_email || params.row.username || 'System'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {params.row.user_id ? `ID: ${params.row.user_id.slice(0, 8)}` : 'System Action'}
            </Typography>
          </Box>
        </Box>
      ),
    },
    {
      field: 'action',
      headerName: 'Action',
      width: 160,
      renderCell: (params) => (
        <Chip
          icon={getActionIcon(params.row.action)}
          label={params.row.action?.replace(/_/g, ' ') || '—'}
          size="small"
          color={getActionColor(params.row.action)}
          variant="outlined"
          sx={{ textTransform: 'capitalize' }}
        />
      ),
    },
    {
      field: 'table_name',
      headerName: 'Resource',
      width: 150,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <StorageOutlined fontSize="small" color="action" />
          <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
            {params.row.table_name?.replace(/_/g, ' ') || '—'}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'record_id',
      headerName: 'Record ID',
      width: 130,
      renderCell: (params) => (
        <Typography variant="caption" fontFamily="monospace" sx={{ opacity: 0.7 }}>
          {params.row.record_id?.slice(0, 12) || '—'}
          {params.row.record_id?.length > 12 && '...'}
        </Typography>
      ),
    },
    {
      field: 'ip_address',
      headerName: 'IP Address',
      width: 140,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ComputerOutlined fontSize="small" color="action" />
          <Typography variant="body2" fontFamily="monospace">
            {params.row.ip_address || '—'}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 110,
      renderCell: (params) => (
        <Chip
          label={params.row.status || 'success'}
          size="small"
          color={getStatusColor(params.row.status)}
          variant="filled"
          sx={{ fontWeight: 500 }}
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
          <IconButton 
            size="small" 
            onClick={() => handleViewDetails(params.row)}
            sx={{ '&:hover': { transform: 'scale(1.1)' } }}
          >
            <VisibilityOutlined fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ], []);

  // Stats cards configuration
  const statCards = useMemo(() => [
    { 
      title: 'Total Events', 
      value: stats?.total_events || stats?.total || 0, 
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
      title: 'Unique Users', 
      value: stats?.unique_users || 0, 
      icon: <PersonOutline />, 
      color: theme.palette.warning.main,
    },
  ], [stats, theme]);

  const actionTypes = [
    { value: 'all', label: 'All Actions' },
    { value: 'login', label: 'Login' },
    { value: 'logout', label: 'Logout' },
    { value: 'create', label: 'Create' },
    { value: 'update', label: 'Update' },
    { value: 'delete', label: 'Delete' },
    { value: 'export', label: 'Export' },
  ];

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <AnimatePresence mode="wait">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          {/* Header */}
          <motion.div variants={fadeInUp}>
            <Box sx={{ mb: 4 }}>
              <Typography variant="h4" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <SecurityOutlined sx={{ fontSize: 40, color: 'primary.main' }} />
                Audit Logs
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Track and monitor all system activities, user actions, and security events
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
                {(searchTerm || actionFilter !== 'all' || statusFilter !== 'all' || dateRange.startDate) && (
                  <Button
                    size="small"
                    onClick={handleClearFilters}
                    startIcon={<ClearOutlined />}
                  >
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
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
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
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
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
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Quick Range</InputLabel>
                    <Select
                      value={quickDateRange}
                      onChange={(e) => handleQuickDateRange(e.target.value)}
                      label="Quick Range"
                    >
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
                <Button
                  variant="outlined"
                  startIcon={<RefreshOutlined />}
                  onClick={handleRefresh}
                  size="small"
                >
                  Refresh
                </Button>
                <Button
                  variant="contained"
                  startIcon={exportLoading ? <CircularProgress size={20} /> : <DownloadOutlined />}
                  onClick={handleExport}
                  size="small"
                  disabled={exportLoading}
                >
                  Export
                </Button>
              </Stack>
            </Paper>
          </motion.div>

          {/* Tabs */}
          <motion.div variants={fadeInUp}>
            <Tabs 
              value={activeTab} 
              onChange={(e, v) => setActiveTab(v)} 
              sx={{ mb: 2 }}
              indicatorColor="primary"
              textColor="primary"
            >
              <Tab label="All Events" />
              <Tab label="Login Activity" />
              <Tab label="Data Modifications" />
              <Tab label="Admin Actions" />
            </Tabs>
          </motion.div>

          {/* Audit Logs Table */}
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
                  columns={columns}
                  loading={isLoading}
                  rowCount={total || 0}
                  paginationMode="server"
                  pageSizeOptions={[25, 50, 100]}
                  paginationModel={{ page, pageSize: rowsPerPage }}
                  onPaginationModelChange={(model) => {
                    setPage(model.page);
                    setRowsPerPage(model.pageSize);
                  }}
                  disableRowSelectionOnClick
                  getRowId={(row) => row.id || `${row.timestamp}-${row.action}`}
                  sx={{
                    '& .MuiDataGrid-cell': {
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                    },
                    '& .MuiDataGrid-row:hover': {
                      backgroundColor: 'action.hover',
                      cursor: 'pointer',
                    },
                  }}
                  onRowClick={(params) => handleViewDetails(params.row)}
                />
              </Box>
            </Paper>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        maxWidth="md"
        fullWidth
        TransitionComponent={Grow}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SecurityOutlined color="primary" />
            <Typography variant="h6">Audit Log Details</Typography>
            <Box sx={{ flex: 1 }} />
            <IconButton size="small" onClick={() => setDetailsDialogOpen(false)}>
              <CloseOutlined />
            </IconButton>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent dividers>
          {selectedLog && (
            <Grid container spacing={2.5}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  <CalendarTodayOutlined fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                  Timestamp
                </Typography>
                <Typography variant="body1">
                  {selectedLog.timestamp ? format(parseISO(selectedLog.timestamp), 'PPpp') : '—'}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  <PersonOutline fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                  User
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar sx={{ width: 28, height: 28 }}>
                    {selectedLog.user_email?.[0]?.toUpperCase() || selectedLog.username?.[0]?.toUpperCase() || 'U'}
                  </Avatar>
                  <Typography variant="body1">
                    {selectedLog.user_email || selectedLog.username || 'System'}
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>Action</Typography>
                <Chip
                  icon={getActionIcon(selectedLog.action)}
                  label={selectedLog.action?.replace(/_/g, ' ') || '—'}
                  color={getActionColor(selectedLog.action)}
                  size="medium"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>Status</Typography>
                <Chip
                  label={selectedLog.status || 'success'}
                  color={getStatusColor(selectedLog.status)}
                  size="medium"
                  variant="filled"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>Resource Type</Typography>
                <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                  {selectedLog.table_name?.replace(/_/g, ' ') || '—'}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>Record ID</Typography>
                <Typography variant="body1" fontFamily="monospace">
                  {selectedLog.record_id || '—'}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>IP Address</Typography>
                <Typography variant="body1" fontFamily="monospace">
                  {selectedLog.ip_address || '—'}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>User Agent</Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                  {selectedLog.user_agent || '—'}
                </Typography>
              </Grid>
              <Grid size={12}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>Changes</Typography>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default', maxHeight: 300, overflow: 'auto' }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.75rem' }}>
                    {JSON.stringify(selectedLog.old_data || selectedLog.new_data || selectedLog.details || {}, null, 2)}
                  </pre>
                </Paper>
              </Grid>
              {selectedLog.error_message && (
                <Grid size={12}>
                  <Alert severity="error" icon={<ErrorOutline />}>
                    <Typography variant="subtitle2" gutterBottom>Error Message</Typography>
                    <Typography variant="body2">{selectedLog.error_message}</Typography>
                  </Alert>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialogOpen(false)} variant="outlined">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        TransitionComponent={Fade}
      >
        <Alert 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
          severity={snackbar.severity} 
          variant="filled"
          sx={{ minWidth: 300 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default AuditLogs;