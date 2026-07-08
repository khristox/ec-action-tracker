// src/components/meetings/MeetingNotifications.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  Stack,
  Chip,
  Button,
  IconButton,
  Divider,
  Alert,
  CircularProgress,
  TextField,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  AppBar,
  Toolbar,
  useMediaQuery,
  useTheme,
  alpha,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Tooltip,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Notifications as NotificationsIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
  WhatsApp as WhatsAppIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  HourglassEmpty as HourglassEmptyIcon,
  Visibility as VisibilityIcon,
  WarningAmber as WarningIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import api from '../../../../../services/api';

// ==================== Constants ====================

const CHANNEL_FILTERS = [
  { value: 'all', label: 'All Channels' },
  { value: 'email', label: 'Email', icon: <EmailIcon sx={{ fontSize: 16 }} /> },
  { value: 'sms', label: 'SMS', icon: <SmsIcon sx={{ fontSize: 16 }} /> },
  { value: 'whatsapp', label: 'WhatsApp', icon: <WhatsAppIcon sx={{ fontSize: 16 }} /> },
];

const CHANNEL_CONFIG = {
  email:    { label: 'Email', color: '#3B82F6', icon: <EmailIcon sx={{ fontSize: 14 }} /> },
  sms:      { label: 'SMS', color: '#F59E0B', icon: <SmsIcon sx={{ fontSize: 14 }} /> },
  whatsapp: { label: 'WhatsApp', color: '#25D366', icon: <WhatsAppIcon sx={{ fontSize: 14 }} /> },
};

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'successful', label: 'Sent' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Pending' },
];

const STATUS_CONFIG = {
  successful: { label: 'Sent', color: 'success', icon: <CheckCircleIcon sx={{ fontSize: 14 }} /> },
  failed:     { label: 'Failed', color: 'error', icon: <CancelIcon sx={{ fontSize: 14 }} /> },
  pending:    { label: 'Pending', color: 'warning', icon: <HourglassEmptyIcon sx={{ fontSize: 14 }} /> },
};

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50];

// ==================== Helper Functions ====================

const formatDateTime = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return '—';
  }
};

const getChannelConfig = (channel) => CHANNEL_CONFIG[channel] || {
  label: channel || 'Unknown',
  color: '#6B7280',
  icon: <NotificationsIcon sx={{ fontSize: 14 }} />,
};

// ==================== Row Component ====================

const NotificationRow = ({ notification, isMobile, onView }) => {
  const statusConfig = STATUS_CONFIG[notification.status] || STATUS_CONFIG.pending;
  const channelConfig = getChannelConfig(notification.channel);
  // Open tracking is currently only meaningful for email (pixel-based);
  // other channels won't have is_opened populated, so the chip only shows
  // when the flag is actually true rather than assuming per-channel support.
  const showOpened = notification.channel === 'email' && notification.is_opened;

  if (isMobile) {
    return (
      <Paper
        variant="outlined"
        sx={{ p: 2, borderRadius: 2, cursor: 'pointer' }}
        onClick={() => onView(notification)}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Box sx={{ color: channelConfig.color, display: 'flex' }}>{channelConfig.icon}</Box>
              <Typography variant="body2" fontWeight={700} noWrap>
                {notification.recipient_name || notification.recipient}
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              {notification.recipient}
            </Typography>
          </Box>
          <Chip
            icon={statusConfig.icon}
            label={statusConfig.label}
            size="small"
            color={statusConfig.color}
            sx={{ height: 22, fontSize: '0.7rem' }}
          />
        </Stack>

        <Divider sx={{ my: 1.5 }} />

        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            {formatDateTime(notification.sent_at || notification.created_at)}
          </Typography>
          {showOpened && (
            <Chip
              icon={<VisibilityIcon sx={{ fontSize: 12 }} />}
              label="Opened"
              size="small"
              variant="outlined"
              color="info"
              sx={{ height: 18, fontSize: '0.6rem' }}
            />
          )}
        </Stack>

        {notification.status === 'failed' && notification.error_message && (
          <Alert severity="error" icon={<WarningIcon fontSize="small" />} sx={{ mt: 1.5, py: 0.25 }}>
            <Typography variant="caption">{notification.error_message}</Typography>
          </Alert>
        )}
      </Paper>
    );
  }

  return (
    <TableRow hover sx={{ cursor: 'pointer' }} onClick={() => onView(notification)}>
      <TableCell>
        <Tooltip title={channelConfig.label} arrow>
          <Box sx={{ color: channelConfig.color, display: 'flex', alignItems: 'center' }}>
            {channelConfig.icon}
          </Box>
        </Tooltip>
      </TableCell>
      <TableCell>
        <Typography variant="body2" fontWeight={600}>
          {notification.recipient_name || '—'}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {notification.recipient}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" noWrap sx={{ maxWidth: 260 }}>
          {notification.subject || '—'}
        </Typography>
      </TableCell>
      <TableCell>
        <Chip
          icon={statusConfig.icon}
          label={statusConfig.label}
          size="small"
          color={statusConfig.color}
          sx={{ height: 22, fontSize: '0.7rem' }}
        />
        {notification.status === 'failed' && notification.error_message && (
          <Tooltip title={notification.error_message} arrow>
            <WarningIcon sx={{ fontSize: 16, color: 'error.main', ml: 0.5, verticalAlign: 'middle', cursor: 'help' }} />
          </Tooltip>
        )}
      </TableCell>
      <TableCell>
        {showOpened ? (
          <Chip
            icon={<VisibilityIcon sx={{ fontSize: 12 }} />}
            label="Opened"
            size="small"
            variant="outlined"
            color="info"
            sx={{ height: 20, fontSize: '0.65rem' }}
          />
        ) : (
          <Typography variant="caption" color="text.disabled">—</Typography>
        )}
      </TableCell>
      <TableCell align="right">
        <Typography variant="caption" color="text.secondary">
          {formatDateTime(notification.sent_at || notification.created_at)}
        </Typography>
      </TableCell>
      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
        <Tooltip title="View message" arrow>
          <IconButton size="small" onClick={() => onView(notification)}>
            <VisibilityIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
};

// ==================== Message Detail Dialog ====================

const MessageDetailDialog = ({ open, onClose, notification }) => {
  if (!notification) return null;

  const statusConfig = STATUS_CONFIG[notification.status] || STATUS_CONFIG.pending;
  const channelConfig = getChannelConfig(notification.channel);
  const isEmail = notification.channel === 'email';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ color: channelConfig.color, display: 'flex' }}>{channelConfig.icon}</Box>
            <Typography variant="h6" fontWeight={700} noWrap>
              {notification.recipient_name || notification.recipient}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {notification.recipient}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip
              icon={statusConfig.icon}
              label={statusConfig.label}
              size="small"
              color={statusConfig.color}
              sx={{ height: 24 }}
            />
            {notification.channel === 'email' && notification.is_opened && (
              <Chip
                icon={<VisibilityIcon sx={{ fontSize: 14 }} />}
                label="Opened"
                size="small"
                variant="outlined"
                color="info"
                sx={{ height: 24 }}
              />
            )}
            <Chip
              label={formatDateTime(notification.sent_at || notification.created_at)}
              size="small"
              variant="outlined"
              sx={{ height: 24 }}
            />
          </Stack>

          {notification.status === 'failed' && notification.error_message && (
            <Alert severity="error" icon={<WarningIcon fontSize="small" />}>
              {notification.error_message}
            </Alert>
          )}

          {isEmail && notification.subject && (
            <Box>
              <Typography variant="caption" fontWeight={700} color="text.secondary">SUBJECT</Typography>
              <Typography variant="body2">{notification.subject}</Typography>
            </Box>
          )}

          <Box>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              MESSAGE
            </Typography>

            {isEmail ? (
              // Rendered content was authored by this system's own templates
              // (meeting invites etc.) - not third-party/untrusted HTML - so
              // it's safe to render directly. sandbox strips script
              // execution regardless, as defense in depth.
              <Box
                component="iframe"
                title="Email content preview"
                sandbox=""
                srcDoc={notification.content || ''}
                sx={{
                  width: '100%',
                  minHeight: 320,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  bgcolor: '#fff',
                }}
              />
            ) : (
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 1,
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'inherit',
                  fontSize: '0.875rem',
                  bgcolor: (theme) => alpha(theme.palette.text.primary, 0.03),
                }}
              >
                {notification.content || 'No content available.'}
              </Paper>
            )}
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

// ==================== Main Component ====================

const MeetingNotifications = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [notifications, setNotifications] = useState([]);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [channelFilter, setChannelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [selectedNotification, setSelectedNotification] = useState(null);

  const handleViewNotification = useCallback((notification) => {
    setSelectedNotification(notification);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedNotification(null);
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const params = { meeting_id: id, limit: 200 };
      if (channelFilter !== 'all') params.channel = channelFilter;
      if (statusFilter !== 'all') params.status = statusFilter;

      const response = await api.get('/notifications', { params });
      setNotifications(response.data?.items || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(
        err.response?.status === 403
          ? "You don't have permission to view this meeting's notification history."
          : 'Failed to load notification history.'
      );
    } finally {
      setLoading(false);
    }
  }, [id, channelFilter, statusFilter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Fetch the meeting title separately - this page can be reached via a
  // direct URL, not only by navigating from MeetingDetail, so it doesn't
  // rely on Redux state already having the meeting loaded.
  useEffect(() => {
    if (!id) return;
    api.get(`/meetings/${id}`)
      .then((res) => setMeetingTitle(res.data?.title || ''))
      .catch(() => setMeetingTitle(''));
  }, [id]);

  const filteredNotifications = useMemo(() => {
    if (!searchTerm.trim()) return notifications;
    const term = searchTerm.trim().toLowerCase();
    return notifications.filter((n) =>
      (n.recipient || '').toLowerCase().includes(term) ||
      (n.recipient_name || '').toLowerCase().includes(term) ||
      (n.subject || '').toLowerCase().includes(term)
    );
  }, [notifications, searchTerm]);

  const paginatedNotifications = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredNotifications.slice(start, start + rowsPerPage);
  }, [filteredNotifications, page, rowsPerPage]);

  const counts = useMemo(() => ({
    total: notifications.length,
    sent: notifications.filter((n) => n.status === 'successful').length,
    failed: notifications.filter((n) => n.status === 'failed').length,
    pending: notifications.filter((n) => n.status === 'pending').length,
    opened: notifications.filter((n) => n.channel === 'email' && n.is_opened).length,
  }), [notifications]);

  const channelCounts = useMemo(() => {
    const byChannel = {};
    notifications.forEach((n) => {
      byChannel[n.channel] = (byChannel[n.channel] || 0) + 1;
    });
    return byChannel;
  }, [notifications]);

  const handleChannelFilterChange = (_, value) => {
    if (value !== null) {
      setChannelFilter(value);
      setPage(0);
    }
  };

  const handleStatusFilterChange = (_, value) => {
    if (value !== null) {
      setStatusFilter(value);
      setPage(0);
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setPage(0);
  };

  const handleChangePage = (_, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: isDarkMode ? '#111827' : '#F3F4F6' }}>
      <AppBar
        position="sticky"
        elevation={isDarkMode ? 0 : 2}
        sx={{
          bgcolor: isDarkMode ? '#1F2937' : '#FFFFFF',
          borderBottom: 1,
          borderColor: isDarkMode ? '#374151' : '#E5E7EB',
        }}
      >
        <Toolbar sx={{ px: { xs: 1.5, sm: 3 } }}>
          <IconButton onClick={() => navigate(-1)} edge="start" sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" fontWeight={700} noWrap>
              Notifications
            </Typography>
            {meetingTitle && (
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                {meetingTitle}
              </Typography>
            )}
          </Box>
          <Tooltip title="Refresh" arrow>
            <IconButton onClick={fetchNotifications}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3, md: 4 } }}>
        {/* Summary cards */}
        <Stack direction="row" spacing={1.5} sx={{ mb: 3, overflowX: 'auto', pb: 0.5 }}>
          {[
            { label: 'Total', value: counts.total, color: '#7C3AED' },
            { label: 'Sent', value: counts.sent, color: '#10B981' },
            { label: 'Failed', value: counts.failed, color: '#EF4444' },
            { label: 'Pending', value: counts.pending, color: '#F59E0B' },
            { label: 'Opened', value: counts.opened, color: '#3B82F6' },
          ].map((stat) => (
            <Paper
              key={stat.label}
              variant="outlined"
              sx={{
                p: 1.5,
                minWidth: 100,
                borderRadius: 2,
                textAlign: 'center',
                borderColor: alpha(stat.color, 0.3),
                bgcolor: alpha(stat.color, isDarkMode ? 0.08 : 0.05),
                flexShrink: 0,
              }}
            >
              <Typography variant="h5" fontWeight={800} sx={{ color: stat.color }}>
                {stat.value}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {stat.label}
              </Typography>
            </Paper>
          ))}
        </Stack>

        {/* Filters */}
        <Paper sx={{ p: 2, borderRadius: 3, mb: 2 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <TextField
                size="small"
                placeholder="Search by name, contact, or subject..."
                value={searchTerm}
                onChange={handleSearchChange}
                sx={{ flex: 1 }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <ToggleButtonGroup
                value={statusFilter}
                exclusive
                onChange={handleStatusFilterChange}
                size="small"
              >
                {STATUS_FILTERS.map((f) => (
                  <ToggleButton key={f.value} value={f.value} sx={{ textTransform: 'none', px: 2 }}>
                    {f.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Stack>

            <ToggleButtonGroup
              value={channelFilter}
              exclusive
              onChange={handleChannelFilterChange}
              size="small"
              sx={{ flexWrap: 'wrap' }}
            >
              {CHANNEL_FILTERS.map((f) => (
                <ToggleButton key={f.value} value={f.value} sx={{ textTransform: 'none', px: 2, gap: 0.75 }}>
                  {f.icon}
                  {f.label}
                  {f.value !== 'all' && channelCounts[f.value] ? ` (${channelCounts[f.value]})` : ''}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Stack>
        </Paper>

        {/* Content */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}

        {loading ? (
          <Stack spacing={1.5}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} variant="rounded" height={isMobile ? 100 : 56} />
            ))}
          </Stack>
        ) : filteredNotifications.length === 0 ? (
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
            <NotificationsIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              {searchTerm || statusFilter !== 'all' || channelFilter !== 'all'
                ? 'No notifications match your filters.'
                : 'No notifications have been sent for this meeting yet.'}
            </Typography>
          </Paper>
        ) : isMobile ? (
          <Stack spacing={1.5}>
            {paginatedNotifications.map((n) => (
              <NotificationRow key={n.id} notification={n} isMobile onView={handleViewNotification} />
            ))}
            <TablePagination
              component="div"
              count={filteredNotifications.length}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
            />
          </Stack>
        ) : (
          <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, width: 40 }}></TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Recipient</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Contact</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Subject</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Opened</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Sent</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 60 }} align="right"></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedNotifications.map((n) => (
                    <NotificationRow key={n.id} notification={n} isMobile={false} onView={handleViewNotification} />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={filteredNotifications.length}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
            />
          </Paper>
        )}
      </Container>

      <MessageDetailDialog
        open={Boolean(selectedNotification)}
        onClose={handleCloseDetail}
        notification={selectedNotification}
      />
    </Box>
  );
};

export default MeetingNotifications;