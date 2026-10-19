import { describe, it, expect, beforeAll } from 'vitest';
import dotenv from 'dotenv';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import apiRouter from '../../src/routes/api.js';
import { query, queryOne, getActiveDbEngine, getProcessedDatabaseUrl } from '../../src/config/database.js';

dotenv.config();

// Minimal app using the REAL routers, so the SAME authorizeRoles guards under test
// as production. No listen(), no DB migration — handlers only run SELECTs.
const app = express();
app.use(express.json());
app.use('/api', apiRouter);

const SECRET = process.env.JWT_SECRET;
const isLive = getActiveDbEngine() === 'postgres' && !!getProcessedDatabaseUrl() && !!SECRET;

// id is intentionally bogus: for these routes ownership keys on email+role, and a
// non-existent id means auth's fire-and-forget last_seen UPDATE touches no real row.
const tok = ({ email, role }) => jwt.sign({ id: 999999, email, role, name: 'probe' }, SECRET, { expiresIn: '2m' });

const auth = (agent, t) => agent.set('Authorization', `Bearer ${t}`);

describe.skipIf(!isLive)('live authz route guards', () => {
    let feeStudent, otherStudentSid, teacherEmail, adminEmail, adminRole, resultStudent;

    beforeAll(async () => {
        feeStudent = await queryOne(
            `SELECT s.id AS sid, s.email FROM students s
             JOIN monthly_fee_tracking mft ON LOWER(TRIM(mft.student_id)) = LOWER(TRIM(s.id))
             WHERE s.email IS NOT NULL AND TRIM(s.email) <> '' LIMIT 1`);
        otherStudentSid = (await queryOne(
            `SELECT id AS sid FROM students WHERE email IS NOT NULL AND TRIM(email) <> ''
             AND LOWER(TRIM(id)) <> LOWER(TRIM(?)) LIMIT 1`, [feeStudent?.sid || '']))?.sid;
        const t = await queryOne(`SELECT email, role FROM users WHERE LOWER(role)='teacher' AND email IS NOT NULL LIMIT 1`);
        teacherEmail = t?.email;
        const a = await queryOne(`SELECT email, role FROM users WHERE LOWER(role) IN ('superadmin','admin') AND email IS NOT NULL LIMIT 1`);
        adminEmail = a?.email; adminRole = a?.role;

        resultStudent = await queryOne(
            `SELECT s.id AS sid, s.email FROM students s
             JOIN cat_results cr ON LOWER(TRIM(cr.student_id)) = LOWER(TRIM(s.id))
             WHERE cr.marks IS NOT NULL AND s.email IS NOT NULL AND TRIM(s.email) <> '' LIMIT 1`);
    });

    describe('GET /api/finance/monthly-tracking/:sid  (fee IDOR regression)', () => {
        it('teacher is blocked (403) — previously returned any student\'s fees', async () => {
            expect(teacherEmail && feeStudent?.sid).toBeTruthy();
            const res = await auth(request(app).get(`/api/finance/monthly-tracking/${encodeURIComponent(feeStudent.sid)}`), tok({ email: teacherEmail, role: 'teacher' })).expect(403);
            expect(res.body.error).toMatch(/insufficient permissions/i);
        });

        it('student cannot read another student\'s record (403)', async () => {
            expect(feeStudent && otherStudentSid).toBeTruthy();
            await auth(request(app).get(`/api/finance/monthly-tracking/${encodeURIComponent(otherStudentSid)}`), tok({ email: feeStudent.email, role: 'student' })).expect(403);
        });

        it('student reads their own record (200, array)', async () => {
            const res = await auth(request(app).get(`/api/finance/monthly-tracking/${encodeURIComponent(feeStudent.sid)}`), tok({ email: feeStudent.email, role: 'student' })).expect(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        it('admin reads any record (200, array)', async () => {
            const res = await auth(request(app).get(`/api/finance/monthly-tracking/${encodeURIComponent(feeStudent.sid)}`), tok({ email: adminEmail, role: adminRole })).expect(200);
            expect(Array.isArray(res.body)).toBe(true);
        });
    });

    describe('GET /api/cat-results  (student results visibility)', () => {
        it('a student only ever receives their own rows', async () => {
            expect(resultStudent).toBeTruthy();
            const res = await auth(request(app).get('/api/cat-results'), tok({ email: resultStudent.email, role: 'student' })).expect(200);
            expect(Array.isArray(res.body)).toBe(true);
            for (const r of res.body) {
                expect(String(r.student_id).toLowerCase().trim()).toBe(String(resultStudent.sid).toLowerCase().trim());
            }
        });

        it('never-filled placeholder rows (marks NULL) are excluded', async () => {
            const res = await auth(request(app).get('/api/cat-results'), tok({ email: resultStudent.email, role: 'student' })).expect(200);
            for (const r of res.body) expect(r.marks).not.toBeNull();
        });

        it('a not-yet-Published mark is visible to the student (immediate-on-upload)', async (ctx) => {
            // Resolved at runtime — skipIf at collection time can't see beforeAll fixtures.
            const np = await queryOne(
                `SELECT student_id AS sid, workflow_status FROM cat_results
                 WHERE marks IS NOT NULL AND workflow_status IS NOT NULL AND workflow_status <> 'Published' LIMIT 1`);
            if (!np) return ctx.skip();
            const owner = await queryOne(`SELECT email FROM students WHERE LOWER(TRIM(id)) = LOWER(TRIM(?))`, [np.sid]);
            if (!owner?.email) return ctx.skip();
            const res = await auth(request(app).get('/api/cat-results'), tok({ email: owner.email, role: 'student' })).expect(200);
            expect(res.body.map(r => r.workflow_status)).toContain(np.workflow_status);
        });
    });
});
