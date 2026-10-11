import type { Extensions } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { TiptapDoc, TiptapMark, TiptapNode } from '@/types/api';

/**
 * THE extension list for task descriptions (plan §5.4). The editor and the read-only
 * viewer both use it, so the same JSON renders the same way in both. It is limited to the
 * backend allowlist: doc, paragraph, text, heading 1–3, bullet/ordered list, list item,
 * blockquote, hard break; marks bold, italic, link (http/https only). StarterKit 3 already
 * contains Link, so @tiptap/extension-link is not a separate dependency.
 */

export const LINK_REL = 'noopener noreferrer nofollow';

export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

export const TASK_EXTENSIONS: Extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    // Off: not on the allowlist, so the backend would reject what they produce.
    code: false,
    codeBlock: false,
    strike: false,
    underline: false,
    horizontalRule: false,
    link: {
      // In the editor a click places the cursor; in the viewer the browser follows the <a>.
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      defaultProtocol: 'https',
      isAllowedUri: (url) => isHttpUrl(url),
      HTMLAttributes: { target: '_blank', rel: LINK_REL, class: null },
    },
  }),
];

export const EMPTY_DOC: TiptapDoc = { type: 'doc', content: [] };

/**
 * Keeps only `href` on link marks and drops links that are not http(s).
 * Why: TipTap's Link mark also stores `title`, `class`, `target` and `rel`, and a pasted
 * <a> can carry any value in them. The backend rejects unknown attributes, and the viewer
 * must always render the fixed target/rel above. Missing attributes fall back to those
 * defaults when the JSON is loaded. Used on save and on load.
 */
export function normalizeDoc(doc: TiptapDoc): TiptapDoc {
  return normalizeNode(doc) as TiptapDoc;
}

function normalizeNode(node: TiptapNode): TiptapNode {
  const out: TiptapNode = { ...node };
  if (node.marks) {
    const marks = node.marks.flatMap((mark): TiptapMark[] => {
      if (mark.type !== 'link') return [mark];
      const href = mark.attrs?.href;
      return isHttpUrl(href) ? [{ type: 'link', attrs: { href } }] : [];
    });
    if (marks.length > 0) out.marks = marks;
    else delete out.marks;
  }
  if (node.content) out.content = node.content.map(normalizeNode);
  return out;
}

/** True for a doc with no text: no content, or only empty paragraphs. */
export function isEmptyDoc(doc: TiptapDoc | null | undefined): boolean {
  return !doc?.content?.some((node) => node.type !== 'paragraph' || (node.content?.length ?? 0) > 0);
}

/** UTF-8 size of the JSON, measured the way the backend measures it (100 KB limit). */
export function docByteSize(doc: TiptapDoc): number {
  return new TextEncoder().encode(JSON.stringify(doc)).length;
}
