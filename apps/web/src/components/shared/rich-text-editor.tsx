'use client';

import * as React from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Underline,
  Unlink,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface RichTextEditorProps {
  /** The HTML now in the editor. Read once when the editor is created. */
  value: string;
  onChange: (html: string) => void;
  /** Names the editing area for screen readers. */
  label: string;
  /** For `FormField`: links the area to its label, hint and error. */
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

function ToolButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(active && 'bg-hf-bg-surface text-hf-primary')}
      // Keep the focus (and the selection) in the editor.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <Icon aria-hidden="true" />
    </Button>
  );
}

/**
 * Rich text for descriptions: headings, bold, italic, underline, lists, quotes and links.
 * Only what `JOB_HTML_ALLOWED_TAGS` lets through is offered, and the page sanitises
 * whatever is saved anyway. It is heavy, so callers load it lazily (`next/dynamic`).
 */
export default function RichTextEditor({
  value,
  onChange,
  label,
  id,
  ...aria
}: RichTextEditorProps) {
  const [linkDraft, setLinkDraft] = React.useState<string | null>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // Not allowed in a description (see JOB_HTML_ALLOWED_TAGS).
        code: false,
        codeBlock: false,
        horizontalRule: false,
        link: {
          openOnClick: false,
          autolink: false,
          protocols: ['http', 'https', 'mailto'],
        },
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': label,
        ...(aria['aria-describedby']
          ? { 'aria-describedby': aria['aria-describedby'] }
          : {}),
        ...(aria['aria-invalid'] ? { 'aria-invalid': 'true' } : {}),
        class:
          'job-description min-h-40 px-3 py-2 text-sm text-hf-text-body outline-none',
      },
    },
    onUpdate: ({ editor: current }) =>
      onChange(current.isEmpty ? '' : current.getHTML()),
  });

  if (!editor) {
    return (
      <div className="min-h-52 rounded-hf-control border border-hf-border-control" />
    );
  }

  function applyLink() {
    const url = (linkDraft ?? '').trim();
    if (url) {
      editor
        ?.chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: url })
        .run();
    }
    setLinkDraft(null);
  }

  return (
    <div className="rounded-hf-control border border-hf-border-control bg-hf-bg-card focus-within:ring-2 focus-within:ring-hf-ring">
      <div
        role="toolbar"
        aria-label="Định dạng văn bản"
        className="flex flex-wrap items-center gap-1 border-b border-hf-border p-1"
      >
        <ToolButton
          label="Tiêu đề mục"
          icon={Heading2}
          active={editor.isActive('heading', { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        />
        <ToolButton
          label="In đậm"
          icon={Bold}
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolButton
          label="In nghiêng"
          icon={Italic}
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolButton
          label="Gạch chân"
          icon={Underline}
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />
        <ToolButton
          label="Danh sách dấu đầu dòng"
          icon={List}
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolButton
          label="Danh sách đánh số"
          icon={ListOrdered}
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolButton
          label="Trích dẫn"
          icon={Quote}
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <ToolButton
          label="Chèn liên kết"
          icon={Link2}
          active={editor.isActive('link')}
          onClick={() =>
            setLinkDraft(editor.getAttributes('link').href ?? 'https://')
          }
        />
        <ToolButton
          label="Gỡ liên kết"
          icon={Unlink}
          active={false}
          onClick={() =>
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
          }
        />
      </div>
      {linkDraft !== null && (
        <div className="flex items-center gap-2 border-b border-hf-border p-2">
          <Input
            aria-label="Địa chỉ liên kết"
            value={linkDraft}
            autoFocus
            onChange={(event) => setLinkDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                applyLink();
              }
              if (event.key === 'Escape') setLinkDraft(null);
            }}
          />
          <Button type="button" variant="primary" size="sm" onClick={applyLink}>
            Áp dụng
          </Button>
          <Button type="button" size="sm" onClick={() => setLinkDraft(null)}>
            Hủy
          </Button>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
