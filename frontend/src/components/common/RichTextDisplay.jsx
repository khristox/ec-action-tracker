// src/components/common/RichTextDisplay.jsx
import React from 'react';
import { Box, Typography, Skeleton } from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledRichText = styled(Box)(({ theme }) => ({
  // Paragraph styles
  '& p': {
    margin: 0,
    marginBottom: theme.spacing(1),
    lineHeight: 1.6,
    color: theme.palette.text.primary,
  },
  
  // Headings
  '& h1, & h2, & h3, & h4, & h5, & h6': {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
    fontWeight: 600,
    color: theme.palette.text.primary,
  },
  '& h1': { fontSize: '1.8rem' },
  '& h2': { fontSize: '1.5rem' },
  '& h3': { fontSize: '1.3rem' },
  '& h4': { fontSize: '1.1rem' },
  
  // Ordered lists (numbered)
  '& ol': {
    margin: 0,
    marginBottom: theme.spacing(1.5),
    paddingLeft: theme.spacing(3),
    color: theme.palette.text.primary,
    listStyleType: 'decimal',
  },
  
  // Nested ordered lists
  '& ol ol': {
    listStyleType: 'lower-alpha',
  },
  
  '& ol ol ol': {
    listStyleType: 'lower-roman',
  },
  
  // Unordered lists (bullets)
  '& ul': {
    margin: 0,
    marginBottom: theme.spacing(1.5),
    paddingLeft: theme.spacing(3),
    color: theme.palette.text.primary,
    listStyleType: 'disc',
  },
  
  '& ul ul': {
    listStyleType: 'circle',
  },
  
  '& ul ul ul': {
    listStyleType: 'square',
  },
  
  // List items
  '& li': {
    marginBottom: theme.spacing(0.5),
    lineHeight: 1.6,
  },
  
  // Bold and emphasis
  '& strong, & b': {
    fontWeight: 700,
    color: theme.palette.text.primary,
  },
  '& em, & i': {
    fontStyle: 'italic',
  },
  
  // Links
  '& a': {
    color: theme.palette.primary.main,
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  
  // Blockquotes
  '& blockquote': {
    margin: theme.spacing(1.5, 0),
    paddingLeft: theme.spacing(2),
    borderLeft: `3px solid ${theme.palette.primary.main}`,
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
  },
  
  // Images
  '& img': {
    maxWidth: '100%',
    height: 'auto',
    borderRadius: theme.shape.borderRadius,
  },
  
  // Spacing for adjacent elements
  '& > *:last-child': {
    marginBottom: 0,
  },
  '& > *:first-child': {
    marginTop: 0,
  },
}));

// Helper function to normalize agenda content
const normalizeAgendaContent = (html) => {
  if (!html) return '';
  
  let normalized = html;
  
  // Remove standalone numbering from paragraphs that are immediately followed by a list
  // Example: <p>1. Attached</p><ol>... -> becomes just <p>Attached</p><ol>...
  normalized = normalized.replace(
    /<p>(\d+)\.\s*&nbsp;\s*([^<]+)<\/p>\s*<(o|u)l>/gi,
    '<p><strong>$2</strong></p>\n<$3l>'
  );
  
  // Also handle without &nbsp;
  normalized = normalized.replace(
    /<p>(\d+)\.\s*([^<]+)<\/p>\s*<(o|u)l>/gi,
    '<p><strong>$2</strong></p>\n<$3l>'
  );
  
  return normalized;
};

const RichTextDisplay = ({ 
  content, 
  placeholder = "No content provided", 
  loading = false, 
  minHeight = 100,
  normalize = true  // Option to enable/disable normalization
}) => {
  if (loading) {
    return (
      <Box sx={{ minHeight }}>
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="90%" />
        <Skeleton variant="text" width="95%" />
      </Box>
    );
  }

  if (!content || content === '<p></p>' || content === '<p><br></p>' || content === '<p><br/></p>') {
    return (
      <Typography variant="body2" color="text.secondary" fontStyle="italic" sx={{ py: 2 }}>
        {placeholder}
      </Typography>
    );
  }

  // Normalize the content to remove duplicate numbering
  const displayContent = normalize ? normalizeAgendaContent(content) : content;

  return (
    <StyledRichText
      className="rich-text-content"
      sx={{ minHeight }}
      dangerouslySetInnerHTML={{ __html: displayContent }}
    />
  );
};

export default RichTextDisplay;