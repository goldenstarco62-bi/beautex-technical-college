import { useEffect, useMemo, useState } from 'react';
import { academicAPI, studentsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Award, BookOpen, FileText, GraduationCap, Printer, Search, TrendingUp, Users } from 'lucide-react';

const GRADE_STYLES = {
    Distinction: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Credit: 'bg-blue-50 text-blue-700 border-blue-200',
    Pass: 'bg-amber-50 text-amber-700 border-amber-200',
    Fail: 'bg-red-50 text-red-600 border-red-200',
};

// students.course is stored either as a plain name or a JSON array of names
const courseLabel = (course) => {
    if (!course) return '';
    const raw = String(course).trim();
    if (!raw.startsWith('[')) return raw;
    try {
        const list = JSON.parse(raw);
        return Array.isArray(list) ? list.filter(Boolean).join(', ') : raw;
    } catch {
        return raw;
    }
};

function GradeBadge({ grade }) {
    return (
        <span className={`inline-flex px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-wider ${GRADE_STYLES[grade] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
            {grade || '—'}
        </span>
    );
}

function StatCard({ label, value, sub, icon: Icon }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-maroon/5 text-maroon flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">{label}</p>
                <p className="text-2xl font-black text-maroon leading-tight">{value}</p>
                {sub && <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mt-1">{sub}</p>}
            </div>
        </div>
    );
}

export default function ReportCard() {
    const { user } = useAuth();
    const role = (user?.role || '').toLowerCase().trim();
    const isStudent = role === 'student';
    const canPickStudent = ['admin', 'superadmin', 'teacher'].includes(role);

    const [students, setStudents] = useState([]);
    const [periods, setPeriods] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState('');
    const [selectedPeriod, setSelectedPeriod] = useState('');
    const [studentSearch, setStudentSearch] = useState('');
    const [card, setCard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let alive = true;
        academicAPI.getPeriods()
            .then(({ data }) => { if (alive) setPeriods(Array.isArray(data) ? data : []); })
            .catch(() => {});
        if (canPickStudent) {
            studentsAPI.getAll()
                .then(({ data }) => {
                    if (!alive) return;
                    const rows = Array.isArray(data) ? data : (Array.isArray(data?.students) ? data.students : []);
                    setStudents(rows);
                })
                .catch(() => {});
        }
        return () => { alive = false; };
    }, [canPickStudent]);

    useEffect(() => {
        if (canPickStudent && !selectedStudent) {
            setCard(null);
            setLoading(false);
            return;
        }
        let alive = true;
        setLoading(true);
        setError('');
        const params = canPickStudent
            ? { student_id: selectedStudent, ...(selectedPeriod ? { academic_period_id: selectedPeriod } : {}) }
            : (selectedPeriod ? { academic_period_id: selectedPeriod } : {});
        academicAPI.getReportCard(params)
            .then(({ data }) => { if (alive) setCard(data); })
            .catch((err) => { if (alive) { setCard(null); setError(err.response?.data?.error || 'Could not load the report card.'); } })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [canPickStudent, selectedStudent, selectedPeriod]);

    const visibleStudents = useMemo(() => {
        const q = studentSearch.trim().toLowerCase();
        if (!q) return students;
        return students.filter(s => `${s.name || ''} ${s.id || ''} ${courseLabel(s.course)}`.toLowerCase().includes(q));
    }, [students, studentSearch]);

    const periodOptions = useMemo(
        () => [...periods].sort((a, b) => new Date(a.start_date || 0) - new Date(b.start_date || 0)),
        [periods]
    );

    const cumulative = card?.cumulative || {};
    const gradeScale = card?.grade_scale;

    return (
        <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
            <style>{`
                @media print {
                    body * { visibility: hidden !important; }
                    #report-card-print, #report-card-print * { visibility: visible !important; }
                    #report-card-print { position: absolute !important; left: 0; top: 0; width: 100%; }
                    .no-print { display: none !important; }
                }
            `}</style>

            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 no-print">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-maroon uppercase tracking-tight flex items-center gap-2">
                        <FileText className="w-6 h-6" /> Report Card
                    </h1>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-1">
                        Term results, credit-weighted GPA and cumulative standing
                    </p>
                </div>
                <button
                    onClick={() => window.print()}
                    disabled={!card || card.periods.length === 0}
                    className="inline-flex items-center justify-center gap-2 bg-maroon text-gold px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-maroon/90 transition-all disabled:opacity-40"
                >
                    <Printer className="w-4 h-4" /> Print / Save PDF
                </button>
            </div>

            {canPickStudent && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 grid grid-cols-1 md:grid-cols-2 gap-4 no-print">
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Student</label>
                        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl">
                            <Search className="w-3.5 h-3.5 text-gray-300" />
                            <input
                                value={studentSearch}
                                onChange={e => setStudentSearch(e.target.value)}
                                placeholder="Filter by name, ID or course"
                                className="flex-1 bg-transparent outline-none text-xs font-bold text-gray-700 placeholder:text-gray-300"
                            />
                        </div>
                        <select
                            value={selectedStudent}
                            onChange={e => setSelectedStudent(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-maroon/10"
                        >
                            <option value="">Select a student…</option>
                            {visibleStudents.map(s => (
                                <option key={s.id} value={s.id}>{s.name} — {s.id}{s.course ? ` · ${courseLabel(s.course)}` : ''}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Academic period</label>
                        <select
                            value={selectedPeriod}
                            onChange={e => setSelectedPeriod(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-maroon/10"
                        >
                            <option value="">All terms</option>
                            {periodOptions.map(p => (
                                <option key={p.id} value={p.id}>{p.name}{p.is_active ? ' (active)' : ''}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {!canPickStudent && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 max-w-sm no-print">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Academic period</label>
                    <select
                        value={selectedPeriod}
                        onChange={e => setSelectedPeriod(e.target.value)}
                        className="mt-1.5 w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-maroon/10"
                    >
                        <option value="">All terms</option>
                        {periodOptions.map(p => (
                            <option key={p.id} value={p.id}>{p.name}{p.is_active ? ' (active)' : ''}</option>
                        ))}
                    </select>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-5 py-4 text-xs font-bold">{error}</div>
            )}

            {loading ? (
                <div className="flex items-center justify-center min-h-[240px]">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-maroon" />
                </div>
            ) : !card ? (
                !error && (
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
                        <Users className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            {canPickStudent ? 'Select a student to view their report card' : 'No report card available yet'}
                        </p>
                    </div>
                )
            ) : (
                <div id="report-card-print" className="space-y-6">
                    <div className="bg-maroon text-white rounded-3xl p-6 sm:p-8">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gold/80">Student Report Card</p>
                                <h2 className="text-2xl sm:text-3xl font-black mt-1">{card.student.name}</h2>
                                <p className="text-[11px] font-bold text-white/60 mt-1">
                                    {card.student.id}{card.student.course ? ` · ${courseLabel(card.student.course)}` : ''}{card.student.level ? ` · Level ${card.student.level}` : ''}
                                </p>
                            </div>
                            <div className="text-left sm:text-right">
                                <p className="text-[9px] font-black uppercase tracking-widest text-gold/80">Cumulative GPA</p>
                                <p className="text-4xl font-black text-gold leading-none mt-1">
                                    {cumulative.gpa != null ? Number(cumulative.gpa).toFixed(2) : '—'}
                                </p>
                                <p className="text-[10px] font-bold text-white/60 mt-1">
                                    {cumulative.earned_credits || 0} / {cumulative.credits || 0} credits
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                        <StatCard label="Terms" value={card.periods.length} icon={BookOpen} />
                        <StatCard label="Units assessed" value={cumulative.units || 0} icon={GraduationCap} />
                        <StatCard label="Credits earned" value={cumulative.earned_credits || 0} sub={`of ${cumulative.credits || 0} attempted`} icon={Award} />
                        <StatCard label="Quality points" value={cumulative.quality_points || 0} icon={TrendingUp} />
                    </div>

                    {card.periods.length === 0 ? (
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
                            <FileText className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">No published results for this selection</p>
                        </div>
                    ) : card.periods.map((period) => (
                        <section key={`${period.academic_period_id ?? 'none'}-${period.name}`} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="px-5 sm:px-7 py-4 bg-gray-50/70 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-black text-maroon uppercase tracking-wide">{period.name}</h3>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                                        {period.start_date ? new Date(period.start_date).toLocaleDateString() : '—'} to {period.end_date ? new Date(period.end_date).toLocaleDateString() : '—'}
                                        {period.status ? ` · ${period.status}` : ''}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Term GPA</p>
                                        <p className="text-xl font-black text-maroon leading-none">{period.gpa != null ? Number(period.gpa).toFixed(2) : '—'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Credits</p>
                                        <p className="text-xl font-black text-maroon leading-none">{period.earned_credits}/{period.credits}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left min-w-[820px]">
                                    <thead>
                                        <tr className="bg-white">
                                            <th className="px-5 sm:px-7 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">Unit</th>
                                            <th className="px-3 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Credits</th>
                                            <th className="px-3 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">Assessments</th>
                                            <th className="px-3 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Average</th>
                                            <th className="px-3 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Grade</th>
                                            <th className="px-3 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Points</th>
                                            <th className="px-5 sm:px-7 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Quality</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {period.units.map((unit) => (
                                            <tr key={`${unit.unit_name}-${unit.unit_code || ''}`} className="hover:bg-gray-50/60 transition-colors">
                                                <td className="px-5 sm:px-7 py-3">
                                                    <p className="text-xs font-black text-gray-800">{unit.unit_name}</p>
                                                    {unit.unit_code && <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{unit.unit_code}</p>}
                                                </td>
                                                <td className="px-3 py-3 text-center text-xs font-black text-gray-600">{unit.credit_hours}</td>
                                                <td className="px-3 py-3">
                                                    <div className="space-y-0.5">
                                                        {unit.assessments.map(a => (
                                                            <p key={a.id} className="text-[10px] font-bold text-gray-500">
                                                                {a.cat_name}: <span className="text-gray-800">{a.marks}/{a.max_marks}</span>
                                                                <span className="text-gray-400"> · {a.percentage}%</span>
                                                            </p>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 text-center text-xs font-black text-gray-800">{unit.average}%</td>
                                                <td className="px-3 py-3 text-center"><GradeBadge grade={unit.grade} /></td>
                                                <td className="px-3 py-3 text-center text-xs font-black text-gray-600">{Number(unit.grade_points).toFixed(1)}</td>
                                                <td className="px-5 sm:px-7 py-3 text-right text-xs font-black text-maroon">{unit.quality_points}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-gray-50 border-t border-gray-100">
                                            <td className="px-5 sm:px-7 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">Term totals</td>
                                            <td className="px-3 py-3 text-center text-xs font-black text-gray-700">{period.credits}</td>
                                            <td colSpan={2} />
                                            <td className="px-3 py-3 text-center text-[9px] font-black text-gray-400 uppercase">GPA {period.gpa != null ? Number(period.gpa).toFixed(2) : '—'}</td>
                                            <td />
                                            <td className="px-5 sm:px-7 py-3 text-right text-xs font-black text-maroon">{period.quality_points}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </section>
                    ))}

                    {gradeScale && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-[9px] font-black uppercase tracking-widest text-gray-500">
                            <span className="text-maroon">Grading scale</span>
                            <span>Distinction ≥ {gradeScale.distinction}% · {gradeScale.points.Distinction} pts</span>
                            <span>Credit ≥ {gradeScale.credit}% · {gradeScale.points.Credit} pts</span>
                            <span>Pass ≥ {gradeScale.pass}% · {gradeScale.points.Pass} pts</span>
                            <span className="text-red-500">Fail · {gradeScale.points.Fail} pts</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
