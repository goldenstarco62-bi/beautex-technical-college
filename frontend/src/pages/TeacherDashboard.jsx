import { useEffect, useState } from 'react';
import { BookOpen, Clock, Zap, FileText, ClipboardCheck } from 'lucide-react';
import { coursesAPI, announcementsAPI, facultyAPI, sessionsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function TeacherDashboard() {
    const { user } = useAuth();
    const [myCourses, setMyCourses] = useState([]);
    const [mySessions, setMySessions] = useState([]);
    const [recentAnnouncements, setRecentAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [teacherName, setTeacherName] = useState('');

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    const fetchData = async () => {
        try {
            const [coursesRes, announcementsRes, facultyRes, sessionsRes] = await Promise.all([
                coursesAPI.getAll(),
                announcementsAPI.getAll(),
                facultyAPI.getAll(),
                sessionsAPI.getAll()
            ]);

            // 1. Identify the teacher (Case-insensitive)
            const teacherProfile = facultyRes.data.find(f => f.email?.toLowerCase() === user.email?.toLowerCase());
            const name = teacherProfile ? teacherProfile.name : (user.name || user.email);
            setTeacherName(name);

            // 2. The backend already filters courses to only those belonging to the logged-in teacher.
            //    We trust those results directly. If the backend returned courses, use them as-is.
            //    Only apply client-side fallback filtering if needed (e.g. admin accidentally included more).
            let myCoursesList = coursesRes.data || [];

            // Secondary client-side filter: only applies if backend may have returned more than needed
            // (e.g. admin role mistakenly served, or there's an edge case). This ensures correctness
            // without breaking the primary case where backend already returns the right subset.
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
                // Only use the frontend-filtered subset if it has results; otherwise trust backend list
                if (filtered.length > 0) {
                    myCoursesList = filtered;
                }
            }

            setMyCourses(myCoursesList);

            // 3. Filter Sessions (where teacher_email matches - Case-insensitive)
            const filteredSessions = sessionsRes.data.filter(s => s.teacher_email?.toLowerCase() === user.email?.toLowerCase());
            setMySessions(filteredSessions);

            setRecentAnnouncements(announcementsRes.data.slice(0, 3));
        } catch (error) {
            console.error('Error fetching teacher dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center font-black uppercase tracking-widest text-maroon">Loading Faculty Portal...</div>;

    const statsDisplay = [
        { title: 'My Courses', value: myCourses.length, icon: BookOpen, color: 'maroon' },
        { title: 'Upcoming Classes', value: mySessions.length, icon: Clock, color: 'blue' },
        { title: 'Department', value: 'Tech', icon: Zap, color: 'green' }, // Static for now or fetch from profile
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-end mb-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">Faculty Portal</h1>
                    <p className="text-sm text-gray-400 font-medium">Welcome back, {teacherName}</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {statsDisplay.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <div key={index} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xl hover:shadow-2xl transition-all group overflow-hidden relative">
                            <div className="flex justify-between items-start relative z-10">
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{stat.title}</p>
                                    <p className="text-3xl font-black text-gray-800">{stat.value}</p>
                                </div>
                                <div className={`w-14 h-14 bg-maroon/5 rounded-2xl flex items-center justify-center transition-colors`}>
                                    <Icon className="w-7 h-7 text-maroon" />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* My Courses */}
                    <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-2 mb-8">
                            <div className="w-6 h-6 bg-gold/20 rounded flex items-center justify-center">
                                <Zap className="w-4 h-4 text-gold" />
                            </div>
                            <h2 className="text-xs font-black text-gray-800 uppercase tracking-widest">Active Curriculum</h2>
                        </div>
                        {myCourses.length > 0 ? (
                            <div className="space-y-4">
                                {myCourses.map(course => (
                                    <div key={course.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-maroon/20 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-maroon text-gold rounded-xl flex items-center justify-center font-black text-xs">
                                                {course.id}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-800">{course.name}</h3>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{course.schedule}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-black text-gray-800">{course.enrolled}/{course.capacity}</p>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase">Enrolled</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-400 italic">No courses assigned yet.</p>
                        )}
                    </div>

                    {/* Quick Teacher Actions */}
                    <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-gray-100 shadow-lg relative overflow-hidden">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                            <a href="/attendance" className="flex items-center justify-center gap-3 bg-maroon text-white px-6 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-maroon-dark transition-all shadow-xl hover:-translate-y-1">
                                <ClipboardCheck className="w-4 h-4 text-gold" /> Mark Attendance
                            </a>
                            <a href="/grades" className="flex items-center justify-center gap-3 bg-gold text-maroon px-6 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-gold-dark transition-all shadow-xl hover:-translate-y-1">
                                <FileText className="w-4 h-4" /> Post Grades
                            </a>
                            <a href="/schedule" className="flex items-center justify-center gap-3 bg-blue-600 text-white px-6 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-blue-700 transition-all shadow-xl hover:-translate-y-1">
                                <Clock className="w-4 h-4 text-blue-200" /> My Schedule
                            </a>
                        </div>
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
                                    <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                        <div>
                                            <h3 className="font-bold text-gray-800">{session.course}</h3>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{session.day} @ {session.time}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="px-3 py-1 bg-white rounded-lg border border-gray-200 text-[10px] font-bold text-gray-600">
                                                {session.room}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-400 italic">No upcoming sessions scheduled.</p>
                        )}
                    </div>

                </div>

                {/* Announcements Sidebar */}
                <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
                    <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-8">Faculty Notices</h2>
                    <div className="space-y-6">
                        {recentAnnouncements.map(ann => (
                            <div key={ann.id} className="relative pl-6 border-l-2 border-gold pb-6 last:pb-0">
                                <p className="text-[9px] font-black text-gold uppercase tracking-widest mb-1">{ann.date}</p>
                                <h4 className="text-xs font-bold text-gray-800 mb-1">{ann.title}</h4>
                                <p className="text-[10px] text-gray-400 font-medium line-clamp-2">{ann.content}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
