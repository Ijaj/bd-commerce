import { Button, Group, Popover, Stack, Textarea, TextInput } from '@mantine/core';
import { Link, RichTextEditor } from '@mantine/tiptap';
import Image from '@tiptap/extension-image';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import Underline from '@tiptap/extension-underline';
import Youtube from '@tiptap/extension-youtube';
import { type Editor, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { type ReactNode, useEffect, useState } from 'react';

export interface HtmlEditorProps {
  /** HTML string ('' when empty). */
  value: string;
  onChange: (html: string) => void;
  label?: string;
  minHeight?: number;
  disabled?: boolean;
}

const normalize = (html: string) => (html === '<p></p>' ? '' : html);

function UrlControl(props: {
  label: string;
  placeholder: string;
  children: ReactNode;
  onSubmit: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  return (
    <Popover opened={open} onChange={setOpen} withArrow position="bottom" trapFocus>
      <Popover.Target>
        <RichTextEditor.Control
          aria-label={props.label}
          title={props.label}
          onClick={() => setOpen((o) => !o)}
          style={{ width: 'auto', padding: '0 8px', fontSize: 12 }}
        >
          {props.children}
        </RichTextEditor.Control>
      </Popover.Target>
      <Popover.Dropdown>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!/^https?:\/\//i.test(url)) return;
            props.onSubmit(url);
            setUrl('');
            setOpen(false);
          }}
        >
          <Stack gap="xs">
            <TextInput
              placeholder={props.placeholder}
              value={url}
              onChange={(e) => setUrl(e.currentTarget.value)}
            />
            <Button size="xs" type="submit" disabled={!/^https?:\/\//i.test(url)}>
              Insert
            </Button>
          </Stack>
        </form>
      </Popover.Dropdown>
    </Popover>
  );
}

function TableControls({ editor }: { editor: Editor }) {
  const small = { width: 'auto', padding: '0 6px', fontSize: 12 } as const;
  return (
    <RichTextEditor.ControlsGroup>
      <RichTextEditor.Control
        aria-label="Insert table"
        title="Insert table"
        style={small}
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
      >
        Table
      </RichTextEditor.Control>
      {editor.isActive('table') && (
        <>
          <RichTextEditor.Control
            style={small}
            title="Add row below"
            onClick={() => editor.chain().focus().addRowAfter().run()}
          >
            +Row
          </RichTextEditor.Control>
          <RichTextEditor.Control
            style={small}
            title="Add column right"
            onClick={() => editor.chain().focus().addColumnAfter().run()}
          >
            +Col
          </RichTextEditor.Control>
          <RichTextEditor.Control
            style={small}
            title="Delete row"
            onClick={() => editor.chain().focus().deleteRow().run()}
          >
            -Row
          </RichTextEditor.Control>
          <RichTextEditor.Control
            style={small}
            title="Delete column"
            onClick={() => editor.chain().focus().deleteColumn().run()}
          >
            -Col
          </RichTextEditor.Control>
          <RichTextEditor.Control
            style={small}
            title="Delete table"
            onClick={() => editor.chain().focus().deleteTable().run()}
          >
            Del
          </RichTextEditor.Control>
        </>
      )}
    </RichTextEditor.ControlsGroup>
  );
}

/**
 * Rich text editor (Mantine/TipTap) producing an HTML string, with a "View HTML" switch to
 * edit the raw source in a monospace box. The API sanitizes on save, so only the tags the
 * toolbar can produce survive: headings, bold/italic/underline, lists, links, tables,
 * images by URL and YouTube embeds.
 *   <HtmlEditor label="Description" value={html} onChange={setHtml} />
 */
export function HtmlEditor({ value, onChange, label, minHeight = 220, disabled }: HtmlEditorProps) {
  const [source, setSource] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false, underline: false }),
      Underline,
      Link.configure({ openOnClick: false }),
      Image,
      Youtube.configure({ nocookie: true, width: 480, height: 270 }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor: ed }) => onChange(normalize(ed.getHTML())),
  });

  // Pull in outside changes (record loaded, form reset) without echoing them back.
  useEffect(() => {
    if (editor && normalize(editor.getHTML()) !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  return (
    <div>
      {label && (
        <div style={{ fontSize: 'var(--mantine-font-size-sm)', fontWeight: 500, marginBottom: 4 }}>
          {label}
        </div>
      )}
      <RichTextEditor editor={editor} className="bdc-html-editor">
        <RichTextEditor.Toolbar sticky stickyOffset={48}>
          {editor && !source && (
            <>
              <RichTextEditor.ControlsGroup>
                <RichTextEditor.Bold />
                <RichTextEditor.Italic />
                <RichTextEditor.Underline />
                <RichTextEditor.ClearFormatting />
              </RichTextEditor.ControlsGroup>
              <RichTextEditor.ControlsGroup>
                <RichTextEditor.H2 />
                <RichTextEditor.H3 />
                <RichTextEditor.H4 />
              </RichTextEditor.ControlsGroup>
              <RichTextEditor.ControlsGroup>
                <RichTextEditor.BulletList />
                <RichTextEditor.OrderedList />
              </RichTextEditor.ControlsGroup>
              <RichTextEditor.ControlsGroup>
                <RichTextEditor.Link />
                <RichTextEditor.Unlink />
                <UrlControl
                  label="Insert image by URL"
                  placeholder="https://.../image.jpg"
                  onSubmit={(src) => editor.chain().focus().setImage({ src }).run()}
                >
                  Img
                </UrlControl>
                <UrlControl
                  label="Embed YouTube video"
                  placeholder="https://www.youtube.com/watch?v=..."
                  onSubmit={(src) => editor.chain().focus().setYoutubeVideo({ src }).run()}
                >
                  YouTube
                </UrlControl>
              </RichTextEditor.ControlsGroup>
              <TableControls editor={editor} />
              <RichTextEditor.ControlsGroup>
                <RichTextEditor.Undo />
                <RichTextEditor.Redo />
              </RichTextEditor.ControlsGroup>
            </>
          )}
          <RichTextEditor.ControlsGroup ml="auto">
            <RichTextEditor.Control
              aria-label="View HTML"
              title="View HTML"
              active={source}
              onClick={() => setSource((s) => !s)}
              style={{ width: 'auto', padding: '0 8px', fontSize: 12 }}
            >
              {source ? 'Visual' : 'View HTML'}
            </RichTextEditor.Control>
          </RichTextEditor.ControlsGroup>
        </RichTextEditor.Toolbar>
        {source ? (
          <Group p="xs" style={{ display: 'block' }}>
            <Textarea
              aria-label="HTML source"
              autosize
              minRows={8}
              styles={{ input: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12 } }}
              value={value}
              disabled={disabled}
              onChange={(e) => onChange(e.currentTarget.value)}
            />
          </Group>
        ) : (
          <RichTextEditor.Content style={{ minHeight }} />
        )}
      </RichTextEditor>
    </div>
  );
}
