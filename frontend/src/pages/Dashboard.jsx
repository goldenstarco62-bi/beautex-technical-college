import { useEffect, useState } from 'react';
import { Users, BookOpen, UserCheck, TrendingUp, Zap, UserPlus, FileText, DollarSign, GraduationCap, Bell, Activity, ArrowUpRight, RefreshCw } from 'lucide-react';
import { studentsAPI, coursesAPI, facultyAPI, reportsAPI, activityReportsAPI } from '../services/api';
import api from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import TeacherDashboard from './TeacherDashboard';
import StudentDashboard from './StudentDashboard';

function AdminDashboard() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [stats, setStats] = useState({ students: 0, courses: 0, faculty: 0, attendance: 0, revenue: 0 });
    const [students, setStudents] = useState([]);
    const [courses, setCourses] = useState([]);
    const [recentReports, setRecentReports] = useState([]);
    const [activityReports, setActivityReports] = useState([]);
    const [activeTab, setActiveTab] = useState('analytics');
    const [lastUpdated, setLastUpdated] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

    useEffect(() => { fetchData(); }, []);

    const fetchData = async (silent = false) => {
        try {
            if (!silent) setRefreshing(true);
            const [studentsRes, coursesRes, facultyRes, reportsRes, statsRes, activityRes] = await Promise.all([
                studentsAPI.getAll(),
                coursesAPI.getAll(),
                facultyAPI.getAll(),
                reportsAPI.getAll({ limit: 10 }),
                api.get('/stats/dashboard'),
                activityReportsAPI.getDailyReports({ limit: 10 })
            ]);

            const studentsData = Array.isArray(studentsRes.data) ? studentsRes.data : [];
            const coursesData = Array.isArray(coursesRes.data) ? coursesRes.data : [];
            const reportsData = Array.isArray(reportsRes.data) ? reportsRes.data : [];
            const activityData = activityRes.data.data || [];
            const statsData = statsRes.data;

            setStudents(studentsData);
            setCourses(coursesData);
            setRecentReports(reportsData);
            setActivityReports(activityData);
            setStats({
                students: statsData.summary.students,
                courses: statsData.summary.courses,
                faculty: statsData.summary.faculty,
                attendance: statsData.summary.attendance,
                revenue: statsData.summary.revenue || 0,
                distribution: statsData.courseDistribution || []
            });
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setRefreshing(false);
        }
    };

    const statsDisplay = [
        { title: 'Total Students', value: stats.students.toLocaleString(), icon: Users, change: '+12%', trend: 'up', color: 'maroon', bg: 'bg-maroon/5', iconColor: 'text-maroon' },
        { title: 'Active Courses', value: stats.courses.toLocaleString(), icon: BookOpen, change: '+2', trend: 'up', color: 'blue', bg: 'bg-blue-50', iconColor: 'text-blue-600' },
        { title: 'Faculty Members', value: stats.faculty.toLocaleString(), icon: UserCheck, change: '0%', trend: 'up', color: 'green', bg: 'bg-green-50', iconColor: 'text-green-600' },
        { title: 'Avg Attendance', value: `${stats.attendance}%`, icon: TrendingUp, change: '-0.4%', trend: 'down', color: 'amber', bg: 'bg-amber-50', iconColor: 'text-amber-600' },
        { title: 'Total Revenue', value: `KSh ${Number(stats.revenue).toLocaleString()}`, icon: DollarSign, change: '+5.2%', trend: 'up', color: 'emerald', bg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
    ];

    const chartData = (stats.distribution || []).map(item => ({
        name: item.name,
        enrolled: item.enrolled,
        capacity: item.capacity
    }));

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* Welcome Banner */}
            <div className="relative overflow-hidden bg-gradient-to-br from-maroon to-maroon/90 rounded-[2.5rem] p-8 md:p-10 text-white shadow-2xl shadow-maroon/20">
                <div className="absolute top-0 right-0 w-80 h-80 bg-gold/10 rounded-full translate-x-1/3 -translate-y-1/3 blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
                <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <p className="text-[10px] font-black text-gold/60 uppercase tracking-[0.3em] mb-1">{greeting}</p>
                        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter leading-tight">
                            {user?.name || 'Administrator'} <span className="text-gold">↗</span>
                        </h1>
                        <p className="text-sm text-white/50 font-medium mt-2">Strategic Operations & Management Centre</p>
                    </div>
                    <div className="flex flex-col items-start md:items-end gap-2">
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                            {now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                        <button
                            onClick={() => fetchData(true)}
                            disabled={refreshing}
                            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/10"
                        >
                            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Refresh'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6">
                {statsDisplay.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <div key={index} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group overflow-hidden relative">
                            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${stat.trend === 'up' ? 'from-green-400 to-emerald-500' : 'from-red-400 to-rose-500'} opacity-0 group-hover:opacity-100 transition-opacity`} />
                            <div className="flex justify-between items-start relative z-10">
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{stat.title}</p>
                                    <p className="text-2xl md:text-3xl font-black text-gray-800">{stat.value}</p>
                                    <div className={`flex items-center gap-1 mt-2 text-[10px] font-bold ${stat.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                                        <ArrowUpRight className={`w-3 h-3 ${stat.trend === 'down' ? 'rotate-90' : ''}`} />
                                        {stat.change} this term
                                    </div>
                                </div>
                                <div className={`w-12 h-12 md:w-14 md:h-14 ${stat.bg} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                                    <Icon className={`w-6 h-6 md:w-7 md:h-7 ${stat.iconColor}`} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Quick Actions */}
            <div className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-gray-100 shadow-lg relative overflow-hidden">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-6 h-6 bg-gold/20 rounded flex items-center justify-center">
                        <Zap className="w-4 h-4 text-gold" />
                    </div>
                    <h2 className="text-xs font-black text-gray-800 uppercase tracking-widest">Global Directives</h2>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    {[
                        { label: 'Register Student', sub: 'Add new enrollee', icon: UserPlus, color: 'bg-maroon text-gold', path: '/students' },
                        { label: 'Recruit Faculty', sub: 'Onboard staff', icon: UserPlus, color: 'bg-gold text-maroon', path: '/faculty' },
                        { label: 'Export Analytics', sub: 'Print reports', icon: FileText, color: 'bg-blue-600 text-white', action: () => window.print() },
                        { label: 'Treasury Hub', sub: 'Finance records', icon: DollarSign, color: 'bg-green-600 text-white', path: '/finance' },
                    ].map((item, i) => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={i}
                                onClick={item.path ? () => navigate(item.path) : item.action}
                                className={`flex flex-col items-center justify-center gap-2 ${item.color} p-4 md:py-6 rounded-xl md:rounded-2xl font-black text-[8px] md:text-[10px] uppercase tracking-wider transition-all shadow-lg hover:-translate-y-1 active:scale-95`}
                            >
                                <Icon className="w-4 h-4 md:w-5 md:h-5 opacity-80" />
                                <span>{item.label}</span>
                                <span className="text-[8px] opacity-60 font-medium normal-case tracking-normal hidden md:block">{item.sub}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Hub Navigation Tabs */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 px-2">
                <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-2xl border border-gray-200/50 dark:border-white/5 backdrop-blur-xl">
                    {[
                        { id: 'analytics', label: 'Performance Hub', icon: Activity },
                        { id: 'activity', label: 'Institutional Logs', icon: FileText },
                        { id: 'academic', label: 'Academic Records', icon: GraduationCap },
                    ].map((tab) => {
                        const Icon = tab.icon;
                        const active = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-500 ${
                                    active 
                                    ? 'bg-white dark:bg-gray-700 text-maroon dark:text-gold shadow-xl shadow-black/5' 
                                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                                }`}
                            >
                                <Icon className={`w-3.5 h-3.5 ${active ? 'scale-110' : 'opacity-50'}`} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
                {activeTab !== 'analytics' && (
                    <button 
                        onClick={() => navigate(activeTab === 'activity' ? '/activity-reports' : '/reports')}
                        className="text-[10px] font-black uppercase tracking-widest text-maroon hover:text-gold transition-colors flex items-center gap-2 group"
                    >
                        View Full Registry <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </button>
                )}
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 gap-8">
                {activeTab === 'analytics' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in zoom-in duration-700">
                    <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
                        <div className="flex justify-between items-center mb-10">
                            <div>
                                <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest">Enrollment Performance</h2>
                                <p className="text-[10px] text-gray-400 font-medium mt-1">Students per course unit</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-maroon"></div><span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Enrolled</span></div>
                            </div>
                        </div>
                        <div className="overflow-x-auto pb-4 custom-scrollbar">
                            <div style={{ minWidth: (chartData.length * 80) > 600 ? `${chartData.length * 80}px` : '100%' }}>
                                <ResponsiveContainer width="100%" height={320}>
                                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                        <XAxis dataKey="name" stroke="#475569" fontSize={9} tick={{ fontWeight: 800 }} tickLine={false} axisLine={false} interval={0} angle={-25} textAnchor="end" height={60} />
                                        <YAxis stroke="#475569" fontSize={10} tick={{ fontWeight: 800 }} tickLine={false} axisLine={false} dx={-10} />
                                        <Tooltip
                                            cursor={{ fill: '#f1f5f9' }}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                        />
                                        <Bar dataKey="enrolled" fill="#800000" radius={[6, 6, 0, 0]} barSize={32} activeBar={{ fill: '#FFD700', stroke: '#800000', strokeWidth: 1 }}>
                                            <LabelList dataKey="enrolled" position="top" fill="#800000" fontSize={10} fontWeight="bold" offset={10} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                        <div className="space-y-6">
                            <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm text-center group">
                                <div className="w-16 h-16 bg-maroon/5 rounded-[2rem] flex items-center justify-center mx-auto mb-6 group-hover:bg-maroon transition-colors duration-500">
                                    <GraduationCap className="w-8 h-8 text-maroon group-hover:text-gold transition-colors" />
                                </div>
                                <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-2">Student Management</h3>
                                <p className="text-xs text-gray-400 mb-6 font-medium">Browse, search, and manage student records</p>
                                <button onClick={() => navigate('/students')} className="text-[10px] font-black uppercase tracking-widest text-maroon border-b-2 border-gold pb-1 hover:text-gold transition-colors">View Students →</button>
                            </div>

                            <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm text-center group">
                                <div className="w-16 h-16 bg-gold/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6 group-hover:bg-gold transition-colors duration-500">
                                    <Users className="w-8 h-8 text-gold group-hover:text-maroon transition-colors" />
                                </div>
                                <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-2">Staff Management</h3>
                                <p className="text-xs text-gray-400 mb-6 font-medium">Manage faculty and administrative staff</p>
                                <button onClick={() => navigate('/faculty')} className="text-[10px] font-black uppercase tracking-widest text-maroon border-b-2 border-gold pb-1 hover:text-gold transition-colors">View Staff →</button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'activity' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {activityReports.length > 0 ? activityReports.map((report) => (
                                <div key={report.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="text-[10px] font-black text-maroon uppercase tracking-widest mb-1">{report.department}</p>
                                            <h3 className="text-sm font-black text-gray-800">{new Date(report.report_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</h3>
                                        </div>
                                        <button onClick={() => navigate('/activity-reports')} className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-maroon group-hover:text-gold transition-all">
                                            <ArrowUpRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="bg-gray-50 p-3 rounded-xl text-center">
                                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-tight">Attendance</p>
                                            <p className="text-xs font-black text-gray-800">{report.total_attendance_percentage}%</p>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded-xl text-center">
                                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-tight">Staffing</p>
                                            <p className="text-xs font-black text-gray-800">{report.staff_present} / {report.staff_present + report.staff_absent}</p>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-500 line-clamp-2 italic">“{report.challenges_faced || 'Routine operations completed without significant challenges.'}”</p>
                                </div>
                            )) : (
                                <div className="col-span-full py-20 text-center bg-gray-50/50 rounded-[2.5rem] border-2 border-dashed border-gray-200">
                                    <FileText className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                                    <p className="text-sm font-black text-gray-400 uppercase tracking-widest">No institutional logs archived yet</p>
                                    <button onClick={() => navigate('/activity-reports')} className="mt-4 text-[10px] font-black text-maroon hover:text-gold uppercase tracking-widest">Submit First Report →</button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'academic' && (
                    <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest">Student Performance Logs</h2>
                            <button onClick={() => navigate('/reports')} className="text-[10px] font-black text-maroon uppercase tracking-widest border-b border-maroon">Repository Hub</button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="border-b border-gray-50">
                                    <tr>
                                        <th className="pb-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Student</th>
                                        <th className="pb-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Period</th>
                                        <th className="pb-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Attendance</th>
                                        <th className="pb-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Avg Grade</th>
                                        <th className="pb-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Verdict</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50/50">
                                    {recentReports.length > 0 ? recentReports.map((report) => (
                                        <tr key={report.id} className="group hover:bg-gray-50/30 transition-colors">
                                            <td className="py-4 font-bold text-xs text-gray-800">{report.student_name}</td>
                                            <td className="py-4 text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{report.reporting_period}</td>
                                            <td className="py-4 text-xs font-black text-maroon">{report.attendance_avg}%</td>
                                            <td className="py-4 text-xs font-black text-gold">{report.average_grade}</td>
                                            <td className="py-4">
                                                <span className={`px-2 py-1 rounded-lg text-[9px] font-black ${report.recommendation === 'Proceed' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                                    {report.recommendation.toUpperCase()}
                                                </span>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="5" className="py-10 text-center text-xs text-gray-400 italic">Analytical data pending...</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function Dashboard() {
    const { user } = useAuth();
    const role = (user?.role ? String(user.role) : '').toLowerCase().trim() || 'student';

    if (role === 'teacher') return <TeacherDashboard />;
    if (role === 'student') return <StudentDashboard />;
    return <AdminDashboard />;
}
