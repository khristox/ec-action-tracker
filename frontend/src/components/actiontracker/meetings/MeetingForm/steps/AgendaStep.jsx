// frontend/src/components/actiontracker/meetings/MeetingForm/steps/AgendaStep.jsx

import React from 'react';
import {
  Box,
  Stack,
  Typography,
  Paper,
  Alert,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Description as DescriptionIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

// Define modules outside component to prevent re-creation
const createQuillModules = (isMobile) => ({
  toolbar: isMobile
    ? [
        ['bold', 'italic', 'underline'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        ['clean'],
      ]
    : [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        ['link', 'clean'],
        [{ 'align': [] }],
      ],
  clipboard: {
    // Prevent unwanted format conversion
    matchVisual: false,
  },
});

// Use ONLY built-in formats - remove 'bullet' from here
const quillFormats = [
  'header',
  'bold',
  'italic',
  'underline',
  'strike',
  'list',        // ← 'list' handles both ordered and bullet lists
  // 'bullet',   // ← REMOVE THIS - causes the warning
  'link',
  'align',
];

export const AgendaStep = ({ formData, handleAgendaChange, isMobile }) => {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  // Memoize modules to prevent re-creation
  const modules = React.useMemo(() => createQuillModules(isMobile), [isMobile]);

  return (
    <Box sx={{ 
      width: '100%', 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
    }}>
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 1.5, sm: 2 },
          borderRadius: 2,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: isLight ? alpha(theme.palette.primary.main, 0.02) : 'transparent',
          borderColor: isLight ? 'primary.light' : 'divider',
          minHeight: { xs: 350, sm: 400, md: 450 },
        }}
      >
        <Stack spacing={1.5} sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Header - Fixed */}
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ flexShrink: 0 }}
          >
            <DescriptionIcon sx={{ color: 'primary.main', fontSize: 20 }} />
            <Typography variant="subtitle2" fontWeight={600}>
              Meeting Agenda
            </Typography>
            <Typography variant="caption" color="text.secondary">
              (Optional)
            </Typography>
          </Stack>

          {/* Editor Container - Fills remaining space */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              '& .quill': {
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                height: '100%',
              },
              '& .ql-toolbar': {
                borderTopLeftRadius: 8,
                borderTopRightRadius: 8,
                borderColor: theme.palette.divider,
                bgcolor: isLight ? alpha(theme.palette.primary.main, 0.04) : 'transparent',
                padding: isMobile ? '4px 8px' : '8px',
                flexShrink: 0,
                '& .ql-stroke': {
                  stroke: theme.palette.text.primary,
                },
                '& .ql-fill': {
                  fill: theme.palette.text.primary,
                },
                '& .ql-picker-label': {
                  color: theme.palette.text.primary,
                },
                '& .ql-picker-options': {
                  bgcolor: theme.palette.background.paper,
                },
              },
              '& .ql-container': {
                flex: 1,
                borderBottomLeftRadius: 8,
                borderBottomRightRadius: 8,
                borderColor: theme.palette.divider,
                bgcolor: theme.palette.background.paper,
                fontSize: isMobile ? '0.85rem' : '0.95rem',
                fontFamily: theme.typography.body1.fontFamily,
                minHeight: { xs: 200, sm: 250, md: 300 },
                height: 'auto',
              },
              '& .ql-editor': {
                minHeight: { xs: 180, sm: 220, md: 280 },
                maxHeight: '100%',
                height: '100%',
                overflowY: 'auto',
                padding: isMobile ? '8px 12px' : '12px 16px',
                '&.ql-blank::before': {
                  color: theme.palette.text.disabled,
                  fontStyle: 'normal',
                  fontSize: isMobile ? '0.85rem' : '0.95rem',
                },
                '& p, & li, & h1, & h2, & h3, & h4': {
                  textAlign: 'left',
                },
                '& h1': { fontSize: isMobile ? '1.3rem' : '1.5rem' },
                '& h2': { fontSize: isMobile ? '1.1rem' : '1.3rem' },
                '& h3': { fontSize: isMobile ? '1rem' : '1.1rem' },
              },
              '& .ql-editor:focus': {
                outline: `2px solid ${theme.palette.primary.main}`,
                outlineOffset: '-2px',
              },
              '& .ql-editor p': {
                margin: isMobile ? '4px 0' : '6px 0',
              },
            }}
          >
            <ReactQuill
              theme="snow"
              value={formData.agenda || ''}
              onChange={handleAgendaChange}
              modules={modules}
              formats={quillFormats}
              style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                height: '100%',
              }}
              placeholder="Add agenda items, discussion points, or meeting structure..."
            />
          </Box>

          {/* Info Alert - Compact, stays at bottom */}
          <Alert
            severity="info"
            icon={<InfoIcon sx={{ fontSize: 16 }} />}
            sx={{
              py: 0.5,
              px: 1.5,
              borderRadius: 1.5,
              flexShrink: 0,
              '& .MuiAlert-message': {
                fontSize: '0.7rem',
                padding: '2px 0',
              },
              '& .MuiAlert-icon': {
                padding: '4px 0',
              },
              bgcolor: isLight ? alpha(theme.palette.info.main, 0.04) : alpha(theme.palette.info.main, 0.08),
              border: '1px solid',
              borderColor: isLight ? alpha(theme.palette.info.main, 0.1) : alpha(theme.palette.info.main, 0.2),
            }}
          >
            <Typography variant="caption" sx={{ fontSize: '0.7rem', color: isLight ? '#4a4a6a' : '#aaaaaa' }}>
              Use the editor to create a structured agenda. Add bullet points, headings, and links.
            </Typography>
          </Alert>
        </Stack>
      </Paper>
    </Box>
  );
};

export default React.memo(AgendaStep);