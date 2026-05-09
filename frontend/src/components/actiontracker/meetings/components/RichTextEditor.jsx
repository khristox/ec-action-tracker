import React, { useMemo, useCallback } from 'react';

import {
  Box,
  IconButton,
  Tooltip,
  Divider,
  useTheme,
  alpha,
  Stack,
  Paper
} from '@mui/material';

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
  HorizontalRule as HrIcon,
  Title as HeadingIcon
} from '@mui/icons-material';

import { useEditor, EditorContent } from '@tiptap/react';

import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';

// ======================================================
// TOOLBAR BUTTON
// ======================================================

const ToolbarButton = ({
  title,
  icon,
  onClick,
  active,
  disabled
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Tooltip title={title}>
      <span>
        <IconButton
          size="small"
          onClick={onClick}
          disabled={disabled}
          sx={{
            width: 34,
            height: 34,
            borderRadius: 2,
            transition: 'all 0.15s ease',

            color: active
              ? theme.palette.primary.main
              : isDark
                ? '#D1D5DB'
                : '#6B7280',

            bgcolor: active
              ? alpha(
                  theme.palette.primary.main,
                  0.12
                )
              : 'transparent',

            '&:hover': {
              bgcolor: active
                ? alpha(
                    theme.palette.primary.main,
                    0.18
                  )
                : alpha(
                    isDark
                      ? '#FFFFFF'
                      : '#000000',
                    0.05
                  )
            },

            '&.Mui-disabled': {
              opacity: 0.4
            }
          }}
        >
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );
};

// ======================================================
// MENU BAR
// ======================================================

const MenuBar = ({ editor }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const addImage = useCallback(() => {
    const url = window.prompt(
      'Enter image URL'
    );

    if (url) {
      editor
        .chain()
        .focus()
        .setImage({ src: url })
        .run();
    }
  }, [editor]);

  const addLink = useCallback(() => {
    const url = window.prompt(
      'Enter link URL'
    );

    if (!url) return;

    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: url })
      .run();
  }, [editor]);

  if (!editor) return null;

  return (
    <Paper
      elevation={0}
      sx={{
        px: 1,
        py: 0.75,
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 0.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: isDark
          ? alpha('#111827', 0.9)
          : '#FAFAFA'
      }}
    >
      {/* TEXT */}

      <Stack direction="row" spacing={0.5}>
        <ToolbarButton
          title="Bold"
          active={editor.isActive('bold')}
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleBold()
              .run()
          }
          icon={<BoldIcon fontSize="small" />}
        />

        <ToolbarButton
          title="Italic"
          active={editor.isActive('italic')}
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleItalic()
              .run()
          }
          icon={
            <ItalicIcon fontSize="small" />
          }
        />

        <ToolbarButton
          title="Heading"
          active={editor.isActive(
            'heading'
          )}
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleHeading({
                level: 2
              })
              .run()
          }
          icon={
            <HeadingIcon fontSize="small" />
          }
        />
      </Stack>

      <Divider
        flexItem
        orientation="vertical"
        sx={{ mx: 0.5 }}
      />

      {/* LISTS */}

      <Stack direction="row" spacing={0.5}>
        <ToolbarButton
          title="Bullet List"
          active={editor.isActive(
            'bulletList'
          )}
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleBulletList()
              .run()
          }
          icon={
            <BulletListIcon fontSize="small" />
          }
        />

        <ToolbarButton
          title="Numbered List"
          active={editor.isActive(
            'orderedList'
          )}
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleOrderedList()
              .run()
          }
          icon={
            <NumberedListIcon fontSize="small" />
          }
        />

        <ToolbarButton
          title="Quote"
          active={editor.isActive(
            'blockquote'
          )}
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleBlockquote()
              .run()
          }
          icon={
            <QuoteIcon fontSize="small" />
          }
        />
      </Stack>

      <Divider
        flexItem
        orientation="vertical"
        sx={{ mx: 0.5 }}
      />

      {/* CODE */}

      <Stack direction="row" spacing={0.5}>
        <ToolbarButton
          title="Inline Code"
          active={editor.isActive('code')}
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleCode()
              .run()
          }
          icon={<CodeIcon fontSize="small" />}
        />

        <ToolbarButton
          title="Horizontal Rule"
          onClick={() =>
            editor
              .chain()
              .focus()
              .setHorizontalRule()
              .run()
          }
          icon={<HrIcon fontSize="small" />}
        />
      </Stack>

      <Divider
        flexItem
        orientation="vertical"
        sx={{ mx: 0.5 }}
      />

      {/* MEDIA */}

      <Stack direction="row" spacing={0.5}>
        <ToolbarButton
          title="Add Image"
          onClick={addImage}
          icon={
            <ImageIcon fontSize="small" />
          }
        />
      </Stack>

      <Box sx={{ flexGrow: 1 }} />

      {/* HISTORY */}

      <Stack direction="row" spacing={0.5}>
        <ToolbarButton
          title="Undo"
          disabled={!editor.can().undo()}
          onClick={() =>
            editor
              .chain()
              .focus()
              .undo()
              .run()
          }
          icon={<UndoIcon fontSize="small" />}
        />

        <ToolbarButton
          title="Redo"
          disabled={!editor.can().redo()}
          onClick={() =>
            editor
              .chain()
              .focus()
              .redo()
              .run()
          }
          icon={<RedoIcon fontSize="small" />}
        />
      </Stack>
    </Paper>
  );
};

// ======================================================
// MAIN EDITOR
// ======================================================

const RichTextEditor = ({
  value,
  onChange,
  placeholder = 'Write something...',
  minHeight = 240
}) => {
  const theme = useTheme();

  const isDark =
    theme.palette.mode === 'dark';

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),

      Placeholder.configure({
        placeholder
      }),

      Image.configure({
        inline: false
      }),

      Link.configure({
        openOnClick: false,
        autolink: true
      }),

      Underline,

      HorizontalRule
    ],
    [placeholder]
  );

  const editor = useEditor({
    extensions,

    content: value || '',

    immediatelyRender: false,

    editorProps: {
      attributes: {
        class: 'modern-editor'
      }
    },

    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    }
  });

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 3,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',

        transition: 'all 0.2s ease',

        '&:focus-within': {
          borderColor:
            theme.palette.primary.main,

          boxShadow: `0 0 0 3px ${alpha(
            theme.palette.primary.main,
            0.12
          )}`
        }
      }}
    >
      <MenuBar editor={editor} />

      <Box
        sx={{
          bgcolor: isDark
            ? '#111827'
            : '#FFFFFF',

          '& .modern-editor': {
            minHeight,
            padding: '20px',
            outline: 'none',

            fontSize: '0.95rem',
            lineHeight: 1.8,

            color: isDark
              ? '#E5E7EB'
              : '#111827',

            caretColor:
              theme.palette.primary.main
          },

          // ======================================================
          // PARAGRAPHS
          // ======================================================

          '& .modern-editor p': {
            marginTop: 0,
            marginBottom: '1rem'
          },

          '& .modern-editor p:last-child': {
            marginBottom: 0
          },

          // ======================================================
          // HEADINGS
          // ======================================================

          '& .modern-editor h1': {
            fontSize: '2rem',
            fontWeight: 700,
            marginBottom: '1rem',
            lineHeight: 1.2
          },

          '& .modern-editor h2': {
            fontSize: '1.5rem',
            fontWeight: 700,
            marginBottom: '0.75rem',
            lineHeight: 1.3
          },

          '& .modern-editor h3': {
            fontSize: '1.25rem',
            fontWeight: 600,
            marginBottom: '0.5rem'
          },

          // ======================================================
          // LISTS
          // ======================================================

          '& .modern-editor ul, & .modern-editor ol':
            {
              paddingLeft: '1.5rem',
              marginBottom: '1rem'
            },

          '& .modern-editor li': {
            marginBottom: '0.35rem'
          },

          // ======================================================
          // BLOCKQUOTE
          // ======================================================

          '& .modern-editor blockquote': {
            margin: '1.5rem 0',
            padding: '0.75rem 1rem',

            borderLeft: `4px solid ${theme.palette.primary.main}`,

            backgroundColor: isDark
              ? alpha('#FFFFFF', 0.03)
              : alpha(
                  theme.palette.primary.main,
                  0.04
                ),

            borderRadius: '0 10px 10px 0',

            color: isDark
              ? '#D1D5DB'
              : '#4B5563',

            fontStyle: 'italic'
          },

          // ======================================================
          // INLINE CODE
          // ======================================================

          '& .modern-editor code': {
            padding: '0.2rem 0.4rem',
            borderRadius: 6,

            fontFamily:
              'JetBrains Mono, monospace',

            fontSize: '0.85rem',

            backgroundColor: isDark
              ? alpha('#FFFFFF', 0.08)
              : '#F3F4F6',

            color: isDark
              ? '#FCA5A5'
              : '#DC2626'
          },

          // ======================================================
          // CODE BLOCKS
          // ======================================================

          '& .modern-editor pre': {
            padding: '1rem',
            overflowX: 'auto',

            borderRadius: 12,

            backgroundColor: isDark
              ? '#0F172A'
              : '#F8FAFC',

            border: '1px solid',

            borderColor: isDark
              ? '#1E293B'
              : '#E2E8F0'
          },

          '& .modern-editor pre code': {
            padding: 0,
            background: 'transparent',
            color: 'inherit'
          },

          // ======================================================
          // LINKS
          // ======================================================

          '& .modern-editor a': {
            color: theme.palette.primary.main,
            textDecoration: 'none',

            '&:hover': {
              textDecoration: 'underline'
            }
          },

          // ======================================================
          // IMAGES
          // ======================================================

          '& .modern-editor img': {
            maxWidth: '100%',
            borderRadius: 12,
            margin: '1rem 0'
          },

          // ======================================================
          // HR
          // ======================================================

          '& .modern-editor hr': {
            margin: '2rem 0',
            border: 'none',
            borderTop: '1px solid',
            borderColor: isDark
              ? '#374151'
              : '#E5E7EB'
          },

          // ======================================================
          // PLACEHOLDER
          // ======================================================

          '& .modern-editor p.is-editor-empty:first-of-type::before':
            {
              content: 'attr(data-placeholder)',
              color: isDark
                ? '#6B7280'
                : '#9CA3AF',

              pointerEvents: 'none',
              float: 'left',
              height: 0
            },

          // ======================================================
          // SELECTION
          // ======================================================

          '& .modern-editor ::selection': {
            backgroundColor: alpha(
              theme.palette.primary.main,
              0.2
            )
          }
        }}
      >
        <EditorContent editor={editor} />
      </Box>
    </Paper>
  );
};

export default RichTextEditor;