import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { coursesAPI, unitCoverageAPI, academicAPI, courseUnitsAPI } from '../services/api';
import {
    BookOpen, Search, Plus, X, Edit, Trash2, Users, CheckCircle,
    FileDown, ChevronDown, ChevronUp, AlertTriangle, Layers,
    Check, Filter, Archive, RefreshCw, BarChart2,
    Clock, MessageSquare, Shield, UserCheck, UserX, ChevronRight,
    CheckSquare, Square, MinusSquare, Eye, Trash
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function UnitCoverage() {
    const { user } = useAuth();
    const isStudent = (user?.role || '').toLowerCase() === 'student';
    const isTeacher = (user?.role || '').toLowerCase() === 'teacher';
    const isAdmin = ['admin', 'superadmin'].includes((user?.role || '').toLowerCase());

    // ── Core State ────────────────────────────────────────────────────────────
    const [courses, setCourses] = useState([]);
    const [units, setUnits] = useState([]);
    const [enrolledStudents, setEnrolledStudents] = useState([]);
    const [analytics, setAnalytics] = useState([]);
    const [adminOverview, setAdminOverview] = useState([]);
    const [studentProgress, setStudentProgress] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCourse, setSelectedCourse] = useState('');
    const [activePeriod, setActivePeriod] = useState(null);

    // ── Teacher UI State ──────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState('students'); // 'students' | 'units' | 'analytics'
    const [selectedStudentId, setSelectedStudentId] = useState(null); // expanded student drawer
    const [studentUnitView, setStudentUnitView] = useState([]); // units for the selected student
    const [studentUnitLoading, setStudentUnitLoading] = useState(false);
    const [intakeFilter, setIntakeFilter] = useState('all');
    const [studentSearch, setStudentSearch] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDept, setSelectedDept] = useState('');

    // ── Batch Mark State ──────────────────────────────────────────────────────
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [batchUnit, setBatchUnit] = useState(null); // unit being batch-marked
    const [batchSelectedStudents, setBatchSelectedStudents] = useState(new Set());
    const [batchIntakeFilter, setBatchIntakeFilter] = useState('all');
    const [batchForm, setBatchForm] = useState({ remarks: '', material_urls: '' });
    const [batchLoading, setBatchLoading] = useState(false);

    // ── Modals ────────────────────────────────────────────────────────────────
    const [showManageUnitsModal, setShowManageUnitsModal] = useState(false);
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [duplicateDialog, setDuplicateDialog] = useState(null);

    // ── Form State ────────────────────────────────────────────────────────────
    const [confirmationForm, setConfirmationForm] = useState({ coverage_log_id: '', response: 'Yes', comment: '' });
    const [newUnitForm, setNewUnitForm] = useState({ name: '', description: '', expected_duration: '', unit_remarks: '' });
    const [editingUnit, setEditingUnit] = useState(null);

    // ── Toast ─────────────────────────────────────────────────────────────────
    const [toast, setToast] = useState(null);
    const showToast = useCallback((message, type = 'success') => setToast({ message, type }), []);
    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(t);
    }, [toast]);

    const openConfirm = (message, onConfirm) => setConfirmDialog({ message, onConfirm });

    // ── Computed helpers ──────────────────────────────────────────────────────
    const intakeList = useMemo(() => {
        const intakes = [...new Set(enrolledStudents.map(s => s.intake || 'Unknown'))].sort();
        return intakes;
    }, [enrolledStudents]);

    const filteredStudents = useMemo(() => {
        return enrolledStudents.filter(s => {
            const matchIntake = intakeFilter === 'all' || (s.intake || 'Unknown') === intakeFilter;
            const matchSearch = !studentSearch || s.name.toLowerCase().includes(studentSearch.toLowerCase());
            return matchIntake && matchSearch;
        });
    }, [enrolledStudents, intakeFilter, studentSearch]);

    const batchFilteredStudents = useMemo(() => {
        return enrolledStudents.filter(s => {
            return batchIntakeFilter === 'all' || (s.intake || 'Unknown') === batchIntakeFilter;
        });
    }, [enrolledStudents, batchIntakeFilter]);

    // ── Data Loading ──────────────────────────────────────────────────────────
    const loadAllData = useCallback(async () => {
        setLoading(true);
        try {
            const periodRes = await academicAPI.getPeriods().catch(() => ({ data: [] }));
            const periods = Array.isArray(periodRes.data) ? periodRes.data : [];
            setActivePeriod(periods.find(p => p.is_active) || periods[0] || null);

            const coursesRes = await coursesAPI.getAll().catch(() => ({ data: [] }));
            setCourses(coursesRes?.data || []);

            if (isStudent) {
                const progressRes = await unitCoverageAPI.getStudentProgress().catch(() => ({ data: [] }));
                setStudentProgress(progressRes?.data || []);
            } else if (isAdmin) {
                const overviewRes = await unitCoverageAPI.getAdminOverview().catch(() => ({ data: [] }));
                setAdminOverview(overviewRes?.data || []);
                const analyticsRes = await unitCoverageAPI.getAnalytics().catch(() => ({ data: [] }));
                setAnalytics(analyticsRes?.data || []);
            } else if (isTeacher) {
                const analyticsRes = await unitCoverageAPI.getAnalytics().catch(() => ({ data: [] }));
                setAnalytics(analyticsRes?.data || []);
            }
        } catch (e) {
            console.error('loadAllData error:', e);
            showToast('Failed to load data', 'error');
        } finally {
            setLoading(false);
        }
    }, [isStudent, isAdmin, isTeacher, showToast]);

    useEffect(() => { loadAllData(); }, [loadAllData]);

    const loadCourseCoverageData = useCallback(async (courseId) => {
        if (!courseId) return;
        try {
            const res = await unitCoverageAPI.getCourseCoverage(courseId);
            setUnits(res.data?.units || []);
            setEnrolledStudents(res.data?.students || []);
        } catch (e) {
            console.error('loadCourseCoverageData error:', e);
            showToast('Failed to load units for this course', 'error');
        }
    }, [showToast]);

    useEffect(() => {
        if (selectedCourse) {
            setSelectedStudentId(null);
            setStudentUnitView([]);
            setIntakeFilter('all');
            setStudentSearch('');
            loadCourseCoverageData(selectedCourse);
        }
    }, [selectedCourse, loadCourseCoverageData]);

    // ── Load specific student's unit view ─────────────────────────────────────
    const loadStudentUnitView = useCallback(async (studentId) => {
        if (!selectedCourse || !studentId) return;
        setStudentUnitLoading(true);
        try {
            const res = await unitCoverageAPI.getCourseCoverage(selectedCourse, { student_id: studentId });
            setStudentUnitView(res.data?.units || []);
        } catch (e) {
            console.error('loadStudentUnitView error:', e);
            showToast('Failed to load student unit progress', 'error');
        } finally {
            setStudentUnitLoading(false);
        }
    }, [selectedCourse, showToast]);

    // ── Mark unit covered for a single student directly from their drawer ─────
    const handleMarkForStudent = async (unit, studentId) => {
        const student = enrolledStudents.find(s => s.id === studentId);
        if (!student) return;
        try {
            await unitCoverageAPI.markCovered({
                course_id: selectedCourse,
                unit_id: String(unit.id),
                student_ids: [studentId],
            });
            showToast(`"${unit.name}" marked covered for ${student.name}`, 'success');
            loadStudentUnitView(studentId);
            loadCourseCoverageData(selectedCourse);
        } catch (err) {
            if (err.response?.status === 409) {
                setDuplicateDialog({
                    message: err.response.data.message,
                    candidates: err.response.data.candidates || [],
                    entered_name: err.response.data.entered_name,
                    pendingStudentIds: [studentId],
                });
            } else {
                showToast(err.response?.data?.error || 'Failed to mark unit', 'error');
            }
        }
    };

    // ── Unmark (delete log) for a single student ──────────────────────────────
    const handleUnmarkForStudent = (unit, studentId) => {
        const student = enrolledStudents.find(s => s.id === studentId);
        openConfirm(`Unmark "${unit.name}" for ${student?.name}?`, async () => {
            try {
                // The student unit view has the log object with its ID
                const unitInView = studentUnitView.find(u => u.id === unit.id);
                if (unitInView?.coverage_log?.id) {
                    await unitCoverageAPI.deleteLog(unitInView.coverage_log.id);
                    showToast('Coverage unmarkd successfully', 'success');
                    loadStudentUnitView(studentId);
                    loadCourseCoverageData(selectedCourse);
                }
            } catch (e) {
                showToast('Failed to unmark coverage', 'error');
            }
        });
    };

    // ── Batch Mark ────────────────────────────────────────────────────────────
    const handleOpenBatchModal = (unit) => {
        setBatchUnit(unit);
        // Pre-select all students who haven't covered this unit yet
        const uncoveredStudentIds = new Set(
            enrolledStudents
                .filter(s => {
                    const covered = (enrolledStudents.find(es => es.id === s.id)?.covered_units || 0);
                    return true; // We'll let backend handle duplicate checks
                })
                .map(s => s.id)
        );
        setBatchSelectedStudents(uncoveredStudentIds);
        setBatchIntakeFilter('all');
        setBatchForm({ remarks: '', material_urls: '' });
        setShowBatchModal(true);
    };

    const toggleBatchStudent = (studentId) => {
        setBatchSelectedStudents(prev => {
            const next = new Set(prev);
            if (next.has(studentId)) next.delete(studentId);
            else next.add(studentId);
            return next;
        });
    };

    const toggleBatchAll = () => {
        const visible = batchFilteredStudents.map(s => s.id);
        const allSelected = visible.every(id => batchSelectedStudents.has(id));
        setBatchSelectedStudents(prev => {
            const next = new Set(prev);
            if (allSelected) visible.forEach(id => next.delete(id));
            else visible.forEach(id => next.add(id));
            return next;
        });
    };

    const handleBatchMark = async (e) => {
        e.preventDefault();
        if (!batchUnit || batchSelectedStudents.size === 0) return;
        setBatchLoading(true);
        try {
            const res = await unitCoverageAPI.markCovered({
                course_id: selectedCourse,
                unit_id: String(batchUnit.id),
                student_ids: [...batchSelectedStudents],
                remarks: batchForm.remarks || null,
                material_urls: batchForm.material_urls ? [batchForm.material_urls] : null,
            });
            const data = res.data;
            showToast(`Marked for ${data.marked?.length || 0} student(s). ${data.skipped?.length || 0} skipped.`, 'success');
            setShowBatchModal(false);
            setBatchUnit(null);
            loadCourseCoverageData(selectedCourse);
            if (selectedStudentId) loadStudentUnitView(selectedStudentId);
        } catch (err) {
            if (err.response?.status === 409) {
                setDuplicateDialog({
                    message: err.response.data.message,
                    candidates: err.response.data.candidates || [],
                    entered_name: err.response.data.entered_name,
                    pendingStudentIds: [...batchSelectedStudents],
                });
                setShowBatchModal(false);
            } else {
                showToast(err.response?.data?.error || 'Failed to batch mark', 'error');
            }
        } finally {
            setBatchLoading(false);
        }
    };

    // ── Manage Units ──────────────────────────────────────────────────────────
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

    const handleAddUnit = async (e) => {
        e.preventDefault();
        if (!newUnitForm.name.trim() || !selectedCourse) return;
        try {
            await courseUnitsAPI.createUnit(selectedCourse, { name: newUnitForm.name.trim(), sort_order: units.length });
            setNewUnitForm({ name: '', description: '', expected_duration: '', unit_remarks: '' });
            loadCourseCoverageData(selectedCourse);
            showToast('Unit added successfully', 'success');
        } catch (err) {
            showToast('Failed to add unit', 'error');
        }
    };

    const handleUpdateUnit = async (e) => {
        e.preventDefault();
        if (!editingUnit || !editingUnit.name.trim()) return;
        try {
            await unitCoverageAPI.updateUnit(editingUnit.id, {
                name: editingUnit.name.trim(),
                description: editingUnit.description,
                expected_duration: editingUnit.expected_duration,
                unit_remarks: editingUnit.unit_remarks,
                is_archived: editingUnit.is_archived ? true : false
            });
            setEditingUnit(null);
            loadCourseCoverageData(selectedCourse);
            showToast('Unit updated', 'success');
        } catch (err) {
            showToast('Failed to update unit', 'error');
        }
    };

    const handleArchiveUnit = (unitId, name, archiveState) => {
        openConfirm(`${archiveState ? 'Archive' : 'Unarchive'} "${name}"?`, async () => {
            try {
                await unitCoverageAPI.updateUnit(unitId, { is_archived: archiveState ? true : false });
                loadCourseCoverageData(selectedCourse);
                showToast(`Unit ${archiveState ? 'archived' : 'unarchived'}`, 'success');
            } catch (err) {
                showToast('Failed to change archive status', 'error');
            }
        });
    };

    // ── Student Confirmation ──────────────────────────────────────────────────
    const handleConfirmSubmit = async (e) => {
        e.preventDefault();
        try {
            await unitCoverageAPI.submitConfirmation(confirmationForm);
            setShowConfirmationModal(false);
            setConfirmationForm({ coverage_log_id: '', response: 'Yes', comment: '' });
            loadAllData();
            showToast('Confirmation submitted', 'success');
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to submit confirmation', 'error');
        }
    };

    // ── PDF / CSV Export ──────────────────────────────────────────────────────
    const handleDownloadPDF = async () => {
        const element = document.getElementById('coverage-report-view');
        if (!element) return;
        try {
            showToast('Preparing PDF...', 'info');
            const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pw = pdf.internal.pageSize.getWidth();
            const ph = pdf.internal.pageSize.getHeight();
            const ratio = canvas.height / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pw, Math.min(pw * ratio, ph));
            pdf.save(`BTC_Unit_Coverage_Report_${new Date().toISOString().split('T')[0]}.pdf`);
            showToast('PDF exported', 'success');
        } catch (err) {
            showToast('Failed to export PDF', 'error');
        }
    };

    const handleDownloadCSV = () => {
        try {
            let csv = 'data:text/csv;charset=utf-8,';
            if (isAdmin) {
                csv += 'Course,Department,Total Units,Enrolled Students,Students w/ Coverage,Confirmations\n';
                adminOverview.forEach(item => {
                    csv += `"${item.course_name}","${item.department}",${item.total_units},${item.enrolled_students},${item.students_with_coverage},${item.total_confirmations}\n`;
                });
            } else if (isTeacher && selectedCourse) {
                csv += 'Student Name,Intake,Covered Units,Total Units,Completion %\n';
                enrolledStudents.forEach(s => {
                    csv += `"${s.name}","${s.intake || '—'}",${s.covered_units},${s.total_units},${s.completion_pct}%\n`;
                });
            }
            const link = document.createElement('a');
            link.setAttribute('href', encodeURI(csv));
            link.setAttribute('download', `BTC_Coverage_Report_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('CSV exported', 'success');
        } catch (err) {
            showToast('Failed to export CSV', 'error');
        }
    };

    const departmentsList = useMemo(() => [...new Set(courses.map(c => c.department).filter(Boolean))], [courses]);

    // ── Loading Spinner ───────────────────────────────────────────────────────
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
        <div className="max-w-7xl mx-auto space-y-8 py-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 px-4 sm:px-6">

            {/* ── Toast ──────────────────────────────────────────────────────── */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-[9999] px-5 py-4 rounded-2xl shadow-2xl text-white text-sm font-black uppercase tracking-wider flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300 ${
                    toast.type === 'error' ? 'bg-red-600' : toast.type === 'info' ? 'bg-blue-600' : 'bg-green-600'
                }`}>
                    {toast.type === 'error' ? <AlertTriangle className="w-5 h-5" /> : <Check className="w-5 h-5" />}
                    {toast.message}
                </div>
            )}

            {/* ── Confirm Dialog ─────────────────────────────────────────────── */}
            {confirmDialog && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl">
                        <p className="text-sm font-bold text-black mb-6">{confirmDialog.message}</p>
                        <div className="flex gap-3">
                            <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} className="flex-1 bg-maroon text-white py-3 rounded-2xl font-black text-xs uppercase tracking-widest">Confirm</button>
                            <button onClick={() => setConfirmDialog(null)} className="flex-1 border border-black/10 text-black/60 py-3 rounded-2xl font-black text-xs uppercase tracking-widest">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Duplicate Dialog ───────────────────────────────────────────── */}
            {duplicateDialog && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-4">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="w-6 h-6 text-amber-500" />
                            <h3 className="text-sm font-black text-black uppercase">Similar Unit Detected</h3>
                        </div>
                        <p className="text-xs text-black/60">{duplicateDialog.message}</p>
                        <div className="space-y-2">
                            {duplicateDialog.candidates.map(c => (
                                <button key={c.id} onClick={async () => {
                                    try {
                                        await unitCoverageAPI.markCovered({
                                            course_id: selectedCourse,
                                            unit_id: String(c.id),
                                            student_ids: duplicateDialog.pendingStudentIds || [],
                                        });
                                        showToast('Unit marked as covered', 'success');
                                        setDuplicateDialog(null);
                                        loadCourseCoverageData(selectedCourse);
                                        if (selectedStudentId) loadStudentUnitView(selectedStudentId);
                                    } catch (err) {
                                        showToast('Failed to use existing unit', 'error');
                                    }
                                }} className="w-full text-left px-4 py-3 bg-black/[0.02] rounded-2xl hover:bg-maroon/10 transition-colors border border-black/5">
                                    <p className="text-xs font-black text-black">{c.name}</p>
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setDuplicateDialog(null)} className="w-full border border-black/10 text-black/60 py-3 rounded-2xl font-black text-xs uppercase">Dismiss</button>
                    </div>
                </div>
            )}

            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-black/8 pb-8">
                <div className="space-y-2">
                    <div className="flex items-center gap-4">
                        <div className="p-3.5 bg-gradient-to-br from-maroon to-maroon/80 shadow-2xl shadow-maroon/30 rounded-2xl text-gold">
                            <Layers className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-3xl sm:text-4xl font-black text-black tracking-tight uppercase">
                                {isStudent ? 'My Course Progress' : 'Unit Coverage Tracker'}
                            </h1>
                            <p className="text-[10px] text-black/40 font-black tracking-[0.3em] uppercase mt-1">
                                {isStudent ? 'Personal Curriculum Progress' : 'Per-Student Curriculum Delivery'}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button onClick={loadAllData} id="btn-refresh" className="bg-white text-maroon p-3.5 rounded-2xl hover:bg-maroon hover:text-white transition-all shadow-lg border border-maroon/10 group" title="Refresh">
                        <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                    </button>
                    {!isStudent && (
                        <>
                            <button onClick={handleDownloadCSV} id="btn-export-csv" className="bg-white text-maroon px-5 py-3.5 rounded-2xl flex items-center gap-2 hover:bg-maroon hover:text-white transition-all shadow-lg font-black text-xs uppercase tracking-widest border border-maroon/15">
                                Export CSV
                            </button>
                            <button onClick={handleDownloadPDF} id="btn-export-pdf" className="bg-gradient-to-r from-maroon to-maroon/90 text-gold px-5 py-3.5 rounded-2xl flex items-center gap-2 hover:shadow-xl transition-all hover:scale-[1.02] active:scale-95 font-black text-xs uppercase tracking-widest shadow-lg border border-gold/20">
                                <FileDown className="w-5 h-5" /> Export PDF
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* ── STUDENT PORTAL VIEW ─────────────────────────────────────────── */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {isStudent && (
                <div className="space-y-8 animate-in fade-in duration-500">
                    {studentProgress.length === 0 ? (
                        <div className="bg-white p-16 rounded-[2.5rem] border border-black/5 shadow-2xl text-center">
                            <BookOpen className="w-10 h-10 text-black/15 mx-auto mb-4" />
                            <p className="text-[10px] font-black text-black/20 uppercase tracking-[0.3em]">No course progress yet. Units will appear once your teacher marks them as covered for you.</p>
                        </div>
                    ) : (
                        studentProgress.map(cp => (
                            <div key={cp.course_id} className="bg-white rounded-[2.5rem] border border-black/5 shadow-2xl overflow-hidden">
                                <div className="p-8 border-b border-black/5 bg-gradient-to-r from-maroon/[0.02] to-transparent">
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                        <div>
                                            <h2 className="text-2xl font-black text-black uppercase">{cp.course_name}</h2>
                                            <p className="text-xs text-black/30 font-bold mt-1 uppercase tracking-widest">{cp.course_id}</p>
                                        </div>
                                        <div className="flex items-center gap-4 w-full md:w-56">
                                            <div className="flex-1">
                                                <div className="flex justify-between text-[10px] font-bold text-black/40 uppercase mb-1">
                                                    <span>{cp.covered_units}/{cp.total_units} Covered</span>
                                                    <span>{cp.completion_pct}%</span>
                                                </div>
                                                <div className="h-2.5 bg-black/5 rounded-full overflow-hidden">
                                                    <div className="h-full bg-gradient-to-r from-maroon to-gold rounded-full transition-all duration-1000" style={{ width: `${cp.completion_pct}%` }} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-black/[0.015] border-b border-black/5">
                                                {['Status', 'Unit', 'Teacher / Date', 'Materials', 'Confirmation'].map(h => (
                                                    <th key={h} className="px-6 py-4 text-left text-[10px] font-black text-black/40 uppercase tracking-widest">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-black/5">
                                            {cp.units.map(u => (
                                                <tr key={u.id} className="hover:bg-black/[0.005] transition-colors">
                                                    <td className="px-6 py-4">
                                                        {u.is_covered ? (
                                                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 border border-green-200 rounded-full text-green-700 text-[9px] font-black uppercase">✅ Covered</span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-amber-600 text-[9px] font-black uppercase">🟡 Pending</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <p className="text-xs font-black text-black uppercase">{u.name}</p>
                                                        {u.description && <p className="text-[10px] text-black/40 mt-0.5">{u.description}</p>}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {u.is_covered ? (
                                                            <div>
                                                                <p className="text-xs font-black text-black uppercase">{u.teacher_name}</p>
                                                                <p className="text-[10px] text-black/30 mt-0.5">{u.date_covered}</p>
                                                            </div>
                                                        ) : '—'}
                                                    </td>
                                                    <td className="px-6 py-4 text-xs text-black/40">
                                                        {u.is_covered && u.material_urls ? (
                                                            (() => {
                                                                try {
                                                                    const urls = JSON.parse(u.material_urls);
                                                                    return urls.map((url, i) => (
                                                                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-maroon hover:underline flex items-center gap-1 text-[10px] font-bold">
                                                                            <BookOpen className="w-3 h-3" /> Material #{i + 1}
                                                                        </a>
                                                                    ));
                                                                } catch { return '—'; }
                                                            })()
                                                        ) : '—'}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {u.is_covered ? (
                                                            u.student_confirmation ? (
                                                                <div className="flex flex-col items-start gap-1">
                                                                    <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase border
                                                                        ${u.student_confirmation.response === 'Yes' ? 'bg-green-50 border-green-200 text-green-700' : ''}
                                                                        ${u.student_confirmation.response === 'Partially' ? 'bg-amber-50 border-amber-200 text-amber-700' : ''}
                                                                        ${u.student_confirmation.response === 'No' ? 'bg-red-50 border-red-200 text-red-700' : ''}
                                                                    `}>{u.student_confirmation.response}</span>
                                                                    {activePeriod?.is_active && (
                                                                        <button onClick={() => {
                                                                            setConfirmationForm({ coverage_log_id: u.log_id, response: u.student_confirmation.response, comment: u.student_confirmation.comment || '' });
                                                                            setShowConfirmationModal(true);
                                                                        }} className="text-[9px] text-maroon hover:underline font-bold uppercase">Edit</button>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <button onClick={() => {
                                                                    setConfirmationForm({ coverage_log_id: u.log_id, response: 'Yes', comment: '' });
                                                                    setShowConfirmationModal(true);
                                                                }} id={`btn-confirm-${u.id}`} className="bg-maroon text-white px-3.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider shadow-sm hover:bg-maroon/90 transition-all">
                                                                    Was it taught?
                                                                </button>
                                                            )
                                                        ) : '—'}
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

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* ── TEACHER PORTAL VIEW ─────────────────────────────────────────── */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {isTeacher && (
                <div className="space-y-8">
                    {/* Course Selector */}
                    <div className="bg-white p-6 rounded-[2rem] border border-black/5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-base font-black text-black uppercase tracking-tight">Select Course</h3>
                            <p className="text-[10px] text-black/40 font-bold uppercase mt-0.5">Choose a course to manage per-student coverage</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <select value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)} id="select-course"
                                className="px-4 py-3 text-[10px] font-black uppercase tracking-widest outline-none shadow-sm bg-white border border-black/10 text-black rounded-2xl w-full sm:w-72">
                                <option value="">Choose Course...</option>
                                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            {selectedCourse && (
                                <button onClick={() => setShowManageUnitsModal(true)} id="btn-manage-units"
                                    className="bg-white hover:bg-maroon hover:text-white border border-maroon/20 text-maroon p-3 rounded-2xl transition-all shadow-md" title="Manage Units">
                                    <BookOpen className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {selectedCourse ? (
                        <>
                            {/* Stats Row */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {[
                                    { label: 'Total Units', value: units.length, icon: Layers, color: 'text-maroon' },
                                    { label: 'Students Enrolled', value: enrolledStudents.length, icon: Users, color: 'text-blue-600' },
                                    { label: 'Intake Levels', value: intakeList.length, icon: Filter, color: 'text-purple-600' },
                                    { label: 'Avg. Completion', value: enrolledStudents.length > 0 ? Math.round(enrolledStudents.reduce((a, s) => a + s.completion_pct, 0) / enrolledStudents.length) + '%' : '—', icon: BarChart2, color: 'text-green-600' },
                                ].map(stat => (
                                    <div key={stat.label} className="bg-white p-5 rounded-[1.5rem] border border-black/5 shadow-xl flex items-center gap-4">
                                        <div className={`p-2.5 bg-black/5 rounded-xl ${stat.color}`}><stat.icon className="w-5 h-5" /></div>
                                        <div>
                                            <p className="text-[9px] font-black text-black/40 uppercase tracking-wider">{stat.label}</p>
                                            <p className="text-xl font-black text-black mt-0.5">{stat.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Tab Navigation */}
                            <div className="flex gap-2 bg-black/[0.03] p-1.5 rounded-2xl w-fit">
                                {[
                                    { key: 'students', label: 'Students', icon: Users },
                                    { key: 'units', label: 'Units Grid', icon: Layers },
                                    { key: 'analytics', label: 'Analytics', icon: BarChart2 },
                                ].map(tab => (
                                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                            activeTab === tab.key ? 'bg-maroon text-white shadow-lg' : 'text-black/50 hover:text-black'
                                        }`}>
                                        <tab.icon className="w-4 h-4" />{tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* ── TAB: STUDENTS ──────────────────────────────────────────── */}
                            {activeTab === 'students' && (
                                <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                                    {/* Student List Panel */}
                                    <div className="xl:col-span-2 bg-white rounded-[2rem] border border-black/5 shadow-xl overflow-hidden">
                                        <div className="p-6 border-b border-black/5">
                                            <h3 className="text-sm font-black text-black uppercase tracking-tight mb-3">Student Registry</h3>
                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30" />
                                                    <input value={studentSearch} onChange={e => setStudentSearch(e.target.value)} placeholder="Search student..."
                                                        className="w-full pl-9 pr-3 py-2.5 text-xs bg-black/[0.03] border border-transparent focus:border-maroon/20 rounded-xl outline-none font-bold text-black" />
                                                </div>
                                                <select value={intakeFilter} onChange={e => setIntakeFilter(e.target.value)}
                                                    className="text-[10px] font-black uppercase tracking-wider px-3 py-2.5 bg-black/[0.03] border border-transparent rounded-xl outline-none text-black">
                                                    <option value="all">All Intakes</option>
                                                    {intakeList.map(i => <option key={i} value={i}>{i}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="overflow-y-auto max-h-[600px] divide-y divide-black/5">
                                            {filteredStudents.length === 0 ? (
                                                <div className="p-8 text-center">
                                                    <Users className="w-8 h-8 text-black/15 mx-auto mb-2" />
                                                    <p className="text-[10px] font-black text-black/20 uppercase">No students found</p>
                                                </div>
                                            ) : (
                                                filteredStudents.map(student => {
                                                    const isSelected = selectedStudentId === student.id;
                                                    const pct = student.completion_pct;
                                                    const pctColor = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400';
                                                    return (
                                                        <button key={student.id} onClick={() => {
                                                            if (isSelected) { setSelectedStudentId(null); setStudentUnitView([]); }
                                                            else { setSelectedStudentId(student.id); loadStudentUnitView(student.id); }
                                                        }}
                                                            className={`w-full text-left px-6 py-4 transition-colors ${isSelected ? 'bg-maroon/5' : 'hover:bg-black/[0.02]'}`}>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${isSelected ? 'bg-maroon text-white' : 'bg-black/5 text-black/50'}`}>
                                                                        {student.name.charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs font-black text-black uppercase tracking-tight">{student.name}</p>
                                                                        <p className="text-[9px] text-black/40 font-bold">{student.intake || 'No Intake'}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-xs font-black text-black">{pct}%</p>
                                                                    <p className="text-[9px] text-black/30 font-bold">{student.covered_units}/{student.total_units}</p>
                                                                </div>
                                                            </div>
                                                            <div className="h-1.5 bg-black/5 rounded-full overflow-hidden">
                                                                <div className={`h-full ${pctColor} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                                                            </div>
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>

                                    {/* Student Unit Drawer */}
                                    <div className="xl:col-span-3 bg-white rounded-[2rem] border border-black/5 shadow-xl overflow-hidden">
                                        {!selectedStudentId ? (
                                            <div className="flex flex-col items-center justify-center h-full p-16 text-center">
                                                <UserCheck className="w-12 h-12 text-black/10 mb-4" />
                                                <p className="text-[10px] font-black text-black/20 uppercase tracking-[0.25em]">Select a student to view and manage their unit coverage</p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="p-6 border-b border-black/5 flex items-center justify-between">
                                                    <div>
                                                        <h3 className="text-sm font-black text-black uppercase">
                                                            {enrolledStudents.find(s => s.id === selectedStudentId)?.name}
                                                        </h3>
                                                        <p className="text-[10px] text-black/40 font-bold uppercase mt-0.5">
                                                            Intake: {enrolledStudents.find(s => s.id === selectedStudentId)?.intake || 'N/A'}
                                                        </p>
                                                    </div>
                                                    <button onClick={() => { setSelectedStudentId(null); setStudentUnitView([]); }}
                                                        className="p-2 hover:bg-black/5 rounded-xl text-black/40 transition-colors">
                                                        <X className="w-5 h-5" />
                                                    </button>
                                                </div>
                                                <div className="overflow-y-auto max-h-[580px]">
                                                    {studentUnitLoading ? (
                                                        <div className="flex justify-center p-12">
                                                            <div className="w-8 h-8 border-4 border-maroon border-t-transparent rounded-full animate-spin" />
                                                        </div>
                                                    ) : (
                                                        <table className="w-full">
                                                            <thead>
                                                                <tr className="bg-black/[0.015] border-b border-black/5">
                                                                    <th className="px-5 py-3 text-left text-[9px] font-black text-black/40 uppercase tracking-widest">Unit / Topic</th>
                                                                    <th className="px-5 py-3 text-center text-[9px] font-black text-black/40 uppercase tracking-widest">Status</th>
                                                                    <th className="px-5 py-3 text-center text-[9px] font-black text-black/40 uppercase tracking-widest">Action</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-black/5">
                                                                {studentUnitView.map(unit => {
                                                                    const isCovered = !!unit.coverage_log;
                                                                    return (
                                                                        <tr key={unit.id} className="hover:bg-black/[0.005] transition-colors">
                                                                            <td className="px-5 py-4">
                                                                                <p className="text-xs font-black text-black uppercase">{unit.name}</p>
                                                                                {unit.expected_duration && <p className="text-[9px] text-black/30 mt-0.5"><Clock className="inline w-3 h-3 mr-1" />{unit.expected_duration}</p>}
                                                                            </td>
                                                                            <td className="px-5 py-4 text-center">
                                                                                {isCovered ? (
                                                                                    <div>
                                                                                        <span className="inline-flex px-2.5 py-1 bg-green-50 border border-green-200 rounded-full text-green-700 text-[9px] font-black uppercase">✅ Covered</span>
                                                                                        <p className="text-[9px] text-black/30 mt-1">{unit.coverage_log.date_covered}</p>
                                                                                    </div>
                                                                                ) : (
                                                                                    <span className="inline-flex px-2.5 py-1 bg-black/[0.03] border border-black/10 rounded-full text-black/40 text-[9px] font-black uppercase">⬜ Not Covered</span>
                                                                                )}
                                                                            </td>
                                                                            <td className="px-5 py-4 text-center">
                                                                                {isCovered ? (
                                                                                    <button onClick={() => handleUnmarkForStudent(unit, selectedStudentId)}
                                                                                        className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-xl transition-colors" title="Unmark">
                                                                                        <Trash className="w-4 h-4" />
                                                                                    </button>
                                                                                ) : (
                                                                                    <button onClick={() => handleMarkForStudent(unit, selectedStudentId)}
                                                                                        id={`btn-mark-${unit.id}-${selectedStudentId}`}
                                                                                        className="bg-maroon text-white px-3.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-maroon/90 transition-all">
                                                                                        ✓ Mark
                                                                                    </button>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── TAB: UNITS GRID ─────────────────────────────────────────── */}
                            {activeTab === 'units' && (
                                <div className="bg-white rounded-[2rem] border border-black/5 shadow-xl overflow-hidden" id="coverage-report-view">
                                    <div className="p-6 border-b border-black/5 flex items-center justify-between">
                                        <h3 className="text-sm font-black text-black uppercase">Curriculum Units</h3>
                                        <p className="text-[10px] text-black/40 font-bold uppercase">Click "Batch Mark" to cover a unit for multiple students at once</p>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="bg-black/[0.015] border-b border-black/5">
                                                    {['#', 'Unit / Topic', 'Duration', 'Students Covered', 'Action'].map(h => (
                                                        <th key={h} className="px-6 py-4 text-left text-[10px] font-black text-black/40 uppercase tracking-widest">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-black/5">
                                                {units.map((unit, idx) => {
                                                    const covPct = enrolledStudents.length > 0
                                                        ? Math.round((unit.students_covered_count / enrolledStudents.length) * 100)
                                                        : 0;
                                                    return (
                                                        <tr key={unit.id} className="hover:bg-black/[0.005] transition-colors">
                                                            <td className="px-6 py-4 text-xs font-black text-black/30">{idx + 1}</td>
                                                            <td className="px-6 py-4">
                                                                <p className="text-xs font-black text-black uppercase">{unit.name}</p>
                                                                {unit.description && <p className="text-[9px] text-black/30 mt-0.5">{unit.description}</p>}
                                                            </td>
                                                            <td className="px-6 py-4 text-xs text-black/50 font-bold">{unit.expected_duration || '—'}</td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-24 h-2 bg-black/5 rounded-full overflow-hidden">
                                                                        <div className={`h-full rounded-full transition-all duration-700 ${covPct >= 80 ? 'bg-green-500' : covPct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                                                                            style={{ width: `${covPct}%` }} />
                                                                    </div>
                                                                    <span className="text-[10px] font-black text-black/50">{unit.students_covered_count}/{enrolledStudents.length}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <button onClick={() => handleOpenBatchModal(unit)}
                                                                    id={`btn-batch-${unit.id}`}
                                                                    className="bg-maroon text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-maroon/90 transition-all shadow-sm">
                                                                    Batch Mark
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* ── TAB: ANALYTICS ─────────────────────────────────────────── */}
                            {activeTab === 'analytics' && (
                                <div className="bg-white rounded-[2rem] border border-black/5 shadow-xl p-8 space-y-6">
                                    <h3 className="text-sm font-black text-black uppercase">Coverage Analytics by Student</h3>
                                    {enrolledStudents.length === 0 ? (
                                        <p className="text-[10px] font-black text-black/20 uppercase text-center py-8">No students enrolled yet</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {[...enrolledStudents].sort((a, b) => a.completion_pct - b.completion_pct).map(student => {
                                                const pct = student.completion_pct;
                                                return (
                                                    <div key={student.id} className="flex items-center gap-4 p-4 rounded-2xl border border-black/5 hover:bg-black/[0.01] transition-colors">
                                                        <div className="w-8 h-8 bg-black/5 rounded-full flex items-center justify-center text-xs font-black text-black/50">
                                                            {student.name.charAt(0)}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-baseline mb-1.5">
                                                                <p className="text-xs font-black text-black uppercase truncate">{student.name}</p>
                                                                <span className="text-[10px] font-black text-black/40 ml-2 whitespace-nowrap">{student.covered_units}/{student.total_units}</span>
                                                            </div>
                                                            <div className="h-2 bg-black/5 rounded-full overflow-hidden">
                                                                <div className={`h-full rounded-full transition-all duration-700 ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                                                                    style={{ width: `${pct}%` }} />
                                                            </div>
                                                        </div>
                                                        <div className="text-right min-w-[3rem]">
                                                            <p className="text-sm font-black text-black">{pct}%</p>
                                                            <p className="text-[9px] text-black/30 font-bold uppercase">{student.intake || '—'}</p>
                                                        </div>
                                                        {pct < 30 && <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" title="Low coverage" />}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="bg-white p-16 rounded-[2rem] border border-black/5 shadow-xl text-center">
                            <Layers className="w-10 h-10 text-black/10 mx-auto mb-4" />
                            <p className="text-[10px] font-black text-black/20 uppercase tracking-[0.3em]">Select a course to begin managing student coverage</p>
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* ── ADMIN PORTAL VIEW ───────────────────────────────────────────── */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {isAdmin && (
                <div className="space-y-6" id="coverage-report-view">
                    <div className="flex items-center gap-3">
                        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search course..." className="px-4 py-3 text-xs bg-white border border-black/10 rounded-2xl outline-none font-bold text-black shadow-sm w-64" />
                        <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)} className="px-4 py-3 text-[10px] font-black uppercase tracking-wider bg-white border border-black/10 rounded-2xl outline-none text-black shadow-sm">
                            <option value="">All Departments</option>
                            {departmentsList.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>

                    <div className="bg-white rounded-[2rem] border border-black/5 shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-black/5">
                            <h3 className="text-sm font-black text-black uppercase">Course Coverage Overview</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-black/[0.015] border-b border-black/5">
                                        {['Course', 'Department', 'Total Units', 'Enrolled', 'Students w/ Coverage', 'Confirmations'].map(h => (
                                            <th key={h} className="px-6 py-4 text-left text-[10px] font-black text-black/40 uppercase tracking-widest">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-black/5">
                                    {adminOverview
                                        .filter(item => {
                                            const s = searchTerm.toLowerCase();
                                            const matchSearch = !s || item.course_name.toLowerCase().includes(s) || (item.department || '').toLowerCase().includes(s);
                                            const matchDept = !selectedDept || (item.department || '').toLowerCase() === selectedDept.toLowerCase();
                                            return matchSearch && matchDept;
                                        })
                                        .map(item => (
                                            <tr key={item.course_id} className="hover:bg-black/[0.005] transition-colors">
                                                <td className="px-6 py-4">
                                                    <p className="text-xs font-black text-black uppercase">{item.course_name}</p>
                                                    <p className="text-[9px] text-black/30 font-bold">{item.course_id}</p>
                                                </td>
                                                <td className="px-6 py-4 text-xs font-bold text-black/60">{item.department || '—'}</td>
                                                <td className="px-6 py-4 text-xs font-black text-black">{item.total_units}</td>
                                                <td className="px-6 py-4 text-xs font-black text-black">{item.enrolled_students}</td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-maroon/5 border border-maroon/20 rounded-full text-maroon text-[9px] font-black uppercase">
                                                        {item.students_with_coverage} students
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-xs font-bold text-black/60">{item.total_confirmations}</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* ── BATCH MARK MODAL ────────────────────────────────────────────── */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {showBatchModal && batchUnit && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-black/5 flex items-center justify-between">
                            <div>
                                <h2 className="text-sm font-black text-black uppercase">Batch Mark Covered</h2>
                                <p className="text-[10px] text-black/40 font-bold mt-0.5 uppercase">{batchUnit.name}</p>
                            </div>
                            <button onClick={() => setShowBatchModal(false)} className="p-2 hover:bg-black/5 rounded-xl text-black/40"><X className="w-5 h-5" /></button>
                        </div>

                        <form onSubmit={handleBatchMark} className="flex flex-col flex-1 overflow-hidden">
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                {/* Intake Filter */}
                                <div className="flex items-center justify-between gap-2">
                                    <select value={batchIntakeFilter} onChange={e => setBatchIntakeFilter(e.target.value)}
                                        className="text-[10px] font-black uppercase tracking-wider px-3 py-2.5 bg-black/[0.03] border border-transparent rounded-xl outline-none text-black">
                                        <option value="all">All Intakes</option>
                                        {intakeList.map(i => <option key={i} value={i}>{i}</option>)}
                                    </select>
                                    <button type="button" onClick={toggleBatchAll}
                                        className="flex items-center gap-2 text-[10px] font-black text-maroon uppercase tracking-wider hover:underline">
                                        {batchFilteredStudents.every(s => batchSelectedStudents.has(s.id)) ? (
                                            <><MinusSquare className="w-4 h-4" /> Deselect All</>
                                        ) : (
                                            <><CheckSquare className="w-4 h-4" /> Select All</>
                                        )}
                                    </button>
                                </div>

                                {/* Student Checklist */}
                                <div className="space-y-1.5 max-h-60 overflow-y-auto border border-black/5 rounded-2xl p-3">
                                    {batchFilteredStudents.map(student => (
                                        <label key={student.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-black/[0.02] cursor-pointer transition-colors">
                                            <input type="checkbox" checked={batchSelectedStudents.has(student.id)} onChange={() => toggleBatchStudent(student.id)}
                                                className="w-4 h-4 accent-maroon" />
                                            <div className="flex-1">
                                                <p className="text-xs font-black text-black uppercase">{student.name}</p>
                                                <p className="text-[9px] text-black/30 font-bold">{student.intake || 'No Intake'} · {student.covered_units}/{student.total_units} units covered</p>
                                            </div>
                                            {student.covered_units === student.total_units && <Check className="w-3.5 h-3.5 text-green-500" />}
                                        </label>
                                    ))}
                                </div>

                                <p className="text-[10px] font-bold text-black/40 uppercase">{batchSelectedStudents.size} student(s) selected</p>

                                {/* Remarks */}
                                <div>
                                    <label className="text-[10px] font-black text-black/50 uppercase tracking-wider block mb-1.5">Remarks (Optional)</label>
                                    <textarea value={batchForm.remarks} onChange={e => setBatchForm(f => ({ ...f, remarks: e.target.value }))} rows={2}
                                        placeholder="e.g. Practical session covered today"
                                        className="w-full px-4 py-3 text-xs bg-black/[0.02] border border-black/8 rounded-2xl outline-none focus:border-maroon/30 resize-none font-medium text-black" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-black/50 uppercase tracking-wider block mb-1.5">Material URL (Optional)</label>
                                    <input type="url" value={batchForm.material_urls} onChange={e => setBatchForm(f => ({ ...f, material_urls: e.target.value }))}
                                        placeholder="https://drive.google.com/..."
                                        className="w-full px-4 py-3 text-xs bg-black/[0.02] border border-black/8 rounded-2xl outline-none focus:border-maroon/30 font-medium text-black" />
                                </div>
                            </div>

                            <div className="p-6 border-t border-black/5 flex gap-3">
                                <button type="button" onClick={() => setShowBatchModal(false)}
                                    className="flex-1 border border-black/10 text-black/50 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest">Cancel</button>
                                <button type="submit" disabled={batchLoading || batchSelectedStudents.size === 0}
                                    className="flex-1 bg-maroon text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-maroon/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                                    {batchLoading ? 'Marking...' : `Mark for ${batchSelectedStudents.size} Student(s)`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Manage Units Modal ─────────────────────────────────────────── */}
            {showManageUnitsModal && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-black/5 flex items-center justify-between">
                            <h2 className="text-sm font-black text-black uppercase">Manage Units</h2>
                            <button onClick={() => setShowManageUnitsModal(false)} className="p-2 hover:bg-black/5 rounded-xl text-black/40"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-3">
                            {units.map((u, idx) => (
                                <div key={u.id} className="flex items-center gap-3 p-4 bg-black/[0.02] rounded-2xl border border-black/5">
                                    <div className="flex flex-col gap-0.5">
                                        <button onClick={() => handleMoveUnit(idx, 'up')} disabled={idx === 0} className="text-black/30 hover:text-maroon disabled:opacity-20"><ChevronUp className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => handleMoveUnit(idx, 'down')} disabled={idx === units.length - 1} className="text-black/30 hover:text-maroon disabled:opacity-20"><ChevronDown className="w-3.5 h-3.5" /></button>
                                    </div>
                                    {editingUnit?.id === u.id ? (
                                        <form onSubmit={handleUpdateUnit} className="flex-1 flex items-center gap-2">
                                            <input value={editingUnit.name} onChange={e => setEditingUnit(p => ({ ...p, name: e.target.value }))} className="flex-1 px-3 py-2 text-xs bg-white border border-maroon/30 rounded-xl outline-none font-black text-black" />
                                            <input value={editingUnit.expected_duration || ''} onChange={e => setEditingUnit(p => ({ ...p, expected_duration: e.target.value }))} placeholder="Duration" className="w-24 px-3 py-2 text-[10px] bg-white border border-black/10 rounded-xl outline-none text-black" />
                                            <button type="submit" className="bg-maroon text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase"><Check className="w-3.5 h-3.5" /></button>
                                            <button type="button" onClick={() => setEditingUnit(null)} className="text-black/30 hover:text-black px-2 py-2 rounded-xl"><X className="w-3.5 h-3.5" /></button>
                                        </form>
                                    ) : (
                                        <div className="flex-1 flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-black text-black uppercase">{u.name}</p>
                                                {u.expected_duration && <p className="text-[9px] text-black/30 mt-0.5">{u.expected_duration}</p>}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => setEditingUnit(u)} className="p-2 hover:bg-black/5 rounded-xl text-black/30 hover:text-maroon transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => handleArchiveUnit(u.id, u.name, !u.is_archived)} className={`p-2 hover:bg-black/5 rounded-xl transition-colors ${u.is_archived ? 'text-green-500' : 'text-black/30 hover:text-amber-500'}`} title={u.is_archived ? 'Unarchive' : 'Archive'}><Archive className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {/* Add Unit */}
                            <form onSubmit={handleAddUnit} className="flex items-center gap-2 p-4 bg-maroon/[0.02] rounded-2xl border border-maroon/10">
                                <input value={newUnitForm.name} onChange={e => setNewUnitForm(p => ({ ...p, name: e.target.value }))} placeholder="New unit name..." className="flex-1 px-3 py-2 text-xs bg-white border border-black/10 rounded-xl outline-none font-medium text-black" />
                                <input value={newUnitForm.expected_duration} onChange={e => setNewUnitForm(p => ({ ...p, expected_duration: e.target.value }))} placeholder="Duration" className="w-24 px-3 py-2 text-[10px] bg-white border border-black/10 rounded-xl outline-none text-black" />
                                <button type="submit" className="bg-maroon text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-1 shadow"><Plus className="w-3.5 h-3.5" />Add</button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Student Confirmation Modal ─────────────────────────────────── */}
            {showConfirmationModal && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md">
                        <div className="p-6 border-b border-black/5 flex items-center justify-between">
                            <h2 className="text-sm font-black text-black uppercase">Was This Unit Taught?</h2>
                            <button onClick={() => setShowConfirmationModal(false)} className="p-2 hover:bg-black/5 rounded-xl text-black/40"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleConfirmSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-3 gap-2">
                                {['Yes', 'Partially', 'No'].map(opt => (
                                    <button key={opt} type="button" onClick={() => setConfirmationForm(f => ({ ...f, response: opt }))}
                                        className={`py-3 rounded-2xl font-black text-xs uppercase tracking-wider border-2 transition-all ${
                                            confirmationForm.response === opt
                                                ? opt === 'Yes' ? 'bg-green-600 border-green-600 text-white' : opt === 'Partially' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-red-500 border-red-500 text-white'
                                                : 'border-black/10 text-black/50 hover:border-black/20'
                                        }`}>{opt}</button>
                                ))}
                            </div>
                            <textarea value={confirmationForm.comment} onChange={e => setConfirmationForm(f => ({ ...f, comment: e.target.value }))} rows={3}
                                placeholder="Optional comment..." className="w-full px-4 py-3 text-xs bg-black/[0.02] border border-black/8 rounded-2xl outline-none resize-none focus:border-maroon/30 font-medium text-black" />
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setShowConfirmationModal(false)} className="flex-1 border border-black/10 text-black/50 py-3.5 rounded-2xl font-black text-xs uppercase">Cancel</button>
                                <button type="submit" className="flex-1 bg-maroon text-white py-3.5 rounded-2xl font-black text-xs uppercase shadow-lg hover:bg-maroon/90">Submit</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
