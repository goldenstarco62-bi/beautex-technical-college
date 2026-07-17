import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { attendanceAPI, coursesAPI } from '../services/api';
import {
    Calendar, Users, CheckCircle2, XCircle, Clock, TrendingUp,
    Filter, Search, RefreshCw, FileDown, ChevronDown, Award,
    AlertCircle, BarChart3, Star, ArrowUp, ArrowDown, Minus,
    BookOpen, Printer, Activity
} from 'lucide-react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonthLabel(monthKey) {
    if (!monthKey) return '';
    const [y, m] = monthKey.split('-');
    return new Date(parseInt(y), parseInt(m) - 1, 1)
        .toLocaleString('default', { month: 'long', year: 'numeric' });
}

function getStatusStyle(status) {
    switch (status) {
        case 'Excellent':        return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', icon: '✔' };
        case 'Good':             return { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    dot: 'bg-blue-500',    icon: '👍' };
        case 'Fair':             return { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500',   icon: '⚠' };
        case 'Needs Improvement':return { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500',     icon: '⚡' };
        default:                 return { bg: 'bg-gray-50',    text: 'text-gray-600',    border: 'border-gray-200',    dot: 'bg-gray-400',    icon: '—' };
    }
}

function getPctColor(pct) {
    if (pct >= 95) return 'text-emerald-600';
    if (pct >= 85) return 'text-blue-600';
    if (pct >= 75) return 'text-amber-500';
    return 'text-red-500';
}

function getPctBarColor(pct) {
    if (pct >= 95) return 'bg-emerald-500';
    if (pct >= 85) return 'bg-blue-500';
    if (pct >= 75) return 'bg-amber-400';
    return 'bg-red-500';
}

// Generate month options (last 12 months + next 2)
function getMonthOptions() {
    const options = [];
    const now = new Date();
    for (let i = -2; i <= 11; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        options.push({ key, label: d.toLocaleString('default', { month: 'long', year: 'numeric' }) });
    }
    return options;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MonthlyAttendanceSummary() {
    const { user } = useAuth();
    const isStudent = user?.role === 'student';
    const isTeacher = user?.role === 'teacher';

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [loading, setLoading]         = useState(true);
    const [data, setData]               = useState([]);
    const [courses, setCourses]         = useState([]);
    const [selectedMonth, setMonth]     = useState(currentMonth);
    const [selectedCourse, setCourse]   = useState('');
    const [searchQuery, setSearch]      = useState('');
    const [sortBy, setSort]             = useState('student_name');
    const [generatingPDF, setGenPDF]    = useState(false);
    const monthOptions                  = getMonthOptions();

    // ── Fetch ────────────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = { month: selectedMonth, sort: sortBy };
            if (selectedCourse) params.course = selectedCourse;
            const res = await attendanceAPI.getMonthlySummary(params);
            setData(res.data || []);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load monthly attendance data.');
        } finally {
            setLoading(false);
        }
    }, [selectedMonth, selectedCourse, sortBy]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        if (!isStudent) {
            coursesAPI.getAll().then(r => setCourses(r.data || [])).catch(() => {});
        }
    }, [isStudent]);

    // ── Filter ───────────────────────────────────────────────────────────────
    const filtered = data.filter(s => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return true;
        return (s.student_name || '').toLowerCase().includes(q)
            || (s.student_id  || '').toLowerCase().includes(q)
            || (s.course      || '').toLowerCase().includes(q);
    });

    // ── Analytics ────────────────────────────────────────────────────────────
    const totalStudents   = filtered.length;
    const avgPct          = totalStudents > 0
        ? Math.round(filtered.reduce((s, x) => s + x.percentage, 0) / totalStudents * 10) / 10
        : 0;
    const above90         = filtered.filter(s => s.percentage >= 90).length;
    const below75         = filtered.filter(s => s.percentage < 75).length;
    const excellent       = filtered.filter(s => s.status === 'Excellent').length;
    const needsHelp       = filtered.filter(s => s.status === 'Needs Improvement').length;

    // ── PDF ──────────────────────────────────────────────────────────────────
    const handlePDF = async () => {
        setGenPDF(true);
        const tid = toast.loading('Generating PDF…');
        try {
            const el = document.getElementById('monthly-att-pdf');
            if (!el) throw new Error('PDF container not found');
            const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const img    = canvas.toDataURL('image/png');
            const pdf    = new jsPDF('p', 'mm', 'a4');
            const w      = pdf.internal.pageSize.getWidth();
            const h      = pdf.internal.pageSize.getHeight();
            const ratio  = canvas.height / canvas.width;
            const ih     = w * ratio;
            let left  = ih, pos = 0, pg = 1;
            pdf.addImage(img, 'PNG', 0, pos, w, ih);
            left -= h;
            while (left > 0) { pos = -h * pg++; pdf.addPage(); pdf.addImage(img, 'PNG', 0, pos, w, ih); left -= h; }
            pdf.save(`Monthly_Attendance_${getMonthLabel(selectedMonth).replace(/ /g, '_')}.pdf`);
            toast.success('PDF downloaded!', { id: tid });
        } catch (e) {
            console.error(e);
            toast.error('PDF generation failed', { id: tid });
        } finally { setGenPDF(false); }
    };

    // ─── Render ──────────────────────────────────────────────────────────────
    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* ── Page Header ── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 print:hidden">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-maroon to-maroon/70 rounded-2xl flex items-center justify-center shadow-xl">
                        <Calendar className="w-7 h-7 text-gold" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-maroon/40 uppercase tracking-[0.4em] mb-1">Attendance Analytics</p>
                        <h1 className="text-3xl font-black text-maroon uppercase tracking-tight">
                            Monthly Attendance Summary
                        </h1>
                        <p className="text-xs text-gray-400 font-bold mt-0.5">
                            {getMonthLabel(selectedMonth)}
                        </p>
                    </div>
                </div>
                <div className="flex gap-3 flex-wrap">
                    <button onClick={fetchData} disabled={loading}
                        className="bg-white border border-gray-100 rounded-2xl shadow-sm px-5 py-3 text-[9px] font-black uppercase tracking-widest text-maroon flex items-center gap-2 hover:bg-gray-50 transition-all disabled:opacity-50">
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <button onClick={() => window.print()}
                        className="bg-white border border-gray-100 rounded-2xl shadow-sm px-5 py-3 text-[9px] font-black uppercase tracking-widest text-maroon flex items-center gap-2 hover:bg-gray-50 transition-all">
                        <Printer className="w-3.5 h-3.5" />
                        Print
                    </button>
                    <button onClick={handlePDF} disabled={generatingPDF || loading}
                        className="bg-gold text-maroon hover:bg-gold/90 px-5 py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest flex items-center gap-2 shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50">
                        <FileDown className="w-3.5 h-3.5" />
                        Download PDF
                    </button>
                </div>
            </div>

            {/* ── Filters Bar ── */}
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xl print:hidden">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                    {/* Month */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[8px] font-black text-gray-400 uppercase tracking-wider">Select Month</label>
                        <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <select value={selectedMonth} onChange={e => setMonth(e.target.value)}
                                className="w-full bg-gray-50 border-none rounded-2xl text-xs font-bold py-4 pl-12 pr-4 focus:ring-2 focus:ring-maroon/20 transition-all appearance-none">
                                {monthOptions.map(o => (
                                    <option key={o.key} value={o.key}>{o.label}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                    </div>

                    {/* Course (hidden for students) */}
                    {!isStudent && (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[8px] font-black text-gray-400 uppercase tracking-wider">Course Program</label>
                            <div className="relative">
                                <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <select value={selectedCourse} onChange={e => setCourse(e.target.value)}
                                    className="w-full bg-gray-50 border-none rounded-2xl text-xs font-bold py-4 pl-12 pr-4 focus:ring-2 focus:ring-maroon/20 transition-all appearance-none">
                                    <option value="">All Programs</option>
                                    {courses.map(c => (
                                        <option key={c.id || c._id} value={c.name}>{c.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>
                    )}

                    {/* Sort */}
                    {!isStudent && (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[8px] font-black text-gray-400 uppercase tracking-wider">Sort By</label>
                            <div className="relative">
                                <BarChart3 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <select value={sortBy} onChange={e => setSort(e.target.value)}
                                    className="w-full bg-gray-50 border-none rounded-2xl text-xs font-bold py-4 pl-12 pr-4 focus:ring-2 focus:ring-maroon/20 transition-all appearance-none">
                                    <option value="student_name">Student Name</option>
                                    <option value="highest_attendance">Highest Attendance</option>
                                    <option value="lowest_attendance">Lowest Attendance</option>
                                    <option value="most_absent">Most Absent</option>
                                    <option value="most_late">Most Late</option>
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>
                    )}

                    {/* Search */}
                    <div className={`flex flex-col gap-1.5 ${isStudent ? 'md:col-span-3' : ''}`}>
                        <label className="text-[8px] font-black text-gray-400 uppercase tracking-wider">Search Student</label>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input type="text" placeholder="Name, ID or course…"
                                value={searchQuery} onChange={e => setSearch(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-maroon/20 transition-all placeholder:text-gray-400" />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Analytics Cards (admin/teacher only) ── */}
            {!isStudent && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-5 print:grid-cols-5">
                    {[
                        { label: 'Total Students', value: totalStudents, icon: Users,         color: 'text-maroon',      bg: 'bg-maroon/5' },
                        { label: 'Avg Attendance',  value: `${avgPct}%`,  icon: TrendingUp,    color: 'text-blue-600',    bg: 'bg-blue-50'  },
                        { label: 'Above 90%',       value: above90,       icon: Award,         color: 'text-emerald-600', bg: 'bg-emerald-50' },
                        { label: 'Below 75%',       value: below75,       icon: AlertCircle,   color: 'text-red-500',     bg: 'bg-red-50'   },
                        { label: 'Excellent',       value: excellent,     icon: Star,          color: 'text-amber-500',   bg: 'bg-amber-50' },
                    ].map((c, i) => {
                        const Icon = c.icon;
                        return (
                            <div key={i} className="bg-white rounded-3xl p-5 border border-gray-100 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
                                <div className={`w-10 h-10 ${c.bg} rounded-xl flex items-center justify-center mb-3`}>
                                    <Icon className={`w-5 h-5 ${c.color}`} />
                                </div>
                                <p className={`text-2xl font-black ${c.color}`}>{c.value}</p>
                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-1">{c.label}</p>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Status Legend ── */}
            {!isStudent && filtered.length > 0 && (
                <div className="flex flex-wrap gap-3 print:hidden">
                    {['Excellent', 'Good', 'Fair', 'Needs Improvement'].map(s => {
                        const st = getStatusStyle(s);
                        const count = filtered.filter(x => x.status === s).length;
                        return (
                            <div key={s} className={`flex items-center gap-2 px-4 py-2 rounded-2xl border ${st.border} ${st.bg}`}>
                                <div className={`w-2 h-2 rounded-full ${st.dot}`} />
                                <span className={`text-[9px] font-black uppercase tracking-widest ${st.text}`}>{s}</span>
                                <span className={`text-[10px] font-black ${st.text} opacity-60`}>{count}</span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── PDF Export Container (hidden visually but rendered) ── */}
            <div id="monthly-att-pdf" style={{ position: 'absolute', left: '-9999px', top: 0, width: '794px', background: '#ffffff', backgroundColor: '#ffffff' }}>
                <div style={{ padding: 32, fontFamily: 'Arial, sans-serif', backgroundColor: '#fff' }}>
                    <div style={{ borderBottom: '3px solid #800000', paddingBottom: 16, marginBottom: 24 }}>
                        <h1 style={{ color: '#800000', fontSize: 22, fontWeight: 900, margin: 0 }}>MONTHLY ATTENDANCE SUMMARY</h1>
                        <p style={{ color: '#666', fontSize: 12, margin: '4px 0 0' }}>{getMonthLabel(selectedMonth)} — Generated {new Date().toLocaleDateString()}</p>
                        {selectedCourse && <p style={{ color: '#666', fontSize: 11 }}>Course: {selectedCourse}</p>}
                    </div>
                    {filtered.map((s, i) => {
                        const st = getStatusStyle(s.status);
                        return (
                            <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <div>
                                        <p style={{ fontWeight: 900, fontSize: 14, color: '#1f2937', margin: 0 }}>{s.student_name}</p>
                                        <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0', fontFamily: 'monospace' }}>{s.student_id}</p>
                                        <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>{s.course}</p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ fontSize: 28, fontWeight: 900, color: '#800000', margin: 0 }}>{s.percentage}%</p>
                                        <p style={{ fontSize: 10, color: '#6b7280', margin: '2px 0 0' }}>Attendance Rate</p>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                                    {[
                                        { l: 'Total Classes', v: s.total,   c: '#1f2937' },
                                        { l: 'Present',       v: s.present, c: '#059669' },
                                        { l: 'Absent',        v: s.absent,  c: '#dc2626' },
                                        { l: 'Late',          v: s.late,    c: '#d97706' },
                                    ].map((x, j) => (
                                        <div key={j} style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                                            <p style={{ fontSize: 18, fontWeight: 900, color: x.c, margin: 0 }}>{x.v}</p>
                                            <p style={{ fontSize: 9, color: '#9ca3af', margin: 0, textTransform: 'uppercase' }}>{x.l}</p>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ marginTop: 12, padding: '8px 12px', background: '#f0fdf4', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 11, fontWeight: 900, color: '#059669' }}>{st.icon} {s.status} Attendance</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Student Cards Grid ── */}
            {loading ? (
                <div className="py-24 text-center">
                    <RefreshCw className="w-8 h-8 animate-spin text-maroon mx-auto mb-4" />
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Loading monthly attendance data…</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-16 text-center">
                    <Calendar className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                    <p className="text-sm font-black text-gray-400 uppercase tracking-widest">No attendance records found</p>
                    <p className="text-xs text-gray-300 mt-2 font-medium">for {getMonthLabel(selectedMonth)}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filtered.map((student, idx) => {
                        const st  = getStatusStyle(student.status);
                        const pct = student.percentage;
                        const barColor = getPctBarColor(pct);
                        const pctColor = getPctColor(pct);
                        return (
                            <div key={`${student.student_id}-${idx}`}
                                className="bg-white rounded-3xl border border-gray-100 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group">
                                {/* Card Top Bar */}
                                <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg,#800000,#c0392b)' }} />

                                <div className="p-6">
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-5">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-black text-gray-800 truncate">{student.student_name}</p>
                                            <p className="text-[10px] text-gray-400 font-mono mt-0.5">{student.student_id}</p>
                                            <p className="text-[10px] text-gray-500 font-medium mt-1 truncate">{student.course}</p>
                                        </div>
                                        {/* Big percentage */}
                                        <div className="text-right shrink-0 ml-3">
                                            <p className={`text-3xl font-black leading-none ${pctColor}`}>{pct}%</p>
                                            <p className="text-[8px] text-gray-400 font-black uppercase tracking-widest mt-1">Attendance</p>
                                        </div>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="mb-5">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">
                                                {getMonthLabel(student.month)}
                                            </span>
                                            <span className="text-[8px] font-bold text-gray-400">{student.total} classes total</span>
                                        </div>
                                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${barColor} rounded-full transition-all duration-700 ease-out`}
                                                style={{ width: `${Math.min(pct, 100)}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-3 gap-3 mb-5">
                                        {[
                                            { label: 'Present', value: student.present, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle2 },
                                            { label: 'Absent',  value: student.absent,  color: 'text-red-500',     bg: 'bg-red-50',     icon: XCircle     },
                                            { label: 'Late',    value: student.late,    color: 'text-amber-500',   bg: 'bg-amber-50',   icon: Clock       },
                                        ].map((stat, i) => {
                                            const SIcon = stat.icon;
                                            return (
                                                <div key={i} className={`${stat.bg} rounded-2xl p-3 text-center`}>
                                                    <SIcon className={`w-4 h-4 ${stat.color} mx-auto mb-1`} />
                                                    <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
                                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{stat.label}</p>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Status Badge */}
                                    <div className={`flex items-center justify-between px-4 py-2.5 rounded-2xl border ${st.border} ${st.bg}`}>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${st.dot}`} />
                                            <span className={`text-[9px] font-black uppercase tracking-widest ${st.text}`}>
                                                {st.icon} {student.status}
                                            </span>
                                        </div>
                                        {student.total === 0 && (
                                            <span className="text-[8px] font-bold text-gray-400 italic">No records yet</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── At Risk Students Alert (admin/teacher) ── */}
            {!isStudent && needsHelp > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-3xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                        <h3 className="text-sm font-black text-red-700 uppercase tracking-widest">
                            Students Requiring Intervention ({needsHelp})
                        </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {filtered
                            .filter(s => s.status === 'Needs Improvement')
                            .map((s, i) => (
                                <div key={i} className="flex items-center justify-between bg-white rounded-2xl p-4 border border-red-100">
                                    <div>
                                        <p className="text-xs font-black text-gray-800">{s.student_name}</p>
                                        <p className="text-[9px] text-gray-400 font-mono">{s.student_id}</p>
                                        <p className="text-[9px] text-gray-400">{s.course}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-red-500">{s.percentage}%</p>
                                        <p className="text-[8px] text-red-400 font-bold uppercase">At Risk</p>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {/* ── Print Header (print only) ── */}
            <div className="hidden print:flex items-center justify-between border-b-2 border-maroon pb-4 mb-6">
                <div>
                    <h1 className="text-2xl font-black text-maroon uppercase">Monthly Attendance Summary</h1>
                    <p className="text-sm text-gray-500">{getMonthLabel(selectedMonth)}</p>
                </div>
                <p className="text-xs text-gray-400">Generated: {new Date().toLocaleDateString()}</p>
            </div>
        </div>
    );
}
