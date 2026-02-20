import { useEffect, useState } from 'react';
import { studentsAPI, coursesAPI, attendanceAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Calendar, CheckCircle2, XCircle, Clock } from 'lucide-react';

export default function Attendance() {
    const { user } = useAuth();
    const isStudent = (user?.role ? String(user.role).toLowerCase() : '') === 'student';

    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState('');
    const [students, setStudents] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const { data } = await coursesAPI.getAll();
            setCourses(data);
            if (data.length > 0) setSelectedCourse(data[0].name);
        } catch (error) {
            console.error('Error fetching courses:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isStudent && selectedCourse) {
            fetchRegistry();
        } else if (isStudent) {
            fetchStudentHistory();
        }
    }, [selectedCourse, selectedDate, user]);

    const fetchRegistry = async () => {
        try {
            const [studentsRes, attendanceRes] = await Promise.all([
                studentsAPI.getAll(),
                attendanceAPI.getAll(selectedCourse, selectedDate).catch(() => ({ data: [] }))
            ]);
            const filtered = studentsRes.data.filter(s => s.course === selectedCourse);
            const existingMap = {};
            (attendanceRes.data || []).forEach(r => { existingMap[r.student_id] = r.status; });
            setStudents(filtered.map(s => ({ ...s, attendance: existingMap[s.id] || '' })));
        } catch (error) {
            console.error('Error fetching registry:', error);
        }
    };

    const fetchStudentHistory = async () => {
        try {
            // Fetch this student's own attendance records from the API
            const { data } = await attendanceAPI.getAll(null, null);
            // The API returns all records; filter for this student by studentId
            const studentId = user.student_id || user.id;
            const history = Array.isArray(data)
                ? data.filter(r => String(r.student_id) === String(studentId))
                : [];
            setStudents(history.length > 0 ? history : []);
        } catch (error) {
            console.error('Error fetching student history:', error);
            setStudents([]);
        }
    };

    const updateStatus = (id, status) => {
        setStudents(prev => prev.map(s =>
            s.id === id ? { ...s, attendance: status } : s
        ));
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            const attendanceData = students.map(s => ({
                student_id: s.id,
                course: selectedCourse,
                date: selectedDate,
                status: s.attendance || 'Absent'
            }));

            // Mark all in parallel (simplified for demo)
            await Promise.all(attendanceData.map(record => attendanceAPI.mark(record)));
            alert('Daily Registry Portfolio saved successfully!');
        } catch (error) {
            console.error('Error saving attendance:', error);
            alert('Failed to save attendance registry.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center font-black uppercase tracking-widest text-maroon">Accessing Registry...</div>;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-maroon tracking-tight uppercase">
                        {isStudent ? 'Attendance Profile' : 'Attendance Registry'}
                    </h1>
                    <p className="text-xs text-maroon/40 font-bold tracking-widest mt-1">
                        {isStudent ? 'Your Daily Participation Log' : 'Daily Registry Management'}
                    </p>
                </div>
            </div>

            {!isStudent && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="sm:col-span-2 card-light p-3">
                        <select
                            value={selectedCourse}
                            onChange={(e) => setSelectedCourse(e.target.value)}
                            className="w-full h-full py-3 bg-parchment-100 border-none rounded-xl text-xs font-black uppercase tracking-widest text-maroon/60 px-4 focus:ring-2 focus:ring-maroon/5 outline-none"
                        >
                            <option value="">Select Academic Program</option>
                            {courses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="card-light p-3 flex gap-2 items-center">
                        <Calendar className="w-4 h-4 text-maroon/20 ml-2" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="flex-1 bg-transparent border-none text-xs font-black uppercase tracking-widest text-maroon/60 py-3 outline-none"
                        />
                    </div>
                    <button onClick={fetchRegistry} className="bg-maroon text-gold px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg hover:bg-elite-maroon transition-all">
                        Load Registry
                    </button>
                </div>
            )}

            <div className="card-light overflow-x-auto shadow-xl border border-maroon/5 custom-scrollbar">
                <table className="w-full min-w-[700px]">
                    <thead>
                        <tr className="bg-maroon/5">
                            {isStudent ? (
                                ['Date', 'Subject/Course', 'Status', 'Log Time'].map(header => (
                                    <th key={header} className="px-6 py-5 text-left text-[10px] font-black text-maroon/40 uppercase tracking-[0.2em]">{header}</th>
                                ))
                            ) : (
                                ['Registry ID', 'Student Name', 'Status', 'Action'].map(header => (
                                    <th key={header} className="px-6 py-5 text-left text-[10px] font-black text-maroon/40 uppercase tracking-[0.2em]">{header}</th>
                                ))
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-maroon/5">
                        {students.map((student, idx) => (
                            <tr key={idx} className="hover:bg-parchment-100/50 transition-colors group">
                                {isStudent ? (
                                    <>
                                        <td className="px-6 py-5 text-[10px] font-black text-maroon uppercase tracking-widest">{student.date}</td>
                                        <td className="px-6 py-5 text-sm font-bold text-maroon">{student.course}</td>
                                        <td className="px-6 py-5">
                                            <span className={`px-4 py-1.5 text-[9px] font-black rounded-lg uppercase tracking-widest ${student.status === 'Present' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                                {student.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-[10px] font-bold text-maroon/30 italic">Synced at 10:24 AM</td>
                                    </>
                                ) : (
                                    <>
                                        <td className="px-6 py-5 text-[10px] font-black text-maroon">{student.id}</td>
                                        <td className="px-6 py-5 font-bold text-maroon">{student.name}</td>
                                        <td className="px-6 py-5">
                                            <span className={`px-4 py-1.5 text-[9px] font-black rounded-lg uppercase tracking-widest ${student.attendance === 'Present' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                                {student.attendance || 'Pending'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 flex gap-2">
                                            <button onClick={() => updateStatus(student.id, 'Present')} className="p-2 bg-parchment-100 rounded-lg hover:bg-green-600 hover:text-white transition-all"><CheckCircle2 className="w-5 h-5" /></button>
                                            <button onClick={() => updateStatus(student.id, 'Absent')} className="p-2 bg-parchment-100 rounded-lg hover:bg-red-600 hover:text-white transition-all"><XCircle className="w-5 h-5" /></button>
                                        </td >
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-end pr-8">
                <button
                    onClick={isStudent ? () => window.print() : handleSave}
                    className="bg-maroon text-gold px-12 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-elite-maroon shadow-2xl transition-all"
                >
                    {isStudent ? 'Download Attendance Report' : 'Save Daily Registry Portfolio'}
                </button>
            </div>
        </div>
    );
}
