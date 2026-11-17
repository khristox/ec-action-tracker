// src/components/admin/AdminStructures.jsx

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo
} from 'react';

// Material-UI imports
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Chip,
  Card,
  CardContent,
  Tooltip,
  Alert,
  Snackbar,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
  Grid,
  Divider,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Fade,
  Collapse,
  FormHelperText,
  Avatar,
  Badge,
  Skeleton,
  LinearProgress,
  alpha,
  useTheme,
  Zoom,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Breadcrumbs,
  Link,
  ListItem,
  ListItemText,
  ListItemIcon,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';

// Icons
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Business as BusinessIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  AccountTree as AccountTreeIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  DragIndicator as DragIndicatorIcon,
  OpenWith as OpenWithIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  ViewList as ViewListIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  People as PeopleIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationOnIcon,
  Clear as ClearIcon,
  Home as HomeIcon,
  ChevronRight as ChevronRightIcon
} from '@mui/icons-material';

// API Service
import { organizationAPI } from '../../services/api';

// ==================== Constants ====================

const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
const phoneRegex = /^\+?[\d\s-]{10,}$/;

// ==================== Helper Functions ====================

const formatErrorMessage = (error) => {
  if (!error) return 'An unknown error occurred';

  if (typeof error === 'string') {
    return error;
  }

  if (Array.isArray(error)) {
    const messages = error
      .map((err) => err?.msg || err?.message)
      .filter(Boolean);

    if (messages.length) {
      return messages.join(', ');
    }
  }

  if (error.detail) {
    if (Array.isArray(error.detail)) {
      return error.detail
        .map((err) => err?.msg || err?.message)
        .filter(Boolean)
        .join(', ');
    }

    if (typeof error.detail === 'string') {
      return error.detail;
    }
  }

  return error.message || error.error || 'Operation failed';
};

const getInitials = (name) => {
  const safeName = String(name || '').trim();

  if (!safeName) {
    return '?';
  }

  return safeName
    .split(/\s+/)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

/**
 * Normalize responses from organizationAPI.
 *
 * Supports:
 * - direct arrays
 * - Axios-style { data: [...] }
 * - { items: [...] }
 * - { results: [...] }
 * - { departments: [...] }
 * - { data: [...] }
 *
 * Explicitly rejects HTML/security-gateway responses.
 */
const normalizeArrayResponse = (response, context = 'Organization API') => {
  const payload = response?.data ?? response;

  if (typeof payload === 'string') {
    const isHtml =
      /<html/i.test(payload) ||
      /<!doctype/i.test(payload) ||
      /Unauthorized Request Blocked/i.test(payload) ||
      /Unauthorized Activity Has Been Detected/i.test(payload);

    if (isHtml) {
      const error = new Error(
        `${context} request was blocked by the security gateway.`
      );

      error.isGatewayBlocked = true;
      error.gatewayResponse = payload;

      throw error;
    }

    throw new Error(
      `${context} returned an unexpected text response.`
    );
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  if (Array.isArray(payload?.results)) {
    return payload.results;
  }

  if (Array.isArray(payload?.departments)) {
    return payload.departments;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  throw new Error(
    `${context} returned an unexpected response format. Expected an array.`
  );
};

/**
 * Safely filter an organization tree without mutating React state.
 *
 * A department is included when:
 * - its name matches, OR
 * - its title matches, OR
 * - one of its descendants matches.
 *
 * Matching branches are cloned so treeData remains immutable.
 */
const filterOrganizationTree = (nodes, searchTerm) => {
  if (!Array.isArray(nodes)) {
    return [];
  }

  const query = String(searchTerm || '').trim().toLowerCase();

  if (!query) {
    return nodes;
  }

  return nodes.reduce((result, node) => {
    const name = String(node?.name || '').toLowerCase();
    const title = String(node?.title || '').toLowerCase();

    const selfMatches =
      name.includes(query) ||
      title.includes(query);

    const children = Array.isArray(node?.children)
      ? filterOrganizationTree(node.children, query)
      : [];

    if (selfMatches || children.length > 0) {
      result.push({
        ...node,
        children
      });
    }

    return result;
  }, []);
};

const countTreeNodes = (nodes) => {
  if (!Array.isArray(nodes)) {
    return 0;
  }

  return nodes.reduce((total, node) => {
    return (
      total +
      1 +
      countTreeNodes(Array.isArray(node?.children) ? node.children : [])
    );
  }, 0);
};

const collectTreeIds = (nodes, ids = new Set()) => {
  if (!Array.isArray(nodes)) {
    return ids;
  }

  nodes.forEach((node) => {
    if (node?.id !== undefined && node?.id !== null) {
      ids.add(node.id);
    }

    if (Array.isArray(node?.children)) {
      collectTreeIds(node.children, ids);
    }
  });

  return ids;
};

const collectDescendantIds = (node, ids = new Set()) => {
  if (!node || !Array.isArray(node.children)) {
    return ids;
  }

  node.children.forEach((child) => {
    if (child?.id !== undefined && child?.id !== null) {
      ids.add(child.id);
    }

    collectDescendantIds(child, ids);
  });

  return ids;
};

// ==================== Form Field Component ====================

const FormField = ({
  label,
  type = 'text',
  value,
  onChange,
  error,
  options = [],
  required = false,
  min,
  placeholder,
  helperText,
  multiline = false,
  rows = 3
}) => {
  const handleChange = (e) => {
    const newValue =
      type === 'checkbox'
        ? e.target.checked
        : e.target.value;

    onChange(newValue);
  };

  const commonProps = {
    fullWidth: true,
    size: 'small',
    margin: 'normal',
    label,
    value: value || (type === 'checkbox' ? false : ''),
    onChange: handleChange,
    error: !!error,
    helperText: error || helperText,
    required,
    placeholder,
    multiline,
    rows: multiline ? rows : undefined
  };

  switch (type) {
    case 'select': {
      const isValidValue = options.some(
        (opt) => String(opt.id) === String(value)
      );

      const selectValue =
        value !== null &&
        value !== undefined &&
        value !== '' &&
        isValidValue
          ? String(value)
          : '';

      return (
        <FormControl
          fullWidth
          size="small"
          margin="normal"
          error={!!error}
          required={required}
        >
          <InputLabel>{label}</InputLabel>

          <Select
            value={selectValue}
            onChange={(e) =>
              onChange(
                e.target.value === ''
                  ? ''
                  : e.target.value
              )
            }
            label={label}
          >
            <MenuItem value="">None</MenuItem>

            {options.map((opt) => (
              <MenuItem key={opt.id} value={opt.id}>
                {opt.name}
              </MenuItem>
            ))}
          </Select>

          {helperText && !error && (
            <FormHelperText>{helperText}</FormHelperText>
          )}
        </FormControl>
      );
    }

    case 'checkbox':
      return (
        <FormControlLabel
          control={
            <Checkbox
              checked={Boolean(value)}
              onChange={handleChange}
            />
          }
          label={label}
        />
      );

    case 'number':
      return (
        <TextField
          {...commonProps}
          type="number"
          slotProps={{
            htmlInput: {
              min
            }
          }}
        />
      );

    case 'color':
      return (
        <TextField
          {...commonProps}
          type="color"
          sx={{
            '& input': {
              cursor: 'pointer',
              padding: '0.5rem',
              height: 48
            }
          }}
        />
      );

    default:
      return (
        <TextField
          {...commonProps}
          type={type}
        />
      );
  }
};

// ==================== Compact Stats Card ====================

const CompactStatsCard = ({
  icon: Icon,
  label,
  value,
  color,
  subtitle
}) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      p: 1.5,
      bgcolor: 'background.paper',
      borderRadius: 2,
      border: '1px solid',
      borderColor: 'divider',
      minWidth: {
        xs: '100%',
        sm: 100
      },
      flex: {
        xs: '1 1 100%',
        sm: '0 1 auto'
      }
    }}
  >
    <Avatar
      sx={{
        bgcolor: alpha(color || '#4A90E2', 0.1),
        color: color || '#4A90E2',
        width: 32,
        height: 32
      }}
    >
      <Icon sx={{ fontSize: 16 }} />
    </Avatar>

    <Box sx={{ minWidth: 0 }}>
      <Typography
        variant="h6"
        fontWeight="bold"
        sx={{
          fontSize: '1rem',
          lineHeight: 1.2
        }}
      >
        {value}
      </Typography>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          fontSize: '0.65rem',
          display: 'block'
        }}
      >
        {label}
      </Typography>

      {subtitle && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            fontSize: '0.6rem',
            display: 'block',
            opacity: 0.7
          }}
        >
          {subtitle}
        </Typography>
      )}
    </Box>
  </Box>
);

// ==================== Stats Row ====================

const StatsRow = ({ stats }) => (
  <Box
    sx={{
      display: 'flex',
      gap: 1.5,
      flexWrap: 'wrap',
      alignItems: 'center'
    }}
  >
    <CompactStatsCard
      icon={BusinessIcon}
      label="Departments"
      value={stats.totalDepartments}
      color="#4A90E2"
    />

    <CompactStatsCard
      icon={AccountTreeIcon}
      label="Root"
      value={stats.rootDepartments}
      color="#2ECC71"
    />

    <CompactStatsCard
      icon={PeopleIcon}
      label="Employees"
      value={stats.totalEmployees}
      color="#E74C3C"
    />

    <CompactStatsCard
      icon={OpenWithIcon}
      label="Drag & Drop"
      value="✓"
      color="#9B59B6"
      subtitle="Active"
    />
  </Box>
);

// ==================== Search Bar ====================

const SearchBar = ({
  value,
  onChange,
  onFilterToggle,
  showFilters
}) => (
  <Paper
    elevation={0}
    sx={{
      p: 0.5,
      display: 'flex',
      alignItems: 'center',
      gap: 0.5,
      bgcolor: 'background.default',
      borderRadius: 2,
      border: '1px solid',
      borderColor: 'divider',
      flex: 1,
      maxWidth: 300,
      height: 32
    }}
  >
    <SearchIcon
      sx={{
        color: 'text.secondary',
        ml: 1,
        fontSize: '1rem'
      }}
    />

    <TextField
      size="small"
      placeholder="Search..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
      variant="standard"
      fullWidth
      sx={{
        '& .MuiInputBase-root': {
          fontSize: '0.8rem',
          '&:before, &:after': {
            display: 'none'
          }
        }
      }}
    />

    {value && (
      <IconButton
        size="small"
        onClick={() => onChange('')}
        sx={{ p: 0.5 }}
      >
        <ClearIcon
          fontSize="small"
          sx={{ fontSize: '0.8rem' }}
        />
      </IconButton>
    )}

    <Divider
      orientation="vertical"
      flexItem
      sx={{ height: 20 }}
    />

    <Tooltip title="Toggle filters">
      <IconButton
        size="small"
        onClick={onFilterToggle}
        color={showFilters ? 'primary' : 'default'}
        sx={{ p: 0.5 }}
      >
        <FilterListIcon sx={{ fontSize: '1rem' }} />
      </IconButton>
    </Tooltip>
  </Paper>
);

// ==================== Breadcrumb Trail ====================

const DepartmentBreadcrumbs = ({
  node,
  treeData
}) => {
  const [breadcrumbs, setBreadcrumbs] = useState([]);

  const findPath = useCallback(
    (nodes, targetId, path = []) => {
      if (!Array.isArray(nodes)) {
        return null;
      }

      for (const currentNode of nodes) {
        if (currentNode.id === targetId) {
          return [...path, currentNode];
        }

        if (Array.isArray(currentNode.children)) {
          const result = findPath(
            currentNode.children,
            targetId,
            [...path, currentNode]
          );

          if (result) {
            return result;
          }
        }
      }

      return null;
    },
    []
  );

  useEffect(() => {
    if (!node) {
      setBreadcrumbs([]);
      return;
    }

    const path = findPath(treeData, node.id);
    setBreadcrumbs(path || []);
  }, [node, treeData, findPath]);

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <Breadcrumbs
      separator={
        <ChevronRightIcon fontSize="small" />
      }
      sx={{
        mb: 1.5,
        p: 1,
        bgcolor: 'background.default',
        borderRadius: 1
      }}
    >
      <Link
        underline="hover"
        color="inherit"
        href="#"
        onClick={(e) => e.preventDefault()}
        sx={{
          display: 'flex',
          alignItems: 'center',
          fontSize: '0.8rem'
        }}
      >
        <HomeIcon
          sx={{
            mr: 0.5,
            fontSize: '0.8rem'
          }}
        />
        Root
      </Link>

      {breadcrumbs.map((item, index) =>
        index === breadcrumbs.length - 1 ? (
          <Typography
            key={item.id}
            color="text.primary"
            fontWeight="bold"
            sx={{ fontSize: '0.8rem' }}
          >
            {item.name}
          </Typography>
        ) : (
          <Link
            key={item.id}
            underline="hover"
            color="inherit"
            href="#"
            onClick={(e) => e.preventDefault()}
            sx={{ fontSize: '0.8rem' }}
          >
            {item.name}
          </Link>
        )
      )}
    </Breadcrumbs>
  );
};

// ==================== List View ====================

const ListView = ({
  nodes,
  onEdit,
  onDelete,
  onSelect,
  depth = 0,
  theme
}) => {
  if (!Array.isArray(nodes)) {
    return null;
  }

  return (
    <Box sx={{ position: 'relative' }}>
      {nodes.map((node, index) => (
        <Box
          key={node.id}
          sx={{
            position: 'relative',
            ml: depth > 0 ? 3 : 0,
            mb: 1
          }}
        >
          {depth > 0 && (
            <Box
              sx={{
                position: 'absolute',
                left: -14,
                top: 0,
                bottom: '50%',
                width: 14,
                borderLeft: '2px dashed',
                borderColor: 'divider',
                borderBottom: '2px dashed',
                borderBottomLeftRadius: 8
              }}
            />
          )}

          {depth > 0 && index === 0 && (
            <Box
              sx={{
                position: 'absolute',
                left: -14,
                top: '-50%',
                bottom: '50%',
                width: 14,
                borderLeft: '2px dashed',
                borderColor: 'divider'
              }}
            />
          )}

          <ListItem
            sx={{
              bgcolor: 'background.paper',
              borderRadius: 2,
              border: '2px solid',
              borderColor:
                node.color || '#4A90E2',
              '&:hover': {
                bgcolor: alpha(
                  node.color || '#4A90E2',
                  0.05
                ),
                boxShadow: 2,
                transform: 'translateX(4px)'
              },
              transition: 'all 0.2s ease',
              position: 'relative',
              overflow: 'visible',
              cursor: 'pointer',
              py: 1,
              px: 2
            }}
            onClick={() =>
              onSelect && onSelect(node)
            }
            secondaryAction={
              <Box
                sx={{
                  display: 'flex',
                  gap: 0.5
                }}
              >
                <Tooltip title="Add Child">
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit('create', node);
                    }}
                    sx={{
                      color: 'primary.main',
                      '&:hover': {
                        bgcolor: alpha(
                          theme.palette.primary.main,
                          0.1
                        )
                      }
                    }}
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Tooltip>

                <Tooltip title="Edit">
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit('edit', node);
                    }}
                    sx={{
                      color: 'info.main',
                      '&:hover': {
                        bgcolor: alpha(
                          theme.palette.info.main,
                          0.1
                        )
                      }
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>

                <Tooltip title="Delete">
                  <IconButton
                    edge="end"
                    size="small"
                    color="error"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(node);
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            }
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <Badge
                overlap="circular"
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right'
                }}
                badgeContent={
                  Array.isArray(node.children) &&
                  node.children.length > 0 ? (
                    <Chip
                      label={node.children.length}
                      size="small"
                      sx={{
                        height: 16,
                        minWidth: 16,
                        fontSize: '0.5rem',
                        bgcolor: 'primary.main',
                        color: 'white',
                        '& .MuiChip-label': {
                          px: 0.5
                        }
                      }}
                    />
                  ) : null
                }
              >
                <Avatar
                  sx={{
                    bgcolor:
                      node.color || '#4A90E2',
                    width: 32,
                    height: 32,
                    border: '2px solid white',
                    boxShadow: 1,
                    fontSize: '0.8rem'
                  }}
                >
                  {getInitials(node.name)}
                </Avatar>
              </Badge>
            </ListItemIcon>

            <ListItemText
              primary={
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    flexWrap: 'wrap'
                  }}
                >
                  <Typography
                    variant="body2"
                    fontWeight="bold"
                    sx={{ fontSize: '0.85rem' }}
                  >
                    {node.name}
                  </Typography>

                  {node.title && (
                    <Chip
                      label={node.title}
                      size="small"
                      variant="outlined"
                      sx={{
                        fontSize: '0.6rem',
                        height: 18
                      }}
                    />
                  )}

                  {!node.is_active && (
                    <Chip
                      label="Inactive"
                      size="small"
                      color="warning"
                      sx={{
                        fontSize: '0.6rem',
                        height: 18
                      }}
                    />
                  )}
                </Box>
              }
              secondary={
                <Box
                  sx={{
                    display: 'flex',
                    gap: 0.5,
                    flexWrap: 'wrap',
                    mt: 0.5
                  }}
                >
                  {node.employee_count > 0 && (
                    <Chip
                      label={`👥 ${node.employee_count}`}
                      size="small"
                      variant="outlined"
                      sx={{
                        fontSize: '0.6rem',
                        height: 18
                      }}
                    />
                  )}

                  {node.email && (
                    <Chip
                      label={node.email}
                      size="small"
                      variant="outlined"
                      icon={
                        <EmailIcon
                          sx={{ fontSize: 12 }}
                        />
                      }
                      sx={{
                        fontSize: '0.6rem',
                        height: 18,
                        maxWidth: 120
                      }}
                    />
                  )}

                  {node.phone && (
                    <Chip
                      label={node.phone}
                      size="small"
                      variant="outlined"
                      icon={
                        <PhoneIcon
                          sx={{ fontSize: 12 }}
                        />
                      }
                      sx={{
                        fontSize: '0.6rem',
                        height: 18
                      }}
                    />
                  )}

                  {node.location && (
                    <Chip
                      label={node.location}
                      size="small"
                      variant="outlined"
                      icon={
                        <LocationOnIcon
                          sx={{ fontSize: 12 }}
                        />
                      }
                      sx={{
                        fontSize: '0.6rem',
                        height: 18
                      }}
                    />
                  )}

                  {Array.isArray(node.children) &&
                    node.children.length > 0 && (
                      <Chip
                        label={`${node.children.length} sub`}
                        size="small"
                        color="info"
                        sx={{
                          fontSize: '0.6rem',
                          height: 18,
                          bgcolor: alpha(
                            node.color ||
                              '#4A90E2',
                            0.1
                          ),
                          borderColor:
                            node.color ||
                            '#4A90E2',
                          color:
                            node.color ||
                            '#4A90E2'
                        }}
                      />
                    )}
                </Box>
              }
            />

            {depth > 0 && (
              <Chip
                label={`L${depth}`}
                size="small"
                sx={{
                  position: 'absolute',
                  top: -8,
                  right: 8,
                  height: 16,
                  fontSize: '0.5rem',
                  bgcolor: 'grey.200',
                  color: 'grey.600',
                  '& .MuiChip-label': {
                    px: 0.5
                  }
                }}
              />
            )}
          </ListItem>

          {Array.isArray(node.children) &&
            node.children.length > 0 && (
              <Box
                sx={{
                  position: 'relative',
                  ml: 1
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    left: -14,
                    top: 0,
                    bottom: 0,
                    width: 2,
                    bgcolor: 'divider',
                    borderLeft: '2px dashed',
                    borderColor: 'divider'
                  }}
                />

                <ListView
                  nodes={node.children}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onSelect={onSelect}
                  depth={depth + 1}
                  theme={theme}
                />
              </Box>
            )}
        </Box>
      ))}
    </Box>
  );
};

// ==================== Enhanced Horizontal Tree Node ====================

const EnhancedTreeNode = ({
  node,
  onEdit,
  onAddChild,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging,
  isMoveInProgress,
  depth = 0,
  onExpand,
  expanded,
  searchTerm,
  tileMinWidth = 200,
  densityLevel = 'comfortable',
  expandedNodes
}) => {
  const theme = useTheme();

  const compact =
    densityLevel === 'compact' ||
    densityLevel === 'dense';

  const dense = densityLevel === 'dense';

  const cardWidth = tileMinWidth + 40;

  const [isDragOver, setIsDragOver] =
    useState(false);

  const hasChildren =
    Array.isArray(node?.children) &&
    node.children.length > 0;

  const safeName = String(node?.name || '');
  const safeTitle = String(node?.title || '');

  const query = String(searchTerm || '')
    .trim()
    .toLowerCase();

  const isMatched =
    Boolean(query) &&
    (
      safeName.toLowerCase().includes(query) ||
      safeTitle.toLowerCase().includes(query)
    );

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (!isMoveInProgress) {
      setIsDragOver(true);
    }

    if (onDragOver) {
      onDragOver(e, node);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);

    if (
      !isMoveInProgress &&
      onDrop
    ) {
      onDrop(e, node);
    }
  };

  const handleDragStart = (e) => {
    if (isMoveInProgress) {
      e.preventDefault();
      return false;
    }

    e.dataTransfer.setData(
      'text/plain',
      String(node.id)
    );

    e.dataTransfer.effectAllowed = 'move';

    if (onDragStart) {
      onDragStart(e, node);
    }
  };

  const handleDragEnd = (e) => {
    setIsDragOver(false);

    if (onDragEnd) {
      onDragEnd(e);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        minWidth: cardWidth,
        opacity: isMatched
          ? 1
          : searchTerm
            ? 0.4
            : 1,
        transition: 'opacity 0.3s ease'
      }}
    >
      <Zoom
        in
        style={{
          transitionDelay: `${depth * 50}ms`
        }}
      >
        <Box
          draggable={!isMoveInProgress}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          sx={{
            opacity: isDragging ? 0.3 : 1,
            cursor: isMoveInProgress
              ? 'not-allowed'
              : 'grab',
            transition:
              'opacity 0.2s, transform 0.2s',
            position: 'relative',
            width: cardWidth,
            maxWidth: '100%',
            mx: 'auto',
            '&:active': {
              cursor: isMoveInProgress
                ? 'not-allowed'
                : 'grabbing'
            }
          }}
        >
          {isDragOver && (
            <Box
              sx={{
                position: 'absolute',
                top: -4,
                left: 0,
                right: 0,
                height: 4,
                bgcolor: 'primary.main',
                borderRadius: 2,
                zIndex: 1,
                animation:
                  'pulse 1s infinite',
                '@keyframes pulse': {
                  '0%, 100%': {
                    opacity: 1
                  },
                  '50%': {
                    opacity: 0.5
                  }
                }
              }}
            />
          )}

          <Card
            sx={{
              width: '100%',
              bgcolor:
                node.color ||
                theme.palette.primary.main,
              color: 'white',
              transition:
                'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease',
              '&:hover': {
                transform:
                  'translateY(-4px) scale(1.02)',
                boxShadow:
                  theme.shadows[6],
                '& .action-buttons': {
                  opacity: 1
                }
              },
              position: 'relative',
              borderRadius: 2,
              overflow: 'visible'
            }}
          >
            {isMatched && (
              <Box
                sx={{
                  position: 'absolute',
                  top: -3,
                  left: -3,
                  right: -3,
                  bottom: -3,
                  borderRadius: 4,
                  border: `3px solid ${theme.palette.warning.main}`,
                  animation:
                    'pulse-border 1.5s ease-in-out infinite',
                  '@keyframes pulse-border': {
                    '0%, 100%': {
                      opacity: 1
                    },
                    '50%': {
                      opacity: 0.3
                    }
                  },
                  pointerEvents: 'none'
                }}
              />
            )}

            <CardContent
              sx={{
                p: dense
                  ? 0.75
                  : compact
                    ? 1.25
                    : 2,
                position: 'relative'
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent:
                    'space-between',
                  mb: 0.5
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    flex: 1,
                    minWidth: 0
                  }}
                >
                  <DragIndicatorIcon
                    sx={{
                      cursor: 'grab',
                      opacity: 0.6,
                      fontSize: '0.8rem',
                      '&:hover': {
                        opacity: 1
                      }
                    }}
                  />

                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 'bold',
                      flex: 1,
                      fontSize: dense
                        ? '0.7rem'
                        : '0.8rem',
                      overflow: 'hidden',
                      textOverflow:
                        'ellipsis',
                      whiteSpace:
                        'nowrap'
                    }}
                  >
                    {safeName}
                  </Typography>
                </Box>

                <Box
                  className="action-buttons"
                  sx={{
                    display: 'flex',
                    gap: 0.25,
                    opacity: 0,
                    transition:
                      'opacity 0.3s ease',
                    '&:hover': {
                      opacity: 1
                    }
                  }}
                >
                  <IconButton
                    size="small"
                    sx={{
                      color: 'white',
                      '&:hover': {
                        bgcolor:
                          'rgba(255,255,255,0.2)'
                      },
                      p: 0.5
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit('edit', node);
                    }}
                  >
                    <EditIcon
                      sx={{
                        fontSize: '0.8rem'
                      }}
                    />
                  </IconButton>

                  <IconButton
                    size="small"
                    sx={{
                      color: 'white',
                      '&:hover': {
                        bgcolor:
                          'rgba(255,255,255,0.2)'
                      },
                      p: 0.5
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddChild(
                        'create',
                        node
                      );
                    }}
                    disabled={
                      isMoveInProgress
                    }
                  >
                    <AddIcon
                      sx={{
                        fontSize: '0.8rem'
                      }}
                    />
                  </IconButton>

                  <IconButton
                    size="small"
                    sx={{
                      color: 'white',
                      '&:hover': {
                        bgcolor:
                          'rgba(255,0,0,0.3)'
                      },
                      p: 0.5
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(node);
                    }}
                    disabled={
                      isMoveInProgress
                    }
                  >
                    <DeleteIcon
                      sx={{
                        fontSize: '0.8rem'
                      }}
                    />
                  </IconButton>
                </Box>
              </Box>

              {!dense && (
                <Typography
                  variant="caption"
                  sx={{
                    opacity: 0.9,
                    mb: 1,
                    display: 'block',
                    fontSize: '0.7rem'
                  }}
                >
                  {safeTitle}
                </Typography>
              )}

              {!dense && (
                <Box
                  sx={{
                    display: 'flex',
                    gap: 0.5,
                    flexWrap: 'wrap',
                    mb: 0.5
                  }}
                >
                  {node.employee_count > 0 && (
                    <Chip
                      label={`👥 ${node.employee_count}`}
                      size="small"
                      sx={{
                        bgcolor:
                          'rgba(255,255,255,0.15)',
                        color: 'white',
                        height: 18,
                        fontSize: '0.6rem',
                        '& .MuiChip-label': {
                          px: 0.5
                        }
                      }}
                    />
                  )}

                  {hasChildren && (
                    <Chip
                      label={`${node.children.length} sub`}
                      size="small"
                      sx={{
                        bgcolor:
                          'rgba(255,255,255,0.15)',
                        color: 'white',
                        height: 18,
                        fontSize: '0.6rem',
                        '& .MuiChip-label': {
                          px: 0.5
                        }
                      }}
                    />
                  )}
                </Box>
              )}

              {hasChildren && (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent:
                      'center',
                    mt: 0.5
                  }}
                >
                  <IconButton
                    size="small"
                    sx={{
                      color: 'white',
                      '&:hover': {
                        bgcolor:
                          'rgba(255,255,255,0.1)'
                      },
                      p: 0.5
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onExpand(node.id);
                    }}
                  >
                    {expanded ? (
                      <ExpandLessIcon
                        sx={{
                          fontSize: '0.8rem'
                        }}
                      />
                    ) : (
                      <ExpandMoreIcon
                        sx={{
                          fontSize: '0.8rem'
                        }}
                      />
                    )}
                  </IconButton>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      </Zoom>

      {hasChildren && (
        <Collapse
          in={expanded}
          timeout="auto"
          unmountOnExit
        >
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              pt: 1,
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: '50%',
                transform:
                  'translateX(-50%)',
                width: 2,
                height: '100%',
                bgcolor:
                  'rgba(0,0,0,0.08)'
              }
            }}
          >
            <Box
              sx={{
                display: 'flex',
                gap: compact ? 1 : 2,
                justifyContent:
                  'center',
                flexWrap: 'wrap',
                position: 'relative',
                pt: 1.5
              }}
            >
              {node.children.map(
                (child) => (
                  <Box
                    key={child.id}
                    sx={{
                      position:
                        'relative',
                      flex: '0 0 auto'
                    }}
                  >
                    <Box
                      sx={{
                        position:
                          'absolute',
                        top: -12,
                        left: '50%',
                        transform:
                          'translateX(-50%)',
                        width: 2,
                        height: 12,
                        bgcolor:
                          'rgba(0,0,0,0.08)'
                      }}
                    />

                    <EnhancedTreeNode
                      node={child}
                      onEdit={onEdit}
                      onAddChild={
                        onAddChild
                      }
                      onDelete={
                        onDelete
                      }
                      onDragStart={
                        onDragStart
                      }
                      onDragOver={
                        onDragOver
                      }
                      onDrop={onDrop}
                      onDragEnd={
                        onDragEnd
                      }
                      isDragging={
                        isDragging
                      }
                      isMoveInProgress={
                        isMoveInProgress
                      }
                      depth={depth + 1}
                      onExpand={
                        onExpand
                      }

                      // IMPORTANT:
                      // Each child gets its own
                      // expansion state.
                      expanded={
                        expandedNodes?.has(
                          child.id
                        ) || false
                      }

                      expandedNodes={
                        expandedNodes
                      }

                      searchTerm={
                        searchTerm
                      }
                      tileMinWidth={
                        tileMinWidth
                      }
                      densityLevel={
                        densityLevel
                      }
                    />
                  </Box>
                )
              )}
            </Box>
          </Box>
        </Collapse>
      )}
    </Box>
  );
};

// ==================== Main Component ====================

export function AdminStructures({
  initialView = 'tree'
}) {
  const theme = useTheme();

  // State
  const [treeData, setTreeData] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [dialogOpen, setDialogOpen] =
    useState(false);

  const [dialogMode, setDialogMode] =
    useState('create');

  const [selectedNode, setSelectedNode] =
    useState(null);

  const [parentOptions, setParentOptions] =
    useState([]);

  const [snackbar, setSnackbar] =
    useState({
      open: false,
      message: '',
      severity: 'success'
    });

  const [activeStep, setActiveStep] =
    useState(0);

  const [draggedNodeId, setDraggedNodeId] =
    useState(null);

  const [isMoveInProgress, setIsMoveInProgress] =
    useState(false);

  const [searchTerm, setSearchTerm] =
    useState('');

  const [showFilters, setShowFilters] =
    useState(false);

  const [viewMode, setViewMode] =
    useState(initialView);

  const [expandedNodes, setExpandedNodes] =
    useState(new Set());

  const [selectedDepartment, setSelectedDepartment] =
    useState(null);

  const [formData, setFormData] =
    useState({
      name: '',
      title: '',
      parent_id: '',
      email: '',
      phone: '',
      department_code: '',
      location: '',
      employee_count: 0,
      budget: 0,
      color: '#4A90E2',
      order: 0,
      is_active: true
    });

  const [errors, setErrors] =
    useState({});

  // Prevent tree refreshes from repeatedly
  // resetting the user's expansion choices.
  const expansionInitialized =
    useRef(false);

  // ==================== Notifications ====================

  const showNotification = useCallback(
    (message, severity = 'success') => {
      const displayMessage =
        typeof message === 'object'
          ? formatErrorMessage(message)
          : String(message);

      setSnackbar({
        open: true,
        message: displayMessage,
        severity
      });
    },
    []
  );

  // ==================== API Loading ====================

  const fetchTree = useCallback(
    async () => {
      try {
        const response =
          await organizationAPI.getTree();

        const treeArray =
          normalizeArrayResponse(
            response,
            'Organization tree API'
          );

        setTreeData(treeArray);

        return treeArray;
      } catch (error) {
        console.error(
          'Error fetching organization tree:',
          error
        );

        setTreeData([]);

        throw error;
      }
    },
    []
  );

  const fetchParentOptions =
    useCallback(async () => {
      try {
        const response =
          await organizationAPI.getAll();

        const nodesArray =
          normalizeArrayResponse(
            response,
            'Organization departments API'
          );

        setParentOptions(nodesArray);

        return nodesArray;
      } catch (error) {
        console.error(
          'Error fetching parent options:',
          error
        );

        setParentOptions([]);

        throw error;
      }
    }, []);

  const loadData = useCallback(
    async () => {
      setLoading(true);

      try {
        const results =
          await Promise.allSettled([
            fetchTree(),
            fetchParentOptions()
          ]);

        const failed =
          results.filter(
            (result) =>
              result.status === 'rejected'
          );

        if (failed.length > 0) {
          const firstError =
            failed[0].reason;

          console.error(
            'Organization data loading error:',
            firstError
          );

          showNotification(
            firstError?.isGatewayBlocked
              ? 'Organization API was blocked by the security gateway.'
              : formatErrorMessage(
                  firstError
                ),
            'error'
          );
        }
      } catch (error) {
        console.error(
          'Unexpected error loading organization data:',
          error
        );

        showNotification(
          formatErrorMessage(error),
          'error'
        );
      } finally {
        setLoading(false);
      }
    },
    [
      fetchTree,
      fetchParentOptions,
      showNotification
    ]
  );

  // Load data on mount.
  useEffect(() => {
    loadData();
  }, [loadData]);

  // ==================== Expansion ====================

  useEffect(() => {
    if (
      treeData.length > 0 &&
      !expansionInitialized.current
    ) {
      const allIds =
        collectTreeIds(treeData);

      setExpandedNodes(allIds);
      expansionInitialized.current = true;
    }
  }, [treeData]);

  // ==================== Statistics ====================

  const stats = useMemo(() => {
    const totalEmployees = (
      nodes
    ) => {
      if (!Array.isArray(nodes)) {
        return 0;
      }

      return nodes.reduce(
        (total, node) => {
          return (
            total +
            (Number(node?.employee_count) ||
              0) +
            totalEmployees(
              Array.isArray(
                node?.children
              )
                ? node.children
                : []
            )
          );
        },
        0
      );
    };

    return {
      totalDepartments:
        countTreeNodes(treeData),

      rootDepartments:
        treeData.length,

      totalEmployees:
        totalEmployees(treeData),

      totalChildren:
        treeData.reduce(
          (acc, node) =>
            acc +
            (Array.isArray(
              node?.children
            )
              ? node.children.length
              : 0),
          0
        )
    };
  }, [treeData]);

  // ==================== Tile Density ====================

  const density = useMemo(() => {
    const n =
      stats.totalDepartments;

    if (n <= 8) {
      return {
        level: 'comfortable',
        minWidth: 220
      };
    }

    if (n <= 20) {
      return {
        level: 'cozy',
        minWidth: 180
      };
    }

    if (n <= 40) {
      return {
        level: 'compact',
        minWidth: 150
      };
    }

    return {
      level: 'dense',
      minWidth: 120
    };
  }, [stats.totalDepartments]);

  // ==================== Search ====================

  const filteredTreeData = useMemo(
    () =>
      filterOrganizationTree(
        treeData,
        searchTerm
      ),
    [treeData, searchTerm]
  );

  const searchResultCount = useMemo(
    () =>
      searchTerm
        ? countTreeNodes(
            filteredTreeData
          )
        : 0,
    [filteredTreeData, searchTerm]
  );

  // ==================== Parent Selection Protection ====================

  const invalidParentIds = useMemo(() => {
    const ids = new Set();

    if (selectedNode) {
      ids.add(selectedNode.id);

      collectDescendantIds(
        selectedNode,
        ids
      );
    }

    return ids;
  }, [selectedNode]);

  const availableParentOptions =
    useMemo(() => {
      return parentOptions.filter(
        (parent) =>
          !invalidParentIds.has(
            parent.id
          )
      );
    }, [
      parentOptions,
      invalidParentIds
    ]);

  // ==================== Drag and Drop ====================

  const findNodeById = useCallback(
    (nodes, id) => {
      if (!Array.isArray(nodes)) {
        return null;
      }

      for (const node of nodes) {
        if (
          String(node.id) ===
          String(id)
        ) {
          return node;
        }

        if (
          Array.isArray(
            node.children
          )
        ) {
          const found =
            findNodeById(
              node.children,
              id
            );

          if (found) {
            return found;
          }
        }
      }

      return null;
    },
    []
  );

  const isDescendant = useCallback(
    (node, targetId) => {
      if (!node) {
        return false;
      }

      if (
        String(node.id) ===
        String(targetId)
      ) {
        return true;
      }

      if (
        Array.isArray(
          node.children
        )
      ) {
        return node.children.some(
          (child) =>
            isDescendant(
              child,
              targetId
            )
        );
      }

      return false;
    },
    []
  );

  const handleDragStart =
    useCallback(
      (e, node) => {
        if (
          loading ||
          isMoveInProgress
        ) {
          e.preventDefault();
          return false;
        }

        e.dataTransfer.setData(
          'text/plain',
          String(node.id)
        );

        e.dataTransfer.effectAllowed =
          'move';

        setDraggedNodeId(node.id);

        return true;
      },
      [
        loading,
        isMoveInProgress
      ]
    );

  const handleDragOver =
    useCallback((e) => {
      e.preventDefault();
    }, []);

  const handleDragEnd =
    useCallback(() => {
      setDraggedNodeId(null);
    }, []);

  const handleDrop = useCallback(
    async (e, targetNode) => {
      e.preventDefault();

      if (
        loading ||
        isMoveInProgress
      ) {
        showNotification(
          'Please wait, another operation is in progress',
          'warning'
        );
        return;
      }

      const sourceNodeId =
        draggedNodeId ||
        e.dataTransfer.getData(
          'text/plain'
        );

      if (!sourceNodeId) {
        return;
      }

      if (
        String(sourceNodeId) ===
        String(targetNode.id)
      ) {
        showNotification(
          'Cannot drop a node onto itself',
          'warning'
        );

        setDraggedNodeId(null);
        return;
      }

      if (
        typeof organizationAPI.move !==
        'function'
      ) {
        showNotification(
          'Move functionality is not available on the server',
          'error'
        );

        setDraggedNodeId(null);
        return;
      }

      const sourceNode =
        findNodeById(
          treeData,
          sourceNodeId
        );

      if (
        sourceNode &&
        isDescendant(
          sourceNode,
          targetNode.id
        )
      ) {
        showNotification(
          'Cannot move a parent node into its own child',
          'error'
        );

        setDraggedNodeId(null);
        return;
      }

      setIsMoveInProgress(true);
      setLoading(true);

      try {
        await organizationAPI.move(
          sourceNodeId,
          targetNode.id
        );

        showNotification(
          `Successfully moved to "${targetNode.name}"`,
          'success'
        );

        await loadData();
      } catch (error) {
        console.error(
          'Move error:',
          error
        );

        showNotification(
          error?.response?.data?.detail ||
            error?.message ||
            'Failed to move department',
          'error'
        );
      } finally {
        setLoading(false);
        setIsMoveInProgress(false);
        setDraggedNodeId(null);
      }
    },
    [
      draggedNodeId,
      treeData,
      loading,
      isMoveInProgress,
      findNodeById,
      isDescendant,
      loadData,
      showNotification
    ]
  );

  // ==================== Expand / Collapse ====================

  const handleToggleExpand =
    useCallback((nodeId) => {
      setExpandedNodes((prev) => {
        const newSet = new Set(prev);

        if (newSet.has(nodeId)) {
          newSet.delete(nodeId);
        } else {
          newSet.add(nodeId);
        }

        return newSet;
      });
    }, []);

  const handleExpandAll =
    useCallback(() => {
      setExpandedNodes(
        collectTreeIds(treeData)
      );
    }, [treeData]);

  const handleCollapseAll =
    useCallback(() => {
      setExpandedNodes(new Set());
    }, []);

  // ==================== Form Handlers ====================

  const validateForm =
    useCallback(() => {
      const newErrors = {};

      if (!formData.name?.trim()) {
        newErrors.name =
          'Department name is required';
      }

      if (!formData.title?.trim()) {
        newErrors.title =
          'Position title is required';
      }

      if (
        formData.email &&
        !emailRegex.test(
          formData.email.trim()
        )
      ) {
        newErrors.email =
          'Invalid email address';
      }

      if (
        formData.phone &&
        !phoneRegex.test(
          formData.phone.trim()
        )
      ) {
        newErrors.phone =
          'Invalid phone number (minimum 10 digits)';
      }

      setErrors(newErrors);

      return (
        Object.keys(newErrors)
          .length === 0
      );
    }, [formData]);

  const handleFieldChange =
    useCallback(
      (field, value) => {
        setFormData((prev) => ({
          ...prev,
          [field]: value
        }));

        if (errors[field]) {
          setErrors((prev) => ({
            ...prev,
            [field]: undefined
          }));
        }
      },
      [errors]
    );

  const handleNext =
    useCallback(() => {
      if (
        activeStep === 0 &&
        (!formData.name?.trim() ||
          !formData.title?.trim())
      ) {
        showNotification(
          'Please fill in department name and position title',
          'error'
        );

        return;
      }

      setActiveStep((prev) =>
        Math.min(prev + 1, 2)
      );
    }, [
      activeStep,
      formData.name,
      formData.title,
      showNotification
    ]);

  const handleBack =
    useCallback(() => {
      setActiveStep((prev) =>
        Math.max(prev - 1, 0)
      );
    }, []);

  const resetForm =
    useCallback(() => {
      setFormData({
        name: '',
        title: '',
        parent_id: '',
        email: '',
        phone: '',
        department_code: '',
        location: '',
        employee_count: 0,
        budget: 0,
        color: '#4A90E2',
        order: 0,
        is_active: true
      });

      setErrors({});
      setActiveStep(0);
      setSelectedNode(null);
    }, []);

  const handleCloseDialog =
    useCallback(() => {
      setDialogOpen(false);
      resetForm();
    }, [resetForm]);

  const handleOpenDialog =
    useCallback(
      (mode, node = null) => {
        setDialogMode(mode);
        setSelectedNode(node);
        setActiveStep(0);

        if (
          mode === 'edit' &&
          node
        ) {
          setFormData({
            name: node.name || '',
            title: node.title || '',
            parent_id:
              node.parent_id || '',
            email: node.email || '',
            phone: node.phone || '',
            department_code:
              node.department_code ||
              '',
            location:
              node.location || '',
            employee_count:
              node.employee_count ||
              0,
            budget:
              node.budget || 0,
            color:
              node.color ||
              '#4A90E2',
            order:
              node.order || 0,
            is_active:
              node.is_active !==
              false
          });
        } else if (
          mode === 'create'
        ) {
          setFormData((prev) => ({
            ...prev,

            parent_id:
              node?.id || '',

            name: '',
            title: '',
            email: '',
            phone: '',
            department_code: '',
            location: '',
            employee_count: 0,
            budget: 0,
            color: '#4A90E2',
            order: 0,
            is_active: true
          }));
        }

        setErrors({});
        setDialogOpen(true);
      },
      []
    );

  const handleSubmit =
    useCallback(async () => {
      if (!validateForm()) {
        showNotification(
          'Please fix the errors in the form',
          'error'
        );

        return;
      }

      setLoading(true);

      try {
        const submitData = {
          name: formData.name.trim(),

          title: formData.title.trim(),

          parent_id:
            !formData.parent_id ||
            formData.parent_id ===
              '' ||
            formData.parent_id ===
              'null'
              ? null
              : formData.parent_id,

          order:
            parseInt(
              formData.order,
              10
            ) || 0,

          employee_count:
            parseInt(
              formData.employee_count,
              10
            ) || 0,

          budget:
            parseFloat(
              formData.budget
            ) || 0,

          color:
            formData.color ||
            '#4A90E2',

          is_active:
            formData.is_active !==
            false,

          // Explicitly send cleared optional
          // fields as null during updates.
          email:
            formData.email?.trim() ||
            null,

          phone:
            formData.phone?.trim() ||
            null,

          department_code:
            formData.department_code?.trim() ||
            null,

          location:
            formData.location?.trim() ||
            null
        };

        if (
          dialogMode === 'create'
        ) {
          await organizationAPI.create(
            submitData
          );

          showNotification(
            'Department created successfully',
            'success'
          );
        } else if (
          dialogMode === 'edit'
        ) {
          if (
            !selectedNode ||
            !selectedNode.id
          ) {
            throw new Error(
              'Selected node not found for edit operation'
            );
          }

          await organizationAPI.update(
            selectedNode.id,
            submitData
          );

          showNotification(
            'Department updated successfully',
            'success'
          );
        }

        handleCloseDialog();

        await loadData();
      } catch (error) {
        console.error(
          'Submit error:',
          error
        );

        showNotification(
          error?.response?.data
            ?.detail ||
            error?.message ||
            'Operation failed',
          'error'
        );
      } finally {
        setLoading(false);
      }
    }, [
      validateForm,
      formData,
      dialogMode,
      selectedNode,
      handleCloseDialog,
      loadData,
      showNotification
    ]);

  const handleDelete =
    useCallback(
      async (node) => {
        if (!node) {
          showNotification(
            'No department selected for deletion',
            'error'
          );
          return;
        }

        if (isMoveInProgress) {
          showNotification(
            'Please wait for current operation to complete',
            'warning'
          );
          return;
        }

        if (
          !window.confirm(
            `Delete "${node.name}" and all its sub-departments? This action cannot be undone!`
          )
        ) {
          return;
        }

        setLoading(true);

        try {
          await organizationAPI.delete(
            node.id
          );

          showNotification(
            'Department deleted successfully',
            'success'
          );

          if (dialogOpen) {
            handleCloseDialog();
          }

          await loadData();
        } catch (error) {
          console.error(
            'Delete error:',
            error
          );

          showNotification(
            error?.response?.data
              ?.detail ||
              error?.message ||
              'Failed to delete department',
            'error'
          );
        } finally {
          setLoading(false);
        }
      },
      [
        dialogOpen,
        handleCloseDialog,
        isMoveInProgress,
        loadData,
        showNotification
      ]
    );

  // ==================== Render Tree View ====================

  const renderTreeView =
    useCallback(() => {
      if (
        !Array.isArray(
          filteredTreeData
        ) ||
        filteredTreeData.length === 0
      ) {
        return (
          <Alert
            severity="info"
            sx={{ mt: 1 }}
          >
            No departments match your search.
          </Alert>
        );
      }

      return (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'flex-start',
            gap:
              density.level === 'dense'
                ? 1
                : 3,
            p: 1
          }}
        >
          {filteredTreeData.map(
            (node) => (
              <EnhancedTreeNode
                key={node.id}
                node={node}
                onEdit={
                  handleOpenDialog
                }
                onAddChild={
                  handleOpenDialog
                }
                onDelete={
                  handleDelete
                }
                onDragStart={
                  handleDragStart
                }
                onDragOver={
                  handleDragOver
                }
                onDrop={handleDrop}
                onDragEnd={
                  handleDragEnd
                }
                isDragging={
                  draggedNodeId ===
                  node.id
                }
                isMoveInProgress={
                  isMoveInProgress
                }
                onExpand={
                  handleToggleExpand
                }
                expanded={
                  expandedNodes.has(
                    node.id
                  )
                }
                expandedNodes={
                  expandedNodes
                }
                searchTerm={
                  searchTerm
                }
                tileMinWidth={
                  density.minWidth
                }
                densityLevel={
                  density.level
                }
              />
            )
          )}
        </Box>
      );
    }, [
      filteredTreeData,
      density,
      handleOpenDialog,
      handleDelete,
      handleDragStart,
      handleDragOver,
      handleDrop,
      handleDragEnd,
      draggedNodeId,
      isMoveInProgress,
      expandedNodes,
      handleToggleExpand,
      searchTerm
    ]);

  // ==================== Render List View ====================

  const renderListView =
    useCallback(() => {
      if (
        !Array.isArray(
          filteredTreeData
        ) ||
        filteredTreeData.length === 0
      ) {
        return (
          <Alert
            severity="info"
            sx={{ mt: 1 }}
          >
            No departments match your search.
          </Alert>
        );
      }

      return (
        <Box>
          <Paper
            sx={{
              p: 1,
              mb: 1.5,
              bgcolor:
                'background.default',
              borderRadius: 1
            }}
          >
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                flexWrap: 'wrap',
                alignItems:
                  'center'
              }}
            >
              <Typography
                variant="caption"
                fontWeight="bold"
                sx={{
                  fontSize: '0.7rem'
                }}
              >
                Legend:
              </Typography>

              <Box
                sx={{
                  display: 'flex',
                  alignItems:
                    'center',
                  gap: 0.5
                }}
              >
                <Box
                  sx={{
                    width: 16,
                    height: 2,
                    borderTop:
                      '2px dashed',
                    borderColor:
                      'divider'
                  }}
                />

                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    fontSize: '0.6rem'
                  }}
                >
                  Connection
                </Typography>
              </Box>

              <Chip
                icon={
                  <AccountTreeIcon
                    sx={{
                      fontSize: 12
                    }}
                  />
                }
                label="Has sub"
                size="small"
                color="info"
                variant="outlined"
                sx={{
                  fontSize: '0.6rem',
                  height: 20
                }}
              />

              <Chip
                label="Level"
                size="small"
                sx={{
                  bgcolor: 'grey.200',
                  color: 'grey.600',
                  fontSize: '0.6rem',
                  height: 20
                }}
              />
            </Box>
          </Paper>

          {selectedDepartment && (
            <DepartmentBreadcrumbs
              node={
                selectedDepartment
              }
              treeData={treeData}
            />
          )}

          <ListView
            nodes={
              filteredTreeData
            }
            onEdit={
              handleOpenDialog
            }
            onDelete={
              handleDelete
            }
            onSelect={
              setSelectedDepartment
            }
            theme={theme}
          />
        </Box>
      );
    }, [
      filteredTreeData,
      selectedDepartment,
      treeData,
      handleOpenDialog,
      handleDelete,
      theme
    ]);

  // ==================== Form Dialog + Snackbar ====================

  const formDialogAndSnackbar = (
    <>
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        TransitionComponent={Zoom}
        PaperProps={{
          sx: {
            borderRadius: 3,
            maxHeight: '90vh'
          }
        }}
      >
        <DialogTitle
          sx={{
            p: 2,
            pb: 1,
            background: `linear-gradient(135deg, ${alpha(
              theme.palette.primary.main,
              0.05
            )} 0%, transparent 100%)`,
            borderBottom: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems: 'center'
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems:
                  'center',
                gap: 1
              }}
            >
              {dialogMode ===
              'create' ? (
                <AddIcon
                  sx={{
                    color:
                      'primary.main',
                    fontSize:
                      '1.2rem'
                  }}
                />
              ) : (
                <EditIcon
                  sx={{
                    color:
                      'primary.main',
                    fontSize:
                      '1.2rem'
                  }}
                />
              )}

              <Typography
                variant="h6"
                fontWeight="bold"
                sx={{
                  fontSize:
                    '1.1rem'
                }}
              >
                {dialogMode ===
                'create'
                  ? selectedNode
                    ? `Add Child to "${selectedNode.name}"`
                    : 'Create New Department'
                  : `Edit "${selectedNode?.name}"`}
              </Typography>
            </Box>

            <IconButton
              onClick={
                handleCloseDialog
              }
              disabled={loading}
              size="small"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 2.5 }}>
          <Fade in={dialogOpen}>
            <Box>
              <Stepper
                activeStep={
                  activeStep
                }
                orientation="vertical"
                sx={{ mb: 2 }}
              >
                {/* Step 1 */}
                <Step>
                  <StepLabel>
                    Basic Information
                  </StepLabel>

                  <StepContent>
                    <Grid
                      container
                      spacing={2}
                    >
                      <Grid
                        size={{
                          xs: 12
                        }}
                      >
                        <FormField
                          label="Department Name *"
                          value={
                            formData.name
                          }
                          onChange={(
                            v
                          ) =>
                            handleFieldChange(
                              'name',
                              v
                            )
                          }
                          error={
                            errors.name
                          }
                          required
                          placeholder="e.g., Engineering Department"
                          helperText="Official department or team name"
                        />
                      </Grid>

                      <Grid
                        size={{
                          xs: 12
                        }}
                      >
                        <FormField
                          label="Position Title *"
                          value={
                            formData.title
                          }
                          onChange={(
                            v
                          ) =>
                            handleFieldChange(
                              'title',
                              v
                            )
                          }
                          error={
                            errors.title
                          }
                          required
                          placeholder="e.g., Director, Manager, Team Lead"
                          helperText="The leadership position for this department"
                        />
                      </Grid>

                      <Grid
                        size={{
                          xs: 12
                        }}
                      >
                        <FormField
                          type="select"
                          label="Parent Department"
                          value={
                            formData.parent_id
                          }
                          onChange={(
                            v
                          ) =>
                            handleFieldChange(
                              'parent_id',
                              v
                            )
                          }
                          options={
                            availableParentOptions
                          }
                          helperText="Select parent department (leave empty for top level)"
                        />
                      </Grid>
                    </Grid>

                    <Box
                      sx={{
                        display:
                          'flex',
                        justifyContent:
                          'flex-end',
                        mt: 2
                      }}
                    >
                      <Button
                        onClick={
                          handleNext
                        }
                        variant="contained"
                        disabled={
                          loading
                        }
                        size="small"
                      >
                        Next
                      </Button>
                    </Box>
                  </StepContent>
                </Step>

                {/* Step 2 */}
                <Step>
                  <StepLabel>
                    Contact Information
                  </StepLabel>

                  <StepContent>
                    <Grid
                      container
                      spacing={2}
                    >
                      <Grid
                        size={{
                          xs: 12,
                          sm: 6
                        }}
                      >
                        <FormField
                          type="email"
                          label="Email Address"
                          value={
                            formData.email
                          }
                          onChange={(
                            v
                          ) =>
                            handleFieldChange(
                              'email',
                              v
                            )
                          }
                          error={
                            errors.email
                          }
                          placeholder="department@company.com"
                          helperText="Official department email"
                        />
                      </Grid>

                      <Grid
                        size={{
                          xs: 12,
                          sm: 6
                        }}
                      >
                        <FormField
                          label="Phone Number"
                          value={
                            formData.phone
                          }
                          onChange={(
                            v
                          ) =>
                            handleFieldChange(
                              'phone',
                              v
                            )
                          }
                          error={
                            errors.phone
                          }
                          placeholder="+1-234-567-8900"
                          helperText="Include country code"
                        />
                      </Grid>

                      <Grid
                        size={{
                          xs: 12,
                          sm: 6
                        }}
                      >
                        <FormField
                          label="Department Code"
                          value={
                            formData.department_code
                          }
                          onChange={(
                            v
                          ) =>
                            handleFieldChange(
                              'department_code',
                              v
                            )
                          }
                          placeholder="e.g., ENG-01"
                          helperText="Unique identifier for the department"
                        />
                      </Grid>

                      <Grid
                        size={{
                          xs: 12,
                          sm: 6
                        }}
                      >
                        <FormField
                          label="Location"
                          value={
                            formData.location
                          }
                          onChange={(
                            v
                          ) =>
                            handleFieldChange(
                              'location',
                              v
                            )
                          }
                          placeholder="Building, Floor, Room"
                          helperText="Physical location of the department"
                        />
                      </Grid>
                    </Grid>

                    <Box
                      sx={{
                        display:
                          'flex',
                        justifyContent:
                          'space-between',
                        mt: 2
                      }}
                    >
                      <Button
                        onClick={
                          handleBack
                        }
                        disabled={
                          loading
                        }
                        size="small"
                      >
                        Back
                      </Button>

                      <Button
                        onClick={
                          handleNext
                        }
                        variant="contained"
                        disabled={
                          loading
                        }
                        size="small"
                      >
                        Next
                      </Button>
                    </Box>
                  </StepContent>
                </Step>

                {/* Step 3 */}
                <Step>
                  <StepLabel>
                    Statistics & Customization
                  </StepLabel>

                  <StepContent>
                    <Grid
                      container
                      spacing={2}
                    >
                      <Grid
                        size={{
                          xs: 12,
                          sm: 6
                        }}
                      >
                        <FormField
                          type="number"
                          label="Employee Count"
                          value={
                            formData.employee_count
                          }
                          onChange={(
                            v
                          ) =>
                            handleFieldChange(
                              'employee_count',
                              v
                            )
                          }
                          min={0}
                          helperText="Number of employees in this department"
                        />
                      </Grid>

                      <Grid
                        size={{
                          xs: 12,
                          sm: 6
                        }}
                      >
                        <FormField
                          type="number"
                          label="Annual Budget ($)"
                          value={
                            formData.budget
                          }
                          onChange={(
                            v
                          ) =>
                            handleFieldChange(
                              'budget',
                              v
                            )
                          }
                          min={0}
                          placeholder="0"
                          helperText="Department's annual budget in USD"
                        />
                      </Grid>

                      <Grid
                        size={{
                          xs: 12,
                          sm: 6
                        }}
                      >
                        <FormField
                          type="color"
                          label="Department Color"
                          value={
                            formData.color
                          }
                          onChange={(
                            v
                          ) =>
                            handleFieldChange(
                              'color',
                              v
                            )
                          }
                          helperText="Color used to identify this department"
                        />
                      </Grid>

                      <Grid
                        size={{
                          xs: 12,
                          sm: 6
                        }}
                      >
                        <FormField
                          type="number"
                          label="Display Order"
                          value={
                            formData.order
                          }
                          onChange={(
                            v
                          ) =>
                            handleFieldChange(
                              'order',
                              v
                            )
                          }
                          min={0}
                          helperText="Lower numbers appear first in the tree"
                        />
                      </Grid>

                      <Grid
                        size={{
                          xs: 12
                        }}
                      >
                        <FormField
                          type="checkbox"
                          label="Active Department"
                          value={
                            formData.is_active
                          }
                          onChange={(
                            v
                          ) =>
                            handleFieldChange(
                              'is_active',
                              v
                            )
                          }
                        />
                      </Grid>
                    </Grid>

                    <Box
                      sx={{
                        display:
                          'flex',
                        justifyContent:
                          'space-between',
                        mt: 2
                      }}
                    >
                      <Button
                        onClick={
                          handleBack
                        }
                        disabled={
                          loading
                        }
                        size="small"
                      >
                        Back
                      </Button>

                      <Button
                        onClick={
                          handleSubmit
                        }
                        variant="contained"
                        color="primary"
                        startIcon={
                          <SaveIcon />
                        }
                        disabled={
                          loading
                        }
                        size="small"
                      >
                        {dialogMode ===
                        'create'
                          ? 'Create'
                          : 'Save'}
                      </Button>
                    </Box>
                  </StepContent>
                </Step>
              </Stepper>

              <Box
                sx={{
                  display:
                    'flex',
                  gap: 2,
                  justifyContent:
                    'space-between',
                  mt: 2,
                  pt: 2,
                  borderTop:
                    '1px solid',
                  borderColor:
                    'divider'
                }}
              >
                <Box>
                  {dialogMode ===
                    'edit' &&
                    selectedNode && (
                      <Button
                        color="error"
                        onClick={() =>
                          handleDelete(
                            selectedNode
                          )
                        }
                        startIcon={
                          <DeleteIcon />
                        }
                        variant="outlined"
                        disabled={
                          loading ||
                          isMoveInProgress
                        }
                        size="small"
                      >
                        Delete
                      </Button>
                    )}
                </Box>

                <Box
                  sx={{
                    display:
                      'flex',
                    gap: 1
                  }}
                >
                  <Button
                    onClick={
                      handleCloseDialog
                    }
                    startIcon={
                      <CancelIcon />
                    }
                    disabled={
                      loading
                    }
                    size="small"
                  >
                    Cancel
                  </Button>
                </Box>
              </Box>
            </Box>
          </Fade>
        </DialogContent>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() =>
          setSnackbar(
            (prev) => ({
              ...prev,
              open: false
            })
          )
        }
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right'
        }}
      >
        <Alert
          severity={
            snackbar.severity
          }
          onClose={() =>
            setSnackbar(
              (prev) => ({
                ...prev,
                open: false
              })
            )
          }
          icon={
            snackbar.severity ===
            'success' ? (
              <CheckCircleIcon
                sx={{
                  fontSize:
                    '1.2rem'
                }}
              />
            ) : (
              <WarningIcon
                sx={{
                  fontSize:
                    '1.2rem'
                }}
              />
            )
          }
          variant="filled"
          sx={{
            borderRadius: 2,
            py: 0.5
          }}
        >
          <Typography
            variant="body2"
            sx={{
              fontSize:
                '0.85rem'
            }}
          >
            {
              snackbar.message
            }
          </Typography>
        </Alert>
      </Snackbar>
    </>
  );

  // ==================== Loading State ====================

  if (
    loading &&
    treeData.length === 0
  ) {
    return (
      <Box sx={{ p: 2 }}>
        <Paper
          sx={{
            p: 2,
            mb: 2
          }}
        >
          <Skeleton
            variant="rectangular"
            height={40}
            sx={{
              borderRadius: 1
            }}
          />
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              flexWrap: 'wrap',
              justifyContent:
                'center'
            }}
          >
            {[1, 2, 3].map(
              (i) => (
                <Skeleton
                  key={i}
                  variant="rectangular"
                  width={180}
                  height={120}
                  sx={{
                    borderRadius: 2
                  }}
                />
              )
            )}
          </Box>
        </Paper>
      </Box>
    );
  }

  // ==================== Empty State ====================

  if (
    treeData.length === 0
  ) {
    return (
      <Box sx={{ p: 2 }}>
        <Paper
          sx={{
            p: 3,
            textAlign: 'center',
            py: 6
          }}
        >
          <BusinessIcon
            sx={{
              fontSize: 60,
              color: 'text.disabled',
              mb: 2
            }}
          />

          <Typography
            variant="h6"
            fontWeight="bold"
            gutterBottom
          >
            No Departments Found
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 2 }}
          >
            Get started by
            creating your first
            department
          </Typography>

          <Button
            variant="contained"
            startIcon={
              <AddIcon />
            }
            onClick={() =>
              handleOpenDialog(
                'create'
              )
            }
            size="medium"
          >
            Create First Department
          </Button>
        </Paper>

        {formDialogAndSnackbar}
      </Box>
    );
  }

  // ==================== Main Render ====================

  return (
    <Box
      sx={{
        p: {
          xs: 1.5,
          sm: 2
        }
      }}
    >
      <Paper
        sx={{
          p: {
            xs: 1.5,
            sm: 2
          },
          mb: 2,
          background: `linear-gradient(135deg, ${alpha(
            theme.palette.primary.main,
            0.03
          )} 0%, ${alpha(
            theme.palette.primary.main,
            0.01
          )} 100%)`,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        {/* Header Row */}

        <Box
          sx={{
            display: 'flex',
            justifyContent:
              'space-between',
            alignItems: {
              xs: 'stretch',
              sm: 'center'
            },
            flexDirection: {
              xs: 'column',
              sm: 'row'
            },
            gap: 1.5,
            mb: 1.5
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems:
                'center',
              gap: 1.5
            }}
          >
            <BusinessIcon
              sx={{
                fontSize: 24,
                color:
                  'primary.main'
              }}
            />

            <Typography
              variant="h5"
              fontWeight="bold"
              sx={{
                fontSize: {
                  xs: '1.1rem',
                  sm: '1.3rem'
                }
              }}
            >
              Organization
            </Typography>

            <Chip
              label={`${stats.totalDepartments} depts`}
              size="small"
              color="primary"
              sx={{
                fontWeight:
                  'bold',
                fontSize:
                  '0.65rem',
                height: 22
              }}
            />
          </Box>

          <Box
            sx={{
              display: 'flex',
              gap: 0.5,
              flexWrap: 'wrap'
            }}
          >
            <Tooltip title="Collapse All">
              <span>
                <IconButton
                  size="small"
                  onClick={
                    handleCollapseAll
                  }
                  disabled={
                    viewMode ===
                    'list'
                  }
                  sx={{
                    p: 0.5
                  }}
                >
                  <ExpandLessIcon
                    fontSize="small"
                    sx={{
                      fontSize:
                        '0.9rem'
                    }}
                  />
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip title="Expand All">
              <span>
                <IconButton
                  size="small"
                  onClick={
                    handleExpandAll
                  }
                  disabled={
                    viewMode ===
                    'list'
                  }
                  sx={{
                    p: 0.5
                  }}
                >
                  <ExpandMoreIcon
                    fontSize="small"
                    sx={{
                      fontSize:
                        '0.9rem'
                    }}
                  />
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip title="Refresh">
              <IconButton
                size="small"
                onClick={
                  loadData
                }
                disabled={
                  loading ||
                  isMoveInProgress
                }
                sx={{
                  p: 0.5
                }}
              >
                <RefreshIcon
                  fontSize="small"
                  sx={{
                    fontSize:
                      '0.9rem'
                  }}
                />
              </IconButton>
            </Tooltip>

            <Button
              variant="contained"
              startIcon={
                <AddIcon
                  sx={{
                    fontSize:
                      '0.9rem'
                  }}
                />
              }
              onClick={() =>
                handleOpenDialog(
                  'create'
                )
              }
              disabled={
                isMoveInProgress
              }
              size="small"
              sx={{
                borderRadius: 1.5,
                textTransform:
                  'none',
                fontSize:
                  '0.75rem',
                px: 1.5,
                py: 0.5
              }}
            >
              Add
            </Button>
          </Box>
        </Box>

        <StatsRow stats={stats} />

        {/* Search and View Controls */}

        <Box
          sx={{
            display: 'flex',
            gap: 1.5,
            mt: 1.5,
            flexWrap: 'wrap',
            alignItems:
              'center'
          }}
        >
          <SearchBar
            value={searchTerm}
            onChange={
              setSearchTerm
            }
            onFilterToggle={() =>
              setShowFilters(
                (prev) => !prev
              )
            }
            showFilters={
              showFilters
            }
          />

          <Box
            sx={{
              display: 'flex',
              gap: 0.5,
              alignItems:
                'center',
              ml: 'auto'
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                fontSize:
                  '0.65rem'
              }}
            >
              View:
            </Typography>

            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(
                e,
                val
              ) => {
                if (
                  val !==
                  null
                ) {
                  setViewMode(
                    val
                  );
                }
              }}
              size="small"
              sx={{
                '& .MuiToggleButton-root':
                  {
                    px: 0.75,
                    py: 0.25,
                    fontSize:
                      '0.65rem',
                    '&.Mui-selected':
                      {
                        bgcolor:
                          'primary.main',
                        color:
                          'white',
                        '&:hover':
                          {
                            bgcolor:
                              'primary.dark'
                          }
                      }
                  }
              }}
            >
              <ToggleButton
                value="tree"
                aria-label="tree view"
              >
                <AccountTreeIcon
                  sx={{
                    fontSize:
                      '0.9rem'
                  }}
                />
              </ToggleButton>

              <ToggleButton
                value="list"
                aria-label="list view"
              >
                <ViewListIcon
                  sx={{
                    fontSize:
                      '0.9rem'
                  }}
                />
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>

        {searchTerm && (
          <Alert
            severity="info"
            sx={{
              mt: 1,
              py: 0.25,
              fontSize: '0.7rem'
            }}
            onClose={() =>
              setSearchTerm('')
            }
          >
            Found{' '}
            {searchResultCount}{' '}
            matching departments
          </Alert>
        )}

        {isMoveInProgress && (
          <LinearProgress
            sx={{
              mt: 1,
              borderRadius: 1,
              height: 2
            }}
          />
        )}
      </Paper>

      {/* Content */}

      <Paper
        sx={{
          p: {
            xs: 1.5,
            sm: 2
          },
          overflowX: 'auto',
          minHeight: '350px',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        {viewMode ===
        'tree' ? (
          <>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                mb: 1,
                display: 'block',
                fontSize:
                  '0.65rem'
              }}
            >
              <AccountTreeIcon
                sx={{
                  mr: 0.5,
                  verticalAlign:
                    'middle',
                  fontSize:
                    '0.75rem'
                }}
              />

              Drag cards to
              reorganize — drop
              onto a department
              to make it a child
            </Typography>

            {renderTreeView()}
          </>
        ) : (
          <>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                mb: 1,
                display: 'block',
                fontSize:
                  '0.65rem'
              }}
            >
              <ViewListIcon
                sx={{
                  mr: 0.5,
                  verticalAlign:
                    'middle',
                  fontSize:
                    '0.75rem'
                }}
              />

              Click department
              to see path · Edit
              or delete using
              action buttons
            </Typography>

            {renderListView()}
          </>
        )}
      </Paper>

      {/* Speed Dial */}

      <SpeedDial
        ariaLabel="Quick Actions"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          '& .MuiFab-primary':
            {
              width: 44,
              height: 44
            }
        }}
        icon={
          <SpeedDialIcon />
        }
      >
        <SpeedDialAction
          icon={
            <AddIcon
              sx={{
                fontSize:
                  '1.1rem'
              }}
            />
          }
          tooltipTitle="Add Department"
          onClick={() =>
            handleOpenDialog(
              'create'
            )
          }
          FabProps={{
            size: 'small'
          }}
        />

        <SpeedDialAction
          icon={
            <RefreshIcon
              sx={{
                fontSize:
                  '1.1rem'
              }}
            />
          }
          tooltipTitle="Refresh"
          onClick={loadData}
          FabProps={{
            size: 'small'
          }}
        />

        {viewMode ===
          'tree' && (
          <SpeedDialAction
            icon={
              expandedNodes.size >
              0 ? (
                <ExpandLessIcon
                  sx={{
                    fontSize:
                      '1.1rem'
                  }}
                />
              ) : (
                <ExpandMoreIcon
                  sx={{
                    fontSize:
                      '1.1rem'
                  }}
                />
              )
            }
            tooltipTitle={
              expandedNodes.size >
              0
                ? 'Collapse All'
                : 'Expand All'
            }
            onClick={
              expandedNodes.size >
              0
                ? handleCollapseAll
                : handleExpandAll
            }
            FabProps={{
              size: 'small'
            }}
          />
        )}
      </SpeedDial>

      {formDialogAndSnackbar}
    </Box>
  );
}

export default AdminStructures;