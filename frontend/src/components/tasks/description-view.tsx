'use client';

import { EditorContent, useEditor } from '@tiptap/react';
import { TASK_EXTENSIONS, isEmptyDoc, normalizeDoc } from '@/lib/tiptap-extensions';
import type { TiptapDoc } from '@/types/api';

/**
 * Read-only description: a TipTap instance with `editable: false` and the same
 * extension list as the editor, so the JSON renders the same in both (plan §5.4).
 * TipTap renders the JSON through its schema, never as raw HTML.
 */
export function DescriptionView({ doc }: { doc: TiptapDoc }) {
  const editor = useEditor(
    {
      extensions: TASK_EXTENSIONS,
      content: normalizeDoc(doc),
      editable: false,
      immediatelyRender: false,
    },
    [doc],
  );

  if (isEmptyDoc(doc)) return <p className="text-sm text-neutral-600">توضیحی ثبت نشده است.</p>;
  if (!editor) return <div aria-hidden="true" className="h-24 animate-pulse rounded-lg bg-neutral-100" />;
  return <EditorContent editor={editor} className="tiptap-content" />;
}
