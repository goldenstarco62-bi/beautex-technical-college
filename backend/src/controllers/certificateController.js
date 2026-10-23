import { query, queryOne, run, withTransaction } from '../config/database.js';
import logger from '../utils/logger.js';

const isPostgres = () => !!process.env.DATABASE_URL?.trim();
const TEMPLATE_VERSION = 'bttc-cert-2026-10-15-01';

// Parse the students.course JSON name array (main course first).
function parseCourseArray(raw) {
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (typeof raw === 'string') {
        const t = raw.trim();
        if (t.startsWith('[')) { try { return JSON.parse(t).filter(Boolean); } catch { /* fall through */ } }
        return t ? [t] : [];
    }
    return [];
}

// Build the qualification title shown on the certificate.
function qualificationTitle(courseName, category) {
    const name = String(courseName || '').trim();
    if (!name) return '';
    if (category === 'Diploma' && !/^diploma/i.test(name)) return `Diploma in ${name}`;
    return name;
}

const CATEGORY_CODE = { Diploma: 'DIP', Certificate: 'CERT', 'Short Course': 'SC' };

// Normalise a DATE value (JS Date, ISO string, or empty) to a YYYY-MM-DD string.
function toDateStr(v) {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
    const s = String(v).trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// Concurrency-safe per-category, per-year sequence.
async function nextSequence(category, year) {
    if (isPostgres()) {
        const row = await queryOne(
            `INSERT INTO certificate_sequences (category, year, last_number)
             VALUES (?, ?, 1)
             ON CONFLICT (category, year) DO UPDATE SET last_number = certificate_sequences.last_number + 1
             RETURNING last_number`,
            [category, year]
        );
        return row.last_number;
    }
    await run(
        `INSERT INTO certificate_sequences (category, year, last_number)
         VALUES (?, ?, 1)
         ON CONFLICT (category, year) DO UPDATE SET last_number = last_number + 1`,
        [category, year]
    );
    const row = await queryOne(
        `SELECT last_number FROM certificate_sequences WHERE category = ? AND year = ?`,
        [category, year]
    );
    return row.last_number;
}

// Derive the certificate number's trailing part from the admission/registration number.
// Admission numbers look like "BC/SC/HD/26/80" — the last "/"-segment is the registration
// number. We take it, strip any non-digits and zero-pad to 3 (80 -> 080, 075 -> 075).
// Falls back to a per-category sequence when the admission has no usable digits.
function certTailFromAdmission(admission) {
    const s = String(admission || '').trim();
    if (!s) return null;
    const last = s.includes('/') ? s.split('/').pop() : (s.match(/\d+$/) || [''])[0];
    const digits = String(last || '').replace(/[^0-9]/g, '');
    if (!digits) return null;
    return digits.padStart(3, '0');
}

// Load the course catalogue once and build lookup maps.
async function loadCourseMaps() {
    const courses = await query('SELECT id, name, programme_type FROM courses');
    const byId = new Map();
    const byName = new Map();
    for (const c of courses) {
        byId.set(String(c.id), c);
        byName.set(String(c.name).toLowerCase().trim(), c);
    }
    return { byId, byName };
}

// Resolve a student's programme course record + certificate category.
function resolveProgramme(student, maps) {
    let course = student.programme_id ? maps.byId.get(String(student.programme_id)) : null;
    if (!course) {
        const names = parseCourseArray(student.course);
        for (const n of names) {
            course = maps.byName.get(String(n).toLowerCase().trim());
            if (course) break;
        }
    }
    if (!course) return null;
    const category = course.programme_type === 'Diploma' ? 'Diploma' : 'Short Course';
    return { course, category };
}

// Every programme a student is enrolled in (multi-course registration).
async function enrolledProgrammeIds(studentId) {
    const rows = await query('SELECT programme_id FROM student_programmes WHERE student_id = ?', [studentId]);
    return rows.map(r => String(r.programme_id));
}

function categoryOf(course) {
    return course.programme_type === 'Diploma' ? 'Diploma' : 'Short Course';
}

// GET /certificates/eligible — graduated students with their programme + issue state.
export async function getEligibleStudents(req, res) {
    try {
        const maps = await loadCourseMaps();
        const students = await query(
            `SELECT id, name, email, course, programme_id, status, contact, photo,
                    enrolled_date, completion_date
             FROM students
             WHERE status = 'Graduated' OR (completion_date IS NOT NULL AND CAST(completion_date AS TEXT) <> '')
             ORDER BY name`
        );
        const issued = await query(
            `SELECT student_id, programme_id, certificate_number FROM certificates WHERE status = 'Issued'`
        );
        const issuedKey = new Set(issued.map(c => `${c.student_id}::${c.programme_id ?? ''}`));

        // Junction rows drive eligibility so a student enrolled in several
        // programmes appears once per qualification (one certificate each).
        const links = await query('SELECT student_id, programme_id FROM student_programmes');
        const linkMap = new Map();
        for (const l of links) {
            const sid = String(l.student_id);
            if (!linkMap.has(sid)) linkMap.set(sid, []);
            linkMap.get(sid).push(String(l.programme_id));
        }

        const result = [];
        for (const s of students) {
            const ids = linkMap.get(String(s.id)) || [];
            let coursesList = ids.map(id => maps.byId.get(id)).filter(Boolean);
            if (coursesList.length === 0) {
                const resolved = resolveProgramme(s, maps);
                if (resolved) coursesList = [resolved.course];
            }
            for (const course of coursesList) {
                const category = categoryOf(course);
                const key = `${s.id}::${course.id}`;
                const existing = issued.find(c => String(c.student_id) === String(s.id) && String(c.programme_id ?? '') === String(course.id));
                result.push({
                    student_id: s.id,
                    admission_number: s.id,
                    student_name: s.name,
                    email: s.email,
                    photo: s.photo,
                    enrolled_date: s.enrolled_date,
                    completion_date: s.completion_date,
                    programme_id: course.id,
                    category,
                    course_name: qualificationTitle(course.name, category),
                    already_issued: issuedKey.has(key),
                    certificate_number: existing ? existing.certificate_number : null
                });
            }
        }
        res.json(result);
    } catch (error) {
        logger.error({ err: error }, 'getEligibleStudents error');
        res.status(500).json({ error: 'Failed to fetch eligible students' });
    }
}

// POST /certificates/issue — validate graduation, allocate a number, store a snapshot.
export async function issueCertificate(req, res) {
    try {
        const { student_id, award_date } = req.body;
        if (!student_id) return res.status(400).json({ error: 'student_id is required.' });

        const student = await queryOne(
            `SELECT id, name, email, course, programme_id, status, photo, enrolled_date, completion_date
             FROM students WHERE id = ?`,
            [student_id]
        );
        if (!student) return res.status(404).json({ error: 'Student not found.' });

        const graduated = String(student.status || '').toLowerCase() === 'graduated'
            || (student.completion_date && String(student.completion_date).trim() !== '');
        if (!graduated) {
            return res.status(400).json({ error: 'Only graduated students (or students with a completion date) can be issued a certificate.' });
        }

        const maps = await loadCourseMaps();
        const requestedPid = req.body.programme_id != null ? String(req.body.programme_id).trim() : null;
        const enrolledIds = await enrolledProgrammeIds(student.id);
        let course = null;
        if (requestedPid) {
            course = maps.byId.get(requestedPid) || null;
            if (!course) return res.status(400).json({ error: `Programme "${requestedPid}" was not found.` });
            if (enrolledIds.length && !enrolledIds.includes(requestedPid)) {
                return res.status(400).json({ error: 'This student is not enrolled in the selected programme.' });
            }
        } else if (enrolledIds.length === 1) {
            course = maps.byId.get(enrolledIds[0]) || null;
        } else if (enrolledIds.length > 1) {
            return res.status(400).json({ error: 'This student is enrolled in multiple programmes — select which qualification to certify.' });
        }
        if (!course) {
            // Legacy fallback for students without junction rows.
            const resolved = resolveProgramme(student, maps);
            if (!resolved) return res.status(400).json({ error: 'Could not resolve a programme for this student. Set their course/programme first.' });
            course = resolved.course;
        }
        const category = categoryOf(course);

        const already = await queryOne(
            `SELECT certificate_number FROM certificates WHERE student_id = ? AND programme_id = ? AND status = 'Issued'`,
            [student.id, course.id]
        );
        if (already) return res.status(409).json({ error: `A certificate is already issued for this student and programme (${already.certificate_number}).` });

        const completionDate = toDateStr(student.completion_date);
        const finalAwardDate = toDateStr(award_date) || completionDate || new Date().toISOString().slice(0, 10);
        const year = parseInt(finalAwardDate.slice(0, 4), 10) || new Date().getFullYear();
        const courseName = qualificationTitle(course.name, category);
        const issuedBy = req.user?.email || req.user?.id || null;
        const issuedByName = req.user?.name || null;

        const record = await withTransaction(async () => {
            const nowIso = new Date().toISOString();

            // Re-issue after a revoke: reactivate the prior Revoked row for this student+programme
            // so its certificate number stays stable (avoids a UNIQUE clash with the derived number).
            const prior = await queryOne(
                `SELECT id FROM certificates WHERE student_id = ? AND programme_id = ? AND status = 'Revoked' ORDER BY revoked_at DESC LIMIT 1`,
                [student.id, course.id]
            );
            if (prior) {
                await run(
                    `UPDATE certificates
                        SET status = 'Issued', student_name = ?, course_name = ?, category = ?,
                            completion_date = ?, award_date = ?, template_version = ?,
                            issued_by = ?, issued_by_name = ?, revoked_at = NULL, revoke_reason = NULL, updated_at = ?
                      WHERE id = ?`,
                    [student.name, courseName, category, completionDate, finalAwardDate, TEMPLATE_VERSION,
                     issuedBy, issuedByName, nowIso, prior.id]
                );
                return await queryOne('SELECT * FROM certificates WHERE id = ?', [prior.id]);
            }

            // Fresh issuance: derive the number from the admission; fall back to the per-category
            // sequence if the derived number is already taken (e.g. a revoked row of another student).
            const tail = certTailFromAdmission(student.id);
            let number = tail ? `BTTC-${CATEGORY_CODE[category]}-${year}-${tail}` : null;
            if (!number || await queryOne('SELECT 1 AS x FROM certificates WHERE certificate_number = ?', [number])) {
                number = `BTTC-${CATEGORY_CODE[category]}-${year}-${String(await nextSequence(category, year)).padStart(3, '0')}`;
            }
            const insertResult = await run(
                `INSERT INTO certificates
                    (certificate_number, student_id, programme_id, category, student_name, course_name,
                     admission_number, completion_date, award_date, status, template_version, issued_by, issued_by_name)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Issued', ?, ?, ?)`,
                [number, student.id, course.id, category, student.name, courseName,
                 student.id, completionDate, finalAwardDate, TEMPLATE_VERSION, issuedBy, issuedByName]
            );
            const id = insertResult.lastID || insertResult.lastInsertRowid;
            return await queryOne('SELECT * FROM certificates WHERE id = ?', [id]);
        });

        res.status(201).json(record);
    } catch (error) {
        const dup = error.code === 'SQLITE_CONSTRAINT' || error.code === '23505' || (error.message || '').includes('unique constraint');
        if (dup) return res.status(409).json({ error: 'This certificate was already issued (a concurrent request won the race).' });
        logger.error({ err: error }, 'issueCertificate error');
        res.status(500).json({ error: 'Failed to issue certificate.' });
    }
}

// POST /certificates/:id/revoke — admin/superadmin voids an issued certificate.
// The student becomes re-eligible (getEligibleStudents only counts status='Issued'), and the
// partial unique index uq_certificates_active lets a fresh issuance proceed.
export async function revokeCertificate(req, res) {
    try {
        const { id } = req.params;
        const reason = String(req.body?.reason || '').trim();
        if (!reason) return res.status(400).json({ error: 'A revoke reason is required.' });

        const cert = await queryOne('SELECT * FROM certificates WHERE id = ?', [id]);
        if (!cert) return res.status(404).json({ error: 'Certificate not found.' });
        if (cert.status !== 'Issued') return res.status(409).json({ error: 'Only an issued certificate can be revoked.' });

        const nowIso = new Date().toISOString();
        await run(
            `UPDATE certificates SET status = 'Revoked', revoke_reason = ?, revoked_at = ?, updated_at = ? WHERE id = ?`,
            [reason, nowIso, nowIso, cert.id]
        );
        const updated = await queryOne('SELECT * FROM certificates WHERE id = ?', [cert.id]);
        logger.info({ cert: cert.certificate_number, by: req.user?.email, reason }, 'certificate revoked');
        res.json(updated);
    } catch (error) {
        logger.error({ err: error }, 'revokeCertificate error');
        res.status(500).json({ error: 'Failed to revoke certificate.' });
    }
}

// PUT /certificates/:id — admin correction of an issued certificate.
// Editable: certificate_number, award_date, hod_name (override of the course→HOD mapping),
// student_name, course_name. The rendered design is untouched; only the stored variable
// fields change (these are snapshot columns; student/course records are not modified).
export async function updateCertificate(req, res) {
    try {
        const { id } = req.params;
        const cert = await queryOne('SELECT * FROM certificates WHERE id = ?', [id]);
        if (!cert) return res.status(404).json({ error: 'Certificate not found.' });
        if (cert.status !== 'Issued') return res.status(409).json({ error: 'Only an issued certificate can be edited.' });

        const updates = [];
        const params = [];
        if (req.body?.certificate_number !== undefined) {
            const number = String(req.body.certificate_number).trim();
            if (!number) return res.status(400).json({ error: 'Certificate number cannot be empty.' });
            const clash = await queryOne('SELECT 1 AS x FROM certificates WHERE certificate_number = ? AND id <> ?', [number, cert.id]);
            if (clash) return res.status(409).json({ error: `Certificate number "${number}" is already in use.` });
            updates.push('certificate_number = ?'); params.push(number);
        }
        if (req.body?.award_date !== undefined) {
            const date = toDateStr(req.body.award_date);
            if (!date) return res.status(400).json({ error: 'Invalid award date.' });
            updates.push('award_date = ?'); params.push(date);
        }
        if (req.body?.hod_name !== undefined) {
            const hod = String(req.body.hod_name).trim();
            updates.push('hod_name = ?'); params.push(hod || null);
        }
        if (req.body?.student_name !== undefined) {
            const name = String(req.body.student_name).trim();
            if (!name) return res.status(400).json({ error: 'Student name cannot be empty.' });
            updates.push('student_name = ?'); params.push(name);
        }
        if (req.body?.course_name !== undefined) {
            const course = String(req.body.course_name).trim();
            if (!course) return res.status(400).json({ error: 'Course name cannot be empty.' });
            updates.push('course_name = ?'); params.push(course);
        }
        if (!updates.length) return res.status(400).json({ error: 'Nothing to update.' });

        updates.push('updated_at = ?'); params.push(new Date().toISOString());
        await run(`UPDATE certificates SET ${updates.join(', ')} WHERE id = ?`, [...params, cert.id]);
        const updated = await queryOne('SELECT * FROM certificates WHERE id = ?', [cert.id]);
        logger.info({ cert: updated.certificate_number, by: req.user?.email, fields: updates }, 'certificate edited');
        res.json(updated);
    } catch (error) {
        logger.error({ err: error }, 'updateCertificate error');
        res.status(500).json({ error: 'Failed to update certificate.' });
    }
}

// GET /certificates — issued register.
export async function getCertificates(req, res) {
    try {
        const { search, category, year, status, student_id } = req.query;
        let sql = `
            SELECT c.*, s.course AS student_course_raw, s.photo AS student_photo
            FROM certificates c
            LEFT JOIN students s ON s.id = c.student_id
            WHERE 1=1
        `;
        const params = [];
        if (status) { sql += ' AND c.status = ?'; params.push(status); } else { sql += ` AND c.status = 'Issued'`; }
        if (category) { sql += ' AND c.category = ?'; params.push(category); }
        if (year) {
            const y = parseInt(String(year), 10);
            if (!Number.isNaN(y)) {
                sql += ' AND c.award_date >= ? AND c.award_date < ?';
                params.push(`${y}-01-01`, `${y + 1}-01-01`);
            }
        }
        if (student_id) { sql += ' AND c.student_id = ?'; params.push(student_id); }
        if (search) {
            sql += ' AND (LOWER(c.student_name) LIKE ? OR LOWER(c.admission_number) LIKE ? OR LOWER(c.certificate_number) LIKE ?)';
            const like = `%${String(search).toLowerCase()}%`;
            params.push(like, like, like);
        }
        if (req.user?.role === 'student') {
            const email = String(req.user?.email || '').toLowerCase().trim();
            const me = await queryOne('SELECT id FROM students WHERE LOWER(email) = LOWER(?)', [email]);
            sql += ' AND c.student_id = ?'; params.push(me?.id || req.user?.id);
        }
        sql += ' ORDER BY c.created_at DESC';
        const rows = await query(sql, params);
        res.json(rows.map(r => ({ ...r, student_photo: r.student_photo || null })));
    } catch (error) {
        logger.error({ err: error }, 'getCertificates error');
        res.status(500).json({ error: 'Failed to fetch certificates' });
    }
}

// GET /certificates/:id — single record (for view/print/download).
export async function getCertificate(req, res) {
    try {
        const row = await queryOne(
            `SELECT c.*, s.photo AS student_photo FROM certificates c
             LEFT JOIN students s ON s.id = c.student_id WHERE c.id = ?`,
            [req.params.id]
        );
        if (!row) return res.status(404).json({ error: 'Certificate not found.' });
        if (req.user?.role === 'student') {
            const email = String(req.user?.email || '').toLowerCase().trim();
            const me = await queryOne('SELECT id FROM students WHERE LOWER(email) = LOWER(?)', [email]);
            if (String(me?.id) !== String(row.student_id)) return res.status(403).json({ error: 'Not authorized to view this certificate.' });
        }
        res.json(row);
    } catch (error) {
        logger.error({ err: error }, 'getCertificate error');
        res.status(500).json({ error: 'Failed to fetch certificate' });
    }
}
