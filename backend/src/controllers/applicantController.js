import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { query, queryOne, run, getActiveDbEngine } from '../config/database.js';
import { sendApplicationReceivedEmail, sendAdmissionsNotificationEmail } from '../services/emailService.js';
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
const PUBLIC_INTAKES = ['January Intake', 'May Intake', 'September Intake', 'Short Course'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+()\d\s-]{7,20}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Applicants may keep uploading while their application is live. Rejected,
// withdrawn and enrolled applications are read-only on the public portal.
const PORTAL_UPLOAD_STATUSES = ['Submitted', 'Under Review', 'Shortlisted', 'Offered', 'Accepted'];
const PORTAL_TOKEN_TTL_SECONDS = 30 * 60;
const MAX_PORTAL_DOCUMENTS = 12;

const isPostgres = () => getActiveDbEngine() === 'postgres';
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const nullable = (v) => {
    const s = str(v);
    return s === '' ? null : s;
};
const parseCount = (row) => parseInt(row?.count ?? row?.COUNT ?? 0, 10) || 0;
const searchTerm = (v) => str(v).replace(/[%_\\]/g, '');
const settingIsTrue = (v, fallback = false) => {
    if (v === undefined || v === null || v === '') return fallback;
    return ['true', '1', 'yes', 'on'].includes(String(v).toLowerCase());
};
const tooLong = (value, max) => str(value).length > max;

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
        applicationOpen: settingIsTrue(map.admissions_application_open, true),
        autoReply: settingIsTrue(map.admissions_auto_reply_enabled, true),
        notifyEmail: str(map.admissions_notify_email),
        requiredDocuments: str(map.admissions_required_documents)
            .split(',').map(s => s.trim()).filter(Boolean),
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
    return queryOne('SELECT id, name, status FROM courses WHERE id = ?', [programmeId]);
}

async function findActiveDuplicate(email, programmeId, intake) {
    return queryOne(
        `SELECT id, applicant_number FROM applicants
         WHERE email = ? AND COALESCE(programme_id, '') = ? AND COALESCE(intake, '') = ?
           AND status NOT IN ('Rejected', 'Withdrawn')
         ORDER BY created_at DESC LIMIT 1`,
        [email, programmeId || '', intake || '']
    );
}

async function insertApplication(fields) {
    const { numberFormat } = await getAdmissionsSettings();
    const id = crypto.randomUUID();

    for (let attempt = 0; attempt < 3; attempt++) {
        const applicantNumber = await generateApplicantNumber(numberFormat);
        try {
            await run(
                `INSERT INTO applicants (
                    id, applicant_number, full_name, email, phone, gender, dob,
                    programme_id, programme_name, intake, registration_type,
                    prior_school, prior_qualification, guardian_name, guardian_phone,
                    address, source, status, notes, submitted_at
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Submitted', ?, CURRENT_TIMESTAMP)`,
                [
                    id, applicantNumber, fields.fullName, fields.email, fields.phone,
                    fields.gender, fields.dob, fields.programmeId, fields.programmeName,
                    fields.intake, fields.registrationType, fields.priorSchool,
                    fields.priorQualification, fields.guardianName, fields.guardianPhone,
                    fields.address, fields.source, fields.notes,
                ]
            );
            return { id, applicantNumber };
        } catch (err) {
            if (!isUniqueViolation(err) || attempt === 2) throw err;
        }
    }
    throw new Error('Unable to allocate a unique applicant number');
}

function dispatchEmail(promise) {
    const job = promise
        .then(sent => { if (!sent) logger.warn('Admissions email was not delivered'); })
        .catch(err => logger.error({ err }, 'Admissions email failed'));
    // Vercel freezes the function once the response ends, so keep it alive.
    if (process.env.VERCEL) {
        import('@vercel/functions')
            .then(({ waitUntil }) => waitUntil(job))
            .catch(() => {});
    }
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

        const duplicate = await findActiveDuplicate(email, programmeId, intake);
        if (duplicate) {
            return res.status(409).json({
                error: `An active application already exists for this email (${duplicate.applicant_number}).`,
                applicant_id: duplicate.id,
            });
        }

        const { id } = await insertApplication({
            fullName,
            email,
            phone: nullable(req.body.phone),
            gender: nullable(req.body.gender),
            dob: nullable(req.body.dob),
            programmeId: programmeId || null,
            programmeName,
            intake,
            registrationType,
            priorSchool: nullable(req.body.prior_school),
            priorQualification: nullable(req.body.prior_qualification),
            guardianName: nullable(req.body.guardian_name),
            guardianPhone: nullable(req.body.guardian_phone),
            address: nullable(req.body.address),
            source: nullable(req.body.source) || 'Walk-in',
            notes: nullable(req.body.notes),
        });

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

// ─── Public admissions portal ────────────────────────────────────────────────

function publicApplicantView(row) {
    return {
        applicant_number: row.applicant_number,
        full_name: row.full_name,
        email: row.email,
        programme_name: row.programme_name,
        intake: row.intake,
        registration_type: row.registration_type,
        status: row.status,
        submitted_at: row.submitted_at,
    };
}

export async function getPublicAdmissionsInfo(req, res) {
    try {
        const settings = await getAdmissionsSettings();
        const programmes = await query(
            `SELECT id, name, programme_type, duration, department
             FROM courses WHERE status = 'Active'
             ORDER BY programme_type, name`
        );
        res.json({
            open: settings.applicationOpen,
            auto_reply: settings.autoReply,
            programmes,
            intakes: PUBLIC_INTAKES,
            registration_types: REGISTRATION_TYPES,
            required_documents: settings.requiredDocuments,
            max_document_mb: settings.maxDocMb,
        });
    } catch (error) {
        logger.error({ err: error }, 'Public admissions info failed');
        res.status(500).json({ error: 'Failed to load the application form' });
    }
}

export async function createPublicApplication(req, res) {
    try {
        const settings = await getAdmissionsSettings();
        if (!settings.applicationOpen) {
            return res.status(403).json({ error: 'Applications are currently closed. Please check back later.' });
        }
        // Hidden field: only bots fill it in.
        if (str(req.body.company_website)) {
            return res.status(400).json({ error: 'Invalid submission.' });
        }

        const fullName = str(req.body.full_name);
        const email = str(req.body.email).toLowerCase();
        const phone = str(req.body.phone);
        const programmeId = str(req.body.programme_id);
        const intake = str(req.body.intake);
        const dob = str(req.body.dob);

        if (!fullName) return res.status(400).json({ error: 'Full name is required' });
        if (tooLong(fullName, 120)) return res.status(400).json({ error: 'Full name is too long' });
        if (!EMAIL_RE.test(email) || tooLong(email, 254)) {
            return res.status(400).json({ error: 'A valid email address is required' });
        }
        if (!PHONE_RE.test(phone)) {
            return res.status(400).json({ error: 'A valid phone number is required' });
        }
        if (!programmeId) return res.status(400).json({ error: 'Please choose a programme' });
        if (!PUBLIC_INTAKES.includes(intake)) {
            return res.status(400).json({ error: `Intake must be one of: ${PUBLIC_INTAKES.join(', ')}` });
        }
        if (dob && (!DATE_RE.test(dob) || Number.isNaN(new Date(dob).getTime()) || new Date(dob).getTime() > Date.now())) {
            return res.status(400).json({ error: 'Date of birth is not valid' });
        }

        const fieldLimits = {
            gender: 30, prior_school: 160, prior_qualification: 120,
            guardian_name: 120, guardian_phone: 30, address: 240,
        };
        for (const [field, max] of Object.entries(fieldLimits)) {
            if (tooLong(req.body[field], max)) {
                return res.status(400).json({ error: `${field.replace(/_/g, ' ')} is too long` });
            }
        }

        const registrationType = validateRegistrationType(req.body.registration_type);
        if (!registrationType) {
            return res.status(400).json({ error: `Registration type must be one of: ${REGISTRATION_TYPES.join(', ')}` });
        }

        const programme = await resolveProgramme(programmeId);
        if (!programme || programme.status !== 'Active') {
            return res.status(400).json({ error: 'The selected programme is not open for applications.' });
        }

        const duplicate = await findActiveDuplicate(email, programmeId, intake);
        if (duplicate) {
            return res.status(409).json({
                error: 'An active application already exists for this email, programme and intake. Contact the admissions office if you need to make changes.',
            });
        }

        const { id, applicantNumber } = await insertApplication({
            fullName,
            email,
            phone,
            gender: nullable(req.body.gender),
            dob: nullable(dob),
            programmeId,
            programmeName: programme.name,
            intake,
            registrationType,
            priorSchool: nullable(req.body.prior_school),
            priorQualification: nullable(req.body.prior_qualification),
            guardianName: nullable(req.body.guardian_name),
            guardianPhone: nullable(req.body.guardian_phone),
            address: nullable(req.body.address),
            source: 'Online',
            notes: null,
        });

        const created = await queryOne('SELECT * FROM applicants WHERE id = ?', [id]);
        res.status(201).json({ message: 'Application submitted', applicant: publicApplicantView(created) });

        if (settings.autoReply) {
            dispatchEmail(sendApplicationReceivedEmail({
                email, fullName, applicantNumber,
                programmeName: programme.name, intake,
            }));
        }
        if (settings.notifyEmail) {
            dispatchEmail(sendAdmissionsNotificationEmail(settings.notifyEmail, {
                fullName, applicantNumber, email, phone,
                programmeName: programme.name, intake,
            }));
        }
    } catch (error) {
        logger.error({ err: error }, 'Public application submission failed');
        res.status(500).json({ error: 'Failed to submit the application. Please try again.' });
    }
}

// Portal tokens are scoped and signed with a derived secret so they can never
// be accepted by the staff authentication middleware.
function portalTokenSecret() {
    return `${process.env.JWT_SECRET || ''}::applicant-portal`;
}

function issuePortalToken(applicantId) {
    return jwt.sign(
        { sub: applicantId, scope: 'applicant-portal' },
        portalTokenSecret(),
        { expiresIn: PORTAL_TOKEN_TTL_SECONDS }
    );
}

function verifyPortalToken(req) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return null;
    try {
        const payload = jwt.verify(token, portalTokenSecret());
        return payload.scope === 'applicant-portal' ? payload.sub : null;
    } catch {
        return null;
    }
}

function publicDocumentView(row) {
    return {
        id: row.id,
        doc_type: row.doc_type,
        filename: row.filename,
        mime_type: row.mime_type,
        file_size: row.file_size,
        verified: !!row.verified,
        uploaded_at: row.uploaded_at,
    };
}

export async function trackApplication(req, res) {
    try {
        const applicantNumber = str(req.body.applicant_number);
        const email = str(req.body.email).toLowerCase();
        if (!applicantNumber || !EMAIL_RE.test(email)) {
            return res.status(400).json({ error: 'Enter your application number and the email you used to apply.' });
        }

        const applicant = await queryOne(
            `SELECT * FROM applicants
             WHERE LOWER(applicant_number) = LOWER(?) AND LOWER(email) = LOWER(?)`,
            [applicantNumber, email]
        );
        if (!applicant) {
            // Same message for "wrong number" and "wrong email" so the portal
            // cannot be used to probe which applications exist.
            return res.status(404).json({ error: 'No application matches that number and email address.' });
        }

        const settings = await getAdmissionsSettings();
        const documents = await query(
            `SELECT id, doc_type, filename, mime_type, file_size, verified, uploaded_at
             FROM applicant_documents WHERE applicant_id = ? ORDER BY uploaded_at DESC`,
            [applicant.id]
        );

        res.json({
            applicant: {
                ...publicApplicantView(applicant),
                phone: applicant.phone,
                offered_at: applicant.offered_at,
                offer_expires_at: applicant.offer_expires_at,
                offer_expired: applicantView(applicant).offer_expired,
                decided_at: applicant.decided_at,
                can_upload: PORTAL_UPLOAD_STATUSES.includes(applicant.status),
            },
            documents: documents.map(publicDocumentView),
            required_documents: settings.requiredDocuments,
            max_document_mb: settings.maxDocMb,
            access_token: issuePortalToken(applicant.id),
            expires_in: PORTAL_TOKEN_TTL_SECONDS,
        });
    } catch (error) {
        logger.error({ err: error }, 'Public application lookup failed');
        res.status(500).json({ error: 'Failed to look up the application' });
    }
}

export async function uploadPublicDocument(req, res) {
    try {
        const applicantId = verifyPortalToken(req);
        if (!applicantId) {
            return res.status(401).json({ error: 'Your session has expired. Look up your application again.' });
        }

        const applicant = await queryOne('SELECT id, status FROM applicants WHERE id = ?', [applicantId]);
        if (!applicant) return res.status(404).json({ error: 'Applicant not found' });
        if (!PORTAL_UPLOAD_STATUSES.includes(applicant.status)) {
            return res.status(409).json({ error: 'This application is closed, so documents can no longer be uploaded.' });
        }

        const docType = str(req.body.doc_type);
        if (!docType) return res.status(400).json({ error: 'Document type is required' });
        if (tooLong(docType, 80)) return res.status(400).json({ error: 'Document type is too long' });
        if (!req.file) return res.status(400).json({ error: 'A file is required' });

        const countRow = await queryOne(
            'SELECT COUNT(*) AS count FROM applicant_documents WHERE applicant_id = ?',
            [applicantId]
        );
        if (parseCount(countRow) >= MAX_PORTAL_DOCUMENTS) {
            return res.status(409).json({ error: `You can upload up to ${MAX_PORTAL_DOCUMENTS} documents.` });
        }

        const { maxDocMb } = await getAdmissionsSettings();
        if (req.file.size > maxDocMb * 1024 * 1024) {
            return res.status(413).json({ error: `Document exceeds the ${maxDocMb} MB limit.` });
        }

        const id = crypto.randomUUID();
        await run(
            `INSERT INTO applicant_documents (id, applicant_id, doc_type, filename, mime_type, file_size, content)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, applicantId, docType, req.file.originalname, req.file.mimetype, req.file.size,
             req.file.buffer.toString('base64')]
        );

        res.status(201).json({
            message: 'Document uploaded',
            document: publicDocumentView({
                id,
                doc_type: docType,
                filename: req.file.originalname,
                mime_type: req.file.mimetype,
                file_size: req.file.size,
                verified: false,
                uploaded_at: new Date().toISOString(),
            }),
        });
    } catch (error) {
        logger.error({ err: error }, 'Public document upload failed');
        res.status(500).json({ error: 'Failed to upload the document' });
    }
}

export async function deletePublicDocument(req, res) {
    try {
        const applicantId = verifyPortalToken(req);
        if (!applicantId) {
            return res.status(401).json({ error: 'Your session has expired. Look up your application again.' });
        }

        const applicant = await queryOne('SELECT status FROM applicants WHERE id = ?', [applicantId]);
        if (!applicant) return res.status(404).json({ error: 'Applicant not found' });
        if (!PORTAL_UPLOAD_STATUSES.includes(applicant.status)) {
            return res.status(409).json({ error: 'This application is closed, so documents can no longer be changed.' });
        }

        const result = await run(
            'DELETE FROM applicant_documents WHERE id = ? AND applicant_id = ?',
            [req.params.docId, applicantId]
        );
        if (!result || result.changes === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }
        res.json({ message: 'Document deleted' });
    } catch (error) {
        logger.error({ err: error }, 'Public document delete failed');
        res.status(500).json({ error: 'Failed to delete the document' });
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
