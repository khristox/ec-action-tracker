// MinutesList.jsx - Improved version
import React, { useState, useCallback, useMemo } from 'react';
import {
  Card, CardContent, Typography, Box, Button, Stack, Chip,
  Divider, IconButton, Tooltip, Collapse, Alert, Skeleton,
  Badge, SpeedDial, SpeedDialAction, SpeedDialIcon
} from '@mui/material';
import { 
  Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon, 
  Person as PersonIcon, Schedule as ScheduleIcon, MoreVert as MoreVertIcon,
  KeyboardArrowDown as ExpandMoreIcon, CheckCircle as CheckCircleIcon,
  KeyboardArrowRight as ExpandLessIcon, ContentCopy as CopyIcon,
  Comment as CommentIcon, Assignment as AssignmentIcon
} from '@mui/icons-material';
import ActionItem from './ActionItem';

// ==================== HELPERS ====================

const isContentEmpty = (content) => {
  if (!content) return true;
  const textOnly = content.replace(/<[^>]*>/g, '').trim();
  return textOnly === '';
};

const stripHtml = (html) => {
  if (!html) return '';
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || '';
};

const getSummaryFromContent = (content, maxLength = 100) => {
  if (!content) return '';
  const plainText = stripHtml(content);
  if (plainText.length <= maxLength) return plainText;
  return plainText.substring(0, maxLength) + '...';
};

// ==================== SUB-COMPONENTS ====================

const RichTextDisplay = ({ content, maxPreviewLength = 200, isActive }) => {
  const [expanded, setExpanded] = useState(false);
  if (isContentEmpty(content)) return null;
  
  const plainText = stripHtml(content);
  const shouldTruncate = plainText.length > maxPreviewLength && !expanded;
  const previewText = shouldTruncate ? plainText.substring(0, maxPreviewLength) + '...' : plainText;
  
  return (
    <Box sx={{ mt: 1, pl: 2, opacity: isActive ? 1 : 0.7 }}>
      {shouldTruncate ? (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
            {previewText}
          </Typography>
          <Button 
            size="small" 
            onClick={() => setExpanded(true)}
            sx={{ mt: 0.5, textTransform: 'none' }}
          >
            Read more
          </Button>
        </>
      ) : (
        <Box 
          sx={{
            fontSize: '0.875rem',
            lineHeight: 1.6,
            color: isActive ? 'text.primary' : 'text.disabled',
            '& p': { margin: 0, mb: 1 },
            '& ul, & ol': { margin: 0, mb: 1, pl: 2 },
            '& strong': { fontWeight: 600 },
            '& a': { color: 'primary.main' }
          }}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      )}
    </Box>
  );
};

const CollapsibleSection = ({ title, content, isExpanded, onToggle, color, isActive, summary }) => {
  if (isContentEmpty(content)) return null;
  
  return (
    <Box sx={{ mt: 2 }}>
      <Typography
        variant="subtitle2"
        onClick={onToggle}
        sx={{ 
          cursor: 'pointer', 
          color: isActive ? `${color}.main` : 'text.disabled', 
          display: 'flex', 
          alignItems: 'center', 
          gap: 0.5,
          fontWeight: 600,
          '&:hover': isActive ? { opacity: 0.8 } : {}
        }}
      >
        {isExpanded ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
        {title}
        {!isExpanded && summary && (
          <Chip 
            size="small" 
            label={summary} 
            variant="outlined" 
            color={isActive ? color : "default"}
            sx={{ ml: 1, height: 20, fontSize: '0.65rem', maxWidth: 200 }}
          />
        )}
      </Typography>
      <Collapse in={isExpanded}>
        <RichTextDisplay content={content} isActive={isActive} />
      </Collapse>
    </Box>
  );
};

const MinutesHeader = ({ minute, onEditMinutes, onDeleteMinutes, onCopyMinutes, loading }) => {
  const isActive = minute.is_active !== false;
  const [menuAnchor, setMenuAnchor] = useState(null);

  const handleMenuOpen = (event) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleCopy = () => {
    if (onCopyMinutes) onCopyMinutes(minute);
    handleMenuClose();
  };

  return (
    <>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
        <Stack spacing={0.5}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="h6" color={isActive ? "primary" : "text.disabled"} fontWeight={700}>
              {minute.topic || minute.title || 'Untitled Minutes'}
            </Typography>
            {!isActive && (
              <Chip 
                label="INACTIVE" 
                size="small" 
                color="error" 
                variant="filled" 
                sx={{ height: 20, fontWeight: 'bold', fontSize: '0.65rem' }} 
              />
            )}
            {minute.is_approved && (
              <Chip 
                label="APPROVED" 
                size="small" 
                color="success" 
                variant="outlined"
                icon={<CheckCircleIcon sx={{ fontSize: 12 }} />}
                sx={{ height: 20, fontSize: '0.65rem' }} 
              />
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            ID: {minute.id?.slice(0, 8)}...
          </Typography>
        </Stack>
        
        <Stack direction="row" spacing={0.5}>
          <Tooltip title={isActive ? "Copy Minutes" : "Cannot copy inactive minutes"}>
            <span>
              <IconButton 
                size="small" 
                onClick={handleCopy}
                disabled={loading || !isActive}
              >
                <CopyIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={isActive ? "Edit Minutes" : "Record is inactive"}>
            <span>
              <IconButton 
                size="small" 
                onClick={() => onEditMinutes(minute)} 
                disabled={loading || !isActive}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={isActive ? "Deactivate Minutes" : "Already inactive"}>
            <span>
              <IconButton 
                size="small" 
                color="error" 
                onClick={() => onDeleteMinutes(minute.id)} 
                disabled={loading || !isActive}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Box>

      <Divider sx={{ my: 1.5 }} />

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <Chip
          icon={<PersonIcon sx={{ fontSize: '1rem !important' }} />}
          label={`By: ${minute.recorded_by_name || 'System'}`}
          size="small"
          variant="outlined"
        />
        <Chip
          icon={<ScheduleIcon sx={{ fontSize: '1rem !important' }} />}
          label={`Created: ${minute.created_at ? new Date(minute.created_at).toLocaleString() : 'Unknown'}`}
          size="small"
          variant="outlined"
        />
        {minute.updated_at && (
          <Chip
            label={`Updated: ${new Date(minute.updated_at).toLocaleString()}`}
            size="small"
            variant="outlined"
            color="secondary"
          />
        )}
        {minute.approved_at && (
          <Chip
            label={`Approved: ${new Date(minute.approved_at).toLocaleDateString()}`}
            size="small"
            variant="outlined"
            color="success"
          />
        )}
      </Stack>
    </>
  );
};

// ==================== MAIN COMPONENT ====================

const MinutesList = ({ 
  minutes, 
  onEditMinutes, 
  onDeleteMinutes, 
  onAddAction, 
  onEditAction,
  onCopyMinutes,
  onUpdate, 
  loading, 
  isMeetingStarted 
}) => {
  const [expandedItems, setExpandedItems] = useState({});
  const [expandedMinutes, setExpandedMinutes] = useState({});

  const toggleSection = useCallback((id, type) => {
    setExpandedItems(prev => ({
      ...prev,
      [`${id}-${type}`]: !prev[`${id}-${type}`]
    }));
  }, []);

  const toggleMinuteExpansion = useCallback((id) => {
    setExpandedMinutes(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  }, []);

  // Calculate stats for each minute
  const minutesWithStats = useMemo(() => {
    return minutes?.map(minute => ({
      ...minute,
      actions: Array.isArray(minute.actions) ? minute.actions : [],
      stats: {
        totalActions: minute.actions?.length || 0,
        completedActions: minute.actions?.filter(a => a.completed_at || a.status === 'completed').length || 0,
        overdueActions: minute.actions?.filter(a => a.is_overdue || (a.due_date && new Date(a.due_date) < new Date() && !a.completed_at)).length || 0,
        inProgressActions: minute.actions?.filter(a => a.overall_progress_percentage > 0 && a.overall_progress_percentage < 100).length || 0
      }
    })) || [];
  }, [minutes]);

  // Loading skeleton
  if (loading) {
    return (
      <Stack spacing={3}>
        {[1, 2, 3].map(i => (
          <Card key={i} variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <Skeleton variant="text" width="60%" height={32} />
              <Skeleton variant="text" width="40%" height={20} sx={{ mt: 1 }} />
              <Divider sx={{ my: 2 }} />
              <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 2 }} />
            </CardContent>
          </Card>
        ))}
      </Stack>
    );
  }

  if (!minutesWithStats || minutesWithStats.length === 0) {
    return (
      <Alert 
        severity="info" 
        sx={{ mt: 2, borderRadius: 2 }}
        icon={<AssignmentIcon />}
        action={
          isMeetingStarted && (
            <Button color="inherit" size="small" onClick={() => onAddAction(null)}>
              Add First Minutes
            </Button>
          )
        }
      >
        <Typography variant="body2">
          No minutes recorded for this meeting.
          {isMeetingStarted && " Click the button above to add minutes."}
        </Typography>
      </Alert>
    );
  }

  return (
    <Box>
      {minutesWithStats.map((minute) => {
        const isActive = minute.is_active !== false;
        const canEdit = isActive && isMeetingStarted;
        const actions = minute.actions;
        const hasContent = !isContentEmpty(minute.discussion) || !isContentEmpty(minute.decisions);
        const isExpanded = expandedMinutes[minute.id] || false;
        
        // Action stats
        const completedCount = minute.stats.completedActions;
        const totalActions = minute.stats.totalActions;
        const completionRate = totalActions > 0 ? Math.round((completedCount / totalActions) * 100) : 0;
        
        return (
          <Card 
            key={minute.id} 
            variant="outlined" 
            sx={{ 
              mb: 3, 
              borderRadius: 3,
              border: isActive ? '1px solid #e2e8f0' : '1px dashed #cbd5e1',
              bgcolor: isActive ? 'background.paper' : '#f8fafc',
              transition: 'all 0.2s',
              '&:hover': {
                boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.08)' : 'none'
              }
            }}
          >
            <CardContent>
              <MinutesHeader
                minute={minute}
                onEditMinutes={onEditMinutes}
                onDeleteMinutes={onDeleteMinutes}
                onCopyMinutes={onCopyMinutes}
                loading={loading}
              />

              {/* Quick Stats Badges */}
              {totalActions > 0 && (
                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                  <Chip 
                    size="small" 
                    label={`${completionRate}% Complete`}
                    color="success"
                    variant="outlined"
                  />
                  <Chip 
                    size="small" 
                    label={`${minute.stats.overdueActions} Overdue`}
                    color="error"
                    variant="outlined"
                  />
                  <Chip 
                    size="small" 
                    label={`${minute.stats.inProgressActions} In Progress`}
                    color="warning"
                    variant="outlined"
                  />
                </Stack>
              )}

              {/* Expand/Collapse button for minutes content */}
              {(hasContent || totalActions > 0) && (
                <Button
                  size="small"
                  onClick={() => toggleMinuteExpansion(minute.id)}
                  startIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  sx={{ mb: 1, textTransform: 'none' }}
                >
                  {isExpanded ? 'Hide Details' : 'Show Details'}
                </Button>
              )}

              <Collapse in={isExpanded}>
                <CollapsibleSection
                  title="Discussion"
                  content={minute.discussion}
                  isActive={isActive}
                  color="primary"
                  isExpanded={expandedItems[`${minute.id}-disc`]}
                  onToggle={() => toggleSection(minute.id, 'disc')}
                  summary={getSummaryFromContent(minute.discussion, 60)}
                />

                <CollapsibleSection
                  title="Decisions"
                  content={minute.decisions}
                  isActive={isActive}
                  color="success"
                  isExpanded={expandedItems[`${minute.id}-deci`]}
                  onToggle={() => toggleSection(minute.id, 'deci')}
                  summary={getSummaryFromContent(minute.decisions, 60)}
                />
              </Collapse>

              {!hasContent && (
                <Typography variant="body2" color="text.disabled" sx={{ mt: 2, fontStyle: 'italic', pl: 1 }}>
                  No discussion or decisions provided.
                </Typography>
              )}

              {/* Actions Section */}
              <Box mt={4} sx={{ opacity: canEdit || !isActive ? 1 : 0.5 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle1" fontWeight={700}>
                      Action Items
                    </Typography>
                    {totalActions > 0 && (
                      <Badge badgeContent={totalActions} color="primary" sx={{ '& .MuiBadge-badge': { fontSize: '0.7rem' } }}>
                        <AssignmentIcon fontSize="small" color="action" />
                      </Badge>
                    )}
                  </Stack>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => onAddAction(minute.id)}
                    disabled={loading || !canEdit}
                  >
                    Add Action
                  </Button>
                </Box>

                {actions.length > 0 ? (
                  <Stack spacing={2}>
                    {actions.map((action, index) => (
                      <ActionItem
                        key={action.id || index}
                        action={action}
                        minuteId={minute.id}
                        onUpdate={onUpdate}
                        onEdit={onEditAction}
                        disabled={!canEdit}
                      />
                    ))}
                  </Stack>
                ) : (
                  <Box 
                    sx={{ 
                      py: 3, 
                      border: '1px dashed #e2e8f0', 
                      borderRadius: 2, 
                      textAlign: 'center', 
                      bgcolor: 'rgba(0,0,0,0.02)' 
                    }}
                  >
                    <AssignmentIcon sx={{ fontSize: 32, color: '#94a3b8', mb: 1 }} />
                    <Typography variant="caption" color="text.secondary" display="block">
                      No action items yet
                    </Typography>
                    {canEdit && (
                      <Button 
                        size="small" 
                        onClick={() => onAddAction(minute.id)}
                        sx={{ mt: 1 }}
                      >
                        Add first action
                      </Button>
                    )}
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );
};

export default MinutesList;