import { useEffect, useState } from 'react';
import { gradesAPI, coursesAPI, studentsAPI, reportsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Award, Search, TrendingUp, Plus, X, Edit, Trash2, Calendar, BookOpen, User, History, Users, CheckCircle, Printer, FileDown, MessageSquare, Eye } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Interactions from '../components/shared/Interactions';

export default function Grades() {
    const { user } = useAuth();
    const isStudent = (user?.role ? String(user.role).toLowerCase() : '') === 'student';
    const canManage = ['admin', 'superadmin', 'teacher'].includes(user?.role?.toLowerCase());

    const [courses, setCourses] = useState([]);
    const [students, setStudents] = useState([]);
    const [grades, setGrades] = useState([]);
    const [allRecords, setAllRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingGrade, setEditingGrade] = useState(null);
    const [discussionEntity, setDiscussionEntity] = useState(null);
    const [viewType, setViewType] = useState('CAT'); // 'CAT' or 'REPORTS'
    const [searchTerm, setSearchTerm] = useState('');
    const [catCourseFilter, setCatCourseFilter] = useState(''); // filter matrix by course
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [batchCourse, setBatchCourse] = useState('');
    const [batchAssignment, setBatchAssignment] = useState('CAT 1');
    const [batchMonth, setBatchMonth] = useState(new Date().toLocaleString('default', { month: 'long' }));
    const [batchStudents, setBatchStudents] = useState([]);
    const [batchMarks, setBatchMarks] = useState({}); // { studentId: score }
    const [submittingBatch, setSubmittingBatch] = useState(false);
    const [printingStudentReport, setPrintingStudentReport] = useState(null); // { student, grades }
    const [viewingReport, setViewingReport] = useState(null); // { student, grades }
    const [logoDataUrl, setLogoDataUrl] = useState('');

    const [formData, setFormData] = useState({
        student_id: '',
        course: '',
        assignment: 'CAT 1',
        month: new Date().toLocaleString('default', { month: 'long' }),
        score: '',
        max_score: '100',
        remarks: ''
    });

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const assignments = ['CAT 1', 'CAT 2', 'CAT 3', 'CAT 4', 'CAT 5', 'CAT 6', 'Final Exam', 'Practical Assessment'];

    // Pre-load the logo as a base64 data URL so html2canvas can always embed it
    useEffect(() => {
        fetch('/app-icon-v2.png')
            .then(r => r.blob())
            .then(blob => {
                const reader = new FileReader();
                reader.onloadend = () => setLogoDataUrl(reader.result);
                reader.readAsDataURL(blob);
            })
            .catch(() => setLogoDataUrl('/app-icon-v2.png')); // fallback
    }, []);

    useEffect(() => {
        if (!user) return;
        const load = async () => {
            setLoading(true);
            try {
                await fetchInitialData();
                await fetchGrades();
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [user?.id]);

    const fetchInitialData = async () => {
        try {
            const [{ data: coursesData }, { data: studentsData }] = await Promise.all([
                coursesAPI.getAll().catch(() => ({ data: [] })),
                studentsAPI.getAll().catch(() => ({ data: [] }))
            ]);
            setCourses(coursesData || []);
            setStudents(studentsData || []);
        } catch (error) {
            console.error('Error fetching initial data:', error);
        }
    };

    const fetchGrades = async () => {
        try {
            const [gradesRes, reportsRes] = await Promise.all([
                gradesAPI.getAll().catch(err => { console.error('Grades fetch error:', err); return { data: [] }; }),
                !isStudent ? reportsAPI.getAll().catch(err => { console.error('Reports fetch error:', err); return { data: [] }; }) : Promise.resolve({ data: [] })
            ]);

            const gradesData = (gradesRes && gradesRes.data) ? (Array.isArray(gradesRes.data) ? gradesRes.data : []) : [];
            const reportsData = (reportsRes && reportsRes.data) ? (Array.isArray(reportsRes.data) ? reportsRes.data : []) : [];

            const monthOrder = {
                'January': 1, 'February': 2, 'March': 3, 'April': 4, 'May': 5, 'June': 6,
                'July': 7, 'August': 8, 'September': 9, 'October': 10, 'November': 11, 'December': 12
            };

            // Student isolation (frontend filter for extra security)
            const filteredGrades = isStudent
                ? gradesData.filter(g => {
                    const gradeSid = String(g.student_id || '').trim().toLowerCase();
                    const userSid = String(user?.student_id || '').trim().toLowerCase();
                    const userId = String(user?.id || '').trim().toLowerCase();
                    return gradeSid === userSid || gradeSid === userId;
                })
                : gradesData;

            const sortedGrades = [...filteredGrades].sort((a, b) => {
                const monthA = monthOrder[a.month] || 0;
                const monthB = monthOrder[b.month] || 0;
                return monthB - monthA;
            });

            setGrades(sortedGrades);
            setAllRecords(reportsData);
        } catch (error) {
            console.error('Error in fetchGrades sequence:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingGrade) {
                await gradesAPI.update(editingGrade.id, formData);
            } else {
                await gradesAPI.create(formData);
            }
            setShowModal(false);
            setEditingGrade(null);
            resetForm();
            fetchGrades();
        } catch (error) {
            console.error('Error saving grade:', error);
            alert('Failed to save grade. Please check the console for details.');
        }
    };

    const handleEdit = (grade) => {
        setEditingGrade(grade);
        setFormData({
            student_id: grade.student_id,
            course: grade.course,
            assignment: grade.assignment,
            month: grade.month || '',
            score: grade.score,
            max_score: grade.max_score,
            remarks: grade.remarks || ''
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this result?')) {
            try {
                await gradesAPI.delete(id);
                fetchGrades();
            } catch (error) {
                console.error('Error deleting grade:', error);
            }
        }
    };

    const fetchBatchStudents = async (courseName) => {
        if (!courseName) return;
        try {
            const res = await gradesAPI.getBatchStudents(courseName);
            setBatchStudents(res.data || []);
            // Initialize marks
            const marks = {};
            (res.data || []).forEach(s => marks[s.id] = '');
            setBatchMarks(marks);
        } catch (error) {
            console.error('Error fetching batch students:', error);
        }
    };

    const handleBatchSubmit = async (e) => {
        e.preventDefault();
        const gradesToSubmit = Object.entries(batchMarks)
            .filter(([_, score]) => score !== '')
            .map(([studentId, score]) => ({
                student_id: studentId,
                course: batchCourse,
                assignment: batchAssignment,
                month: batchMonth,
                score: Number(score),
                max_score: 100,
                remarks: 'Batch Recorded'
            }));

        if (gradesToSubmit.length === 0) return alert('No marks entered.');

        try {
            setSubmittingBatch(true);
            await gradesAPI.createBatch({ grades: gradesToSubmit });
            setShowBatchModal(false);
            setBatchCourse('');
            setBatchStudents([]);
            fetchGrades();
            alert(`Successfully recorded ${gradesToSubmit.length} marks.`);
        } catch (error) {
            console.error('Batch submit error:', error);
            alert('Failed to record batch marks.');
        } finally {
            setSubmittingBatch(false);
        }
    };

    const handlePrintStudentReport = (studentId) => {
        const student = students.find(s => String(s.id).trim().toLowerCase() === String(studentId).trim().toLowerCase());
        const studentGrades = grades.filter(g => String(g.student_id).trim().toLowerCase() === String(studentId).trim().toLowerCase());

        if (!student) {
            alert('Student profile not found.');
            return;
        }

        setPrintingStudentReport({ student, grades: studentGrades });
        setTimeout(() => {
            window.print();
            setPrintingStudentReport(null);
        }, 1500);
    };

    const handleViewReport = (studentId) => {
        const student = students.find(s => String(s.id).trim().toLowerCase() === String(studentId).trim().toLowerCase());
        const studentGrades = grades.filter(g => String(g.student_id).trim().toLowerCase() === String(studentId).trim().toLowerCase());

        if (!student) {
            alert('Student profile not found.');
            return;
        }

        setViewingReport({ student, grades: studentGrades });
    };

    const handleDownloadReport = async (studentId) => {
        const student = students.find(s => String(s.id).trim().toLowerCase() === String(studentId).trim().toLowerCase());
        const studentGrades = grades.filter(g => String(g.student_id).trim().toLowerCase() === String(studentId).trim().toLowerCase());

        if (!student) {
            alert('Student profile not found.');
            return;
        }

        setPrintingStudentReport({ student, grades: studentGrades });

        // Wait for React to render the off-screen template
        setTimeout(async () => {
            // Target the INNER print div, not the outer off-screen wrapper
            const element = document.getElementById('print-a4-inner');
            if (!element) return;

            try {
                // Wait for every <img> inside the template to fully load
                const images = Array.from(element.querySelectorAll('img'));
                await Promise.all(
                    images.map(img =>
                        img.complete
                            ? Promise.resolve()
                            : new Promise(resolve => {
                                img.onload = resolve;
                                img.onerror = resolve;
                            })
                    )
                );

                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();

                // Capture the exact inner div — scrollX/scrollY:0 ensures we start from top-left
                const canvas = await html2canvas(element, {
                    scale: 3,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    scrollX: 0,
                    scrollY: 0,
                    width: element.offsetWidth,
                    height: element.offsetHeight,
                    logging: false,
                });
                const imgData = canvas.toDataURL('image/png');

                const imgProps = pdf.getImageProperties(imgData);
                const ratio = imgProps.height / imgProps.width;
                const renderedHeight = pdfWidth * ratio;

                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, Math.min(renderedHeight, pdfHeight));
                pdf.save(`${student.name.replace(/\s+/g, '_')}_Performance_Statement.pdf`);
            } catch (error) {
                console.error('PDF Generation Error:', error);
                alert('Portal Warning: Failed to generate document. Ensure system integrity.');
            } finally {
                setPrintingStudentReport(null);
            }
        }, 800);
    };

    const resetForm = () => {
        setFormData({
            student_id: '',
            course: '',
            assignment: 'CAT 1',
            month: new Date().toLocaleString('default', { month: 'long' }),
            score: '',
            max_score: '100',
            remarks: ''
        });
    };

    const filteredGradesDisplay = grades.filter(g => {
        const student = students.find(s => String(s.id).trim().toLowerCase() === String(g.student_id).trim().toLowerCase());
        const studentName = (student?.name || g.student_name || '').toLowerCase();
        const search = searchTerm.toLowerCase().trim();
        const matchSearch = studentName.includes(search) ||
            String(g.student_id).toLowerCase().includes(search) ||
            String(g.course).toLowerCase().includes(search) ||
            String(g.assignment).toLowerCase().includes(search);
        const matchCourse = !catCourseFilter || g.course === catCourseFilter;
        return matchSearch && matchCourse;
    });

    const filteredReportsDisplay = allRecords.filter(r => {
        const search = searchTerm.toLowerCase().trim();
        return (r.student_name || '').toLowerCase().includes(search) ||
            (r.student_id || '').toLowerCase().includes(search) ||
            (r.course_unit || '').toLowerCase().includes(search);
    });

    // --- CAT Comparison Matrix logic ---
    // Determine distinct ordered CAT columns from the filtered grades
    const catOrder = ['CAT 1', 'CAT 2', 'CAT 3', 'CAT 4', 'CAT 5', 'CAT 6', 'Practical Assessment', 'Final Exam'];
    const catColumns = catOrder.filter(cat => filteredGradesDisplay.some(g => g.assignment === cat));
    // Also include any unlisted assignment types
    filteredGradesDisplay.forEach(g => { if (!catColumns.includes(g.assignment)) catColumns.push(g.assignment); });

    // Group by student + course for academic clarity
    const matrixRowsAdmin = {};
    filteredGradesDisplay.forEach(g => {
        const sid = String(g.student_id).trim();
        const course = String(g.course || 'Unknown').trim();
        const combinedKey = `${sid}|${course}`;

        if (!matrixRowsAdmin[combinedKey]) {
            const student = students.find(s => String(s.id).trim().toLowerCase() === sid.toLowerCase());
            matrixRowsAdmin[combinedKey] = {
                studentId: sid,
                studentName: student?.name || g.student_name || sid,
                course: course,
                grades: {}
            };
        }
        // If multiple entries for same CAT, keep latest
        const key = g.assignment;
        if (!matrixRowsAdmin[combinedKey].grades[key] || g.id > matrixRowsAdmin[combinedKey].grades[key].id) {
            matrixRowsAdmin[combinedKey].grades[key] = g;
        }
    });
    const matrixRows = Object.values(matrixRowsAdmin).sort((a, b) => a.studentName.localeCompare(b.studentName));

    // For student view: also ensure name and course are present if needed, but primarily group by course
    const matrixRowsStudent = {};
    filteredGradesDisplay.forEach(g => {
        const course = g.course || 'Unknown';
        if (!matrixRowsStudent[course]) {
            matrixRowsStudent[course] = {
                course,
                studentName: user?.name,
                grades: {}
            };
        }
        const key = g.assignment;
        if (!matrixRowsStudent[course].grades[key] || g.id > matrixRowsStudent[course].grades[key].id) {
            matrixRowsStudent[course].grades[key] = g;
        }
    });
    const matrixRowsStudentArr = Object.values(matrixRowsStudent);

    const scoreChip = (grade) => {
        if (!grade) return <span className="text-[11px] font-black text-black/10">—</span>;
        const pct = Math.round((grade.score / (grade.max_score || 100)) * 100);
        const color = pct >= 70 ? 'bg-green-50 text-green-700 border-green-200'
            : pct >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-red-50 text-red-600 border-red-200';
        return (
            <div className={`inline-flex flex-col items-center px-3 py-1.5 rounded-xl border font-black text-xs ${color}`}>
                <span>{pct}%</span>
                <span className="text-[8px] font-bold opacity-60">{grade.score}/{grade.max_score || 100}</span>
            </div>
        );
    };

    const rowAvg = (gradesMap) => {
        const vals = Object.values(gradesMap).filter(Boolean);
        if (vals.length === 0) return null;
        const avg = vals.reduce((acc, g) => acc + (g.score / (g.max_score || 100)), 0) / vals.length;
        return Math.round(avg * 100);
    };

    const stats = {
        totalRecords: grades.length,
        filteredCount: filteredGradesDisplay.length,
        average: filteredGradesDisplay.length > 0
            ? Math.round((filteredGradesDisplay.reduce((acc, g) => acc + (g.score / (g.max_score || 100)), 0) / filteredGradesDisplay.length) * 100)
            : 0
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-maroon border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-maroon animate-pulse">Accessing Registry...</p>
            </div>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-10 py-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">
            <div className="print:hidden space-y-10">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-white border border-black/5 shadow-xl rounded-2xl text-maroon">
                                <Award className="w-6 h-6" />
                            </div>
                            <h1 className="text-2xl sm:text-4xl font-black text-black tracking-tight uppercase">
                                {isStudent ? 'CAT Performance' : 'Academic Registry'}
                            </h1>
                        </div>
                        <p className="text-xs text-black/40 font-bold tracking-[0.3em] uppercase sm:pl-14">
                            Continues Assessment Testing Portal
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2 sm:gap-4 w-full sm:w-auto">
                        <button
                            onClick={() => { fetchInitialData(); fetchGrades(); }}
                            className="bg-white text-maroon p-3 sm:p-4 rounded-2xl hover:bg-maroon hover:text-white transition-all shadow-xl border border-maroon/10 group"
                            title="Refresh Registry"
                        >
                            <History className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                        </button>
                        {canManage && (
                            <>
                                <button
                                    onClick={() => { setShowBatchModal(true); }}
                                    className="flex-1 sm:flex-none bg-white text-maroon px-4 sm:px-8 py-3 sm:py-4 rounded-2xl flex items-center justify-center gap-2 sm:gap-3 hover:bg-maroon hover:text-white transition-all shadow-2xl hover:scale-105 active:scale-95 font-black text-xs uppercase tracking-widest border border-maroon/10"
                                >
                                    <Users className="w-5 h-5" /> Batch Entry
                                </button>
                                <button
                                    onClick={() => { resetForm(); setEditingGrade(null); setShowModal(true); }}
                                    className="flex-1 sm:flex-none bg-maroon text-gold px-4 sm:px-8 py-3 sm:py-4 rounded-2xl flex items-center justify-center gap-2 sm:gap-3 hover:bg-elite-maroon transition-all shadow-2xl hover:scale-105 active:scale-95 font-black text-xs uppercase tracking-widest border border-black/5"
                                >
                                    <Plus className="w-5 h-5" /> Record CAT Result
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Performance Overview (Student Only) */}
                {isStudent && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-6 opacity-[0.03]">
                                <TrendingUp className="w-24 h-24 text-black" />
                            </div>
                            <p className="text-black/40 text-[10px] font-black uppercase tracking-widest mb-2">Overall Average</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-black text-black">{stats.average}%</span>
                                <span className="text-xs font-bold text-green-600">Overall</span>
                            </div>
                            <div className="mt-6 h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
                                <div className="h-full bg-maroon transition-all duration-1000" style={{ width: `${stats.average}%` }}></div>
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-2xl group">
                            <p className="text-black/40 text-[10px] font-black uppercase tracking-widest mb-2">Total CATs Sat</p>
                            <p className="text-5xl font-black text-black">{grades.length}</p>
                            <p className="text-[10px] text-black/30 mt-3 font-bold uppercase tracking-wider">Academic Term 2026</p>
                        </div>

                        <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-2xl group">
                            <p className="text-black/40 text-[10px] font-black uppercase tracking-widest mb-2">Current Standing</p>
                            <p className="text-4xl font-black text-black uppercase">
                                {stats.average >= 70 ? 'First Class' : stats.average >= 60 ? 'Upper Second' : stats.average >= 50 ? 'Lower Second' : grades.length > 0 ? 'Pass' : 'N/A'}
                            </p>
                            <p className="text-[10px] text-maroon mt-3 font-bold uppercase tracking-wider">Performance-based Profile</p>
                        </div>
                    </div>
                )}

                {/* Registry Card */}
                <div className="card-light overflow-hidden shadow-2xl border border-maroon/5 min-h-[500px]">
                    <div className="bg-maroon/[0.02] px-4 sm:px-10 py-5 sm:py-8 border-b border-black/5 flex flex-col gap-4 no-print">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex bg-black/[0.03] p-1.5 rounded-2xl self-start">
                                <button
                                    onClick={() => setViewType('CAT')}
                                    className={`px-4 sm:px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewType === 'CAT' ? 'bg-white text-maroon shadow-sm' : 'text-gray-400 hover:text-black'}`}
                                >
                                    CAT Comparison
                                </button>
                                {!isStudent && (
                                    <button
                                        onClick={() => setViewType('REPORTS')}
                                        className={`px-4 sm:px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewType === 'REPORTS' ? 'bg-white text-maroon shadow-sm' : 'text-gray-400 hover:text-black'}`}
                                    >
                                        Overall Report ({filteredReportsDisplay.length})
                                    </button>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                {/* Course filter for CAT matrix */}
                                {viewType === 'CAT' && (
                                    <select
                                        value={catCourseFilter}
                                        onChange={e => setCatCourseFilter(e.target.value)}
                                        className="bg-white border border-black/10 rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-black outline-none shadow-sm"
                                    >
                                        <option value="">All Courses</option>
                                        {[...new Set(grades.map(g => g.course).filter(Boolean))].sort().map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                )}
                                <div className="flex-1 flex items-center gap-3 bg-white border border-black/5 p-2 px-4 sm:px-6 rounded-2xl shadow-sm">
                                    <Search className="w-4 h-4 text-maroon shrink-0" />
                                    <input
                                        type="text"
                                        placeholder="Search students..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="bg-transparent border-none outline-none text-xs font-bold text-black placeholder:text-black/10 uppercase tracking-widest w-full sm:w-36"
                                    />
                                </div>
                                <button
                                    onClick={() => window.print()}
                                    className="bg-white border border-black/5 p-3 sm:p-4 rounded-2xl text-maroon hover:bg-maroon hover:text-white transition-all shadow-sm shrink-0"
                                    title="Print Registry View"
                                >
                                    <Printer className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-xl sm:text-2xl font-black text-black uppercase tracking-tight">CAT Comparison Matrix</h3>
                            <p className="text-xs text-black/30 font-bold mt-1 uppercase tracking-widest">
                                {viewType === 'CAT'
                                    ? `${isStudent ? matrixRowsStudentArr.length : matrixRows.length} ${isStudent ? 'courses' : 'students'} • ${catColumns.length} assessment${catColumns.length !== 1 ? 's' : ''} • ${grades.length} total marks`
                                    : `Archive contains ${allRecords.length} overall reports`}
                            </p>
                        </div>
                    </div>

                    {canManage && (
                        <div className="grid grid-cols-2 md:grid-cols-4 border-b border-black/5 divide-x divide-black/5 bg-white/50">
                            <div className="p-6 text-center">
                                <p className="text-[9px] font-black text-black/30 uppercase tracking-[0.2em] mb-1">Registry Mean</p>
                                <p className="text-xl font-black text-maroon">{stats.average}%</p>
                            </div>
                            <div className="p-6 text-center">
                                <p className="text-[9px] font-black text-black/30 uppercase tracking-[0.2em] mb-1">Total Entries</p>
                                <p className="text-xl font-black text-black">{stats.totalRecords}</p>
                            </div>
                            <div className="p-6 text-center">
                                <p className="text-[9px] font-black text-black/30 uppercase tracking-[0.2em] mb-1">Active Filter</p>
                                <p className="text-xl font-black text-black">{stats.filteredCount}</p>
                            </div>
                            <div className="p-6 text-center bg-maroon/[0.01]">
                                <p className="text-[9px] font-black text-black/30 uppercase tracking-[0.2em] mb-1">Academic Cycle</p>
                                <p className="text-xl font-black text-maroon uppercase">2025/26</p>
                            </div>
                        </div>
                    )}

                    <div className="table-container custom-scrollbar">
                        {viewType === 'CAT' ? (
                            <>
                                {catColumns.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        {/* Legend */}
                                        <div className="flex gap-4 px-6 py-3 bg-black/[0.01] border-b border-black/5 text-[9px] font-black uppercase tracking-widest">
                                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-200 inline-block" /> ≥70% Distinction</span>
                                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-200 inline-block" /> 50–69% Pass</span>
                                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-200 inline-block" /> &lt;50% Refer</span>
                                        </div>
                                        <table className="w-full">
                                            <thead>
                                                <tr className="bg-maroon/[0.03] border-b border-black/5">
                                                    <th className="px-6 py-5 text-left text-[10px] font-black text-black/40 uppercase tracking-[0.2em] sticky left-0 bg-maroon/[0.03] z-10 min-w-[180px]">
                                                        {isStudent ? 'Course' : 'Student'}
                                                    </th>
                                                    {catColumns.map(cat => (
                                                        <th key={cat} className="px-4 py-5 text-center text-[10px] font-black text-maroon uppercase tracking-[0.15em] min-w-[110px]">
                                                            {cat}
                                                        </th>
                                                    ))}
                                                    <th className="px-5 py-5 text-center text-[10px] font-black text-black/60 uppercase tracking-[0.15em] min-w-[90px] border-l border-black/10">
                                                        Average
                                                    </th>
                                                    {!isStudent && (
                                                        <th className="px-4 py-5 text-center text-[10px] font-black text-black/40 uppercase tracking-[0.15em] min-w-[100px]">Actions</th>
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-black/5">
                                                {(isStudent ? matrixRowsStudentArr : matrixRows).map((row, i) => {
                                                    const avg = rowAvg(row.grades);
                                                    const avgColor = avg === null ? 'text-black/20'
                                                        : avg >= 70 ? 'text-green-700 bg-green-50'
                                                            : avg >= 50 ? 'text-amber-700 bg-amber-50'
                                                                : 'text-red-600 bg-red-50';
                                                    return (
                                                        <tr key={i} className="hover:bg-maroon/[0.015] transition-colors group">
                                                            <td className="px-6 py-5 sticky left-0 bg-white group-hover:bg-maroon/[0.015] z-10 border-r border-black/5">
                                                                <p className="text-sm font-black text-black uppercase tracking-tight">
                                                                    {row.studentName}
                                                                </p>
                                                                <p className="text-[10px] font-bold text-maroon uppercase tracking-widest mt-0.5">{row.course}</p>
                                                                {!isStudent && <p className="text-[8px] font-bold text-black/30 uppercase mt-0.5">{row.studentId}</p>}
                                                            </td>
                                                            {catColumns.map(cat => (
                                                                <td key={cat} className="px-4 py-5 text-center">
                                                                    {row.grades[cat] ? (
                                                                        canManage ? (
                                                                            <button
                                                                                onClick={() => handleEdit(row.grades[cat])}
                                                                                className="group relative inline-block"
                                                                                title="Click to edit this result"
                                                                            >
                                                                                {scoreChip(row.grades[cat])}
                                                                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-maroon text-white rounded-full text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                                                                                    <Edit className="w-2.5 h-2.5" />
                                                                                </span>
                                                                            </button>
                                                                        ) : scoreChip(row.grades[cat])
                                                                    ) : (
                                                                        canManage ? (
                                                                            <button
                                                                                onClick={() => {
                                                                                    resetForm();
                                                                                    setEditingGrade(null);
                                                                                    setFormData(prev => ({
                                                                                        ...prev,
                                                                                        student_id: row.studentId,
                                                                                        course: row.course,
                                                                                        assignment: cat,
                                                                                        month: new Date().toLocaleString('default', { month: 'long' }),
                                                                                        score: '',
                                                                                        max_score: '100',
                                                                                        remarks: ''
                                                                                    }));
                                                                                    setShowModal(true);
                                                                                }}
                                                                                className="w-8 h-8 rounded-xl border-2 border-dashed border-black/10 text-black/20 hover:border-maroon hover:text-maroon hover:bg-maroon/5 transition-all flex items-center justify-center mx-auto"
                                                                                title={`Add ${cat} for ${row.studentName}`}
                                                                            >
                                                                                <Plus className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        ) : <span className="text-[11px] font-black text-black/10">—</span>
                                                                    )}
                                                                </td>
                                                            ))}
                                                            <td className="px-5 py-5 text-center border-l border-black/10">
                                                                {avg !== null ? (
                                                                    <span className={`inline-block px-3 py-1.5 rounded-xl text-sm font-black ${avgColor}`}>
                                                                        {avg}%
                                                                    </span>
                                                                ) : <span className="text-black/20 font-black">—</span>}
                                                            </td>
                                                            {!isStudent && (
                                                                <td className="px-4 py-5">
                                                                    <div className="flex justify-center gap-1.5 flex-wrap">
                                                                        <button onClick={() => handleViewReport(row.studentId)} className="p-2 hover:bg-maroon/5 rounded-xl transition-all border border-maroon/5 text-maroon/40" title="View Summary"><Eye className="w-3.5 h-3.5" /></button>
                                                                        <button onClick={() => handleDownloadReport(row.studentId)} className="p-2 hover:bg-gold hover:text-maroon rounded-xl transition-all border border-maroon/5 text-maroon" title="Download PDF"><FileDown className="w-3.5 h-3.5" /></button>
                                                                        {canManage && Object.values(row.grades).length > 0 && (
                                                                            <>
                                                                                <button
                                                                                    onClick={() => {
                                                                                        // Edit the most recent grade in this row
                                                                                        const latest = Object.values(row.grades).sort((a, b) => b.id - a.id)[0];
                                                                                        if (latest) handleEdit(latest);
                                                                                    }}
                                                                                    className="p-2 hover:bg-maroon hover:text-white rounded-xl transition-all border border-maroon/10 text-maroon"
                                                                                    title="Edit latest result"
                                                                                >
                                                                                    <Edit className="w-3.5 h-3.5" />
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => {
                                                                                        const latest = Object.values(row.grades).sort((a, b) => b.id - a.id)[0];
                                                                                        if (latest) handleDelete(latest.id);
                                                                                    }}
                                                                                    className="p-2 hover:bg-red-500 hover:text-white rounded-xl transition-all border border-red-100 text-red-400"
                                                                                    title="Delete latest result"
                                                                                >
                                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            )}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="py-24 text-center">
                                        <p className="text-[10px] font-black text-black/20 uppercase tracking-[0.3em]">No assessment records found. Use Batch Entry or Record CAT Result to add marks.</p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                {filteredReportsDisplay.length > 0 ? (
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-black/[0.01]">
                                                <th className="px-10 py-6 text-left text-[10px] font-black text-black/40 uppercase tracking-[0.2em]">Student Detail</th>
                                                <th className="px-10 py-6 text-left text-[10px] font-black text-black/40 uppercase tracking-[0.2em]">Period</th>
                                                <th className="px-10 py-6 text-center text-[10px] font-black text-black/40 uppercase tracking-[0.2em]">CAS Score</th>
                                                <th className="px-10 py-6 text-left text-[10px] font-black text-black/40 uppercase tracking-[0.2em]">Trainer Observations</th>
                                                <th className="px-10 py-6 text-center text-[10px] font-black text-black/40 uppercase tracking-[0.2em]">Recommendation</th>
                                                <th className="px-10 py-6 text-center text-[10px] font-black text-black/40 uppercase tracking-[0.2em]">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-black/5">
                                            {filteredReportsDisplay.map((report) => (
                                                <tr key={report.id} className="hover:bg-gold/[0.02] transition-colors group">
                                                    <td className="px-10 py-8">
                                                        <div>
                                                            <p className="text-sm font-black text-black uppercase tracking-tight">{report.student_name}</p>
                                                            <p className="text-[10px] font-bold text-black/30 uppercase tracking-widest">{report.student_id}</p>
                                                        </div>
                                                    </td>
                                                    <td className="px-10 py-8">
                                                        <div>
                                                            <p className="text-sm font-black text-black uppercase tracking-tight">{report.reporting_period}</p>
                                                            <p className="text-[10px] font-bold text-black/30 uppercase tracking-widest">{new Date(report.created_at).toLocaleDateString()}</p>
                                                        </div>
                                                    </td>
                                                    <td className="px-10 py-8 text-center">
                                                        <div className="inline-block px-5 py-2 bg-white text-black rounded-xl font-black text-lg shadow-xl border border-black/5">
                                                            {Math.round(report.theory_score)}%
                                                            <span className="block text-[8px] text-black/30 uppercase tracking-widest leading-none mt-1">Theory CAS</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-10 py-8">
                                                        <div className="max-w-xs">
                                                            <p className="text-xs font-bold text-black/60 italic leading-relaxed line-clamp-2">
                                                                {report.trainer_observations || 'No observations documented.'}
                                                            </p>
                                                        </div>
                                                    </td>
                                                    <td className="px-10 py-8 text-center">
                                                        <span className={`px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest border ${report.recommendation === 'Proceed' ? 'bg-green-50 border-green-200 text-green-600' :
                                                            report.recommendation === 'Improve' ? 'bg-orange-50 border-orange-200 text-orange-600' :
                                                                'bg-red-50 border-red-200 text-red-600'
                                                            }`}>
                                                            {report.recommendation}
                                                        </span>
                                                    </td>
                                                    <td className="px-10 py-8">
                                                        <div className="flex justify-center">
                                                            <button
                                                                onClick={() => handleViewReport(report.student_id)}
                                                                className="p-3 hover:bg-maroon/5 rounded-xl transition-all shadow-sm border border-maroon/5 text-maroon/40"
                                                                title="View Performance Summary"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDownloadReport(report.student_id)}
                                                                className="p-3 hover:bg-gold hover:text-maroon rounded-xl transition-all shadow-sm border border-maroon/5 text-maroon ml-3"
                                                                title="Download Performance Statement"
                                                            >
                                                                <FileDown className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => setDiscussionEntity({
                                                                    type: 'grade', // Treat reports similar to grades for interactions
                                                                    id: report.id || report._id,
                                                                    title: `Report: ${report.reporting_period} - ${report.student_name}`
                                                                })}
                                                                className="p-3 hover:bg-maroon hover:text-white rounded-xl transition-all shadow-sm border border-maroon/5 text-maroon ml-3"
                                                                title="Discuss This Report"
                                                            >
                                                                <MessageSquare className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="py-24 text-center">
                                        <p className="text-[10px] font-black text-black/20 uppercase tracking-[0.3em]">No matching overall reports found in the archive.</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Modal */}
                {showModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setShowModal(false)}></div>
                        <div className="relative bg-white w-full max-w-lg rounded-[3rem] shadow-2xl border border-black/5 p-10 animate-in zoom-in-95 duration-300">
                            <div className="flex justify-between items-center mb-10">
                                <div>
                                    <h2 className="text-3xl font-black text-black uppercase tracking-tight">
                                        {editingGrade ? 'Modify Result' : 'Record CAT Result'}
                                    </h2>
                                    <p className="text-[10px] text-maroon font-bold uppercase tracking-[0.3em] mt-1 italic">Secure Entry Portal</p>
                                </div>
                                <button onClick={() => setShowModal(false)} className="p-3 bg-white border border-black/5 hover:bg-black hover:text-white rounded-2xl transition-all shadow-sm">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-black/40 uppercase tracking-widest flex items-center gap-2">
                                        <User className="w-3 h-3 text-maroon" /> Student Selection
                                    </label>
                                    <select
                                        required
                                        value={formData.student_id}
                                        onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                                        className="w-full bg-white border border-black/10 outline-none rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest text-black appearance-none focus:ring-2 ring-black/5 transition-all shadow-sm"
                                    >
                                        <option value="">Select Official Student</option>
                                        {students.map(s => (
                                            <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-black/40 uppercase tracking-widest flex items-center gap-2">
                                            <BookOpen className="w-3 h-3 text-maroon" /> Course
                                        </label>
                                        <select
                                            required
                                            value={formData.course}
                                            onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                                            className="w-full bg-white border border-black/10 outline-none rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest text-black appearance-none focus:ring-2 ring-black/5 transition-all shadow-sm"
                                        >
                                            <option value="">Select Course</option>
                                            {(() => {
                                                const selectedStudent = students.find(s => String(s.id) === String(formData.student_id));
                                                // If student is selected and has specific courses, filter the list
                                                const studentCourses = selectedStudent?.course || [];
                                                const filteredCourses = (Array.isArray(studentCourses) && studentCourses.length > 0)
                                                    ? courses.filter(c => studentCourses.includes(c.name))
                                                    : courses;
                                                return filteredCourses.map(c => (
                                                    <option key={c.id} value={c.name}>{c.name}</option>
                                                ));
                                            })()}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-black/40 uppercase tracking-widest flex items-center gap-2">
                                            <TrendingUp className="w-3 h-3 text-maroon" /> Assessment Type
                                        </label>
                                        <select
                                            required
                                            value={formData.assignment}
                                            onChange={(e) => setFormData({ ...formData, assignment: e.target.value })}
                                            className="w-full bg-white border border-black/10 outline-none rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest text-black appearance-none focus:ring-2 ring-black/5 transition-all shadow-sm"
                                        >
                                            {assignments.map(a => <option key={a} value={a}>{a}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-black/40 uppercase tracking-widest flex items-center gap-2">
                                        <Calendar className="w-3 h-3 text-maroon" /> Month of Assessment
                                    </label>
                                    <select
                                        required
                                        value={formData.month}
                                        onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                                        className="w-full bg-white border border-black/10 outline-none rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest text-black appearance-none focus:ring-2 ring-black/5 transition-all shadow-sm"
                                    >
                                        {months.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-black/40 uppercase tracking-widest">Achieved Score</label>
                                        <input
                                            required
                                            type="number"
                                            placeholder="00"
                                            value={formData.score}
                                            onChange={(e) => setFormData({ ...formData, score: e.target.value })}
                                            className="w-full bg-white border border-black/10 outline-none rounded-2xl px-6 py-4 text-xl font-black text-black placeholder:text-black/5 focus:ring-2 ring-black/5 transition-all shadow-sm"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-black/40 uppercase tracking-widest">Maximum Marks</label>
                                        <input
                                            required
                                            type="number"
                                            placeholder="100"
                                            value={formData.max_score}
                                            onChange={(e) => setFormData({ ...formData, max_score: e.target.value })}
                                            className="w-full bg-white border border-black/10 outline-none rounded-2xl px-6 py-4 text-xl font-black text-black/20 placeholder:text-black/5 focus:ring-2 ring-black/5 transition-all shadow-sm"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-black/40 uppercase tracking-widest">Performance Remarks</label>
                                    <textarea
                                        placeholder="Enter academic observations or feedback..."
                                        value={formData.remarks}
                                        onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                        className="w-full bg-white border border-black/10 outline-none rounded-2xl px-6 py-4 text-xs font-bold text-black placeholder:text-black/10 focus:ring-2 ring-black/5 transition-all min-h-[100px] resize-none shadow-sm"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="w-full bg-black text-white py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] shadow-2xl hover:bg-maroon hover:scale-[1.02] active:scale-95 transition-all mt-4 border border-black/5"
                                >
                                    {editingGrade ? 'Update Registry' : 'Commit Result to Registry'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* Batch Entry Modal */}
                {showBatchModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-maroon/20 backdrop-blur-2xl animate-in fade-in duration-500" onClick={() => setShowBatchModal(false)}></div>
                        <div className="relative bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl border border-black/5 p-12 animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
                            <div className="flex justify-between items-center mb-10 flex-shrink-0">
                                <div>
                                    <h2 className="text-3xl font-black text-black uppercase tracking-tight flex items-center gap-3">
                                        <Users className="w-8 h-8 text-maroon" /> Batch Mark Entry
                                    </h2>
                                    <p className="text-[10px] text-maroon/60 font-bold uppercase tracking-[0.3em] mt-1 italic">Record multiple CAT results simultaneously</p>
                                </div>
                                <button onClick={() => setShowBatchModal(false)} className="p-3 bg-white border border-black/5 hover:bg-black hover:text-white rounded-2xl transition-all shadow-sm">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 flex-shrink-0">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-black/40 uppercase tracking-widest">Select Course</label>
                                    <select
                                        value={batchCourse}
                                        onChange={(e) => { setBatchCourse(e.target.value); fetchBatchStudents(e.target.value); }}
                                        className="w-full bg-gray-50 border border-black/5 outline-none rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest text-black"
                                    >
                                        <option value="">Choose Course...</option>
                                        {courses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-black/40 uppercase tracking-widest">Assessment</label>
                                    <select
                                        value={batchAssignment}
                                        onChange={(e) => setBatchAssignment(e.target.value)}
                                        className="w-full bg-gray-50 border border-black/5 outline-none rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest text-black"
                                    >
                                        {assignments.map(a => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-black/40 uppercase tracking-widest">Month</label>
                                    <select
                                        value={batchMonth}
                                        onChange={(e) => setBatchMonth(e.target.value)}
                                        className="w-full bg-gray-50 border border-black/5 outline-none rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest text-black"
                                    >
                                        {months.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                            </div>

                            {batchCourse && (
                                <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar mb-8">
                                    <table className="w-full text-left">
                                        <thead className="sticky top-0 bg-white z-10">
                                            <tr>
                                                <th className="py-4 text-[10px] font-black text-black/30 uppercase tracking-widest">Student</th>
                                                <th className="py-4 text-[10px] font-black text-black/30 uppercase tracking-widest text-center">Score (Max 100)</th>
                                                <th className="py-4 text-[10px] font-black text-black/30 uppercase tracking-widest text-right">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-black/5">
                                            {batchStudents.map(student => (
                                                <tr key={student.id} className="hover:bg-maroon/[0.02] transition-colors">
                                                    <td className="py-5">
                                                        <p className="text-xs font-black text-black uppercase tracking-tight">{student.name}</p>
                                                        <p className="text-[9px] font-bold text-black/30 uppercase tracking-widest">{student.id}</p>
                                                    </td>
                                                    <td className="py-5 text-center">
                                                        <input
                                                            type="number"
                                                            value={batchMarks[student.id]}
                                                            onChange={(e) => setBatchMarks({ ...batchMarks, [student.id]: e.target.value })}
                                                            placeholder="—"
                                                            className="w-24 bg-white border border-black/10 rounded-xl px-4 py-3 text-center text-sm font-black text-black"
                                                        />
                                                    </td>
                                                    <td className="py-5 text-right">
                                                        {batchMarks[student.id] !== '' ? (
                                                            <span className="text-[9px] font-black text-green-600 bg-green-50 px-3 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-1 justify-end ml-auto w-fit">
                                                                <CheckCircle className="w-3 h-3" /> Ready
                                                            </span>
                                                        ) : (
                                                            <span className="text-[9px] font-black text-black/20 uppercase tracking-widest">Pending</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {batchStudents.length === 0 && (
                                        <div className="py-20 text-center">
                                            <p className="text-xs font-black text-black/20 uppercase tracking-widest">No active students found in this course.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex-shrink-0 pt-6 border-t border-black/5 flex justify-between items-center">
                                <p className="text-[10px] font-bold text-black/40 uppercase tracking-widest">
                                    * Unordered fields will not be recorded
                                </p>
                                <button
                                    onClick={handleBatchSubmit}
                                    disabled={submittingBatch || !batchCourse || batchStudents.length === 0}
                                    className="bg-maroon text-gold px-12 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-elite-maroon hover:scale-105 transition-all disabled:opacity-40"
                                >
                                    {submittingBatch ? 'Committing Marks...' : 'Record All Marks'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Performance View Modal */}
                {viewingReport && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[110]">
                        <div className="bg-white border border-maroon/10 rounded-2xl sm:rounded-[2.5rem] p-6 sm:p-10 max-w-4xl w-full shadow-2xl relative max-h-[95vh] flex flex-col overflow-hidden">
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-maroon via-gold to-maroon opacity-60 rounded-t-[2.5rem]" />
                            <div className="flex justify-between items-center mb-8 shrink-0">
                                <div>
                                    <h2 className="text-2xl font-black text-black uppercase tracking-tight">Performance Statement</h2>
                                    <div className="w-10 h-0.5 bg-gold mt-2" />
                                    <p className="text-[10px] text-black/30 font-black uppercase tracking-widest mt-1">Official Academic Registry Review</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleDownloadReport(viewingReport.student.id)} className="p-2 bg-maroon/5 hover:bg-maroon hover:text-white rounded-xl transition-all shadow-sm">
                                        <FileDown className="w-5 h-5" />
                                    </button>
                                    <button onClick={() => handlePrintStudentReport(viewingReport.student.id)} className="p-2 bg-maroon/5 hover:bg-maroon hover:text-white rounded-xl transition-all shadow-sm">
                                        <Printer className="w-5 h-5" />
                                    </button>
                                    <button onClick={() => setViewingReport(null)} className="p-2 hover:bg-maroon/5 rounded-full transition-colors">
                                        <X className="w-6 h-6 text-black/30" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-8 overflow-y-auto pr-2 custom-scrollbar pb-10">
                                <div className="flex flex-col sm:flex-row gap-8 items-center sm:items-start border-b border-black/5 pb-8">
                                    <div className="w-24 h-24 rounded-3xl bg-maroon text-gold flex items-center justify-center text-3xl font-black shadow-xl shrink-0">
                                        {viewingReport.student.name.charAt(0)}
                                    </div>
                                    <div className="text-center sm:text-left space-y-2">
                                        <h3 className="text-2xl font-black text-black uppercase tracking-tight">{viewingReport.student.name}</h3>
                                        <p className="text-xs font-bold text-black/40 uppercase tracking-widest flex items-center justify-center sm:justify-start gap-2">
                                            <Users className="w-3 h-3 text-maroon" /> Student ID: {viewingReport.student.id}
                                        </p>
                                        <p className="text-[10px] font-black text-maroon uppercase tracking-widest bg-maroon/5 px-3 py-1 rounded-full inline-block">
                                            {viewingReport.student.course || 'Independent Enrollment'}
                                        </p>
                                    </div>
                                </div>

                                {/* ── Full CAT breakdown grouped by course ── */}
                                {(() => {
                                    // Group grades by course
                                    const byCourse = {};
                                    viewingReport.grades.forEach(g => {
                                        const crs = g.course || 'Unknown Course';
                                        if (!byCourse[crs]) byCourse[crs] = [];
                                        byCourse[crs].push(g);
                                    });
                                    const catOrder = ['CAT 1', 'CAT 2', 'CAT 3', 'CAT 4', 'CAT 5', 'CAT 6', 'Practical Assessment', 'Final Exam'];
                                    const sortGrades = (gs) => [...gs].sort((a, b) => {
                                        const ai = catOrder.indexOf(a.assignment);
                                        const bi = catOrder.indexOf(b.assignment);
                                        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
                                    });

                                    const bandColor = (pct) =>
                                        pct >= 70 ? 'bg-green-50 text-green-700 border-green-200'
                                            : pct >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                : 'bg-red-50 text-red-600 border-red-200';

                                    const bandLabel = (pct) =>
                                        pct >= 70 ? 'Distinction' : pct >= 60 ? 'Credit' : pct >= 50 ? 'Pass' : 'Refer';

                                    return (
                                        <div className="space-y-8">
                                            {/* Cumulative card */}
                                            <div className="bg-maroon text-gold p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                                                <div className="absolute top-0 right-0 p-6 opacity-10"><TrendingUp className="w-20 h-20" /></div>
                                                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Cumulative Average</p>
                                                        <h4 className="text-5xl font-black tracking-tighter">
                                                            {viewingReport.grades.length > 0
                                                                ? Math.round((viewingReport.grades.reduce((acc, g) => acc + (g.score / (g.max_score || 100)), 0) / viewingReport.grades.length) * 100)
                                                                : 0}%
                                                        </h4>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[9px] font-black uppercase opacity-60 mb-1">Academic Standing</p>
                                                        <p className="text-xl font-black uppercase">
                                                            {(() => {
                                                                const avg = viewingReport.grades.length > 0
                                                                    ? (viewingReport.grades.reduce((acc, g) => acc + (g.score / (g.max_score || 100)), 0) / viewingReport.grades.length) * 100 : 0;
                                                                return avg >= 70 ? 'Distinction' : avg >= 60 ? 'Credit' : avg >= 50 ? 'Pass' : viewingReport.grades.length > 0 ? 'Refer' : 'N/A';
                                                            })()}
                                                        </p>
                                                        <p className="text-[10px] font-black uppercase opacity-50 mt-1">{viewingReport.grades.length} Assessment{viewingReport.grades.length !== 1 ? 's' : ''} Recorded</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Per-course tables */}
                                            {viewingReport.grades.length === 0 ? (
                                                <div className="py-14 text-center text-[10px] font-black text-black/20 uppercase tracking-widest border-2 border-dashed border-black/8 rounded-2xl">
                                                    No assessment records found for this student.
                                                </div>
                                            ) : (
                                                Object.entries(byCourse).map(([course, cGrades]) => {
                                                    const sorted = sortGrades(cGrades);
                                                    const courseAvg = Math.round((sorted.reduce((acc, g) => acc + (g.score / (g.max_score || 100)), 0) / sorted.length) * 100);
                                                    return (
                                                        <div key={course} className="rounded-2xl border border-black/8 overflow-hidden">
                                                            {/* Course header */}
                                                            <div className="flex items-center justify-between bg-maroon/[0.04] px-6 py-4 border-b border-black/8">
                                                                <div className="flex items-center gap-3">
                                                                    <BookOpen className="w-4 h-4 text-maroon" />
                                                                    <p className="text-sm font-black text-black uppercase tracking-tight">{course}</p>
                                                                </div>
                                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${bandColor(courseAvg)}`}>
                                                                    Avg: {courseAvg}%
                                                                </span>
                                                            </div>

                                                            {/* Grades table */}
                                                            <table className="w-full">
                                                                <thead>
                                                                    <tr className="bg-black/[0.015] border-b border-black/5">
                                                                        <th className="px-5 py-3 text-left text-[10px] font-black text-black/40 uppercase tracking-widest">Assessment</th>
                                                                        <th className="px-5 py-3 text-center text-[10px] font-black text-black/40 uppercase tracking-widest">Month</th>
                                                                        <th className="px-5 py-3 text-center text-[10px] font-black text-black/40 uppercase tracking-widest">Marks</th>
                                                                        <th className="px-5 py-3 text-center text-[10px] font-black text-black/40 uppercase tracking-widest">Score</th>
                                                                        <th className="px-5 py-3 text-center text-[10px] font-black text-black/40 uppercase tracking-widest">Grade</th>
                                                                        <th className="px-5 py-3 text-left text-[10px] font-black text-black/40 uppercase tracking-widest">Remarks</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-black/5">
                                                                    {sorted.map((g, i) => {
                                                                        const pct = Math.round((g.score / (g.max_score || 100)) * 100);
                                                                        return (
                                                                            <tr key={i} className="hover:bg-maroon/[0.012] transition-colors">
                                                                                <td className="px-5 py-4">
                                                                                    <p className="text-xs font-black text-black uppercase">{g.assignment}</p>
                                                                                </td>
                                                                                <td className="px-5 py-4 text-center">
                                                                                    <p className="text-[11px] font-bold text-black/50 uppercase">{g.month || '—'}</p>
                                                                                </td>
                                                                                <td className="px-5 py-4 text-center">
                                                                                    <p className="text-xs font-black text-black">{g.score} / {g.max_score || 100}</p>
                                                                                </td>
                                                                                <td className="px-5 py-4 text-center">
                                                                                    <span className={`inline-block px-3 py-1 rounded-xl text-xs font-black border ${bandColor(pct)}`}>
                                                                                        {pct}%
                                                                                    </span>
                                                                                </td>
                                                                                <td className="px-5 py-4 text-center">
                                                                                    <span className="text-[10px] font-black text-black/50 uppercase">{bandLabel(pct)}</span>
                                                                                </td>
                                                                                <td className="px-5 py-4">
                                                                                    <p className="text-[11px] text-black/40 italic leading-snug max-w-[160px]">
                                                                                        {g.remarks || '—'}
                                                                                    </p>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                                {/* Course footer row */}
                                                                <tfoot>
                                                                    <tr className="bg-black/[0.02] border-t-2 border-maroon/20">
                                                                        <td colSpan={3} className="px-5 py-3 text-[10px] font-black text-black/40 uppercase tracking-widest">
                                                                            Course Average
                                                                        </td>
                                                                        <td className="px-5 py-3 text-center">
                                                                            <span className={`inline-block px-3 py-1 rounded-xl text-xs font-black border ${bandColor(courseAvg)}`}>
                                                                                {courseAvg}%
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-5 py-3 text-center">
                                                                            <span className="text-[10px] font-black text-maroon uppercase">{bandLabel(courseAvg)}</span>
                                                                        </td>
                                                                        <td />
                                                                    </tr>
                                                                </tfoot>
                                                            </table>
                                                        </div>
                                                    );
                                                })
                                            )}

                                            {/* Registry integrity */}
                                            <div className="bg-gray-50 p-6 rounded-2xl border border-black/5">
                                                <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mb-3">Registry Integrity</p>
                                                <div className="flex flex-wrap gap-4">
                                                    {['Verified by Academic Registrar', 'Digitally Signed Protocol'].map(t => (
                                                        <div key={t} className="flex items-center gap-2 text-[10px] font-bold text-black/60 uppercase">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />{t}
                                                        </div>
                                                    ))}
                                                    <div className="flex items-center gap-2 text-[10px] font-bold text-black/60 uppercase">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-maroon shrink-0" />Certified on {new Date().toLocaleDateString()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                )}

                {/* Performance Report Printing View */}
                {printingStudentReport && (
                    <>
                        {/* User-facing loading overlay */}
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] flex items-center justify-center">
                            <div className="bg-white rounded-3xl p-10 shadow-2xl text-center">
                                <div className="w-12 h-12 border-4 border-maroon border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                <p className="text-sm font-black text-black uppercase tracking-widest">Generating PDF</p>
                                <p className="text-[10px] text-black/40 font-bold uppercase tracking-widest mt-1">Please wait...</p>
                            </div>
                        </div>

                        {/* Off-screen printable template — rendered outside viewport so html2canvas captures the full thing */}
                        <div
                            id="printable-report"
                            style={{ position: 'absolute', left: '-9999px', top: 0, width: '794px', zIndex: -1 }}
                            className="font-serif bg-white"
                        >
                            <div id="print-a4-inner" className="border-4 border-double border-maroon p-6 bg-white flex flex-col" style={{ width: '794px', minHeight: '1123px' }}>

                                {/* ── HEADER ── */}
                                <div className="text-center border-b-2 border-maroon pb-3 mb-3">
                                    <div className="flex flex-col items-center mb-2">
                                        {logoDataUrl && (
                                            <img src={logoDataUrl} alt="College Logo" className="w-14 h-14 object-contain mb-1" crossOrigin="anonymous" />
                                        )}
                                        <h1 className="text-base font-black text-maroon uppercase tracking-widest leading-tight">Beautex Technical Training College</h1>
                                        <p className="text-[9px] font-bold text-gray-500 tracking-[0.15em] uppercase italic mt-0.5">"Empowering minds, shaping innovations"</p>
                                    </div>
                                    <div className="w-16 h-px bg-yellow-500 mx-auto mb-2" />
                                    <h2 className="text-sm font-black text-black uppercase tracking-widest">Official Student Performance Statement</h2>

                                    <div className="flex justify-between items-start mt-3 text-left">
                                        <div>
                                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Student Details</p>
                                            <p className="text-sm font-black text-black uppercase">{printingStudentReport.student.name}</p>
                                            <p className="text-[9px] font-bold text-gray-600">Admission No: {printingStudentReport.student.id}</p>
                                            <p className="text-[9px] font-bold text-gray-600">Academic Program: {printingStudentReport.student.course}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Registry Information</p>
                                            <p className="text-[9px] font-bold text-black uppercase">Cycle: 2025/2026 Academic Year</p>
                                            <p className="text-[9px] font-bold text-black uppercase">Printed: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* ── GRADES TABLE ── */}
                                <div className="flex-1 px-1">
                                    <table className="w-full text-left border-collapse mb-4">
                                        <thead>
                                            <tr className="bg-maroon/5 border-b-2 border-maroon">
                                                <th className="py-2 px-2 text-[8px] font-black text-maroon uppercase tracking-wider">Assessment Module</th>
                                                <th className="py-2 px-2 text-[8px] font-black text-maroon uppercase tracking-wider">Period</th>
                                                <th className="py-2 px-2 text-[8px] font-black text-maroon uppercase tracking-wider text-center">Marks</th>
                                                <th className="py-2 px-2 text-[8px] font-black text-maroon uppercase tracking-wider text-center">Score %</th>
                                                <th className="py-2 px-2 text-[8px] font-black text-maroon uppercase tracking-wider">Quality Assessment</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-maroon/10">
                                            {printingStudentReport.grades.map((g, i) => (
                                                <tr key={i}>
                                                    <td className="py-1.5 px-2">
                                                        <p className="text-[10px] font-black text-black uppercase">{g.assignment}</p>
                                                        <p className="text-[8px] font-bold text-gray-400 uppercase">{g.course}</p>
                                                    </td>
                                                    <td className="py-1.5 px-2 text-[10px] font-bold text-gray-600 uppercase italic">{g.month}</td>
                                                    <td className="py-1.5 px-2 text-[10px] font-black text-black text-center">{g.score} / {g.max_score || 100}</td>
                                                    <td className="py-1.5 px-2 text-[10px] font-black text-maroon text-center">{Math.round((g.score / (g.max_score || 100)) * 100)}%</td>
                                                    <td className="py-1.5 px-2 text-[9px] font-medium text-gray-500 italic leading-tight">
                                                        {g.remarks ? `"${g.remarks}"` : 'Progress satisfactory. Competency levels met.'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {/* ── CUMULATIVE SUMMARY ── */}
                                    <div className="grid grid-cols-2 gap-6 bg-gray-50 p-4 rounded-xl border border-gray-100 mb-4">
                                        <div>
                                            <h3 className="text-[8px] font-black text-maroon uppercase tracking-[0.2em] mb-2">Cumulative Summary</h3>
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between items-center text-[10px] border-b border-black/5 pb-1">
                                                    <span className="font-bold text-gray-500 uppercase">Average Percentage</span>
                                                    <span className="font-black text-black">
                                                        {printingStudentReport.grades.length > 0
                                                            ? Math.round((printingStudentReport.grades.reduce((acc, g) => acc + (g.score / (g.max_score || 100)), 0) / printingStudentReport.grades.length) * 100)
                                                            : 0}%
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center text-[10px] border-b border-black/5 pb-1">
                                                    <span className="font-bold text-gray-500 uppercase">Total Assessments</span>
                                                    <span className="font-black text-black">{printingStudentReport.grades.length} Recorded Units</span>
                                                </div>
                                                <div className="flex justify-between items-center text-[10px]">
                                                    <span className="font-bold text-gray-500 uppercase">Overall Standing</span>
                                                    <span className="font-black text-maroon uppercase">
                                                        {(() => {
                                                            const avg = printingStudentReport.grades.length > 0
                                                                ? (printingStudentReport.grades.reduce((acc, g) => acc + (g.score / (g.max_score || 100)), 0) / printingStudentReport.grades.length)
                                                                : 0;
                                                            return avg >= 0.7 ? 'Excellent Performance' : avg >= 0.5 ? 'Good Progress' : 'Conditional Pass';
                                                        })()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col justify-end items-center">
                                            <div className="w-10 h-10 border-2 border-maroon rounded-full flex items-center justify-center mb-3 opacity-20">
                                                <Award className="w-5 h-5 text-maroon" />
                                            </div>
                                            <div className="w-40 border-b border-black mb-1" />
                                            <p className="text-[8px] font-black text-black uppercase tracking-widest">Registrar / Exams Officer</p>
                                            <p className="text-[7px] font-bold text-gray-400 mt-0.5 uppercase">Beautex Training Centre Seal of Authenticity</p>
                                        </div>
                                    </div>
                                </div>

                                {/* ── FOOTER ── always at bottom ── */}
                                <div className="border-t-2 border-maroon/20 pt-3 text-center mt-auto">
                                    <p className="text-[9px] font-black text-maroon uppercase tracking-widest mb-0.5">
                                        Beautex Technical Training College
                                    </p>
                                    <p className="text-[8px] text-gray-400 uppercase tracking-wider leading-relaxed">
                                        Contact: 0708247557 | Email: beautexcollege01@gmail.com<br />
                                        Location: Utawala, Geokarma behind Astrol Petrol Station | www.beautex.ac.ke
                                    </p>
                                    <p className="text-[7px] text-gray-300 uppercase tracking-[0.15em] mt-1">
                                        Verified Registry Document • Beautex College Management System • © {new Date().getFullYear()}
                                    </p>
                                </div>

                            </div>
                        </div>
                    </>
                )}
                {/* Discourse Panel */}
                {discussionEntity && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-end">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-500" onClick={() => setDiscussionEntity(null)}></div>
                        <div className="relative w-full max-w-xl h-full bg-white shadow-2xl animate-in slide-in-from-right duration-500 overflow-y-auto p-8 sm:p-12 custom-scrollbar">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h2 className="text-2xl sm:text-3xl font-black text-maroon uppercase tracking-tight leading-none">{discussionEntity.title}</h2>
                                    <p className="text-[10px] text-maroon/40 font-bold uppercase tracking-[0.3em] mt-3 italic">Registry Discourse Module</p>
                                </div>
                                <button onClick={() => setDiscussionEntity(null)} className="p-3 bg-gray-50 hover:bg-black hover:text-white rounded-2xl transition-all shadow-sm">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <Interactions entityType={discussionEntity.type} entityId={discussionEntity.id} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

