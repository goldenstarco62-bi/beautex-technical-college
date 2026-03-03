import { useEffect, useState } from 'react';
import { studentsAPI, coursesAPI, attendanceAPI, studentDailyReportsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Calendar, CheckCircle2, XCircle, AlertTriangle, UserPlus, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function Attendance() {
    const { user } = useAuth();
    const isStudent = (user?.role ? String(user.role).toLowerCase() : '') === 'student';

    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState('');
    const [students, setStudents] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [topicsCovered, setTopicsCovered] = useState('');
    const [trainerRemarks, setTrainerRemarks] = useState('');
    const [dailyReports, setDailyReports] = useState([]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            setError('');
            const { data } = await coursesAPI.getAll();
            setCourses(data);
            if (data.length > 0) setSelectedCourse(data[0].name);
        } catch (err) {
            console.error('Error fetching courses:', err);
            setError('Failed to load courses. Please refresh the page.');
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
        if (!selectedCourse) {
            setStudents([]);
            return;
        }
        try {
            setError('');
            const [studentsRes, attendanceRes, reportsRes] = await Promise.all([
                studentsAPI.getAll(),
                attendanceAPI.getAll(selectedCourse, selectedDate).catch(() => ({ data: [] })),
                studentDailyReportsAPI.getAll({ course: selectedCourse, date: selectedDate }).catch(() => ({ data: [] }))
            ]);

            const allStudents = Array.isArray(studentsRes.data) ? studentsRes.data : [];
            const selectedCourseLower = selectedCourse.toLowerCase().trim();
            let filtered = allStudents.filter(s => {
                const studentCourses = Array.isArray(s.course)
                    ? s.course
                    : [s.course].filter(Boolean);
                return studentCourses.some(c => c && c.toLowerCase().trim() === selectedCourseLower);
            });

            if (filtered.length === 0 && allStudents.length > 0) {
                filtered = allStudents;
            }

            const existingMap = {};
            (attendanceRes.data || []).forEach(r => { existingMap[r.student_id] = r; });

            const reportsData = reportsRes.data || [];
            setDailyReports(reportsData);

            if (reportsData.length > 0) {
                setTopicsCovered(reportsData[0].topics_covered || '');
                setTrainerRemarks(reportsData[0].trainer_remarks || '');
            } else {
                setTopicsCovered('');
                setTrainerRemarks('');
            }

            setStudents(filtered.map(s => ({
                ...s,
                attendance: existingMap[s.id]?.status || 'Pending',
                existingRecordId: existingMap[s.id]?.id || existingMap[s.id]?._id || null
            })));
        } catch (err) {
            console.error('Error fetching registry:', err);
            setError('Failed to load attendance registry.');
        }
    };

    const fetchStudentHistory = async () => {
        try {
            setError('');
            const studentId = user.student_id || user.id;
            const [attendanceRes, reportsRes] = await Promise.all([
                attendanceAPI.getAll(null, null, studentId),
                studentDailyReportsAPI.getAll({ student_id: studentId }).catch(() => ({ data: [] }))
            ]);

            const attData = Array.isArray(attendanceRes.data) ? attendanceRes.data : [];
            const repData = Array.isArray(reportsRes.data) ? reportsRes.data : [];

            const enriched = attData.map(record => {
                const report = repData.find(r =>
                    r.student_id === record.student_id &&
                    new Date(r.report_date).toISOString().split('T')[0] === record.date
                );
                return { ...record, report };
            });

            setStudents(enriched);
        } catch (err) {
            console.error('Error fetching student history:', err);
            setStudents([]);
            setError('Failed to load your attendance history.');
        }
    };

    const markAllPresent = async () => {
        if (!window.confirm('Mark all pending students as Present?')) return;

        const loadingToast = toast.loading('Marking all as present...');
        try {
            for (const s of students) {
                if (s.attendance === 'Pending' || !s.attendance) {
                    await updateStatus(s, 'Present', true);
                }
            }
            toast.success('Batch update complete', { id: loadingToast });
            fetchRegistry();
        } catch (err) {
            toast.error('Batch update failed', { id: loadingToast });
        }
    };

    const updateStatus = async (student, status, silent = false) => {
        try {
            const record = {
                student_id: student.id,
                student_name: student.name,
                course: selectedCourse,
                date: selectedDate,
                status: status,
                topics_covered: topicsCovered,
                trainer_remarks: trainerRemarks
            };

            if (student.existingRecordId) {
                await attendanceAPI.update(student.existingRecordId, record);
            } else {
                await attendanceAPI.mark(record);
            }

            setStudents(prev => prev.map(s =>
                s.id === student.id ? { ...s, attendance: status } : s
            ));

            if (!silent) toast.success(`${student.name} marked as ${status}`);
        } catch (err) {
            console.error('Error marking attendance:', err);
            if (!silent) toast.error('Failed to mark attendance');
            throw err;
        }
    };

    const handleSaveLogs = async () => {
        if (!selectedCourse) {
            setError('Please select a course before saving.');
            return;
        }

        if (!topicsCovered) {
            setError('Please describe topics covered before saving the ledger.');
            return;
        }

        try {
            setSaving(true);
            setError('');
            setSuccessMsg('');

            const loadingToast = toast.loading('Synchronising Daily Academic Logs...');

            for (const s of students) {
                const report = {
                    student_id: s.id,
                    student_name: s.name,
                    course: selectedCourse,
                    report_date: selectedDate,
                    topics_covered: topicsCovered,
                    trainer_remarks: trainerRemarks
                };
                await studentDailyReportsAPI.create(report);
            }

            toast.success('Daily Ledger Updated Successfully', { id: loadingToast });
            setSuccessMsg('Academic Journal and Participation Logs synchronised.');
            await fetchRegistry();
        } catch (err) {
            console.error('Error saving reports:', err);
            setError(`Failed to sync ledger. Please try again.`);
            toast.error('Sync failed');
        } finally {
            setSaving(false);
        }
    };

    const formatLogTime = (record) => {
        const t = record.created_at || record.updated_at;
        if (!t) return '—';
        try {
            return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return '—';
        }
    };

    if (loading) return (
        <div className="p-8 text-center font-black uppercase tracking-widest text-maroon">
            Accessing Registry...
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-maroon/[0.02] rounded-full translate-x-1/2 -translate-y-1/2 blur-2xl"></div>
                <div>
                    <h1 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">
                        {isStudent ? 'Attendance Profile' : 'Participation Ledger'}
                    </h1>
                    <p className="text-sm text-gray-400 font-medium">
                        {isStudent ? 'Your Daily Participation Log' : 'Academic Audit • Daily Registry Protocol'}
                    </p>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-[1.5rem] text-xs font-bold animate-in slide-in-from-top-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}
            {successMsg && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-6 py-4 rounded-[1.5rem] text-xs font-bold animate-in slide-in-from-top-2">
                    {successMsg}
                </div>
            )}

            {!isStudent && (
                <>
                    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <Users className="w-3 h-3" /> Select Unit / Course
                                </label>
                                <select
                                    value={selectedCourse}
                                    onChange={(e) => setSelectedCourse(e.target.value)}
                                    className="w-full px-5 py-3.5 bg-gray-50 border-transparent rounded-xl text-xs font-bold text-gray-700 focus:bg-white focus:border-maroon/20 outline-none cursor-pointer"
                                >
                                    <option value="">Choose Module...</option>
                                    {courses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <Calendar className="w-3 h-3" /> Specific Date
                                </label>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="w-full px-5 py-3.5 bg-gray-50 border-transparent rounded-xl text-xs font-bold text-gray-700 focus:bg-white focus:border-maroon/20 outline-none"
                                />
                            </div>
                            <div className="flex items-end">
                                <button
                                    onClick={markAllPresent}
                                    disabled={students.length === 0}
                                    className="w-full h-[47px] bg-green-50 text-green-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-green-600 hover:text-white transition-all flex items-center justify-center gap-2 border border-green-100 disabled:opacity-50"
                                >
                                    <UserPlus className="w-4 h-4" /> Mark All Present
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl space-y-6">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="w-10 h-10 bg-maroon/5 rounded-xl flex items-center justify-center text-maroon">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-sm font-black text-gray-800 uppercase tracking-tight">Academic Journal Entry</h2>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Outline delivered content and session remarks</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Topics & Delivery Coverage</label>
                                <textarea
                                    value={topicsCovered}
                                    onChange={(e) => setTopicsCovered(e.target.value)}
                                    placeholder="What was covered in this session?"
                                    className="w-full px-6 py-5 bg-gray-50/50 border border-gray-100 rounded-[1.5rem] text-xs font-bold text-gray-700 outline-none focus:bg-white focus:border-maroon/20 transition-all min-h-[120px] resize-none custom-scrollbar"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Trainer Remarks</label>
                                <textarea
                                    value={trainerRemarks}
                                    onChange={(e) => setTrainerRemarks(e.target.value)}
                                    placeholder="Observations on student engagement or specific milestones..."
                                    className="w-full px-6 py-5 bg-gray-50/50 border border-gray-100 rounded-[1.5rem] text-xs font-bold text-gray-700 outline-none focus:bg-white focus:border-maroon/20 transition-all min-h-[120px] resize-none custom-scrollbar"
                                />
                            </div>
                        </div>
                    </div>
                </>
            )}

            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                {isStudent ? (
                                    ['Date', 'Unit / Course', 'Topics Covered', 'Status', 'Sync Time'].map(header => (
                                        <th key={header} className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{header}</th>
                                    ))
                                ) : (
                                    ['Enrollment ID', 'Learner Identification', 'Participation Status', 'Registry Actions'].map(header => (
                                        <th key={header} className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{header}</th>
                                    ))
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {students.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center justify-center grayscale opacity-30">
                                            <Calendar className="w-16 h-16 mb-4 text-gray-300" />
                                            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-400">
                                                {isStudent ? 'No attendance entries found' : selectedCourse ? 'No records for this selection' : 'Select a course to load registry'}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : students.map((student, idx) => (
                                <tr key={idx} className="hover:bg-gray-50/50 transition-colors group">
                                    {isStudent ? (
                                        <>
                                            <td className="px-8 py-6 text-[11px] font-black text-gray-600 uppercase tracking-widest">{student.date}</td>
                                            <td className="px-8 py-6 text-xs font-bold text-gray-800 uppercase">{student.course}</td>
                                            <td className="px-8 py-6 max-w-xs">
                                                <p className="text-[10px] font-bold text-gray-400 line-clamp-2 italic">"{student.report?.topics_covered || '—'}"</p>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className={`px-4 py-1.5 text-[9px] font-black rounded-lg uppercase tracking-widest ${student.status === 'Present' ? 'bg-green-100 text-green-700' : student.status === 'Late' ? 'bg-yellow-100 text-yellow-700' : student.status === 'Pending' ? 'bg-gray-100 text-gray-500' : 'bg-red-50 text-red-600'}`}>
                                                    {student.status}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 text-[10px] font-bold text-gray-400 italic">
                                                {formatLogTime(student)}
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-8 py-6 text-[10px] font-black text-maroon/40 uppercase tracking-widest">{student.id}</td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-maroon/5 rounded-xl flex items-center justify-center text-maroon font-black text-xs uppercase">
                                                        {student.name.charAt(0)}
                                                    </div>
                                                    <p className="text-xs font-black text-gray-800 uppercase tracking-tight">{student.name}</p>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className={`px-4 py-1.5 text-[9px] font-black rounded-lg uppercase tracking-widest ${student.attendance === 'Present' ? 'bg-green-100 text-green-700' : student.attendance === 'Late' ? 'bg-yellow-100 text-yellow-700' : student.attendance === 'Pending' ? 'bg-gray-100 text-gray-500' : 'bg-red-50 text-red-600'}`}>
                                                    {student.attendance || 'Pending'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex gap-2">
                                                    <button
                                                        title="Mark Present"
                                                        onClick={() => updateStatus(student, 'Present')}
                                                        className="p-3 bg-gray-50 rounded-xl hover:bg-green-600 hover:text-white transition-all border border-gray-100 group-hover:border-green-200"
                                                    >
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        title="Mark Absent"
                                                        onClick={() => updateStatus(student, 'Absent')}
                                                        className="p-3 bg-gray-50 rounded-xl hover:bg-red-600 hover:text-white transition-all border border-gray-100 group-hover:border-red-200"
                                                    >
                                                        <XCircle className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex justify-center md:justify-end gap-4">
                {!isStudent && (
                    <button
                        onClick={handleSaveLogs}
                        disabled={saving || students.length === 0}
                        className="w-full md:w-auto bg-maroon text-gold px-12 py-5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.3em] hover:bg-elite-maroon shadow-2xl shadow-maroon/20 transition-all disabled:opacity-60 relative overflow-hidden group"
                    >
                        <span className="relative z-10 flex items-center justify-center gap-3">
                            {saving ? 'Synchronising...' : 'Commit Daily Academic Ledger'}
                        </span>
                    </button>
                )}
                {isStudent && (
                    <button
                        onClick={() => window.print()}
                        className="w-full md:w-auto bg-gray-800 text-white px-12 py-5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.3em] shadow-xl hover:bg-black transition-all"
                    >
                        Export Attendance Report
                    </button>
                )}
            </div>
        </div>
    );
}
