import { useState, useEffect, useMemo } from 'react';
import {
    Users,
    BookOpen,
    Calendar,
    FileText,
    MessageSquare,
    Save,
    ChevronRight,
    Search,
    ShieldCheck,
    History,
    CheckCircle2,
    Activity,
    CheckCircle
} from 'lucide-react';
import RichTextEditor from '../components/shared/RichTextEditor';
import { studentsAPI, coursesAPI, studentDailyReportsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

export default function StudentDailyReportEntry() {
    const { user } = useAuth();

    const formatCourse = (course) => {
        if (!course) return '';
        if (typeof course === 'string' && course.startsWith('{') && course.endsWith('}')) {
            return course.slice(1, -1).replace(/"/g, '');
        }
        if (typeof course === 'string' && course.startsWith('[') && course.endsWith(']')) {
            try {
                const parsed = JSON.parse(course);
                return Array.isArray(parsed) ? parsed.join(', ') : parsed;
            } catch (e) {
                return course;
            }
        }
        return course;
    };

    const [students, setStudents] = useState([]);
    const [myCourses, setMyCourses] = useState([]);
    const [allCourses, setAllCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCourse, setSelectedCourse] = useState('All');
    const [selectedDepartment, setSelectedDepartment] = useState('All');

    // Date filters for history
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [expandedDepts, setExpandedDepts] = useState({});
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;


    // Departments derived from all courses
    const allDepartments = useMemo(() => {
        const depts = new Set((allCourses || []).map(c => c.department).filter(Boolean));
        return ['All', ...Array.from(depts).sort()];
    }, [allCourses]);

    // Courses matching selected department
    const filteredCourseList = useMemo(() => {
        if (selectedDepartment === 'All') return allCourses || [];
        return (allCourses || []).filter(c => c.department === selectedDepartment);
    }, [allCourses, selectedDepartment]);

    // Form State
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [reportForm, setReportForm] = useState({
        report_date: new Date().toISOString().split('T')[0],
        topics_covered: '',
        trainer_remarks: ''
    });

    const [recentReports, setRecentReports] = useState([]);
    const [viewMode, setViewMode] = useState('entry'); // 'entry' or 'history'

    useEffect(() => {
        fetchInitialData();
    }, []);

    // Shared helper: fetch reports with role-aware params
    const fetchReports = async () => {
        // For teacher: the backend already filters by their courses OR trainer_email.
        // Passing trainer_email as an extra AND would over-restrict results, so we
        // only pass it for admin/superadmin to optionally scope results.
        const params = {};
        const reportsRes = await studentDailyReportsAPI.getAll(params);
        setRecentReports(reportsRes.data || []);
    };

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const [studentsRes, coursesRes] = await Promise.all([
                studentsAPI.getAll(),
                coursesAPI.getAll()
            ]);

            // Filter courses where user is the instructor
            const name = user.name || user.email;
            const courses = (coursesRes.data || []).filter(c =>
                String(c.instructor || '').toLowerCase() === String(name).toLowerCase()
            );
            setMyCourses(courses);
            setAllCourses(coursesRes.data || []);

            // If teacher, only show students in their courses
            let studentList = studentsRes.data || [];
            const isAdmin = ['admin', 'superadmin'].includes(user.role);

            if (!isAdmin && courses.length > 0) {
                const courseNames = courses.map(c => c.name.toLowerCase());
                studentList = studentList.filter(s => {
                    const sCourses = Array.isArray(s.course)
                        ? s.course
                        : [String(s.course || '')];
                    return sCourses.some(c => courseNames.includes(String(c).toLowerCase().trim()));
                });
            }
            setStudents(studentList || []);

            // Fetch reports using shared role-aware helper
            await fetchReports();

        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load student data');
        } finally {
            setLoading(false);
        }
    };

    const hasReportForDate = (studentId, date) => {
        return recentReports.some(r =>
            r.student_id === studentId &&
            new Date(r.report_date).toISOString().split('T')[0] === date
        );
    };

    const isAdmin = ['admin', 'superadmin'].includes(user.role);

    const filteredStudents = students.filter(s => {
        const matchesSearch = (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (s.id || '').toLowerCase().includes(searchQuery.toLowerCase());
        
        const sCourses = Array.isArray(s.course)
            ? s.course
            : [String(s.course || '')];

        const matchesCourse = selectedCourse === 'All' ||
            sCourses.some(c => String(c).trim() === selectedCourse);

        // Dept filter (find course's department)
        let matchesDept = true;
        if (selectedDepartment !== 'All') {
            matchesDept = sCourses.some(cn => {
                const c = allCourses.find(course => course.name === cn);
                return c?.department === selectedDepartment;
            });
        }

        return matchesSearch && matchesCourse && matchesDept;
    });

    const filteredReports = recentReports.filter(r => {
        const rDate = r.report_date || '';
        const matchesDate = (!filterDateFrom || rDate >= filterDateFrom) && 
                          (!filterDateTo || rDate <= filterDateTo);
        
        const sCourses = Array.isArray(r.course) ? r.course : [String(r.course || '')];
        const matchesCourse = selectedCourse === 'All' || sCourses.some(c => String(c).trim() === selectedCourse);
        
        // Find if any of student's courses are in the selected department
        let matchesDept = true;
        if (selectedDepartment !== 'All') {
            matchesDept = sCourses.some(cn => {
                const c = allCourses.find(course => course.name === cn);
                return c?.department === selectedDepartment;
            });
        }

        return matchesDate && matchesCourse && matchesDept;
    }).sort((a, b) => new Date(b.report_date) - new Date(a.report_date));

    // Reset page on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedCourse, selectedDepartment, filterDateFrom, filterDateTo, viewMode]);

    // Paginated Reports

    const paginatedReports = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredReports.slice(start, start + itemsPerPage);
    }, [filteredReports, currentPage]);


    // Grouping for admin history
    const groupedReports = useMemo(() => {
        if (!isAdmin || viewMode !== 'history') return null;
        const grouped = {};
        filteredReports.forEach(r => {
            const sCourses = Array.isArray(r.course) ? r.course : [String(r.course || '')];
            const courseName = sCourses[0] || 'Unassigned';
            const courseObj = allCourses.find(c => c.name === courseName);
            const dept = courseObj?.department || 'Miscellaneous';

            if (!grouped[dept]) grouped[dept] = {};
            if (!grouped[dept][courseName]) grouped[dept][courseName] = [];
            grouped[dept][courseName].push(r);
        });
        return grouped;
    }, [paginatedReports, isAdmin, viewMode, allCourses]);


    const toggleDept = (dept) => {
        setExpandedDepts(prev => ({ ...prev, [dept]: !prev[dept] }));
    };

    const completionRate = students.length > 0
        ? Math.round((students.filter(s => hasReportForDate(s.id, reportForm.report_date)).length / students.length) * 100)
        : 0;

    const handleStudentSelect = (student) => {
        setSelectedStudent(student);
        setViewMode('entry');

        // Check if there's already a report for this student on the selected date
        const existing = recentReports.find(r =>
            r.student_id === student.id &&
            new Date(r.report_date).toISOString().split('T')[0] === reportForm.report_date
        );

        if (existing) {
            setReportForm({
                ...reportForm,
                topics_covered: existing.topics_covered,
                trainer_remarks: existing.trainer_remarks || ''
            });
            toast.success('Loaded existing record');
        } else {
            setReportForm({
                ...reportForm,
                topics_covered: '',
                trainer_remarks: ''
            });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedStudent) {
            toast.error('Please select a student first');
            return;
        }

        try {
            setSaving(true);
            const payload = {
                student_id: selectedStudent.id,
                student_name: selectedStudent.name,
                course: selectedStudent.course,
                ...reportForm
            };

            await studentDailyReportsAPI.create(payload);
            toast.success('Academic progress recorded successfully');

            // Refresh history using the same role-aware params as initial load
            await fetchReports();

        } catch (error) {
            console.error('Error saving report:', error);
            toast.error(error.response?.data?.error || 'Failed to save report');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center animate-pulse font-black text-maroon uppercase tracking-widest">Initialising Registry...</div>;

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden">
                <Activity className="absolute -right-4 -top-4 w-32 h-32 text-maroon/[0.03] rotate-12" />
                <div>
                    <h1 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">Student Academic Journal</h1>
                    <p className="text-sm text-gray-400 font-medium">Daily Progress Recording Protocol • {user.name || user.email}</p>
                </div>
                <div className="flex gap-3 z-10">
                    <button
                        onClick={() => setViewMode('entry')}
                        className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${viewMode === 'entry' ? 'bg-maroon text-gold shadow-lg shadow-maroon/20' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                    >
                        New Entry
                    </button>
                    <button
                        onClick={() => setViewMode('history')}
                        className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${viewMode === 'history' ? 'bg-maroon text-gold shadow-lg shadow-maroon/20' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                    >
                        Entry History
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Side: Student Registry */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Progress Overview Card */}
                    <div className="bg-maroon text-gold p-6 rounded-[2rem] shadow-xl relative overflow-hidden group">
                        <div className="absolute right-0 bottom-0 opacity-10 translate-x-1/4 translate-y-1/4 group-hover:scale-110 transition-transform duration-700">
                            <CheckCircle2 className="w-40 h-40" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">Daily Progress Sync</p>
                        <div className="flex items-end gap-2 mb-4">
                            <span className="text-4xl font-black">{completionRate}%</span>
                            <span className="text-[10px] font-bold uppercase mb-1.5 opacity-80">Students Logged</span>
                        </div>
                        <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden mb-4">
                            <div className="bg-gold h-full transition-all duration-1000" style={{ width: `${completionRate}%` }}></div>
                        </div>
                        <p className="text-[9px] font-bold uppercase tracking-widest opacity-60 flex items-center gap-2">
                            <Activity className="w-3 h-3" /> {students.filter(s => hasReportForDate(s.id, reportForm.report_date)).length} of {students.length} Students Documentation Complete
                        </p>
                    </div>

                    <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xl overflow-hidden">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-maroon" />
                                <h2 className="text-xs font-black text-gray-800 uppercase tracking-widest">Course Registry</h2>
                            </div>
                            <span className="px-3 py-1 bg-gray-50 text-[8px] font-black text-gray-400 rounded-full uppercase tracking-widest border border-gray-100">
                                {filteredStudents.length} Students
                            </span>
                        </div>

                        {/* Search & Filter */}
                        <div className="space-y-3 mb-6">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search by Name/ID..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-12 pr-6 py-4 bg-gray-50 border-transparent rounded-2xl text-xs font-bold text-gray-600 focus:bg-white focus:border-maroon/20 focus:ring-4 focus:ring-maroon/5 transition-all outline-none"
                                />
                            </div>
                            {isAdmin && (
                                <select
                                    value={selectedDepartment}
                                    onChange={(e) => { setSelectedDepartment(e.target.value); setSelectedCourse('All'); }}
                                    className="w-full px-6 py-4 bg-gray-50 border-transparent rounded-2xl text-xs font-bold text-gray-600 focus:bg-white focus:border-maroon/20 transition-all outline-none cursor-pointer"
                                >
                                    {allDepartments.map(d => <option key={d} value={d}>{d === 'All' ? 'All Departments' : d}</option>)}
                                </select>
                            )}
                            <select
                                value={selectedCourse}
                                onChange={(e) => setSelectedCourse(e.target.value)}
                                className="w-full px-6 py-4 bg-gray-50 border-transparent rounded-2xl text-xs font-bold text-gray-600 focus:bg-white focus:border-maroon/20 transition-all outline-none cursor-pointer"
                            >
                                <option value="All">{isAdmin ? 'All Courses' : 'All My Courses'}</option>
                                {isAdmin 
                                    ? filteredCourseList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)
                                    : myCourses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)
                                }
                            </select>
                        </div>

                        {/* Student List */}
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {filteredStudents.length > 0 ? (
                                filteredStudents.map(student => {
                                    const documented = hasReportForDate(student.id, reportForm.report_date);
                                    return (
                                        <button
                                            key={student.id}
                                            onClick={() => handleStudentSelect(student)}
                                            className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border group relative ${selectedStudent?.id === student.id ? 'bg-maroon text-white border-maroon shadow-lg shadow-maroon/20' : 'bg-white text-gray-600 border-gray-50 hover:border-maroon/20 hover:bg-gray-50'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] ${selectedStudent?.id === student.id ? 'bg-white/20' : 'bg-maroon/5 text-maroon'}`}>
                                                        {student.name.charAt(0)}
                                                    </div>
                                                    {documented && (
                                                        <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-0.5 border-2 border-white shadow-sm scale-75">
                                                            <CheckCircle className="w-3 h-3" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-left">
                                                    <p className="font-black text-[11px] uppercase line-clamp-1">{student.name}</p>
                                                    <p className={`text-[8px] font-bold uppercase tracking-widest ${selectedStudent?.id === student.id ? 'text-white/60' : 'text-gray-400'}`}>{student.id}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {documented && selectedStudent?.id !== student.id && (
                                                    <span className="text-[7px] font-black text-green-500 uppercase tracking-widest bg-green-50 px-2 py-1 rounded-md border border-green-100">Logged</span>
                                                )}
                                                <ChevronRight className={`w-4 h-4 transition-transform ${selectedStudent?.id === student.id ? 'translate-x-1' : 'opacity-0 group-hover:opacity-100'}`} />
                                            </div>
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="text-center py-12">
                                    <Users className="w-12 h-12 text-gray-100 mx-auto mb-4" />
                                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">No matching students</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Side: Entry Form or History */}
                <div className="lg:col-span-8">
                    {viewMode === 'entry' ? (
                        <div className="space-y-6">
                            {selectedStudent ? (
                                <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-500">
                                    {/* Form Header */}
                                    <div className="bg-gray-50/80 px-10 py-8 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-gray-50 to-white">
                                        <div>
                                            <h2 className="text-xl font-black text-maroon uppercase tracking-tight">Record Daily Coverage</h2>
                                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.3em] flex items-center gap-2">
                                                Drafting for: {selectedStudent.name} <span className="w-1 h-1 bg-gray-300 rounded-full"></span> {selectedStudent.course}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <div className="px-4 py-2 bg-white rounded-xl border border-gray-200 text-[10px] font-black text-maroon uppercase flex items-center gap-2 shadow-sm">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(reportForm.report_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                            </div>
                                            {hasReportForDate(selectedStudent.id, reportForm.report_date) && (
                                                <span className="text-[7px] font-black text-green-600 uppercase tracking-widest flex items-center gap-1">
                                                    <CheckCircle2 className="w-2.5 h-2.5" /> Previously Documented
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-10 space-y-8">
                                        {/* Date Picker */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-3">
                                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                                                    <Calendar className="w-3 h-3" /> Reporting Date
                                                </label>
                                                <input
                                                    type="date"
                                                    value={reportForm.report_date}
                                                    onChange={(e) => setReportForm({ ...reportForm, report_date: e.target.value })}
                                                    className="w-full px-8 py-5 bg-white border-2 border-gray-100 rounded-[1.5rem] text-sm font-black text-gray-800 outline-none focus:border-maroon/20 focus:ring-4 focus:ring-maroon/5 transition-all shadow-sm"
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                                                    <BookOpen className="w-3 h-3" /> Assigned Unit
                                                </label>
                                                <div className="w-full px-8 py-5 bg-gray-50 border-2 border-transparent rounded-[1.5rem] text-sm font-black text-gray-500 shadow-inner">
                                                    {selectedStudent.course}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Coverage */}
                                        <div className="space-y-3">
                                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                                                <FileText className="w-3 h-3" /> Topics Covered & Content Delivery
                                            </label>
                                            <RichTextEditor
                                                value={reportForm.topics_covered}
                                                onChange={(val) => setReportForm({ ...reportForm, topics_covered: val })}
                                                placeholder="Detail the modules, chapters, or specific skills covered in this session..."
                                                minHeight="160px"
                                            />
                                        </div>

                                        {/* Remarks */}
                                        <div className="space-y-3">
                                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                                                <MessageSquare className="w-3 h-3" /> Trainer Remarks & Performance Observations
                                            </label>
                                            <RichTextEditor
                                                value={reportForm.trainer_remarks}
                                                onChange={(val) => setReportForm({ ...reportForm, trainer_remarks: val })}
                                                placeholder="Individual student progress, discipline, or specific achievements..."
                                                minHeight="160px"
                                            />
                                        </div>

                                        {/* Verification Footer */}
                                        <div className="p-6 bg-maroon/5 border border-maroon/10 rounded-3xl">
                                            <div className="flex items-start gap-4">
                                                <div className="mt-1">
                                                    <ShieldCheck className="w-5 h-5 text-maroon" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-maroon uppercase tracking-widest mb-1">Trainer Attestation</p>
                                                    <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
                                                        I hereby certify that the content described above was delivered as part of the accredited curriculum and that the observations truthfully reflect the student's daily academic engagement.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Bar */}
                                    <div className="px-10 py-8 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                                        <div className="hidden md:block">
                                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-[0.2em]">Auth: {user.name || user.email}</p>
                                            <p className="text-[7px] font-bold text-gray-300 uppercase">System Time: {new Date().toLocaleTimeString()}</p>
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={saving}
                                            className="w-full md:w-auto min-w-[300px] group bg-maroon text-gold py-6 rounded-[2.5rem] font-black text-sm uppercase tracking-[0.3em] hover:bg-maroon-dark shadow-2xl shadow-maroon/20 transition-all border border-gold/20 disabled:opacity-60 relative overflow-hidden flex items-center justify-center gap-3"
                                        >
                                            {saving ? (
                                                <>
                                                    <div className="animate-spin w-5 h-5 border-2 border-gold/40 border-t-gold rounded-full" />
                                                    <span>Synchronising...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                                                    <span>Commit to Journal</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div className="bg-white p-20 rounded-[3rem] border border-dashed border-gray-200 text-center flex flex-col items-center justify-center">
                                    <div className="w-24 h-24 bg-gray-50 rounded-[2.5rem] flex items-center justify-center mb-8">
                                        <FileText className="w-10 h-10 text-gray-200" />
                                    </div>
                                    <h2 className="text-xl font-black text-gray-400 uppercase tracking-tighter">No Student Selected</h2>
                                    <p className="text-sm text-gray-300 font-medium mt-2 max-w-sm">
                                        Please select a student from your course registry on the left to begin recording their daily academic progress.
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* History Mode */
                        <div className="space-y-6">
                            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                                <div className="flex flex-col gap-6 mb-8">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 bg-blue-50 rounded-2xl">
                                                <History className="w-6 h-6 text-blue-600" />
                                            </div>
                                            <div>
                                                <h2 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Academic Dispatch Logs</h2>
                                                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{filteredReports.length} reports recorded</p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">From Date</label>
                                            <input 
                                                type="date"
                                                value={filterDateFrom}
                                                onChange={e => setFilterDateFrom(e.target.value)}
                                                className="w-full px-4 py-3 bg-gray-50 border-transparent rounded-xl text-[10px] font-bold text-gray-600 focus:bg-white transition-all outline-none"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">To Date</label>
                                            <input 
                                                type="date"
                                                value={filterDateTo}
                                                onChange={e => setFilterDateTo(e.target.value)}
                                                className="w-full px-4 py-3 bg-gray-50 border-transparent rounded-xl text-[10px] font-bold text-gray-600 focus:bg-white transition-all outline-none"
                                            />
                                        </div>
                                        {(filterDateFrom || filterDateTo) && (
                                            <div className="flex items-end">
                                                <button 
                                                    onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); }}
                                                    className="w-full px-4 py-3 bg-red-50 text-red-500 rounded-xl text-[9px] font-black uppercase tracking-widest border border-red-100 hover:bg-red-100 transition-all"
                                                >
                                                    Clear Dates
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    {filteredReports.length > 0 ? (
                                        isAdmin ? (
                                            /* Admin Grouped View */
                                            Object.keys(groupedReports).sort().map(dept => (
                                                <div key={dept} className="space-y-4">
                                                    <button 
                                                        onClick={() => toggleDept(dept)}
                                                        className="w-full flex items-center justify-between bg-gray-50 hover:bg-gray-100 p-6 rounded-[2rem] border border-gray-100 transition-all"
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-2xl bg-maroon flex items-center justify-center">
                                                                <Users className="w-5 h-5 text-gold" />
                                                            </div>
                                                            <div className="text-left">
                                                                <h3 className="text-sm font-black text-maroon uppercase tracking-widest">{dept}</h3>
                                                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                                                                    {Object.keys(groupedReports[dept]).length} Courses • {Object.values(groupedReports[dept]).flat().length} Logs
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <Search className={`w-4 h-4 text-maroon/20 transition-transform ${expandedDepts[dept] ? 'rotate-180' : ''}`} />
                                                    </button>
                                                    
                                                    {expandedDepts[dept] && (
                                                        <div className="space-y-6 pl-6 sm:pl-10 border-l-2 border-maroon/5 animate-in slide-in-from-top-4 duration-500">
                                                            {Object.keys(groupedReports[dept]).sort().map(courseName => (
                                                                <div key={courseName} className="space-y-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <BookOpen className="w-4 h-4 text-gold" />
                                                                        <h4 className="text-[10px] font-black text-maroon uppercase tracking-[0.2em]">{courseName}</h4>
                                                                        <div className="flex-1 h-px bg-maroon/5"></div>
                                                                    </div>
                                                                    <div className="space-y-4">
                                                                        {groupedReports[dept][courseName].map(report => (
                                                                            <HistoryCard key={report.id || report._id} report={report} students={students} setSelectedStudent={setSelectedStudent} setReportForm={setReportForm} setViewMode={setViewMode} formatCourse={formatCourse} />
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            /* Regular Teacher Flat View */
                                            paginatedReports.map(report => (
                                                <HistoryCard key={report.id || report._id} report={report} students={students} setSelectedStudent={setSelectedStudent} setReportForm={setReportForm} setViewMode={setViewMode} formatCourse={formatCourse} />
                                            ))
                                        )
                                    ) : (

                                        <div className="text-center py-20">
                                            <History className="w-16 h-16 text-gray-100 mx-auto mb-6" />
                                            <p className="text-[11px] font-black text-gray-300 uppercase tracking-widest">Archive is currently empty</p>
                                        </div>
                                    )}
                                </div>

                                {/* Pagination */}
                                {!loading && filteredReports.length > 0 && (
                                    <div className="mt-8">
                                        <PaginationControls 
                                            totalItems={filteredReports.length} 
                                            currentPage={currentPage} 
                                            setCurrentPage={setCurrentPage} 
                                            itemsPerPage={itemsPerPage} 
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}


const PaginationControls = ({ totalItems, currentPage, setCurrentPage, itemsPerPage }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) return null;

    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            pages.push(i);
        } else if (pages[pages.length - 1] !== '...') {
            pages.push('...');
        }
    }

    return (
        <div className="flex items-center justify-center gap-2 py-8">
            <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 bg-white border border-gray-100 rounded-xl disabled:opacity-30 hover:bg-maroon hover:text-gold transition-all shadow-sm"
            >
                <ChevronRight className="w-4 h-4 rotate-180" />
            </button>

            <div className="flex items-center gap-1">
                {pages.map((p, i) => (
                    <button
                        key={i}
                        onClick={() => typeof p === 'number' && setCurrentPage(p)}
                        className={`min-w-[40px] h-10 rounded-xl text-[10px] font-black transition-all border ${
                            p === currentPage 
                            ? 'bg-maroon text-gold border-maroon shadow-lg' 
                            : p === '...' 
                            ? 'bg-transparent border-transparent text-gray-400 cursor-default'
                            : 'bg-white text-gray-500 border-gray-100 hover:border-maroon/20'
                        }`}
                    >
                        {p}
                    </button>
                ))}
            </div>

            <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 bg-white border border-gray-100 rounded-xl disabled:opacity-30 hover:bg-maroon hover:text-gold transition-all shadow-sm"
            >
                <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
};



const HistoryCard = ({ report, students, setSelectedStudent, setReportForm, setViewMode, formatCourse }) => (
    <div className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100 hover:bg-white hover:border-maroon/20 transition-all group">
        <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
            <div className="flex flex-col">
                <span className="text-[9px] font-black text-maroon uppercase tracking-widest">{new Date(report.report_date).toLocaleDateString()}</span>
                <h3 className="font-black text-gray-800 uppercase text-sm mt-1">{report.student_name}</h3>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{formatCourse(report.course)}</span>
                <p className="text-[8px] font-black text-maroon/40 uppercase tracking-widest mt-0.5">Logged by {report.trainer_name || report.trainer_email || 'Trainer'}</p>
            </div>
            <div className="flex gap-2 h-fit">
                <button
                    onClick={() => {
                        const s = (students || []).find(st => st.id === report.student_id);
                        if (s) {
                            setSelectedStudent(s);
                            setReportForm({
                                report_date: new Date(report.report_date).toISOString().split('T')[0],
                                topics_covered: report.topics_covered,
                                trainer_remarks: report.trainer_remarks || ''
                            });
                            setViewMode('entry');
                        }
                    }}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-[9px] font-black text-gray-500 uppercase hover:text-maroon transition-all shadow-sm"
                >
                    Recalibrate
                </button>
            </div>
        </div>
        <div className="space-y-3 font-left">
            <div className="p-4 bg-white/50 rounded-xl border border-gray-100">
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-2">Coverage Detail</p>
                <div className="text-xs text-gray-600 leading-relaxed font-medium rich-text-content" dangerouslySetInnerHTML={{ __html: report.topics_covered }} />
            </div>
            {report.trainer_remarks && (
                <div className="flex gap-3 items-start opacity-70 group-hover:opacity-100 transition-opacity">
                    <History className="w-3 h-3 text-maroon mt-1 shrink-0" />
                    <div className="text-[11px] text-gray-700 font-bold italic line-clamp-2 rich-text-content" dangerouslySetInnerHTML={{ __html: report.trainer_remarks }} />
                </div>
            )}
        </div>
    </div>
);
