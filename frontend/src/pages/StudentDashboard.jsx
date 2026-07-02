import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    BookOpen,
    Award,
    Clock,
    Zap,
    FileText,
    UserCheck,
    CreditCard,
    History,
    MessageSquare,
    AlertCircle,
    Send,
    X,
    ThumbsUp,
    ThumbsDown,
    Minus,
    GraduationCap,
    Bell,
    ChevronRight,
    CheckCircle2,
    XCircle,
    RefreshCw,
    TrendingUp,
    TrendingDown,
    Activity
} from 'lucide-react';
import { studentDashboardAPI } from '../services/api';
import { studentDailyReportsAPI } from '../services/api';
import { cacheGet, cacheSet, cacheInvalidate, studentDashboardKey } from '../utils/dashboardCache';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { calculateRemainingTime } from '../utils/dateUtils';


const stripHtml = (html) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
};


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
    const [recentPayments, setRecentPayments] = useState([]);
    const [dailyReports, setDailyReports] = useState([]);
    const [monthlyFees, setMonthlyFees] = useState([]);
    const [loading, setLoading] = useState(true);

    // Comment Dialog State
    const [commentDialog, setCommentDialog] = useState(null);
    const [lessonTaught, setLessonTaught] = useState(null);   // true | false | 'partial'
    const [commentText, setCommentText] = useState('');
    const [submittingComment, setSubmittingComment] = useState(false);



    const fetchData = useCallback(async (forceRefresh = false) => {
        try {
            const effectiveStudentId = user.student_id || user.id;
            const cacheKey = studentDashboardKey(effectiveStudentId);

            // Serve from cache unless a forced refresh was requested
            if (!forceRefresh) {
                const cached = cacheGet(cacheKey);
                if (cached) {
                    applyData(cached);
                    setLoading(false);
                    return;
                }
            } else {
                cacheInvalidate(cacheKey);
            }

            // Single consolidated request — replaces 9 individual API calls
            const { data } = await studentDashboardAPI.getAll();

            // Populate cache for the next navigation within this session
            cacheSet(cacheKey, data);
            applyData(data);
        } catch (error) {
            console.error('Error fetching student dashboard data:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    const applyData = (data) => {
        const {
            profile,
            courses,
            announcements,
            grades,
            attendance,
            studentFee,
            recentPayments,
            dailyReports,
            monthlyFees,
        } = data;

        setStudentProfile(profile || null);
        setStudentFee(studentFee || null);
        setRecentPayments(Array.isArray(recentPayments) ? recentPayments.slice(0, 5) : []);
        setDailyReports(Array.isArray(dailyReports) ? dailyReports : []);
        setMonthlyFees(Array.isArray(monthlyFees) ? monthlyFees : []);

        // Process grades
        const myGrades = (grades || []).map(g => {
            let displayDate = g.month;
            if (g.month && !isNaN(Date.parse(g.month)) && String(g.month).includes('-')) {
                try {
                    displayDate = new Date(g.month).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                } catch (e) {
                    displayDate = g.month;
                }
            }
            return {
                ...g,
                type: 'CAT',
                displayDate,
                performance: g.remarks,
                rawDate: g.created_at
            };
        });
        setRecentGrades([...myGrades].sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate)).slice(0, 5));

        const avgGrade = myGrades.length > 0
            ? Math.round((myGrades.reduce((acc, g) => acc + (g.score / g.max_score), 0) / myGrades.length) * 100)
            : 0;

        // Process attendance
        const myAttendance = Array.isArray(attendance) ? attendance : [];
        const presentCount = myAttendance.filter(a => a.status === 'Present' || a.status === 'Late').length;
        const attendanceRate = myAttendance.length > 0
            ? `${Math.round((presentCount / myAttendance.length) * 100)}%`
            : '0%';

        // Match enrolled course
        if (profile) {
            const allCourses = Array.isArray(courses) ? courses : [];
            const studentCourseNames = Array.isArray(profile.course)
                ? profile.course
                : (typeof profile.course === 'string' && profile.course.startsWith('['))
                    ? (() => { try { return JSON.parse(profile.course); } catch { return [profile.course]; } })()
                    : [profile.course].filter(Boolean);
            const enrolledCourse = allCourses.find(c =>
                studentCourseNames.some(cn =>
                    cn && c.name && cn.toLowerCase().trim() === c.name.toLowerCase().trim()
                )
            ) || allCourses[0] || null;
            setCourseDetails(enrolledCourse);
            setStats({
                enrolledCourses: studentCourseNames.length,
                avgGrade: myGrades.length > 0 ? `${avgGrade}%` : (profile.gpa ? `${profile.gpa} GPA` : 'N/A'),
                attendanceRate,
                sessionsCount: Array.isArray(dailyReports) ? dailyReports.length : 0
            });
        }

        setRecentAnnouncements(announcements || []);
    };

    useEffect(() => {
        if (user) fetchData();
    }, [user, fetchData]);

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

    if (loading) return (
        <div className="space-y-8 animate-pulse">
            {/* Skeleton Banner */}
            <div className="h-40 bg-maroon/10 rounded-[2.5rem]" />
            {/* Skeleton Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-28 bg-gray-100 dark:bg-white/5 rounded-[2rem]" />
                ))}
            </div>
            {/* Skeleton Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <div className="h-48 bg-gray-100 dark:bg-white/5 rounded-[2.5rem]" />
                    <div className="h-64 bg-gray-100 dark:bg-white/5 rounded-[2rem]" />
                </div>
                <div className="h-80 bg-gray-100 dark:bg-white/5 rounded-[2rem]" />
            </div>
        </div>
    );

    const remainingTime = calculateRemainingTime(studentProfile?.completion_date);

    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

    const attendancePct = parseInt(stats.attendanceRate) || 0;
    const feeBalance = studentFee ? Number(studentFee.balance ?? 0) : null;

    const statsDisplay = [
        {
            title: 'My Courses', value: stats.enrolledCourses, icon: BookOpen,
            bg: 'bg-maroon/5', iconBg: 'bg-maroon/5', iconColor: 'text-maroon',
            border: 'border-gray-100 dark:border-white/5', textColor: 'text-gray-800 dark:text-white',
            sub: 'Enrolled programmes'
        },
        {
            title: 'Fee Balance',
            value: feeBalance !== null ? `KSh ${feeBalance.toLocaleString()}` : 'Not Set',
            icon: feeBalance > 0 ? TrendingDown : CheckCircle2,
            bg: feeBalance > 0 ? 'bg-red-50' : 'bg-emerald-50',
            iconBg: feeBalance > 0 ? 'bg-red-50' : 'bg-emerald-50',
            iconColor: feeBalance > 0 ? 'text-red-500' : 'text-emerald-500',
            border: feeBalance > 0 ? 'border-red-100' : 'border-emerald-100',
            textColor: feeBalance > 0 ? 'text-red-600' : 'text-emerald-600',
            sub: feeBalance > 0 ? 'Balance outstanding' : 'Fees cleared'
        },
        {
            title: 'Time Remaining',
            value: remainingTime.formatted,
            icon: Clock,
            bg: remainingTime.isExpired ? 'bg-red-50' : (remainingTime.totalDays != null && remainingTime.totalDays <= 30 ? 'bg-amber-50' : 'bg-sky-50'),
            iconBg: remainingTime.isExpired ? 'bg-red-50' : 'bg-sky-50',
            iconColor: remainingTime.isExpired ? 'text-red-500' : 'text-sky-500',
            border: remainingTime.isExpired ? 'border-red-100' : 'border-sky-100',
            textColor: remainingTime.isExpired ? 'text-red-600 text-base' : 'text-gray-800 dark:text-white',
            sub: remainingTime.isExpired ? 'Programme ended' : 'Until completion'
        },
        {
            title: 'Attendance',
            value: stats.attendanceRate,
            icon: attendancePct >= 75 ? UserCheck : AlertCircle,
            bg: attendancePct >= 75 ? 'bg-emerald-50' : attendancePct >= 50 ? 'bg-amber-50' : 'bg-red-50',
            iconBg: attendancePct >= 75 ? 'bg-emerald-50' : 'bg-amber-50',
            iconColor: attendancePct >= 75 ? 'text-emerald-500' : attendancePct >= 50 ? 'text-amber-500' : 'text-red-500',
            border: attendancePct >= 75 ? 'border-emerald-100' : attendancePct >= 50 ? 'border-amber-100' : 'border-red-100',
            textColor: attendancePct >= 75 ? 'text-emerald-600' : attendancePct >= 50 ? 'text-amber-600' : 'text-red-600',
            sub: attendancePct >= 75 ? 'Excellent record' : 'Needs improvement',
            isAttendance: true
        },
        {
            title: 'Academic Logs', value: stats.sessionsCount, icon: History,
            bg: 'bg-indigo-50', iconBg: 'bg-indigo-50', iconColor: 'text-indigo-500',
            border: 'border-indigo-100', textColor: 'text-gray-800 dark:text-white',
            sub: 'Daily session records'
        },
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* Welcome Banner */}
            <div className="relative overflow-hidden rounded-[2.5rem] p-8 md:p-10 text-white shadow-2xl"
                style={{ background: 'linear-gradient(135deg, #800000 0%, #4a0000 100%)' }}>
                <div className="absolute top-0 right-0 w-72 h-72 bg-gold/10 rounded-full translate-x-1/3 -translate-y-1/3 blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
                {/* Decorative grid */}
                <div className="absolute inset-0 opacity-[0.04]"
                    style={{ backgroundImage: 'repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 1px,transparent 40px)' }} />
                <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <p className="text-[10px] font-black text-gold/60 uppercase tracking-[0.3em] mb-1">{greeting}, Student</p>
                        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter leading-tight">
                            {studentProfile ? studentProfile.name : (user?.name || user?.email?.split('@')[0])} <span className="text-gold">↗</span>
                        </h1>
                        <p className="text-sm text-white/50 font-medium mt-2">
                            {courseDetails ? courseDetails.name : 'No active enrollment'}
                            {studentProfile?.intake ? ` · Intake: ${studentProfile.intake}` : ''}
                        </p>
                    </div>
                    <div className="flex flex-col items-start md:items-end gap-2">
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => { setLoading(true); fetchData(true); }}
                                title="Refresh dashboard"
                                className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/70 hover:text-white transition-all"
                            >
                                <RefreshCw className="w-3 h-3" />
                                Refresh
                            </button>
                            <Link to="/grades" className="flex items-center gap-2 px-5 py-2.5 bg-gold text-maroon rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 shadow-xl">
                                <Award className="w-3.5 h-3.5" /> View My Units
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Monthly Fee Reminder Banner */}
            {(() => {
                const curYear = new Date().getFullYear();
                const curMonth = new Date().getMonth() + 1;
                const currentMonthRecord = (monthlyFees || []).find(f => f.year === curYear && f.month === curMonth);
                const hasUnpaidMonthlyFee = currentMonthRecord && (currentMonthRecord.status === 'Not Paid' || currentMonthRecord.status === 'Partial');
                if (!hasUnpaidMonthlyFee) return null;

                return (
                    <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/20 rounded-[1.8rem] p-6 flex flex-col sm:flex-row items-center justify-between gap-4 animate-pulse">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center shrink-0">
                                <AlertCircle className="w-6 h-6 text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-red-600 dark:text-red-400 uppercase tracking-widest mb-1">🔔 Fee Payment Reminder</h3>
                                <p className="text-xs font-bold text-gray-600 dark:text-gray-300">
                                    Your school fees for <span className="font-black text-maroon dark:text-gold">{currentMonthRecord.month_label}</span> have not been fully cleared (Balance: KSh {Number(currentMonthRecord.balance || 0).toLocaleString()}). Please clear your balance to avoid inconveniences.
                                </p>
                            </div>
                        </div>
                        <Link to="/finance" className="shrink-0 px-6 py-3.5 bg-maroon hover:bg-maroon/90 text-gold rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md transition-all self-stretch sm:self-auto text-center">
                            View Statement & Pay
                        </Link>
                    </div>
                );
            })()}

            {/* Time Remaining Alert */}
            {remainingTime?.totalDays > 0 && remainingTime?.totalDays <= 7 ? (
                <div className="bg-gradient-to-r from-red-500 to-red-600 p-1 rounded-[2rem] shadow-xl shadow-red-500/20 animate-pulse">
                    <div className="bg-white rounded-[1.8rem] p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center shrink-0">
                                <AlertCircle className="w-6 h-6 text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-red-600 uppercase tracking-widest mb-1">Course Nearing Completion</h3>
                                <p className="text-xs font-bold text-gray-600">You have only <span className="text-red-500">{remainingTime.formatted}</span> remaining in your current curriculum. Please ensure all requirements are met.</p>
                            </div>
                        </div>
                        <Link to="/grades" className="shrink-0 px-6 py-3 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-sm">
                            View Progress
                        </Link>
                    </div>
                </div>
            ) : null}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {statsDisplay.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <div key={index} className={`bg-white dark:bg-[#111] p-5 rounded-[2rem] border ${stat.border} shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group`}>
                            <div className={`w-10 h-10 ${stat.iconBg} dark:bg-white/5 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                                {stat.isAttendance ? (
                                    <svg className="w-full h-full p-2 -rotate-90" viewBox="0 0 36 36">
                                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-100 dark:text-white/10" />
                                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${parseInt(stats.attendanceRate) || 0}, 100`} className={stat.iconColor} />
                                    </svg>
                                ) : (
                                    <Icon className={`w-5 h-5 ${stat.iconColor}`} />
                                )}
                            </div>
                            <p className={`text-xl font-black ${stat.textColor} leading-tight`}>{stat.value}</p>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">{stat.title}</p>
                            <p className="text-[8px] text-gray-300 dark:text-white/20 font-bold mt-0.5 uppercase tracking-wider">{stat.sub}</p>
                        </div>
                    );
                })}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">

                    {/* Ongoing Curriculum */}
                    <div className="bg-white dark:bg-[#111] p-6 sm:p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-lg">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-8 h-8 bg-gold/20 rounded-xl flex items-center justify-center">
                                <Zap className="w-4 h-4 text-gold" />
                            </div>
                            <div>
                                <h2 className="text-xs font-black text-gray-800 dark:text-gold uppercase tracking-widest">My Academic Programme</h2>
                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Current enrollment details</p>
                            </div>
                        </div>
                        {courseDetails ? (
                            <>
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                    <div>
                                        <h3 className="text-2xl font-black text-gray-800 dark:text-white mb-1">{courseDetails.name}</h3>
                                        <p className="text-sm text-gray-400 font-medium">Instructor: {courseDetails.instructor} • {courseDetails.room}</p>
                                    </div>
                                    <Link to="/grades" className="bg-maroon text-white px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-xl block text-center shrink-0">
                                        View All Results
                                    </Link>
                                </div>

                                {/* Progress bar for time remaining */}
                                {studentProfile?.enrolled_date && studentProfile?.completion_date && (
                                    <div className="mt-6 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                                        <div className="flex justify-between items-center mb-2">
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Programme Progress</p>
                                            <p className={`text-[9px] font-black uppercase ${remainingTime.isExpired ? 'text-red-500' : 'text-maroon'}`}>
                                                {remainingTime.isExpired ? 'Completed' : `${remainingTime.formatted} left`}
                                            </p>
                                        </div>
                                        {(() => {
                                            const start = new Date(studentProfile.enrolled_date).getTime();
                                            const end = new Date(studentProfile.completion_date).getTime();
                                            const pct = Math.min(Math.max(Math.round(((Date.now() - start) / (end - start)) * 100), 0), 100);
                                            const barColor = pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-maroon';
                                            return (
                                                <div className="h-2 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                                                    <div className={`h-full ${barColor} rounded-full transition-all duration-1000`} style={{ width: `${pct}%` }} />
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                <div className="mt-6 pt-6 border-t border-gray-100 dark:border-white/5 grid grid-cols-2 md:grid-cols-5 gap-4">
                                    <div>
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
                                        <p className="text-xs font-bold text-green-500 uppercase">Active</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Intake</p>
                                        <p className="text-xs font-bold text-gray-800 dark:text-white uppercase">{studentProfile?.intake || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Enrolled</p>
                                        <p className="text-xs font-bold text-gray-800 dark:text-white uppercase">{studentProfile?.enrolled_date ? new Date(studentProfile.enrolled_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Completion</p>
                                        <p className="text-xs font-bold text-gray-800 dark:text-white uppercase">{studentProfile?.completion_date ? new Date(studentProfile.completion_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Time Left</p>
                                        <p className={`text-xs font-bold uppercase ${remainingTime.isExpired ? 'text-red-500' : 'text-gray-800 dark:text-white'}`}>
                                            {remainingTime.formatted}
                                        </p>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="text-gray-400">No active course enrollment found. Contact administration.</div>
                        )}
                    </div>

                    {/* Recent Performance */}
                    <div className="bg-white dark:bg-[#111] p-6 sm:p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-xl overflow-hidden">
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-2">
                                <Award className="w-5 h-5 text-maroon dark:text-gold" />
                                <h2 className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-widest">Recent Performance</h2>
                            </div>
                            <Link to="/grades" className="text-[10px] font-black text-maroon dark:text-gold hover:underline uppercase tracking-widest bg-maroon/5 dark:bg-white/5 px-4 py-2 rounded-xl transition-all">
                                View Units Covered
                            </Link>
                        </div>
                        {recentGrades.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-gray-50 dark:border-white/5">
                                            <th className="pb-4 text-left text-[8px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                                            <th className="pb-4 text-left text-[8px] font-black text-gray-400 uppercase tracking-widest">Assessment Detail</th>
                                            <th className="pb-4 text-left text-[8px] font-black text-gray-400 uppercase tracking-widest">Period</th>
                                            <th className="pb-4 text-right text-[8px] font-black text-gray-400 uppercase tracking-widest">Score</th>
                                            <th className="pb-4 text-left text-[8px] font-black text-gray-400 uppercase tracking-widest pl-4">Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                                        {recentGrades.map((record, idx) => (
                                            <tr key={record.id || idx} className="group">
                                                <td className="py-4">
                                                    <span className={`px-2 py-1 rounded text-[7px] font-black uppercase tracking-tighter ${record.type === 'CAT' ? 'bg-maroon/10 text-maroon' : 'bg-gold/10 text-gold'}`}>
                                                        {record.type}
                                                    </span>
                                                </td>
                                                <td className="py-4">
                                                    <p className="text-xs font-bold text-gray-800 dark:text-white">{record.assignment}</p>
                                                    <p className="text-[8px] text-gray-400 font-medium uppercase tracking-tighter">{record.course || record.course_unit}</p>
                                                </td>
                                                <td className="py-4">
                                                    <span className="text-[10px] font-black text-gray-400 uppercase">{record.displayDate || record.month}</span>
                                                </td>
                                                <td className="py-4 text-right">
                                                    <span className="text-xs font-black text-maroon dark:text-gold">{Math.round((record.score / record.max_score) * 100)}%</span>
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
                            <div className="py-12 text-center text-gray-300 dark:text-white/20 uppercase font-black text-[10px] tracking-widest">No results committed yet</div>
                        )}
                    </div>

                    {/* Transaction Registry (Payment History) */}
                    <div className="bg-white dark:bg-[#111] p-6 sm:p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-xl overflow-hidden">
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-maroon dark:text-gold" />
                                <h2 className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-widest">Transaction Registry</h2>
                            </div>
                            <Link to="/finance" className="text-[10px] font-black text-maroon dark:text-gold hover:underline uppercase tracking-widest bg-maroon/5 dark:bg-white/5 px-4 py-2 rounded-xl transition-all">
                                Full Statement
                            </Link>
                        </div>
                        {recentPayments.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-gray-50 dark:border-white/5">
                                            <th className="pb-4 text-left text-[8px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                                            <th className="pb-4 text-left text-[8px] font-black text-gray-400 uppercase tracking-widest">Category</th>
                                            <th className="pb-4 text-left text-[8px] font-black text-gray-400 uppercase tracking-widest">Reference</th>
                                            <th className="pb-4 text-right text-[8px] font-black text-gray-400 uppercase tracking-widest">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                                        {recentPayments.map((p, idx) => (
                                            <tr key={p.id || idx} className="group">
                                                <td className="py-4">
                                                    <span className="text-[10px] font-black text-gray-800 dark:text-white">
                                                        {new Date(p.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </span>
                                                </td>
                                                <td className="py-4">
                                                    <p className="text-xs font-bold text-gray-800 dark:text-white">{p.category || 'Tuition Fee'}</p>
                                                    <p className="text-[8px] text-gray-400 font-medium uppercase tracking-tighter">{p.method}</p>
                                                </td>
                                                <td className="py-4">
                                                    <span className="text-[10px] font-black font-mono text-gray-400 uppercase">{p.transaction_ref}</span>
                                                </td>
                                                <td className="py-4 text-right">
                                                    <span className="text-sm font-black text-emerald-600">KSh {Number(p.amount).toLocaleString()}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="py-12 text-center text-gray-300 dark:text-white/20 uppercase font-black text-[10px] tracking-widest">No payments recorded yet</div>
                        )}
                    </div>

                    {/* Monthly Fee Timeline */}
                    {monthlyFees.length > 0 && (
                        <div className="bg-white dark:bg-[#111] p-6 sm:p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-xl">
                            <div className="flex justify-between items-center mb-8">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-maroon dark:text-gold" />
                                    <h2 className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-widest">Monthly Fee History</h2>
                                </div>
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Last 6 Months</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                                {monthlyFees.slice(0, 6).map((item) => (
                                    <div key={item.id} className="bg-gray-50 dark:bg-white/5 p-4 rounded-2xl border border-gray-100 dark:border-white/5 text-center flex flex-col justify-between items-center h-28 hover:border-maroon/20 transition-all">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">{item.month_label.split(' ')[0]}</p>
                                        <p className="text-[8px] text-gray-400 font-bold">{item.month_label.split(' ')[1]}</p>
                                        <div className="my-2">
                                            {item.status === 'Paid' && <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />}
                                            {item.status === 'Partial' && <Clock className="w-6 h-6 text-amber-500 mx-auto" />}
                                            {item.status === 'Not Paid' && <XCircle className="w-6 h-6 text-rose-500 mx-auto" />}
                                        </div>
                                        <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                            item.status === 'Paid' ? 'bg-emerald-50 text-emerald-700' :
                                            item.status === 'Partial' ? 'bg-amber-50 text-amber-700' :
                                            'bg-rose-50 text-rose-700'
                                        }`}>
                                            {item.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Daily Academic Registry */}
                    <div className="bg-white dark:bg-[#111] p-6 sm:p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-xl">
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-2">
                                <History className="w-5 h-5 text-maroon dark:text-gold" />
                                <h2 className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-widest">Daily Academic Registry</h2>
                            </div>
                            <Link to="/daily-student-logs" className="text-[10px] font-black text-maroon dark:text-gold hover:underline uppercase tracking-widest bg-maroon/5 dark:bg-white/5 px-4 py-2 rounded-xl transition-all">
                                View Full Ledger
                            </Link>
                        </div>

                        {dailyReports.length > 0 ? (
                            <div className="space-y-4">
                                {dailyReports.map((report, idx) => {
                                    const badge = getLessonBadge(report);
                                    return (
                                        <div key={report.id || report._id || idx} className="p-5 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 hover:border-maroon/20 transition-all">
                                            {/* Report header */}
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <p className="text-[9px] font-black text-maroon dark:text-gold uppercase tracking-widest">
                                                        {new Date(report.report_date).toLocaleDateString()}
                                                    </p>
                                                    <h4 className="text-xs font-black text-gray-800 dark:text-white uppercase mt-1">{report.course}</h4>
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    <div className="text-right">
                                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Trainer</p>
                                                        <p className="text-[10px] font-bold text-gray-800 dark:text-white">{report.trainer_name}</p>
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
                                                <div className="bg-white dark:bg-[#111] p-3 rounded-lg border border-gray-100 dark:border-white/5">
                                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Coverage</p>
                                                    <div className="text-[11px] text-gray-600 dark:text-gray-300 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: report.topics_covered }} />
                                                </div>
                                                {report.trainer_remarks && (
                                                    <div className="flex gap-2 items-start">
                                                        <MessageSquare className="w-3 h-3 text-maroon dark:text-gold mt-0.5 shrink-0" />
                                                        <div className="text-[10px] text-gray-400 font-bold italic" dangerouslySetInnerHTML={{ __html: `&ldquo;${report.trainer_remarks}&rdquo;` }} />
                                                    </div>
                                                )}
                                                {report.student_comment && (
                                                    <div className="flex gap-2 items-start bg-blue-50/60 dark:bg-blue-900/20 px-3 py-2 rounded-lg border border-blue-100 dark:border-blue-800">
                                                        <Send className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" />
                                                        <p className="text-[10px] text-blue-600 dark:text-blue-300 font-bold italic">Your note: "{report.student_comment}"</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Feedback button */}
                                            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/5 flex justify-end">
                                                <button
                                                    onClick={() => openCommentDialog(report)}
                                                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${badge
                                                            ? 'bg-white dark:bg-[#111] text-gray-400 border-gray-200 dark:border-white/10 hover:border-maroon/20 hover:text-maroon'
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
                            <div className="py-12 text-center text-gray-300 dark:text-white/20 uppercase font-black text-[10px] tracking-widest">Registry is currently empty</div>
                        )}
                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { to: '/grades', icon: FileText, label: 'Units Covered', sub: 'View academic record', bg: 'bg-maroon/5 hover:bg-maroon group', iconClass: 'text-maroon group-hover:text-white' },
                            { to: '/attendance', icon: Clock, label: 'Attendance', sub: 'Track your sign-ins', bg: 'bg-indigo-50 hover:bg-indigo-500 group', iconClass: 'text-indigo-500 group-hover:text-white' },
                            { to: '/daily-student-logs', icon: History, label: 'Daily Ledger', sub: 'Session history', bg: 'bg-amber-50 hover:bg-amber-500 group', iconClass: 'text-amber-500 group-hover:text-white' },
                            { to: '/materials', icon: GraduationCap, label: 'Library', sub: 'Study materials', bg: 'bg-emerald-50 hover:bg-emerald-500 group', iconClass: 'text-emerald-500 group-hover:text-white' },
                        ].map(({ to, icon: Icon, label, sub, bg, iconClass }) => (
                            <Link key={to} to={to} className={`flex flex-col items-center gap-3 ${bg} bg-white dark:bg-[#111] p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all text-center`}>
                                <div className={`w-12 h-12 bg-current/10 rounded-2xl flex items-center justify-center transition-colors`}>
                                    <Icon className={`w-6 h-6 ${iconClass} transition-colors`} />
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 tracking-widest block">{label}</span>
                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block mt-0.5">{sub}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Sidebar: Notice Board */}
                <div className="space-y-8">
                    <div className="bg-white dark:bg-[#111] p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm sticky top-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center">
                                    <Bell className="w-4 h-4 text-amber-500" />
                                </div>
                                <div>
                                    <h2 className="text-xs font-black text-gray-800 dark:text-white uppercase tracking-widest">Notice Board</h2>
                                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{recentAnnouncements.length} active</p>
                                </div>
                            </div>
                            <Link to="/announcements" className="text-[9px] font-black uppercase tracking-widest text-maroon dark:text-gold hover:underline flex items-center gap-1">
                                All <ChevronRight className="w-3 h-3" />
                            </Link>
                        </div>
                        <div className="space-y-5">
                            {recentAnnouncements.length > 0 ? (
                                recentAnnouncements.map((ann, idx) => {
                                    const chipStyles = [
                                        'bg-red-50 text-red-600',
                                        'bg-amber-50 text-amber-600',
                                        'bg-blue-50 text-blue-600',
                                        'bg-emerald-50 text-emerald-600',
                                    ];
                                    const lineColors = ['border-red-300', 'border-amber-400', 'border-blue-300', 'border-emerald-300'];
                                    const dotColors = ['bg-red-400', 'bg-amber-400', 'bg-blue-400', 'bg-emerald-400'];
                                    const labels = ['Urgent', 'Notice', 'Info', 'Update'];
                                    const si = idx % 4;
                                    return (
                                        <div key={ann.id} className={`relative pl-5 border-l-2 ${lineColors[si]} pb-5 last:pb-0`}>
                                            <div className={`absolute -left-[5px] top-0.5 w-2.5 h-2.5 ${dotColors[si]} rounded-full`} />
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{ann.date}</p>
                                                <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${chipStyles[si]}`}>{labels[si]}</span>
                                            </div>
                                            <h4 className="text-xs font-bold text-gray-800 dark:text-white mb-1">{ann.title}</h4>
                                            <p className="text-[10px] text-gray-400 font-medium line-clamp-2">{ann.content}</p>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="py-8 text-center">
                                    <Bell className="w-10 h-10 text-gray-200 dark:text-white/10 mx-auto mb-3" />
                                    <p className="text-xs text-gray-400 italic">No recent notices</p>
                                </div>
                            )}
                        </div>

                        {/* Attendance mini gauge */}
                        {attendancePct > 0 && (
                            <div className="mt-6 pt-5 border-t border-gray-100 dark:border-white/5">
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">Attendance Rate</p>
                                <div className="flex items-end gap-3">
                                    <span className={`text-3xl font-black ${attendancePct >= 75 ? 'text-emerald-600' : attendancePct >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                                        {stats.attendanceRate}
                                    </span>
                                    <div className="flex-1 mb-1.5">
                                        <div className="h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-1000 ${attendancePct >= 75 ? 'bg-emerald-400' : attendancePct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                                                style={{ width: `${attendancePct}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <p className={`text-[8px] font-black uppercase tracking-widest mt-1 ${attendancePct >= 75 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                    {attendancePct >= 75 ? '✓ Good standing' : attendancePct >= 50 ? '⚠ Needs improvement' : '✗ Critical — contact admin'}
                                </p>
                            </div>
                        )}
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
                                <p className="text-xs text-gray-600 font-medium italic leading-relaxed line-clamp-3">"{stripHtml(commentDialog.topics_covered)}"</p>
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
