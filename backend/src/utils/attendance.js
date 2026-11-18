import { query, queryOne } from '../config/database.js';

// Statuses the register understands. Settings can reorder or trim the list, but
// every stored record must be one of these so percentages stay meaningful.
export const DEFAULT_STATUSES = ['Present', 'Absent', 'Late', 'Sick', 'Excused'];
export const PRESENT_STATUSES = ['Present'];
export const LATE_STATUSES = ['Late'];
export const EXCUSED_STATUSES = ['Excused'];
// Sick days are not attendance. Late and excused days still count as attended.
export const ATTENDED_STATUSES = ['Present', 'Late', 'Excused'];
export const ABSENT_STATUSES = ['Absent', 'Sick'];

const DEFAULT_THRESHOLDS = { excellent: 95, good: 85, fair: 75 };
const DEFAULT_THRESHOLD = 90;

const toNumber = (value, fallback) => {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
};

export function normalizeStatusList(raw) {
    const parts = Array.isArray(raw) ? raw : String(raw || '').split(',');
    const seen = new Set();
    const statuses = [];
    for (const part of parts) {
        const value = String(part || '').trim();
        if (!value) continue;
        const known = DEFAULT_STATUSES.find(s => s.toLowerCase() === value.toLowerCase());
        const canonical = known || value;
        if (seen.has(canonical.toLowerCase())) continue;
        seen.add(canonical.toLowerCase());
        statuses.push(canonical);
    }
    return statuses.length ? statuses : [...DEFAULT_STATUSES];
}

export function normalizeStatus(value, statuses = DEFAULT_STATUSES) {
    const wanted = String(value || '').trim().toLowerCase();
    if (!wanted) return null;
    return statuses.find(s => s.toLowerCase() === wanted) || null;
}

export function attendanceRate(counts = {}) {
    const total = Number(counts.total) || 0;
    if (total <= 0) return 0;
    const attended = ATTENDED_STATUSES.reduce((sum, status) => sum + (Number(counts[status.toLowerCase()]) || 0), 0);
    return Math.round((attended / total) * 1000) / 10;
}

export function emptyCounts() {
    return { present: 0, absent: 0, late: 0, sick: 0, excused: 0, total: 0 };
}

export function countStatus(counts, status) {
    const key = String(status || '').trim().toLowerCase();
    if (key in counts) counts[key] += 1;
    counts.total += 1;
}

// Postgres returns DATE/TIMESTAMP columns as JS Dates at local midnight, so
// toISOString() would shift the calendar day in non-UTC timezones.
export function toDateOnly(value) {
    if (!value) return '';
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return '';
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, '0');
        const d = String(value.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : '';
}

export function attendanceBand(percentage, thresholds = DEFAULT_THRESHOLDS) {
    if (percentage >= thresholds.excellent) return 'Excellent';
    if (percentage >= thresholds.good) return 'Good';
    if (percentage >= thresholds.fair) return 'Fair';
    return 'Needs Improvement';
}

export async function getAttendanceConfig() {
    const config = {
        statuses: [...DEFAULT_STATUSES],
        threshold: DEFAULT_THRESHOLD,
        thresholds: { ...DEFAULT_THRESHOLDS },
        mode: 'daily',
    };
    try {
        const rows = await query(
            `SELECT key, value FROM system_settings WHERE key IN (
                'attendance_status_types', 'attendance_threshold_percent', 'attendance_mode',
                'att_excellent', 'att_good', 'att_fair'
            )`
        );
        const map = rows.reduce((acc, row) => { acc[row.key] = row.value; return acc; }, {});
        config.statuses = normalizeStatusList(map.attendance_status_types);
        config.threshold = Math.min(100, Math.max(0, toNumber(map.attendance_threshold_percent, DEFAULT_THRESHOLD)));
        config.thresholds = {
            excellent: toNumber(map.att_excellent, DEFAULT_THRESHOLDS.excellent),
            good: toNumber(map.att_good, DEFAULT_THRESHOLDS.good),
            fair: toNumber(map.att_fair, DEFAULT_THRESHOLDS.fair),
        };
        if (map.attendance_mode) config.mode = map.attendance_mode;
    } catch {
        // Settings table unavailable → defaults are still safe to grade against.
    }
    return config;
}

export async function resolvePeriodForDate(date) {
    const value = String(date || '').slice(0, 10);
    if (!value) return null;
    try {
        const period = await queryOne(
            `SELECT id, name FROM academic_periods
             WHERE start_date IS NOT NULL AND end_date IS NOT NULL
               AND start_date <= ? AND end_date >= ?
             ORDER BY start_date DESC LIMIT 1`,
            [value, value]
        );
        return period || null;
    } catch {
        return null;
    }
}

export async function getPeriodRange(periodId) {
    const id = parseInt(periodId, 10);
    if (!Number.isFinite(id)) return null;
    const period = await queryOne('SELECT id, name, start_date, end_date FROM academic_periods WHERE id = ?', [id]);
    if (!period) return null;
    return {
        ...period,
        start_date: period.start_date ? toDateOnly(period.start_date) : null,
        end_date: period.end_date ? toDateOnly(period.end_date) : null,
    };
}
