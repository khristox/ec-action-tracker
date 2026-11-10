// src/components/actiontracker/meetings/components/MeetingCard.jsx

import React, { useMemo, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Button,
  Paper,
  alpha,
  useMediaQuery,
  useTheme,
  Avatar,
  AvatarGroup,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from "@mui/material";
import {
  Edit,
  Delete,
  NotificationsActive,
  Event,
  LocationOn,
  People,
  Videocam,
  AccessTime,
  Repeat,
  CalendarToday,
  ChevronRight,
  Add as AddIcon,
  ListAlt as ListAltIcon,
  MoreVert as MoreVertIcon,
  Share as ShareIcon,
  ContentCopy as ContentCopyIcon,
  Print as PrintIcon,
  Link as LinkIcon,
  Business as BusinessIcon,
  Lock as LockIcon,
  Public as PublicIcon,
  Group as GroupIcon,
} from "@mui/icons-material";

// ============ COLORS ============
const COLORS = {
  primary: "#1976d2",
  secondary: "#dc004e",
  success: "#2e7d32",
  error: "#d32f2f",
  warning: "#ed6c02",
  info: "#0288d1",
  divider: "#e0e0e0",
  text: {
    primary: "#212121",
    secondary: "#757575",
  },
  background: {
    paper: "#ffffff",
    default: "#f5f5f5",
  },
};

// ============ STATUS MAPPINGS ============
const STATUS_MUI_COLOR_MAP = {
  PENDING: "warning",
  STARTED: "success",
  ENDED: "default",
  CANCELLED: "error",
};

const STATUS_HEX_COLOR_MAP = {
  PENDING: "#ed6c02",
  STARTED: "#2e7d32",
  ENDED: "#757575",
  CANCELLED: "#d32f2f",
};

const STATUS_BG_COLOR_MAP = {
  PENDING: "#fff3e0",
  STARTED: "#e8f5e9",
  ENDED: "#f5f5f5",
  CANCELLED: "#ffebee",
};

const STATUS_LABEL_MAP = {
  PENDING: "Pending",
  STARTED: "Started",
  ENDED: "Ended",
  CANCELLED: "Cancelled",
};
// ============ VISIBILITY CONFIGURATION ============
const VISIBILITY_CONFIG = {
  open: {
    label: "Open",
    icon: <PublicIcon fontSize="small" />,
    color: "#2e7d32",
    bgColor: "#e8f5e9",
    description: "Visible to all users",
  },
  department: {
    label: "🔐",
    icon: <GroupIcon fontSize="small" />,
    color: "#ed6c02",
    bgColor: "#fff3e0",
    description: "Restricted to department members",
  },
  restricted: {
    label: "Restricted",
    icon: <LockIcon fontSize="small" />,
    color: "#d32f2f",
    bgColor: "#ffebee",
    description: "Restricted access",
  },
  private: {
    label: "Private",
    icon: <LockIcon fontSize="small" />,
    color: "#9c27b0",
    bgColor: "#f3e5f5",
    description: "Private meeting",
  },
};

// ============ STATUS EXTRACTION HELPER ============
const VALID_MEETING_STATUSES = [
  "PENDING",
  "STARTED",
  "ENDED",
  "CANCELLED",
];

const normalizeMeetingStatus = (value) => {
  if (!value) return "PENDING";

  const normalized = String(value)
    .trim()
    .toUpperCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");

  // Normalize common legacy spelling
  if (normalized === "CANCELED") {
    return "CANCELLED";
  }

  // Only allow the four canonical meeting states
  if (VALID_MEETING_STATUSES.includes(normalized)) {
    return normalized;
  }

  return "PENDING";
};

const extractStatusInfo = (meeting) => {
  let rawStatus = null;

  if (meeting?.status && typeof meeting.status === "object") {
    rawStatus =
      meeting.status.short_name ||
      meeting.status.code ||
      meeting.status.name ||
      null;
  } else if (typeof meeting?.status === "string") {
    rawStatus = meeting.status;
  }

  const shortName = normalizeMeetingStatus(rawStatus);

  return {
    label: STATUS_LABEL_MAP[shortName],
    color: meeting?.status?.color || STATUS_MUI_COLOR_MAP[shortName],
    hexColor:
      meeting?.status?.hex_color ||
      STATUS_HEX_COLOR_MAP[shortName],
    bgColor:
      meeting?.status?.bg_color ||
      STATUS_BG_COLOR_MAP[shortName],
    shortName,
    raw: meeting?.status || null,
  };
};
// ============ COMPONENTS ============
const StatusChip = React.memo(({ statusInfo }) => {
  const label = statusInfo?.label || "Pending";
  const color = statusInfo?.color || "warning";

  return (
    <Chip
      label={label}
      size="small"
      color={color}
      sx={{
        fontWeight: 700,
        borderRadius: 1.5,
        height: 22,
        fontSize: "0.65rem",
        textTransform: "uppercase",
        letterSpacing: "0.3px",
        "& .MuiChip-label": { px: 1 },
      }}
    />
  );
});
// ============ VISIBILITY CHIP COMPONENT ============
const VisibilityChip = React.memo(({ visibility, restrictedDepartmentName }) => {
  const config = VISIBILITY_CONFIG[visibility] || VISIBILITY_CONFIG.open;
  
  // If it's a department-restricted meeting, show the department name
  const isDepartmentRestricted = visibility === 'department' || visibility === 'restricted';
  const departmentLabel = isDepartmentRestricted && restrictedDepartmentName 
    ? `: ${restrictedDepartmentName}` 
    : '';

  return (
    <Tooltip title={config.description || ''} placement="top">
      <Chip
        icon={config.icon}
        label={`${config.label}${departmentLabel}`}
        size="small"
        sx={{
          height: 22,
          fontSize: "0.6rem",
          fontWeight: 600,
          bgcolor: config.bgColor,
          color: config.color,
          borderColor: alpha(config.color, 0.3),
          '& .MuiChip-icon': {
            color: config.color,
            fontSize: 14,
          },
          '& .MuiChip-label': {
            px: 1,
          },
        }}
      />
    </Tooltip>
  );
});
VisibilityChip.displayName = 'VisibilityChip';

// ============ DEPARTMENT INFO COMPONENT ============
const DepartmentInfo = React.memo(({ departmentName, restrictedDepartmentName, visibility }) => {
  // Only show if there's department information
  if (!departmentName && !restrictedDepartmentName) {
    return null;
  }

  const isRestricted = visibility === 'department' || visibility === 'restricted';
  const displayName = isRestricted ? restrictedDepartmentName : departmentName;

  if (!displayName) {
    return null;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 0.75,
        py: 0.35,
        borderRadius: 1,
        bgcolor: alpha(COLORS.primary, 0.04),
        border: `1px solid ${alpha(COLORS.primary, 0.08)}`,
      }}
    >
      <BusinessIcon sx={{ fontSize: 14, color: COLORS.primary }} />
      <Typography
        variant="caption"
        sx={{
          fontWeight: 500,
          color: 'text.secondary',
          fontSize: '0.6rem',
        }}
      >
        {displayName}
      </Typography>
      {isRestricted && (
        <LockIcon sx={{ fontSize: 12, color: COLORS.warning }} />
      )}
    </Box>
  );
});
DepartmentInfo.displayName = 'DepartmentInfo';

const InfoItem = React.memo(({ icon, label, value, color = "#0288d1" }) => {
  const safeColor = color || "#0288d1";

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1,
        flex: 1,
        minWidth: 0,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 24,
          height: 24,
          borderRadius: 1,
          bgcolor: alpha(safeColor, 0.1),
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        {React.cloneElement(icon, { sx: { fontSize: 14, color: safeColor } })}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          sx={{ lineHeight: 1.2 }}
        >
          {label}
        </Typography>
        <Typography
          variant="body2"
          fontWeight={600}
          sx={{
            lineHeight: 1.3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {value || "N/A"}
        </Typography>
      </Box>
    </Box>
  );
});

const ParticipantAvatars = React.memo(({ participants, count, max = 3 }) => {
  const displayCount = count || 0;

  if (displayCount === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No participants
      </Typography>
    );
  }

  const displayParticipants = participants?.slice(0, max) || [];

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <AvatarGroup
        max={max}
        sx={{
          "& .MuiAvatar-root": {
            width: 22,
            height: 22,
            fontSize: "0.55rem",
            border: "2px solid",
            borderColor: "background.paper",
          },
        }}
      >
        {displayParticipants.map((p, idx) => (
          <Avatar
            key={idx}
            sx={{
              bgcolor: COLORS.primary,
              width: 22,
              height: 22,
              fontSize: "0.55rem",
            }}
          >
            {p?.name?.charAt(0) || p?.email?.charAt(0) || "P"}
          </Avatar>
        ))}
      </AvatarGroup>
      {displayCount > max && (
        <Typography variant="caption" color="text.secondary">
          +{displayCount - max}
        </Typography>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
        {displayCount} participant{displayCount > 1 ? "s" : ""}
      </Typography>
    </Box>
  );
});

// ============ MAIN COMPONENT ============
export const MeetingCard = ({
  meeting,
  statusOptions,
  onView,
  onViewSeriesActions,
  onEdit,
  onNotify,
  onGenerateMeeting,
  onDelete,
  onAddAction,
  onShare,
  onCopyLink,
  onPrint,
  sx = {},
  // NEW: Source context for navigation
  source = 'meetings', // 'meetings' or 'recurring-meetings'
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "md"));

  // ============ STATE ============
  const [moreMenuAnchor, setMoreMenuAnchor] = React.useState(null);
  const moreMenuOpen = Boolean(moreMenuAnchor);

  // ============ ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURN ============

  const statusInfo = useMemo(() => extractStatusInfo(meeting), [meeting]);

  const isRecurring = useMemo(
    () => meeting?.is_recurring || meeting?.recurring_meeting_id,
    [meeting?.is_recurring, meeting?.recurring_meeting_id],
  );

  const locationText = useMemo(
    () => meeting?.location_text || meeting?.location || "Online",
    [meeting?.location_text, meeting?.location],
  );

  const isVirtual = useMemo(() => {
    const lower = locationText?.toLowerCase() || "";
    return (
      lower.includes("zoom") ||
      lower.includes("meet") ||
      lower.includes("teams") ||
      lower.includes("virtual")
    );
  }, [locationText]);

  const participantCount = useMemo(
    () => meeting?.participants_count || meeting?.participants?.length || 0,
    [meeting?.participants_count, meeting?.participants],
  );

  const formattedDate = useMemo(() => {
    try {
      if (!meeting?.meeting_date) return "Date TBD";
      const date = new Date(meeting.meeting_date);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Date TBD";
    }
  }, [meeting?.meeting_date]);

  const formattedTime = useMemo(() => {
    try {
      const start = meeting?.start_time
        ? new Date(meeting.start_time).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "TBD";
      const end = meeting?.end_time
        ? new Date(meeting.end_time).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "TBD";
      return `${start} - ${end}`;
    } catch {
      return "Time TBD";
    }
  }, [meeting?.start_time, meeting?.end_time]);

  const isCompact = isMobile || isTablet;
  const statusColor = statusInfo?.hexColor || "#757575";

  // Actions can only be added while the meeting is started
  const canAddActions = useMemo(() => {
    return statusInfo?.shortName === "STARTED";
  }, [statusInfo?.shortName]);

  // ============ Cummulative actions for recurring meetings ============
    const seriesId = useMemo(
    () => meeting?.recurring_meeting_id || (source === 'recurring-meetings' ? meeting?.id : null),
    [meeting?.recurring_meeting_id, meeting?.id, source],
  );

  const handleSeriesActionsClick = useCallback(
    (e) => {
      e.stopPropagation();
      if (seriesId && onViewSeriesActions) onViewSeriesActions(seriesId, meeting);
    },
    [onViewSeriesActions, seriesId, meeting],
  );

  // Get visibility and department info
  const visibility = useMemo(
    () => meeting?.visibility || "open",
    [meeting?.visibility]
  );

  const restrictedDepartmentName = useMemo(
    () => meeting?.restricted_department_name || null,
    [meeting?.restricted_department_name]
  );

  const departmentName = useMemo(
    () => meeting?.department_name || null,
    [meeting?.department_name]
  );

  // Responsive icon size
  const iconSize = "small";  // Use "small" for all icons for consistency

  // ============ HANDLERS ============
  
  /**
   * Handle card click - navigates to meeting detail with source context
   */
  const handleCardClick = useCallback(() => {
    if (meeting?.id && onView) {
      // Pass the source context to the onView callback
      // The parent component will handle the navigation with state
      onView(meeting.id, source);
    }
  }, [onView, meeting?.id, source]);

  /**
   * Handle edit click - navigates to edit page with source context
   */
  const handleEditClick = useCallback(
    (e) => {
      e.stopPropagation();
      if (meeting?.id && onEdit) {
        onEdit(meeting.id, source);
      }
    },
    [onEdit, meeting?.id, source],
  );

  const handleNotifyClick = useCallback(
    (e) => {
      e.stopPropagation();
      if (meeting && onNotify) {
        onNotify(meeting);
      }
    },
    [onNotify, meeting],
  );

  const handleGenerateClick = useCallback(
    (e) => {
      e.stopPropagation();
      if (meeting && onGenerateMeeting) {
        onGenerateMeeting(meeting);
      }
    },
    [onGenerateMeeting, meeting],
  );

  const handleDeleteClick = useCallback(
    (e) => {
      e.stopPropagation();
      if (meeting?.id && onDelete) {
        onDelete(meeting.id);
      }
    },
    [onDelete, meeting?.id],
  );

  const handleAddActionClick = useCallback(
    (e) => {
      e.stopPropagation();
      if (meeting && onAddAction) {
        onAddAction(meeting);
      }
    },
    [onAddAction, meeting],
  );

  const handleMoreMenuOpen = useCallback((e) => {
    e.stopPropagation();
    setMoreMenuAnchor(e.currentTarget);
  }, []);

  const handleMoreMenuClose = useCallback((e) => {
    e?.stopPropagation?.();
    setMoreMenuAnchor(null);
  }, []);

  const handleShare = useCallback(
    (e) => {
      e.stopPropagation();
      if (onShare) onShare(meeting);
      handleMoreMenuClose(e);
    },
    [onShare, meeting, handleMoreMenuClose],
  );

  const handleCopyLink = useCallback(
    (e) => {
      e.stopPropagation();
      if (onCopyLink) onCopyLink(meeting);
      handleMoreMenuClose(e);
    },
    [onCopyLink, meeting, handleMoreMenuClose],
  );

  const handlePrint = useCallback(
    (e) => {
      e.stopPropagation();
      if (onPrint) onPrint(meeting);
      handleMoreMenuClose(e);
    },
    [onPrint, meeting, handleMoreMenuClose],
  );

  // ============ EARLY RETURN - NOW AFTER ALL HOOKS ============
  if (!meeting) {
    console.warn("MeetingCard: meeting prop is undefined");
    return null;
  }

  // ============ RENDER ============
  return (
    <Card
      elevation={0}
      onClick={handleCardClick}
      sx={{
        cursor: "pointer",
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: isMobile ? 2 : 3,
        border: `1px solid ${alpha(statusColor, 0.2)}`,
        bgcolor: alpha(statusColor, 0.02),
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        position: "relative",
        overflow: "hidden",
        "&:hover": {
          borderColor: statusColor,
          transform: isMobile ? "none" : "translateY(-2px)",
          boxShadow: theme.shadows[8],
        },
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          bgcolor: statusColor,
          opacity: 0.3,
        },
        ...sx,
      }}
    >
      <Box
        sx={{
          height: 3,
          bgcolor: statusColor,
          width: "100%",
          flexShrink: 0,
        }}
      />

      <CardContent
        sx={{
          p: isMobile ? 1.25 : 1.5,
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        {/* Header with Status and Visibility Chips */}
        <Stack
          direction="row"
          spacing={1}
          sx={{
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <Box
            sx={{
              display: "flex",
              gap: 0.5,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <StatusChip statusInfo={statusInfo} />
            
            {/* Visibility Chip - Shows department name for restricted meetings */}
            <VisibilityChip 
              visibility={visibility} 
              restrictedDepartmentName={restrictedDepartmentName}
            />
            
            {isRecurring && (
              <Chip
                icon={<Repeat sx={{ fontSize: 14 }} />}
                label="Recurring"
                size="small"
                variant="outlined"
                sx={{
                  height: 24,
                  fontSize: "0.6rem",
                  fontWeight: 600,
                  borderColor: COLORS.primary,
                  color: COLORS.primary,
                  "& .MuiChip-icon": { fontSize: 14 },
                }}
              />
            )}
          </Box>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              color: "text.secondary",
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            <CalendarToday sx={{ fontSize: 14 }} />
            {formattedDate}
          </Typography>
        </Stack>

        {/* Title */}
        <Typography
          variant={isCompact ? "subtitle1" : "h6"}
          sx={{
            fontWeight: 800,
            color: "text.primary",
            lineHeight: 1.2,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            minHeight: isCompact ? "2.2rem" : "2.5rem",
            "&:hover": { color: statusColor },
          }}
        >
          {meeting.title || "Untitled Meeting"}
        </Typography>

        {/* Department Info - Shows restricted department or regular department */}
        {visibility !== 'open' && (
          <DepartmentInfo 
            departmentName={departmentName}
            restrictedDepartmentName={restrictedDepartmentName}
            visibility={visibility}
          />
        )}

        {/* Info Grid */}
        <Paper
          elevation={0}
          sx={{
            p: isCompact ? 0.75 : 1,
            bgcolor: alpha(COLORS.info, 0.04),
            borderRadius: 2,
            border: `1px solid ${alpha(COLORS.info, 0.08)}`,
          }}
        >
          <Stack
            direction={isCompact ? "column" : "row"}
            spacing={isCompact ? 0.75 : 1.5}
          >
            <InfoItem
              icon={<AccessTime />}
              label="Time"
              value={formattedTime}
              color={COLORS.info}
            />
            <InfoItem
              icon={isVirtual ? <Videocam /> : <LocationOn />}
              label="Location"
              value={locationText}
              color={isVirtual ? COLORS.info : COLORS.warning}
            />
          </Stack>
        </Paper>

        {/* Participants */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mt: "auto",
            pt: 0.75,
            borderTop: `1px solid ${alpha("#e0e0e0", 0.5)}`,
          }}
        >
          <ParticipantAvatars
            participants={meeting.participants}
            count={participantCount}
            max={isCompact ? 3 : 4}
          />

          {meeting.agenda_items?.length > 0 && (
            <Chip
              label={`${meeting.agenda_items.length} items`}
              size="small"
              variant="outlined"
              sx={{
                height: 20,
                fontSize: "0.6rem",
                borderColor: alpha(COLORS.primary, 0.3),
                color: COLORS.primary,
              }}
            />
          )}
        </Box>
      </CardContent>

      {/* Action Buttons */}
      <Box
        sx={{
          px: isMobile ? 1 : 1.5,
          py: isMobile ? 0.5 : 0.75,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: `1px solid ${alpha(statusColor, 0.1)}`,
          bgcolor: alpha(statusColor, 0.02),
          flexShrink: 0,
          gap: 0.5,
        }}
      >
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Edit Meeting" placement="top">
            <IconButton
              size={iconSize}
              onClick={handleEditClick}
              sx={{
                color: "text.secondary",
                "&:hover": {
                  bgcolor: alpha(COLORS.primary, 0.1),
                  color: COLORS.primary,
                },
              }}
            >
              <Edit fontSize={iconSize} />
            </IconButton>
          </Tooltip>

          {/* Add Action Button */}
          <Tooltip title="Add Action Item" placement="top">
            <IconButton
              size={iconSize}
              onClick={handleAddActionClick}
              sx={{
                color: "text.secondary",
                "&:hover": {
                  bgcolor: alpha(COLORS.success, 0.1),
                  color: COLORS.success,
                },
              }}
            >
              <AddIcon fontSize={iconSize} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Send Notifications" placement="top">
            <IconButton
              size={iconSize}
              onClick={handleNotifyClick}
              sx={{
                color: "text.secondary",
                "&:hover": {
                  bgcolor: alpha(COLORS.info, 0.1),
                  color: COLORS.info,
                },
              }}
            >
              <NotificationsActive fontSize={iconSize} />
            </IconButton>
          </Tooltip>

          {isRecurring && onGenerateMeeting && (
            <Tooltip title="Generate Next Occurrence" placement="top">
              <IconButton
                size={iconSize}
                onClick={handleGenerateClick}
                sx={{
                  color: "text.secondary",
                  "&:hover": {
                    bgcolor: alpha("#2e7d32", 0.1),
                    color: "#2e7d32",
                  },
                }}
              >
                <Repeat fontSize={iconSize} />
              </IconButton>
            </Tooltip>
            
          )}
          {seriesId && onViewSeriesActions && (
            <Tooltip title="All actions in this series" placement="top">
              <IconButton
                size={iconSize}
                onClick={handleSeriesActionsClick}
                sx={{ color: "text.secondary", "&:hover": { bgcolor: alpha(COLORS.primary, 0.1), color: COLORS.primary } }}
              >
                <ListAltIcon fontSize={iconSize} />
              </IconButton>
            </Tooltip>
          )}

          {/* More Options Menu */}
          <Tooltip title="More Options" placement="top">
            <IconButton
              size={iconSize}
              onClick={handleMoreMenuOpen}
              sx={{
                color: "text.secondary",
                "&:hover": {
                  bgcolor: alpha(COLORS.primary, 0.05),
                },
              }}
            >
              <MoreVertIcon fontSize={iconSize} />
            </IconButton>
          </Tooltip>
        </Stack>

        <Button
          size="small"
          onClick={handleCardClick}
          endIcon={<ChevronRight />}
          sx={{
            fontWeight: 700,
            textTransform: "none",
            color: statusColor,
            "&:hover": {
              bgcolor: alpha(statusColor, 0.08),
            },
          }}
        >
          {isCompact ? "View" : "View Details"}
        </Button>
      </Box>

      {/* More Options Menu */}
      <Menu
        anchorEl={moreMenuAnchor}
        open={moreMenuOpen}
        onClose={handleMoreMenuClose}
        onClick={(e) => e.stopPropagation()}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        PaperProps={{
          sx: {
            borderRadius: 2,
            minWidth: 180,
            boxShadow: theme.shadows[4],
            mt: 0.5,
          },
        }}
      >
        {/* Add Action - also in menu */}
        {canAddActions && (
          <MenuItem onClick={handleAddActionClick}>
            <ListItemIcon>
              <AddIcon fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText>Add Action</ListItemText>
          </MenuItem>
        )}

        {canAddActions && <Divider />}

        <MenuItem onClick={handleEditClick}>
          <ListItemIcon>
            <Edit fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText>Edit Meeting</ListItemText>
        </MenuItem>

        <MenuItem onClick={handleNotifyClick}>
          <ListItemIcon>
            <NotificationsActive fontSize="small" color="info" />
          </ListItemIcon>
          <ListItemText>Send Notifications</ListItemText>
        </MenuItem>

        <Divider />

        <MenuItem onClick={handleShare}>
          <ListItemIcon>
            <ShareIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Share</ListItemText>
        </MenuItem>

        <MenuItem onClick={handleCopyLink}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copy Link</ListItemText>
        </MenuItem>

        <MenuItem onClick={handlePrint}>
          <ListItemIcon>
            <PrintIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Print</ListItemText>
        </MenuItem>

        {onDelete && (
          <>
            <Divider />
            <MenuItem
              onClick={handleDeleteClick}
              sx={{ color: "error.main" }}
            >
              <ListItemIcon>
                <Delete fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>Delete Meeting</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>
    </Card>
  );
};

export default React.memo(MeetingCard);