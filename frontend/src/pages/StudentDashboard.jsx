import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Award, Clock, Zap, FileText, UserCheck, GraduationCap, CreditCard, FileStack } from 'lucide-react';
import { coursesAPI, gradesAPI, announcementsAPI, attendanceAPI, studentsAPI, reportsAPI } from '../services/api';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';


export default function StudentDashboard() {
    const { user } = useAuth();
    const [studentProfile, setStudentProfile] = useState(null);
    const [courseDetails, setCourseDetails] = useState(null);
    const [stats, setStats] = useState({
        enrolledCourses: 0,
        avgGrade: 'N/A',
        attendanceRate: '0%',
        credits: 0
    });
    const [recentAnnouncements, setRecentAnnouncements] = useState([]);
    const [recentGrades, setRecentGrades] = useState([]);
    const [studentFee, setStudentFee] = useState(null);
    const [loading, setLoading] = useState(true);


    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    const fetchData = async () => {
        try {
            // 1. Fetch all data needed
            const [studentsRes, coursesRes, announcementsRes, gradesRes, feeRes] = await Promise.all([
                studentsAPI.getAll(),
                coursesAPI.getAll(),
                announcementsAPI.getAll(),
                gradesAPI.getAll(),
                api.get(`/finance/student-fees/${user.student_id || user.id}`).catch(() => ({ data: null }))
            ]);


            // 2. Find current student profile
            // Search by email (case-insensitive) or by student ID if available
            const userEmail = String(user?.email || '').toLowerCase().trim();
            const userSid = String(user?.student_id || user?.id || '').toLowerCase().trim();

            const profile = studentsRes.data.find(s =>
                String(s.email || '').toLowerCase().trim() === userEmail ||
                String(s.id || '').toLowerCase().trim() === userSid
            ) || studentsRes.data[0]; // Fallback to first if only one profile returned

            setStudentProfile(profile);
            setStudentFee(feeRes.data);


            // 3. Process Performance (Grades + Reports) - Explicitly filter for security
            const myGrades = (gradesRes.data || []).filter(g => {
                const gradeSid = String(g.student_id || '').trim().toLowerCase();
                const userSid = String(user?.student_id || '').trim().toLowerCase();
                const userEmail = String(user?.email || '').trim().toLowerCase();
                // Match by student ID or by email if student ID is missing in record
                return gradeSid === userSid || (g.email && g.email.toLowerCase() === userEmail);
            }).map(g => ({
                ...g,
                type: 'CAT',
                displayDate: g.month,
                performance: g.remarks,
                rawDate: g.created_at
            }));

            const mergedPerformance = [...myGrades].sort((a, b) =>
                new Date(b.rawDate) - new Date(a.rawDate)
            );

            setRecentGrades(mergedPerformance.slice(0, 5));

            const avgGrade = myGrades.length > 0
                ? Math.round((myGrades.reduce((acc, g) => acc + (g.score / g.max_score), 0) / myGrades.length) * 100)
                : 0;

            if (profile) {
                // 4. Find enrolled course details
                // The backend now filters courses specifically for the logged-in student.
                // coursesRes.data should already be the student's courses only.
                let enrolledCourses = Array.isArray(coursesRes.data) ? coursesRes.data : [];

                // Fallback: if backend returned nothing, filter locally using profile's course field
                if (enrolledCourses.length === 0 && profile.course) {
                    const studentCourses = Array.isArray(profile.course) ? profile.course : [profile.course].filter(Boolean);
                    // We don't have the full course list here since backend only returned student-filtered ones,
                    // so just mark enrolled count from profile info
                    console.warn('No courses returned from API for student. Possible backend lookup failure.');
                }

                setCourseDetails(enrolledCourses[0] || null);

                // 5. Calculate Stats
                setStats({
                    enrolledCourses: enrolledCourses.length,
                    avgGrade: myGrades.length > 0 ? `${avgGrade}%` : (profile.gpa ? `${profile.gpa} GPA` : 'N/A'),
                    attendanceRate: '96%', // Placeholder
                    credits: 15 // Placeholder
                });
            }

            setRecentAnnouncements(announcementsRes.data.slice(0, 3));
        } catch (error) {
            console.error('Error fetching student dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center font-black uppercase tracking-widest text-maroon">Loading Student Portal...</div>;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-end mb-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">Student Portal</h1>
                    <p className="text-sm text-gray-400 font-medium">Welcome back, {studentProfile ? studentProfile.name : (user?.name || user?.email?.split('@')[0])}</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {[
                    { title: 'My Courses', value: stats.enrolledCourses, icon: BookOpen },
                    { title: 'Fee Balance', value: `KSh ${(studentFee?.balance || 0).toLocaleString()}`, icon: CreditCard },
                    { title: 'Attendance', value: stats.attendanceRate, icon: UserCheck },
                    { title: 'Study Materials', value: '12+', icon: FileStack },
                ].map((stat, index) => {

                    const Icon = stat.icon;
                    return (
                        <div key={index} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xl hover:shadow-2xl transition-all group overflow-hidden relative">
                            <div className="flex justify-between items-start relative z-10">
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{stat.title}</p>
                                    <p className="text-3xl font-black text-gray-800">{stat.value}</p>
                                </div>
                                <div className={`w-14 h-14 bg-maroon/5 rounded-2xl flex items-center justify-center`}>
                                    <Icon className="w-7 h-7 text-maroon" />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Current Course View */}
                    <div className="bg-maroon p-6 sm:p-8 rounded-[2rem] shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-gold/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-gold/20 transition-all duration-700"></div>
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
                                            <th className="pb-4 text-left text-[8px] font-black text-gray-400 uppercase tracking-widest pl-4">Remarks/Observations</th>
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
                                                    <p className="text-xs font-bold text-gray-800 uppercase">{record.assignment}</p>
                                                    <p className="text-[8px] text-gray-400 font-medium uppercase tracking-tighter">{record.course || record.course_unit}</p>
                                                </td>
                                                <td className="py-4">
                                                    <span className="text-[10px] font-black text-gray-400 uppercase">{record.displayDate || record.month}</span>
                                                </td>
                                                <td className="py-4 text-right">
                                                    <div className="inline-flex items-center gap-2">
                                                        <span className="text-xs font-black text-maroon">{Math.round((record.score / record.max_score) * 100)}%</span>
                                                    </div>
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
                            <div className="py-12 text-center">
                                <FileText className="w-12 h-12 text-gray-100 mx-auto mb-4" />
                                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">No results committed yet</p>
                            </div>
                        )}
                    </div>

                    {/* Quick Student Actions */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Link to="/grades" className="flex flex-col items-center gap-3 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                                <FileText className="w-6 h-6 text-blue-600 group-hover:text-white" />
                            </div>
                            <span className="text-[9px] font-black uppercase text-gray-500 tracking-widest">Grades</span>
                        </Link>
                        <Link to="/attendance" className="flex flex-col items-center gap-3 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                            <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center group-hover:bg-green-600 transition-colors">
                                <Clock className="w-6 h-6 text-green-600 group-hover:text-white" />
                            </div>
                            <span className="text-[9px] font-black uppercase text-gray-500 tracking-widest">Absences</span>
                        </Link>
                        <button className="flex flex-col items-center gap-3 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                            <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center group-hover:bg-purple-600 transition-colors">
                                <Zap className="w-6 h-6 text-purple-600 group-hover:text-white" />
                            </div>
                            <span className="text-[9px] font-black uppercase text-gray-500 tracking-widest">Events</span>
                        </button>
                        <button className="flex flex-col items-center gap-3 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                            <div className="w-12 h-12 bg-maroon/5 rounded-2xl flex items-center justify-center group-hover:bg-maroon transition-colors">
                                <GraduationCap className="w-6 h-6 text-maroon group-hover:text-white" />
                            </div>
                            <span className="text-[9px] font-black uppercase text-gray-500 tracking-widest">Library</span>
                        </button>
                    </div>
                </div>

                {/* Campus Announcements */}
                <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm h-fit">
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
    );
}
