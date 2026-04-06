import React, { useState } from 'react';
import {
  Card, CardContent, Typography, Box, Button, Stack, Chip,
  Divider, IconButton, Tooltip, Collapse, Alert
} from '@mui/material';
import { 
  Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon, 
  Person as PersonIcon, Schedule as ScheduleIcon,
  KeyboardArrowDown as ExpandMoreIcon,
  KeyboardArrowRight as ExpandLessIcon
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

const CollapsibleSection = ({ title, content, isExpanded, onToggle, color, isActive }) => {
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
        {!isExpanded && (
          <Chip 
            size="small" 
            label={stripHtml(content).substring(0, 40) + '...'} 
            variant="outlined" 
            color={isActive ? color : "default"}
            sx={{ ml: 1, height: 20, fontSize: '0.65rem' }}
          />
        )}
      </Typography>
      <Collapse in={isExpanded}>
        <RichTextDisplay content={content} isActive={isActive} />
      </Collapse>
    </Box>
  );
};

const MinutesHeader = ({ minute, onEditMinutes, onDeleteMinutes, loading }) => {
  const isActive = minute.is_active !== false;

  return (
    <>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
        <Stack spacing={0.5}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" color={isActive ? "primary" : "text.disabled"} fontWeight={600}>
              {minute.topic}
            </Typography>
            {!isActive && (
              <Chip label="INACTIVE" size="small" color="error" variant="filled" sx={{ height: 20, fontWeight: 'bold', fontSize: '0.65rem' }} />
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            ID: {minute.id}
          </Typography>
        </Stack>
        
        <Stack direction="row" spacing={1}>
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
          variant="soft"
        />
        <Chip
          icon={<ScheduleIcon sx={{ fontSize: '1rem !important' }} />}
          label={`Created: ${new Date(minute.created_at).toLocaleString()}`}
          size="small"
          variant="soft"
        />
        {minute.updated_at && (
          <Chip
            label={`Updated: ${new Date(minute.updated_at).toLocaleString()}`}
            size="small"
            variant="soft"
            color="secondary"
          />
        )}
      </Stack>
    </>
  );
};

// ==================== MAIN COMPONENT ====================

const MinutesList = ({ minutes, onEditMinutes, onDeleteMinutes, onAddAction, onUpdate, loading }) => {
  const [expandedItems, setExpandedItems] = useState({});

  const toggleSection = (id, type) => {
    setExpandedItems(prev => ({
      ...prev,
      [`${id}-${type}`]: !prev[`${id}-${type}`]
    }));
  };

  if (!minutes || minutes.length === 0) {
    return (
      <Alert 
        severity="info" 
        sx={{ mt: 2, borderRadius: 2 }}
        action={
          <Button color="inherit" size="small" onClick={() => onAddAction(null, null)}>
            Add First Minutes
          </Button>
        }
      >
        No minutes recorded for this meeting.
      </Alert>
    );
  }

  return (
    <Box>
      {minutes.map((minute) => {
        const isActive = minute.is_active !== false;
        const hasContent = !isContentEmpty(minute.discussion) || !isContentEmpty(minute.decisions);

        return (
          <Card 
            key={minute.id} 
            variant="outlined" 
            sx={{ 
              mb: 3, 
              borderRadius: 3,
              border: isActive ? '1px solid #e2e8f0' : '1px dashed #cbd5e1',
              bgcolor: isActive ? 'background.paper' : '#f8fafc',
              transition: 'all 0.2s'
            }}
          >
            <CardContent>
              <MinutesHeader
                minute={minute}
                onEditMinutes={onEditMinutes}
                onDeleteMinutes={onDeleteMinutes}
                loading={loading}
              />

              <CollapsibleSection
                title="Discussion"
                content={minute.discussion}
                isActive={isActive}
                color="primary"
                isExpanded={expandedItems[`${minute.id}-disc`]}
                onToggle={() => toggleSection(minute.id, 'disc')}
              />

              <CollapsibleSection
                title="Decisions"
                content={minute.decisions}
                isActive={isActive}
                color="success"
                isExpanded={expandedItems[`${minute.id}-deci`]}
                onToggle={() => toggleSection(minute.id, 'deci')}
              />

              {!hasContent && (
                <Typography variant="body2" color="text.disabled" sx={{ mt: 2, fontStyle: 'italic', pl: 1 }}>
                  No discussion or decisions provided.
                </Typography>
              )}

              <Box mt={4} sx={{ opacity: isActive ? 1 : 0.5 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    Action Items ({minute.actions?.length || 0})
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => onAddAction(minute.id)}
                    disabled={loading || !isActive}
                  >
                    Add Action
                  </Button>
                </Box>

                {minute.actions?.length > 0 ? (
                  <Stack spacing={1.5}>
                    {minute.actions.map((action) => (
                      <ActionItem
                        key={action.id}
                        action={action}
                        minuteId={minute.id}
                        onUpdate={onUpdate}
                        onEdit={onAddAction}
                        disabled={!isActive} // Pass disabled prop to ActionItem
                      />
                    ))}
                  </Stack>
                ) : (
                  <Box 
                    sx={{ 
                      py: 3, border: '1px dashed #e2e8f0', borderRadius: 2, 
                      textAlign: 'center', bgcolor: 'rgba(0,0,0,0.02)' 
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      No actions linked to this topic.
                    </Typography>
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