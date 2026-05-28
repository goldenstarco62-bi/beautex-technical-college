/**
 * Diagnostic script for monthly fee tracking issues.
 * Run with: node --experimental-vm-modules src/diagnose-monthly.js
 */
import 'dotenv/config';
import { query, queryOne } from './config/database.js';
import { parseDurationToMonths, isCourseEligible, parseStudentCourses } from './controllers/monthlyFeeController.js';

async function diagnose() {
    console.log('\n========== MONTHLY FEE TRACKING DIAGNOSTIC ==========\n');

    // 1. Show all courses and their parsed durations
    console.log('--- COURSES TABLE ---');
    const courses = await query("SELECT id, name, duration, status FROM courses");
    console.log(`Total courses: ${courses.length}`);
    for (const c of courses) {
        const months = parseDurationToMonths(c.duration);
        const eligible = months >= 4;
        console.log(`  [${eligible ? '✅ ELIGIBLE' : '❌ SKIP'}] "${c.name}" | duration="${c.duration}" | parsed=${months} months | status=${c.status}`);
    }

    // 2. Show all active students and their course matches
    console.log('\n--- ACTIVE STUDENTS & COURSE MATCHES ---');
    const students = await query(`
        SELECT s.id, s.name, s.course, s.department, s.status, sf.total_due
        FROM students s
        LEFT JOIN student_fees sf ON s.id = sf.student_id
        WHERE s.status = 'Active'
    `);
    const activeCourses = await query("SELECT id, name, duration FROM courses WHERE status = 'Active'");

    console.log(`Total active students: ${students.length}`);
    let eligibleCount = 0;
    let ineligibleCount = 0;
    let noMatchCount = 0;

    for (const student of students) {
        const courseNames = parseStudentCourses(student.course);
        let maxMonths = 0;
        let matchedCourseName = null;
        let matchedDuration = null;

        for (const cName of courseNames) {
            const matched = activeCourses.find(c => c.name && c.name.toLowerCase().trim() === cName.toLowerCase().trim());
            if (matched && matched.duration) {
                const m = parseDurationToMonths(matched.duration);
                if (m > maxMonths) {
                    maxMonths = m;
                    matchedCourseName = matched.name;
                    matchedDuration = matched.duration;
                }
            }
        }

        if (maxMonths >= 4) {
            eligibleCount++;
            console.log(`  ✅ ELIGIBLE: "${student.name}" | course="${student.course}" → matched="${matchedCourseName}" (${matchedDuration} = ${maxMonths}mo) | total_due=${student.total_due}`);
        } else if (maxMonths > 0) {
            ineligibleCount++;
            console.log(`  ❌ INELIGIBLE: "${student.name}" | course="${student.course}" → matched="${matchedCourseName}" (${matchedDuration} = ${maxMonths}mo)`);
        } else {
            noMatchCount++;
            console.log(`  ⚠️  NO MATCH: "${student.name}" | course="${student.course}" (raw) | courseNames=${JSON.stringify(courseNames)}`);
        }
    }

    console.log(`\nSummary: Eligible=${eligibleCount}, Ineligible=${ineligibleCount}, NoMatch=${noMatchCount}`);

    // 3. Show what's currently in monthly_fee_tracking
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    console.log(`\n--- MONTHLY FEE TRACKING (${month}/${year}) ---`);
    const tracked = await query('SELECT student_id, year, month, amount_due, status FROM monthly_fee_tracking WHERE year = ? AND month = ?', [year, month]);
    console.log(`Records in monthly_fee_tracking for current month: ${tracked.length}`);
    for (const t of tracked) {
        console.log(`  StudentID=${t.student_id} | amount_due=${t.amount_due} | status=${t.status}`);
    }

    // 4. Show mismatches - students eligible but NOT in tracking
    console.log('\n--- ELIGIBLE STUDENTS MISSING FROM TRACKING ---');
    const trackedIds = new Set(tracked.map(t => t.student_id));
    let missingCount = 0;
    for (const student of students) {
        const courseNames = parseStudentCourses(student.course);
        let maxMonths = 0;
        for (const cName of courseNames) {
            const matched = activeCourses.find(c => c.name && c.name.toLowerCase().trim() === cName.toLowerCase().trim());
            if (matched && matched.duration) {
                const m = parseDurationToMonths(matched.duration);
                if (m > maxMonths) maxMonths = m;
            }
        }
        if (maxMonths >= 4 && !trackedIds.has(student.id)) {
            missingCount++;
            console.log(`  MISSING: "${student.name}" (ID=${student.id}) | course="${student.course}"`);
        }
    }
    if (missingCount === 0) {
        console.log('  ✅ All eligible students are tracked!');
    }

    console.log('\n========== END OF DIAGNOSTIC ==========\n');
    process.exit(0);
}

diagnose().catch(err => {
    console.error('Diagnostic error:', err);
    process.exit(1);
});
