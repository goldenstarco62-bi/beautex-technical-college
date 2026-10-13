/**
 * Course and Student Enrollment Utility
 * Provides standardized course parsing and robust enrollment verification across the frontend.
 */

/**
 * Parse raw student/faculty course field into an array of trimmed course strings.
 * Handles:
 * - Native arrays
 * - PostgreSQL array literals: '{"Course A","Course B"}'
 * - JSON string arrays: '["Course A", "Course B"]'
 * - Comma-separated strings: 'Course A, Course B'
 * - Single string or number
 */
export function parseStudentCourses(courseField) {
    if (!courseField) return [];
    if (Array.isArray(courseField)) {
        return courseField.map(c => String(c).trim()).filter(Boolean);
    }
    const s = String(courseField).trim();
    if (!s) return [];

    // PostgreSQL array syntax: {"Val 1","Val 2"}
    if (s.startsWith('{') && s.endsWith('}')) {
        return s
            .slice(1, -1)
            .split(',')
            .map(c => c.replace(/^"|"$/g, '').trim())
            .filter(Boolean);
    }

    // JSON array syntax: ["Val 1", "Val 2"]
    if (s.startsWith('[')) {
        try {
            const parsed = JSON.parse(s);
            if (Array.isArray(parsed)) {
                return parsed.map(c => String(c).trim()).filter(Boolean);
            }
        } catch (_) {
            // fall through
        }
    }

    // Comma-separated or single string
    return s.split(',').map(c => c.trim()).filter(Boolean);
}

/**
 * Check if a student is enrolled in a given course.
 * Matches student's course tokens against course name, id, and code (case-insensitive).
 */
export function isStudentEnrolledInCourse(student, course) {
    if (!student || !course) return false;
    const studentCourses = parseStudentCourses(student.course);
    if (studentCourses.length === 0) return false;

    const targets = [];
    if (typeof course === 'string') {
        const trimmed = course.toLowerCase().trim();
        if (trimmed) targets.push(trimmed);
    } else {
        if (course.name) targets.push(String(course.name).toLowerCase().trim());
        if (course.id) targets.push(String(course.id).toLowerCase().trim());
        if (course.code) targets.push(String(course.code).toLowerCase().trim());
    }

    if (targets.length === 0) return false;

    return studentCourses.some(sc => {
        const scLower = sc.toLowerCase().trim();
        // Exact match against name, id, or code
        if (targets.some(t => t === scLower)) return true;
        // Substring / partial match if target contains parentheses like "Computer Packages (Certificate)"
        return targets.some(t => t.includes(scLower) || scLower.includes(t));
    });
}

/**
 * Safely find the student's enrolled course object from the list of courses.
 * NEVER blindly returns courses[0] if the student does not belong to it.
 */
export function matchEnrolledCourse(allCourses, studentProfile) {
    if (!studentProfile || !studentProfile.course) return null;
    const coursesList = Array.isArray(allCourses) ? allCourses : [];
    const studentCourses = parseStudentCourses(studentProfile.course);
    if (studentCourses.length === 0) return null;

    // 1. Try exact match using isStudentEnrolledInCourse
    const matched = coursesList.find(c => isStudentEnrolledInCourse(studentProfile, c));
    if (matched) return matched;

    // 2. Return a placeholder representing the actual student's course name
    // instead of falsely attributing an unrelated course (like courses[0])
    return {
        id: studentCourses[0],
        name: studentCourses[0],
        instructor: 'Assigned Trainer',
        room: 'Main Campus',
        department: studentProfile.department || 'Academic Department'
    };
}
