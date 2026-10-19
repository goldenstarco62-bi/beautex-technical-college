import { describe, it, expect } from 'vitest';
import { parseStudentCourses, isStudentEnrolledInCourse, matchEnrolledCourse } from '../courseUtils.js';

describe('parseStudentCourses', () => {
    it('trims and filters native arrays', () => {
        expect(parseStudentCourses(['Alpha', ' Bravo ', ''])).toEqual(['Alpha', 'Bravo']);
    });
    it('parses a PostgreSQL array literal', () => {
        expect(parseStudentCourses('{"Course A","Course B"}')).toEqual(['Course A', 'Course B']);
    });
    it('parses a JSON array string', () => {
        expect(parseStudentCourses('["X", "Y"]')).toEqual(['X', 'Y']);
    });
    it('parses comma-separated and single values', () => {
        expect(parseStudentCourses('A, B, C')).toEqual(['A', 'B', 'C']);
        expect(parseStudentCourses('Solo')).toEqual(['Solo']);
    });
    it('returns [] for empty/nullish', () => {
        expect(parseStudentCourses(null)).toEqual([]);
        expect(parseStudentCourses('')).toEqual([]);
        expect(parseStudentCourses(',,')).toEqual([]);
    });
});

describe('isStudentEnrolledInCourse', () => {
    const student = { course: '["Business Studies"]' };
    it('matches by name, id, or code (case-insensitive)', () => {
        expect(isStudentEnrolledInCourse(student, { name: 'business studies' })).toBe(true);
        expect(isStudentEnrolledInCourse({ course: '["B001"]' }, { id: 'B001' })).toBe(true);
        expect(isStudentEnrolledInCourse({ course: '["BUS796"]' }, { code: 'BUS796' })).toBe(true);
    });
    it('matches partial/parenthetical titles', () => {
        expect(isStudentEnrolledInCourse({ course: '["Computer Packages"]' }, { name: 'Computer Packages (Certificate)' })).toBe(true);
    });
    it('does NOT match an unrelated course, and guards bad input', () => {
        expect(isStudentEnrolledInCourse(student, { name: 'Nursing' })).toBe(false);
        expect(isStudentEnrolledInCourse(null, { name: 'x' })).toBe(false);
        expect(isStudentEnrolledInCourse(student, null)).toBe(false);
    });
});

describe('matchEnrolledCourse', () => {
    const courses = [{ id: 'C001', name: 'Nursing' }, { id: 'C002', name: 'Business Studies' }];
    it('returns the actual enrolled course object', () => {
        const m = matchEnrolledCourse(courses, { course: '["Business Studies"]' });
        expect(m.id).toBe('C002');
    });
    it('returns a placeholder for the student\'s own course instead of blindly courses[0]', () => {
        const m = matchEnrolledCourse(courses, { course: '["Dreadlocks"]' });
        expect(m.id).toBe('Dreadlocks');
        expect(m.name).toBe('Dreadlocks');
        expect(m.id).not.toBe('C001');
    });
    it('returns null when the student has no course', () => {
        expect(matchEnrolledCourse(courses, { course: null })).toBeNull();
    });
});
