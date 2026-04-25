import React from 'react';
import { Box, IconButton, Tooltip, Divider, useTheme, alpha } from '@mui/material';
import {
  FormatBold as BoldIcon,
  FormatItalic as ItalicIcon,
  FormatListBulleted as BulletListIcon,
  FormatListNumbered as NumberedListIcon,
  FormatQuote as QuoteIcon,
  Code as CodeIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Image as ImageIcon,
  HorizontalRule as HrIcon
} from '@mui/icons-material';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import HorizontalRule from '@tiptap/extension-horizontal-rule';

const MenuBar = ({ editor }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  if (!editor) return null;

  const addImage = () => {
    const url = window.prompt('Enter image URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  return (
    <Box sx={{ 
      border: '1px solid', 
      borderColor: 'divider', 
      borderRadius: 1, 
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      p: 0.5,
      display: 'flex',
      gap: 0.5,
      flexWrap: 'wrap',
      bgcolor: isDarkMode ? alpha('#1F2937', 0.8) : '#fafafa'
    }}>
      <Tooltip title="Bold (Ctrl+B)">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleBold().run()}
          sx={{
            color: editor.isActive('bold') 
              ? theme.palette.primary.main 
              : isDarkMode ? '#D1D5DB' : '#6B7280',
            bgcolor: editor.isActive('bold') 
              ? alpha(theme.palette.primary.main, 0.12) 
              : 'transparent',
            '&:hover': {
              bgcolor: editor.isActive('bold')
                ? alpha(theme.palette.primary.main, 0.2)
                : alpha(isDarkMode ? '#FFFFFF' : '#000000', 0.04)
            }
          }}
        >
          <BoldIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Italic (Ctrl+I)">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          sx={{
            color: editor.isActive('italic') 
              ? theme.palette.primary.main 
              : isDarkMode ? '#D1D5DB' : '#6B7280',
            bgcolor: editor.isActive('italic') 
              ? alpha(theme.palette.primary.main, 0.12) 
              : 'transparent',
            '&:hover': {
              bgcolor: editor.isActive('italic')
                ? alpha(theme.palette.primary.main, 0.2)
                : alpha(isDarkMode ? '#FFFFFF' : '#000000', 0.04)
            }
          }}
        >
          <ItalicIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Divider 
        orientation="vertical" 
        flexItem 
        sx={{ 
          bgcolor: isDarkMode ? '#4B5563' : '#E5E7EB',
          mx: 0.5 
        }} 
      />

      <Tooltip title="Bullet List">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          sx={{
            color: editor.isActive('bulletList') 
              ? theme.palette.primary.main 
              : isDarkMode ? '#D1D5DB' : '#6B7280',
            bgcolor: editor.isActive('bulletList') 
              ? alpha(theme.palette.primary.main, 0.12) 
              : 'transparent',
            '&:hover': {
              bgcolor: editor.isActive('bulletList')
                ? alpha(theme.palette.primary.main, 0.2)
                : alpha(isDarkMode ? '#FFFFFF' : '#000000', 0.04)
            }
          }}
        >
          <BulletListIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Numbered List">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          sx={{
            color: editor.isActive('orderedList') 
              ? theme.palette.primary.main 
              : isDarkMode ? '#D1D5DB' : '#6B7280',
            bgcolor: editor.isActive('orderedList') 
              ? alpha(theme.palette.primary.main, 0.12) 
              : 'transparent',
            '&:hover': {
              bgcolor: editor.isActive('orderedList')
                ? alpha(theme.palette.primary.main, 0.2)
                : alpha(isDarkMode ? '#FFFFFF' : '#000000', 0.04)
            }
          }}
        >
          <NumberedListIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Divider 
        orientation="vertical" 
        flexItem 
        sx={{ 
          bgcolor: isDarkMode ? '#4B5563' : '#E5E7EB',
          mx: 0.5 
        }} 
      />

      <Tooltip title="Quote">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          sx={{
            color: editor.isActive('blockquote') 
              ? theme.palette.primary.main 
              : isDarkMode ? '#D1D5DB' : '#6B7280',
            bgcolor: editor.isActive('blockquote') 
              ? alpha(theme.palette.primary.main, 0.12) 
              : 'transparent',
            '&:hover': {
              bgcolor: editor.isActive('blockquote')
                ? alpha(theme.palette.primary.main, 0.2)
                : alpha(isDarkMode ? '#FFFFFF' : '#000000', 0.04)
            }
          }}
        >
          <QuoteIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Code">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleCode().run()}
          sx={{
            color: editor.isActive('code') 
              ? theme.palette.primary.main 
              : isDarkMode ? '#D1D5DB' : '#6B7280',
            bgcolor: editor.isActive('code') 
              ? alpha(theme.palette.primary.main, 0.12) 
              : 'transparent',
            '&:hover': {
              bgcolor: editor.isActive('code')
                ? alpha(theme.palette.primary.main, 0.2)
                : alpha(isDarkMode ? '#FFFFFF' : '#000000', 0.04)
            }
          }}
        >
          <CodeIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Divider 
        orientation="vertical" 
        flexItem 
        sx={{ 
          bgcolor: isDarkMode ? '#4B5563' : '#E5E7EB',
          mx: 0.5 
        }} 
      />

      <Tooltip title="Horizontal Rule">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          sx={{
            color: isDarkMode ? '#D1D5DB' : '#6B7280',
            '&:hover': {
              bgcolor: alpha(isDarkMode ? '#FFFFFF' : '#000000', 0.04)
            }
          }}
        >
          <HrIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Add Image">
        <IconButton 
          size="small" 
          onClick={addImage}
          sx={{
            color: isDarkMode ? '#D1D5DB' : '#6B7280',
            '&:hover': {
              bgcolor: alpha(isDarkMode ? '#FFFFFF' : '#000000', 0.04)
            }
          }}
        >
          <ImageIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Divider 
        orientation="vertical" 
        flexItem 
        sx={{ 
          bgcolor: isDarkMode ? '#4B5563' : '#E5E7EB',
          mx: 0.5 
        }} 
      />

      <Tooltip title="Undo (Ctrl+Z)">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          sx={{
            color: isDarkMode ? '#D1D5DB' : '#6B7280',
            '&.Mui-disabled': {
              color: isDarkMode ? '#4B5563' : '#D1D5DB',
              opacity: 0.5
            },
            '&:hover:not(.Mui-disabled)': {
              bgcolor: alpha(isDarkMode ? '#FFFFFF' : '#000000', 0.04)
            }
          }}
        >
          <UndoIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Redo (Ctrl+Y)">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          sx={{
            color: isDarkMode ? '#D1D5DB' : '#6B7280',
            '&.Mui-disabled': {
              color: isDarkMode ? '#4B5563' : '#D1D5DB',
              opacity: 0.5
            },
            '&:hover:not(.Mui-disabled)': {
              bgcolor: alpha(isDarkMode ? '#FFFFFF' : '#000000', 0.04)
            }
          }}
        >
          <RedoIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

const RichTextEditor = ({ value, onChange, placeholder, minHeight = 200 }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Write something...',
      }),
      Image,
      HorizontalRule,
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
    },
    editorProps: {
      attributes: {
        class: 'prose-mirror-editor',
      },
    },
  });

  return (
    <Box sx={{ 
      border: '1px solid', 
      borderColor: 'divider', 
      borderRadius: 1,
      overflow: 'hidden',
      bgcolor: isDarkMode ? '#1F2937' : '#FFFFFF'
    }}>
      <MenuBar editor={editor} />
      <Box
        sx={{
          '& .ProseMirror': {
            minHeight: minHeight,
            padding: 2,
            outline: 'none',
            color: isDarkMode ? '#E5E7EB' : '#1F2937',
            backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
            
            '& p': { 
              margin: 0, 
              marginBottom: 1,
              color: isDarkMode ? '#D1D5DB' : '#374151'
            },
            '& p:last-child': { marginBottom: 0 },
            
            '& ul, & ol': { 
              margin: 0, 
              marginBottom: 1, 
              paddingLeft: 2,
              color: isDarkMode ? '#D1D5DB' : '#374151'
            },
            
            '& li': { 
              marginBottom: 0.5,
              color: isDarkMode ? '#D1D5DB' : '#374151'
            },
            
            '& blockquote': {
              margin: 0,
              marginBottom: 1,
              paddingLeft: 2,
              borderLeft: `3px solid ${theme.palette.primary.main}`,
              color: isDarkMode ? '#9CA3AF' : '#6B7280',
              fontStyle: 'italic'
            },
            
            '& code': {
              backgroundColor: isDarkMode ? alpha('#FFFFFF', 0.08) : '#F3F4F6',
              padding: '0.2rem 0.3rem',
              borderRadius: 1,
              fontFamily: 'monospace',
              fontSize: '0.9em',
              color: isDarkMode ? '#F87171' : '#DC2626'
            },
            
            '& pre': {
              backgroundColor: isDarkMode ? alpha('#FFFFFF', 0.05) : '#F3F4F6',
              padding: 1,
              borderRadius: 1,
              overflowX: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.9em',
              color: isDarkMode ? '#E5E7EB' : '#1F2937'
            },
            
            '& img': {
              maxWidth: '100%',
              height: 'auto',
              margin: '0.5rem 0',
              borderRadius: 1
            },
            
            '& hr': {
              margin: '1rem 0',
              border: 'none',
              borderTop: `1px solid ${isDarkMode ? '#374151' : '#E5E7EB'}`
            },
            
            '& strong, & b': {
              color: isDarkMode ? '#FFFFFF' : '#111827',
              fontWeight: 700
            },
            
            '& em, & i': {
              color: isDarkMode ? '#D1D5DB' : '#374151'
            },
            
            '& a': {
              color: isDarkMode ? '#A78BFA' : theme.palette.primary.main,
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline'
              }
            },
            
            '&.ProseMirror-focused': { 
              outline: 'none' 
            },
            
            '& .ProseMirror-placeholder': {
              color: isDarkMode ? '#6B7280' : '#9CA3AF',
              pointerEvents: 'none',
              userSelect: 'none'
            },
            
            '& .ProseMirror-selectednode': {
              outline: `2px solid ${theme.palette.primary.main}`,
              borderRadius: 1
            }
          }
        }}
      >
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );
};

export default RichTextEditor;