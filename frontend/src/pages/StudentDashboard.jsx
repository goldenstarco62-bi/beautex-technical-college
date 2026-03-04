import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    BookOpen,
    Award,
    Clock,
    Zap,
    FileText,
    UserCheck,
    GraduationCap,
    CreditCard,
    History,
    MessageSquare,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Send,
    X,
    ThumbsUp,
    ThumbsDown,
    Minus
} from 'lucide-react';
import {
    coursesAPI,
    gradesAPI,
    announcementsAPI,
    attendanceAPI,
    studentsAPI,
    materialsAPI,
    studentDailyReportsAPI
} from '../services/api';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';


export default function StudentDashboard() {
    const { user } = useAuth();
    const [studentProfile, setStudentProfile] = useState(null);
    const [courseDetails, setCourseDetails] = useState(null);
    const [stats, setStats] = useState({
        enrolledCourses: 0,
        avgGrade: 'N/A',
        attendanceRate: '0%',
        sessionsCount: 0
    });
    const [recentAnnouncements, setRecentAnnouncements] = useState([]);
    const [recentGrades, setRecentGrades] = useState([]);
    const [studentFee, setStudentFee] = useState(null);
    const [dailyReports, setDailyReports] = useState([]);
    const [loading, setLoading] = useState(true);

    // Comment Dialog State
    const [commentDialog, setCommentDialog] = useState(null);
    const [lessonTaught, setLessonTaught] = useState(null);   // true | false | 'partial'
    const [commentText, setCommentText] = useState('');
    const [submittingComment, setSubmittingComment] = useState(false);


    useEffect(() => {
        if (user) fetchData();
    }, [user]);

    const fetchData = async () => {
        try {
            const [studentsRes, coursesRes, announcementsRes, gradesRes, feeRes, , dailyReportsRes] = await Promise.all([
                studentsAPI.getAll(),
                coursesAPI.getAll(),
                announcementsAPI.getAll(),
                gradesAPI.getAll(),
                api.get(`/finance/student-fees/${user.student_id || user.id}`).catch(() => ({ data: null })),
                materialsAPI.getAll().catch(() => ({ data: [] })),
                studentDailyReportsAPI.getAll({ student_id: user.student_id || user.id }).catch(() => ({ data: [] }))
            ]);

            const userEmail = String(user?.email || '').toLowerCase().trim();
            const userSid = String(user?.student_id || user?.id || '').toLowerCase().trim();

            const profile = studentsRes.data.find(s =>
                String(s.email || '').toLowerCase().trim() === userEmail ||
                String(s.id || '').toLowerCase().trim() === userSid
            ) || studentsRes.data[0];

            setStudentProfile(profile);
            setStudentFee(feeRes.data);
            setDailyReports(Array.isArray(dailyReportsRes.data) ? dailyReportsRes.data.slice(0, 5) : []);

            const myGrades = (gradesRes.data || []).filter(g => {
                const gSid = String(g.student_id || '').trim().toLowerCase();
                const gEmail = String(g.email || '').trim().toLowerCase();
                return gSid === userSid || gEmail === userEmail;
            }).map(g => ({
                ...g,
                type: 'CAT',
                displayDate: g.month,
                performance: g.remarks,
                rawDate: g.created_at
            }));

            setRecentGrades([...myGrades].sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate)).slice(0, 5));

            const avgGrade = myGrades.length > 0
                ? Math.round((myGrades.reduce((acc, g) => acc + (g.score / g.max_score), 0) / myGrades.length) * 100)
                : 0;

            const attendanceRes = await attendanceAPI.getAll(null, null, user.student_id || user.id).catch(() => ({ data: [] }));
            const myAttendance = Array.isArray(attendanceRes.data) ? attendanceRes.data : [];
            const presentCount = myAttendance.filter(a => a.status === 'Present' || a.status === 'Late').length;
            const attendanceRate = myAttendance.length > 0
                ? `${Math.round((presentCount / myAttendance.length) * 100)}%`
                : '0%';

            if (profile) {
                const enrolledCourses = Array.isArray(coursesRes.data) ? coursesRes.data : [];
                setCourseDetails(enrolledCourses[0] || null);
                setStats({
                    enrolledCourses: enrolledCourses.length,
                    avgGrade: myGrades.length > 0 ? `${avgGrade}%` : (profile.gpa ? `${profile.gpa} GPA` : 'N/A'),
                    attendanceRate,
                    sessionsCount: Array.isArray(dailyReportsRes.data) ? dailyReportsRes.data.length : 0
                });
            }

            setRecentAnnouncements((announcementsRes.data || []).slice(0, 3));
        } catch (error) {
            console.error('Error fetching student dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    // ─── Comment dialog helpers ───────────────────────────────────────────────
    const openCommentDialog = (report) => {
        setCommentDialog(report);
        const lt = report.lesson_taught;
        if (lt === true || lt === 1) setLessonTaught(true);
        else if (lt === false || lt === 0) setLessonTaught(false);
        else if (lt === null || lt === undefined) setLessonTaught(null);
        else setLessonTaught('partial');
        setCommentText(report.student_comment || '');
    };

    const closeCommentDialog = () => {
        setCommentDialog(null);
        setLessonTaught(null);
        setCommentText('');
    };

    const handleCommentSubmit = async () => {
        if (lessonTaught === null) {
            toast.error('Please select whether the lesson was taught.');
            return;
        }
        try {
            setSubmittingComment(true);
            // 'partial' maps to null on the backend (nullable boolean)
            const boolVal = lessonTaught === 'partial' ? null : lessonTaught;
            await studentDailyReportsAPI.addStudentComment(
                commentDialog.id || commentDialog._id,
                { lesson_taught: boolVal, student_comment: commentText.trim() || null }
            );
            toast.success('Your feedback has been recorded!');
            setDailyReports(prev => prev.map(r => {
                if (String(r.id || r._id) === String(commentDialog.id || commentDialog._id)) {
                    return { ...r, lesson_taught: boolVal, student_comment: commentText.trim() || null, student_commented_at: new Date().toISOString() };
                }
                return r;
            }));
            closeCommentDialog();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Could not save your feedback.');
        } finally {
            setSubmittingComment(false);
        }
    };

    const getLessonBadge = (report) => {
        const lt = report.lesson_taught;
        if (lt === null || lt === undefined) return null;
        if (lt === true || lt === 1) return { label: 'Lesson Taught', color: 'bg-green-50 text-green-600 border-green-100', Icon: ThumbsUp };
        if (lt === false || lt === 0) return { label: 'Not Taught', color: 'bg-red-50 text-red-500 border-red-100', Icon: ThumbsDown };
        return { label: 'Partially Taught', color: 'bg-amber-50 text-amber-600 border-amber-100', Icon: Minus };
    };
    // ─────────────────────────────────────────────────────────────────────────

    if (loading) return <div className="p-8 text-center font-black uppercase tracking-widest text-maroon">Loading Student Portal...</div>;

    const statsConfig = [
        { title: 'My Courses', value: stats.enrolledCourses, icon: BookOpen },
        { title: 'Fee Balance Remaining', value: `KSh ${(studentFee?.balance || 0).toLocaleString()}`, icon: CreditCard },
        { title: 'Attendance', value: stats.attendanceRate, icon: UserCheck },
        { title: 'Academic Logs', value: stats.sessionsCount, icon: History },
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* Header */}
            <div className="flex justify-between items-end mb-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">Student Portal</h1>
                    <p className="text-sm text-gray-400 font-medium">
                        Welcome back, {studentProfile ? studentProfile.name : (user?.name || user?.email?.split('@')[0])}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {statsConfig.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <div key={index} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xl hover:shadow-2xl transition-all">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{stat.title}</p>
                                    <p className="text-3xl font-black text-gray-800">{stat.value}</p>
                                </div>
                                <div className="w-14 h-14 bg-maroon/5 rounded-2xl flex items-center justify-center">
                                    <Icon className="w-7 h-7 text-maroon" />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">

                    {/* Ongoing Curriculum */}
                    <div className="bg-maroon p-6 sm:p-8 rounded-[2rem] shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-gold/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-gold/20 transition-all duration-700" />
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-6">
                                <div className="w-6 h-6 bg-gold/20 rounded flex items-center justify-center">
                                    <Zap className="w-4 h-4 text-gold" />
                                </div>
                                <h2 className="text-xs font-black text-white/60 uppercase tracking-widest">Ongoing Curriculum</h2>
                            </div>
                            {courseDetails ? (
                                <>
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                        <div>
                                            <h3 className="text-2xl font-black text-white mb-2">{courseDetails.name}</h3>
                                            <p className="text-sm text-white/50 font-medium">Instructor: {courseDetails.instructor} • {courseDetails.room}</p>
                                        </div>
                                        <Link to="/grades" className="bg-gold text-maroon px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-xl block text-center">
                                            View All Results
                                        </Link>
                                    </div>
                                    <div className="mt-8 pt-8 border-t border-white/5 grid grid-cols-3 gap-4">
                                        <div>
                                            <p className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">Status</p>
                                            <p className="text-xs font-bold text-green-400 uppercase">Active</p>
                                        </div>
                                        <div>
                                            <p className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">Intake</p>
                                            <p className="text-xs font-bold text-white uppercase">{studentProfile?.intake || studentProfile?.semester || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">Progress</p>
                                            <p className="text-xs font-bold text-white uppercase">In Progress</p>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-white/60">No active course enrollment found. Contact administration.</div>
                            )}
                        </div>
                    </div>

                    {/* Recent Performance */}
                    <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-gray-100 shadow-xl overflow-hidden">
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-2">
                                <Award className="w-5 h-5 text-maroon" />
                                <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest">Recent Performance</h2>
                            </div>
                            <Link to="/grades" className="text-[10px] font-black text-maroon hover:underline uppercase tracking-widest bg-maroon/5 px-4 py-2 rounded-xl transition-all">
                                View Full Grade
                            </Link>
                        </div>
                        {recentGrades.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-gray-50">
                                            <th className="pb-4 text-left text-[8px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                                            <th className="pb-4 text-left text-[8px] font-black text-gray-400 uppercase tracking-widest">Assessment Detail</th>
                                            <th className="pb-4 text-left text-[8px] font-black text-gray-400 uppercase tracking-widest">Period</th>
                                            <th className="pb-4 text-right text-[8px] font-black text-gray-400 uppercase tracking-widest">Score</th>
                                            <th className="pb-4 text-left text-[8px] font-black text-gray-400 uppercase tracking-widest pl-4">Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {recentGrades.map((record, idx) => (
                                            <tr key={record.id || idx} className="group">
                                                <td className="py-4">
                                                    <span className={`px-2 py-1 rounded text-[7px] font-black uppercase tracking-tighter ${record.type === 'CAT' ? 'bg-maroon/10 text-maroon' : 'bg-gold/10 text-maroon'}`}>
                                                        {record.type}
                                                    </span>
                                                </td>
                                                <td className="py-4">
                                                    <p className="text-xs font-bold text-gray-800">{record.assignment}</p>
                                                    <p className="text-[8px] text-gray-400 font-medium uppercase tracking-tighter">{record.course || record.course_unit}</p>
                                                </td>
                                                <td className="py-4">
                                                    <span className="text-[10px] font-black text-gray-400 uppercase">{record.displayDate || record.month}</span>
                                                </td>
                                                <td className="py-4 text-right">
                                                    <span className="text-xs font-black text-maroon">{Math.round((record.score / record.max_score) * 100)}%</span>
                                                </td>
                                                <td className="py-4 pl-4">
                                                    <p className="text-[9px] font-bold text-gray-400 italic line-clamp-1">{record.performance || 'No official remarks'}</p>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="py-12 text-center text-gray-300 uppercase font-black text-[10px] tracking-widest">No results committed yet</div>
                        )}
                    </div>

                    {/* Daily Academic Registry */}
                    <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-gray-100 shadow-xl">
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-2">
                                <History className="w-5 h-5 text-maroon" />
                                <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest">Daily Academic Registry</h2>
                            </div>
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Last 5 Sessions</span>
                        </div>

                        {dailyReports.length > 0 ? (
                            <div className="space-y-4">
                                {dailyReports.map((report, idx) => {
                                    const badge = getLessonBadge(report);
                                    return (
                                        <div key={report.id || report._id || idx} className="p-5 bg-gray-50 rounded-2xl border border-gray-100 hover:border-maroon/20 transition-all">
                                            {/* Report header */}
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <p className="text-[9px] font-black text-maroon uppercase tracking-widest">
                                                        {new Date(report.report_date).toLocaleDateString()}
                                                    </p>
                                                    <h4 className="text-xs font-black text-gray-800 uppercase mt-1">{report.course}</h4>
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    <div className="text-right">
                                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Trainer</p>
                                                        <p className="text-[10px] font-bold text-gray-800">{report.trainer_name}</p>
                                                    </div>
                                                    {badge && (
                                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[8px] font-black uppercase tracking-widest ${badge.color}`}>
                                                            <badge.Icon className="w-2.5 h-2.5" />
                                                            {badge.label}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <div className="space-y-2">
                                                <div className="bg-white/50 p-3 rounded-lg border border-gray-100">
                                                    <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest mb-1">Coverage</p>
                                                    <p className="text-[11px] text-gray-600 font-medium leading-relaxed">{report.topics_covered}</p>
                                                </div>
                                                {report.trainer_remarks && (
                                                    <div className="flex gap-2 items-start">
                                                        <MessageSquare className="w-3 h-3 text-maroon mt-0.5" />
                                                        <p className="text-[10px] text-gray-400 font-bold italic">"{report.trainer_remarks}"</p>
                                                    </div>
                                                )}
                                                {report.student_comment && (
                                                    <div className="flex gap-2 items-start bg-blue-50/60 px-3 py-2 rounded-lg border border-blue-100">
                                                        <Send className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" />
                                                        <p className="text-[10px] text-blue-500 font-bold italic">Your note: "{report.student_comment}"</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Feedback button */}
                                            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
                                                <button
                                                    onClick={() => openCommentDialog(report)}
                                                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${badge
                                                            ? 'bg-white text-gray-400 border-gray-200 hover:border-maroon/20 hover:text-maroon'
                                                            : 'bg-maroon text-gold border-maroon shadow-md shadow-maroon/10 hover:shadow-lg'
                                                        }`}
                                                >
                                                    <MessageSquare className="w-3 h-3" />
                                                    {badge ? 'Update Feedback' : 'Leave Feedback'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="py-12 text-center text-gray-300 uppercase font-black text-[10px] tracking-widest">Registry is currently empty</div>
                        )}
                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Link to="/grades" className="flex flex-col items-center gap-3 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group text-center">
                            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                                <FileText className="w-6 h-6 text-blue-600 group-hover:text-white" />
                            </div>
                            <span className="text-[9px] font-black uppercase text-gray-500 tracking-widest">Grades</span>
                        </Link>
                        <Link to="/attendance" className="flex flex-col items-center gap-3 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group text-center">
                            <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center group-hover:bg-green-600 transition-colors">
                                <Clock className="w-6 h-6 text-green-600 group-hover:text-white" />
                            </div>
                            <span className="text-[9px] font-black uppercase text-gray-500 tracking-widest">Attendance</span>
                        </Link>
                        <button className="flex flex-col items-center gap-3 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group text-center">
                            <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center group-hover:bg-purple-600 transition-colors">
                                <Zap className="w-6 h-6 text-purple-600 group-hover:text-white" />
                            </div>
                            <span className="text-[9px] font-black uppercase text-gray-500 tracking-widest">Events</span>
                        </button>
                        <Link to="/materials" className="flex flex-col items-center gap-3 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group text-center">
                            <div className="w-12 h-12 bg-maroon/5 rounded-2xl flex items-center justify-center group-hover:bg-maroon transition-colors">
                                <GraduationCap className="w-6 h-6 text-maroon group-hover:text-white" />
                            </div>
                            <span className="text-[9px] font-black uppercase text-gray-500 tracking-widest">Library</span>
                        </Link>
                    </div>
                </div>

                {/* Sidebar: Notice Board */}
                <div className="space-y-8">
                    <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
                        <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-8">Notice Board</h2>
                        <div className="space-y-6">
                            {recentAnnouncements.length > 0 ? (
                                recentAnnouncements.map(ann => (
                                    <div key={ann.id} className="relative pl-6 border-l-2 border-maroon pb-6 last:pb-0">
                                        <p className="text-[9px] font-black text-maroon uppercase tracking-widest mb-1">{ann.date}</p>
                                        <h4 className="text-xs font-bold text-gray-800 mb-1">{ann.title}</h4>
                                        <p className="text-[10px] text-gray-400 font-medium line-clamp-2">{ann.content}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-[10px] text-gray-400 font-medium uppercase italic">No recent notices</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Lesson Feedback Dialog ── */}
            {commentDialog && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-maroon/20 backdrop-blur-xl"
                        onClick={closeCommentDialog}
                    />

                    {/* Modal */}
                    <div className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">

                        {/* Modal Header */}
                        <div className="bg-gradient-to-br from-maroon to-maroon/90 px-8 py-7 flex justify-between items-start">
                            <div>
                                <p className="text-[9px] font-black text-gold/60 uppercase tracking-[0.3em] mb-1">Session Feedback</p>
                                <h2 className="text-lg font-black text-white uppercase tracking-tight leading-tight">
                                    Was the Lesson Taught?
                                </h2>
                                <p className="text-[10px] text-white/50 font-bold mt-1 uppercase">
                                    {new Date(commentDialog.report_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                                    {' '}•{' '}{commentDialog.course}
                                </p>
                            </div>
                            <button
                                onClick={closeCommentDialog}
                                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all text-white mt-1"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            {/* Session context */}
                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Topics Covered (by trainer)</p>
                                <p className="text-xs text-gray-600 font-medium italic leading-relaxed line-clamp-3">"{commentDialog.topics_covered}"</p>
                            </div>

                            {/* Lesson Taught Selector */}
                            <div>
                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3">Select One *</p>
                                <div className="grid grid-cols-3 gap-3">
                                    <button
                                        onClick={() => setLessonTaught(true)}
                                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all font-black text-[9px] uppercase tracking-widest ${lessonTaught === true
                                                ? 'bg-green-500 border-green-500 text-white shadow-lg shadow-green-200'
                                                : 'bg-white border-gray-100 text-gray-400 hover:border-green-300 hover:text-green-500'
                                            }`}
                                    >
                                        <CheckCircle2 className="w-6 h-6" />
                                        Yes, Taught
                                    </button>

                                    <button
                                        onClick={() => setLessonTaught('partial')}
                                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all font-black text-[9px] uppercase tracking-widest ${lessonTaught === 'partial'
                                                ? 'bg-amber-400 border-amber-400 text-white shadow-lg shadow-amber-200'
                                                : 'bg-white border-gray-100 text-gray-400 hover:border-amber-300 hover:text-amber-500'
                                            }`}
                                    >
                                        <AlertCircle className="w-6 h-6" />
                                        Partially
                                    </button>

                                    <button
                                        onClick={() => setLessonTaught(false)}
                                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all font-black text-[9px] uppercase tracking-widest ${lessonTaught === false
                                                ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-200'
                                                : 'bg-white border-gray-100 text-gray-400 hover:border-red-300 hover:text-red-500'
                                            }`}
                                    >
                                        <XCircle className="w-6 h-6" />
                                        Not Taught
                                    </button>
                                </div>
                            </div>

                            {/* Optional comment */}
                            <div>
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                    <MessageSquare className="w-3 h-3" /> Additional Comments (Optional)
                                </label>
                                <textarea
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    placeholder="Share your experience — was the session effective? Any concerns or suggestions..."
                                    rows={3}
                                    className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl text-sm font-medium text-gray-700 outline-none focus:border-maroon/20 focus:bg-white focus:ring-4 focus:ring-maroon/5 transition-all resize-none"
                                />
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={closeCommentDialog}
                                    className="flex-1 py-4 rounded-2xl bg-gray-50 text-gray-400 font-black text-[10px] uppercase tracking-widest border border-gray-100 hover:bg-gray-100 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCommentSubmit}
                                    disabled={submittingComment || lessonTaught === null}
                                    className="flex-[2] py-4 rounded-2xl bg-maroon text-gold font-black text-[10px] uppercase tracking-widest shadow-xl shadow-maroon/20 hover:shadow-maroon/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {submittingComment ? (
                                        <>
                                            <div className="animate-spin w-4 h-4 border-2 border-gold/40 border-t-gold rounded-full" />
                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4" />
                                            Submit Feedback
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
