import React, { useState } from 'react';
import {
  Card, CardContent, Typography, Box, Button, Stack, Chip,
  Divider, IconButton, Tooltip, Collapse, Alert
} from '@mui/material';
import { 
  Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon, 
  Person as PersonIcon, Schedule as ScheduleIcon,
  FormatBold as BoldIcon, FormatItalic as ItalicIcon,
  FormatListBulleted as ListIcon, FormatListNumbered as NumberedListIcon
} from '@mui/icons-material';
import ActionItem from './ActionItem';

// Helper to check if content is empty (handles HTML tags)
const isContentEmpty = (content) => {
  if (!content) return true;
  // Remove HTML tags and check if there's any text content
  const textOnly = content.replace(/<[^>]*>/g, '').trim();
  return textOnly === '';
};

// Helper to strip HTML for preview (optional)
const stripHtml = (html) => {
  if (!html) return '';
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || '';
};

// Rich Text Display Component
const RichTextDisplay = ({ content, maxPreviewLength = 200 }) => {
  const [expanded, setExpanded] = useState(false);
  const isEmpty = isContentEmpty(content);
  
  if (isEmpty) return null;
  
  const plainText = stripHtml(content);
  const shouldTruncate = plainText.length > maxPreviewLength && !expanded;
  const previewText = shouldTruncate ? plainText.substring(0, maxPreviewLength) + '...' : plainText;
  
  return (
    <Box sx={{ mt: 1, pl: 2 }}>
      {shouldTruncate ? (
        <>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
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
          className="rich-text-content"
          sx={{
            '& p': { margin: 0, mb: 1 },
            '& ul, & ol': { margin: 0, mb: 1, pl: 2 },
            '& li': { mb: 0.5 },
            '& h1, & h2, & h3, & h4': { margin: 0, mb: 1 },
            '& strong, & b': { fontWeight: 'bold' },
            '& em, & i': { fontStyle: 'italic' },
            '& a': { color: 'primary.main', textDecoration: 'none' }
          }}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      )}
    </Box>
  );
};

// Discussion Section Component
const DiscussionSection = ({ minuteId, discussion, isExpanded, onToggle }) => {
  if (isContentEmpty(discussion)) return null;
  
  return (
    <>
      <Typography
        variant="subtitle2"
        onClick={() => onToggle(minuteId)}
        sx={{ 
          cursor: 'pointer', 
          color: 'primary.main', 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          mt: 2,
          '&:hover': { textDecoration: 'underline' }
        }}
      >
        {isExpanded ? '▼' : '▶'} Discussion
        {!isExpanded && (
          <Chip 
            size="small" 
            label={stripHtml(discussion).substring(0, 50) + '...'} 
            variant="outlined" 
            sx={{ ml: 1, fontSize: '0.7rem' }}
          />
        )}
      </Typography>
      <Collapse in={isExpanded}>
        <RichTextDisplay content={discussion} />
      </Collapse>
    </>
  );
};

// Decisions Section Component
const DecisionsSection = ({ minuteId, decisions, isExpanded, onToggle }) => {
  if (isContentEmpty(decisions)) return null;
  
  return (
    <>
      <Typography
        variant="subtitle2"
        onClick={() => onToggle(minuteId)}
        sx={{ 
          cursor: 'pointer', 
          color: 'success.main', 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          mt: 2,
          '&:hover': { textDecoration: 'underline' }
        }}
      >
        {isExpanded ? '▼' : '▶'} Decisions
        {!isExpanded && (
          <Chip 
            size="small" 
            label={stripHtml(decisions).substring(0, 50) + '...'} 
            variant="outlined" 
            color="success"
            sx={{ ml: 1, fontSize: '0.7rem' }}
          />
        )}
      </Typography>
      <Collapse in={isExpanded}>
        <RichTextDisplay content={decisions} />
      </Collapse>
    </>
  );
};

// Minutes Header Component
const MinutesHeader = ({ minute, onEditMinutes, onDeleteMinutes, loading }) => {
  const formatDateTime = (dateString) => {
    if (!dateString) return 'TBD';
    return new Date(dateString).toLocaleString();
  };

  return (
    <>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
        <Typography variant="h6" color="primary" fontWeight={600}>
          {minute.topic}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Edit Minutes">
            <IconButton size="small" onClick={() => onEditMinutes(minute)} disabled={loading}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete Minutes">
            <IconButton size="small" color="error" onClick={() => onDeleteMinutes(minute.id)} disabled={loading}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      <Divider sx={{ my: 1.5 }} />

      <Stack direction="row" spacing={1} flexWrap="wrap" mb={2}>
        <Chip
          icon={<PersonIcon />}
          label={`Recorded by: ${minute.recorded_by_name || minute.created_by_name || 'System'}`}
          size="small"
          variant="outlined"
        />
        <Chip
          icon={<ScheduleIcon />}
          label={`Created: ${formatDateTime(minute.created_at)}`}
          size="small"
          variant="outlined"
        />
        {minute.updated_at && minute.updated_at !== minute.created_at && (
          <Chip
            label={`Updated: ${formatDateTime(minute.updated_at)}`}
            size="small"
            variant="outlined"
            color="secondary"
          />
        )}
      </Stack>
    </>
  );
};

// Actions Section Component
const ActionsSection = ({ minuteId, actions, onAddAction, onUpdate, loading }) => {
  return (
    <Box mt={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1" fontWeight="bold">
          Action Items ({actions?.length || 0})
        </Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => onAddAction(minuteId)}
          disabled={loading}
        >
          Add Action
        </Button>
      </Box>

      {actions?.length > 0 ? (
        <Stack spacing={2}>
          {actions.map((action) => (
            <ActionItem
              key={action.id}
              action={action}
              minuteId={minuteId}
              onUpdate={onUpdate}
              onEdit={onAddAction}
            />
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
          No action items. Click "Add Action" to create one.
        </Typography>
      )}
    </Box>
  );
};

// Main MinutesList Component
const MinutesList = ({ minutes, onEditMinutes, onDeleteMinutes, onAddAction, onUpdate, loading }) => {
  const [expandedDiscussions, setExpandedDiscussions] = useState({});
  const [expandedDecisions, setExpandedDecisions] = useState({});

  const toggleDiscussion = (id) => {
    setExpandedDiscussions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleDecisions = (id) => {
    setExpandedDecisions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (minutes?.length === 0) {
    return (
      <Alert 
        severity="info" 
        sx={{ mt: 2 }}
        action={
          <Button color="info" size="small" onClick={() => onAddAction(null)}>
            Add Minutes
          </Button>
        }
      >
        No minutes recorded. Click "Add Minutes" to get started.
      </Alert>
    );
  }

  return (
    <>
      {minutes?.map((minute) => {
        const hasDiscussion = !isContentEmpty(minute.discussion);
        const hasDecisions = !isContentEmpty(minute.decisions);

        return (
          <Card key={minute.id} variant="outlined" sx={{ mb: 3, borderRadius: 2 }}>
            <CardContent>
              <MinutesHeader
                minute={minute}
                onEditMinutes={onEditMinutes}
                onDeleteMinutes={onDeleteMinutes}
                loading={loading}
              />

              {/* Discussion Section */}
              <DiscussionSection
                minuteId={minute.id}
                discussion={minute.discussion}
                isExpanded={expandedDiscussions[minute.id] || false}
                onToggle={toggleDiscussion}
              />

              {/* Decisions Section */}
              <DecisionsSection
                minuteId={minute.id}
                decisions={minute.decisions}
                isExpanded={expandedDecisions[minute.id] || false}
                onToggle={toggleDecisions}
              />

              {/* Show message if no content */}
              {!hasDiscussion && !hasDecisions && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontStyle: 'italic' }}>
                  No discussion or decisions recorded.
                </Typography>
              )}

              {/* Actions Section */}
              <ActionsSection
                minuteId={minute.id}
                actions={minute.actions}
                onAddAction={onAddAction}
                onUpdate={onUpdate}
                loading={loading}
              />
            </CardContent>
          </Card>
        );
      })}
    </>
  );
};

export default MinutesList;