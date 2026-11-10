import crypto from 'crypto';
import { query, queryOne, run, getActiveDbEngine } from '../config/database.js';
import logger from '../utils/logger.js';

const STATUSES = [
    'Submitted', 'Under Review', 'Shortlisted', 'Offered',
    'Accepted', 'Enrolled', 'Rejected', 'Withdrawn'
];

// Enrolled is reachable only through the conversion flow, not a manual status change.
const ALLOWED_TRANSITIONS = {
    'Submitted': ['Under Review', 'Shortlisted', 'Rejected', 'Withdrawn'],
    'Under Review': ['Shortlisted', 'Rejected', 'Withdrawn'],
    'Shortlisted': ['Offered', 'Rejected', 'Withdrawn'],
    'Offered': ['Accepted', 'Rejected', 'Withdrawn'],
    'Accepted': ['Withdrawn'],
    'Enrolled': [],
    'Rejected': ['Under Review'],
    'Withdrawn': ['Under Review'],
};

const REGISTRATION_TYPES = ['Diploma', 'Short Course'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isPostgres = () => getActiveDbEngine() === 'postgres';
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const nullable = (v) => {
    const s = str(v);
    return s === '' ? null : s;
};
const parseCount = (row) => parseInt(row?.count ?? row?.COUNT ?? 0, 10) || 0;
const searchTerm = (v) => str(v).replace(/[%_\\]/g, '');

function monthStartParam() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    if (isPostgres()) return start.toISOString();
    const pad = (n) => String(n).padStart(2, '0');
    return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())} 00:00:00`;
}

async function getAdmissionsSettings() {
    const rows = await query("SELECT key, value FROM system_settings WHERE key LIKE 'admissions_%'");
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    return {
        numberFormat: map.admissions_number_format || 'APP/{YEAR}/{SEQ}',
        maxDocMb: Math.max(1, parseInt(map.admissions_document_max_mb, 10) || 2),
        offerValidDays: Math.max(1, parseInt(map.admissions_offer_valid_days, 10) || 14),
    };
}

async function generateApplicantNumber(template) {
    const year = new Date().getFullYear();
    const yearRow = await queryOne('SELECT COUNT(*) AS count FROM applicants WHERE created_at >= ?', [`${year}-01-01`]);
    let seq = parseCount(yearRow) + 1;
    const base = template.replace(/\{YEAR\}/g, String(year));

    for (let attempt = 0; attempt < 100; attempt++) {
        const padded = String(seq).padStart(3, '0');
        const candidate = base.includes('{SEQ}')
            ? base.replace(/\{SEQ\}/g, padded)
            : `${base}-${padded}`;
        const existing = await queryOne('SELECT id FROM applicants WHERE applicant_number = ?', [candidate]);
        if (!existing) return candidate;
        seq += 1;
    }
    throw new Error('Unable to allocate a unique applicant number');
}

function isUniqueViolation(err) {
    return err?.code === '23505' || /UNIQUE constraint failed/i.test(err?.message || '');
}

function mapDocument(row) {
    return {
        id: row.id,
        applicant_id: row.applicant_id,
        doc_type: row.doc_type,
        filename: row.filename,
        mime_type: row.mime_type,
        file_size: row.file_size,
        verified: !!row.verified,
        uploaded_at: row.uploaded_at,
    };
}

function applicantView(row) {
    if (!row) return row;
    const offerExpired = row.status === 'Offered'
        && row.offer_expires_at
        && new Date(row.offer_expires_at).getTime() < Date.now();
    return { ...row, offer_expired: !!offerExpired };
}

async function resolveProgramme(programmeId) {
    if (!programmeId) return null;
    return queryOne('SELECT id, name FROM courses WHERE id = ?', [programmeId]);
}

function validateRegistrationType(value) {
    const type = str(value) || 'Diploma';
    return REGISTRATION_TYPES.includes(type) ? type : null;
}

export async function listApplicants(req, res) {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
        const offset = (page - 1) * limit;

        const where = [];
        const params = [];

        if (req.query.status) {
            const status = str(req.query.status);
            if (!STATUSES.includes(status)) {
                return res.status(400).json({ error: `Unknown status "${status}".`, statuses: STATUSES });
            }
            where.push('status = ?');
            params.push(status);
        }
        if (req.query.intake) {
            where.push('intake = ?');
            params.push(str(req.query.intake));
        }
        if (req.query.programme_id) {
            where.push('programme_id = ?');
            params.push(str(req.query.programme_id));
        }
        const term = searchTerm(req.query.q);
        if (term) {
            const op = isPostgres() ? 'ILIKE' : 'LIKE';
            const like = `%${term}%`;
            where.push(`(full_name ${op} ? OR email ${op} ? OR phone ${op} ? OR applicant_number ${op} ?)`);
            params.push(like, like, like, like);
        }

        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const totalRow = await queryOne(`SELECT COUNT(*) AS count FROM applicants ${whereSql}`, params);
        const total = parseCount(totalRow);

        const applicants = await query(`
            SELECT id, applicant_number, full_name, email, phone, gender, dob,
                   programme_id, programme_name, intake, registration_type,
                   prior_school, prior_qualification, guardian_name, guardian_phone,
                   address, source, status, reviewer_id, reviewer_name, notes,
                   offer_token, offered_at, offer_expires_at, decided_at,
                   converted_student_id, submitted_at, created_at, updated_at
            FROM applicants
            ${whereSql}
            ORDER BY submitted_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        res.json({
            applicants: applicants.map(applicantView),
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        logger.error({ err: error }, 'List applicants failed');
        res.status(500).json({ error: 'Failed to fetch applicants' });
    }
}

export async function getApplicant(req, res) {
    try {
        const applicant = await queryOne('SELECT * FROM applicants WHERE id = ?', [req.params.id]);
        if (!applicant) return res.status(404).json({ error: 'Applicant not found' });

        const documents = await query(
            `SELECT id, applicant_id, doc_type, filename, mime_type, file_size, verified, uploaded_at
             FROM applicant_documents WHERE applicant_id = ? ORDER BY uploaded_at DESC`,
            [req.params.id]
        );

        res.json({ ...applicantView(applicant), documents: documents.map(mapDocument) });
    } catch (error) {
        logger.error({ err: error }, 'Get applicant failed');
        res.status(500).json({ error: 'Failed to fetch applicant' });
    }
}

export async function createApplicant(req, res) {
    try {
        const fullName = str(req.body.full_name);
        const email = str(req.body.email).toLowerCase();
        const programmeId = str(req.body.programme_id);
        const programmeNameInput = str(req.body.programme_name);

        if (!fullName) return res.status(400).json({ error: 'Full name is required' });
        if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email address is required' });
        if (!programmeId && !programmeNameInput) {
            return res.status(400).json({ error: 'A programme is required' });
        }

        const registrationType = validateRegistrationType(req.body.registration_type);
        if (!registrationType) {
            return res.status(400).json({ error: `Registration type must be one of: ${REGISTRATION_TYPES.join(', ')}` });
        }

        let programmeName = programmeNameInput || null;
        if (programmeId) {
            const programme = await resolveProgramme(programmeId);
            if (!programme) return res.status(400).json({ error: 'The selected programme does not exist' });
            programmeName = programme.name;
        }

        const intake = nullable(req.body.intake);

        const duplicate = await queryOne(
            `SELECT id, applicant_number FROM applicants
             WHERE email = ? AND COALESCE(programme_id, '') = ? AND COALESCE(intake, '') = ?
               AND status NOT IN ('Rejected', 'Withdrawn')
             ORDER BY created_at DESC LIMIT 1`,
            [email, programmeId, intake || '']
        );
        if (duplicate) {
            return res.status(409).json({
                error: `An active application already exists for this email (${duplicate.applicant_number}).`,
                applicant_id: duplicate.id,
            });
        }

        const { numberFormat } = await getAdmissionsSettings();
        const id = crypto.randomUUID();
        const source = nullable(req.body.source) || 'Walk-in';

        let applicantNumber = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            applicantNumber = await generateApplicantNumber(numberFormat);
            try {
                await run(
                    `INSERT INTO applicants (
                        id, applicant_number, full_name, email, phone, gender, dob,
                        programme_id, programme_name, intake, registration_type,
                        prior_school, prior_qualification, guardian_name, guardian_phone,
                        address, source, status, submitted_at
                     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Submitted', CURRENT_TIMESTAMP)`,
                    [
                        id, applicantNumber, fullName, email, nullable(req.body.phone),
                        nullable(req.body.gender), nullable(req.body.dob),
                        programmeId || null, programmeName, intake, registrationType,
                        nullable(req.body.prior_school), nullable(req.body.prior_qualification),
                        nullable(req.body.guardian_name), nullable(req.body.guardian_phone),
                        nullable(req.body.address), source,
                    ]
                );
                break;
            } catch (err) {
                if (!isUniqueViolation(err) || attempt === 2) throw err;
            }
        }

        const applicant = await queryOne('SELECT * FROM applicants WHERE id = ?', [id]);
        res.status(201).json({ message: 'Application created', applicant: applicantView(applicant) });
    } catch (error) {
        logger.error({ err: error }, 'Create applicant failed');
        res.status(500).json({ error: 'Failed to create application' });
    }
}

export async function updateApplicant(req, res) {
    try {
        const existing = await queryOne('SELECT * FROM applicants WHERE id = ?', [req.params.id]);
        if (!existing) return res.status(404).json({ error: 'Applicant not found' });

        const sets = [];
        const params = [];
        const canEdit = (key) => Object.prototype.hasOwnProperty.call(req.body, key);
        const add = (column, value) => {
            sets.push(`${column} = ?`);
            params.push(value);
        };

        if (canEdit('full_name')) {
            const fullName = str(req.body.full_name);
            if (!fullName) return res.status(400).json({ error: 'Full name cannot be empty' });
            add('full_name', fullName);
        }
        if (canEdit('email')) {
            const email = str(req.body.email).toLowerCase();
            if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email address is required' });
            add('email', email);
        }
        if (canEdit('registration_type')) {
            const type = validateRegistrationType(req.body.registration_type);
            if (!type) {
                return res.status(400).json({ error: `Registration type must be one of: ${REGISTRATION_TYPES.join(', ')}` });
            }
            add('registration_type', type);
        }
        if (canEdit('programme_id')) {
            const programmeId = str(req.body.programme_id) || null;
            if (programmeId) {
                const programme = await resolveProgramme(programmeId);
                if (!programme) return res.status(400).json({ error: 'The selected programme does not exist' });
                add('programme_id', programmeId);
                add('programme_name', programme.name);
            } else {
                add('programme_id', null);
                add('programme_name', nullable(req.body.programme_name));
            }
        } else if (canEdit('programme_name')) {
            add('programme_name', nullable(req.body.programme_name));
        }

        const optionalFields = [
            'phone', 'gender', 'dob', 'intake', 'prior_school', 'prior_qualification',
            'guardian_name', 'guardian_phone', 'address', 'source', 'notes',
        ];
        for (const field of optionalFields) {
            if (canEdit(field)) add(field, nullable(req.body[field]));
        }

        if (sets.length === 0) return res.status(400).json({ error: 'No editable fields were provided' });

        sets.push('updated_at = CURRENT_TIMESTAMP');
        await run(`UPDATE applicants SET ${sets.join(', ')} WHERE id = ?`, [...params, req.params.id]);

        const applicant = await queryOne('SELECT * FROM applicants WHERE id = ?', [req.params.id]);
        res.json({ message: 'Application updated', applicant: applicantView(applicant) });
    } catch (error) {
        logger.error({ err: error }, 'Update applicant failed');
        res.status(500).json({ error: 'Failed to update application' });
    }
}

export async function updateApplicantStatus(req, res) {
    try {
        const next = str(req.body.status);
        if (!STATUSES.includes(next)) {
            return res.status(400).json({ error: `Unknown status "${next}".`, statuses: STATUSES });
        }
        if (next === 'Enrolled') {
            return res.status(400).json({ error: 'Applicants become Enrolled through the conversion flow, not a status change.' });
        }

        const existing = await queryOne('SELECT * FROM applicants WHERE id = ?', [req.params.id]);
        if (!existing) return res.status(404).json({ error: 'Applicant not found' });

        if (existing.status === next) {
            return res.json({ message: 'Status unchanged', applicant: applicantView(existing) });
        }

        const allowed = ALLOWED_TRANSITIONS[existing.status] || [];
        if (!allowed.includes(next)) {
            return res.status(409).json({
                error: `Cannot move an application from "${existing.status}" to "${next}".`,
                allowed,
            });
        }

        const sets = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
        const params = [next];

        if (next === 'Under Review') {
            sets.push('reviewer_id = ?', 'reviewer_name = ?');
            params.push(req.user.id, req.user.name || req.user.email || null);
        }
        if (next === 'Offered') {
            const { offerValidDays } = await getAdmissionsSettings();
            const expiresAt = new Date(Date.now() + offerValidDays * 24 * 60 * 60 * 1000);
            sets.push('offer_token = ?', 'offered_at = CURRENT_TIMESTAMP', 'offer_expires_at = ?', 'decided_at = NULL');
            params.push(crypto.randomBytes(24).toString('hex'), expiresAt.toISOString());
        }
        if (next === 'Rejected' || next === 'Withdrawn') {
            sets.push('decided_at = CURRENT_TIMESTAMP');
        }

        if (Object.prototype.hasOwnProperty.call(req.body, 'notes')) {
            sets.push('notes = ?');
            params.push(nullable(req.body.notes));
        }

        await run(`UPDATE applicants SET ${sets.join(', ')} WHERE id = ?`, [...params, req.params.id]);

        const applicant = await queryOne('SELECT * FROM applicants WHERE id = ?', [req.params.id]);
        res.json({ message: `Application moved to ${next}`, applicant: applicantView(applicant) });
    } catch (error) {
        logger.error({ err: error }, 'Update applicant status failed');
        res.status(500).json({ error: 'Failed to update application status' });
    }
}

export async function deleteApplicant(req, res) {
    try {
        const existing = await queryOne('SELECT id, status, converted_student_id FROM applicants WHERE id = ?', [req.params.id]);
        if (!existing) return res.status(404).json({ error: 'Applicant not found' });

        if (existing.converted_student_id) {
            return res.status(409).json({ error: 'This applicant has already been enrolled and cannot be deleted.' });
        }
        if (['Offered', 'Accepted'].includes(existing.status)) {
            return res.status(409).json({ error: 'Withdraw the application instead of deleting it.' });
        }

        await run('DELETE FROM applicant_documents WHERE applicant_id = ?', [req.params.id]);
        await run('DELETE FROM applicants WHERE id = ?', [req.params.id]);
        res.json({ message: 'Application deleted' });
    } catch (error) {
        logger.error({ err: error }, 'Delete applicant failed');
        res.status(500).json({ error: 'Failed to delete application' });
    }
}

async function findApplicantOr404(req, res) {
    const applicant = await queryOne('SELECT id FROM applicants WHERE id = ?', [req.params.id]);
    if (!applicant) {
        res.status(404).json({ error: 'Applicant not found' });
        return null;
    }
    return applicant;
}

export async function listDocuments(req, res) {
    try {
        const applicant = await findApplicantOr404(req, res);
        if (!applicant) return;

        const documents = await query(
            `SELECT id, applicant_id, doc_type, filename, mime_type, file_size, verified, uploaded_at
             FROM applicant_documents WHERE applicant_id = ? ORDER BY uploaded_at DESC`,
            [req.params.id]
        );
        res.json({ documents: documents.map(mapDocument) });
    } catch (error) {
        logger.error({ err: error }, 'List applicant documents failed');
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
}

export async function uploadDocument(req, res) {
    try {
        const applicant = await findApplicantOr404(req, res);
        if (!applicant) return;

        const docType = str(req.body.doc_type);
        if (!docType) return res.status(400).json({ error: 'Document type is required' });
        if (!req.file) return res.status(400).json({ error: 'A file is required' });

        const { maxDocMb } = await getAdmissionsSettings();
        const maxBytes = maxDocMb * 1024 * 1024;
        if (req.file.size > maxBytes) {
            return res.status(413).json({ error: `Document exceeds the ${maxDocMb} MB limit.` });
        }

        const id = crypto.randomUUID();
        await run(
            `INSERT INTO applicant_documents (id, applicant_id, doc_type, filename, mime_type, file_size, content)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, req.params.id, docType, req.file.originalname, req.file.mimetype, req.file.size,
             req.file.buffer.toString('base64')]
        );

        res.status(201).json({
            message: 'Document uploaded',
            document: {
                id,
                applicant_id: req.params.id,
                doc_type: docType,
                filename: req.file.originalname,
                mime_type: req.file.mimetype,
                file_size: req.file.size,
                verified: false,
                uploaded_at: new Date().toISOString(),
            },
        });
    } catch (error) {
        logger.error({ err: error }, 'Upload applicant document failed');
        res.status(500).json({ error: 'Failed to upload document' });
    }
}

export async function downloadDocument(req, res) {
    try {
        const row = await queryOne(
            'SELECT filename, mime_type, content FROM applicant_documents WHERE id = ? AND applicant_id = ?',
            [req.params.docId, req.params.id]
        );
        if (!row || !row.content) return res.status(404).json({ error: 'Document not found' });

        const buffer = Buffer.from(row.content, 'base64');
        const filename = row.filename || `${req.params.docId}.bin`;
        const asciiName = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');

        res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'private, no-store');
        res.send(buffer);
    } catch (error) {
        logger.error({ err: error }, 'Download applicant document failed');
        res.status(500).json({ error: 'Failed to download document' });
    }
}

export async function updateDocument(req, res) {
    try {
        if (!Object.prototype.hasOwnProperty.call(req.body, 'verified')) {
            return res.status(400).json({ error: 'The "verified" field is required' });
        }
        const verified = isPostgres() ? !!req.body.verified : (req.body.verified ? 1 : 0);
        const result = await run(
            'UPDATE applicant_documents SET verified = ? WHERE id = ? AND applicant_id = ?',
            [verified, req.params.docId, req.params.id]
        );
        if (!result || result.changes === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }
        res.json({ message: 'Document verification updated', verified: !!req.body.verified });
    } catch (error) {
        logger.error({ err: error }, 'Update applicant document failed');
        res.status(500).json({ error: 'Failed to update document' });
    }
}

export async function deleteDocument(req, res) {
    try {
        const result = await run(
            'DELETE FROM applicant_documents WHERE id = ? AND applicant_id = ?',
            [req.params.docId, req.params.id]
        );
        if (!result || result.changes === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }
        res.json({ message: 'Document deleted' });
    } catch (error) {
        logger.error({ err: error }, 'Delete applicant document failed');
        res.status(500).json({ error: 'Failed to delete document' });
    }
}

export async function getStats(req, res) {
    try {
        const statusRows = await query('SELECT status, COUNT(*) AS count FROM applicants GROUP BY status');
        const byStatus = Object.fromEntries(STATUSES.map(s => [s, 0]));
        for (const row of statusRows) {
            if (byStatus[row.status] !== undefined) byStatus[row.status] = parseCount(row);
        }
        const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);

        const monthRow = await queryOne('SELECT COUNT(*) AS count FROM applicants WHERE created_at >= ?', [monthStartParam()]);
        const intakeRows = await query(
            "SELECT COALESCE(intake, 'Unassigned') AS intake, COUNT(*) AS count FROM applicants GROUP BY intake ORDER BY count DESC"
        );
        const programmeRows = await query(
            "SELECT COALESCE(programme_name, 'Unassigned') AS programme, COUNT(*) AS count FROM applicants GROUP BY programme_name ORDER BY count DESC LIMIT 10"
        );

        res.json({
            total,
            thisMonth: parseCount(monthRow),
            byStatus,
            byIntake: intakeRows.map(r => ({ intake: r.intake, count: parseCount(r) })),
            byProgramme: programmeRows.map(r => ({ programme: r.programme, count: parseCount(r) })),
        });
    } catch (error) {
        logger.error({ err: error }, 'Applicant stats failed');
        res.status(500).json({ error: 'Failed to compute admissions statistics' });
    }
}
