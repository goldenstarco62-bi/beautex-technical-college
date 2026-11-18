import { query } from '../config/database.js';

// One source of truth for grade boundaries and grade points. The Settings →
// Exams screen writes these keys; every marks/grade path reads them through
// here so a change cannot leave one screen grading on stale numbers.
export const DEFAULT_GRADE_POINTS = { Distinction: 4, Credit: 3, Pass: 2, Fail: 0 };
export const DEFAULT_GRADE_SCALE = {
    distinction: 70,
    credit: 60,
    pass: 50,
    fail: 0,
    points: { ...DEFAULT_GRADE_POINTS },
};

const clamp = (n) => Math.min(100, Math.max(0, n));
const clampPoints = (n) => Math.min(10, Math.max(0, n));

const toNumber = (value, fallback) => {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
};

export function normalizeGradeScale(raw = {}) {
    const distinction = clamp(toNumber(raw.distinction, DEFAULT_GRADE_SCALE.distinction));
    const credit = clamp(toNumber(raw.credit, DEFAULT_GRADE_SCALE.credit));
    const pass = clamp(toNumber(raw.pass, DEFAULT_GRADE_SCALE.pass));
    const fail = clamp(toNumber(raw.fail, DEFAULT_GRADE_SCALE.fail));
    // Equal or inverted bands would make whole grades unreachable.
    if (!(distinction > credit && credit > pass)) return { ...DEFAULT_GRADE_SCALE, points: { ...DEFAULT_GRADE_POINTS } };
    return { distinction, credit, pass, fail, points: normalizeGradePoints(raw.points) };
}

export function normalizeGradePoints(raw = {}) {
    const points = {
        Distinction: clampPoints(toNumber(raw.Distinction ?? raw.distinction, DEFAULT_GRADE_POINTS.Distinction)),
        Credit: clampPoints(toNumber(raw.Credit ?? raw.credit, DEFAULT_GRADE_POINTS.Credit)),
        Pass: clampPoints(toNumber(raw.Pass ?? raw.pass, DEFAULT_GRADE_POINTS.Pass)),
        Fail: clampPoints(toNumber(raw.Fail ?? raw.fail, DEFAULT_GRADE_POINTS.Fail)),
    };
    if (!(points.Distinction >= points.Credit && points.Credit >= points.Pass && points.Pass >= points.Fail)) {
        return { ...DEFAULT_GRADE_POINTS };
    }
    return points;
}

export function gradeFor(percentage, scale = DEFAULT_GRADE_SCALE) {
    const p = parseFloat(percentage);
    if (!Number.isFinite(p)) return 'Fail';
    if (p >= scale.distinction) return 'Distinction';
    if (p >= scale.credit) return 'Credit';
    if (p >= scale.pass) return 'Pass';
    return 'Fail';
}

export function gradePointsFor(grade, scale = DEFAULT_GRADE_SCALE) {
    const points = scale.points || DEFAULT_GRADE_POINTS;
    return toNumber(points[grade], 0);
}

export async function getGradeScale() {
    try {
        const rows = await query(
            `SELECT key, value FROM system_settings WHERE key IN (
                'grading_distinction_min', 'grading_credit_min', 'grading_pass_min', 'grading_fail_min',
                'grading_distinction_points', 'grading_credit_points', 'grading_pass_points', 'grading_fail_points'
            )`
        );
        const map = rows.reduce((acc, row) => { acc[row.key] = row.value; return acc; }, {});
        return normalizeGradeScale({
            distinction: map.grading_distinction_min,
            credit: map.grading_credit_min,
            pass: map.grading_pass_min,
            fail: map.grading_fail_min,
            points: {
                distinction: map.grading_distinction_points,
                credit: map.grading_credit_points,
                pass: map.grading_pass_points,
                fail: map.grading_fail_points,
            },
        });
    } catch {
        return { ...DEFAULT_GRADE_SCALE, points: { ...DEFAULT_GRADE_POINTS } };
    }
}
