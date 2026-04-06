import React from 'react';
import { Box, IconButton, Tooltip, Divider } from '@mui/material';
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
      bgcolor: '#fafafa'
    }}>
      <Tooltip title="Bold (Ctrl+B)">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleBold().run()}
          color={editor.isActive('bold') ? 'primary' : 'default'}
          sx={{ bgcolor: editor.isActive('bold') ? 'action.selected' : 'transparent' }}
        >
          <BoldIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Italic (Ctrl+I)">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          color={editor.isActive('italic') ? 'primary' : 'default'}
        >
          <ItalicIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem />

      <Tooltip title="Bullet List">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          color={editor.isActive('bulletList') ? 'primary' : 'default'}
        >
          <BulletListIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Numbered List">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          color={editor.isActive('orderedList') ? 'primary' : 'default'}
        >
          <NumberedListIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem />

      <Tooltip title="Quote">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          color={editor.isActive('blockquote') ? 'primary' : 'default'}
        >
          <QuoteIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Code">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleCode().run()}
          color={editor.isActive('code') ? 'primary' : 'default'}
        >
          <CodeIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem />

      <Tooltip title="Horizontal Rule">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <HrIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Add Image">
        <IconButton size="small" onClick={addImage}>
          <ImageIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem />

      <Tooltip title="Undo (Ctrl+Z)">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        >
          <UndoIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Redo (Ctrl+Y)">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        >
          <RedoIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

const RichTextEditor = ({ value, onChange, placeholder, minHeight = 200 }) => {
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
  });

  return (
    <Box sx={{ 
      border: '1px solid', 
      borderColor: 'divider', 
      borderRadius: 1,
      overflow: 'hidden'
    }}>
      <MenuBar editor={editor} />
      <Box
        sx={{
          '& .ProseMirror': {
            minHeight: minHeight,
            padding: 2,
            outline: 'none',
            '& p': { margin: 0, marginBottom: 1 },
            '& p:last-child': { marginBottom: 0 },
            '& ul, & ol': { margin: 0, marginBottom: 1, paddingLeft: 2 },
            '& li': { marginBottom: 0.5 },
            '& blockquote': {
              margin: 0,
              marginBottom: 1,
              paddingLeft: 2,
              borderLeft: '3px solid',
              borderLeftColor: 'primary.main',
              color: 'text.secondary',
              fontStyle: 'italic'
            },
            '& code': {
              backgroundColor: '#f5f5f5',
              padding: '0.2rem 0.3rem',
              borderRadius: 1,
              fontFamily: 'monospace',
              fontSize: '0.9em'
            },
            '& pre': {
              backgroundColor: '#f5f5f5',
              padding: 1,
              borderRadius: 1,
              overflowX: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.9em'
            },
            '& img': {
              maxWidth: '100%',
              height: 'auto',
              margin: '0.5rem 0'
            },
            '& hr': {
              margin: '1rem 0',
              border: 'none',
              borderTop: '1px solid',
              borderTopColor: 'divider'
            },
            '&.ProseMirror-focused': { outline: 'none' },
            '& .ProseMirror-placeholder': {
              color: 'text.secondary',
              pointerEvents: 'none',
              userSelect: 'none'
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