'use client';

import {
  BoldIcon,
  ChatBubbleBottomCenterTextIcon,
  H2Icon,
  H3Icon,
  ItalicIcon,
  LinkIcon,
  ListBulletIcon,
  NumberedListIcon,
} from '@heroicons/react/20/solid';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import clsx from 'clsx';
import { useEffect, useId, useRef, useState, type ComponentType, type KeyboardEvent, type SVGProps } from 'react';
import { Button } from '@/components/ui/button';
import { TASK_EXTENSIONS, isHttpUrl, normalizeDoc } from '@/lib/tiptap-extensions';
import type { TiptapDoc } from '@/types/api';

type DescriptionEditorProps = {
  label: string;
  initial: TiptapDoc;
  /** Called on every change with the editor's JSON (not yet normalized). */
  onChange: (doc: TiptapDoc) => void;
  error?: string;
};

/**
 * TipTap editor for a task description. `immediatelyRender: false` keeps it out of the
 * server render, so there is no hydration mismatch; a placeholder of the same height
 * shows until it mounts.
 */
export function DescriptionEditor({ label, initial, onChange, error }: DescriptionEditorProps) {
  const labelId = useId();
  const errorId = useId();
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const editor = useEditor({
    extensions: TASK_EXTENSIONS,
    content: normalizeDoc(initial),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-labelledby': labelId,
        'aria-describedby': errorId,
        class: 'min-h-36 px-3 py-2 focus:outline-none',
      },
    },
    onUpdate: ({ editor: current }) => onChangeRef.current(current.getJSON() as TiptapDoc),
  });

  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-sm font-medium text-neutral-800">
        {label}
      </span>
      <div
        className={clsx(
          'overflow-hidden rounded-lg border bg-white focus-within:ring-2 focus-within:ring-accent-600 focus-within:ring-offset-1',
          error ? 'border-danger-600' : 'border-neutral-300',
        )}
      >
        {editor ? <Toolbar editor={editor} /> : <div className="h-11 border-b border-neutral-200 bg-neutral-50" />}
        {editor ? (
          <EditorContent editor={editor} className="tiptap-content max-h-80 overflow-y-auto" />
        ) : (
          <div className="min-h-36" />
        )}
      </div>
      {error && (
        <p id={errorId} className="text-sm text-danger-700">
          {error}
        </p>
      )}
    </div>
  );
}

type ToolButton = {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  active: (e: Editor) => boolean;
  run: (e: Editor) => void;
};

const TOOLS: ToolButton[] = [
  { label: 'پررنگ', icon: BoldIcon, active: (e) => e.isActive('bold'), run: (e) => e.chain().focus().toggleBold().run() },
  { label: 'کج', icon: ItalicIcon, active: (e) => e.isActive('italic'), run: (e) => e.chain().focus().toggleItalic().run() },
  {
    label: 'عنوان',
    icon: H2Icon,
    active: (e) => e.isActive('heading', { level: 2 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: 'زیرعنوان',
    icon: H3Icon,
    active: (e) => e.isActive('heading', { level: 3 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    label: 'فهرست نقطه‌ای',
    icon: ListBulletIcon,
    active: (e) => e.isActive('bulletList'),
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    label: 'فهرست شماره‌دار',
    icon: NumberedListIcon,
    active: (e) => e.isActive('orderedList'),
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    label: 'نقل‌قول',
    icon: ChatBubbleBottomCenterTextIcon,
    active: (e) => e.isActive('blockquote'),
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
];

function Toolbar({ editor }: { editor: Editor }) {
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({ tools: TOOLS.map((tool) => tool.active(e)), link: e.isActive('link') }),
  });
  const [linkOpen, setLinkOpen] = useState(false);

  return (
    <>
      <div role="toolbar" aria-label="قالب‌بندی توضیحات" className="flex flex-wrap gap-1 border-b border-neutral-200 bg-neutral-50 p-1">
        {TOOLS.map((tool, index) => (
          <ToolbarButton
            key={tool.label}
            label={tool.label}
            icon={tool.icon}
            pressed={active.tools[index]}
            onClick={() => tool.run(editor)}
          />
        ))}
        <ToolbarButton label="پیوند" icon={LinkIcon} pressed={active.link || linkOpen} onClick={() => setLinkOpen((open) => !open)} />
      </div>
      {linkOpen && <LinkRow editor={editor} hasLink={active.link} onDone={() => setLinkOpen(false)} />}
    </>
  );
}

function ToolbarButton({
  label,
  icon: Icon,
  pressed,
  onClick,
}: {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={clsx(
        'inline-flex size-9 items-center justify-center rounded-md transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600',
        pressed ? 'bg-accent-100 text-accent-800' : 'text-neutral-700 hover:bg-neutral-200',
      )}
    >
      <Icon aria-hidden="true" className="size-5" />
    </button>
  );
}

/** Add, change or remove the link on the selection. Only http(s) addresses (plan §5.4). */
function LinkRow({ editor, hasLink, onDone }: { editor: Editor; hasLink: boolean; onDone: () => void }) {
  const inputId = useId();
  const errorId = useId();
  const [href, setHref] = useState(() => String(editor.getAttributes('link').href ?? ''));
  const [error, setError] = useState<string | null>(null);

  function apply() {
    const raw = href.trim();
    if (!raw) {
      setError('نشانی پیوند را وارد کنید.');
      return;
    }
    // "example.com" → "https://example.com"; any other scheme is refused below.
    const url = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
    if (!isHttpUrl(url)) {
      setError('فقط نشانی‌هایی که با http یا https شروع می‌شوند پذیرفته می‌شوند.');
      return;
    }
    const chain = editor.chain().focus();
    if (editor.state.selection.empty && !hasLink) {
      chain.insertContent({ type: 'text', text: url, marks: [{ type: 'link', attrs: { href: url } }] }).run();
    } else {
      chain.extendMarkRange('link').setLink({ href: url }).run();
    }
    onDone();
  }

  function remove() {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    onDone();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Enter applies the link instead of submitting the task form.
    if (event.key === 'Enter') {
      event.preventDefault();
      apply();
    }
    // Escape closes only this row; without stopPropagation the task dialog closes too.
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      editor.commands.focus();
      onDone();
    }
  }

  return (
    <div className="flex flex-col gap-2 border-b border-neutral-200 bg-white p-2">
      <label htmlFor={inputId} className="text-sm font-medium text-neutral-800">
        نشانی پیوند
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={inputId}
          // The row opens because the user asked for it, so focus belongs here.
          autoFocus
          type="url"
          dir="ltr"
          inputMode="url"
          placeholder="https://"
          value={href}
          onChange={(event) => {
            setHref(event.target.value);
            setError(null);
          }}
          onKeyDown={onKeyDown}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          className={clsx(
            'min-h-10 min-w-0 flex-1 rounded-lg border bg-white px-3 text-base text-neutral-900',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600',
            error ? 'border-danger-600' : 'border-neutral-300',
          )}
        />
        <Button type="button" onClick={apply}>
          ثبت پیوند
        </Button>
        {hasLink && (
          <Button type="button" variant="secondary" onClick={remove}>
            حذف پیوند
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onDone}>
          انصراف
        </Button>
      </div>
      <p id={errorId} role="alert" className="text-sm text-danger-700 empty:hidden">
        {error}
      </p>
    </div>
  );
}
