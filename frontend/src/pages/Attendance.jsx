import { useEffect, useState, useMemo } from 'react';
import { studentsAPI, coursesAPI, attendanceAPI, studentDailyReportsAPI, facultyAPI, activityReportsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Calendar, CheckCircle2, XCircle, AlertTriangle, UserPlus, Users, BookOpen, Fingerprint, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import moment from 'moment';
import { calculateRemainingTime } from '../utils/dateUtils';
export default function Attendance() {
    const { user } = useAuth();
    const isStudent = (user?.role ? String(user.role).toLowerCase() : '') === 'student';
    const isTeacher = (user?.role ? String(user.role).toLowerCase() : '') === 'teacher';
    const isAdmin = ['admin', 'superadmin'].includes(user?.role ? String(user.role).toLowerCase() : '');

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
    const [generatedReports, setGeneratedReports] = useState([]);

    // Pagination
    const PAGE_SIZE = 10;
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            setError('');
            if (isAdmin) fetchGeneratedReports();

            if (isTeacher) {
                // Fetch both courses and faculty in parallel for teachers
                const [coursesRes, facultyRes] = await Promise.all([
                    coursesAPI.getAll(),
                    facultyAPI.getAll()
                ]);

                const allCourses = coursesRes.data || [];
                const userEmail = String(user?.email || '').toLowerCase().trim();

                // Find this teacher's faculty profile
                const teacherProfile = facultyRes.data?.find(f =>
                    String(f.email || '').toLowerCase().trim() === userEmail
                );

                if (teacherProfile) {
                    // Parse assigned course names from the faculty profile
                    let assignedCourseNames = [];
                    try {
                        if (typeof teacherProfile.courses === 'string') {
                            if (teacherProfile.courses.startsWith('[')) {
                                assignedCourseNames = JSON.parse(teacherProfile.courses);
                            } else {
                                assignedCourseNames = teacherProfile.courses.split(',').map(s => s.trim()).filter(Boolean);
                            }
                        } else if (Array.isArray(teacherProfile.courses)) {
                            assignedCourseNames = teacherProfile.courses;
                        }
                    } catch (e) {
                        console.error('Error parsing teacher courses:', e);
                    }

                    const teacherName = teacherProfile.name || '';

                    // Filter courses: where instructor matches OR course name is in assigned list
                    const myCourses = allCourses.filter(c => {
                        const isInstructor = c.instructor &&
                            c.instructor.toLowerCase().trim() === teacherName.toLowerCase().trim();
                        const isAssigned = assignedCourseNames.some(
                            an => an.toLowerCase().trim() === (c.name || '').toLowerCase().trim()
                        );
                        return isInstructor || isAssigned;
                    });

                    setCourses(myCourses);
                    if (myCourses.length > 0) setSelectedCourse(myCourses[0].name);
                } else {
                    // No faculty profile found - show all courses as fallback
                    setCourses(allCourses);
                    if (allCourses.length > 0) setSelectedCourse(allCourses[0].name);
                    toast.error('No faculty profile linked to your account. Contact admin.');
                }
            } else {
                // Admin/superadmin: show all courses
                const { data } = await coursesAPI.getAll();
                setCourses(data);
                if (data.length > 0) setSelectedCourse(data[0].name);
            }
        } catch (err) {
            console.error('Error fetching courses:', err);
            setError('Failed to load courses. Please refresh the page.');
        } finally {
            setLoading(false);
        }
    };

    const fetchGeneratedReports = async () => {
        try {
            const res = await activityReportsAPI.listAttendanceReports();
            setGeneratedReports(res.data || []);
        } catch (err) {
            console.error('Error fetching generated reports:', err);
        }
    };

    useEffect(() => {
        if (!isStudent && selectedCourse) {
            fetchRegistry();
        } else if (isStudent) {
            fetchStudentHistory();
        }
        setCurrentPage(1); // reset pagination on course/date change
    }, [selectedCourse, selectedDate, user]);

    // Helper to parse student course field into array
    const parseStudentCourses = (courseField) => {
        if (!courseField) return [];
        if (Array.isArray(courseField)) return courseField.map(c => String(c).trim()).filter(Boolean);
        const s = String(courseField).trim();
        // JSON array
        if (s.startsWith('[')) {
            try { return JSON.parse(s).map(c => String(c).trim()).filter(Boolean); } catch (e) {}
        }
        // Postgres-style {val1,val2}
        if (s.startsWith('{') && s.endsWith('}')) {
            return s.slice(1, -1).split(',').map(c => c.replace(/"/g, '').trim()).filter(Boolean);
        }
        // Comma-separated plain string
        return s.split(',').map(c => c.trim()).filter(Boolean);
    };

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

            // Improved: parse all course field formats properly
            let filtered = allStudents.filter(s => {
                const studentCourses = parseStudentCourses(s.course);
                const hasCourse = studentCourses.some(c => c.toLowerCase().trim() === selectedCourseLower);
                const isFinished = s.status === 'Graduated' || (s.completion_date && calculateRemainingTime(s.completion_date).isExpired);
                return hasCourse && !isFinished;
            });

            // Sort students alphabetically by name for consistent ordering
            filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

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

    // Attendance progress stats
    const attendanceStats = useMemo(() => {
        const marked = students.filter(s => s.attendance && s.attendance !== 'Pending').length;
        const present = students.filter(s => s.attendance === 'Present').length;
        const absent = students.filter(s => s.attendance === 'Absent').length;
        const late = students.filter(s => s.attendance === 'Late').length;
        const pending = students.filter(s => !s.attendance || s.attendance === 'Pending').length;
        return { marked, present, absent, late, pending, total: students.length };
    }, [students]);

    // Pagination derived values
    const totalPages = Math.max(1, Math.ceil(students.length / PAGE_SIZE));
    const paginatedStudents = students.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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

    const markAllAbsent = async () => {
        if (!window.confirm('Mark all PENDING students as Absent?')) return;
        const loadingToast = toast.loading('Marking pending as absent...');
        try {
            for (const s of students) {
                if (!s.attendance || s.attendance === 'Pending') {
                    await updateStatus(s, 'Absent', true);
                }
            }
            toast.success('Batch absent update complete', { id: loadingToast });
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
            const errMsg = err.response?.data?.error || 'Failed to mark attendance';
            if (!silent) toast.error(errMsg);
            throw err;
        }
    };

    const handleSaveLogs = async () => {
        if (!selectedCourse) {
            setError('Please select a course before saving.');
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

    const handleGenerateAttendancePDFs = async () => {
        setLoading(true);
        try {
            const res = await activityReportsAPI.generateDailyAttendanceReport(selectedDate);
            if (res.data.success) {
                toast.success(res.data.message, { duration: 5000 });
                fetchGeneratedReports();
            } else {
                toast.error('Generation completed with no results.');
            }
        } catch (error) {
            console.error('Error generating attendance PDFs:', error);
            toast.error(error.response?.data?.error || 'Automation sequence failed');
        } finally {
            setLoading(false);
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
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    { isAdmin && (
                        <button
                            onClick={handleGenerateAttendancePDFs}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-gold/10 text-gold border border-gold/20 rounded-xl hover:bg-gold/20 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                            title="Automate Daily Attendance Reports for all Departments"
                        >
                            <Fingerprint className={`w-4 h-4 ${loading ? 'animate-pulse' : ''}`} />
                            <span className="hidden sm:inline">Automate Reports</span>
                        </button>
                    )}
                    {isTeacher && courses.length === 0 && (
                        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-700 px-5 py-3 rounded-2xl text-xs font-bold">
                            <BookOpen className="w-4 h-4 shrink-0" />
                            No courses are assigned to your account yet. Contact an administrator.
                        </div>
                    )}
                    {isTeacher && courses.length > 0 && (
                        <div className="flex items-center gap-2 bg-maroon/5 border border-maroon/10 text-maroon px-5 py-3 rounded-2xl text-xs font-bold">
                            <BookOpen className="w-4 h-4" />
                            Showing {courses.length} assigned course{courses.length !== 1 ? 's' : ''}
                        </div>
                    )}
                </div>
            </div>
            
            {/* Recent Automated Reports Section */}
            {isAdmin && generatedReports.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    {generatedReports.slice(0, 4).map((report, idx) => (
                        <div 
                            key={idx}
                            onClick={() => activityReportsAPI.downloadAttendanceReport(report.name)}
                            className="group bg-white p-4 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gold/30 transition-all cursor-pointer relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-16 h-16 bg-gold/5 rounded-full translate-x-1/2 -translate-y-1/2 group-hover:scale-150 transition-transform duration-500"></div>
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-gold/10 rounded-2xl flex items-center justify-center text-gold group-hover:bg-gold group-hover:text-white transition-colors">
                                    <CheckCircle2 className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-[10px] font-black text-gray-800 uppercase tracking-widest truncate">
                                        {report.name.split('_')[2]} Report
                                    </h3>
                                    <p className="text-[9px] text-gray-400 font-bold uppercase mt-1">
                                        {moment(report.createdAt).fromNow()} • {(report.size / 1024).toFixed(1)} KB
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

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
                                    disabled={isTeacher && courses.length === 0}
                                >
                                    {courses.length === 0
                                        ? <option value="">No courses assigned</option>
                                        : <>
                                            <option value="">Choose Module...</option>
                                            {courses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                        </>
                                    }
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
                            <div className="flex items-end gap-2">
                                <button
                                    onClick={markAllPresent}
                                    disabled={students.length === 0}
                                    className="flex-1 h-[47px] bg-green-50 text-green-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-green-600 hover:text-white transition-all flex items-center justify-center gap-2 border border-green-100 disabled:opacity-50"
                                >
                                    <UserPlus className="w-4 h-4" /> All Present
                                </button>
                                <button
                                    onClick={markAllAbsent}
                                    disabled={students.length === 0}
                                    className="flex-1 h-[47px] bg-red-50 text-red-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2 border border-red-100 disabled:opacity-50"
                                >
                                    <XCircle className="w-4 h-4" /> All Absent
                                </button>
                            </div>
                        </div>

                        {/* Attendance Progress Bar */}
                        {students.length > 0 && (
                            <div className="mt-6 pt-6 border-t border-gray-50">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                        Attendance Progress — {attendanceStats.marked}/{attendanceStats.total} Marked
                                    </span>
                                    <div className="flex items-center gap-3 text-[9px] font-black">
                                        <span className="text-emerald-600">✓ {attendanceStats.present} Present</span>
                                        <span className="text-amber-500">⏱ {attendanceStats.late} Late</span>
                                        <span className="text-rose-500">✗ {attendanceStats.absent} Absent</span>
                                        {attendanceStats.pending > 0 && <span className="text-gray-400">⋯ {attendanceStats.pending} Pending</span>}
                                    </div>
                                </div>
                                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden flex">
                                    <div
                                        className="h-full bg-emerald-500 transition-all duration-500"
                                        style={{ width: `${attendanceStats.total > 0 ? (attendanceStats.present / attendanceStats.total) * 100 : 0}%` }}
                                    />
                                    <div
                                        className="h-full bg-amber-400 transition-all duration-500"
                                        style={{ width: `${attendanceStats.total > 0 ? (attendanceStats.late / attendanceStats.total) * 100 : 0}%` }}
                                    />
                                    <div
                                        className="h-full bg-rose-400 transition-all duration-500"
                                        style={{ width: `${attendanceStats.total > 0 ? (attendanceStats.absent / attendanceStats.total) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>
                        )}
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
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Topics & Delivery Coverage (Optional)</label>
                                <textarea
                                    value={topicsCovered}
                                    onChange={(e) => setTopicsCovered(e.target.value)}
                                    placeholder="What was covered in this session?"
                                    className="w-full px-6 py-5 bg-gray-50/50 border border-gray-100 rounded-[1.5rem] text-xs font-bold text-gray-700 outline-none focus:bg-white focus:border-maroon/20 transition-all min-h-[120px] resize-none custom-scrollbar"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Trainer Remarks (Optional)</label>
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
                                    ['#', 'Enrollment ID', 'Learner Identification', 'Participation Status', 'Registry Actions'].map(header => (
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
                            ) : paginatedStudents.map((student, idx) => (
                                <tr key={student.id || idx} className="hover:bg-gray-50/50 transition-colors group">
                                    {isStudent ? (
                                        <>
                                            <td className="px-8 py-6 text-[11px] font-black text-gray-600 uppercase tracking-widest">{student.date}</td>
                                            <td className="px-8 py-6 text-xs font-bold text-gray-800 uppercase">{student.course}</td>
                                            <td className="px-8 py-6 max-w-xs">
                                                <div 
                                                    className="text-[10px] font-bold text-gray-400 line-clamp-2 italic prose prose-sm"
                                                    dangerouslySetInnerHTML={{ __html: student.report?.topics_covered || '—' }}
                                                />
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
                                            <td className="px-8 py-6 text-[10px] font-black text-gray-300">{(currentPage - 1) * PAGE_SIZE + idx + 1}</td>
                                            <td className="px-8 py-6 text-[10px] font-black text-maroon/40 uppercase tracking-widest">{student.id}</td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-maroon/5 rounded-xl flex items-center justify-center text-maroon font-black text-xs uppercase">
                                                        {(student.name || '?').charAt(0)}
                                                    </div>
                                                    <p className="text-xs font-black text-gray-800 uppercase tracking-tight">{student.name}</p>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className={`px-4 py-1.5 text-[9px] font-black rounded-lg uppercase tracking-widest ${
                                                    student.attendance === 'Present' ? 'bg-green-100 text-green-700'
                                                    : student.attendance === 'Late' ? 'bg-amber-100 text-amber-700'
                                                    : student.attendance === 'Absent' ? 'bg-red-50 text-red-600'
                                                    : 'bg-gray-100 text-gray-400'
                                                }`}>
                                                    {student.attendance || 'Pending'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex gap-2">
                                                    <button
                                                        title="Mark Present"
                                                        onClick={() => updateStatus(student, 'Present')}
                                                        className={`p-2.5 rounded-xl transition-all border text-[9px] font-black flex items-center gap-1 ${
                                                            student.attendance === 'Present'
                                                                ? 'bg-green-600 text-white border-green-600'
                                                                : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-green-600 hover:text-white hover:border-green-600'
                                                        }`}
                                                    >
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                        <span className="hidden sm:inline">Present</span>
                                                    </button>
                                                    <button
                                                        title="Mark Late"
                                                        onClick={() => updateStatus(student, 'Late')}
                                                        className={`p-2.5 rounded-xl transition-all border text-[9px] font-black flex items-center gap-1 ${
                                                            student.attendance === 'Late'
                                                                ? 'bg-amber-500 text-white border-amber-500'
                                                                : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-amber-500 hover:text-white hover:border-amber-500'
                                                        }`}
                                                    >
                                                        <Clock className="w-3.5 h-3.5" />
                                                        <span className="hidden sm:inline">Late</span>
                                                    </button>
                                                    <button
                                                        title="Mark Absent"
                                                        onClick={() => updateStatus(student, 'Absent')}
                                                        className={`p-2.5 rounded-xl transition-all border text-[9px] font-black flex items-center gap-1 ${
                                                            student.attendance === 'Absent'
                                                                ? 'bg-red-600 text-white border-red-600'
                                                                : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-red-600 hover:text-white hover:border-red-600'
                                                        }`}
                                                    >
                                                        <XCircle className="w-3.5 h-3.5" />
                                                        <span className="hidden sm:inline">Absent</span>
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

            {/* Pagination Controls — visible only for teacher/admin student list */}
            {!isStudent && students.length > PAGE_SIZE && (
                <div className="flex items-center justify-between bg-white px-8 py-4 rounded-[2rem] border border-gray-100 shadow-sm">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, students.length)} of {students.length} learners
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gray-50 border border-gray-100 text-gray-500 hover:bg-maroon hover:text-white hover:border-maroon transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            ← Prev
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={`w-9 h-9 rounded-xl text-[10px] font-black uppercase transition-all border ${
                                    page === currentPage
                                        ? 'bg-maroon text-white border-maroon shadow-lg shadow-maroon/20'
                                        : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-maroon/10 hover:border-maroon/20 hover:text-maroon'
                                }`}
                            >
                                {page}
                            </button>
                        ))}
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gray-50 border border-gray-100 text-gray-500 hover:bg-maroon hover:text-white hover:border-maroon transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            Next →
                        </button>
                    </div>
                </div>
            )}

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
