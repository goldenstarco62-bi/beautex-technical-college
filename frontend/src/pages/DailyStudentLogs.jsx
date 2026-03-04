import { useState, useEffect } from 'react';
import {
    FileText,
    Search,
    Calendar,
    User,
    BookOpen,
    Filter,
    Download,
    Trash2,
    ChevronLeft,
    ChevronRight,
    MessageSquare,
    History,
    Printer,
    Eye,
    X,
    FileDown,
    Shield,
    ThumbsUp,
    ThumbsDown,
    Minus,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Send
} from 'lucide-react';
import { studentDailyReportsAPI, coursesAPI, studentsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Helper: normalize course display
const formatCourse = (course) => {
    if (!course) return '';
    if (typeof course === 'string' && course.startsWith('{') && course.endsWith('}')) {
        return course.slice(1, -1).replace(/"/g, '');
    }
    if (typeof course === 'string' && course.startsWith('[') && course.endsWith(']')) {
        try {
            const parsed = JSON.parse(course);
            return Array.isArray(parsed) ? parsed.join(', ') : parsed;
        } catch (e) { return course; }
    }
    return course;
};

// Helper: decode lesson_taught into a display-ready badge spec
const getLessonBadge = (log) => {
    const lt = log.lesson_taught;
    if (lt === null || lt === undefined) return null;
    if (lt === true || lt === 1) return { label: 'Lesson Taught', short: 'Taught', color: 'bg-green-50 text-green-600 border-green-200', printColor: '#16a34a', Icon: ThumbsUp };
    if (lt === false || lt === 0) return { label: 'Not Taught', short: 'Not Taught', color: 'bg-red-50 text-red-500 border-red-200', printColor: '#dc2626', Icon: ThumbsDown };
    return { label: 'Partially Taught', short: 'Partial', color: 'bg-amber-50 text-amber-600 border-amber-200', printColor: '#d97706', Icon: Minus };
};

export default function DailyStudentLogs() {
    const { user } = useAuth();
    const [logs, setLogs] = useState([]);
    const [courses, setCourses] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewingLog, setViewingLog] = useState(null);
    const [isPrinting, setIsPrinting] = useState(false);
    const [printingLog, setPrintingLog] = useState(null);

    const [filters, setFilters] = useState({
        student_id: '',
        course: '',
        date: '',
        search: '',
        has_feedback: ''         // 'yes' | 'no' | ''
    });

    const [stats, setStats] = useState({
        totalEntries: 0,
        uniqueStudents: 0,
        withFeedback: 0
    });

    const isAdmin = ['admin', 'superadmin'].includes(user?.role);
    const isTeacher = user?.role === 'teacher';
    const isStudent = user?.role === 'student';

    useEffect(() => { fetchInitialData(); }, []);
    useEffect(() => { fetchLogs(); }, [filters]);

    const fetchInitialData = async () => {
        try {
            const [coursesRes, studentsRes] = await Promise.all([
                coursesAPI.getAll(),
                studentsAPI.getAll()
            ]);
            setCourses(coursesRes.data || []);
            setStudents(studentsRes.data || []);
        } catch (error) {
            console.error('Error fetching initial data:', error);
            toast.error('Failed to load filter options');
        }
    };

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const { data } = await studentDailyReportsAPI.getAll(filters);
            setLogs(data || []);

            const uniqueSids = new Set(data.map(l => l.student_id));
            const withFeedback = data.filter(l => l.lesson_taught !== null && l.lesson_taught !== undefined).length;
            setStats({ totalEntries: data.length, uniqueStudents: uniqueSids.size, withFeedback });
        } catch (error) {
            console.error('Error fetching logs:', error);
            toast.error('Failed to load daily logs');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to remove this academic log entry?')) return;
        try {
            await studentDailyReportsAPI.delete(id);
            toast.success('Log entry removed');
            fetchLogs();
        } catch (error) {
            toast.error('Failed to delete log');
        }
    };

    const handlePrint = (log) => {
        setPrintingLog(log);
        setTimeout(() => { window.print(); setPrintingLog(null); }, 1000);
    };

    const handleDownloadPDF = async (log) => {
        setPrintingLog(log);
        toast.loading('Generating Academic Document...', { id: 'pdf-gen' });
        setTimeout(async () => {
            const element = document.getElementById('log-print-view');
            if (!element) return;
            try {
                const canvas = await html2canvas(element, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                const imgProps = pdf.getImageProperties(imgData);
                const ratio = imgProps.height / imgProps.width;
                const renderedH = pdfWidth * ratio;
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, Math.min(renderedH, pdfHeight));
                pdf.save(`Academic_Log_${log.student_name}_${new Date(log.report_date).toLocaleDateString()}.pdf`);
                toast.success('Document Generated', { id: 'pdf-gen' });
            } catch (error) {
                console.error('PDF Error:', error);
                toast.error('Failed to generate PDF', { id: 'pdf-gen' });
            } finally {
                setPrintingLog(null);
            }
        }, 1000);
    };

    const handleFilterChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    // Client-side search + has_feedback filter
    const filteredLogs = logs.filter(l => {
        const searchMatch =
            l.student_name.toLowerCase().includes(filters.search.toLowerCase()) ||
            l.student_id.toLowerCase().includes(filters.search.toLowerCase()) ||
            l.topics_covered.toLowerCase().includes(filters.search.toLowerCase());

        const hasFB = l.lesson_taught !== null && l.lesson_taught !== undefined;
        const feedbackMatch =
            filters.has_feedback === 'yes' ? hasFB :
                filters.has_feedback === 'no' ? !hasFB :
                    true;

        return searchMatch && feedbackMatch;
    });

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-maroon/[0.02] rounded-full translate-x-1/2 -translate-y-1/2 blur-2xl" />
                <div>
                    <h1 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">Student Daily Ledger</h1>
                    <p className="text-sm text-gray-400 font-medium">Beautex Academic Audit • Daily Progress Journals</p>
                </div>
                {!isStudent && (
                    <div className="flex gap-4 w-full md:w-auto">
                        <div className="bg-maroon/5 px-6 py-4 rounded-2xl flex flex-col items-center justify-center min-w-[100px]">
                            <p className="text-[9px] font-black text-maroon/40 uppercase tracking-widest mb-1">Total Logs</p>
                            <p className="text-xl font-black text-maroon">{stats.totalEntries}</p>
                        </div>
                        <div className="bg-gold/10 px-6 py-4 rounded-2xl flex flex-col items-center justify-center min-w-[100px]">
                            <p className="text-[9px] font-black text-maroon/40 uppercase tracking-widest mb-1">Students</p>
                            <p className="text-xl font-black text-maroon">{stats.uniqueStudents}</p>
                        </div>
                        <div className="bg-blue-50 px-6 py-4 rounded-2xl flex flex-col items-center justify-center min-w-[100px]">
                            <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Feedback</p>
                            <p className="text-xl font-black text-blue-600">{stats.withFeedback}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Filters ── */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                    {/* Search */}
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <Search className="w-3 h-3" /> Quick Search
                        </label>
                        <input
                            name="search"
                            value={filters.search}
                            onChange={handleFilterChange}
                            placeholder="Student, ID, or Topic..."
                            className="w-full px-5 py-3.5 bg-gray-50 border-transparent rounded-xl text-xs font-bold text-gray-700 focus:bg-white focus:border-maroon/20 transition-all outline-none"
                        />
                    </div>

                    {/* Course */}
                    {!isStudent && (
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <BookOpen className="w-3 h-3" /> Course
                            </label>
                            <select
                                name="course"
                                value={filters.course}
                                onChange={handleFilterChange}
                                className="w-full px-5 py-3.5 bg-gray-50 border-transparent rounded-xl text-xs font-bold text-gray-700 focus:bg-white focus:border-maroon/20 outline-none cursor-pointer"
                            >
                                <option value="">All Departments</option>
                                {courses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            </select>
                        </div>
                    )}

                    {/* Date */}
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <Calendar className="w-3 h-3" /> Date
                        </label>
                        <input
                            type="date"
                            name="date"
                            value={filters.date}
                            onChange={handleFilterChange}
                            className="w-full px-5 py-3.5 bg-gray-50 border-transparent rounded-xl text-xs font-bold text-gray-700 focus:bg-white focus:border-maroon/20 outline-none"
                        />
                    </div>

                    {/* Student Feedback Filter */}
                    {!isStudent && (
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <MessageSquare className="w-3 h-3" /> Student Feedback
                            </label>
                            <select
                                name="has_feedback"
                                value={filters.has_feedback}
                                onChange={handleFilterChange}
                                className="w-full px-5 py-3.5 bg-gray-50 border-transparent rounded-xl text-xs font-bold text-gray-700 focus:bg-white focus:border-maroon/20 outline-none cursor-pointer"
                            >
                                <option value="">All Entries</option>
                                <option value="yes">With Feedback</option>
                                <option value="no">No Feedback Yet</option>
                            </select>
                        </div>
                    )}

                    {/* Clear */}
                    <div className="flex items-end">
                        <button
                            onClick={() => setFilters({ student_id: '', course: '', date: '', search: '', has_feedback: '' })}
                            className="w-full h-[47px] bg-maroon/5 text-maroon rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-maroon hover:text-white transition-all flex items-center justify-center gap-2"
                        >
                            <Filter className="w-3.5 h-3.5" /> Clear Filters
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Logs Table ── */}
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="px-8 py-6 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest">Entry Date</th>
                                <th className="px-8 py-6 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest">Student Information</th>
                                <th className="px-8 py-6 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest">Daily Coverage Detail</th>
                                {!isStudent && (
                                    <th className="px-8 py-6 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest">Student Feedback</th>
                                )}
                                <th className="px-8 py-6 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest">Lead Trainer</th>
                                <th className="px-8 py-6 text-right text-[9px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={isStudent ? 4 : 5} className="px-8 py-20 text-center text-maroon font-black uppercase tracking-widest animate-pulse">
                                        Syncing Ledger...
                                    </td>
                                </tr>
                            ) : filteredLogs.length > 0 ? (
                                filteredLogs.map((log) => {
                                    const badge = getLessonBadge(log);
                                    return (
                                        <tr key={log.id || log._id} className="hover:bg-gray-50/50 transition-colors group">
                                            {/* Date */}
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-3 h-3 text-maroon/30" />
                                                    <span className="text-[11px] font-black text-gray-600">
                                                        {new Date(log.report_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Student */}
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-maroon/5 rounded-xl flex items-center justify-center text-maroon font-black text-xs">
                                                        {log.student_name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-gray-800 uppercase leading-none mb-1">{log.student_name}</p>
                                                        <p className="text-[10px] text-gray-400 font-bold tracking-widest">{log.student_id} • {formatCourse(log.course)}</p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Coverage */}
                                            <td className="px-8 py-6 max-w-xs">
                                                <div className="space-y-2">
                                                    <p className="text-xs text-gray-600 font-medium leading-relaxed line-clamp-2 italic">"{log.topics_covered}"</p>
                                                    {log.trainer_remarks && (
                                                        <div className="flex items-start gap-2 bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                                                            <MessageSquare className="w-3 h-3 text-maroon mt-0.5" />
                                                            <p className="text-[10px] text-gray-400 font-bold line-clamp-1">{log.trainer_remarks}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Student Feedback Column (teachers/admins only) */}
                                            {!isStudent && (
                                                <td className="px-8 py-6 max-w-[220px]">
                                                    {badge ? (
                                                        <div className="space-y-2">
                                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest ${badge.color}`}>
                                                                <badge.Icon className="w-3 h-3" />
                                                                {badge.label}
                                                            </span>
                                                            {log.student_comment && (
                                                                <div className="flex gap-1.5 items-start bg-blue-50/80 px-2.5 py-2 rounded-lg border border-blue-100">
                                                                    <Send className="w-2.5 h-2.5 text-blue-400 mt-0.5 shrink-0" />
                                                                    <p className="text-[9px] text-blue-500 font-bold italic line-clamp-2">"{log.student_comment}"</p>
                                                                </div>
                                                            )}
                                                            {log.student_commented_at && (
                                                                <p className="text-[8px] text-gray-300 font-bold uppercase tracking-widest">
                                                                    {new Date(log.student_commented_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[9px] font-black text-gray-200 uppercase tracking-widest">No feedback yet</span>
                                                    )}
                                                </td>
                                            )}

                                            {/* Trainer */}
                                            <td className="px-8 py-6">
                                                <div>
                                                    <p className="text-xs font-bold text-gray-700">{log.trainer_name}</p>
                                                    <p className="text-[9px] text-gray-400 font-medium">{log.trainer_email}</p>
                                                </div>
                                            </td>

                                            {/* Actions */}
                                            <td className="px-8 py-6 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => setViewingLog(log)}
                                                        className="p-2 text-gray-400 hover:text-maroon hover:bg-maroon/5 rounded-xl transition-all"
                                                        title="View Full Report"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDownloadPDF(log)}
                                                        className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                                                        title="Download PDF"
                                                    >
                                                        <FileDown className="w-4 h-4" />
                                                    </button>
                                                    {(isAdmin || isTeacher) && (
                                                        <button
                                                            onClick={() => handleDelete(log.id || log._id)}
                                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                            title="Delete Log"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={isStudent ? 4 : 6} className="px-8 py-32 text-center">
                                        <div className="flex flex-col items-center justify-center grayscale opacity-30">
                                            <History className="w-16 h-16 mb-4" />
                                            <p className="text-[11px] font-black uppercase tracking-[0.3em]">No academic logs matching your criteria</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── View Modal ── */}
            {viewingLog && (() => {
                const badge = getLessonBadge(viewingLog);
                return (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-maroon/20 backdrop-blur-xl" onClick={() => setViewingLog(null)} />
                        <div className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                            {/* Modal Header */}
                            <div className="p-10 border-b border-gray-100 flex justify-between items-center bg-maroon/[0.02]">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-maroon/5 flex items-center justify-center text-maroon">
                                        <FileText className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-maroon uppercase tracking-tight">Academic Journal Entry</h2>
                                        <p className="text-[10px] text-maroon/40 font-black uppercase tracking-[0.3em]">Beautex Official Record</p>
                                    </div>
                                </div>
                                <button onClick={() => setViewingLog(null)} className="p-3 bg-white hover:bg-maroon hover:text-white rounded-2xl transition-all border border-gray-100">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-10 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                                {/* Meta */}
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Student Information</p>
                                        <p className="text-sm font-black text-gray-800 uppercase">{viewingLog.student_name}</p>
                                        <p className="text-[10px] font-bold text-gray-400">{viewingLog.student_id} • {formatCourse(viewingLog.course)}</p>
                                    </div>
                                    <div className="space-y-1 text-right">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Session Date</p>
                                        <p className="text-sm font-black text-gray-800 uppercase">
                                            {new Date(viewingLog.report_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                        </p>
                                    </div>
                                </div>

                                {/* Coverage */}
                                <div className="space-y-4">
                                    <div className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100">
                                        <p className="text-[10px] font-black text-maroon/40 uppercase tracking-widest mb-3">Today's Topics & Coverage</p>
                                        <p className="text-sm text-gray-700 font-medium leading-relaxed italic">"{viewingLog.topics_covered}"</p>
                                    </div>

                                    {viewingLog.trainer_remarks && (
                                        <div className="p-6 bg-gold/5 rounded-[2rem] border border-gold/10">
                                            <p className="text-[10px] font-black text-maroon/40 uppercase tracking-widest mb-3">Trainer's Insight & Observations</p>
                                            <p className="text-sm text-gray-600 font-medium leading-relaxed italic">"{viewingLog.trainer_remarks}"</p>
                                        </div>
                                    )}
                                </div>

                                {/* ── Student Feedback Section ── */}
                                {!isStudent && (
                                    <div className={`p-6 rounded-[2rem] border-2 ${badge ? 'border-blue-100 bg-blue-50/40' : 'border-dashed border-gray-200 bg-gray-50/50'}`}>
                                        <div className="flex items-center gap-2 mb-4">
                                            <MessageSquare className="w-4 h-4 text-blue-400" />
                                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Student Feedback</p>
                                        </div>

                                        {badge ? (
                                            <div className="space-y-4">
                                                {/* Lesson status */}
                                                <div className="flex items-center gap-3">
                                                    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border font-black text-[10px] uppercase tracking-widest ${badge.color}`}>
                                                        <badge.Icon className="w-4 h-4" />
                                                        {badge.label}
                                                    </span>
                                                    {viewingLog.student_commented_at && (
                                                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                                                            Submitted: {new Date(viewingLog.student_commented_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </span>
                                                    )}
                                                </div>
                                                {/* Written comment */}
                                                {viewingLog.student_comment && (
                                                    <div className="bg-white border border-blue-100 rounded-2xl px-5 py-4 flex gap-3 items-start">
                                                        <Send className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                                                        <div>
                                                            <p className="text-[9px] font-black text-blue-300 uppercase tracking-widest mb-1">Student's Note</p>
                                                            <p className="text-sm text-gray-600 font-medium italic leading-relaxed">"{viewingLog.student_comment}"</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-400 font-medium italic">This student has not submitted feedback for this session yet.</p>
                                        )}
                                    </div>
                                )}

                                {/* Footer */}
                                <div className="pt-8 border-t border-gray-100 flex justify-between items-end">
                                    <div>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Authenticating Trainer</p>
                                        <p className="text-xs font-black text-maroon uppercase">{viewingLog.trainer_name}</p>
                                        <p className="text-[10px] font-bold text-gray-400">{viewingLog.trainer_email}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleDownloadPDF(viewingLog)}
                                            className="px-6 py-3 bg-maroon text-gold rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-maroon/20"
                                        >
                                            <FileDown className="w-4 h-4" /> Download PDF
                                        </button>
                                        <button
                                            onClick={() => handlePrint(viewingLog)}
                                            className="px-6 py-3 bg-gray-50 text-maroon rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 border border-gray-100"
                                        >
                                            <Printer className="w-4 h-4" /> Print
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── Hidden Print / PDF View ── */}
            {printingLog && (() => {
                const badge = getLessonBadge(printingLog);
                return (
                    <div id="log-print-view" className="fixed inset-0 bg-white z-[-1] p-[20mm] font-serif overflow-visible print:relative print:z-50 print:block">
                        <div className="border-[6px] border-double border-maroon p-[10mm] min-h-[257mm] flex flex-col justify-between">
                            <div>
                                {/* Letterhead */}
                                <div className="text-center mb-10 pb-10 border-b-2 border-maroon">
                                    <div className="flex flex-col items-center mb-6">
                                        <img src="/logo.jpg" alt="College Logo" className="w-24 h-24 object-contain mb-4" />
                                        <h1 className="text-3xl font-black text-maroon uppercase tracking-tight mb-1">Beautex Technical Training College</h1>
                                        <p className="text-[11px] font-bold text-gray-500 tracking-[0.3em] uppercase">Excellence in Vocational Training</p>
                                    </div>
                                    <div className="w-24 h-1 bg-gold mx-auto mb-6" />
                                    <h2 className="text-xl font-black text-black uppercase tracking-[0.2em] bg-gray-50 inline-block px-8 py-2 rounded-full border border-gray-100">
                                        Official Academic Journal Log
                                    </h2>
                                </div>

                                {/* Record Header */}
                                <div className="grid grid-cols-2 gap-12 mb-12">
                                    <div className="space-y-4">
                                        <div className="pb-3 border-b border-maroon/10">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Learner Name</p>
                                            <p className="text-xl font-bold text-maroon uppercase">{printingLog.student_name}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Enrollment ID</p>
                                            <p className="text-sm font-black text-black">{printingLog.student_id}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Module / Course</p>
                                            <p className="text-sm font-black text-black uppercase">{formatCourse(printingLog.course)}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-4 text-right">
                                        <div className="pb-3 border-b border-maroon/10">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Entry Date</p>
                                            <p className="text-xl font-bold text-maroon">{new Date(printingLog.report_date).toLocaleDateString('en-GB')}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Authenticating Trainer</p>
                                            <p className="text-sm font-black text-black uppercase">{printingLog.trainer_name}</p>
                                            <p className="text-[10px] font-bold text-gray-400">{printingLog.trainer_email}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="space-y-10">
                                    {/* Coverage */}
                                    <div className="bg-gray-50 p-8 rounded-3xl border border-gray-200">
                                        <div className="flex items-center gap-3 mb-6">
                                            <History className="w-5 h-5 text-maroon" />
                                            <h3 className="text-xs font-black text-maroon uppercase tracking-widest">Daily Academic Coverage</h3>
                                        </div>
                                        <p className="text-sm text-gray-800 leading-relaxed font-serif whitespace-pre-wrap min-h-[100px]">
                                            {printingLog.topics_covered}
                                        </p>
                                    </div>

                                    {/* Trainer remarks */}
                                    {printingLog.trainer_remarks && (
                                        <div className="bg-maroon/[0.02] p-8 rounded-3xl border border-maroon/5 border-l-4 border-l-maroon">
                                            <div className="flex items-center gap-3 mb-6">
                                                <Shield className="w-5 h-5 text-maroon" />
                                                <h3 className="text-xs font-black text-maroon uppercase tracking-widest">Professional Remarks & Assessment</h3>
                                            </div>
                                            <p className="text-sm text-gray-700 italic leading-relaxed font-serif whitespace-pre-wrap">
                                                {printingLog.trainer_remarks}
                                            </p>
                                        </div>
                                    )}

                                    {/* Student Feedback in print */}
                                    <div className={`p-8 rounded-3xl border ${badge ? 'bg-blue-50/30 border-blue-200' : 'bg-gray-50 border-gray-200 border-dashed'}`}>
                                        <div className="flex items-center gap-3 mb-6">
                                            <MessageSquare className="w-5 h-5 text-blue-400" />
                                            <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest">Student Lesson Verification</h3>
                                        </div>
                                        {badge ? (
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm font-black uppercase tracking-widest" style={{ color: badge.printColor }}>
                                                        ● {badge.label}
                                                    </span>
                                                    {printingLog.student_commented_at && (
                                                        <span className="text-[10px] text-gray-400 font-bold uppercase">
                                                            — {new Date(printingLog.student_commented_at).toLocaleDateString('en-GB')}
                                                        </span>
                                                    )}
                                                </div>
                                                {printingLog.student_comment && (
                                                    <blockquote className="text-sm text-gray-600 italic pl-4 border-l-4 border-blue-300 leading-relaxed font-serif">
                                                        "{printingLog.student_comment}"
                                                    </blockquote>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-400 italic">No student feedback submitted for this session.</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="mt-20 pt-10 border-t border-maroon/10 text-center">
                                <div className="grid grid-cols-2 gap-20 mb-10">
                                    <div className="text-center">
                                        <div className="h-[40px] border-b border-gray-300 mb-2" />
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Lead Trainer Signature</p>
                                    </div>
                                    <div className="text-center">
                                        <div className="h-[40px] border-b border-gray-300 mb-2" />
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Registry Verification Stamp</p>
                                    </div>
                                </div>
                                <p className="text-[10px] font-black text-maroon uppercase tracking-widest mb-1">
                                    Beautex Technical Training College - Registry Records
                                </p>
                                <p className="text-[8px] text-gray-400 uppercase tracking-widest">
                                    Report Generated: {new Date().toLocaleString()} | Digital Serial No: BTX-{Math.random().toString(36).substr(2, 9).toUpperCase()}
                                </p>
                            </div>
                        </div>
                    </div>
                );
            })()}

            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #log-print-view, #log-print-view * { visibility: visible; }
                    #log-print-view { position: absolute; left: 0; top: 0; }
                    .custom-scrollbar::-webkit-scrollbar { display: none; }
                }
            `}</style>
        </div>
    );
}
