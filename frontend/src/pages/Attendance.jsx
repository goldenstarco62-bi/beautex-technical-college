import { useEffect, useState, useMemo } from 'react';
import sanitizeHtml from '../utils/sanitizeHtml';
import { studentsAPI, coursesAPI, attendanceAPI, studentDailyReportsAPI, facultyAPI, activityReportsAPI, academicAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Calendar, CalendarRange, CheckCircle2, XCircle, AlertTriangle, UserPlus, Users, BookOpen, Fingerprint, Clock, RefreshCw, Thermometer, ShieldCheck, BellRing, Send } from 'lucide-react';
import { toast } from 'react-hot-toast';
import dayjs from '../utils/date';
import { calculateRemainingTime } from '../utils/dateUtils';

const STATUS_META = {
    Present: { icon: CheckCircle2, active: 'bg-green-600 text-white border-green-600', idle: 'hover:bg-green-600 hover:text-white hover:border-green-600', badge: 'bg-green-100 text-green-700' },
    Late: { icon: Clock, active: 'bg-amber-500 text-white border-amber-500', idle: 'hover:bg-amber-500 hover:text-white hover:border-amber-500', badge: 'bg-amber-100 text-amber-700' },
    Absent: { icon: XCircle, active: 'bg-red-600 text-white border-red-600', idle: 'hover:bg-red-600 hover:text-white hover:border-red-600', badge: 'bg-red-50 text-red-600' },
    Sick: { icon: Thermometer, active: 'bg-sky-600 text-white border-sky-600', idle: 'hover:bg-sky-600 hover:text-white hover:border-sky-600', badge: 'bg-sky-100 text-sky-700' },
    Excused: { icon: ShieldCheck, active: 'bg-violet-600 text-white border-violet-600', idle: 'hover:bg-violet-600 hover:text-white hover:border-violet-600', badge: 'bg-violet-100 text-violet-700' },
};

const statusBadgeClass = (status) => STATUS_META[status]?.badge || (status === 'Pending' ? 'bg-gray-100 text-gray-500' : 'bg-gray-100 text-gray-500');

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

    // Configuration-driven register + term analytics
    const [statuses, setStatuses] = useState(['Present', 'Absent', 'Late', 'Sick', 'Excused']);
    const [threshold, setThreshold] = useState(90);
    const [periods, setPeriods] = useState([]);
    const [selectedPeriod, setSelectedPeriod] = useState('');
    const [ratesById, setRatesById] = useState({});
    const [alerts, setAlerts] = useState({ threshold: 90, alerts: [] });
    const [alertsLoading, setAlertsLoading] = useState(false);
    const [notifyLoading, setNotifyLoading] = useState(false);

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

            const [configRes, periodsRes] = await Promise.all([
                attendanceAPI.getConfig().catch(() => ({ data: null })),
                academicAPI.getPeriods().catch(() => ({ data: [] })),
            ]);
            const config = configRes.data;
            if (Array.isArray(config?.statuses) && config.statuses.length) setStatuses(config.statuses);
            if (Number.isFinite(Number(config?.threshold))) setThreshold(Number(config.threshold));

            const periodList = Array.isArray(periodsRes.data) ? periodsRes.data : [];
            setPeriods(periodList);
            const activePeriod = config?.active_period || periodList.find(p => p.is_active);
            if (activePeriod) setSelectedPeriod(String(activePeriod.id));

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
    }, [selectedCourse, selectedDate, selectedPeriod, user]);

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
            setRatesById({});
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

            await loadInsights();
        } catch (err) {
            console.error('Error fetching registry:', err);
            setError('Failed to load attendance registry.');
        }
    };

    const loadInsights = async () => {
        if (!selectedCourse) {
            setRatesById({});
            setAlerts({ threshold, alerts: [] });
            return;
        }
        setAlertsLoading(true);
        try {
            const params = { course: selectedCourse, academic_period_id: selectedPeriod || undefined };
            const [summaryRes, alertsRes] = await Promise.all([
                attendanceAPI.getSummary(params).catch(() => ({ data: [] })),
                attendanceAPI.getAlerts(params).catch(() => ({ data: null })),
            ]);

            const map = {};
            for (const row of (summaryRes.data || [])) {
                const sid = String(row.student_id || '').trim();
                if (!sid) continue;
                const overall = row.overall || {};
                const rate = { rate: Number(overall.rate) || 0, total: Number(overall.total) || 0 };
                const exactCourse = String(row.course || '').toLowerCase() === selectedCourse.toLowerCase();
                if (!map[sid] || exactCourse) map[sid] = rate;
            }
            setRatesById(map);

            const data = alertsRes.data;
            setAlerts(data && Array.isArray(data.alerts) ? data : { threshold, alerts: [] });
        } finally {
            setAlertsLoading(false);
        }
    };

    const handleNotifyAlerts = async () => {
        if (!alerts.alerts?.length) return;
        if (!window.confirm(`Send an attendance warning to ${alerts.alerts.length} at-risk learner(s)?`)) return;
        setNotifyLoading(true);
        const loadingToast = toast.loading('Sending attendance alerts...');
        try {
            const res = await attendanceAPI.notifyAlerts({
                course: selectedCourse,
                academic_period_id: selectedPeriod || undefined,
                student_ids: alerts.alerts.map(a => a.student_id),
            });
            toast.success(`${res.data?.notified ?? 0} learner(s) notified`, { id: loadingToast });
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to send attendance alerts', { id: loadingToast });
        } finally {
            setNotifyLoading(false);
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

    // Attendance progress stats for the day's register
    const attendanceStats = useMemo(() => {
        const counts = {};
        statuses.forEach(status => { counts[status] = 0; });
        let pending = 0;
        for (const s of students) {
            if (Object.prototype.hasOwnProperty.call(counts, s.attendance)) counts[s.attendance] += 1;
            else pending += 1;
        }
        const marked = students.length - pending;
        return {
            ...counts,
            marked,
            pending,
            total: students.length,
            present: counts.Present || 0,
            absent: counts.Absent || 0,
            late: counts.Late || 0,
            sick: counts.Sick || 0,
            excused: counts.Excused || 0,
        };
    }, [students, statuses]);

    // Student view: overall rate from the records fetched for this learner
    const studentRate = useMemo(() => {
        if (!isStudent || students.length === 0) return null;
        const attended = students.filter(r => ['Present', 'Late', 'Excused'].includes(r.status)).length;
        const total = students.length;
        return { total, attended, percentage: Math.round((attended / total) * 1000) / 10 };
    }, [isStudent, students]);

    // Pagination derived values
    const totalPages = Math.max(1, Math.ceil(students.length / PAGE_SIZE));
    const paginatedStudents = students.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const markAll = async (status) => {
        const targets = students.filter(s => !s.attendance || s.attendance === 'Pending');
        if (targets.length === 0) {
            toast('Every learner is already marked for this date.', { icon: 'ℹ️' });
            return;
        }
        if (!window.confirm(`Mark ${targets.length} pending learner(s) as ${status}?`)) return;

        const loadingToast = toast.loading(`Saving ${targets.length} ${status} records...`);
        try {
            const res = await attendanceAPI.markBatch({
                course: selectedCourse,
                date: selectedDate,
                entries: targets.map(s => ({ student_id: s.id, status })),
            });
            const saved = res.data?.saved ?? targets.length;
            const skipped = res.data?.skipped?.length || 0;
            toast.success(
                skipped ? `${saved} saved · ${skipped} skipped` : `${saved} learner(s) marked ${status}`,
                { id: loadingToast }
            );
            await fetchRegistry();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Batch update failed', { id: loadingToast });
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
                s.id === student.id
                    ? {
                        ...s,
                        attendance: status,
                        existingRecordId: student.existingRecordId || s.existingRecordId,
                    }
                    : s
            ));

            loadInsights();
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
        <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 sm:gap-6 bg-white p-4 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-maroon/[0.02] rounded-full translate-x-1/2 -translate-y-1/2 blur-2xl"></div>
                <div>
                    <h1 className="text-xl sm:text-3xl font-black text-gray-800 uppercase tracking-tighter">
                        {isStudent ? 'Attendance Profile' : 'Participation Ledger'}
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-400 font-medium">
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
                                        {dayjs(report.createdAt).fromNow()} • {(report.size / 1024).toFixed(1)} KB
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
                    <div className="bg-white p-4 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-gray-100 shadow-xl">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 sm:gap-6">
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <Users className="w-3 h-3" /> Select Unit / Course
                                </label>
                                <select
                                    value={selectedCourse}
                                    onChange={(e) => setSelectedCourse(e.target.value)}
                                    className="w-full px-4 py-3 sm:px-5 sm:py-3.5 bg-gray-50 border-transparent rounded-xl text-xs font-bold text-gray-700 focus:bg-white focus:border-maroon/20 outline-none cursor-pointer"
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
                                    className="w-full px-4 py-3 sm:px-5 sm:py-3.5 bg-gray-50 border-transparent rounded-xl text-xs font-bold text-gray-700 focus:bg-white focus:border-maroon/20 outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <CalendarRange className="w-3 h-3" /> Reporting Term
                                </label>
                                <select
                                    value={selectedPeriod}
                                    onChange={(e) => setSelectedPeriod(e.target.value)}
                                    className="w-full px-4 py-3 sm:px-5 sm:py-3.5 bg-gray-50 border-transparent rounded-xl text-xs font-bold text-gray-700 focus:bg-white focus:border-maroon/20 outline-none cursor-pointer"
                                >
                                    <option value="">All-time</option>
                                    {periods.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}{p.is_active ? ' • Active' : ''}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-end gap-2 md:col-span-2 xl:col-span-1">
                                <button
                                    onClick={() => markAll('Present')}
                                    disabled={students.length === 0}
                                    className="flex-1 h-[42px] sm:h-[47px] bg-green-50 text-green-600 rounded-xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest hover:bg-green-600 hover:text-white transition-all flex items-center justify-center gap-1.5 sm:gap-2 border border-green-100 disabled:opacity-50"
                                >
                                    <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> All Present
                                </button>
                                <button
                                    onClick={() => markAll('Absent')}
                                    disabled={students.length === 0}
                                    className="flex-1 h-[42px] sm:h-[47px] bg-red-50 text-red-500 rounded-xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-1.5 sm:gap-2 border border-red-100 disabled:opacity-50"
                                >
                                    <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> All Absent
                                </button>
                            </div>
                        </div>

                        {/* Attendance Progress Bar */}
                        {students.length > 0 && (
                            <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-50">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0 mb-2">
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                        Attendance Progress — {attendanceStats.marked}/{attendanceStats.total} Marked · Eligibility {threshold}%
                                    </span>
                                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[9px] font-black">
                                        <span className="text-emerald-600">✓ {attendanceStats.present} Present</span>
                                        <span className="text-amber-500">⏱ {attendanceStats.late} Late</span>
                                        <span className="text-violet-600">◎ {attendanceStats.excused} Excused</span>
                                        <span className="text-sky-600">✚ {attendanceStats.sick} Sick</span>
                                        <span className="text-rose-500">✗ {attendanceStats.absent} Absent</span>
                                        {attendanceStats.pending > 0 && <span className="text-gray-400">⋯ {attendanceStats.pending} Pending</span>}
                                    </div>
                                </div>
                                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden flex">
                                    {[
                                        { key: 'present', color: 'bg-emerald-500' },
                                        { key: 'late', color: 'bg-amber-400' },
                                        { key: 'excused', color: 'bg-violet-500' },
                                        { key: 'sick', color: 'bg-sky-500' },
                                        { key: 'absent', color: 'bg-rose-400' },
                                    ].map(seg => (
                                        <div
                                            key={seg.key}
                                            className={`h-full ${seg.color} transition-all duration-500`}
                                            style={{ width: `${attendanceStats.total > 0 ? ((attendanceStats[seg.key] || 0) / attendanceStats.total) * 100 : 0}%` }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] border border-amber-100 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3 sm:gap-4">
                                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 shrink-0">
                                    <BellRing className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-xs sm:text-sm font-black text-gray-800 uppercase tracking-tight">Attendance Alerts</h2>
                                    <p className="text-[9px] sm:text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                        {alerts.alerts.length} learner{alerts.alerts.length === 1 ? '' : 's'} below {alerts.threshold ?? threshold}% eligibility
                                        {alerts.period ? ` · ${alerts.period.name}` : ''}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleNotifyAlerts}
                                disabled={notifyLoading || alertsLoading || alerts.alerts.length === 0}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all text-[9px] sm:text-[10px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Send className={`w-3.5 h-3.5 ${notifyLoading ? 'animate-pulse' : ''}`} />
                                {notifyLoading ? 'Sending...' : 'Notify At-Risk'}
                            </button>
                        </div>

                        {alertsLoading ? (
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-300 py-2">Calculating attendance risk...</p>
                        ) : alerts.alerts.length === 0 ? (
                            <div className="flex items-center gap-2.5 bg-green-50/60 border border-green-100 text-green-700 px-4 py-3 rounded-xl">
                                <ShieldCheck className="w-4 h-4 shrink-0" />
                                <p className="text-[10px] font-black uppercase tracking-widest">All learners meet the attendance requirement for this selection.</p>
                            </div>
                        ) : (
                            <div className="max-h-72 overflow-y-auto custom-scrollbar divide-y divide-gray-50">
                                {alerts.alerts.slice(0, 50).map(a => (
                                    <div key={`${a.student_id}-${a.course}`} className="flex items-center justify-between gap-3 py-2.5">
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-black text-gray-800 uppercase truncate">{a.student_name}</p>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest truncate">{a.student_id} · {a.course}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-[10px] font-black">{a.percentage}%</span>
                                            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                                                {a.absent} absent · {a.sick} sick · {a.late} late
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                {alerts.alerts.length > 50 && (
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest py-3 text-center">
                                        +{alerts.alerts.length - 50} more at-risk learners
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="bg-white p-4 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-gray-100 shadow-xl space-y-4 sm:space-y-6">
                        <div className="flex items-center gap-3 sm:gap-4 mb-2">
                            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-maroon/5 rounded-xl flex items-center justify-center text-maroon shrink-0">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-xs sm:text-sm font-black text-gray-800 uppercase tracking-tight">Academic Journal Entry</h2>
                                <p className="text-[9px] sm:text-[10px] text-gray-400 font-bold uppercase tracking-widest">Outline delivered content and session remarks</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
                            <div className="space-y-2 sm:space-y-3">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 sm:ml-2">Topics & Delivery Coverage (Optional)</label>
                                <textarea
                                    value={topicsCovered}
                                    onChange={(e) => setTopicsCovered(e.target.value)}
                                    placeholder="What was covered in this session?"
                                    className="w-full px-4 py-3 sm:px-6 sm:py-5 bg-gray-50/50 border border-gray-100 rounded-xl sm:rounded-[1.5rem] text-xs font-bold text-gray-700 outline-none focus:bg-white focus:border-maroon/20 transition-all min-h-[80px] sm:min-h-[120px] resize-none custom-scrollbar"
                                />
                            </div>
                            <div className="space-y-2 sm:space-y-3">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 sm:ml-2">Trainer Remarks (Optional)</label>
                                <textarea
                                    value={trainerRemarks}
                                    onChange={(e) => setTrainerRemarks(e.target.value)}
                                    placeholder="Observations on student engagement or specific milestones..."
                                    className="w-full px-4 py-3 sm:px-6 sm:py-5 bg-gray-50/50 border border-gray-100 rounded-xl sm:rounded-[1.5rem] text-xs font-bold text-gray-700 outline-none focus:bg-white focus:border-maroon/20 transition-all min-h-[80px] sm:min-h-[120px] resize-none custom-scrollbar"
                                />
                            </div>
                        </div>
                    </div>
                </>
            )}

            {isStudent && studentRate && (
                <div className="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-gray-100 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Overall attendance</p>
                            <p className="text-3xl font-black text-gray-800 tracking-tighter mt-1">{studentRate.percentage}%</p>
                            <p className="text-[10px] font-bold text-gray-400 mt-1">
                                {studentRate.attended} attended of {studentRate.total} sessions · Late & Excused count as attended
                            </p>
                        </div>
                        <span className={`self-start px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest ${studentRate.percentage >= threshold ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                            {studentRate.percentage >= threshold ? 'Meets requirement' : `Below ${threshold}% requirement`}
                        </span>
                    </div>
                    <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-500 ${studentRate.percentage >= threshold ? 'bg-emerald-500' : 'bg-rose-500'}`}
                            style={{ width: `${Math.min(100, studentRate.percentage)}%` }}
                        />
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl sm:rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                <div className="scroll-table-wrapper">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    {isStudent ? (
                                        ['Date', 'Unit / Course', 'Topics Covered', 'Status', 'Sync Time'].map(header => (
                                            <th key={header} className="px-4 py-3.5 sm:px-8 sm:py-6 text-left text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">{header}</th>
                                        ))
                                    ) : (
                                        ['#', 'Enrollment ID', 'Learner Identification', 'Term Attendance', 'Participation Status', 'Registry Actions'].map(header => (
                                            <th key={header} className="px-4 py-3.5 sm:px-8 sm:py-6 text-left text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">{header}</th>
                                        ))
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {students.length === 0 ? (
                                    <tr>
                                        <td colSpan={isStudent ? 5 : 6} className="px-4 py-12 sm:px-8 sm:py-20 text-center">
                                            <div className="flex flex-col items-center justify-center grayscale opacity-30">
                                                <Calendar className="w-12 h-12 sm:w-16 sm:h-16 mb-4 text-gray-300" />
                                                <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.3em] text-gray-400">
                                                    {isStudent ? 'No attendance entries found' : selectedCourse ? 'No records for this selection' : 'Select a course to load registry'}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : paginatedStudents.map((student, idx) => (
                                    <tr key={student.id || idx} className="hover:bg-gray-50/50 transition-colors group">
                                        {isStudent ? (
                                            <>
                                                <td className="px-4 py-3.5 sm:px-8 sm:py-6 text-[10px] sm:text-[11px] font-black text-gray-600 uppercase tracking-widest whitespace-nowrap">{student.date}</td>
                                                <td className="px-4 py-3.5 sm:px-8 sm:py-6 text-xs font-bold text-gray-800 uppercase whitespace-nowrap">{student.course}</td>
                                                <td className="px-4 py-3.5 sm:px-8 sm:py-6 max-w-xs">
                                                    <div 
                                                        className="text-[10px] font-bold text-gray-400 line-clamp-2 italic prose prose-sm"
                                                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(student.report?.topics_covered || '—') }}
                                                    />
                                                </td>
                                                <td className="px-4 py-3.5 sm:px-8 sm:py-6 whitespace-nowrap">
                                                    <span className={`px-3 py-1 sm:px-4 sm:py-1.5 text-[8px] sm:text-[9px] font-black rounded-lg uppercase tracking-widest ${statusBadgeClass(student.status)}`}>
                                                        {student.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5 sm:px-8 sm:py-6 text-[10px] font-bold text-gray-400 italic whitespace-nowrap">
                                                    {formatLogTime(student)}
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-4 py-3.5 sm:px-8 sm:py-6 text-[10px] font-black text-gray-300">{ (currentPage - 1) * PAGE_SIZE + idx + 1 }</td>
                                                <td className="px-4 py-3.5 sm:px-8 sm:py-6 text-[10px] font-black text-maroon/40 uppercase tracking-widest whitespace-nowrap">{student.id}</td>
                                                <td className="px-4 py-3.5 sm:px-8 sm:py-6">
                                                    <div className="flex items-center gap-2.5 sm:gap-3">
                                                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-maroon/5 rounded-xl flex items-center justify-center text-maroon font-black text-xs uppercase shrink-0">
                                                            {(student.name || '?').charAt(0)}
                                                        </div>
                                                        <p className="text-xs font-black text-gray-800 uppercase tracking-tight whitespace-nowrap">{student.name}</p>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 sm:px-8 sm:py-6 whitespace-nowrap">
                                                    {(() => {
                                                        const insight = ratesById[String(student.id).trim()];
                                                        if (!insight || !insight.total) {
                                                            return <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">No data</span>;
                                                        }
                                                        const tone = insight.rate >= threshold
                                                            ? 'bg-green-100 text-green-700'
                                                            : insight.rate >= Math.max(0, threshold - 15)
                                                                ? 'bg-amber-100 text-amber-700'
                                                                : 'bg-red-50 text-red-600';
                                                        return (
                                                            <div className="flex items-center gap-2">
                                                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${tone}`}>{insight.rate}%</span>
                                                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{insight.total} sessions</span>
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-4 py-3.5 sm:px-8 sm:py-6 whitespace-nowrap">
                                                    <span className={`px-3 py-1 sm:px-4 sm:py-1.5 text-[8px] sm:text-[9px] font-black rounded-lg uppercase tracking-widest ${statusBadgeClass(student.attendance)}`}>
                                                        {student.attendance || 'Pending'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5 sm:px-8 sm:py-6">
                                                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                                        {statuses.map(status => {
                                                            const meta = STATUS_META[status];
                                                            const Icon = meta?.icon || CheckCircle2;
                                                            const isActive = student.attendance === status;
                                                            return (
                                                                <button
                                                                    key={status}
                                                                    title={`Mark ${status}`}
                                                                    onClick={() => updateStatus(student, status)}
                                                                    className={`p-2 sm:p-2.5 rounded-xl transition-all border text-[9px] font-black flex items-center gap-1 ${
                                                                        isActive
                                                                            ? (meta?.active || 'bg-gray-700 text-white border-gray-700')
                                                                            : `bg-gray-50 text-gray-500 border-gray-100 ${meta?.idle || 'hover:bg-gray-700 hover:text-white hover:border-gray-700'}`
                                                                    }`}
                                                                >
                                                                    <Icon className="w-3.5 h-3.5" />
                                                                    <span className="hidden sm:inline">{status}</span>
                                                                </button>
                                                            );
                                                        })}
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
            </div>

            {/* Pagination Controls — visible only for teacher/admin student list */}
            {!isStudent && students.length > PAGE_SIZE && (
                <div className="flex flex-col sm:flex-row items-center justify-between bg-white px-4 py-3.5 sm:px-8 sm:py-4 rounded-xl sm:rounded-[2rem] border border-gray-100 shadow-sm gap-3 sm:gap-0">
                    <span className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest text-center sm:text-left">
                        Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, students.length)} of {students.length} learners
                    </span>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest bg-gray-50 border border-gray-100 text-gray-500 hover:bg-maroon hover:text-white hover:border-maroon transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            ← Prev
                        </button>
                        <div className="hidden sm:flex items-center gap-1.5">
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
                        </div>
                        <span className="sm:hidden text-[10px] font-black text-maroon px-2">
                            {currentPage}/{totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest bg-gray-50 border border-gray-100 text-gray-500 hover:bg-maroon hover:text-white hover:border-maroon transition-all disabled:opacity-30 disabled:cursor-not-allowed"
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
                        className="w-full md:w-auto bg-maroon text-gold px-6 py-3.5 sm:px-12 sm:py-5 rounded-xl sm:rounded-[1.5rem] font-black text-[9px] sm:text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.3em] hover:bg-elite-maroon shadow-2xl shadow-maroon/20 transition-all disabled:opacity-60 relative overflow-hidden group"
                    >
                        <span className="relative z-10 flex items-center justify-center gap-3">
                            {saving ? 'Synchronising...' : 'Commit Daily Academic Ledger'}
                        </span>
                    </button>
                )}
                {isStudent && (
                    <button
                        onClick={() => window.print()}
                        className="w-full md:w-auto bg-gray-800 text-white px-6 py-3.5 sm:px-12 sm:py-5 rounded-xl sm:rounded-[1.5rem] font-black text-[9px] sm:text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.3em] shadow-xl hover:bg-black transition-all"
                    >
                        Export Attendance Report
                    </button>
                )}
            </div>
        </div>
    );
}
