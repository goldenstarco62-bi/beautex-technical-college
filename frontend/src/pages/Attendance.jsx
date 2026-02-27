import { useEffect, useState } from 'react';
import { studentsAPI, coursesAPI, attendanceAPI, studentDailyReportsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Calendar, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

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
        // FIX: Guard — do not fetch if no course is selected
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

            // FIX: Case-insensitive course name matching.
            const selectedCourseLower = selectedCourse.toLowerCase().trim();
            let filtered = allStudents.filter(s => {
                const studentCourses = Array.isArray(s.course)
                    ? s.course
                    : [s.course].filter(Boolean);
                return studentCourses.some(c => c && c.toLowerCase().trim() === selectedCourseLower);
            });

            // SMART FALLBACK: If no students matched the course filter but the backend
            // returned students (already scoped to this teacher by the server), there's a
            // course name casing/spelling mismatch. Show all returned students so the
            // registry isn't blank. Console warning helps diagnose the root data issue.
            if (filtered.length === 0 && allStudents.length > 0) {
                console.warn(
                    `[Attendance] Course name mismatch — selectedCourse="${selectedCourse}" ` +
                    `didn't match any student course values. Showing all ${allStudents.length} ` +
                    `teacher-scoped students. Student courses: ` +
                    JSON.stringify([...new Set(allStudents.flatMap(s => Array.isArray(s.course) ? s.course : [s.course]))])
                );
                filtered = allStudents;
            }

            const existingMap = {};
            (attendanceRes.data || []).forEach(r => { existingMap[r.student_id] = r; });

            const reportsData = reportsRes.data || [];
            setDailyReports(reportsData);

            // Pre-populate topics/remarks if we have existing reports for this class/day
            if (reportsData.length > 0) {
                setTopicsCovered(reportsData[0].topics_covered || '');
                setTrainerRemarks(reportsData[0].trainer_remarks || '');
            } else {
                setTopicsCovered('');
                setTrainerRemarks('');
            }

            setStudents(filtered.map(s => ({
                ...s,
                attendance: existingMap[s.id]?.status || 'Present',
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

            // Merge reports into attendance for display
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

    const updateStatus = (id, status) => {
        setStudents(prev => prev.map(s =>
            s.id === id ? { ...s, attendance: status } : s
        ));
    };

    const handleSave = async () => {
        // FIX: Guard against saving with no course selected
        if (!selectedCourse) {
            setError('Please select a course before saving attendance.');
            return;
        }

        try {
            setSaving(true);
            setError('');
            setSuccessMsg('');

            // 1. Save Attendance Records
            await Promise.all(students.map(s => {
                const record = {
                    student_id: s.id,
                    course: selectedCourse,
                    date: selectedDate,
                    status: s.attendance || 'Absent'
                };
                if (s.existingRecordId) {
                    return attendanceAPI.update(s.existingRecordId, record);
                } else {
                    return attendanceAPI.mark(record);
                }
            }));

            // 2. Save Daily Progress Reports (Topics Covered & Remarks)
            // We save a report for every student in the registry
            if (topicsCovered) {
                await Promise.all(students.map(s => {
                    const report = {
                        student_id: s.id,
                        student_name: s.name,
                        course: selectedCourse,
                        report_date: selectedDate,
                        topics_covered: topicsCovered,
                        trainer_remarks: trainerRemarks
                    };
                    return studentDailyReportsAPI.create(report);
                }));
            }

            setSuccessMsg('Attendance Registry and Daily Academic Log saved successfully!');
            // Refresh to get updated record IDs and reports
            await fetchRegistry();
        } catch (err) {
            console.error('Error saving attendance/reports:', err);
            setError('Failed to save registry data. Please try again.');
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-maroon tracking-tight uppercase">
                        {isStudent ? 'Attendance Profile' : 'Attendance Registry'}
                    </h1>
                    <p className="text-xs text-maroon/40 font-bold tracking-widest mt-1">
                        {isStudent ? 'Your Daily Participation Log' : 'Daily Registry Management'}
                    </p>
                </div>
            </div>

            {/* Error / success feedback */}
            {error && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}
            {successMsg && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-xs font-bold">
                    {successMsg}
                </div>
            )}

            {!isStudent && (
                <>
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
                        <button
                            onClick={fetchRegistry}
                            className="bg-maroon text-gold px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg hover:bg-elite-maroon transition-all"
                        >
                            Load Registry
                        </button>
                    </div>

                    {/* Daily Academic Record Section */}
                    <div className="bg-white p-8 rounded-[2rem] border border-maroon/5 shadow-xl space-y-6">
                        <div className="flex items-center gap-3 border-b border-maroon/5 pb-4">
                            <div className="w-8 h-8 bg-maroon text-gold rounded-xl flex items-center justify-center shadow-lg transform -rotate-12">
                                <CheckCircle2 className="w-4 h-4" />
                            </div>
                            <div>
                                <h2 className="text-sm font-black text-maroon uppercase tracking-widest">Daily Academic Log</h2>
                                <p className="text-[8px] text-maroon/40 font-bold uppercase tracking-[0.2em]">Record of work and trainer remarks for today's session</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-2">Topics Covered Today</label>
                                <textarea
                                    value={topicsCovered}
                                    onChange={(e) => setTopicsCovered(e.target.value)}
                                    placeholder="Outline the modules or topics discussed in this session..."
                                    className="w-full px-6 py-5 bg-parchment-100/50 border-none rounded-2xl text-xs font-bold text-maroon outline-none focus:ring-2 focus:ring-maroon/5 transition-all min-h-[120px] resize-none"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-2">Session Remarks</label>
                                <textarea
                                    value={trainerRemarks}
                                    onChange={(e) => setTrainerRemarks(e.target.value)}
                                    placeholder="Add overall class performance remarks or specific student milestone notes..."
                                    className="w-full px-6 py-5 bg-parchment-100/50 border-none rounded-2xl text-xs font-bold text-maroon outline-none focus:ring-2 focus:ring-maroon/5 transition-all min-h-[120px] resize-none"
                                />
                            </div>
                        </div>
                    </div>
                </>
            )}

            <div className="table-container custom-scrollbar overflow-x-auto">
                <table className="w-full min-w-[580px]">
                    <thead>
                        <tr className="bg-maroon/5">
                            {isStudent ? (
                                ['Date', 'Subject/Course', 'Topics Covered', 'Status', 'Recorded At'].map(header => (
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
                        {students.length === 0 ? (
                            // FIX: Added empty state message instead of blank table
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-xs font-bold text-maroon/30 uppercase tracking-widest">
                                    {isStudent
                                        ? 'No attendance records found for your account.'
                                        : selectedCourse
                                            ? 'No students enrolled in this course, or no records for this date.'
                                            : 'Select a course and date to load the registry.'}
                                </td>
                            </tr>
                        ) : students.map((student, idx) => (
                            <tr key={idx} className="hover:bg-parchment-100/50 transition-colors group">
                                {isStudent ? (
                                    <>
                                        <td className="px-6 py-5 text-[10px] font-black text-maroon uppercase tracking-widest">{student.date}</td>
                                        <td className="px-6 py-5 text-sm font-bold text-maroon">{student.course}</td>
                                        <td className="px-6 py-5 max-w-xs">
                                            <p className="text-[11px] font-bold text-maroon/60 line-clamp-2">{student.report?.topics_covered || '—'}</p>
                                            {student.report?.trainer_remarks && (
                                                <p className="text-[9px] font-bold text-maroon/30 italic mt-1 truncate">"{student.report.trainer_remarks}"</p>
                                            )}
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className={`px-4 py-1.5 text-[9px] font-black rounded-lg uppercase tracking-widest ${student.status === 'Present' ? 'bg-green-100 text-green-700' : student.status === 'Late' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-50 text-red-600'}`}>
                                                {student.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-[10px] font-bold text-maroon/30 italic">
                                            {formatLogTime(student)}
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="px-6 py-5 text-[10px] font-black text-maroon">{student.id}</td>
                                        <td className="px-6 py-5 font-bold text-maroon">{student.name}</td>
                                        <td className="px-6 py-5">
                                            <span className={`px-4 py-1.5 text-[9px] font-black rounded-lg uppercase tracking-widest ${student.attendance === 'Present' ? 'bg-green-100 text-green-700' : student.attendance === 'Late' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-50 text-red-600'}`}>
                                                {student.attendance || 'Pending'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 flex gap-2">
                                            <button title="Mark Present" onClick={() => updateStatus(student.id, 'Present')} className="p-2 bg-parchment-100 rounded-lg hover:bg-green-600 hover:text-white transition-all"><CheckCircle2 className="w-5 h-5" /></button>
                                            <button title="Mark Absent" onClick={() => updateStatus(student.id, 'Absent')} className="p-2 bg-parchment-100 rounded-lg hover:bg-red-600 hover:text-white transition-all"><XCircle className="w-5 h-5" /></button>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-center md:justify-end md:pr-8">
                <button
                    onClick={isStudent ? () => window.print() : handleSave}
                    disabled={saving}
                    className="w-full md:w-auto bg-maroon text-gold px-12 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-elite-maroon shadow-2xl transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {saving ? 'Saving...' : isStudent ? 'Download Attendance Report' : 'Save Daily Registry Portfolio'}
                </button>
            </div>
        </div>
    );
}
