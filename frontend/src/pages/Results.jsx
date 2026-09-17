import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { catPeriodsAPI, catResultsAPI, coursesAPI, studentsAPI, courseUnitsAPI } from '../services/api';
import {
    Award, BookOpen, Users, Search, Plus, X, Edit, Trash2, CheckCircle,
    FileDown, Printer, History, TrendingUp, GraduationCap, Layers, AlertTriangle,
    ChevronDown, ChevronUp, Send, Check, Lock, Eye, BarChart3, Filter, Clock,
    Sparkles, RefreshCw, FileText, CheckSquare, ShieldCheck
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ── Helper: Grade badge styling ───────────────────────────────────────────────
const GRADE_BADGES = {
    Distinction: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Credit: 'bg-blue-50 text-blue-700 border-blue-200',
    Pass: 'bg-amber-50 text-amber-700 border-amber-200',
    Fail: 'bg-red-50 text-red-600 border-red-200',
};

const WORKFLOW_BADGES = {
    Draft: 'bg-gray-100 text-gray-700 border-gray-200',
    Submitted: 'bg-amber-50 text-amber-800 border-amber-300',
    Approved: 'bg-blue-50 text-blue-800 border-blue-300',
    Published: 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-sm',
};

function GradeChip({ grade, percentage }) {
    const color = GRADE_BADGES[grade] || 'bg-gray-50 text-gray-500 border-gray-200';
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${color}`}>
            <span>{grade || 'N/A'}</span>
            {percentage !== null && percentage !== undefined && (
                <span className="opacity-60 text-[9px]">({percentage}%)</span>
            )}
        </span>
    );
}

function WorkflowChip({ status }) {
    const color = WORKFLOW_BADGES[status] || 'bg-gray-50 text-gray-500 border-gray-200';
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${color}`}>
            {status === 'Published' && <CheckCircle className="w-3 h-3 text-emerald-600" />}
            {status === 'Approved' && <ShieldCheck className="w-3 h-3 text-blue-600" />}
            {status === 'Submitted' && <Send className="w-3 h-3 text-amber-600" />}
            {status === 'Draft' && <Clock className="w-3 h-3 text-gray-500" />}
            <span>{status}</span>
        </span>
    );
}

export default function Results() {
    const { user } = useAuth();
    const userRole = (user?.role || '').toLowerCase().trim();
    const isStudent = userRole === 'student';
    const isTeacher = userRole === 'teacher';
    const isAdmin = ['admin', 'superadmin'].includes(userRole);
    const isSuperAdmin = userRole === 'superadmin';

    // ── Core State ────────────────────────────────────────────────────────────
    const [periods, setPeriods] = useState([]);
    const [selectedPeriod, setSelectedPeriod] = useState('');
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState('');
    const [units, setUnits] = useState([]);
    const [selectedUnit, setSelectedUnit] = useState('');
    const [allStudents, setAllStudents] = useState([]);
    const [results, setResults] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [auditLogs, setAuditLogs] = useState([]);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Modals
    const [showSingleModal, setShowSingleModal] = useState(false);
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [showPeriodModal, setShowPeriodModal] = useState(false);
    const [showAuditModal, setShowAuditModal] = useState(false);
    const [showResultSlipModal, setShowResultSlipModal] = useState(false);
    const [slipStudentTarget, setSlipStudentTarget] = useState(null);

    // Form states
    const [editingResult, setEditingResult] = useState(null);
    const [singleForm, setSingleForm] = useState({
        student_id: '', course_id: '', unit_id: '', unit_name: '',
        cat_period_id: '', marks: '', status: 'Present', remarks: ''
    });

    const [batchUnit, setBatchUnit] = useState('');
    const [batchCourse, setBatchCourse] = useState('');
    const [batchStudents, setBatchStudents] = useState([]);
    const [batchEntries, setBatchEntries] = useState({}); // student_id -> { marks, status, remarks }
    const [submittingBatch, setSubmittingBatch] = useState(false);

    const [editingPeriod, setEditingPeriod] = useState(null);
    const [periodForm, setPeriodForm] = useState({
        academic_year: '2026', term_name: 'Term 1', cat_name: 'CAT 1', month: 'April',
        max_marks: 100, start_date: '', end_date: '', status: 'Active'
    });

    // Toast & Confirm
    const [toast, setToast] = useState(null);
    const showToast = useCallback((message, type = 'success') => setToast({ message, type }), []);
    const [confirmDialog, setConfirmDialog] = useState(null);
    const openConfirm = (message, onConfirm) => setConfirmDialog({ message, onConfirm });

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(t);
    }, [toast]);

    // ── Load All Base Data ───────────────────────────────────────────────────
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [periodsRes, coursesRes, studentsRes] = await Promise.all([
                catPeriodsAPI.getAll().catch(() => ({ data: [] })),
                coursesAPI.getAll().catch(() => ({ data: [] })),
                studentsAPI.getAll().catch(() => ({ data: [] })),
            ]);

            const pList = Array.isArray(periodsRes.data) ? periodsRes.data : [];
            setPeriods(pList);
            if (pList.length > 0 && !selectedPeriod) {
                // Default to active period or latest
                const active = pList.find(p => p.status === 'Active') || pList[0];
                setSelectedPeriod(String(active.id));
            }

            const cList = Array.isArray(coursesRes.data) ? coursesRes.data : [];
            setCourses(cList);

            const sList = Array.isArray(studentsRes.data) ? studentsRes.data : [];
            setAllStudents(sList);
        } catch (e) {
            console.error(e);
            showToast('Failed to load initial data', 'error');
        } finally {
            setLoading(false);
        }
    }, [selectedPeriod, showToast]);

    useEffect(() => {
        loadData();
    }, []);

    // ── Load Results & Stats when period/course/unit changes ─────────────────
    const loadResultsAndStats = useCallback(async () => {
        try {
            const params = {};
            if (selectedPeriod) params.period_id = selectedPeriod;
            if (selectedCourse) params.course_id = selectedCourse;
            if (selectedUnit) params.unit_id = selectedUnit;
            if (statusFilter !== 'all') params.workflow_status = statusFilter;

            const [resultsRes, statsRes] = await Promise.all([
                catResultsAPI.getResults(params).catch(() => ({ data: [] })),
                catResultsAPI.getStats(params).catch(() => ({ data: null })),
            ]);

            setResults(Array.isArray(resultsRes.data) ? resultsRes.data : []);
            setStats(statsRes.data || null);
        } catch (e) {
            console.error(e);
        }
    }, [selectedPeriod, selectedCourse, selectedUnit, statusFilter]);

    useEffect(() => {
        loadResultsAndStats();
    }, [loadResultsAndStats]);

    // Load units when course changes
    useEffect(() => {
        if (!selectedCourse) {
            setUnits([]);
            return;
        }
        courseUnitsAPI.getUnits(selectedCourse)
            .then(res => setUnits(res.data || []))
            .catch(() => setUnits([]));
    }, [selectedCourse]);

    // ── CAT Period Operations ─────────────────────────────────────────────────
    const handleSavePeriod = async (e) => {
        e.preventDefault();
        try {
            if (editingPeriod) {
                await catPeriodsAPI.update(editingPeriod.id, periodForm);
                showToast('CAT Period updated successfully.', 'success');
            } else {
                await catPeriodsAPI.create(periodForm);
                showToast('CAT Period created successfully.', 'success');
            }
            setShowPeriodModal(false);
            setEditingPeriod(null);
            loadData();
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to save CAT period.', 'error');
        }
    };

    const handleDeletePeriod = (periodId) => {
        openConfirm('Delete this CAT Period? Only allowed if no results exist for it.', async () => {
            try {
                await catPeriodsAPI.delete(periodId);
                showToast('CAT Period deleted.', 'success');
                loadData();
            } catch (err) {
                showToast(err.response?.data?.error || 'Failed to delete period.', 'error');
            }
        });
    };

    // Filter students for single entry form based on selected course
    const filteredStudentsForSingle = useMemo(() => {
        if (!singleForm.course_id) return allStudents;
        const courseObj = courses.find(c => String(c.id) === String(singleForm.course_id));
        if (!courseObj) return allStudents;
        return allStudents.filter(s => {
            const sc = Array.isArray(s.course) ? s.course : [s.course];
            return sc.some(cn => cn?.toLowerCase() === courseObj?.name?.toLowerCase());
        });
    }, [allStudents, courses, singleForm.course_id]);

    // ── Single Result Create / Edit ───────────────────────────────────────────
    const handleSaveSingleResult = async (e) => {
        e.preventDefault();
        if (!singleForm.cat_period_id || !singleForm.course_id || !singleForm.student_id) {
            return showToast('Please select period, course, and student.', 'error');
        }

        const courseObj = courses.find(c => String(c.id) === String(singleForm.course_id));
        const unitName = courseObj?.name || 'General Assessment';

        const payload = { ...singleForm, unit_name: unitName };

        try {
            if (editingResult) {
                await catResultsAPI.updateResult(editingResult.id, payload);
                showToast('Result updated successfully.', 'success');
            } else {
                await catResultsAPI.createResult(payload);
                showToast('Result recorded as Draft.', 'success');
            }
            setShowSingleModal(false);
            setEditingResult(null);
            loadResultsAndStats();
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to save result.', 'error');
        }
    };

    // ── Batch Result Entry ────────────────────────────────────────────────────
    const loadBatchStudentsForCourse = useCallback((courseId) => {
        if (!courseId) {
            setBatchStudents([]);
            setBatchEntries({});
            return;
        }
        const courseObj = courses.find(c => String(c.id) === String(courseId));
        const enrolled = allStudents.filter(s => {
            if (!courseObj) return true;
            const sc = Array.isArray(s.course) ? s.course : [s.course];
            return sc.some(cn => cn?.toLowerCase() === courseObj?.name?.toLowerCase());
        });

        setBatchStudents(enrolled);
        const init = {};
        enrolled.forEach(s => {
            init[s.id] = { marks: '', status: 'Present', remarks: '' };
        });
        setBatchEntries(init);
    }, [allStudents, courses]);

    const handleOpenBatch = () => {
        if (!selectedPeriod) {
            return showToast('Select a CAT Period first.', 'error');
        }
        const initialCourse = selectedCourse || (courses.length > 0 ? String(courses[0].id) : '');
        setBatchCourse(initialCourse);
        loadBatchStudentsForCourse(initialCourse);
        setShowBatchModal(true);
    };

    const handleSaveBatch = async () => {
        if (!batchCourse) return showToast('Please select a course for batch entry.', 'error');

        const courseObj = courses.find(c => String(c.id) === String(batchCourse));
        const unitName = courseObj?.name || 'General Assessment';

        const entriesArr = Object.entries(batchEntries)
            .filter(([, val]) => {
                const hasMarks = val.marks !== '' && val.marks !== null && val.marks !== undefined;
                const hasNonDefaultStatus = val.status && val.status !== 'Present';
                const hasRemarks = val.remarks && val.remarks.trim() !== '';
                return hasMarks || hasNonDefaultStatus || hasRemarks;
            })
            .map(([student_id, val]) => ({
                student_id,
                marks: val.marks,
                status: val.status || 'Present',
                remarks: val.remarks || ''
            }));

        if (entriesArr.length === 0) return showToast('No marks or status entries filled.', 'error');

        setSubmittingBatch(true);
        try {
            const res = await catResultsAPI.batchCreate({
                cat_period_id: selectedPeriod,
                course_id: batchCourse,
                unit_id: null,
                unit_name: unitName,
                entries: entriesArr
            });
            const savedCount = res.data?.saved || 0;
            const errs = res.data?.errors || [];

            if (errs.length > 0) {
                const firstErr = errs[0];
                showToast(`Saved ${savedCount} result(s). ${errs.length} skipped: ${firstErr.student_name} (${firstErr.error})`, 'info');
            } else {
                showToast(`Batch saved: ${savedCount} results recorded successfully.`, 'success');
            }
            setShowBatchModal(false);
            loadResultsAndStats();
        } catch (err) {
            showToast('Failed to save batch entries.', 'error');
        } finally {
            setSubmittingBatch(false);
        }
    };

    // ── Workflow Action Handlers ──────────────────────────────────────────────
    const handleWorkflowAction = async (resultId, action) => {
        try {
            if (action === 'submit') await catResultsAPI.submitResult(resultId);
            if (action === 'approve') await catResultsAPI.approveResult(resultId);
            if (action === 'publish') await catResultsAPI.publishResult(resultId);
            showToast(`Result ${action}d successfully.`, 'success');
            loadResultsAndStats();
        } catch (err) {
            showToast(err.response?.data?.error || `Failed to ${action} result.`, 'error');
        }
    };

    const handleBulkWorkflow = async (action) => {
        if (!selectedPeriod) return showToast('Select a CAT Period first.', 'error');
        openConfirm(`Perform bulk ${action} for all applicable results in this period?`, async () => {
            try {
                let res;
                const payload = { cat_period_id: selectedPeriod, course_id: selectedCourse || null };
                if (action === 'submit') res = await catResultsAPI.bulkSubmit(payload);
                if (action === 'approve') res = await catResultsAPI.bulkApprove(payload);
                if (action === 'publish') res = await catResultsAPI.bulkPublish(payload);
                showToast(res.data.message || `Bulk ${action} completed.`, 'success');
                loadResultsAndStats();
            } catch (err) {
                showToast(`Failed to perform bulk ${action}.`, 'error');
            }
        });
    };

    const handleDeleteResult = (id) => {
        openConfirm('Delete this result record?', async () => {
            try {
                await catResultsAPI.deleteResult(id);
                showToast('Result deleted.', 'success');
                loadResultsAndStats();
            } catch (err) {
                showToast(err.response?.data?.error || 'Failed to delete result.', 'error');
            }
        });
    };

    const handleOpenAuditLog = async () => {
        try {
            const res = await catResultsAPI.getAuditLogs({ cat_period_id: selectedPeriod });
            setAuditLogs(Array.isArray(res.data) ? res.data : []);
            setShowAuditModal(true);
        } catch (err) {
            showToast('Failed to fetch audit log.', 'error');
        }
    };

    // ── Result Slip PDF Export ────────────────────────────────────────────────
    const handlePrintResultSlip = async (studentId) => {
        const studentResults = results.filter(r => String(r.student_id) === String(studentId));
        if (studentResults.length === 0) return showToast('No results found for this student.', 'error');

        const student = {
            name: studentResults[0].student_name || 'Student',
            reg_id: studentResults[0].student_reg_id || studentId,
            course_name: studentResults[0].course_name || 'N/A'
        };

        setSlipStudentTarget({ student, results: studentResults });
        setShowResultSlipModal(true);
    };

    const downloadSlipPDF = async () => {
        const el = document.getElementById('cat-result-slip-printable');
        if (!el) return;
        try {
            const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pw = pdf.internal.pageSize.getWidth();
            const ph = pdf.internal.pageSize.getHeight();
            const imgData = canvas.toDataURL('image/png');
            const ratio = canvas.height / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pw, Math.min(pw * ratio, ph));
            pdf.save(`CAT_Result_Slip_${slipStudentTarget.student.name.replace(/\s+/g, '_')}.pdf`);
            showToast('Result Slip downloaded!', 'success');
        } catch (e) {
            showToast('Failed to generate Result Slip PDF.', 'error');
        }
    };

    // ── Filtered Results List ─────────────────────────────────────────────────
    const filteredResults = useMemo(() => {
        return results.filter(r => {
            const search = searchTerm.toLowerCase().trim();
            const matchSearch = !search ||
                (r.student_name || '').toLowerCase().includes(search) ||
                String(r.student_id).toLowerCase().includes(search) ||
                (r.unit_name || '').toLowerCase().includes(search) ||
                (r.course_name || '').toLowerCase().includes(search);

            return matchSearch;
        });
    }, [results, searchTerm]);

    // Student Grouped View
    const ownStudentResults = useMemo(() => {
        if (!isStudent) return [];
        return results.filter(r => r.workflow_status === 'Published');
    }, [isStudent, results]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-maroon border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-maroon animate-pulse">Loading Results Portal...</p>
                </div>
            </div>
        );
    }

    const currentPeriodObj = periods.find(p => String(p.id) === String(selectedPeriod));

    return (
        <div className="max-w-7xl mx-auto space-y-8 py-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 px-4 sm:px-6">

            {/* ── Toast ──────────────────────────────────────────────────────── */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-[9999] px-5 py-4 rounded-2xl shadow-2xl text-white text-sm font-black uppercase tracking-wider flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300 ${
                    toast.type === 'error' ? 'bg-red-600' : toast.type === 'info' ? 'bg-blue-600' : 'bg-emerald-600'
                }`}>
                    {toast.type === 'error' ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                    {toast.message}
                </div>
            )}

            {/* ── Confirm Dialog ─────────────────────────────────────────────── */}
            {confirmDialog && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-4">
                        <div className="flex items-center gap-3 text-amber-600">
                            <AlertTriangle className="w-6 h-6" />
                            <h3 className="text-sm font-black text-black uppercase">Confirm Action</h3>
                        </div>
                        <p className="text-xs font-bold text-black/70">{confirmDialog.message}</p>
                        <div className="flex gap-3 pt-2">
                            <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} className="flex-1 bg-maroon text-white py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-maroon/90">Confirm</button>
                            <button onClick={() => setConfirmDialog(null)} className="flex-1 border border-black/10 text-black/60 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black/5">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-black/8 pb-8">
                <div className="space-y-2">
                    <div className="flex items-center gap-4">
                        <div className="p-3.5 bg-gradient-to-br from-maroon to-maroon/80 shadow-2xl shadow-maroon/30 rounded-2xl text-gold">
                            <Award className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-3xl sm:text-4xl font-black text-black tracking-tight uppercase">
                                {isStudent ? 'My Assessment Results' : 'Academic CAT Results Management'}
                            </h1>
                            <p className="text-[10px] text-black/40 font-black tracking-[0.3em] uppercase mt-1">
                                {isStudent ? 'Continuous Assessment Test (CAT) Performance' : 'Draft → Submit → Approve → Publish Results Workflow'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Period Selector & Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    {/* Select Period */}
                    <div className="flex items-center gap-2 bg-white border border-black/10 rounded-2xl px-4 py-2.5 shadow-sm">
                        <Clock className="w-4 h-4 text-maroon" />
                        <select
                            value={selectedPeriod}
                            onChange={e => setSelectedPeriod(e.target.value)}
                            className="bg-transparent text-xs font-black uppercase text-black outline-none cursor-pointer"
                        >
                            <option value="">All Academic Periods</option>
                            {periods.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.academic_year} {p.term_name} — {p.cat_name} ({p.status})
                                </option>
                            ))}
                        </select>
                    </div>


                    <button onClick={loadResultsAndStats} className="bg-white text-maroon p-3 rounded-2xl hover:bg-maroon hover:text-white transition-all shadow-md border border-maroon/10" title="Refresh">
                        <RefreshCw className="w-4.5 h-4.5" />
                    </button>

                    {isAdmin && (
                        <>
                            <button
                                onClick={() => {
                                    setEditingPeriod(null);
                                    setPeriodForm({ academic_year: '2026', term_name: 'Term 1', cat_name: 'CAT 1', month: 'April', max_marks: 100, start_date: '', end_date: '', status: 'Active' });
                                    setShowPeriodModal(true);
                                }}
                                className="bg-white text-maroon px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-wider border border-maroon/20 hover:bg-maroon hover:text-white transition-all shadow-sm flex items-center gap-1.5"
                            >
                                <Plus className="w-4 h-4" /> Period
                            </button>

                            <button
                                onClick={handleOpenAuditLog}
                                className="bg-white text-gray-700 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-wider border border-black/10 hover:bg-gray-100 transition-all shadow-sm flex items-center gap-1.5"
                            >
                                <History className="w-4 h-4" /> Audit Log
                            </button>
                        </>
                    )}

                    {!isStudent && (
                        <>
                            <button
                                onClick={handleOpenBatch}
                                className="bg-white text-maroon px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider border border-maroon/20 hover:bg-maroon hover:text-white transition-all shadow-md flex items-center gap-2"
                            >
                                <Users className="w-4 h-4" /> Batch Entry
                            </button>
                            <button
                                onClick={() => {
                                    setEditingResult(null);
                                    setSingleForm({ student_id: '', course_id: selectedCourse || '', unit_id: '', unit_name: '', cat_period_id: selectedPeriod || '', marks: '', status: 'Present', remarks: '' });
                                    setShowSingleModal(true);
                                }}
                                className="bg-gradient-to-r from-maroon to-maroon/90 text-gold px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider hover:shadow-xl transition-all shadow-lg border border-gold/20 flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" /> Record Mark
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* ── Period Status Banner ────────────────────────────────────────── */}
            {currentPeriodObj && (
                <div className="bg-gradient-to-r from-maroon/90 to-maroon p-6 rounded-[2rem] text-white shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1 bg-gold/20 text-gold rounded-full text-[10px] font-black uppercase tracking-widest border border-gold/30">
                                {currentPeriodObj.status} Period
                            </span>
                            <span className="text-xs font-bold text-white/70">Max Marks: {currentPeriodObj.max_marks || 100}</span>
                        </div>
                        <h2 className="text-xl font-black uppercase mt-1 text-white tracking-wide">
                            {currentPeriodObj.academic_year} {currentPeriodObj.term_name} — {currentPeriodObj.cat_name}
                        </h2>
                    </div>

                    {/* Admin Workflow Quick Actions */}
                    {isAdmin && (
                        <div className="flex flex-wrap items-center gap-2 relative z-10">
                            <button
                                onClick={() => handleBulkWorkflow('submit')}
                                className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-white/15 flex items-center gap-1.5"
                            >
                                <Send className="w-3.5 h-3.5 text-amber-300" /> Bulk Submit
                            </button>
                            <button
                                onClick={() => handleBulkWorkflow('approve')}
                                className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-white/15 flex items-center gap-1.5"
                            >
                                <ShieldCheck className="w-3.5 h-3.5 text-blue-300" /> Bulk Approve
                            </button>
                            <button
                                onClick={() => handleBulkWorkflow('publish')}
                                className="px-4 py-2 bg-gold text-maroon hover:bg-yellow-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md flex items-center gap-1.5"
                            >
                                <Sparkles className="w-3.5 h-3.5" /> Bulk Publish
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── Stats Row ──────────────────────────────────────────────────── */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                    <div className="bg-white p-6 rounded-[2rem] border border-black/5 shadow-xl">
                        <p className="text-[10px] font-black uppercase text-black/40 tracking-widest">Total Results</p>
                        <p className="text-3xl font-black text-black mt-1">{stats.total}</p>
                    </div>
                    <div className="bg-white p-6 rounded-[2rem] border border-black/5 shadow-xl">
                        <p className="text-[10px] font-black uppercase text-black/40 tracking-widest">Average Score</p>
                        <p className="text-3xl font-black text-maroon mt-1">{stats.avgPercentage}%</p>
                    </div>
                    <div className="bg-white p-6 rounded-[2rem] border border-black/5 shadow-xl">
                        <p className="text-[10px] font-black uppercase text-black/40 tracking-widest">Pass Rate</p>
                        <p className="text-3xl font-black text-emerald-600 mt-1">
                            {stats.passRate.total > 0
                                ? Math.round((stats.passRate.passed / stats.passRate.total) * 100)
                                : 0}%
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-[2rem] border border-black/5 shadow-xl">
                        <p className="text-[10px] font-black uppercase text-black/40 tracking-widest">Pass / Fail</p>
                        <p className="text-xl font-black text-black mt-2">
                            <span className="text-emerald-600">{stats.passRate.passed} Passed</span> / <span className="text-red-600">{stats.passRate.failed} Failed</span>
                        </p>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* ── STUDENT VIEW ────────────────────────────────────────────────── */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {isStudent ? (
                <div className="space-y-6">
                    {ownStudentResults.length === 0 ? (
                        <div className="bg-white p-16 rounded-[2.5rem] border border-black/5 shadow-2xl text-center space-y-3">
                            <Award className="w-12 h-12 text-maroon/20 mx-auto" />
                            <p className="text-sm font-black text-black/60 uppercase">No published CAT results available for this period yet.</p>
                            <p className="text-[10px] text-black/40 uppercase tracking-widest">Results will appear here once your trainers submit and admins publish them.</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-[2.5rem] border border-black/5 shadow-2xl overflow-hidden p-8 space-y-6">
                            <div className="flex justify-between items-center border-b pb-6">
                                <div>
                                    <h3 className="text-2xl font-black text-black uppercase">Published CAT Statement</h3>
                                    <p className="text-xs font-bold text-black/40 uppercase tracking-widest">Results recorded for selected period</p>
                                </div>
                                <button
                                    onClick={() => handlePrintResultSlip(user.student_id || user.id)}
                                    className="bg-gradient-to-r from-maroon to-maroon/90 text-gold px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg flex items-center gap-2 hover:scale-[1.02] transition-all"
                                >
                                    <Printer className="w-4 h-4" /> Download CAT Result Slip
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-black/[0.02] border-b border-black/5">
                                            <th className="px-6 py-4 text-left text-[10px] font-black text-black/40 uppercase tracking-widest">Unit Name</th>
                                            <th className="px-6 py-4 text-left text-[10px] font-black text-black/40 uppercase tracking-widest">Course</th>
                                            <th className="px-6 py-4 text-left text-[10px] font-black text-black/40 uppercase tracking-widest">Marks (Max)</th>
                                            <th className="px-6 py-4 text-left text-[10px] font-black text-black/40 uppercase tracking-widest">Score %</th>
                                            <th className="px-6 py-4 text-left text-[10px] font-black text-black/40 uppercase tracking-widest">Grade</th>
                                            <th className="px-6 py-4 text-left text-[10px] font-black text-black/40 uppercase tracking-widest">Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-black/5">
                                        {ownStudentResults.map(r => (
                                            <tr key={r.id} className="hover:bg-black/[0.005]">
                                                <td className="px-6 py-4 text-xs font-black text-black uppercase">{r.unit_name}</td>
                                                <td className="px-6 py-4 text-xs font-bold text-black/60 uppercase">{r.course_name}</td>
                                                <td className="px-6 py-4 text-xs font-black text-black">{r.marks !== null ? `${r.marks} / ${r.period_max_marks || 100}` : '—'}</td>
                                                <td className="px-6 py-4 text-xs font-black text-maroon">{r.percentage !== null ? `${r.percentage}%` : '—'}</td>
                                                <td className="px-6 py-4"><GradeChip grade={r.grade} percentage={r.percentage} /></td>
                                                <td className="px-6 py-4 text-xs text-black/50">{r.remarks || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                /* ══════════════════════════════════════════════════════════════════ */
                /* ── ADMIN / TEACHER TABLE VIEW ──────────────────────────────────── */
                /* ══════════════════════════════════════════════════════════════════ */
                <div className="bg-white rounded-[2.5rem] border border-black/5 shadow-2xl overflow-hidden">
                    {/* Filters Toolbar */}
                    <div className="p-6 border-b border-black/5 bg-black/[0.01] flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            {/* Course filter */}
                            <select
                                value={selectedCourse}
                                onChange={e => setSelectedCourse(e.target.value)}
                                className="px-4 py-2.5 bg-white border border-black/10 rounded-2xl text-xs font-black uppercase text-black outline-none"
                            >
                                <option value="">All Courses</option>
                                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>

                            {/* Status filter */}
                            <select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                                className="px-4 py-2.5 bg-white border border-black/10 rounded-2xl text-xs font-black uppercase text-black outline-none"
                            >
                                <option value="all">All Statuses</option>
                                <option value="Draft">Draft</option>
                                <option value="Submitted">Submitted</option>
                                <option value="Approved">Approved</option>
                                <option value="Published">Published</option>
                            </select>
                        </div>

                        {/* Search Bar */}
                        <div className="flex items-center gap-2 bg-white border border-black/10 px-4 py-2 rounded-2xl w-full md:w-80">
                            <Search className="w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search student name, reg #, unit…"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full text-xs font-bold text-black outline-none uppercase placeholder:text-black/30"
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="text-gray-400 hover:text-black">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Results Table */}
                    <div className="overflow-x-auto">
                        {filteredResults.length === 0 ? (
                            <div className="p-16 text-center text-black/40 font-black uppercase text-xs">
                                No CAT results found matching the criteria.
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-black/[0.02] border-b border-black/5">
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-black/40 uppercase tracking-widest">Student</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-black/40 uppercase tracking-widest">Course & Unit</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-black/40 uppercase tracking-widest">Marks</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-black/40 uppercase tracking-widest">Grade</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-black/40 uppercase tracking-widest">Status</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-black/40 uppercase tracking-widest">Workflow</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black text-black/40 uppercase tracking-widest">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-black/5">
                                    {filteredResults.map(r => (
                                        <tr key={r.id} className="hover:bg-black/[0.005]">
                                            <td className="px-6 py-4">
                                                <p className="text-xs font-black text-black uppercase">{r.student_name}</p>
                                                <p className="text-[10px] font-bold text-black/40 uppercase">{r.student_reg_id}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-xs font-black text-maroon uppercase">{r.unit_name}</p>
                                                <p className="text-[10px] text-black/50 font-bold uppercase">{r.course_name}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                {r.marks !== null ? (
                                                    <div>
                                                        <span className="text-xs font-black text-black">{r.marks}</span>
                                                        <span className="text-[10px] text-black/40"> / {r.period_max_marks || 100}</span>
                                                        <p className="text-[10px] font-bold text-maroon">{r.percentage}%</p>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-400 font-bold">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <GradeChip grade={r.grade} percentage={r.percentage} />
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                                                    r.status === 'Present' ? 'bg-green-50 text-green-700 border-green-200' :
                                                    r.status === 'Absent' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-gray-50 text-gray-600 border-gray-200'
                                                }`}>
                                                    {r.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <WorkflowChip status={r.workflow_status} />
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {/* Workflow transitions */}
                                                    {r.workflow_status === 'Draft' && (
                                                        <button
                                                            onClick={() => handleWorkflowAction(r.id, 'submit')}
                                                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                                                            title="Submit for Approval"
                                                        >
                                                            <Send className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {isAdmin && r.workflow_status === 'Submitted' && (
                                                        <button
                                                            onClick={() => handleWorkflowAction(r.id, 'approve')}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                                            title="Approve Result"
                                                        >
                                                            <ShieldCheck className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {isAdmin && r.workflow_status === 'Approved' && (
                                                        <button
                                                            onClick={() => handleWorkflowAction(r.id, 'publish')}
                                                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                                                            title="Publish Result to Student"
                                                        >
                                                            <Sparkles className="w-4 h-4" />
                                                        </button>
                                                    )}

                                                    {/* Printable Result Slip */}
                                                    <button
                                                        onClick={() => handlePrintResultSlip(r.student_id)}
                                                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                                                        title="Print Result Slip"
                                                    >
                                                        <Printer className="w-4 h-4" />
                                                    </button>

                                                    {/* Edit */}
                                                    {(!['Approved', 'Published'].includes(r.workflow_status) || isAdmin) && (
                                                        <button
                                                            onClick={() => {
                                                                setEditingResult(r);
                                                                setSingleForm({
                                                                    student_id: r.student_id,
                                                                    course_id: r.course_id,
                                                                    unit_id: r.unit_id || '',
                                                                    unit_name: r.unit_name,
                                                                    cat_period_id: r.cat_period_id,
                                                                    marks: r.marks !== null ? String(r.marks) : '',
                                                                    status: r.status || 'Present',
                                                                    remarks: r.remarks || ''
                                                                });
                                                                setShowSingleModal(true);
                                                            }}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                                            title="Edit Result"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                    )}

                                                    {/* Delete */}
                                                    {(r.workflow_status !== 'Published' || isSuperAdmin) && (
                                                        <button
                                                            onClick={() => handleDeleteResult(r.id)}
                                                            className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                            title="Delete Result"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* ── MODALS ──────────────────────────────────────────────────────── */}
            {/* ══════════════════════════════════════════════════════════════════ */}

            {/* Single Mark Modal */}
            {showSingleModal && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl space-y-6">
                        <div className="flex justify-between items-center border-b pb-4">
                            <h3 className="text-xl font-black text-black uppercase">
                                {editingResult ? 'Edit CAT Result' : 'Record CAT Mark'}
                            </h3>
                            <button onClick={() => setShowSingleModal(false)} className="p-2 text-gray-400 hover:text-black">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveSingleResult} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black uppercase text-black/60">CAT Assessment Period</label>
                                <select
                                    value={singleForm.cat_period_id}
                                    onChange={e => setSingleForm({ ...singleForm, cat_period_id: e.target.value })}
                                    className="w-full mt-1 p-3 bg-gray-50 border rounded-2xl text-xs font-black uppercase outline-none"
                                    required
                                >
                                    <option value="">Select Period</option>
                                    {periods.map(p => (
                                        <option key={p.id} value={p.id}>{p.academic_year} {p.term_name} — {p.cat_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase text-black/60">Course</label>
                                <select
                                    value={singleForm.course_id}
                                    onChange={e => setSingleForm({ ...singleForm, course_id: e.target.value })}
                                    className="w-full mt-1 p-3 bg-gray-50 border rounded-2xl text-xs font-black uppercase outline-none"
                                    required
                                >
                                    <option value="">Select Course</option>
                                    {courses.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase text-black/60">Student Name</label>
                                <select
                                    value={singleForm.student_id}
                                    onChange={e => setSingleForm({ ...singleForm, student_id: e.target.value })}
                                    className="w-full mt-1 p-3 bg-gray-50 border rounded-2xl text-xs font-black uppercase outline-none cursor-pointer"
                                    required
                                >
                                    <option value="">Select Student</option>
                                    {filteredStudentsForSingle.map(s => (
                                        <option key={s.id} value={s.id}>
                                            {s.name} ({s.id})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-black/60">Marks Score</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        max="100"
                                        placeholder="0-100"
                                        value={singleForm.marks}
                                        onChange={e => setSingleForm({ ...singleForm, marks: e.target.value })}
                                        className="w-full mt-1 p-3 bg-gray-50 border rounded-2xl text-xs font-black uppercase outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-black/60">Status</label>
                                    <select
                                        value={singleForm.status}
                                        onChange={e => setSingleForm({ ...singleForm, status: e.target.value })}
                                        className="w-full mt-1 p-3 bg-gray-50 border rounded-2xl text-xs font-black uppercase outline-none"
                                    >
                                        <option value="Present">Present</option>
                                        <option value="Absent">Absent</option>
                                        <option value="Exempted">Exempted</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase text-black/60">Remarks (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="Trainer comments"
                                    value={singleForm.remarks}
                                    onChange={e => setSingleForm({ ...singleForm, remarks: e.target.value })}
                                    className="w-full mt-1 p-3 bg-gray-50 border rounded-2xl text-xs font-bold outline-none"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="submit" className="flex-1 bg-maroon text-gold py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-maroon/90 shadow-lg">
                                    Save Result
                                </button>
                                <button type="button" onClick={() => setShowSingleModal(false)} className="px-6 py-3.5 border rounded-2xl text-xs font-black uppercase text-gray-500">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Batch Entry Modal */}
            {showBatchModal && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] p-8 max-w-3xl w-full shadow-2xl space-y-6 max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center border-b pb-4 shrink-0">
                            <div>
                                <h3 className="text-xl font-black text-black uppercase">Batch CAT Entry</h3>
                                <p className="text-xs font-bold text-black/40 uppercase">Class-wide mark submission</p>
                            </div>
                            <button onClick={() => setShowBatchModal(false)} className="p-2 text-gray-400 hover:text-black">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="shrink-0">
                            <label className="text-[10px] font-black uppercase text-black/60">Select Course</label>
                            <select
                                value={batchCourse}
                                onChange={e => {
                                    const cId = e.target.value;
                                    setBatchCourse(cId);
                                    loadBatchStudentsForCourse(cId);
                                }}
                                className="w-full mt-1 p-3 bg-gray-50 border rounded-2xl text-xs font-black uppercase outline-none cursor-pointer"
                            >
                                <option value="">Select Course</option>
                                {courses.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="overflow-y-auto flex-1 divide-y border rounded-2xl p-4 space-y-3 custom-scrollbar">
                            {batchStudents.length === 0 ? (
                                <p className="text-xs text-center text-gray-400 py-8 font-black uppercase">No students enrolled in this course.</p>
                            ) : (
                                batchStudents.map(s => (
                                    <div key={s.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-3">
                                        <div>
                                            <p className="text-xs font-black text-black uppercase">{s.name}</p>
                                            <p className="text-[10px] text-black/40 font-bold uppercase">{s.id}</p>
                                        </div>
                                        <div className="flex items-center gap-3 w-full sm:w-auto">
                                            <input
                                                type="number"
                                                step="0.5"
                                                min="0"
                                                max="100"
                                                placeholder="Marks"
                                                value={batchEntries[s.id]?.marks || ''}
                                                onChange={e => setBatchEntries({
                                                    ...batchEntries,
                                                    [s.id]: { ...batchEntries[s.id], marks: e.target.value }
                                                })}
                                                className="w-24 p-2.5 bg-gray-50 border rounded-xl text-xs font-black text-center outline-none"
                                            />
                                            <select
                                                value={batchEntries[s.id]?.status || 'Present'}
                                                onChange={e => setBatchEntries({
                                                    ...batchEntries,
                                                    [s.id]: { ...batchEntries[s.id], status: e.target.value }
                                                })}
                                                className="p-2.5 bg-gray-50 border rounded-xl text-xs font-bold uppercase outline-none"
                                            >
                                                <option value="Present">Present</option>
                                                <option value="Absent">Absent</option>
                                                <option value="Exempted">Exempted</option>
                                            </select>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="flex gap-3 pt-4 shrink-0">
                            <button
                                onClick={handleSaveBatch}
                                disabled={submittingBatch}
                                className="flex-1 bg-maroon text-gold py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-maroon/90 shadow-lg disabled:opacity-50"
                            >
                                {submittingBatch ? 'Saving…' : 'Save Batch Results (Draft)'}
                            </button>
                            <button onClick={() => setShowBatchModal(false)} className="px-6 py-3.5 border rounded-2xl text-xs font-black uppercase text-gray-500">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create / Edit CAT Period Modal */}
            {showPeriodModal && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl space-y-6">
                        <div className="flex justify-between items-center border-b pb-4">
                            <h3 className="text-xl font-black text-black uppercase">
                                {editingPeriod ? 'Edit CAT Period' : 'New CAT Assessment Period'}
                            </h3>
                            <button onClick={() => setShowPeriodModal(false)} className="p-2 text-gray-400 hover:text-black">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSavePeriod} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-black/60">Academic Year</label>
                                    <input
                                        type="text"
                                        placeholder="2026"
                                        value={periodForm.academic_year}
                                        onChange={e => setPeriodForm({ ...periodForm, academic_year: e.target.value })}
                                        className="w-full mt-1 p-3 bg-gray-50 border rounded-2xl text-xs font-black outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-black/60">Term Name</label>
                                    <input
                                        type="text"
                                        placeholder="Term 1"
                                        value={periodForm.term_name}
                                        onChange={e => setPeriodForm({ ...periodForm, term_name: e.target.value })}
                                        className="w-full mt-1 p-3 bg-gray-50 border rounded-2xl text-xs font-black outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-black/60">CAT Name</label>
                                    <input
                                        type="text"
                                        placeholder="CAT 1"
                                        value={periodForm.cat_name}
                                        onChange={e => setPeriodForm({ ...periodForm, cat_name: e.target.value })}
                                        className="w-full mt-1 p-3 bg-gray-50 border rounded-2xl text-xs font-black outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-black/60">Max Marks</label>
                                    <input
                                        type="number"
                                        placeholder="100"
                                        value={periodForm.max_marks}
                                        onChange={e => setPeriodForm({ ...periodForm, max_marks: e.target.value })}
                                        className="w-full mt-1 p-3 bg-gray-50 border rounded-2xl text-xs font-black outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase text-black/60">Status</label>
                                <select
                                    value={periodForm.status}
                                    onChange={e => setPeriodForm({ ...periodForm, status: e.target.value })}
                                    className="w-full mt-1 p-3 bg-gray-50 border rounded-2xl text-xs font-black uppercase outline-none"
                                >
                                    <option value="Active">Active</option>
                                    <option value="Closed">Closed</option>
                                    <option value="Archived">Archived</option>
                                </select>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="submit" className="flex-1 bg-maroon text-gold py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-maroon/90 shadow-lg">
                                    Save CAT Period
                                </button>
                                <button type="button" onClick={() => setShowPeriodModal(false)} className="px-6 py-3.5 border rounded-2xl text-xs font-black uppercase text-gray-500">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Audit Log Modal */}
            {showAuditModal && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] p-8 max-w-4xl w-full shadow-2xl space-y-6 max-h-[85vh] flex flex-col">
                        <div className="flex justify-between items-center border-b pb-4 shrink-0">
                            <div>
                                <h3 className="text-xl font-black text-black uppercase">Result Change Audit Trail</h3>
                                <p className="text-xs font-bold text-black/40 uppercase">Complete historical log of mark modifications</p>
                            </div>
                            <button onClick={() => setShowAuditModal(false)} className="p-2 text-gray-400 hover:text-black">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 custom-scrollbar">
                            {auditLogs.length === 0 ? (
                                <p className="text-xs text-center text-gray-400 py-12 font-black uppercase">No audit entries found for this period.</p>
                            ) : (
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-black/[0.02] border-b text-[9px] font-black text-black/40 uppercase tracking-widest">
                                            <th className="px-4 py-3 text-left">Action</th>
                                            <th className="px-4 py-3 text-left">Unit</th>
                                            <th className="px-4 py-3 text-left">Marks Change</th>
                                            <th className="px-4 py-3 text-left">Status Transition</th>
                                            <th className="px-4 py-3 text-left">User</th>
                                            <th className="px-4 py-3 text-left">Timestamp</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-black/5">
                                        {auditLogs.map(log => (
                                            <tr key={log.id} className="text-xs font-bold">
                                                <td className="px-4 py-3 text-maroon font-black uppercase">{log.action}</td>
                                                <td className="px-4 py-3 uppercase">{log.unit_name}</td>
                                                <td className="px-4 py-3">
                                                    {log.previous_marks !== null ? `${log.previous_marks} → ${log.new_marks}` : `${log.new_marks || '—'}`}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {log.previous_status ? `${log.previous_status} → ${log.new_status}` : log.new_status}
                                                </td>
                                                <td className="px-4 py-3 text-black/60">{log.changed_by_name || log.changed_by}</td>
                                                <td className="px-4 py-3 text-black/40 text-[10px]">{new Date(log.created_at).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="pt-2 shrink-0">
                            <button onClick={() => setShowAuditModal(false)} className="w-full bg-black text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest">
                                Close Audit Log
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Result Slip Printable Modal */}
            {showResultSlipModal && slipStudentTarget && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-[2.5rem] p-8 max-w-2xl w-full shadow-2xl space-y-6">
                        <div className="flex justify-between items-center border-b pb-4">
                            <h3 className="text-lg font-black text-black uppercase">Official CAT Result Slip</h3>
                            <div className="flex gap-2">
                                <button onClick={downloadSlipPDF} className="bg-maroon text-gold px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md">
                                    <FileDown className="w-4 h-4" /> Export PDF
                                </button>
                                <button onClick={() => setShowResultSlipModal(false)} className="p-2 text-gray-400 hover:text-black">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Printable Area */}
                        <div id="cat-result-slip-printable" className="p-8 border border-black/10 rounded-2xl space-y-6 bg-white">
                            {/* Header */}
                            <div className="flex justify-between items-center border-b-2 border-maroon pb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-maroon rounded-xl flex items-center justify-center text-white font-black text-xl">
                                        B
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-black text-maroon uppercase tracking-tight">BEAUTEX TECHNICAL COLLEGE</h2>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Official Continuous Assessment Statement</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-black text-black uppercase">{currentPeriodObj?.cat_name || 'CAT Result'}</p>
                                    <p className="text-[10px] font-bold text-gray-500">{currentPeriodObj?.academic_year} {currentPeriodObj?.term_name}</p>
                                </div>
                            </div>

                            {/* Student Meta */}
                            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl text-xs font-bold border border-gray-100">
                                <div>
                                    <span className="text-[10px] font-black text-gray-400 uppercase block">Student Name</span>
                                    <span className="text-black font-black uppercase">{slipStudentTarget.student.name}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black text-gray-400 uppercase block">Reg ID</span>
                                    <span className="text-black font-black uppercase">{slipStudentTarget.student.reg_id}</span>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-[10px] font-black text-gray-400 uppercase block">Enrolled Course</span>
                                    <span className="text-black font-black uppercase">{slipStudentTarget.student.course_name}</span>
                                </div>
                            </div>

                            {/* Marks Table */}
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-black text-[10px] font-black uppercase text-black/60">
                                        <th className="py-2 text-left">Unit Title</th>
                                        <th className="py-2 text-center">Score / {currentPeriodObj?.max_marks || 100}</th>
                                        <th className="py-2 text-center">%</th>
                                        <th className="py-2 text-right">Grade</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 text-xs font-bold">
                                    {slipStudentTarget.results.map(r => (
                                        <tr key={r.id}>
                                            <td className="py-2.5 text-left uppercase">{r.unit_name}</td>
                                            <td className="py-2.5 text-center font-black">{r.marks !== null ? r.marks : '—'}</td>
                                            <td className="py-2.5 text-center text-maroon font-black">{r.percentage !== null ? `${r.percentage}%` : '—'}</td>
                                            <td className="py-2.5 text-right font-black uppercase">{r.grade || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    {(() => {
                                        const validScores = slipStudentTarget.results.filter(r => r.percentage !== null && r.percentage !== undefined);
                                        if (validScores.length === 0) return null;
                                        const avgPct = Math.round((validScores.reduce((acc, r) => acc + parseFloat(r.percentage), 0) / validScores.length) * 10) / 10;
                                        let overallGrade = 'Fail';
                                        if (avgPct >= 70) overallGrade = 'Distinction';
                                        else if (avgPct >= 60) overallGrade = 'Credit';
                                        else if (avgPct >= 50) overallGrade = 'Pass';

                                        return (
                                            <tr className="border-t-2 border-maroon bg-maroon/5 text-xs font-black">
                                                <td className="py-3.5 text-left uppercase text-maroon">CUMULATIVE OVERALL TOTAL SUMMARY</td>
                                                <td className="py-3.5 text-center text-maroon font-black">{validScores.length} Units Evaluated</td>
                                                <td className="py-3.5 text-center text-maroon font-black text-sm">{avgPct}%</td>
                                                <td className="py-3.5 text-right uppercase text-maroon font-black text-sm">{overallGrade}</td>
                                            </tr>
                                        );
                                    })()}
                                </tfoot>
                            </table>


                            {/* Footer Signatures */}
                            <div className="pt-8 border-t flex justify-between items-end text-[10px] font-black uppercase text-gray-500">
                                <div>
                                    <div className="w-32 border-b border-black mb-1"></div>
                                    <span>Head of Academics</span>
                                </div>
                                <div className="text-right">
                                    <div className="w-32 border-b border-black mb-1 ml-auto"></div>
                                    <span>College Registrar</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
