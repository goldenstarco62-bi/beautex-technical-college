import { useEffect, useState } from 'react';
import { BookOpen, Clock, Zap, FileText, ClipboardCheck, Bell, Users, TrendingUp, Calendar, ChevronRight, Layers, Award, BarChart2, Edit3 } from 'lucide-react';
import { coursesAPI, announcementsAPI, sessionsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function TeacherDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [myCourses, setMyCourses] = useState([]);
    const [mySessions, setMySessions] = useState([]);
    const [recentAnnouncements, setRecentAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [teacherName] = useState(user?.name || user?.email || 'Faculty');
    const [liveTime, setLiveTime] = useState(new Date());

    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

    // Live clock
    useEffect(() => {
        const t = setInterval(() => setLiveTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        if (user) fetchData();
    }, [user]);

    const fetchData = async () => {
        try {
            const name = user?.name || user?.email || '';
            const [coursesRes, announcementsRes, sessionsRes] = await Promise.all([
                coursesAPI.getAll(),
                announcementsAPI.getAll({ limit: 5 }),
                sessionsAPI.getAll()
            ]);

            let myCoursesList = coursesRes.data || [];
            if (myCoursesList.length > 0 && name) {
                const filtered = myCoursesList.filter(c =>
                    c.instructor && c.instructor.toLowerCase() === name.toLowerCase()
                );
                if (filtered.length > 0) myCoursesList = filtered;
            }

            setMyCourses(myCoursesList);
            setMySessions(sessionsRes.data || []);
            setRecentAnnouncements(announcementsRes.data || []);
        } catch (error) {
            console.error('Error fetching teacher dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="min-h-[40vh] flex items-center justify-center">
            <div className="text-center space-y-3">
                <div className="w-12 h-12 border-4 border-maroon/10 border-t-maroon rounded-full animate-spin mx-auto" />
                <p className="text-maroon font-black uppercase tracking-widest text-xs animate-pulse">Loading Faculty Portal...</p>
            </div>
        </div>
    );

    const totalStudents = myCourses.reduce((sum, c) => sum + (Number(c.enrolled) || 0), 0);

    const statsDisplay = [
        {
            title: 'My Courses', value: myCourses.length, icon: BookOpen,
            bg: 'bg-maroon/5', iconColor: 'text-maroon', borderColor: 'border-maroon/10',
            sub: 'Active assignments'
        },
        {
            title: 'Scheduled Sessions', value: mySessions.length, icon: Calendar,
            bg: 'bg-indigo-50', iconColor: 'text-indigo-500', borderColor: 'border-indigo-100',
            sub: 'All timetable sessions'
        },
        {
            title: 'Announcements', value: recentAnnouncements.length, icon: Bell,
            bg: 'bg-amber-50', iconColor: 'text-amber-500', borderColor: 'border-amber-100',
            sub: 'Recent notices'
        },
        {
            title: 'Total Students', value: totalStudents, icon: Users,
            bg: 'bg-emerald-50', iconColor: 'text-emerald-600', borderColor: 'border-emerald-100',
            sub: 'Across all courses'
        },
    ];

    const quickActions = [
        { label: 'Mark Attendance', sub: 'Daily sign-in', icon: ClipboardCheck, color: 'bg-maroon text-gold hover:bg-maroon/90', path: '/attendance' },
        { label: 'Daily Report', sub: 'Student logs', icon: FileText, color: 'bg-white text-maroon border-2 border-maroon dark:bg-transparent dark:text-gold dark:border-gold hover:bg-maroon/5', path: '/student-daily-reports' },
        { label: 'Post Marks', sub: 'Academic scores', icon: TrendingUp, color: 'bg-amber-400 text-maroon hover:bg-amber-500', path: '/grades' },
        { label: 'Units Registry', sub: 'Course modules', icon: Layers, color: 'bg-maroon/10 text-maroon dark:text-gold hover:bg-maroon/20', path: '/grades' },
        { label: 'My Schedule', sub: 'View timetable', icon: Calendar, color: 'bg-white border-2 border-gray-200 text-gray-600 dark:bg-transparent dark:text-white dark:border-white/20 hover:border-maroon/40', path: '/schedule' },
    ];

    const announcementPriorityStyle = (idx) => {
        const styles = [
            { dot: 'bg-red-400', line: 'border-red-300', label: 'Urgent', chip: 'bg-red-50 text-red-600' },
            { dot: 'bg-gold', line: 'border-gold', label: 'Notice', chip: 'bg-amber-50 text-amber-600' },
        ];
        return styles[idx % styles.length];
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* ── Welcome Banner ── */}
            <div className="relative overflow-hidden rounded-[2.5rem] p-8 md:p-10 text-white shadow-2xl"
                style={{ background: 'linear-gradient(135deg, #800000 0%, #4a0000 100%)' }}>
                <div className="absolute top-0 right-0 w-72 h-72 bg-gold/10 rounded-full translate-x-1/3 -translate-y-1/3 blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-1/2 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
                {/* Decorative grid */}
                <div className="absolute inset-0 opacity-[0.04]"
                    style={{ backgroundImage: 'repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 1px,transparent 40px)' }} />

                <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <p className="text-[10px] font-black text-gold/60 uppercase tracking-[0.3em] mb-1">{greeting}, Faculty</p>
                        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter leading-tight">
                            {teacherName} <span className="text-gold">↗</span>
                        </h1>
                        <p className="text-sm text-white/50 font-medium mt-2">
                            Faculty Portal — {myCourses.length > 0 ? `${myCourses.length} Course${myCourses.length !== 1 ? 's' : ''} Active` : 'Academic Session Active'}
                        </p>
                    </div>
                    <div className="flex flex-col items-start md:items-end gap-3">
                        {/* Live clock */}
                        <div className="bg-white/10 border border-white/10 rounded-2xl px-5 py-3 text-center">
                            <p className="text-2xl font-black text-white tracking-wider tabular-nums">
                                {liveTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </p>
                            <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] mt-0.5">
                                {now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </p>
                        </div>
                        <button
                            onClick={() => navigate('/attendance')}
                            className="flex items-center gap-2 px-5 py-3 bg-gold text-maroon rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 shadow-xl"
                        >
                            <ClipboardCheck className="w-3.5 h-3.5" />
                            Sign Attendance Today
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Stat Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {statsDisplay.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <div key={index} className={`bg-white dark:bg-[#111] p-6 rounded-[2rem] border ${stat.borderColor} dark:border-white/5 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group`}>
                            <div className="flex justify-between items-start mb-4">
                                <div className={`w-12 h-12 ${stat.bg} dark:bg-white/5 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                                    <Icon className={`w-6 h-6 ${stat.iconColor} dark:text-gold`} />
                                </div>
                            </div>
                            <p className="text-3xl font-black text-gray-800 dark:text-white">{stat.value}</p>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">{stat.title}</p>
                            <p className="text-[9px] text-gray-300 dark:text-white/20 font-bold mt-0.5 uppercase tracking-wider">{stat.sub}</p>
                        </div>
                    );
                })}
            </div>

            {/* ── Quick Actions ── */}
            <div className="bg-white dark:bg-[#111] p-6 sm:p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 bg-gold/20 rounded-xl flex items-center justify-center">
                        <Zap className="w-4 h-4 text-gold" />
                    </div>
                    <div>
                        <h2 className="text-xs font-black text-gray-800 dark:text-gold uppercase tracking-widest">Quick Actions</h2>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Frequently used tools</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {quickActions.map((item, i) => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={i}
                                onClick={() => navigate(item.path)}
                                className={`flex flex-col items-center justify-center gap-2 ${item.color} p-4 md:py-7 rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-wider transition-all shadow-md hover:shadow-xl hover:-translate-y-1 active:scale-95 border border-transparent`}
                            >
                                <Icon className="w-5 h-5 opacity-90" />
                                <span>{item.label}</span>
                                <span className="text-[8px] opacity-55 font-medium normal-case tracking-normal hidden md:block">{item.sub}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Main Grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">

                    {/* ── My Courses — Active Curriculum ── */}
                    <div className="bg-white dark:bg-[#111] p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-gold/20 rounded-xl flex items-center justify-center">
                                    <BookOpen className="w-4 h-4 text-gold" />
                                </div>
                                <div>
                                    <h2 className="text-xs font-black text-gray-800 dark:text-gold uppercase tracking-widest">Active Curriculum</h2>
                                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{myCourses.length} Course{myCourses.length !== 1 ? 's' : ''} Assigned</p>
                                </div>
                            </div>
                        </div>

                        {myCourses.length > 0 ? (
                            <div className="space-y-4">
                                {myCourses.map(course => {
                                    const fillPct = course.capacity ? Math.round((course.enrolled / course.capacity) * 100) : 0;
                                    const fillColor = fillPct >= 90 ? 'bg-red-400' : fillPct >= 70 ? 'bg-amber-400' : 'bg-maroon';
                                    return (
                                        <div key={course.id} className="flex items-center justify-between p-5 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 hover:border-maroon/20 transition-all group">
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                <div className="w-12 h-12 bg-maroon text-gold rounded-xl flex items-center justify-center font-black text-xs shrink-0">
                                                    {String(course.id).slice(0, 3)}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="font-bold text-gray-800 dark:text-white truncate">{course.name}</h3>
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{course.schedule || 'Schedule TBD'}</p>
                                                    <div className="flex items-center gap-2 mt-1.5">
                                                        <div className="w-32 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                                                            <div className={`h-full ${fillColor} rounded-full transition-all duration-700`} style={{ width: `${Math.min(fillPct, 100)}%` }} />
                                                        </div>
                                                        <span className="text-[9px] font-bold text-gray-400">{fillPct}% capacity</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0 ml-4">
                                                <p className="text-lg font-black text-gray-800 dark:text-white">{course.enrolled}<span className="text-xs text-gray-300 font-bold">/{course.capacity}</span></p>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase">Students</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="py-12 text-center">
                                <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                                <p className="text-sm text-gray-400 italic">No courses assigned yet.</p>
                                <p className="text-[10px] text-gray-300 mt-1 font-bold uppercase tracking-widest">Contact admin to get assigned</p>
                            </div>
                        )}
                    </div>

                    {/* ── Units Management — smart course cards ── */}
                    <div className="bg-white dark:bg-[#111] p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-maroon/10 rounded-xl flex items-center justify-center">
                                    <Layers className="w-4 h-4 text-maroon dark:text-gold" />
                                </div>
                                <div>
                                    <h2 className="text-xs font-black text-gray-800 dark:text-gold uppercase tracking-widest">My Course Units</h2>
                                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Manage modules & enter marks</p>
                                </div>
                            </div>
                            <button
                                onClick={() => navigate('/grades')}
                                className="text-[9px] font-black uppercase tracking-widest text-maroon dark:text-gold hover:underline flex items-center gap-1"
                            >
                                View All <ChevronRight className="w-3 h-3" />
                            </button>
                        </div>

                        {myCourses.length > 0 ? (
                            <div className="space-y-3">
                                {myCourses.map(course => (
                                    <div key={course.id} className="p-5 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 hover:border-maroon/20 transition-all group">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                <div className="w-10 h-10 bg-maroon text-gold rounded-xl flex items-center justify-center font-black text-[10px] shrink-0">
                                                    {String(course.id).slice(0, 3)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-black text-gray-800 dark:text-white uppercase tracking-tight truncate">{course.name}</p>
                                                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{course.enrolled || 0} students enrolled</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    onClick={() => navigate(`/grades?course=${course.id}`)}
                                                    className="flex items-center gap-1.5 px-3 py-2 bg-maroon/5 hover:bg-maroon hover:text-gold text-maroon dark:text-gold rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-maroon/10 hover:border-maroon"
                                                    title="Manage Units"
                                                >
                                                    <Layers className="w-3 h-3" /> Units
                                                </button>
                                                <button
                                                    onClick={() => navigate(`/grades?course=${course.id}`)}
                                                    className="flex items-center gap-1.5 px-3 py-2 bg-gold text-maroon hover:bg-amber-400 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-sm"
                                                    title="Enter Marks"
                                                >
                                                    <Edit3 className="w-3 h-3" /> Marks
                                                </button>
                                            </div>
                                        </div>
                                        {/* Enrollment mini-bar */}
                                        {course.capacity > 0 && (
                                            <div className="mt-3 flex items-center gap-2">
                                                <div className="flex-1 h-1 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                                                    <div className="h-full bg-maroon dark:bg-gold rounded-full transition-all duration-700"
                                                        style={{ width: `${Math.min(Math.round((course.enrolled / course.capacity) * 100), 100)}%` }} />
                                                </div>
                                                <span className="text-[8px] font-bold text-gray-400 shrink-0">
                                                    {Math.round((course.enrolled / course.capacity) * 100)}% full
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-10 text-center">
                                <Layers className="w-10 h-10 text-gray-200 dark:text-white/10 mx-auto mb-3" />
                                <p className="text-sm text-gray-400 italic">No courses assigned yet.</p>
                                <p className="text-[10px] text-gray-300 mt-1 font-bold uppercase tracking-widest">Contact admin to get assigned</p>
                            </div>
                        )}
                    </div>

                    {/* ── Upcoming Sessions ── */}
                    <div className="bg-white dark:bg-[#111] p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-8 h-8 bg-maroon/10 rounded-xl flex items-center justify-center">
                                <Clock className="w-4 h-4 text-maroon dark:text-gold" />
                            </div>
                            <div>
                                <h2 className="text-xs font-black text-gray-800 dark:text-gold uppercase tracking-widest">Upcoming Schedule</h2>
                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{mySessions.length} session{mySessions.length !== 1 ? 's' : ''} on record</p>
                            </div>
                        </div>
                        {mySessions.length > 0 ? (
                            <div className="space-y-3">
                                {mySessions.map((session, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 hover:border-maroon/20 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-maroon/10 dark:bg-white/5 rounded-xl flex items-center justify-center shrink-0">
                                                <Calendar className="w-4 h-4 text-maroon dark:text-gold" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-800 dark:text-white text-sm">
                                                    {session.course_name || session.course || session.name || 'Session'}
                                                </h3>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                                    {session.day || session.day_of_week || ''}
                                                    {(session.day || session.day_of_week) ? ' @ ' : ''}
                                                    {session.start_time || session.time || ''}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="px-3 py-1 bg-white dark:bg-[#1a1a1a] rounded-lg border border-gray-200 dark:border-white/10 text-[10px] font-bold text-gray-600 dark:text-gray-300">
                                                {session.room || session.location || 'TBD'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-12 text-center">
                                <Calendar className="w-12 h-12 text-gray-200 dark:text-white/10 mx-auto mb-3" />
                                <p className="text-sm text-gray-400 italic">No upcoming sessions scheduled.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Announcements Sidebar ── */}
                <div className="bg-white dark:bg-[#111] p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm h-fit sticky top-6">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center">
                                <Bell className="w-4 h-4 text-amber-500" />
                            </div>
                            <div>
                                <h2 className="text-xs font-black text-gray-800 dark:text-white uppercase tracking-widest">Faculty Notices</h2>
                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{recentAnnouncements.length} active</p>
                            </div>
                        </div>
                        <button onClick={() => navigate('/announcements')} className="text-[9px] font-black uppercase tracking-widest text-maroon dark:text-gold hover:underline flex items-center gap-1">
                            View All <ChevronRight className="w-3 h-3" />
                        </button>
                    </div>
                    <div className="space-y-5">
                        {recentAnnouncements.length > 0 ? recentAnnouncements.map((ann, idx) => {
                            const style = announcementPriorityStyle(idx);
                            return (
                                <div key={ann.id} className={`relative pl-5 border-l-2 ${style.line} pb-5 last:pb-0`}>
                                    <div className={`absolute -left-[5px] top-0.5 w-2.5 h-2.5 ${style.dot} rounded-full`} />
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{ann.date}</p>
                                        <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${style.chip}`}>{style.label}</span>
                                    </div>
                                    <h4 className="text-xs font-bold text-gray-800 dark:text-white mb-1">{ann.title}</h4>
                                    <p className="text-[10px] text-gray-400 font-medium line-clamp-2">{ann.content}</p>
                                </div>
                            );
                        }) : (
                            <div className="py-8 text-center">
                                <Bell className="w-10 h-10 text-gray-200 dark:text-white/10 mx-auto mb-3" />
                                <p className="text-xs text-gray-400 italic">No announcements yet.</p>
                            </div>
                        )}
                    </div>

                    {/* Quick Summary at bottom */}
                    {myCourses.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-white/5">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-4">Academic Summary</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-maroon/5 p-3 rounded-xl text-center">
                                    <p className="text-xl font-black text-maroon">{myCourses.length}</p>
                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Courses</p>
                                </div>
                                <div className="bg-emerald-50 p-3 rounded-xl text-center">
                                    <p className="text-xl font-black text-emerald-600">{totalStudents}</p>
                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Students</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
