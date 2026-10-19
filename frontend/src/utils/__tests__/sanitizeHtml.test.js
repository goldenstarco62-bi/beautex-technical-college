// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import sanitizeHtml from '../sanitizeHtml.js';

describe('sanitizeHtml (XSS allowlist)', () => {
    it('preserves safe formatting markup', () => {
        expect(sanitizeHtml('<b>bold</b> and <ul><li>item</li></ul>')).toContain('<b>bold</b>');
        expect(sanitizeHtml('<p>hello</p>')).toContain('<p>hello</p>');
    });

    it('strips <script> tags and their content', () => {
        const out = sanitizeHtml('before <script>alert(1)</script>after');
        expect(out.toLowerCase()).not.toContain('<script');
    });

    it('removes inline event handlers', () => {
        const out = sanitizeHtml('<img src="x" onerror="alert(1)">');
        expect(out.toLowerCase()).not.toContain('onerror');
    });

    it('neutralizes javascript: URIs', () => {
        const out = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
        expect(out.toLowerCase()).not.toContain('javascript:');
    });

    it('returns empty string for null/undefined', () => {
        expect(sanitizeHtml(null)).toBe('');
        expect(sanitizeHtml(undefined)).toBe('');
    });
});
