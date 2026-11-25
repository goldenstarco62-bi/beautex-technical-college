import { query, queryOne, run } from '../config/database.js';
import logger from '../utils/logger.js';

// CATs inherit the active academic period unless one is chosen explicitly, so
// every assessment is attached to the same term reference as its offering.
// A typed term name is matched to a period first; unmatched terms stay unlinked.
async function resolveAcademicPeriod(value, nameHint) {
    if (value !== undefined && value !== null && value !== '') {
        const period = await queryOne('SELECT * FROM academic_periods WHERE id = ?', [value]);
        return period ? { period, error: null } : { period: null, error: 'Academic period not found.' };
    }
    if (nameHint) {
        const period = await queryOne(
            'SELECT * FROM academic_periods WHERE LOWER(name) = LOWER(?) ORDER BY id DESC LIMIT 1',
            [String(nameHint).trim()]
        );
        return { period: period || null, error: null };
    }
    const period = await queryOne(
        'SELECT * FROM academic_periods WHERE is_active = ? ORDER BY start_date DESC LIMIT 1', [true]
    );
    return { period: period || null, error: null };
}

const periodYear = (period) =>
    period?.start_date ? String(new Date(period.start_date).getFullYear()) : null;

/**
 * GET /cat-periods — List all CAT periods (optionally filtered)
 */
export async function getCatPeriods(req, res) {
    try {
        const { academic_year, status } = req.query;
        let sql = 'SELECT * FROM cat_periods WHERE 1=1';
        const params = [];

        if (academic_year) {
            sql += ' AND academic_year = ?';
            params.push(academic_year);
        }
        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }

        sql += ' ORDER BY created_at DESC';
        const periods = await query(sql, params);
        return res.json(periods || []);
    } catch (err) {
        logger.error({ err }, 'getCatPeriods error');
        return res.status(500).json({ error: 'Failed to fetch CAT periods.' });
    }
}

/**
 * POST /cat-periods — Create a new CAT period
 */
export async function createCatPeriod(req, res) {
    try {
        const {
            academic_year, term_name, cat_name, month,
            max_marks, start_date, end_date, status, academic_period_id
        } = req.body;

        const { period, error: periodError } = await resolveAcademicPeriod(academic_period_id, term_name);
        if (periodError) return res.status(400).json({ error: periodError });

        const finalYear = academic_year || periodYear(period);
        const finalTerm = term_name || period?.name || null;

        if (!finalYear || !finalTerm || !cat_name) {
            return res.status(400).json({ error: 'academic_year, term_name and cat_name are required.' });
        }

        const result = await run(
            `INSERT INTO cat_periods (academic_year, term_name, cat_name, month, max_marks, start_date, end_date, status, academic_period_id, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                finalYear, finalTerm, cat_name,
                month || null,
                parseFloat(max_marks) || 100,
                start_date || null, end_date || null,
                status || 'Active',
                period?.id || null,
                req.user?.email || req.user?.id
            ]
        );

        const created = await queryOne('SELECT * FROM cat_periods WHERE id = ?', [result.lastID]);
        return res.status(201).json(created);
    } catch (err) {
        logger.error({ err }, 'createCatPeriod error');
        return res.status(500).json({ error: 'Failed to create CAT period.' });
    }
}

/**
 * PUT /cat-periods/:id — Update a CAT period
 */
export async function updateCatPeriod(req, res) {
    try {
        const { id } = req.params;
        const {
            academic_year, term_name, cat_name, month,
            max_marks, start_date, end_date, status, academic_period_id
        } = req.body;

        const existing = await queryOne('SELECT * FROM cat_periods WHERE id = ?', [id]);
        if (!existing) return res.status(404).json({ error: 'CAT period not found.' });

        let nextPeriodId = existing.academic_period_id ?? null;
        if (academic_period_id !== undefined) {
            if (!academic_period_id) {
                nextPeriodId = null;
            } else {
                const { period, error: periodError } = await resolveAcademicPeriod(academic_period_id);
                if (periodError) return res.status(400).json({ error: periodError });
                nextPeriodId = period.id;
            }
        } else if (term_name) {
            const { period } = await resolveAcademicPeriod(undefined, term_name);
            nextPeriodId = period?.id || null;
        }

        await run(
            `UPDATE cat_periods SET
                academic_year = ?, term_name = ?, cat_name = ?, month = ?,
                max_marks = ?, start_date = ?, end_date = ?, status = ?,
                academic_period_id = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [
                academic_year ?? existing.academic_year,
                term_name ?? existing.term_name,
                cat_name ?? existing.cat_name,
                month !== undefined ? month : existing.month,
                // Form inputs submit empty strings for unset values; Postgres
                // rejects '' for date/numeric columns, so normalize them.
                max_marks !== undefined ? (parseFloat(max_marks) || existing.max_marks) : existing.max_marks,
                start_date !== undefined ? (start_date || null) : existing.start_date,
                end_date !== undefined ? (end_date || null) : existing.end_date,
                status ?? existing.status,
                nextPeriodId,
                id
            ]
        );

        const updated = await queryOne('SELECT * FROM cat_periods WHERE id = ?', [id]);
        return res.json(updated);
    } catch (err) {
        logger.error({ err }, 'updateCatPeriod error');
        return res.status(500).json({ error: 'Failed to update CAT period.' });
    }
}

/**
 * DELETE /cat-periods/:id — Delete a CAT period (only if no results attached)
 */
export async function deleteCatPeriod(req, res) {
    try {
        const { id } = req.params;
        const existing = await queryOne('SELECT * FROM cat_periods WHERE id = ?', [id]);
        if (!existing) return res.status(404).json({ error: 'CAT period not found.' });

        // Check for any results attached
        const resultsCount = await queryOne(
            'SELECT COUNT(*) as cnt FROM cat_results WHERE cat_period_id = ?', [id]
        );
        if (resultsCount?.cnt > 0) {
            return res.status(400).json({
                error: `Cannot delete this period — it has ${resultsCount.cnt} result(s) associated. Close the period instead.`
            });
        }

        await run('DELETE FROM cat_periods WHERE id = ?', [id]);
        return res.json({ message: 'CAT period deleted successfully.' });
    } catch (err) {
        logger.error({ err }, 'deleteCatPeriod error');
        return res.status(500).json({ error: 'Failed to delete CAT period.' });
    }
}
