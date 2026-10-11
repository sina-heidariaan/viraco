/** Minimal shape of a TipTap (ProseMirror) JSON document. Validated by the API before storage. */
export interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
}

export interface TiptapDoc extends TiptapNode {
  type: 'doc';
}

export const EMPTY_TIPTAP_DOC: TiptapDoc = { type: 'doc', content: [] };
