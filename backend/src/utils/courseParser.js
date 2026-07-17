/**
 * Standardized helper to parse student/faculty courses lists.
 * Correctly handles:
 * - Arrays directly
 * - PostgreSQL array literal syntax (e.g. {"Course A","Course B"})
 * - JSON array syntax (e.g. ["Course A", "Course B"])
 * - Comma-separated strings (e.g. Course A, Course B)
 * - Single string value
 */
export function parseCoursesField(courseVal) {
    if (!courseVal) return [];
    if (Array.isArray(courseVal)) return courseVal;
    if (typeof courseVal !== 'string') {
        return [String(courseVal)];
    }
    const trimmed = courseVal.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        // PostgreSQL array literal syntax
        return trimmed
            .slice(1, -1)
            .split(',')
            .map(s => s.replace(/^"|"$/g, '').trim())
            .filter(Boolean);
    }
    if (trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
            // fall through
        }
    }
    return trimmed.split(',').map(c => c.trim()).filter(Boolean);
}

export default { parseCoursesField };
