import { query, queryOne, run } from '../config/database.js';
import {
    getAttendanceConfig,
    normalizeStatus,
    getPeriodRange,
    attendanceRate,
    attendanceBand,
    emptyCounts,
    countStatus,
    toDateOnly,
} from '../utils/attendance.js';

const today = () => new Date().toISOString().slice(0, 10);

const dateOnly = toDateOnly;

const isAdminRole = (role) => ['admin', 'superadmin'].includes(String(role || '').toLowerCase().trim());

async function findFacultyForUser(user) {
    const email = String(user?.email || '').toLowerCase().trim();
    if (!email) return null;
    return queryOne(
        'SELECT id, name, email, department, position, status FROM faculty WHERE LOWER(email) = LOWER(?)',
        [email]
    );
}

async function resolveTargetFaculty({ faculty_id, trainer_email }, fallback) {
    if (faculty_id) {
        const byId = await queryOne(
            'SELECT id, name, email, department FROM faculty WHERE id = ?',
            [String(faculty_id)]
        );
        if (byId) return byId;
    }
    if (trainer_email) {
        const byEmail = await queryOne(
            'SELECT id, name, email, department FROM faculty WHERE LOWER(email) = LOWER(?)',
            [String(trainer_email).toLowerCase().trim()]
        );
        if (byEmail) return byEmail;
    }
    return fallback || null;
}

async function upsertTrainerAttendance({ faculty, date, status, notes, markedBy }) {
    const existing = await queryOne(
        'SELECT id FROM trainer_attendance WHERE faculty_id = ? AND date = ?',
        [faculty.id, date]
    );
    if (existing) {
        await run(
            `UPDATE trainer_attendance
             SET status = ?, notes = ?, trainer_name = ?, trainer_email = ?, department = ?, marked_by = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [status, notes || '', faculty.name, faculty.email || '', faculty.department || '', markedBy, existing.id]
        );
        return queryOne('SELECT * FROM trainer_attendance WHERE id = ?', [existing.id]);
    }
    const result = await run(
        `INSERT INTO trainer_attendance (faculty_id, trainer_name, trainer_email, department, date, status, notes, marked_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [faculty.id, faculty.name, faculty.email || '', faculty.department || '', date, status, notes || '', markedBy]
    );
    return queryOne('SELECT * FROM trainer_attendance WHERE id = ?', [result.lastID]);
}

/**
 * GET /trainer-attendance
 * Trainers see their own history; admins can filter by trainer, department or date range.
 */
export async function getAllTrainerAttendance(req, res) {
    try {
        const { role, email } = req.user;
        const { date, from, to, trainer_email, department, month } = req.query;

        const conditions = [];
        const params = [];

        if (!isAdminRole(role)) {
            conditions.push('LOWER(ta.trainer_email) = LOWER(?)');
            params.push(String(email || '').trim());
        } else if (trainer_email) {
            conditions.push('LOWER(ta.trainer_email) = LOWER(?)');
            params.push(String(trainer_email).trim());
        }
        if (department) {
            conditions.push('LOWER(ta.department) = LOWER(?)');
            params.push(String(department).trim());
        }
        if (date) {
            conditions.push('ta.date = ?');
            params.push(dateOnly(date));
        }
        if (month) {
            const [year, mon] = String(month).split('-').map(Number);
            if (Number.isFinite(year) && Number.isFinite(mon)) {
                const lastDay = new Date(year, mon, 0).getDate();
                conditions.push('ta.date >= ? AND ta.date <= ?');
                params.push(`${month}-01`, `${month}-${String(lastDay).padStart(2, '0')}`);
            }
        }
        if (from) { conditions.push('ta.date >= ?'); params.push(dateOnly(from)); }
        if (to) { conditions.push('ta.date <= ?'); params.push(dateOnly(to)); }

        const rows = await query(
            `SELECT ta.* FROM trainer_attendance ta
             ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
             ORDER BY ta.date DESC, ta.trainer_name ASC
             LIMIT 500`,
            params
        );
        return res.json(rows);
    } catch (error) {
        console.error('Get trainer attendance error:', error);
        return res.status(500).json({ error: 'Failed to fetch trainer attendance' });
    }
}

/**
 * GET /trainer-attendance/roster?date=YYYY-MM-DD
 * Faculty list joined with that day's register, ready to render a register.
 */
export async function getTrainerAttendanceRoster(req, res) {
    try {
        const { role, email } = req.user;
        const date = dateOnly(req.query.date) || today();

        if (!isAdminRole(role)) {
            const faculty = await findFacultyForUser(req.user);
            if (!faculty) return res.status(404).json({ error: 'No trainer profile is linked to your account.' });
            const record = await queryOne(
                'SELECT * FROM trainer_attendance WHERE faculty_id = ? AND date = ?',
                [faculty.id, date]
            );
            return res.json({
                date,
                self: true,
                entries: [{
                    faculty_id: faculty.id,
                    trainer_name: faculty.name,
                    trainer_email: faculty.email,
                    department: faculty.department,
                    status: record?.status || null,
                    notes: record?.notes || '',
                    record_id: record?.id || null,
                }],
            });
        }

        const facultyRows = await query(
            `SELECT id, name, email, department, position, status
             FROM faculty
             WHERE LOWER(COALESCE(status, 'Active')) <> 'inactive'
             ORDER BY name ASC`
        );
        const records = await query(
            'SELECT * FROM trainer_attendance WHERE date = ?',
            [date]
        );
        const byFaculty = new Map(records.map(r => [String(r.faculty_id), r]));

        return res.json({
            date,
            self: false,
            entries: facultyRows.map(f => {
                const record = byFaculty.get(String(f.id));
                return {
                    faculty_id: f.id,
                    trainer_name: f.name,
                    trainer_email: f.email,
                    department: f.department,
                    position: f.position,
                    status: record?.status || null,
                    notes: record?.notes || '',
                    record_id: record?.id || null,
                };
            }),
        });
    } catch (error) {
        console.error('Trainer roster error:', error);
        return res.status(500).json({ error: 'Failed to build trainer roster' });
    }
}

/**
 * POST /trainer-attendance
 * Trainers may check themselves in for today; admins may record anyone, any date.
 */
export async function markTrainerAttendance(req, res) {
    try {
        const { role, email, name } = req.user;
        const admin = isAdminRole(role);
        const config = await getAttendanceConfig();
        const status = normalizeStatus(req.body?.status, config.statuses);
        if (!status) {
            return res.status(400).json({ error: `Invalid status. Must be one of: ${config.statuses.join(', ')}` });
        }

        const date = dateOnly(req.body?.date) || today();
        if (!admin) {
            if (date !== today()) {
                return res.status(403).json({ error: 'You can only check in for today.' });
            }
            if (!['Present', 'Late'].includes(status)) {
                return res.status(403).json({ error: 'Self check-in only supports Present or Late.' });
            }
        }

        const self = admin ? null : await findFacultyForUser(req.user);
        if (!admin && !self) {
            return res.status(404).json({ error: 'No trainer profile is linked to your account.' });
        }
        const faculty = admin
            ? await resolveTargetFaculty(req.body || {}, null)
            : self;
        if (!faculty) return res.status(400).json({ error: 'Select a trainer to mark.' });

        const record = await upsertTrainerAttendance({
            faculty,
            date,
            status,
            notes: req.body?.notes,
            markedBy: name || email || 'system',
        });
        return res.status(201).json(record);
    } catch (error) {
        console.error('Mark trainer attendance error:', error);
        return res.status(500).json({ error: 'Failed to save trainer attendance' });
    }
}

/**
 * POST /trainer-attendance/batch  (admin)
 * Body: { date, entries: [{ faculty_id, status, notes }] }
 */
export async function markTrainerAttendanceBatch(req, res) {
    try {
        const { role, name, email } = req.user;
        if (!isAdminRole(role)) return res.status(403).json({ error: 'Only administrators can save the trainer register.' });

        const { date, entries } = req.body || {};
        if (!date || !Array.isArray(entries) || entries.length === 0) {
            return res.status(400).json({ error: 'date and a non-empty entries array are required' });
        }
        if (entries.length > 200) return res.status(400).json({ error: 'A trainer register can hold at most 200 entries' });

        const config = await getAttendanceConfig();
        const saved = [];
        const skipped = [];

        for (const entry of entries) {
            const status = normalizeStatus(entry?.status, config.statuses);
            const faculty = await resolveTargetFaculty({ faculty_id: entry?.faculty_id }, null);
            if (!faculty || !status) {
                skipped.push({ faculty_id: entry?.faculty_id, status: entry?.status, reason: 'unknown trainer or status' });
                continue;
            }
            await upsertTrainerAttendance({
                faculty,
                date: dateOnly(date),
                status,
                notes: entry?.notes,
                markedBy: name || email || 'system',
            });
            saved.push({ faculty_id: faculty.id, status });
        }

        return res.status(201).json({ date: dateOnly(date), saved: saved.length, skipped });
    } catch (error) {
        console.error('Batch trainer attendance error:', error);
        return res.status(500).json({ error: 'Failed to save trainer register' });
    }
}

export async function updateTrainerAttendance(req, res) {
    try {
        const { role } = req.user;
        const record = await queryOne('SELECT * FROM trainer_attendance WHERE id = ?', [req.params.id]);
        if (!record) return res.status(404).json({ error: 'Trainer attendance record not found' });

        if (!isAdminRole(role)) {
            const self = await findFacultyForUser(req.user);
            if (!self || String(self.id) !== String(record.faculty_id)) {
                return res.status(403).json({ error: 'You can only edit your own attendance.' });
            }
            if (record.date && dateOnly(record.date) !== today()) {
                return res.status(403).json({ error: 'Only today\'s check-in can be edited.' });
            }
        }

        const config = await getAttendanceConfig();
        const status = normalizeStatus(req.body?.status, config.statuses);
        if (!status) {
            return res.status(400).json({ error: `Invalid status. Must be one of: ${config.statuses.join(', ')}` });
        }
        if (!isAdminRole(role) && !['Present', 'Late'].includes(status)) {
            return res.status(403).json({ error: 'Self check-in only supports Present or Late.' });
        }

        await run(
            'UPDATE trainer_attendance SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [status, req.body?.notes ?? record.notes ?? '', req.params.id]
        );
        return res.json(await queryOne('SELECT * FROM trainer_attendance WHERE id = ?', [req.params.id]));
    } catch (error) {
        console.error('Update trainer attendance error:', error);
        return res.status(500).json({ error: 'Failed to update trainer attendance' });
    }
}

export async function deleteTrainerAttendance(req, res) {
    try {
        const result = await run('DELETE FROM trainer_attendance WHERE id = ?', [req.params.id]);
        if (result.changes === 0) return res.status(404).json({ error: 'Trainer attendance record not found' });
        return res.json({ message: 'Trainer attendance record deleted' });
    } catch (error) {
        console.error('Delete trainer attendance error:', error);
        return res.status(500).json({ error: 'Failed to delete trainer attendance' });
    }
}

/**
 * GET /trainer-attendance/summary?month=YYYY-MM | academic_period_id=
 * Per-trainer counts and attendance percentage for the selected window.
 */
export async function getTrainerAttendanceSummary(req, res) {
    try {
        const { role } = req.user;
        const { month, from, to, academic_period_id } = req.query;
        const config = await getAttendanceConfig();

        let rangeStart = from ? dateOnly(from) : '';
        let rangeEnd = to ? dateOnly(to) : '';
        let period = null;

        if (academic_period_id) {
            period = await getPeriodRange(academic_period_id);
            if (!period) return res.status(404).json({ error: 'Academic period not found' });
            rangeStart = period.start_date;
            rangeEnd = period.end_date;
        } else if (month && !rangeStart && !rangeEnd) {
            const [year, mon] = String(month).split('-').map(Number);
            if (Number.isFinite(year) && Number.isFinite(mon)) {
                const lastDay = new Date(year, mon, 0).getDate();
                rangeStart = `${month}-01`;
                rangeEnd = `${month}-${String(lastDay).padStart(2, '0')}`;
            }
        }

        const conditions = [];
        const params = [];
        if (rangeStart) { conditions.push('ta.date >= ?'); params.push(rangeStart); }
        if (rangeEnd) { conditions.push('ta.date <= ?'); params.push(rangeEnd); }
        if (!isAdminRole(role)) {
            conditions.push('LOWER(ta.trainer_email) = LOWER(?)');
            params.push(String(req.user.email || '').trim());
        }

        const rows = await query(
            `SELECT ta.trainer_name, ta.trainer_email, ta.department, ta.status
             FROM trainer_attendance ta
             ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}`,
            params
        );

        const buckets = new Map();
        for (const row of rows) {
            const key = String(row.trainer_email || row.trainer_name || '').toLowerCase();
            if (!buckets.has(key)) {
                buckets.set(key, {
                    trainer_name: row.trainer_name,
                    trainer_email: row.trainer_email,
                    department: row.department,
                    ...emptyCounts(),
                });
            }
            countStatus(buckets.get(key), row.status);
        }

        const result = Array.from(buckets.values()).map(b => {
            const percentage = attendanceRate(b);
            return {
                ...b,
                percentage,
                band: attendanceBand(percentage, config.thresholds),
                below_threshold: percentage < config.threshold,
            };
        });
        result.sort((a, b) => a.trainer_name.localeCompare(b.trainer_name));

        return res.json({
            range: { from: rangeStart || null, to: rangeEnd || null },
            period: period ? { id: period.id, name: period.name } : null,
            threshold: config.threshold,
            trainers: result,
        });
    } catch (error) {
        console.error('Trainer attendance summary error:', error);
        return res.status(500).json({ error: 'Failed to generate trainer attendance summary' });
    }
}
