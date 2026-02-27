import { useState, useEffect } from 'react';
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
    History
} from 'lucide-react';
import { studentsAPI, coursesAPI, studentDailyReportsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

export default function StudentDailyReportEntry() {
    const { user } = useAuth();
    const [students, setStudents] = useState([]);
    const [myCourses, setMyCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCourse, setSelectedCourse] = useState('All');

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

            // If teacher, only show students in their courses
            let studentList = studentsRes.data || [];
            if (user.role === 'teacher' && courses.length > 0) {
                const courseNames = courses.map(c => c.name.toLowerCase());
                studentList = studentList.filter(s =>
                    courseNames.includes(String(s.course || '').toLowerCase())
                );
            }
            setStudents(studentList);

            // Fetch recent reports by this trainer
            const reportsRes = await studentDailyReportsAPI.getAll({ trainer_email: user.email });
            setRecentReports(reportsRes.data || []);

        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load student data');
        } finally {
            setLoading(false);
        }
    };

    const filteredStudents = students.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.id.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCourse = selectedCourse === 'All' || s.course === selectedCourse;
        return matchesSearch && matchesCourse;
    });

    const handleStudentSelect = (student) => {
        setSelectedStudent(student);
        setViewMode('entry');

        // Check if there's already a report for this student today
        const existing = recentReports.find(r =>
            r.student_id === student.id &&
            r.report_date === reportForm.report_date
        );

        if (existing) {
            setReportForm({
                ...reportForm,
                topics_covered: existing.topics_covered,
                trainer_remarks: existing.trainer_remarks || ''
            });
            toast.success('Loaded existing report for today');
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

            // Refresh history
            const reportsRes = await studentDailyReportsAPI.getAll({ trainer_email: user.email });
            setRecentReports(reportsRes.data || []);

            // Don't clear student, maybe trainer wants to edit
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">Student Academic Journal</h1>
                    <p className="text-sm text-gray-400 font-medium">Daily Progress Recording Protocol • {user.name || user.email}</p>
                </div>
                <div className="flex gap-3">
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
                    <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xl overflow-hidden">
                        <div className="flex items-center gap-2 mb-6">
                            <Users className="w-5 h-5 text-maroon" />
                            <h2 className="text-xs font-black text-gray-800 uppercase tracking-widest">Course Registry</h2>
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
                            <select
                                value={selectedCourse}
                                onChange={(e) => setSelectedCourse(e.target.value)}
                                className="w-full px-6 py-4 bg-gray-50 border-transparent rounded-2xl text-xs font-bold text-gray-600 focus:bg-white focus:border-maroon/20 transition-all outline-none cursor-pointer"
                            >
                                <option value="All">All My Courses</option>
                                {myCourses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            </select>
                        </div>

                        {/* Student List */}
                        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                            {filteredStudents.length > 0 ? (
                                filteredStudents.map(student => (
                                    <button
                                        key={student.id}
                                        onClick={() => handleStudentSelect(student)}
                                        className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border group ${selectedStudent?.id === student.id ? 'bg-maroon text-white border-maroon shadow-lg shadow-maroon/20' : 'bg-white text-gray-600 border-gray-50 hover:border-maroon/20 hover:bg-gray-50'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] ${selectedStudent?.id === student.id ? 'bg-white/20' : 'bg-maroon/5 text-maroon'}`}>
                                                {student.name.charAt(0)}
                                            </div>
                                            <div className="text-left">
                                                <p className="font-black text-[11px] uppercase line-clamp-1">{student.name}</p>
                                                <p className={`text-[8px] font-bold uppercase tracking-widest ${selectedStudent?.id === student.id ? 'text-white/60' : 'text-gray-400'}`}>{student.id}</p>
                                            </div>
                                        </div>
                                        <ChevronRight className={`w-4 h-4 transition-transform ${selectedStudent?.id === student.id ? 'translate-x-1' : 'opacity-0 group-hover:opacity-100'}`} />
                                    </button>
                                ))
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
                                <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden">
                                    {/* Form Header */}
                                    <div className="bg-gray-50/80 px-10 py-8 border-b border-gray-100 flex justify-between items-center">
                                        <div>
                                            <h2 className="text-xl font-black text-maroon uppercase tracking-tight">Record Daily Coverage</h2>
                                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.3em] flex items-center gap-2">
                                                Drafting for: {selectedStudent.name} <span className="w-1 h-1 bg-gray-300 rounded-full"></span> {selectedStudent.course}
                                            </p>
                                        </div>
                                        <div className="px-4 py-2 bg-white rounded-xl border border-gray-200 text-[10px] font-black text-maroon uppercase flex items-center gap-2 shadow-sm">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(reportForm.report_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
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
                                            <textarea
                                                value={reportForm.topics_covered}
                                                onChange={(e) => setReportForm({ ...reportForm, topics_covered: e.target.value })}
                                                placeholder="Detail the modules, chapters, or specific skills covered in this session..."
                                                className="w-full px-8 py-6 bg-white border-2 border-gray-100 rounded-[2rem] text-sm font-bold text-gray-700 outline-none focus:border-maroon/20 focus:ring-4 focus:ring-maroon/5 transition-all min-h-[160px] shadow-sm custom-scrollbar"
                                                required
                                            />
                                        </div>

                                        {/* Remarks */}
                                        <div className="space-y-3">
                                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                                                <MessageSquare className="w-3 h-3" /> Trainer Remarks & Performance Observations
                                            </label>
                                            <textarea
                                                value={reportForm.trainer_remarks}
                                                onChange={(e) => setReportForm({ ...reportForm, trainer_remarks: e.target.value })}
                                                placeholder="Observations on student understanding, practical participation, or specific areas for improvement..."
                                                className="w-full px-8 py-6 bg-white border-2 border-gray-100 rounded-[2rem] text-sm font-bold text-gray-600 outline-none focus:border-maroon/20 focus:ring-4 focus:ring-maroon/5 transition-all min-h-[120px] shadow-sm custom-scrollbar"
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
                                    <div className="px-10 py-8 bg-gray-50/50 border-t border-gray-100">
                                        <button
                                            type="submit"
                                            disabled={saving}
                                            className="w-full group bg-maroon text-gold py-6 rounded-[2.5rem] font-black text-sm uppercase tracking-[0.3em] hover:bg-maroon-dark shadow-2xl shadow-maroon/20 transition-all border border-gold/20 disabled:opacity-60 relative overflow-hidden flex items-center justify-center gap-3"
                                        >
                                            {saving ? (
                                                <>
                                                    <div className="animate-spin w-5 h-5 border-2 border-gold/40 border-t-gold rounded-full" />
                                                    <span>Synchronising Log...</span>
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
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-blue-50 rounded-2xl">
                                            <History className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Recent Dispatch Logs</h2>
                                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Your last {recentReports.length} committed reports</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {recentReports.length > 0 ? (
                                        recentReports.map(report => (
                                            <div key={report.id || report._id} className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100 hover:bg-white hover:border-maroon/20 transition-all group">
                                                <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-black text-maroon uppercase tracking-widest">{new Date(report.report_date).toLocaleDateString()}</span>
                                                        <h3 className="font-black text-gray-800 uppercase text-sm mt-1">{report.student_name}</h3>
                                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{report.course}</span>
                                                    </div>
                                                    <div className="flex gap-2 h-fit">
                                                        <button
                                                            onClick={() => {
                                                                const s = students.find(st => st.id === report.student_id);
                                                                if (s) {
                                                                    setSelectedStudent(s);
                                                                    setReportForm({
                                                                        report_date: report.report_date.split('T')[0],
                                                                        topics_covered: report.topics_covered,
                                                                        trainer_remarks: report.trainer_remarks || ''
                                                                    });
                                                                    setViewMode('entry');
                                                                }
                                                            }}
                                                            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-[9px] font-black text-gray-500 uppercase hover:text-maroon transition-all"
                                                        >
                                                            Recalibrate
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="space-y-3">
                                                    <div className="p-4 bg-white/50 rounded-xl border border-gray-100">
                                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-2">Coverage Detail</p>
                                                        <p className="text-xs text-gray-600 leading-relaxed font-medium">{report.topics_covered}</p>
                                                    </div>
                                                    {report.trainer_remarks && (
                                                        <div className="flex gap-3 items-start opacity-70 group-hover:opacity-100 transition-opacity">
                                                            <MessageSquare className="w-3 h-3 text-maroon mt-1 shrink-0" />
                                                            <p className="text-[11px] text-gray-400 font-bold italic line-clamp-1">{report.trainer_remarks}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-20">
                                            <History className="w-16 h-16 text-gray-100 mx-auto mb-6" />
                                            <p className="text-[11px] font-black text-gray-300 uppercase tracking-widest">Archive is currently empty</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

