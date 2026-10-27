import { describe, it, expect, beforeAll } from 'vitest';
import dotenv from 'dotenv';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import apiRouter from '../../src/routes/api.js';
import { query, queryOne, getActiveDbEngine, getProcessedDatabaseUrl } from '../../src/config/database.js';
import { SENSITIVE_KEYS } from '../../src/controllers/settingsController.js';

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

    describe('GET /api/settings  (secret-leak regression)', () => {
        it('admin receives sensitive keys masked, non-sensitive keys intact', async () => {
            const sa = await auth(request(app).get('/api/settings'), tok({ email: 'sa-probe@test.local', role: 'superadmin' })).expect(200);
            const ad = await auth(request(app).get('/api/settings'), tok({ email: 'ad-probe@test.local', role: 'admin' })).expect(200);
            for (const key of SENSITIVE_KEYS) {
                expect(ad.body[key]).toBe('');
            }
            const nonSensitive = Object.keys(ad.body).filter(k => !SENSITIVE_KEYS.includes(k));
            expect(nonSensitive.length).toBeGreaterThan(0);
            for (const key of nonSensitive) {
                expect(ad.body[key]).toEqual(sa.body[key]);
            }
        });

        it('superadmin receives unmasked values', async () => {
            const res = await auth(request(app).get('/api/settings'), tok({ email: 'sa-probe2@test.local', role: 'superadmin' })).expect(200);
            // At minimum the settings table is non-empty on the live dev DB.
            expect(Object.keys(res.body).length).toBeGreaterThan(SENSITIVE_KEYS.length);
        });
    });

    describe('GET /api/settings/integrations/status  (real probes)', () => {
        it('admin gets honest status; database probe reports live engine', async () => {
            const res = await auth(request(app).get('/api/settings/integrations/status'), tok({ email: 'ad-status@test.local', role: 'admin' })).expect(200);
            expect(res.body.results.database.status).toBe('online');
            for (const g of ['sms', 'email', 'mpesa', 'google_calendar', 'zoom', 'google_meet']) {
                expect(['online', 'connected', 'configured', 'not_configured', 'error', 'offline']).toContain(res.body.results[g].status);
                expect(res.body.results[g]).toHaveProperty('message');
            }
            // Never leak credential values in status output.
            const json = JSON.stringify(res.body);
            expect(json).not.toContain(process.env.AT_API_KEY || '@@never@@');
        });

        it('rejects unknown gateway and unauthorized roles', async () => {
            await auth(request(app).get('/api/settings/integrations/status?gateway=bogus'), tok({ email: 'ad-status2@test.local', role: 'admin' })).expect(400);
            await auth(request(app).get('/api/settings/integrations/status'), tok({ email: 'tch-status@test.local', role: 'teacher' })).expect(403);
            await request(app).get('/api/settings/integrations/status').expect(401);
        });
    });

    describe('GET /api/settings/dashboard-stats (real KPI counts)', () => {
        it('admin gets numeric counts from live tables', async () => {
            const res = await auth(request(app).get('/api/settings/dashboard-stats'), tok({ email: 'ad-stats@test.local', role: 'admin' })).expect(200);
            for (const k of ['programs', 'courses', 'students', 'staff', 'active_portals']) {
                expect(typeof res.body[k]).toBe('number');
                expect(res.body[k]).toBeGreaterThanOrEqual(0);
            }
            expect(res.body).toHaveProperty('checked_at');
        });

        it('teacher is forbidden and anonymous gets 401', async () => {
            await auth(request(app).get('/api/settings/dashboard-stats'), tok({ email: 'tch-stats@test.local', role: 'teacher' })).expect(403);
            await request(app).get('/api/settings/dashboard-stats').expect(401);
        });
    });

    describe('GET /api/audit-logs (pagination + server-side search)', () => {
        const sa = () => tok({ email: 'sa-audit@test.local', role: 'superadmin' });

        it('honors page/limit and reports real totals', async () => {
            const res = await auth(request(app).get('/api/audit-logs?limit=5&page=2'), sa()).expect(200);
            expect(res.body.logs.length).toBeLessThanOrEqual(5);
            expect(res.body.pagination.total).toBeGreaterThan(0);
            expect(res.body.pagination.page).toBe(2);
            expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(1);
        });

        it('caps limit at 100 rows', async () => {
            const res = await auth(request(app).get('/api/audit-logs?limit=500'), sa()).expect(200);
            expect(res.body.logs.length).toBeLessThanOrEqual(100);
        });

        it('search filters across fields server-side; absent term returns zero', async () => {
            const all = await auth(request(app).get('/api/audit-logs?limit=1'), sa()).expect(200);
            const hit = await auth(request(app).get('/api/audit-logs?search=login&limit=5'), sa()).expect(200);
            expect(hit.body.pagination.total).toBeLessThanOrEqual(all.body.pagination.total);
            for (const l of hit.body.logs) {
                const blob = `${l.user_email} ${l.action} ${l.resource} ${l.details} ${l.ip_address}`.toLowerCase();
                expect(blob).toContain('login');
            }
            const miss = await auth(request(app).get('/api/audit-logs?search=zzq-no-such-term-9x7'), sa()).expect(200);
            expect(miss.body.pagination.total).toBe(0);
            expect(miss.body.logs).toHaveLength(0);
        });

        it('LIKE metacharacters in search are parameterized, never executed as SQL', async () => {
            const res = await auth(request(app).get('/api/audit-logs?search=' + encodeURIComponent("'; DROP TABLE audit_logs; --%_")), sa()).expect(200);
            expect(Array.isArray(res.body.logs)).toBe(true);
            const after = await auth(request(app).get('/api/audit-logs?limit=1'), sa()).expect(200);
            expect(after.body.pagination.total).toBeGreaterThan(0);
        });

        it('teacher and admin are forbidden; anonymous gets 401', async () => {
            await auth(request(app).get('/api/audit-logs'), tok({ email: 'tch-a@test.local', role: 'teacher' })).expect(403);
            await auth(request(app).get('/api/audit-logs'), tok({ email: 'adm-a@test.local', role: 'admin' })).expect(403);
            await request(app).get('/api/audit-logs').expect(401);
        });
    });
});
