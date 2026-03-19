import { useEffect, useState } from 'react';
import { BookOpen, Clock, Zap, FileText, ClipboardCheck, Bell, Users, TrendingUp, Calendar, ChevronRight } from 'lucide-react';
import { coursesAPI, announcementsAPI, facultyAPI, sessionsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function TeacherDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [myCourses, setMyCourses] = useState([]);
    const [mySessions, setMySessions] = useState([]);
    const [recentAnnouncements, setRecentAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [teacherName, setTeacherName] = useState('');

    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

    useEffect(() => {
        if (user) fetchData();
    }, [user]);

    const fetchData = async () => {
        try {
            const [coursesRes, announcementsRes, facultyRes, sessionsRes] = await Promise.all([
                coursesAPI.getAll(),
                announcementsAPI.getAll(),
                facultyAPI.getAll(),
                sessionsAPI.getAll()
            ]);

            const teacherProfile = facultyRes.data.find(f => f.email?.toLowerCase() === user.email?.toLowerCase());
            const name = teacherProfile ? teacherProfile.name : (user.name || user.email);
            setTeacherName(name);

            let myCoursesList = coursesRes.data || [];
            if (myCoursesList.length > 0 && teacherProfile) {
                let assignedCourseNames = [];
                try {
                    if (typeof teacherProfile.courses === 'string') {
                        if (teacherProfile.courses.startsWith('[')) {
                            assignedCourseNames = JSON.parse(teacherProfile.courses);
                        } else {
                            assignedCourseNames = teacherProfile.courses.split(',').map(s => s.trim());
                        }
                    } else if (Array.isArray(teacherProfile.courses)) {
                        assignedCourseNames = teacherProfile.courses;
                    }
                } catch (e) {
                    console.error('Error parsing faculty courses:', e);
                }

                const filtered = myCoursesList.filter(c => {
                    const isInstructor = c.instructor && name && c.instructor.toLowerCase() === name.toLowerCase();
                    const isAssigned = assignedCourseNames.some(an => an.toLowerCase() === c.name.toLowerCase());
                    return isInstructor || isAssigned;
                });
                if (filtered.length > 0) myCoursesList = filtered;
            }

            setMyCourses(myCoursesList);
            const filteredSessions = sessionsRes.data.filter(s => s.teacher_email?.toLowerCase() === user.email?.toLowerCase());
            setMySessions(filteredSessions);
            setRecentAnnouncements(announcementsRes.data.slice(0, 4));
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

    const statsDisplay = [
        { title: 'My Courses', value: myCourses.length, icon: BookOpen, bg: 'bg-maroon/5', iconColor: 'text-maroon', borderColor: 'border-maroon/10' },
        { title: 'Scheduled Sessions', value: mySessions.length, icon: Clock, bg: 'bg-blue-50', iconColor: 'text-blue-600', borderColor: 'border-blue-100' },
        { title: 'Announcements', value: recentAnnouncements.length, icon: Bell, bg: 'bg-amber-50', iconColor: 'text-amber-600', borderColor: 'border-amber-100' },
        { title: 'Department', value: 'Tech', icon: Zap, bg: 'bg-green-50', iconColor: 'text-green-600', borderColor: 'border-green-100' },
    ];

    const quickActions = [
        { label: 'Mark Attendance', sub: 'Daily sign-in', icon: ClipboardCheck, color: 'bg-maroon text-gold', path: '/attendance' },
        { label: 'Daily Report', sub: 'Student logs', icon: FileText, color: 'bg-white text-maroon border-2 border-maroon', path: '/student-daily-reports' },
        { label: 'Post Grades', sub: 'Academic scores', icon: TrendingUp, color: 'bg-gold text-maroon', path: '/grades' },
        { label: 'My Schedule', sub: 'View timetable', icon: Calendar, color: 'bg-blue-600 text-white', path: '/schedule' },
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* Welcome Banner */}
            <div className="relative overflow-hidden bg-gradient-to-br from-maroon to-maroon/90 rounded-[2.5rem] p-8 md:p-10 text-white shadow-2xl shadow-maroon/20">
                <div className="absolute top-0 right-0 w-72 h-72 bg-gold/10 rounded-full translate-x-1/3 -translate-y-1/3 blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-1/2 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
                <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <p className="text-[10px] font-black text-gold/60 uppercase tracking-[0.3em] mb-1">{greeting}, Faculty</p>
                        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter leading-tight">
                            {teacherName} <span className="text-gold">↗</span>
                        </h1>
                        <p className="text-sm text-white/50 font-medium mt-2">Faculty Portal — Academic Session Active</p>
                    </div>
                    <div className="flex flex-col items-start md:items-end gap-3">
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                            {now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
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

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {statsDisplay.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <div key={index} className={`bg-white p-6 rounded-[2rem] border ${stat.borderColor} shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{stat.title}</p>
                                    <p className="text-3xl font-black text-gray-800">{stat.value}</p>
                                </div>
                                <div className={`w-12 h-12 ${stat.bg} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                                    <Icon className={`w-6 h-6 ${stat.iconColor}`} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Quick Actions */}
            <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-gray-100 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-6 h-6 bg-gold/20 rounded flex items-center justify-center">
                        <Zap className="w-4 h-4 text-gold" />
                    </div>
                    <h2 className="text-xs font-black text-gray-800 uppercase tracking-widest">Quick Actions</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    {quickActions.map((item, i) => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={i}
                                onClick={() => navigate(item.path)}
                                className={`flex flex-col items-center justify-center gap-2 ${item.color} p-4 md:py-6 rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-wider transition-all shadow-md hover:shadow-xl hover:-translate-y-1 active:scale-95`}
                            >
                                <Icon className="w-5 h-5 opacity-80" />
                                <span>{item.label}</span>
                                <span className="text-[8px] opacity-60 font-medium normal-case tracking-normal hidden md:block">{item.sub}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">

                    {/* My Courses */}
                    <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-gold/20 rounded flex items-center justify-center">
                                    <BookOpen className="w-4 h-4 text-gold" />
                                </div>
                                <h2 className="text-xs font-black text-gray-800 uppercase tracking-widest">Active Curriculum</h2>
                            </div>
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{myCourses.length} Course{myCourses.length !== 1 ? 's' : ''}</span>
                        </div>
                        {myCourses.length > 0 ? (
                            <div className="space-y-4">
                                {myCourses.map(course => {
                                    const fillPct = course.capacity ? Math.round((course.enrolled / course.capacity) * 100) : 0;
                                    return (
                                        <div key={course.id} className="flex items-center justify-between p-5 bg-gray-50 rounded-2xl border border-gray-100 hover:border-maroon/20 transition-all group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-maroon text-gold rounded-xl flex items-center justify-center font-black text-xs shrink-0">
                                                    {course.id}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-800">{course.name}</h3>
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{course.schedule || 'Schedule TBD'}</p>
                                                    {/* Enrollment bar */}
                                                    <div className="flex items-center gap-2 mt-1.5">
                                                        <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                            <div className="h-full bg-maroon rounded-full" style={{ width: `${Math.min(fillPct, 100)}%` }} />
                                                        </div>
                                                        <span className="text-[9px] font-bold text-gray-400">{fillPct}% full</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-black text-gray-800">{course.enrolled}/{course.capacity}</p>
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

                    {/* Upcoming Sessions */}
                    <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-2 mb-8">
                            <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
                                <Clock className="w-4 h-4 text-blue-600" />
                            </div>
                            <h2 className="text-xs font-black text-gray-800 uppercase tracking-widest">Upcoming Schedule</h2>
                        </div>
                        {mySessions.length > 0 ? (
                            <div className="space-y-4">
                                {mySessions.map((session, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-blue-50/30 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                                                <Calendar className="w-4 h-4 text-blue-600" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-800">{session.course}</h3>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{session.day} @ {session.time}</p>
                                            </div>
                                        </div>
                                        <div className="px-3 py-1 bg-white rounded-lg border border-gray-200 text-[10px] font-bold text-gray-600">
                                            {session.room}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-12 text-center">
                                <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                                <p className="text-sm text-gray-400 italic">No upcoming sessions scheduled.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Announcements Sidebar */}
                <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest">Faculty Notices</h2>
                        <button onClick={() => navigate('/announcements')} className="text-[9px] font-black uppercase tracking-widest text-maroon hover:text-gold transition-colors flex items-center gap-1">
                            View All <ChevronRight className="w-3 h-3" />
                        </button>
                    </div>
                    <div className="space-y-6">
                        {recentAnnouncements.length > 0 ? recentAnnouncements.map(ann => (
                            <div key={ann.id} className="relative pl-6 border-l-2 border-gold pb-6 last:pb-0">
                                <div className="absolute -left-[5px] top-0 w-2 h-2 bg-gold rounded-full" />
                                <p className="text-[9px] font-black text-gold uppercase tracking-widest mb-1">{ann.date}</p>
                                <h4 className="text-xs font-bold text-gray-800 mb-1">{ann.title}</h4>
                                <p className="text-[10px] text-gray-400 font-medium line-clamp-2">{ann.content}</p>
                            </div>
                        )) : (
                            <div className="py-8 text-center">
                                <Bell className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                                <p className="text-xs text-gray-400 italic">No announcements yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
