import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * Allowlist validator for TipTap JSON (plan §5.4). Anything not listed here is
 * rejected: unknown nodes, marks, attributes or keys, bad nesting, non-http(s)
 * links, depth over 20 and size over 100 KB. Returns the first problem found.
 */

export const TIPTAP_MAX_DEPTH = 20;
export const TIPTAP_MAX_BYTES = 100 * 1024;

type AttrCheck = (value: unknown) => boolean;

const BLOCK = ['paragraph', 'heading', 'bulletList', 'orderedList', 'blockquote'];
const INLINE = ['text', 'hardBreak'];

/** Which child node types each node may contain. `null` = leaf (no `content`). */
const NODE_CHILDREN: Record<string, string[] | null> = {
  doc: BLOCK,
  paragraph: INLINE,
  heading: INLINE,
  bulletList: ['listItem'],
  orderedList: ['listItem'],
  listItem: BLOCK,
  blockquote: BLOCK,
  text: null,
  hardBreak: null,
};

const ORDERED_LIST_TYPES = [null, '1', 'a', 'A', 'i', 'I'];

const NODE_ATTRS: Record<string, Record<string, AttrCheck>> = {
  heading: { level: (v) => v === 1 || v === 2 || v === 3 },
  orderedList: {
    start: (v) => Number.isInteger(v) && (v as number) >= 0,
    type: (v) => ORDERED_LIST_TYPES.includes(v as string | null),
  },
};

export function isHttpUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

// TipTap 3's Link mark always serialises target/rel/class/title; the viewer forces safe values anyway.
const MARK_ATTRS: Record<string, Record<string, AttrCheck>> = {
  bold: {},
  italic: {},
  link: {
    href: isHttpUrl,
    target: (v) => v === null || v === '_blank',
    rel: (v) => v === null || typeof v === 'string',
    class: (v) => v === null,
    title: (v) => v === null || typeof v === 'string',
  },
};
const REQUIRED_ATTRS: Record<string, string[]> = { heading: ['level'], link: ['href'] };

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function checkAttrs(owner: string, attrs: unknown, allowed: Record<string, AttrCheck>): string | null {
  const required = REQUIRED_ATTRS[owner] ?? [];
  if (attrs === undefined) return required.length ? `${owner} requires attrs` : null;
  if (!isPlainObject(attrs)) return `${owner}.attrs must be an object`;
  for (const [key, value] of Object.entries(attrs)) {
    const check = allowed[key];
    if (!check) return `${owner} has unknown attribute "${key}"`;
    if (!check(value)) return `${owner}.${key} has an invalid value`;
  }
  for (const key of required) if (!(key in attrs)) return `${owner} requires attribute "${key}"`;
  return null;
}

function checkMarks(marks: unknown): string | null {
  if (!Array.isArray(marks)) return 'marks must be an array';
  for (const mark of marks) {
    if (!isPlainObject(mark)) return 'mark must be an object';
    for (const key of Object.keys(mark)) {
      if (key !== 'type' && key !== 'attrs') return `mark has unknown key "${key}"`;
    }
    const allowed = MARK_ATTRS[mark.type as string];
    if (typeof mark.type !== 'string' || !allowed) return `mark "${String(mark.type)}" is not allowed`;
    const problem = checkAttrs(mark.type, mark.attrs, allowed);
    if (problem) return problem;
  }
  return null;
}

function checkNode(node: unknown, allowedTypes: string[], depth: number): string | null {
  if (depth > TIPTAP_MAX_DEPTH) return `document is nested deeper than ${TIPTAP_MAX_DEPTH} levels`;
  if (!isPlainObject(node)) return 'node must be an object';
  const type = node.type;
  if (typeof type !== 'string' || !(type in NODE_CHILDREN)) return `node "${String(type)}" is not allowed`;
  if (!allowedTypes.includes(type)) return `node "${type}" is not allowed here`;

  for (const key of Object.keys(node)) {
    const ok =
      key === 'type' ||
      key === 'attrs' ||
      (key === 'content' && NODE_CHILDREN[type] !== null) ||
      (type === 'text' && (key === 'text' || key === 'marks'));
    if (!ok) return `${type} has unknown key "${key}"`;
  }

  const attrProblem = checkAttrs(type, node.attrs, NODE_ATTRS[type] ?? {});
  if (attrProblem) return attrProblem;

  if (type === 'text') {
    if (typeof node.text !== 'string' || node.text === '') return 'text node needs non-empty text';
    return node.marks === undefined ? null : checkMarks(node.marks);
  }

  const children = NODE_CHILDREN[type];
  if (children === null || node.content === undefined) return null;
  if (!Array.isArray(node.content)) return `${type}.content must be an array`;
  for (const child of node.content) {
    const problem = checkNode(child, children, depth + 1);
    if (problem) return problem;
  }
  return null;
}

/** Returns null when the value is an allowed TipTap document, else the reason it is not. */
export function validateTiptapDoc(value: unknown): string | null {
  if (!isPlainObject(value) || value.type !== 'doc') return 'description must be a TipTap doc';
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > TIPTAP_MAX_BYTES) {
    return 'description is larger than 100 KB';
  }
  return checkNode(value, ['doc'], 1);
}

/** class-validator decorator so TipTap errors appear in `details` like any other field error. */
export function IsTiptapDoc(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyName) => {
    let lastProblem: string | null = null;
    registerDecorator({
      name: 'isTiptapDoc',
      target: target.constructor,
      propertyName: propertyName as string,
      options,
      validator: {
        validate(value: unknown) {
          lastProblem = validateTiptapDoc(value);
          return lastProblem === null;
        },
        defaultMessage: () => lastProblem ?? 'description is not a valid TipTap doc',
      },
    });
  };
}
