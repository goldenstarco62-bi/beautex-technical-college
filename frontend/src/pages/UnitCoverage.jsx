import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { coursesAPI, unitCoverageAPI, academicAPI, courseUnitsAPI } from '../services/api';
import {
    BookOpen, Search, Plus, X, Edit, Trash2, Users, CheckCircle,
    FileDown, History, ChevronDown, ChevronUp, AlertTriangle, Layers,
    Check, Star, Filter, ArrowUp, ArrowDown, Archive, RefreshCw, BarChart2,
    Calendar, Clock, MessageSquare, Info, Shield
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function UnitCoverage() {
    const { user } = useAuth();
    const isStudent = (user?.role || '').toLowerCase() === 'student';
    const isTeacher = (user?.role || '').toLowerCase() === 'teacher';
    const isAdmin = ['admin', 'superadmin'].includes((user?.role || '').toLowerCase());
    const canManage = ['admin', 'superadmin', 'teacher'].includes((user?.role || '').toLowerCase());

    // ── State ─────────────────────────────────────────────────────────────────
    const [courses, setCourses] = useState([]);
    const [units, setUnits] = useState([]); // units for the selected course
    const [logs, setLogs] = useState([]); // coverage logs
    const [analytics, setAnalytics] = useState([]); // analytics for teacher/admin
    const [adminOverview, setAdminOverview] = useState([]); // admin department/course progress
    const [studentProgress, setStudentProgress] = useState([]); // student course progress
    const [loading, setLoading] = useState(true);
    const [selectedCourse, setSelectedCourse] = useState('');
    const [selectedDept, setSelectedDept] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [activePeriod, setActivePeriod] = useState(null);

    // Toast & Dialog States
    const [toast, setToast] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [duplicateDialog, setDuplicateDialog] = useState(null);

    // Modals
    const [showCoverModal, setShowCoverModal] = useState(false);
    const [showManageUnitsModal, setShowManageUnitsModal] = useState(false);
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);

    // Form States
    const [coverageForm, setCoverageForm] = useState({
        unit_id: '',
        unit_name: '',
        remarks: '',
        material_urls: '',
        description: '',
        expected_duration: '',
        unit_remarks: ''
    });

    const [confirmationForm, setConfirmationForm] = useState({
        coverage_log_id: '',
        response: 'Yes',
        comment: ''
    });

    const [newUnitForm, setNewUnitForm] = useState({
        name: '',
        description: '',
        expected_duration: '',
        unit_remarks: ''
    });

    const [editingUnit, setEditingUnit] = useState(null);

    // Toast helper
    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
    }, []);

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(timer);
    }, [toast]);

    // Dialog helper
    const openConfirm = (message, onConfirm) => {
        setConfirmDialog({ message, onConfirm });
    };

    // Load initial data based on role
    const loadAllData = useCallback(async () => {
        setLoading(true);
        try {
            // Get active academic period
            const periodRes = await academicAPI.getPeriods().catch(() => ({ data: [] }));
            const periods = Array.isArray(periodRes.data) ? periodRes.data : [];
            const active = periods.find(p => p.is_active) || periods[0] || null;
            setActivePeriod(active);

            // Fetch course list
            const coursesRes = await coursesAPI.getAll().catch(() => ({ data: [] }));
            setCourses(coursesRes?.data || []);

            if (isStudent) {
                // Fetch student progress
                const progressRes = await unitCoverageAPI.getStudentProgress().catch(() => ({ data: [] }));
                setStudentProgress(progressRes?.data || []);
            } else if (isAdmin) {
                // Fetch admin overview
                const overviewRes = await unitCoverageAPI.getAdminOverview().catch(() => ({ data: [] }));
                setAdminOverview(overviewRes?.data || []);
                // Fetch analytics & logs
                const analyticsRes = await unitCoverageAPI.getAnalytics().catch(() => ({ data: [] }));
                setAnalytics(analyticsRes?.data || []);
            } else if (isTeacher) {
                // Fetch teacher analytics
                const analyticsRes = await unitCoverageAPI.getAnalytics().catch(() => ({ data: [] }));
                setAnalytics(analyticsRes?.data || []);
            }
        } catch (error) {
            console.error('loadAllData error:', error);
            showToast('Failed to load data', 'error');
        } finally {
            setLoading(false);
        }
    }, [isStudent, isAdmin, isTeacher, showToast]);

    useEffect(() => {
        loadAllData();
    }, [loadAllData]);

    // Fetch units and logs when course changes (for teacher/admin)
    const loadCourseCoverageData = useCallback(async (courseId) => {
        if (!courseId) return;
        try {
            const res = await unitCoverageAPI.getCourseCoverage(courseId);
            setUnits(res.data?.units || []);
        } catch (error) {
            console.error('loadCourseCoverageData error:', error);
            showToast('Failed to load units for this course', 'error');
        }
    }, [showToast]);

    useEffect(() => {
        if (selectedCourse) {
            loadCourseCoverageData(selectedCourse);
        }
    }, [selectedCourse, loadCourseCoverageData]);

    // Reorder course units
    const handleMoveUnit = async (index, direction) => {
        if (!selectedCourse) return;
        const newUnits = [...units];
        const swapWith = direction === 'up' ? index - 1 : index + 1;
        if (swapWith < 0 || swapWith >= newUnits.length) return;

        const temp = newUnits[index];
        newUnits[index] = newUnits[swapWith];
        newUnits[swapWith] = temp;

        const order = newUnits.map((u, i) => ({ id: u.id, sort_order: i }));
        try {
            setUnits(newUnits);
            await courseUnitsAPI.reorderUnits(selectedCourse, order);
            showToast('Unit order updated', 'success');
        } catch (err) {
            console.error(err);
            loadCourseCoverageData(selectedCourse);
        }
    };

    // Add Unit in Manage Modal
    const handleAddUnit = async (e) => {
        e.preventDefault();
        if (!newUnitForm.name.trim() || !selectedCourse) return;
        try {
            await courseUnitsAPI.createUnit(selectedCourse, {
                name: newUnitForm.name.trim(),
                sort_order: units.length
            });
            setNewUnitForm({ name: '', description: '', expected_duration: '', unit_remarks: '' });
            loadCourseCoverageData(selectedCourse);
            showToast('Unit added successfully', 'success');
        } catch (err) {
            console.error(err);
            showToast('Failed to add unit', 'error');
        }
    };

    // Edit unit
    const handleUpdateUnit = async (e) => {
        e.preventDefault();
        if (!editingUnit || !editingUnit.name.trim()) return;
        try {
            await unitCoverageAPI.updateUnit(editingUnit.id, {
                name: editingUnit.name.trim(),
                description: editingUnit.description,
                expected_duration: editingUnit.expected_duration,
                unit_remarks: editingUnit.unit_remarks,
                is_archived: editingUnit.is_archived ? 1 : 0
            });
            setEditingUnit(null);
            loadCourseCoverageData(selectedCourse);
            showToast('Unit updated successfully', 'success');
        } catch (err) {
            console.error(err);
            showToast('Failed to update unit', 'error');
        }
    };

    // Archive unit
    const handleArchiveUnit = async (unitId, name, archiveState) => {
        openConfirm(`${archiveState ? 'Archive' : 'Unarchive'} "${name}"?`, async () => {
            try {
                await unitCoverageAPI.updateUnit(unitId, { is_archived: archiveState ? 1 : 0 });
                loadCourseCoverageData(selectedCourse);
                showToast(`Unit ${archiveState ? 'archived' : 'unarchived'} successfully`, 'success');
            } catch (err) {
                console.error(err);
                showToast('Failed to change archive status', 'error');
            }
        });
    };

    // Submitting unit coverage (✓ Mark as Covered)
    const handleMarkCovered = async (e, forceCreate = false) => {
        if (e) e.preventDefault();
        try {
            const payload = {
                course_id: selectedCourse,
                unit_id: coverageForm.unit_id || null,
                unit_name: coverageForm.unit_name?.trim() || null,
                description: coverageForm.description || null,
                expected_duration: coverageForm.expected_duration || null,
                unit_remarks: coverageForm.unit_remarks || null,
                remarks: coverageForm.remarks || null,
                material_urls: coverageForm.material_urls ? [coverageForm.material_urls] : null,
                force_create: forceCreate
            };

            const res = await unitCoverageAPI.markCovered(payload);
            setShowCoverModal(false);
            setCoverageForm({
                unit_id: '', unit_name: '', remarks: '', material_urls: '',
                description: '', expected_duration: '', unit_remarks: ''
            });
            loadCourseCoverageData(selectedCourse);
            loadAllData();
            showToast('Unit marked as covered successfully', 'success');
        } catch (err) {
            if (err.response && err.response.status === 409) {
                // Duplicate detected
                setDuplicateDialog({
                    message: err.response.data.message || 'A similar unit already exists.',
                    candidates: err.response.data.candidates || [],
                    entered_name: err.response.data.entered_name
                });
            } else {
                console.error(err);
                showToast(err.response?.data?.error || 'Failed to mark unit as covered', 'error');
            }
        }
    };

    // Student Confirmation submit
    const handleConfirmSubmit = async (e) => {
        e.preventDefault();
        try {
            await unitCoverageAPI.submitConfirmation(confirmationForm);
            setShowConfirmationModal(false);
            setConfirmationForm({ coverage_log_id: '', response: 'Yes', comment: '' });
            loadAllData();
            showToast('Confirmation submitted successfully', 'success');
        } catch (err) {
            console.error(err);
            showToast(err.response?.data?.error || 'Failed to submit confirmation', 'error');
        }
    };

    // PDF Report Generator
    const handleDownloadPDF = async () => {
        const element = document.getElementById('coverage-report-view');
        if (!element) return;
        try {
            showToast('Preparing PDF Report...', 'info');
            const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pw = pdf.internal.pageSize.getWidth();
            const ph = pdf.internal.pageSize.getHeight();
            const ratio = canvas.height / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pw, Math.min(pw * ratio, ph));
            pdf.save(`BTC_Unit_Coverage_Report_${new Date().toISOString().split('T')[0]}.pdf`);
            showToast('PDF exported successfully', 'success');
        } catch (err) {
            console.error(err);
            showToast('Failed to export PDF', 'error');
        }
    };

    // CSV Report Generator
    const handleDownloadExcel = () => {
        try {
            let csvContent = "data:text/csv;charset=utf-8,";
            if (isAdmin) {
                csvContent += "Course Name,Department,Total Units,Units Covered,Coverage %,Student Confirmations\n";
                adminOverview.forEach(item => {
                    csvContent += `"${item.course_name}","${item.department}",${item.total_units},${item.covered_units},${item.coverage_pct}%,${item.total_confirmations}\n`;
                });
            } else if (isTeacher) {
                csvContent += "Unit Name,Course Name,Date Covered,Teacher,Yes,Partially,No,Total Confirmations\n";
                analytics.forEach(item => {
                    csvContent += `"${item.unit_name}","${item.course_name}","${item.date_covered}","${item.teacher_name}",${item.yes_count},${item.partially_count},${item.no_count},${item.total_confirmations}\n`;
                });
            }

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `BTC_Coverage_Report_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('CSV report exported successfully', 'success');
        } catch (err) {
            console.error(err);
            showToast('Failed to export report', 'error');
        }
    };

    // Filter overview/analytics by search and department
    const filteredOverview = adminOverview.filter(item => {
        const search = searchTerm.toLowerCase();
        const matchesSearch = !search || item.course_name.toLowerCase().includes(search) || item.department.toLowerCase().includes(search);
        const matchesDept = !selectedDept || item.department.toLowerCase() === selectedDept.toLowerCase();
        return matchesSearch && matchesDept;
    });

    const filteredAnalytics = analytics.filter(item => {
        const search = searchTerm.toLowerCase();
        return !search || item.unit_name.toLowerCase().includes(search) || item.course_name.toLowerCase().includes(search);
    });

    // List departments unique values
    const departmentsList = Array.from(new Set(courses.map(c => c.department).filter(Boolean)));

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-maroon border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-maroon animate-pulse">Loading Coverage Registry...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-10 py-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20 px-4 sm:px-6">

            {/* ── Page Title / Header ─────────────────────────────────────────── */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-black/8 pb-8">
                <div className="space-y-3">
                    <div className="flex items-center gap-4">
                        <div className="p-3.5 bg-gradient-to-br from-maroon to-maroon/80 shadow-2xl shadow-maroon/30 rounded-2xl text-gold">
                            <Layers className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 id="page-title" className="text-3xl sm:text-4xl font-black text-black tracking-tight uppercase leading-none">
                                {isStudent ? 'Course Progress' : 'Unit Coverage Tracker'}
                            </h1>
                            <div className="flex items-center gap-2 mt-1.5">
                                <div className="h-0.5 w-8 bg-gradient-to-r from-maroon to-gold rounded-full" />
                                <p className="text-[10px] text-black/40 font-black tracking-[0.3em] uppercase">
                                    Curriculum Delivery & Confirmation Portal
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <button
                        onClick={loadAllData}
                        id="btn-refresh"
                        className="bg-white text-maroon p-3.5 rounded-2xl hover:bg-maroon hover:text-white transition-all shadow-lg border border-maroon/10 group"
                        title="Refresh data"
                    >
                        <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                    </button>

                    {!isStudent && (
                        <>
                            <button
                                onClick={handleDownloadExcel}
                                id="btn-export-excel"
                                className="bg-white text-maroon px-5 py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:bg-maroon hover:text-white transition-all shadow-lg font-black text-xs uppercase tracking-widest border border-maroon/15"
                            >
                                Export CSV
                            </button>
                            <button
                                onClick={handleDownloadPDF}
                                id="btn-export-pdf"
                                className="bg-gradient-to-r from-maroon to-maroon/90 text-gold px-5 py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:shadow-maroon/30 hover:shadow-xl transition-all hover:scale-[1.02] active:scale-95 font-black text-xs uppercase tracking-widest shadow-lg border border-gold/20"
                            >
                                <FileDown className="w-5 h-5" /> Export PDF
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* ── STUDENT PORTAL VIEW ────────────────────────────────────────── */}
            {isStudent && (
                <div className="space-y-8 animate-in fade-in duration-500">
                    {studentProgress.length === 0 ? (
                        <div className="bg-white p-12 rounded-[2.5rem] border border-black/5 shadow-2xl text-center">
                            <p className="text-[10px] font-black text-black/20 uppercase tracking-[0.3em]">No course progress tracked yet.</p>
                        </div>
                    ) : (
                        studentProgress.map(courseProgress => (
                            <div key={courseProgress.course_id} className="bg-white rounded-[2.5rem] border border-black/5 shadow-2xl overflow-hidden">
                                {/* Course Header Card */}
                                <div className="p-8 border-b border-black/5 bg-gradient-to-r from-maroon/[0.02] to-transparent">
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                        <div>
                                            <h2 className="text-xl sm:text-2xl font-black text-black uppercase tracking-tight">{courseProgress.course_name}</h2>
                                            <p className="text-xs font-bold text-black/30 mt-1 uppercase tracking-widest">Course Code: {courseProgress.course_id}</p>
                                        </div>
                                        <div className="flex items-center gap-4 w-full md:w-auto">
                                            <div className="flex-1 md:w-48">
                                                <div className="flex justify-between items-center mb-1 text-[10px] font-bold text-black/40 uppercase">
                                                    <span>{courseProgress.covered_units} of {courseProgress.total_units} Units Covered</span>
                                                    <span>{courseProgress.completion_pct}%</span>
                                                </div>
                                                <div className="h-2 bg-black/5 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-maroon to-gold rounded-full transition-all duration-1000"
                                                        style={{ width: `${courseProgress.completion_pct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Units List Table */}
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-black/[0.015] border-b border-black/5">
                                                <th className="px-6 py-4 text-left text-[10px] font-black text-black/40 uppercase tracking-widest">Status</th>
                                                <th className="px-6 py-4 text-left text-[10px] font-black text-black/40 uppercase tracking-widest">Unit Name</th>
                                                <th className="px-6 py-4 text-left text-[10px] font-black text-black/40 uppercase tracking-widest">Teacher / Covered On</th>
                                                <th className="px-6 py-4 text-left text-[10px] font-black text-black/40 uppercase tracking-widest">Learning Materials</th>
                                                <th className="px-6 py-4 text-center text-[10px] font-black text-black/40 uppercase tracking-widest">Confirmation</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-black/5">
                                            {courseProgress.units.map(u => (
                                                <tr key={u.id} className="hover:bg-black/[0.005] transition-colors">
                                                    <td className="px-6 py-4">
                                                        {u.is_covered ? (
                                                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 border border-green-200 rounded-full text-green-700 text-[10px] font-black uppercase">
                                                                ✅ Covered
                                                            </span>
                                                        ) : u.is_archived ? (
                                                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-50 border border-gray-200 rounded-full text-gray-400 text-[10px] font-black uppercase">
                                                                ⬜ Archived
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-amber-600 text-[10px] font-black uppercase">
                                                                🟡 In Progress
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <p className="text-xs font-black text-black uppercase tracking-tight">{u.name}</p>
                                                        {u.description && <p className="text-[10px] text-black/40 font-medium mt-0.5">{u.description}</p>}
                                                    </td>
                                                    <td className="px-6 py-4 text-xs font-bold text-black/60">
                                                        {u.is_covered ? (
                                                            <div>
                                                                <p className="font-black text-black uppercase">{u.teacher_name}</p>
                                                                <p className="text-[10px] text-black/30 mt-0.5">{u.date_covered} @ {u.time_covered}</p>
                                                            </div>
                                                        ) : '—'}
                                                    </td>
                                                    <td className="px-6 py-4 text-xs font-bold text-black/60 max-w-[200px] truncate">
                                                        {u.is_covered && u.material_urls ? (
                                                            <div className="flex flex-col gap-1">
                                                                {(() => {
                                                                    try {
                                                                        const urls = JSON.parse(u.material_urls);
                                                                        return urls.map((url, idx) => (
                                                                            <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="text-maroon hover:underline inline-flex items-center gap-1">
                                                                                <BookOpen className="w-3 h-3" /> Material #{idx + 1}
                                                                            </a>
                                                                        ));
                                                                    } catch {
                                                                        return <a href={u.material_urls} target="_blank" rel="noopener noreferrer" className="text-maroon hover:underline inline-flex items-center gap-1">
                                                                            <BookOpen className="w-3 h-3" /> View Material
                                                                        </a>;
                                                                    }
                                                                })()}
                                                            </div>
                                                        ) : '—'}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex justify-center">
                                                            {u.is_covered ? (
                                                                u.student_confirmation ? (
                                                                    <div className="flex flex-col items-center">
                                                                        <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase border
                                                                            ${u.student_confirmation.response === 'Yes' ? 'bg-green-50 border-green-200 text-green-700' : ''}
                                                                            ${u.student_confirmation.response === 'Partially' ? 'bg-amber-50 border-amber-200 text-amber-700' : ''}
                                                                            ${u.student_confirmation.response === 'No' ? 'bg-red-50 border-red-200 text-red-700' : ''}
                                                                        `}>
                                                                            {u.student_confirmation.response}
                                                                        </span>
                                                                        {activePeriod?.is_active && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setConfirmationForm({
                                                                                        coverage_log_id: u.log_id,
                                                                                        response: u.student_confirmation.response,
                                                                                        comment: u.student_confirmation.comment || ''
                                                                                    });
                                                                                    setShowConfirmationModal(true);
                                                                                }}
                                                                                id={`btn-edit-confirm-${u.id}`}
                                                                                className="text-[9px] text-maroon hover:underline mt-1 font-bold uppercase tracking-wider"
                                                                            >
                                                                                Edit
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => {
                                                                            setConfirmationForm({
                                                                                coverage_log_id: u.log_id,
                                                                                response: 'Yes',
                                                                                comment: ''
                                                                            });
                                                                            setShowConfirmationModal(true);
                                                                        }}
                                                                        id={`btn-confirm-${u.id}`}
                                                                        className="bg-maroon hover:bg-maroon/90 text-white px-3.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider shadow-sm transition-all"
                                                                    >
                                                                        Confirm taught?
                                                                    </button>
                                                                )
                                                            ) : '—'}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* ── TEACHER PORTAL VIEW ────────────────────────────────────────── */}
            {isTeacher && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Panel: Course Coverage logs */}
                    <div className="lg:col-span-2 space-y-8 animate-in fade-in duration-500">
                        {/* Course Selector Card */}
                        <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                            <div>
                                <h3 className="text-lg font-black text-black uppercase tracking-tight">Active Coverage Matrix</h3>
                                <p className="text-xs text-black/40 font-bold uppercase mt-1 tracking-wider">Select a course to view curriculum delivery</p>
                            </div>
                            <div className="flex gap-2">
                                <select
                                    value={selectedCourse}
                                    onChange={e => setSelectedCourse(e.target.value)}
                                    id="select-course"
                                    className="px-4 py-3 text-[10px] font-black uppercase tracking-widest outline-none shadow-sm bg-white border border-black/10 text-black rounded-2xl w-full sm:w-64"
                                >
                                    <option value="">Choose Course...</option>
                                    {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>

                                {selectedCourse && (
                                    <button
                                        onClick={() => setShowManageUnitsModal(true)}
                                        id="btn-manage-units"
                                        className="bg-white hover:bg-maroon hover:text-white border border-maroon/20 text-maroon p-3 rounded-2xl transition-all shadow-md"
                                        title="Manage Units"
                                    >
                                        <BookOpen className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {selectedCourse ? (
                            <div className="bg-white rounded-[2.5rem] border border-black/5 shadow-2xl overflow-hidden">
                                <div className="p-8 border-b border-black/5 bg-gradient-to-r from-maroon/[0.01] to-transparent flex justify-between items-center">
                                    <h3 className="text-base font-black text-black uppercase tracking-tight">Curriculum Units</h3>
                                    <button
                                        onClick={() => {
                                            setCoverageForm(prev => ({ ...prev, unit_id: '' }));
                                            setShowCoverModal(true);
                                        }}
                                        id="btn-quick-cover"
                                        className="bg-maroon hover:bg-maroon/90 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md transition-all flex items-center gap-1"
                                    >
                                        <Plus className="w-4 h-4" /> Quick Cover
                                    </button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-black/[0.015] border-b border-black/5">
                                                <th className="px-6 py-4 text-left text-[10px] font-black text-black/40 uppercase tracking-widest">Unit / Topic</th>
                                                <th className="px-6 py-4 text-left text-[10px] font-black text-black/40 uppercase tracking-widest">Duration</th>
                                                <th className="px-6 py-4 text-center text-[10px] font-black text-black/40 uppercase tracking-widest">Status</th>
                                                <th className="px-6 py-4 text-center text-[10px] font-black text-black/40 uppercase tracking-widest">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-black/5">
                                            {units.map((u, index) => (
                                                <tr key={u.id} className="hover:bg-black/[0.005] transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex flex-col">
                                                                <button
                                                                    onClick={() => handleMoveUnit(index, 'up')}
                                                                    disabled={index === 0}
                                                                    className="text-gray-400 hover:text-maroon disabled:opacity-20 disabled:hover:text-gray-400"
                                                                >
                                                                    <ChevronUp className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleMoveUnit(index, 'down')}
                                                                    disabled={index === units.length - 1}
                                                                    className="text-gray-400 hover:text-maroon disabled:opacity-20 disabled:hover:text-gray-400"
                                                                >
                                                                    <ChevronDown className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-black text-black uppercase tracking-tight">{u.name}</p>
                                                                {u.description && <p className="text-[9px] text-black/40 mt-0.5">{u.description}</p>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-xs font-bold text-black/60">
                                                        {u.expected_duration || '—'}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        {u.coverage_log ? (
                                                            <span className="inline-flex px-3 py-1 bg-green-50 border border-green-200 rounded-full text-green-700 text-[10px] font-black uppercase">
                                                                ✅ Covered
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-amber-600 text-[10px] font-black uppercase">
                                                                ⬜ Not Covered
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        {!u.coverage_log ? (
                                                            <button
                                                                onClick={() => {
                                                                    setCoverageForm(prev => ({
                                                                        ...prev,
                                                                        unit_id: String(u.id),
                                                                        unit_name: u.name
                                                                    }));
                                                                    setShowCoverModal(true);
                                                                }}
                                                                id={`btn-mark-covered-${u.id}`}
                                                                className="bg-maroon hover:bg-maroon/90 text-white px-3.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider shadow-sm transition-all"
                                                            >
                                                                ✓ Mark Covered
                                                            </button>
                                                        ) : (
                                                            <span className="text-[10px] text-black/30 font-bold uppercase tracking-wider">
                                                                {u.coverage_log.date_covered}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white p-12 rounded-[2.5rem] border border-black/5 shadow-2xl text-center">
                                <p className="text-[10px] font-black text-black/20 uppercase tracking-[0.3em]">Select a course to view curriculum delivery</p>
                            </div>
                        )}
                    </div>

                    {/* Right Panel: Teacher Analytics & Flags */}
                    <div className="space-y-8 animate-in fade-in duration-500">
                        {/* Course Overview Stats */}
                        {selectedCourse && (
                            <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-2xl space-y-6">
                                <h3 className="text-base font-black text-black uppercase tracking-tight">Course Analytics</h3>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-black/[0.02] p-4 rounded-2xl border border-black/5">
                                        <p className="text-black/40 text-[9px] font-black uppercase tracking-wider">Total Units</p>
                                        <p className="text-3xl font-black text-black mt-1">{units.length}</p>
                                    </div>
                                    <div className="bg-black/[0.02] p-4 rounded-2xl border border-black/5">
                                        <p className="text-black/40 text-[9px] font-black uppercase tracking-wider">Covered</p>
                                        <p className="text-3xl font-black text-green-600 mt-1">
                                            {units.filter(u => u.coverage_log).length}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-[10px] text-black/40 font-bold uppercase tracking-wider">Delivery Progress</p>
                                    <div className="h-3 bg-black/5 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-maroon to-gold rounded-full transition-all duration-1000"
                                            style={{
                                                width: `${units.length > 0
                                                    ? Math.round((units.filter(u => u.coverage_log).length / units.length) * 100)
                                                    : 0}%`
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Student Confirmation Feedback */}
                        <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-2xl space-y-6">
                            <h3 className="text-base font-black text-black uppercase tracking-tight">Student confirmations</h3>

                            <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                                {filteredAnalytics.map((item, idx) => (
                                    <div key={idx} className={`p-4 rounded-2xl border ${item.flagged ? 'bg-red-50/50 border-red-100' : 'bg-black/[0.015] border-black/5'} space-y-3`}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="text-xs font-black text-black uppercase tracking-tight">{item.unit_name}</h4>
                                                <p className="text-[9px] text-black/30 font-bold uppercase">{item.course_name}</p>
                                            </div>
                                            {item.flagged && (
                                                <span className="flex items-center gap-0.5 px-2 py-0.5 bg-red-100 border border-red-200 text-red-700 text-[8px] font-black uppercase rounded-full">
                                                    <AlertTriangle className="w-2.5 h-2.5" /> Flagged
                                                </span>
                                            )}
                                        </div>

                                        {/* Confirmation Bars */}
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-[9px] font-bold text-black/50 uppercase">
                                                <span>Responses: {item.total_confirmations}</span>
                                            </div>
                                            <div className="h-2.5 bg-black/5 rounded-full overflow-hidden flex">
                                                <div className="bg-green-500 h-full" style={{ width: `${item.yes_pct}%` }} title={`Yes: ${item.yes_pct}%`} />
                                                <div className="bg-amber-400 h-full" style={{ width: `${item.partially_pct}%` }} title={`Partially: ${item.partially_pct}%`} />
                                                <div className="bg-red-500 h-full" style={{ width: `${item.no_pct}%` }} title={`No: ${item.no_pct}%`} />
                                            </div>
                                            <div className="flex justify-between text-[8px] font-black uppercase tracking-wider">
                                                <span className="text-green-600">Yes: {item.yes_pct}%</span>
                                                <span className="text-amber-500">Partially: {item.partially_pct}%</span>
                                                <span className="text-red-600">No: {item.no_pct}%</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {filteredAnalytics.length === 0 && (
                                    <p className="text-[10px] text-black/30 text-center font-bold py-6 uppercase tracking-widest">No confirmations recorded yet.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── ADMIN PORTAL VIEW ──────────────────────────────────────────── */}
            {isAdmin && (
                <div id="coverage-report-view" className="space-y-8 animate-in fade-in duration-500">
                    {/* Filter toolbar */}
                    <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h3 className="text-lg font-black text-black uppercase tracking-tight">College-Wide Overview</h3>
                            <p className="text-xs text-black/40 font-bold uppercase mt-1 tracking-wider">Monitor curriculum progress across departments</p>
                        </div>

                        <div className="flex flex-wrap gap-3 items-center">
                            {/* Department filter */}
                            <select
                                value={selectedDept}
                                onChange={e => setSelectedDept(e.target.value)}
                                id="select-dept"
                                className="px-4 py-3 text-[10px] font-black uppercase tracking-widest outline-none shadow-sm bg-white border border-black/10 text-black rounded-2xl min-w-[150px]"
                            >
                                <option value="">All Departments</option>
                                {departmentsList.map(dept => (
                                    <option key={dept} value={dept}>{dept}</option>
                                ))}
                            </select>

                            {/* Search bar */}
                            <div className="flex items-center gap-3 p-2 px-4 shadow-sm min-w-[200px] bg-white border border-black/5 rounded-2xl">
                                <Search className="w-4 h-4 text-gray-300" />
                                <input
                                    type="text"
                                    placeholder="Search course..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="bg-transparent border-none outline-none text-xs font-bold text-black placeholder:text-black/20 uppercase tracking-widest w-full font-sans"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Flagged units warning banner */}
                    {adminOverview.some(c => c.flagged_units?.length > 0) && (
                        <div className="bg-red-50 border border-red-200 rounded-3xl p-6 flex items-start gap-4 text-red-950">
                            <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-sm font-black uppercase tracking-wider">Attention: Curriculum Delivery Reviews Needed</h4>
                                <p className="text-xs font-bold mt-1 text-red-800">
                                    A significant number of students have reported "No" or "Partially" taught on several units. Review is highly recommended.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Overview Table */}
                    <div className="bg-white rounded-[2.5rem] border border-black/5 shadow-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-maroon/[0.03] border-b border-black/5">
                                        <th className="px-6 py-5 text-left text-[10px] font-black text-black/40 uppercase tracking-[0.2em]">Course Name</th>
                                        <th className="px-6 py-5 text-left text-[10px] font-black text-black/40 uppercase tracking-[0.2em]">Department</th>
                                        <th className="px-6 py-5 text-center text-[10px] font-black text-black/40 uppercase tracking-[0.2em]">Covered Progress</th>
                                        <th className="px-6 py-5 text-center text-[10px] font-black text-black/40 uppercase tracking-[0.2em]">Coverage %</th>
                                        <th className="px-6 py-5 text-center text-[10px] font-black text-black/40 uppercase tracking-[0.2em]">Total Confirmations</th>
                                        <th className="px-6 py-5 text-center text-[10px] font-black text-black/40 uppercase tracking-[0.2em]">Review Flags</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-black/5 bg-white">
                                    {filteredOverview.map(row => (
                                        <tr key={row.course_id} className="hover:bg-maroon/[0.015] transition-colors">
                                            <td className="px-6 py-5">
                                                <p className="text-sm font-black text-black uppercase tracking-tight">{row.course_name}</p>
                                                <p className="text-[8px] font-bold text-black/30 mt-0.5">ID: {row.course_id}</p>
                                            </td>
                                            <td className="px-6 py-5 text-xs font-black text-maroon uppercase tracking-tight">
                                                {row.department}
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col items-center max-w-[150px] mx-auto">
                                                    <span className="text-[10px] font-bold text-black/50 mb-1">{row.covered_units} of {row.total_units} Units</span>
                                                    <div className="h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
                                                        <div className="bg-maroon h-full" style={{ width: `${row.coverage_pct}%` }} />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-center text-sm font-black text-black">
                                                {row.coverage_pct}%
                                            </td>
                                            <td className="px-6 py-5 text-center text-xs font-black text-black/60">
                                                {row.total_confirmations} submissions
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex justify-center">
                                                    {row.flagged_units?.length > 0 ? (
                                                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 border border-red-200 text-red-700 text-[9px] font-black uppercase rounded-full animate-pulse">
                                                            <AlertTriangle className="w-3 h-3" /> {row.flagged_units.length} Flagged
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 border border-green-200 text-green-700 text-[9px] font-black uppercase rounded-full">
                                                            ✅ Normal
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}

                                    {filteredOverview.length === 0 && (
                                        <tr>
                                            <td colSpan="6" className="py-12 text-center text-[10px] font-black text-black/20 uppercase tracking-[0.3em]">
                                                No overview entries matches criteria.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL: MARK AS COVERED (✓ Mark as Covered) ────────────────── */}
            {showCoverModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] border border-black/5 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-300">
                        <div className="p-8 border-b border-black/5 bg-gradient-to-r from-maroon/[0.02] to-transparent flex justify-between items-center">
                            <h3 className="text-lg font-black text-maroon uppercase tracking-tight">✓ Mark Unit as Covered</h3>
                            <button onClick={() => setShowCoverModal(false)} className="text-gray-400 hover:text-black"><X className="w-6 h-6" /></button>
                        </div>

                        <form onSubmit={handleMarkCovered} className="p-8 space-y-6">
                            {/* Auto-create unit option / Name entry */}
                            {!coverageForm.unit_id ? (
                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-black/40 font-black uppercase tracking-wider">New Unit Name *</label>
                                    <input
                                        type="text"
                                        required
                                        value={coverageForm.unit_name}
                                        onChange={e => setCoverageForm(prev => ({ ...prev, unit_name: e.target.value }))}
                                        placeholder="E.g. Microsoft Excel"
                                        id="input-unit-name"
                                        className="w-full p-4 bg-black/[0.02] border border-black/10 rounded-2xl text-xs font-black uppercase tracking-widest outline-none focus:border-maroon transition-all"
                                    />
                                    <p className="text-[9px] text-black/30 font-bold uppercase">If this unit doesn't exist, it will be automatically created under the course.</p>
                                </div>
                            ) : (
                                <div className="space-y-1.5 bg-maroon/5 p-4 rounded-2xl border border-maroon/10">
                                    <p className="text-[10px] text-maroon font-black uppercase tracking-wider">Selected Unit</p>
                                    <p className="text-xs font-black text-black uppercase mt-1">{coverageForm.unit_name}</p>
                                </div>
                            )}

                            {/* Optional fields for auto-created units */}
                            {!coverageForm.unit_id && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] text-black/40 font-black uppercase tracking-wider">Expected Duration</label>
                                        <input
                                            type="text"
                                            value={coverageForm.expected_duration}
                                            onChange={e => setCoverageForm(prev => ({ ...prev, expected_duration: e.target.value }))}
                                            placeholder="E.g. 10 Hours"
                                            id="input-unit-duration"
                                            className="w-full p-4 bg-black/[0.02] border border-black/10 rounded-2xl text-xs font-black uppercase tracking-widest outline-none focus:border-maroon transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] text-black/40 font-black uppercase tracking-wider">Unit Remarks</label>
                                        <input
                                            type="text"
                                            value={coverageForm.unit_remarks}
                                            onChange={e => setCoverageForm(prev => ({ ...prev, unit_remarks: e.target.value }))}
                                            placeholder="E.g. Core module"
                                            id="input-unit-remarks"
                                            className="w-full p-4 bg-black/[0.02] border border-black/10 rounded-2xl text-xs font-black uppercase tracking-widest outline-none focus:border-maroon transition-all"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-[10px] text-black/40 font-black uppercase tracking-wider">Coverage Remarks (Optional)</label>
                                <textarea
                                    value={coverageForm.remarks}
                                    onChange={e => setCoverageForm(prev => ({ ...prev, remarks: e.target.value }))}
                                    placeholder="E.g. Class successfully completed theory and practical tests."
                                    id="textarea-coverage-remarks"
                                    className="w-full p-4 bg-black/[0.02] border border-black/10 rounded-2xl text-xs font-bold outline-none focus:border-maroon transition-all h-24"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] text-black/40 font-black uppercase tracking-wider">Supporting Material URL (Optional)</label>
                                <input
                                    type="url"
                                    value={coverageForm.material_urls}
                                    onChange={e => setCoverageForm(prev => ({ ...prev, material_urls: e.target.value }))}
                                    placeholder="E.g. https://drive.google.com/..."
                                    id="input-material-url"
                                    className="w-full p-4 bg-black/[0.02] border border-black/10 rounded-2xl text-xs font-bold outline-none focus:border-maroon transition-all"
                                />
                            </div>

                            <div className="flex gap-4 pt-4 border-t border-black/5">
                                <button
                                    type="button"
                                    onClick={() => setShowCoverModal(false)}
                                    id="btn-close-cover"
                                    className="flex-1 py-4 bg-black/[0.05] hover:bg-black/[0.08] text-black text-xs font-black uppercase tracking-widest rounded-2xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    id="btn-submit-cover"
                                    className="flex-1 py-4 bg-maroon hover:bg-maroon/90 text-gold text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg transition-all"
                                >
                                    Mark as Covered
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── MODAL: MANAGE UNITS ────────────────────────────────────────── */}
            {showManageUnitsModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] border border-black/5 shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-300">
                        <div className="p-8 border-b border-black/5 bg-gradient-to-r from-maroon/[0.02] to-transparent flex justify-between items-center">
                            <h3 className="text-lg font-black text-maroon uppercase tracking-tight">Manage Curriculum Units</h3>
                            <button onClick={() => setShowManageUnitsModal(false)} className="text-gray-400 hover:text-black"><X className="w-6 h-6" /></button>
                        </div>

                        <div className="p-8 space-y-6">
                            {/* Add unit form */}
                            {!editingUnit ? (
                                <form onSubmit={handleAddUnit} className="flex gap-2 items-end">
                                    <div className="flex-1 space-y-1">
                                        <label className="text-[9px] text-black/40 font-black uppercase tracking-wider">Unit / Topic Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={newUnitForm.name}
                                            onChange={e => setNewUnitForm(prev => ({ ...prev, name: e.target.value }))}
                                            placeholder="E.g. Advanced Excel Formatting"
                                            id="input-new-unit"
                                            className="w-full p-3.5 bg-black/[0.02] border border-black/10 rounded-2xl text-xs font-black uppercase tracking-widest outline-none focus:border-maroon transition-all"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        id="btn-add-unit"
                                        className="bg-maroon hover:bg-maroon/90 text-gold px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all"
                                    >
                                        Add
                                    </button>
                                </form>
                            ) : (
                                <form onSubmit={handleUpdateUnit} className="bg-black/[0.015] p-6 rounded-3xl border border-black/5 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h4 className="text-xs font-black uppercase text-maroon tracking-wider">Edit Unit Metadata</h4>
                                        <button type="button" onClick={() => setEditingUnit(null)} className="text-xs text-black/40 hover:text-black font-black uppercase">Cancel</button>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] text-black/40 font-black uppercase tracking-wider">Unit Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={editingUnit.name}
                                            onChange={e => setEditingUnit(prev => ({ ...prev, name: e.target.value }))}
                                            id="edit-unit-name"
                                            className="w-full p-3.5 bg-white border border-black/10 rounded-2xl text-xs font-black uppercase tracking-widest outline-none"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] text-black/40 font-black uppercase tracking-wider">Expected Duration</label>
                                            <input
                                                type="text"
                                                value={editingUnit.expected_duration || ''}
                                                onChange={e => setEditingUnit(prev => ({ ...prev, expected_duration: e.target.value }))}
                                                id="edit-unit-duration"
                                                className="w-full p-3.5 bg-white border border-black/10 rounded-2xl text-xs font-black uppercase tracking-widest outline-none"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] text-black/40 font-black uppercase tracking-wider">Remarks</label>
                                            <input
                                                type="text"
                                                value={editingUnit.unit_remarks || ''}
                                                onChange={e => setEditingUnit(prev => ({ ...prev, unit_remarks: e.target.value }))}
                                                id="edit-unit-remarks"
                                                className="w-full p-3.5 bg-white border border-black/10 rounded-2xl text-xs font-black uppercase tracking-widest outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] text-black/40 font-black uppercase tracking-wider">Description</label>
                                        <textarea
                                            value={editingUnit.description || ''}
                                            onChange={e => setEditingUnit(prev => ({ ...prev, description: e.target.value }))}
                                            id="edit-unit-desc"
                                            className="w-full p-3.5 bg-white border border-black/10 rounded-2xl text-xs font-bold outline-none h-16"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        id="btn-save-unit"
                                        className="w-full bg-maroon hover:bg-maroon/90 text-gold py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all"
                                    >
                                        Save Changes
                                    </button>
                                </form>
                            )}

                            {/* Units Registry list */}
                            <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-2 pr-1">
                                {units.map((u, index) => (
                                    <div key={u.id} className="p-4 bg-black/[0.015] border border-black/5 rounded-2xl flex items-center justify-between gap-4">
                                        <div>
                                            <span className="text-[9px] font-black text-black/30 uppercase tracking-widest">Order: {index + 1}</span>
                                            <p className="text-xs font-black text-black uppercase mt-0.5">{u.name}</p>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            {!u.coverage_log && (
                                                <button
                                                    onClick={() => setEditingUnit(u)}
                                                    id={`btn-edit-unit-modal-${u.id}`}
                                                    className="p-2 hover:bg-black/5 rounded-lg text-gray-500 hover:text-black"
                                                >
                                                    <Edit className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleArchiveUnit(u.id, u.name, !u.is_archived)}
                                                id={`btn-archive-unit-modal-${u.id}`}
                                                className={`p-2 hover:bg-black/5 rounded-lg ${u.is_archived ? 'text-green-600' : 'text-gray-400 hover:text-red-500'}`}
                                                title={u.is_archived ? 'Unarchive' : 'Archive'}
                                            >
                                                <Archive className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL: CONFIRMATION (Student confirmation Yes/Partially/No) ──── */}
            {showConfirmationModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] border border-black/5 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300">
                        <div className="p-8 border-b border-black/5 bg-gradient-to-r from-maroon/[0.02] to-transparent flex justify-between items-center">
                            <h3 className="text-lg font-black text-maroon uppercase tracking-tight">Student Confirmation</h3>
                            <button onClick={() => setShowConfirmationModal(false)} className="text-gray-400 hover:text-black"><X className="w-6 h-6" /></button>
                        </div>

                        <form onSubmit={handleConfirmSubmit} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] text-black/40 font-black uppercase tracking-wider">Was this unit fully taught? *</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['Yes', 'Partially', 'No'].map(opt => (
                                        <button
                                            key={opt}
                                            type="button"
                                            onClick={() => setConfirmationForm(prev => ({ ...prev, response: opt }))}
                                            id={`btn-opt-${opt.toLowerCase()}`}
                                            className={`py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest border transition-all
                                                ${confirmationForm.response === opt
                                                    ? 'bg-maroon text-gold border-maroon shadow-md'
                                                    : 'bg-black/[0.02] border-black/10 text-black hover:bg-black/[0.04]'
                                                }
                                            `}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] text-black/40 font-black uppercase tracking-wider">Optional Comment</label>
                                <textarea
                                    value={confirmationForm.comment}
                                    onChange={e => setConfirmationForm(prev => ({ ...prev, comment: e.target.value }))}
                                    placeholder="Write any thoughts, queries or observations here..."
                                    id="textarea-confirm-comment"
                                    className="w-full p-4 bg-black/[0.02] border border-black/10 rounded-2xl text-xs font-bold outline-none focus:border-maroon transition-all h-24"
                                />
                            </div>

                            <div className="flex gap-4 pt-4 border-t border-black/5">
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmationModal(false)}
                                    id="btn-close-confirm"
                                    className="flex-1 py-4 bg-black/[0.05] hover:bg-black/[0.08] text-black text-xs font-black uppercase tracking-widest rounded-2xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    id="btn-submit-confirm"
                                    className="flex-1 py-4 bg-maroon hover:bg-maroon/90 text-gold text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg transition-all"
                                >
                                    Submit
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── CUSTOM DUPLICATE DETECTION DIALOG ──────────────────────────── */}
            {duplicateDialog && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1050] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] border border-black/5 shadow-2xl w-full max-w-md overflow-hidden p-8 space-y-6 animate-in zoom-in duration-300">
                        <div className="flex items-center gap-3 text-amber-600">
                            <AlertTriangle className="w-8 h-8 shrink-0" />
                            <h3 className="text-lg font-black uppercase tracking-tight">Similar unit detected</h3>
                        </div>

                        <div className="space-y-4">
                            <p className="text-xs font-bold text-black/60">
                                You entered <strong className="text-black uppercase">"{duplicateDialog.entered_name}"</strong>. A similar unit already exists in this course:
                            </p>
                            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl">
                                {duplicateDialog.candidates.map(candidate => (
                                    <div key={candidate.id} className="text-xs font-black uppercase text-amber-950">
                                        — {candidate.name}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={() => {
                                    // Use Existing Unit
                                    const candidate = duplicateDialog.candidates[0];
                                    setCoverageForm(prev => ({
                                        ...prev,
                                        unit_id: String(candidate.id),
                                        unit_name: candidate.name
                                    }));
                                    setDuplicateDialog(null);
                                    // Give state a small fraction to process unit_id
                                    setTimeout(() => handleMarkCovered(null, false), 100);
                                }}
                                id="btn-use-existing"
                                className="flex-1 py-3.5 bg-black/[0.05] hover:bg-black/[0.08] text-black text-xs font-black uppercase tracking-widest rounded-2xl transition-all"
                            >
                                Use Existing Unit
                            </button>
                            <button
                                onClick={() => {
                                    // Create New Unit (Force Create)
                                    setDuplicateDialog(null);
                                    handleMarkCovered(null, true);
                                }}
                                id="btn-create-new-unit"
                                className="flex-1 py-3.5 bg-maroon hover:bg-maroon/90 text-gold text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg transition-all"
                            >
                                Create New Unit
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── CUSTOM CONFIRM DIALOG ─────────────────────────────────────── */}
            {confirmDialog && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1050] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] border border-black/5 shadow-2xl w-full max-w-sm overflow-hidden p-8 space-y-6 animate-in zoom-in duration-300">
                        <p className="text-sm font-black text-black uppercase tracking-tight">{confirmDialog.message}</p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setConfirmDialog(null)}
                                id="btn-confirm-cancel"
                                className="flex-grow py-3.5 bg-black/[0.05] hover:bg-black/[0.08] text-black text-xs font-black uppercase tracking-widest rounded-2xl transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    confirmDialog.onConfirm();
                                    setConfirmDialog(null);
                                }}
                                id="btn-confirm-confirm"
                                className="flex-grow py-3.5 bg-maroon hover:bg-maroon/90 text-gold text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg transition-all"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Toast Notifications ────────────────────────────────────────── */}
            {toast && (
                <div className="fixed bottom-8 right-8 z-[9999] animate-in slide-in-from-bottom-5 duration-500">
                    <div className={`px-6 py-4 rounded-2xl border shadow-2xl flex items-center gap-3 font-black text-xs uppercase tracking-widest
                        ${toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : ''}
                        ${toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : ''}
                        ${toast.type === 'info' ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}
                    `}>
                        {toast.type === 'success' && <Check className="w-5 h-5" />}
                        {toast.type === 'error' && <AlertTriangle className="w-5 h-5" />}
                        {toast.type === 'info' && <Info className="w-5 h-5" />}
                        <span>{toast.message}</span>
                    </div>
                </div>
            )}

        </div>
    );
}
