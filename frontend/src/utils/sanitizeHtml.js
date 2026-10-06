import DOMPurify from 'dompurify';

// Rich-text allowlist profile: keeps formatting produced by the editor
// (bold, underline, lists, paragraphs, spans, breaks) while stripping scripts,
// iframes, inline event handlers (onerror/onclick/...) and javascript: URIs.
const CLEAN_CONFIG = {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'srcdoc'],
};

/**
 * Sanitize untrusted HTML (e.g. server-stored rich text) before injecting it via
 * dangerouslySetInnerHTML or element.innerHTML. Returns '' for null/undefined.
 */
export default function sanitizeHtml(dirty) {
    if (dirty == null) return '';
    return DOMPurify.sanitize(String(dirty), CLEAN_CONFIG);
}
