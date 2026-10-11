import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { validateTiptapDoc } from '../../modules/todos/tiptap/tiptap.validator';
import { JsonDepthPipe, MAX_JSON_DEPTH } from './json-depth.pipe';

const body: ArgumentMetadata = { type: 'body' };

/** `levels` nested arrays around a number: nest(2) = [[1]]. */
const nest = (levels: number): unknown => {
  let value: unknown = 1;
  for (let i = 0; i < levels; i++) value = [value];
  return value;
};

/** Recursive on purpose: only used on small test values. */
const depthOf = (value: unknown): number =>
  typeof value === 'object' && value !== null ? 1 + Math.max(0, ...Object.values(value).map(depthOf)) : 0;

const errorOf = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error('expected the pipe to throw');
};

describe('JsonDepthPipe', () => {
  const pipe = new JsonDepthPipe();

  it(`accepts exactly ${MAX_JSON_DEPTH} levels and returns the same value`, () => {
    const value = { title: nest(MAX_JSON_DEPTH - 1) };
    expect(pipe.transform(value, body)).toBe(value);
  });

  it(`rejects ${MAX_JSON_DEPTH + 1} levels with a field error on the top-level key`, () => {
    const e = errorOf(() => pipe.transform({ ok: 1, title: nest(MAX_JSON_DEPTH) }, body));
    expect(e).toBeInstanceOf(BadRequestException);
    expect((e as BadRequestException).getResponse()).toEqual({
      message: 'Validation failed',
      details: [{ field: 'title', message: 'title is nested too deeply' }],
    });
  });

  it('walks without recursion, so 100 000 levels give a 400, not a stack overflow', () => {
    expect(errorOf(() => pipe.transform({ description: nest(100_000) }, body))).toBeInstanceOf(BadRequestException);
  });

  it('passes primitives and undefined through', () => {
    expect(pipe.transform('x', { type: 'param' })).toBe('x');
    expect(pipe.transform(undefined, body)).toBeUndefined();
  });

  it('the deepest valid TipTap body (43 levels) is well under the limit', () => {
    let node: object = {
      type: 'paragraph',
      content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] }],
    };
    for (let depth = 18; depth > 1; depth--) node = { type: 'blockquote', content: [node] };
    const description = { type: 'doc', content: [node] };
    expect(validateTiptapDoc(description)).toBeNull();
    // One level deeper would break the TipTap 20-level rule.
    expect(validateTiptapDoc({ type: 'doc', content: [{ type: 'blockquote', content: [node] }] })).toMatch(/deeper than 20/);

    const value = { title: 't', description };
    expect(depthOf(value)).toBe(43);
    expect(pipe.transform(value, body)).toBe(value);
  });
});
