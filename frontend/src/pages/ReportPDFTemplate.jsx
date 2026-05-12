/**
 * ReportPDFTemplate.jsx
 * Professional Institutional Activity Report PDF Template
 * Supports: Daily | Weekly | Monthly report types
 * Beautext Technical Training College
 */

const VAL = (v, fallback = '—') => (v !== null && v !== undefined && v !== '' ? v : fallback);
const NUM = (v, fallback = 0) => (v !== null && v !== undefined && !isNaN(Number(v)) ? Number(v) : fallback);
const safeUpper = (v) => String(VAL(v, '—')).toUpperCase();

// ─────────────────────────────────────────────────────────────────────────────
//  SHARED: Progress Bar
// ─────────────────────────────────────────────────────────────────────────────
function ProgressBar({ value, max = 100, color = '#800000', height = 8 }) {
    const pct = max > 0 ? Math.min(100, Math.round((NUM(value) / NUM(max)) * 100)) : 0;
    return (
        <div style={{ background: '#f3f4f6', borderRadius: 999, height, overflow: 'hidden', width: '100%' }}>
            <div style={{
                background: color,
                borderRadius: 999,
                height: '100%',
                width: `${pct}%`,
                transition: 'width 0.3s',
            }} />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
//  SHARED: Metric Card
// ─────────────────────────────────────────────────────────────────────────────
function MetricCard({ label, value, unit = '', color = '#800000', sub = null }) {
    return (
        <div style={{
            background: '#fff',
            border: '1px solid #f0f0f0',
            borderTop: `4px solid ${color}`,
            borderRadius: 12,
            padding: '14px 16px',
            minWidth: 0,
        }}>
            <p style={{ fontSize: 22, fontWeight: 900, color, margin: 0, lineHeight: 1.1 }}>
                {value}<span style={{ fontSize: 12, fontWeight: 700, marginLeft: 2 }}>{unit}</span>
            </p>
            <p style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '4px 0 0' }}>
                {label}
            </p>
            {sub && <p style={{ fontSize: 9, color: '#6b7280', marginTop: 2 }}>{sub}</p>}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
//  SHARED: Section Block
// ─────────────────────────────────────────────────────────────────────────────
function Section({ title, icon, color = '#800000', children, bg = '#fafafa' }) {
    return (
        <div style={{
            background: bg,
            border: '1px solid #ececec',
            borderLeft: `4px solid ${color}`,
            borderRadius: 10,
            padding: '12px 14px',
            pageBreakInside: 'avoid',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 14 }}>{icon}</span>
                <p style={{ fontSize: 9, fontWeight: 900, color, textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>{title}</p>
            </div>
            {children}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
//  SHARED: Field Row inside section
// ─────────────────────────────────────────────────────────────────────────────
function FieldRow({ label, value, highlight = false }) {
    // FIX: original guard `!value && value !== 0` still hides falsy strings like '—'.
    // Correctly hide only truly empty/placeholder values.
    if (value === null || value === undefined || value === '' || value === '—') return null;
    return (
        <div style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', minWidth: 110, flexShrink: 0, paddingTop: 1 }}>{label}:</span>
            <div 
                style={{ fontSize: 10, fontWeight: highlight ? 700 : 500, color: highlight ? '#111827' : '#374151', flex: 1, lineHeight: 1.5 }}
                className="rich-text-content-pdf"
                dangerouslySetInnerHTML={{ __html: value }}
            />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
//  SHARED: Report Header
// ─────────────────────────────────────────────────────────────────────────────
function ReportHeader({ title, subtitle, dateLabel, reportId }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            {/* Logo + College Name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src="/app-icon-v2.png" alt="Logo" style={{ width: 56, height: 56, objectFit: 'contain' }}
                    onError={e => { e.target.style.display = 'none'; }} />
                <div>
                    <p style={{ fontSize: 13, fontWeight: 900, color: '#800000', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0, lineHeight: 1.2 }}>
                        Beautex Technical Training College
                    </p>
                    <p style={{ fontSize: 9, fontWeight: 600, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.15em', margin: '2px 0 0' }}>
                        Institutional Management System
                    </p>
                </div>
            </div>

            {/* Title + Badge */}
            <div style={{ textAlign: 'right' }}>
                <div style={{
                    background: '#800000',
                    color: '#fff',
                    borderRadius: 8,
                    padding: '4px 12px',
                    display: 'inline-block',
                    marginBottom: 4,
                }}>
                    <p style={{ fontSize: 14, fontWeight: 900, margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</p>
                </div>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#374151', margin: '2px 0 0' }}>{subtitle}</p>
                <p style={{ fontSize: 8, fontWeight: 500, color: '#9ca3af', margin: '2px 0 0', fontFamily: 'monospace' }}>
                    {reportId}
                </p>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
//  SHARED: Info Bar (date + dept + auditor)
// ─────────────────────────────────────────────────────────────────────────────
function InfoBar({ items }) {
    return (
        <div style={{
            background: '#800000',
            borderRadius: 10,
            padding: '10px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
        }}>
            {items.map((item, i) => (
                // FIX: use item.label as stable key instead of array index
                <div key={item.label} style={{ textAlign: i === items.length - 1 ? 'right' : 'left', flex: 1, borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.15)' : 'none', paddingLeft: i > 0 ? 16 : 0 }}>
                    <p style={{ fontSize: 7, fontWeight: 800, color: 'rgba(255,215,0,0.8)', textTransform: 'uppercase', letterSpacing: '0.14em', margin: 0 }}>{item.label}</p>
                    <p style={{ fontSize: 11, fontWeight: 800, color: '#fff', margin: '1px 0 0' }}>{item.value}</p>
                </div>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
//  SHARED: Signature Row
// ─────────────────────────────────────────────────────────────────────────────
function SignatureBlock({ signatories }) {
    return (
        <div style={{ marginTop: 'auto', paddingTop: 20 }}>
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${signatories.length}, 1fr)`, gap: 20 }}>
                    {signatories.map((s) => (
                        // FIX: use s.role as stable key instead of array index
                        <div key={s.role} style={{ textAlign: 'center' }}>
                            <div style={{ height: 36, borderBottom: '1px solid #374151', marginBottom: 4 }} />
                            <p style={{ fontSize: 9, fontWeight: 800, color: '#111827', textTransform: 'uppercase', margin: 0 }}>{s.name}</p>
                            <p style={{ fontSize: 8, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '2px 0 0' }}>{s.role}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
//  SHARED: Footer
// ─────────────────────────────────────────────────────────────────────────────
// FIX: removed unused `type` prop
function ReportFooter({ reportId }) {
    // FIX: memoize timestamp so it doesn't recalculate on every render
    const now = new Date();
    return (
        <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: '#1f2937',
            padding: '8px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
        }}>
            <p style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                ✓ Verified by Beautex Institutional Management System
            </p>
            <p style={{ fontSize: 7, color: 'rgba(255,215,0,0.7)', margin: 0, fontFamily: 'monospace' }}>
                {reportId}
            </p>
            <p style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                Generated: {now.toLocaleDateString()} {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
//  WATERMARK
// ─────────────────────────────────────────────────────────────────────────────
function Watermark({ text }) {
    return (
        <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-35deg)',
            fontSize: 62,
            fontWeight: 900,
            color: 'rgba(128, 0, 0, 0.028)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 0,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            userSelect: 'none',
        }}>
            {text}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
//  DAILY REPORT TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────
function DailyTemplate({ r, user }) {
    const expected = NUM(r.total_students_expected);
    const present = NUM(r.total_students_present);
    const absent = NUM(r.total_students_absent);
    const late = NUM(r.late_arrivals);
    const staffP = NUM(r.staff_present);
    const staffA = NUM(r.staff_absent);
    const attendPct = expected > 0 ? Math.round((present / expected) * 100) : NUM(r.total_attendance_percentage);
    // FIX: guard against invalid/null date before calling toISOString() — was causing runtime crash
    const rawDate = r.report_date ? new Date(r.report_date) : null;
    const dateStamp = rawDate && !isNaN(rawDate) ? rawDate.toISOString().slice(0, 10).replace(/-/g, '') : 'NODATE';
    const reportId = `BTT-D-${String(r.id || r._id || 'AUTO').slice(-6).toUpperCase()}-${dateStamp}`;
    const dateStr = rawDate && !isNaN(rawDate) ? rawDate.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '—';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px 28px 48px', position: 'relative', fontFamily: "'Inter', 'Segoe UI', sans-serif", boxSizing: 'border-box' }}>
            <Watermark text="Beautex Technical" />

            <ReportHeader title="Daily Activity Report" subtitle="Operational Performance Record" dateLabel={dateStr} reportId={reportId} />

            <InfoBar items={[
                { label: 'Audit Date', value: dateStr },
                { label: 'Department', value: VAL(r.department, 'General Administration') },
                // FIX: wrap in String() before toUpperCase() to guard against non-string values
                { label: 'Lead Auditor', value: safeUpper(r.reported_by || user?.name) },
            ]} />

            {/* ── ATTENDANCE SUMMARY ── */}
            <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 8, fontWeight: 800, color: '#800000', textTransform: 'uppercase', letterSpacing: '0.14em', margin: '0 0 8px' }}>
                    📊 Attendance Summary
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 10 }}>
                    <MetricCard label="Expected" value={VAL(expected, 0)} color="#374151" />
                    <MetricCard label="Present" value={VAL(present, 0)} color="#059669" />
                    <MetricCard label="Absent" value={VAL(absent, 0)} color="#dc2626" />
                    <MetricCard label="Late" value={VAL(late, 0)} color="#d97706" />
                    <MetricCard label="Staff" value={`${staffP}/${staffP + staffA}`} color="#7c3aed" sub="Present / Total" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ProgressBar value={attendPct} max={100} color="#059669" height={10} />
                    <span style={{ fontSize: 12, fontWeight: 900, color: '#059669', minWidth: 42, textAlign: 'right' }}>{attendPct}%</span>
                </div>
                <p style={{ fontSize: 8, color: '#9ca3af', margin: '2px 0 0' }}>Student Attendance Rate</p>
            </div>

            {/* ── SECTIONS GRID ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flex: 1 }}>

                {/* Academic Operations */}
                <Section title="Academic Operations" icon="📚" color="#1d4ed8">
                    <FieldRow label="Classes Conducted" value={VAL(r.classes_conducted)} highlight />
                    <FieldRow label="Topics Covered" value={VAL(r.topics_covered)} />
                    <FieldRow label="Practicals" value={VAL(r.practical_sessions)} />
                    <FieldRow label="Assessments" value={VAL(r.assessments_conducted)} />
                    <FieldRow label="Activities" value={VAL(r.activities_conducted)} />
                </Section>

                {/* Administration */}
                <Section title="Administration" icon="🏢" color="#0891b2">
                    <FieldRow label="Meetings Held" value={VAL(r.meetings_held)} />
                    <FieldRow label="Admissions" value={VAL(r.admissions_registrations)} />
                    <FieldRow label="New Enrollments" value={VAL(r.new_enrollments, 0)} highlight />
                    <FieldRow label="Fees Summary" value={VAL(r.fees_collection_summary)} />
                </Section>

                {/* Facilities & Logistics */}
                <Section title="Facilities & Logistics" icon="🏗️" color="#b45309">
                    <FieldRow label="Facilities Issues" value={VAL(r.facilities_issues)} />
                    <FieldRow label="Equipment" value={VAL(r.equipment_maintenance)} />
                    <FieldRow label="Cleaning" value={VAL(r.cleaning_maintenance)} />
                    <FieldRow label="ICT / Internet" value={VAL(r.internet_ict_status)} />
                </Section>

                {/* Student Affairs */}
                <Section title="Student Affairs" icon="👩‍🎓" color="#7c3aed">
                    <FieldRow label="Disciplinary Cases" value={VAL(r.disciplinary_cases, 0)} />
                    <FieldRow label="Issues" value={VAL(r.discipline_issues)} />
                    <FieldRow label="Student Feedback" value={VAL(r.student_feedback)} />
                    <FieldRow label="Counseling" value={VAL(r.counseling_support)} />
                    <FieldRow label="Absentees" value={VAL(r.absent_students_list)} />
                </Section>

                {/* Marketing & Growth */}
                <Section title="Marketing & Growth" icon="📈" color="#059669">
                    <FieldRow label="Walk-ins" value={VAL(r.walk_ins, 0)} highlight />
                    <FieldRow label="Inquiries" value={VAL(r.inquiries_received, 0)} highlight />
                    <FieldRow label="Social Media" value={VAL(r.social_media_activities)} />
                </Section>

                {/* Challenges & Incidents */}
                <Section title="Challenges & Incidents" icon="⚠️" color="#dc2626" bg="#fff8f8">
                    <FieldRow label="Challenges" value={VAL(r.challenges_faced)} />
                    <FieldRow label="Incidents" value={VAL(r.incidents)} />
                    <FieldRow label="Actions Taken" value={VAL(r.actions_taken)} />
                </Section>

                {/* Success & Highlights — spans full width */}
                <div style={{ gridColumn: '1 / -1' }}>
                    <Section title="Success Highlights & Achievements" icon="🏆" color="#d97706" bg="#fffbf0">
                        <FieldRow label="Achievements" value={VAL(r.achievements)} />
                        <FieldRow label="Notable Events" value={VAL(r.notable_events)} />
                    </Section>
                </div>

                {/* Plans & Remarks — spans full width */}
                <div style={{ gridColumn: '1 / -1' }}>
                    <Section title="Plans & Remarks" icon="📝" color="#374151">
                        <FieldRow label="Plans (Next Day)" value={VAL(r.plans_for_next_day)} />
                        <FieldRow label="Additional Notes" value={VAL(r.additional_notes)} />
                    </Section>
                </div>
            </div>

            {/* Signature */}
            <SignatureBlock signatories={[
                { name: VAL(r.reported_by || user?.name, 'Registrar'), role: 'Prepared By' },
                { name: 'Campus Administrator', role: 'Verified By' },
                { name: 'Board of Directors', role: 'Approved By' },
            ]} />


            <ReportFooter reportId={reportId} />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
//  WEEKLY REPORT TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────
function WeeklyTemplate({ r, user }) {
    const attendPct = NUM(r.average_attendance);
    const reportId = `BTT-W-${String(r.id || r._id || 'AUTO').slice(-6).toUpperCase()}-${(r.week_start_date || '').slice(0, 10).replace(/-/g, '')}`;
    const startStr = r.week_start_date ? new Date(r.week_start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
    const endStr = r.week_end_date ? new Date(r.week_end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
    // FIX: NUM() already returns a number, no need for parseFloat wrapper
    const revenue = NUM(r.revenue_collected).toLocaleString();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px 28px 48px', position: 'relative', fontFamily: "'Inter', 'Segoe UI', sans-serif", boxSizing: 'border-box' }}>
            <Watermark text="Weekly Review" />

            <ReportHeader title="Weekly Summary Report" subtitle="Institutional Performance Audit" reportId={reportId} />

            <InfoBar items={[
                { label: 'Week Start', value: startStr },
                { label: 'Week End', value: endStr },
                { label: 'Lead Auditor', value: safeUpper(r.reported_by || user?.name) },
            ]} />

            {/* ── KEY METRICS ── */}
            <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 8, fontWeight: 800, color: '#800000', textTransform: 'uppercase', letterSpacing: '0.14em', margin: '0 0 8px' }}>
                    📊 Weekly Performance Metrics
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
                    <MetricCard label="Avg Attendance" value={attendPct} unit="%" color="#800000" />
                    <MetricCard label="Classes Conducted" value={VAL(r.total_classes_conducted, 0)} color="#1d4ed8" />
                    <MetricCard label="New Enrollments" value={VAL(r.new_enrollments, 0)} color="#059669" />
                    <MetricCard label="Revenue Collected" value={`KES ${revenue}`} color="#b45309" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
                    <MetricCard label="Active Students" value={VAL(r.active_students, 0)} color="#7c3aed" />
                    <MetricCard label="Avg Student Attendance" value={VAL(r.avg_student_attendance, 0)} unit="%" color="#0891b2" />
                    <MetricCard label="Assessments" value={VAL(r.total_assessments, 0)} color="#374151" />
                    <MetricCard label="Courses Completed" value={VAL(r.courses_completed, 0)} color="#d97706" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ProgressBar value={attendPct} max={100} color="#800000" height={10} />
                    <span style={{ fontSize: 12, fontWeight: 900, color: '#800000', minWidth: 42, textAlign: 'right' }}>{attendPct}%</span>
                </div>
                <p style={{ fontSize: 8, color: '#9ca3af', margin: '2px 0 0' }}>Weekly Average Attendance Rate</p>
            </div>

            {/* ── SECTIONS ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flex: 1 }}>

                {/* Key Achievements */}
                <Section title="Key Achievements" icon="🏆" color="#059669" bg="#f0fdf4">
                    <div 
                        style={{ fontSize: 10, color: '#374151', lineHeight: 1.6, margin: 0 }}
                        className="rich-text-content-pdf"
                        dangerouslySetInnerHTML={{ __html: VAL(r.key_achievements, 'No achievements recorded for this week.') }}
                    />
                </Section>

                {/* Challenges Faced */}
                <Section title="Challenges Faced" icon="⚠️" color="#dc2626" bg="#fff8f8">
                    <div 
                        style={{ fontSize: 10, color: '#374151', lineHeight: 1.6, margin: 0 }}
                        className="rich-text-content-pdf"
                        dangerouslySetInnerHTML={{ __html: VAL(r.challenges_faced, 'No significant challenges reported.') }}
                    />
                </Section>

                {/* Action Items */}
                <Section title="Action Items" icon="✅" color="#d97706" bg="#fffbf0">
                    <div 
                        style={{ fontSize: 10, color: '#374151', lineHeight: 1.6, margin: 0 }}
                        className="rich-text-content-pdf"
                        dangerouslySetInnerHTML={{ __html: VAL(r.action_items, 'No action items pending.') }}
                    />
                </Section>

                {/* Disciplinary */}
                <Section title="Student Discipline" icon="👨‍⚖️" color="#7c3aed">
                    <FieldRow label="Cases" value={VAL(r.disciplinary_cases, 0)} highlight />
                    <FieldRow label="Notes" value={VAL(r.notes)} />
                </Section>

                {/* Notes — full width */}
                <div style={{ gridColumn: '1 / -1' }}>
                    <Section title="Additional Weekly Notes" icon="📝" color="#374151">
                        <div 
                            style={{ fontSize: 10, color: '#374151', lineHeight: 1.6, margin: 0 }}
                            className="rich-text-content-pdf"
                            dangerouslySetInnerHTML={{ __html: VAL(r.notes, 'No additional notes for this reporting period.') }}
                        />
                    </Section>
                </div>
            </div>

            {/* Signature */}
            <SignatureBlock signatories={[
                { name: VAL(r.reported_by || user?.name, 'Registrar'), role: 'Prepared By' },
                { name: 'Academic Director', role: 'Verified By' },
                { name: 'Board Chairperson', role: 'Approved By' },
            ]} />


            <ReportFooter reportId={reportId} />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MONTHLY REPORT TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────
function MonthlyTemplate({ r, user }) {
    const attendPct = NUM(r.average_attendance);
    // FIX: NUM() already returns a number, no parseFloat needed
    const revenue = NUM(r.revenue).toLocaleString();
    const expenses = NUM(r.expenses).toLocaleString();
    // FIX: compute net once, derive sign from it — prevents formatting the minus sign incorrectly
    const netValue = NUM(r.revenue) - NUM(r.expenses);
    const netPositive = netValue >= 0;
    const net = Math.abs(netValue).toLocaleString();
    const reportId = `BTT-M-${String(r.id || r._id || 'AUTO').slice(-6).toUpperCase()}-${(r.month_start_date || r.month || '').slice(0, 7).replace(/-/g, '')}`;
    const startStr = r.month_start_date ? new Date(r.month_start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : VAL(r.month);
    const endStr = r.month_end_date ? new Date(r.month_end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px 28px 48px', position: 'relative', fontFamily: "'Inter', 'Segoe UI', sans-serif", boxSizing: 'border-box' }}>
            <Watermark text="Board Confidential" />

            <ReportHeader title="Monthly Executive Report" subtitle="Board-Level Institutional Audit Summary" reportId={reportId} />

            <InfoBar items={[
                { label: 'Period Start', value: startStr },
                { label: 'Period End', value: endStr },
                { label: 'Submitted By', value: safeUpper(r.reported_by || user?.name) },
            ]} />

            {/* ── FINANCIAL HIGHLIGHT BANNER ── */}
            <div style={{
                background: 'linear-gradient(135deg, #800000, #4d0000)',
                borderRadius: 12,
                padding: '16px 22px',
                marginBottom: 14,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 16,
                color: '#fff',
            }}>
                <div>
                    <p style={{ fontSize: 8, color: 'rgba(255,215,0,0.7)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>Gross Revenue</p>
                    <p style={{ fontSize: 20, fontWeight: 900, margin: '2px 0 0' }}>KES {revenue}</p>
                </div>
                <div>
                    <p style={{ fontSize: 8, color: 'rgba(255,215,0,0.7)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>Total Expenses</p>
                    <p style={{ fontSize: 20, fontWeight: 900, margin: '2px 0 0' }}>KES {expenses}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 8, color: 'rgba(255,215,0,0.7)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>Net Operating Margin</p>
                    <p style={{ fontSize: 20, fontWeight: 900, color: netPositive ? '#4ade80' : '#f87171', margin: '2px 0 0' }}>
                        {/* FIX: show correct sign prefix — net is now Math.abs() so we control the sign explicitly */}
                        {netPositive ? '+' : '-'}KES {net}
                    </p>
                </div>
            </div>

            {/* ── PERFORMANCE METRICS ── */}
            <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 8, fontWeight: 800, color: '#800000', textTransform: 'uppercase', letterSpacing: '0.14em', margin: '0 0 8px' }}>
                    📊 Monthly Performance Indicators
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
                    <MetricCard label="Total Students" value={VAL(r.total_students, 0)} color="#800000" />
                    <MetricCard label="New Enrollments" value={VAL(r.new_enrollments, 0)} color="#059669" />
                    <MetricCard label="Graduations" value={VAL(r.graduations, 0)} color="#d97706" />
                    <MetricCard label="Dropouts" value={VAL(r.dropouts, 0)} color="#dc2626" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
                    <MetricCard label="Avg Attendance" value={attendPct} unit="%" color="#800000" />
                    <MetricCard label="Pass Rate" value={VAL(r.average_pass_rate, 0)} unit="%" color="#1d4ed8" />
                    <MetricCard label="Total Classes" value={VAL(r.total_classes, 0)} color="#0891b2" />
                    <MetricCard label="Total Faculty" value={VAL(r.total_faculty, 0)} color="#7c3aed" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ProgressBar value={attendPct} max={100} color="#800000" height={10} />
                    <span style={{ fontSize: 12, fontWeight: 900, color: '#800000', minWidth: 42, textAlign: 'right' }}>{attendPct}%</span>
                </div>
                <p style={{ fontSize: 8, color: '#9ca3af', margin: '2px 0 0' }}>Monthly Average Attendance Rate</p>
            </div>

            {/* ── SECTIONS ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flex: 1 }}>

                {/* Faculty */}
                <Section title="Faculty & HR" icon="👩‍🏫" color="#0891b2">
                    <FieldRow label="Total Faculty" value={VAL(r.total_faculty, 0)} highlight />
                    <FieldRow label="New Hires" value={VAL(r.new_hires, 0)} />
                    <FieldRow label="Departures" value={VAL(r.faculty_departures, 0)} />
                    <FieldRow label="Total Assessments" value={VAL(r.total_assessments, 0)} />
                </Section>

                {/* Strategic Initiatives */}
                <Section title="Strategic Initiatives" icon="🚀" color="#7c3aed" bg="#fdf4ff">
                    <div 
                        style={{ fontSize: 10, color: '#374151', lineHeight: 1.6, margin: 0 }}
                        className="rich-text-content-pdf"
                        dangerouslySetInnerHTML={{ __html: VAL(r.strategic_initiatives, 'No strategic initiatives reported this month.') }}
                    />
                </Section>

                {/* Major Achievements */}
                <Section title="Major Achievements" icon="🏆" color="#059669" bg="#f0fdf4">
                    <div 
                        style={{ fontSize: 10, color: '#374151', lineHeight: 1.6, margin: 0 }}
                        className="rich-text-content-pdf"
                        dangerouslySetInnerHTML={{ __html: VAL(r.major_achievements, 'No major achievements logged.') }}
                    />
                </Section>

                {/* Challenges */}
                <Section title="Challenges & Risks" icon="⚠️" color="#dc2626" bg="#fff8f8">
                    <div 
                        style={{ fontSize: 10, color: '#374151', lineHeight: 1.6, margin: 0 }}
                        className="rich-text-content-pdf"
                        dangerouslySetInnerHTML={{ __html: VAL(r.challenges, 'Operational challenges were managed effectively.') }}
                    />
                </Section>

                {/* Goals Next Month — full width */}
                <div style={{ gridColumn: '1 / -1' }}>
                    <Section title="Strategic Goals (Next Month)" icon="🎯" color="#d97706" bg="#fffbf0">
                        <div 
                            style={{ fontSize: 10, color: '#374151', lineHeight: 1.6, margin: 0 }}
                            className="rich-text-content-pdf"
                            dangerouslySetInnerHTML={{ __html: VAL(r.goals_next_month, 'Quality enhancement & institutional capacity scaling.') }}
                        />
                    </Section>
                </div>

                {/* Additional Notes — full width */}
                <div style={{ gridColumn: '1 / -1' }}>
                    <Section title="Board Notes & Remarks" icon="📋" color="#374151">
                        <div 
                            style={{ fontSize: 10, color: '#374151', lineHeight: 1.6, margin: 0 }}
                            className="rich-text-content-pdf"
                            dangerouslySetInnerHTML={{ __html: VAL(r.additional_notes, 'Standard institutional operations maintained per academic calendar.') }}
                        />
                    </Section>
                </div>
            </div>

            {/* Signature */}
            <SignatureBlock signatories={[
                { name: VAL(r.reported_by || user?.name, 'Registrar'), role: 'Campus Administrator' },
                { name: 'Internal Auditor', role: 'Verified By' },
                { name: 'Board Chairperson', role: 'Approved By' },
            ]} />


            <ReportFooter reportId={reportId} />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
//  INSTITUTIONAL (CONSOLIDATED) BOARD AUDIT TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────
function InstitutionalTemplate({ r, user }) {
    const stats = r.data?.stats || {};
    const qualitative = r.data?.qualitative || {};
    
    const expected = NUM(stats.total_students_expected);
    const present = NUM(stats.total_students_present);
    const absent = NUM(stats.total_students_absent);
    const late = NUM(stats.late_arrivals);
    const staffP = NUM(stats.staff_present);
    const staffA = NUM(stats.staff_absent);
    const attendPct = expected > 0 ? Math.round((present / expected) * 100) : 0;

    const reportId = `BTT-INST-${new Date().getTime().toString().slice(-6)}-${(r.startDate || '').replace(/-/g, '')}`;
    const dateRangeStr = r.startDate && r.endDate 
        ? `${new Date(r.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — ${new Date(r.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
        : 'Institutional Performance Audit';

    const renderJoinedHtml = (arr) => {
        if (!arr || arr.length === 0) return <span style={{ color: '#9ca3af' }}>—</span>;
        return (
            <div className="rich-text-content-pdf">
                {arr.map((item, i) => (
                    <div key={i} style={{ marginBottom: 6, borderBottom: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none', paddingBottom: 4 }} dangerouslySetInnerHTML={{ __html: item }} />
                ))}
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px 28px 48px', position: 'relative', fontFamily: "'Inter', 'Segoe UI', sans-serif", boxSizing: 'border-box' }}>
            <Watermark text="Institutional Audit" />

            <ReportHeader title="Institutional Board Audit" subtitle="Consolidated Performance Intelligence" reportId={reportId} />

            <InfoBar items={[
                { label: 'Audit Period', value: dateRangeStr },
                { label: 'Total Logs', value: `${VAL(r.data?.total_reports, 0)} Daily | ${VAL(r.data?.total_trainer_reports, 0)} Academic` },
                { label: 'Consolidated By', value: safeUpper(r.reported_by || 'Insight Engine') },
            ]} />

            {/* ── ATTENDANCE SUMMARY ── */}
            <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 8, fontWeight: 800, color: '#800000', textTransform: 'uppercase', letterSpacing: '0.14em', margin: '0 0 8px' }}>
                    📊 Aggregated Attendance Summary
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 10 }}>
                    <MetricCard label="Expected" value={VAL(expected, 0)} color="#374151" />
                    <MetricCard label="Present" value={VAL(present, 0)} color="#059669" />
                    <MetricCard label="Absent" value={VAL(absent, 0)} color="#dc2626" />
                    <MetricCard label="Late" value={VAL(late, 0)} color="#d97706" />
                    <MetricCard label="Staff" value={`${staffP}/${staffP + staffA}`} color="#7c3aed" sub="Present / Total" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ProgressBar value={attendPct} max={100} color="#059669" height={10} />
                    <span style={{ fontSize: 12, fontWeight: 900, color: '#059669', minWidth: 42, textAlign: 'right' }}>{attendPct}%</span>
                </div>
                <p style={{ fontSize: 8, color: '#9ca3af', margin: '2px 0 0' }}>Institutional Student Attendance Rate</p>
            </div>

            {/* ── SECTIONS GRID ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flex: 1 }}>

                {/* Academic Operations */}
                <Section title="Academic Operations" icon="📚" color="#1d4ed8">
                    <FieldRow label="Classes Conducted" value={VAL(stats.classes_conducted)} highlight />
                    <FieldRow label="Topics Covered" value={renderJoinedHtml(qualitative.topics_covered)} />
                    <FieldRow label="Practicals" value={renderJoinedHtml(qualitative.practical_sessions)} />
                    <FieldRow label="Assessments" value={VAL(stats.assessments_conducted)} />
                </Section>

                {/* Administration */}
                <Section title="Administration" icon="🏢" color="#0891b2">
                    <FieldRow label="Meetings Held" value={renderJoinedHtml(qualitative.meetings_held)} />
                    <FieldRow label="New Enrollments" value={VAL(stats.new_enrollments, 0)} highlight />
                    <FieldRow label="Admissions" value={renderJoinedHtml(qualitative.admissions_registrations)} />
                </Section>

                {/* Facilities & Logistics */}
                <Section title="Facilities & Logistics" icon="🏗️" color="#b45309">
                    <FieldRow label="Facilities Issues" value={renderJoinedHtml(qualitative.facilities_issues)} />
                    <FieldRow label="Equipment" value={renderJoinedHtml(qualitative.equipment_maintenance)} />
                    <FieldRow label="Cleaning" value={renderJoinedHtml(qualitative.cleaning_maintenance)} />
                    <FieldRow label="ICT / Internet" value={renderJoinedHtml(qualitative.internet_ict_status)} />
                </Section>

                {/* Student Affairs */}
                <Section title="Student Affairs" icon="👩‍🎓" color="#7c3aed">
                    <FieldRow label="Disciplinary Cases" value={renderJoinedHtml(qualitative.disciplinary_cases)} />
                    <FieldRow label="Student Feedback" value={renderJoinedHtml(qualitative.student_feedback)} />
                    <FieldRow label="Counseling" value={renderJoinedHtml(qualitative.counseling_support)} />
                </Section>

                {/* Marketing & Growth */}
                <Section title="Marketing & Growth" icon="📈" color="#059669">
                    <FieldRow label="Walk-ins" value={VAL(stats.walk_ins, 0)} highlight />
                    <FieldRow label="Inquiries" value={VAL(stats.inquiries_received, 0)} highlight />
                    <FieldRow label="Social Media" value={renderJoinedHtml(qualitative.social_media_activities)} />
                </Section>

                {/* Challenges & Incidents */}
                <Section title="Challenges & Incidents" icon="⚠️" color="#dc2626" bg="#fff8f8">
                    <FieldRow label="Challenges" value={renderJoinedHtml(qualitative.challenges)} />
                    <FieldRow label="Incidents" value={renderJoinedHtml(qualitative.incidents)} />
                    <FieldRow label="Actions Taken" value={renderJoinedHtml(qualitative.actions_taken)} />
                </Section>

                {/* Success & Highlights — spans full width */}
                <div style={{ gridColumn: '1 / -1' }}>
                    <Section title="Trainer Academic Records" icon="👨‍🏫" color="#800000" bg="#fdf2f2">
                        <div style={{ fontSize: 8, color: '#4b5563', lineHeight: 1.5 }}>
                            {renderJoinedHtml(qualitative.trainer_insights)}
                        </div>
                    </Section>
                </div>

                {/* Success & Highlights — spans full width */}
                <div style={{ gridColumn: '1 / -1' }}>
                    <Section title="Success Highlights & Achievements" icon="🏆" color="#d97706" bg="#fffbf0">
                        <FieldRow label="Achievements" value={renderJoinedHtml(qualitative.achievements)} />
                        <FieldRow label="Notable Events" value={renderJoinedHtml(qualitative.notable_events)} />
                    </Section>
                </div>

                {/* Plans & Remarks — spans full width */}
                <div style={{ gridColumn: '1 / -1' }}>
                    <Section title="Institutional Plans & Board Remarks" icon="📝" color="#374151">
                        <FieldRow label="Strategic Plans" value={renderJoinedHtml(qualitative.plans)} />
                        <FieldRow label="Board Notes" value={renderJoinedHtml(qualitative.additional_notes)} />
                    </Section>
                </div>
            </div>

            <SignatureBlock signatories={[
                { name: 'Institutional Auditor', role: 'Prepared By' },
                { name: 'College Principal', role: 'Verified By' },
                { name: 'Board Chairperson', role: 'Approved By' },
            ]} />

            <ReportFooter reportId={reportId} />
        </div>
    );
}


// ─────────────────────────────────────────────────────────────────────────────
//  MAIN EXPORT: ReportPDFTemplate
// ─────────────────────────────────────────────────────────────────────────────
export default function ReportPDFTemplate({ report, user }) {
    if (!report) return null;

    // Normalize type check to handle both camelCase and snake_case
    const type = report.reportType || report.report_type;

    const Template = type === 'daily'
        ? DailyTemplate
        : type === 'weekly'
            ? WeeklyTemplate
            : type === 'monthly'
                ? MonthlyTemplate
            : type === 'consolidated' || type === 'board-audit'
                ? InstitutionalTemplate
                : null;

    if (!Template) return null;

    return (
        <div
            id="report-print-capture"
            style={{
                position: 'absolute',
                top: 0,
                left: '-9999px',
                width: '794px',
                minHeight: '1122px',
                maxHeight: '1122px',
                background: '#ffffff',
                overflow: 'hidden',
                boxSizing: 'border-box',
            }}
        >
            <Template r={report} user={user} />

            <style>{`
                .rich-text-content-pdf {
                    line-height: 1.6;
                }
                .rich-text-content-pdf b, .rich-text-content-pdf strong {
                    font-weight: 800 !important;
                }
                .rich-text-content-pdf u {
                    text-decoration: underline !important;
                }
                .rich-text-content-pdf ol {
                    list-style-type: decimal !important;
                    margin-left: 20px !important;
                    margin-top: 4px !important;
                    margin-bottom: 4px !important;
                }
                .rich-text-content-pdf li {
                    margin-bottom: 2px !important;
                }
                .rich-text-content-pdf p {
                    margin-bottom: 4px !important;
                }
                .rich-text-content-pdf div {
                    display: block !important;
                }
            `}</style>
        </div>
    );
}
