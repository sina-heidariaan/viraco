import { validateTiptapDoc } from './tiptap.validator';

const doc = (...content: unknown[]) => ({ type: 'doc', content });
const para = (...content: unknown[]) => ({ type: 'paragraph', content });
const text = (t: string, ...marks: unknown[]) => ({ type: 'text', text: t, ...(marks.length ? { marks } : {}) });
const link = (href: unknown) => ({ type: 'link', attrs: { href } });

describe('validateTiptapDoc', () => {
  describe('accepts', () => {
    it.each([
      ['an empty doc', doc()],
      ['a doc without content', { type: 'doc' }],
      ['one empty paragraph', doc({ type: 'paragraph' })],
      ['headings 1–3', doc(...[1, 2, 3].map((level) => ({ type: 'heading', attrs: { level }, content: [text('h')] })))],
      ['bold, italic and hard break', doc(para(text('a', { type: 'bold' }, { type: 'italic' }), { type: 'hardBreak' }, text('b')))],
      ['lists and blockquote', doc(
        { type: 'bulletList', content: [{ type: 'listItem', content: [para(text('x'))] }] },
        { type: 'orderedList', attrs: { start: 1, type: null }, content: [{ type: 'listItem', content: [para(text('y'))] }] },
        { type: 'blockquote', content: [para(text('q'))] },
      )],
      ['http and https links', doc(para(text('a', link('http://example.com')), text('b', link('https://example.com/x?y=1'))))],
      ['a link with TipTap’s default attributes', doc(para(text('a', { type: 'link', attrs: { href: 'https://x.io', target: '_blank', rel: 'noopener noreferrer nofollow', class: null } })))],
    ])('%s', (_label, value) => {
      expect(validateTiptapDoc(value)).toBeNull();
    });
  });

  describe('rejects', () => {
    it.each([
      ['javascript: links', doc(para(text('x', link('javascript:alert(1)'))))],
      ['JavaScript: links in mixed case', doc(para(text('x', link('JaVaScRiPt:alert(1)'))))],
      ['data: links', doc(para(text('x', link('data:text/html,<b>x</b>'))))],
      ['relative links', doc(para(text('x', link('/admin'))))],
      ['a link without href', doc(para(text('x', { type: 'link', attrs: {} })))],
      ['unknown nodes', doc({ type: 'image', attrs: { src: 'https://x.io/a.png' } })],
      ['unknown marks', doc(para(text('x', { type: 'code' })))],
      ['unknown attributes', doc({ type: 'paragraph', attrs: { style: 'color:red' } })],
      ['unknown node keys', doc({ type: 'paragraph', html: '<p>x</p>' })],
      ['heading level 4', doc({ type: 'heading', attrs: { level: 4 } })],
      ['text directly in doc', doc(text('x'))],
      ['a paragraph inside a paragraph', doc(para({ type: 'paragraph' }))],
      ['empty text nodes', doc(para({ type: 'text', text: '' }))],
      ['an HTML string', '<p>hello</p>'],
      ['null', null],
      ['a non-doc root', para(text('x'))],
    ])('%s', (_label, value) => {
      expect(validateTiptapDoc(value)).toEqual(expect.any(String));
    });

    it('documents nested deeper than 20 levels', () => {
      let node: object = { type: 'paragraph' };
      for (let i = 0; i < 20; i++) node = { type: 'blockquote', content: [node] };
      expect(validateTiptapDoc(doc(node))).toMatch(/deeper than 20/);
    });

    it('documents larger than 100 KB', () => {
      expect(validateTiptapDoc(doc(para(text('x'.repeat(101 * 1024)))))).toMatch(/100 KB/);
    });
  });
});
