import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { courseUnitsAPI, studentUnitMarksAPI, coursesAPI, studentsAPI, settingsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
    BookOpen, Award, Search, Plus, X, Edit, Trash2, Users, CheckCircle,
    FileDown, Printer, History, ChevronDown, ChevronUp, TrendingUp, GraduationCap, Layers, AlertTriangle
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ── Grade helpers ─────────────────────────────────────────────────────────────

function calcGradeLabel(marks, thresholds) {
    const { distinction = 80, credit = 65, pass = 50 } = thresholds || {};
    if (marks >= distinction) return 'Distinction';
    if (marks >= credit)      return 'Credit';
    if (marks >= pass)        return 'Pass';
    return 'Fail';
}

const GRADE_COLORS = {
    Distinction: 'bg-green-50 text-green-700 border-green-200',
    Credit:      'bg-blue-50 text-blue-700 border-blue-200',
    Pass:        'bg-amber-50 text-amber-700 border-amber-200',
    Fail:        'bg-red-50 text-red-600 border-red-200',
};

function GradeChip({ marks, grade }) {
    const color = GRADE_COLORS[grade] || 'bg-gray-50 text-gray-400 border-gray-200';
    return (
        <div className={`inline-flex flex-col items-center px-3 py-1.5 rounded-xl border font-black text-xs ${color}`}>
            <span>{marks}%</span>
            <span className="text-[8px] font-bold opacity-70 mt-0.5">{grade}</span>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function UnitsCovered() {
    const { user } = useAuth();
    const isStudent  = (user?.role || '').toLowerCase() === 'student';
    const isTeacher  = (user?.role || '').toLowerCase() === 'teacher';
    const canManage  = ['admin', 'superadmin', 'teacher'].includes((user?.role || '').toLowerCase());

    // ── State ─────────────────────────────────────────────────────────────────
    const [settings, setSettings]     = useState({ grading_distinction_min: 80, grading_credit_min: 65, grading_pass_min: 50 });
    const [courses, setCourses]       = useState([]);
    const [students, setStudents]     = useState([]);
    const [units, setUnits]           = useState([]);         // units for selected course
    const [marks, setMarks]           = useState([]);         // all unit marks visible to user
    const [loading, setLoading]       = useState(true);
    const [selectedCourse, setSelectedCourse] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [logoDataUrl, setLogoDataUrl]       = useState('');

    // Toast notification state
    const [toast, setToast] = useState(null);
    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
    }, []);

    // Clear toast timer helper
    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(t);
    }, [toast]);

    // Batch entry state
    const [showBatchModal, setShowBatchModal]   = useState(false);
    const [batchUnit, setBatchUnit]             = useState('');
    const [batchStudents, setBatchStudents]     = useState([]);
    const [batchMarks, setBatchMarks]           = useState({});
    const [submittingBatch, setSubmittingBatch] = useState(false);

    // Expandable unit rows in admin table (key = studentId-courseId)
    const [expandedRows, setExpandedRows] = useState({});
    const toggleRow = (key) => setExpandedRows(prev => ({ ...prev, [key]: !prev[key] }));

    // Custom confirm dialog state
    const [confirmDialog, setConfirmDialog] = useState(null); // { message, onConfirm }
    const openConfirm = (message, onConfirm) => setConfirmDialog({ message, onConfirm });
    const closeConfirm = () => setConfirmDialog(null);

    // Single entry state
    const [showModal, setShowModal]       = useState(false);
    const [editingMark, setEditingMark]   = useState(null);
    const [singleForm, setSingleForm]     = useState({ student_id: '', course_id: '', unit_id: '', marks: '' });

    // Transcript state
    const [printTarget, setPrintTarget]   = useState(null); // { student, marks }
    const [viewTarget, setViewTarget]     = useState(null);

    // Manage units state
    const [showManageUnitsModal, setShowManageUnitsModal] = useState(false);
    const [newUnitName, setNewUnitName]                   = useState('');
    const [editingUnitId, setEditingUnitId]               = useState(null);
    const [editingUnitName, setEditingUnitName]           = useState('');

    // URL param support: ?course=COURSE_ID auto-selects course + opens manage modal
    const [searchParams] = useSearchParams();
    const urlCourse = searchParams.get('course');

    const refreshUnits = useCallback(() => {
        if (!selectedCourse) { setUnits([]); return; }
        courseUnitsAPI.getUnits(selectedCourse)
            .then(res => setUnits(res?.data || []))
            .catch(() => setUnits([]));
    }, [selectedCourse]);

    const handleAddUnit = async (e) => {
        e.preventDefault();
        if (!newUnitName.trim() || !selectedCourse) return;
        try {
            await courseUnitsAPI.createUnit(selectedCourse, { name: newUnitName.trim() });
            setNewUnitName('');
            refreshUnits();
            showToast('Unit added successfully.', 'success');
        } catch (err) {
            console.error(err);
            showToast('Failed to add unit.', 'error');
        }
    };

    const handleUpdateUnit = async (unitId) => {
        if (!editingUnitName.trim() || !selectedCourse) return;
        try {
            await courseUnitsAPI.updateUnit(selectedCourse, unitId, { name: editingUnitName.trim() });
            setEditingUnitId(null);
            setEditingUnitName('');
            refreshUnits();
            showToast('Unit updated successfully.', 'success');
        } catch (err) {
            console.error(err);
            showToast('Failed to update unit.', 'error');
        }
    };

    const handleDeleteUnit = async (unitId) => {
        openConfirm('Delete this unit? This will also remove all student marks recorded for it.', async () => {
            try {
                await courseUnitsAPI.deleteUnit(selectedCourse, unitId);
                refreshUnits();
                showToast('Unit deleted successfully.', 'success');
            } catch (err) {
                console.error(err);
                showToast('Failed to delete unit.', 'error');
            }
        });
    };

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
        } catch (err) {
            console.error(err);
            refreshUnits();
        }
    };


    const thresholds = {
        distinction: parseFloat(settings.grading_distinction_min) || 80,
        credit:      parseFloat(settings.grading_credit_min)      || 65,
        pass:        parseFloat(settings.grading_pass_min)         || 50,
    };

    // ── Load Logo ──────────────────────────────────────────────────────────────
    useEffect(() => {
        fetch('/app-icon-v2.png')
            .then(r => r.blob())
            .then(blob => {
                const reader = new FileReader();
                reader.onloadend = () => setLogoDataUrl(reader.result);
                reader.readAsDataURL(blob);
            })
            .catch(() => setLogoDataUrl('/app-icon-v2.png'));
    }, []);

    // ── Initial data load ──────────────────────────────────────────────────────
    const loadAll = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const studentId = user.student_id || user.id;
            const [settingsRes, coursesRes, studentsRes, marksRes] = await Promise.all([
                settingsAPI.get().catch(() => ({ data: {} })),
                coursesAPI.getAll().catch(() => ({ data: [] })),
                canManage
                    ? studentsAPI.getAll().catch(() => ({ data: [] }))
                    : isStudent
                        ? studentsAPI.getById(studentId).catch(() => ({ data: null }))
                        : Promise.resolve({ data: [] }),
                studentUnitMarksAPI.getMarks(
                    isStudent ? { student_id: studentId } : {}
                ).catch(() => ({ data: [] })),
            ]);
            if (settingsRes?.data) setSettings(prev => ({ ...prev, ...settingsRes.data }));
            // Teachers only see their assigned courses
            const allCourses = coursesRes?.data || [];
            const visibleCourses = isTeacher
                ? allCourses.filter(c => c.instructor && c.instructor.toLowerCase() === (user?.name || '').toLowerCase())
                : allCourses;
            setCourses(visibleCourses.length > 0 ? visibleCourses : allCourses);
            // For students, studentsRes.data is a single object; for others it's an array
            if (isStudent) {
                const sData = studentsRes?.data;
                setStudents(sData ? [sData] : []);
            } else {
                setStudents(Array.isArray(studentsRes?.data) ? studentsRes.data : []);
            }
            setMarks(Array.isArray(marksRes?.data) ? marksRes.data : []);
        } finally {
            setLoading(false);
        }
    }, [user, isStudent, canManage]);

    useEffect(() => { loadAll(); }, [loadAll]);

    // Auto-select course + open manage modal when navigated from TeacherDashboard
    useEffect(() => {
        if (urlCourse && canManage) {
            setSelectedCourse(urlCourse);
            // Slight delay so units load first
            const t = setTimeout(() => setShowManageUnitsModal(true), 600);
            return () => clearTimeout(t);
        }
    }, [urlCourse, canManage]);

    // ── Load units when course changes ─────────────────────────────────────────
    useEffect(() => {
        refreshUnits();
    }, [selectedCourse, refreshUnits]);

    // ── Batch modal: load students for selected course ─────────────────────────
    const loadBatchStudents = async (courseId) => {
        if (!courseId) return;
        // Filter from already-loaded students list
        const course = courses.find(c => c.id === courseId);
        if (!course) return;
        const enrolled = students.filter(s => {
            const sc = Array.isArray(s.course) ? s.course : [s.course];
            return sc.some(cn => cn?.toLowerCase() === course.name?.toLowerCase());
        });
        setBatchStudents(enrolled);
        const initMarks = {};
        enrolled.forEach(s => { initMarks[s.id] = ''; });
        setBatchMarks(initMarks);
    };

    // ── Batch submit ───────────────────────────────────────────────────────────
    const handleBatchSubmit = async () => {
        if (!selectedCourse || !batchUnit) return showToast('Select a course and unit first.', 'error');
        const entries = Object.entries(batchMarks)
            .filter(([, v]) => v !== '')
            .map(([student_id, marksVal]) => ({ student_id, marks: Number(marksVal) }));
        if (entries.length === 0) return showToast('No marks entered.', 'error');
        try {
            setSubmittingBatch(true);
            await studentUnitMarksAPI.batchSave({ course_id: selectedCourse, unit_id: batchUnit, entries });
            setShowBatchModal(false);
            setBatchUnit('');
            await loadAll();
            showToast(`Saved marks for ${entries.length} students.`, 'success');
        } catch (e) {
            console.error(e);
            showToast('Failed to save batch marks.', 'error');
        } finally {
            setSubmittingBatch(false);
        }
    };

    // ── Single mark submit ─────────────────────────────────────────────────────
    const handleSingleSubmit = async (e) => {
        e.preventDefault();
        try {
            await studentUnitMarksAPI.saveMark(singleForm);
            setShowModal(false);
            setEditingMark(null);
            setSingleForm({ student_id: '', course_id: '', unit_id: '', marks: '' });
            await loadAll();
            showToast(editingMark ? 'Mark updated successfully.' : 'Mark recorded successfully.', 'success');
        } catch (err) {
            console.error(err);
            showToast('Failed to save mark.', 'error');
        }
    };

    const handleEditMark = (mark) => {
        setEditingMark(mark);
        setSingleForm({ student_id: mark.student_id, course_id: mark.course_id, unit_id: mark.unit_id, marks: mark.marks });
        setShowModal(true);
    };

    const handleDeleteMark = async (id) => {
        openConfirm('Delete this mark record? This action cannot be undone.', async () => {
            try {
                await studentUnitMarksAPI.deleteMark(id);
                await loadAll();
                showToast('Mark deleted successfully.', 'success');
            } catch (e) {
                console.error(e);
                showToast('Failed to delete mark.', 'error');
            }
        });
    };

    // ── Transcript generation ──────────────────────────────────────────────────
    const handleViewTranscript = (studentId, courseId) => {
        if (!courseId) return showToast('Course ID is required.', 'error');
        const student = students.find(s => String(s.id) === String(studentId));
        if (!student) return showToast('Student not found.', 'error');
        
        // Filter marks for this student and this course only
        const studentMarks = marks.filter(m => String(m.student_id) === String(studentId) && String(m.course_id) === String(courseId));
        if (!studentMarks || studentMarks.length === 0) {
            return showToast("No completed academic records were found for the selected course.", 'error');
        }
        
        const completionDate = student.completion_date || student.expected_completion;
        if (!completionDate) {
            return showToast("No completed academic records were found for the selected course (Missing Completion Date).", 'error');
        }

        setViewTarget({ student, marks: studentMarks, courseId });
    };

    const handleDownloadTranscript = async (studentId, courseId) => {
        if (!courseId) return showToast('Course ID is required.', 'error');
        const student = students.find(s => String(s.id) === String(studentId));
        if (!student) return showToast('Student not found.', 'error');
        
        // Filter marks for this student and this course only
        const studentMarks = marks.filter(m => String(m.student_id) === String(studentId) && String(m.course_id) === String(courseId));
        if (!studentMarks || studentMarks.length === 0) {
            return showToast("No completed academic records were found for the selected course.", 'error');
        }
        
        const completionDate = student.completion_date || student.expected_completion;
        if (!completionDate) {
            return showToast("No completed academic records were found for the selected course (Missing Completion Date).", 'error');
        }

        // Helper to convert image URL to base64 data URL
        const urlToBase64 = async (url) => {
            if (!url) return '';
            if (url.startsWith('data:')) return url;
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`Status ${res.status}`);
                const blob = await res.blob();
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = () => resolve('');
                    reader.readAsDataURL(blob);
                });
            } catch (e) {
                console.error('urlToBase64 failed for:', url, e);
                return '';
            }
        };

        // Pre-convert student photo and logo to base64 to avoid CORS/tainting/decoding lag
        let logoB64 = logoDataUrl;
        if (!logoB64 || !logoB64.startsWith('data:')) {
            logoB64 = await urlToBase64('/app-icon-v2.png');
        }

        let photoB64 = '';
        if (student.photo) {
            const pUrl = String(student.photo).trim();
            const hasPhoto = pUrl && pUrl !== 'null' && pUrl !== 'undefined' && !pUrl.endsWith('/null') && !pUrl.endsWith('/undefined');
            if (hasPhoto) {
                photoB64 = await urlToBase64(pUrl);
            }
        }

        // Pass base64 data to target
        setPrintTarget({
            student: { ...student, photoB64 },
            marks: studentMarks,
            logoB64
        });

        setTimeout(async () => {
            const wrapper = document.getElementById('units-printable-report');
            const element = document.getElementById('units-print-a4-inner');
            if (!element || !wrapper) {
                showToast('Could not find transcript template. Please try again.', 'error');
                setPrintTarget(null);
                return;
            }
            try {
                // Move wrapper to a visible position BEHIND the loading overlay (z-9998)
                // so html2canvas can fully render it, but the user only sees the spinner
                const prevStyle = wrapper.getAttribute('style');
                wrapper.style.position   = 'fixed';
                wrapper.style.left       = '0px';
                wrapper.style.top        = '0px';
                wrapper.style.zIndex     = '9997';
                wrapper.style.visibility = 'visible';
                wrapper.style.opacity    = '1';

                // Wait for all images to be fully loaded and decoded
                const images = Array.from(element.querySelectorAll('img'));
                await Promise.all(images.map(async (img) => {
                    try {
                        if (!img.complete) {
                            await new Promise((resolve) => {
                                img.onload = resolve;
                                img.onerror = resolve;
                            });
                        }
                        if (img.naturalWidth === 0 || img.naturalHeight === 0) {
                            img.style.display = 'none';
                        } else if (typeof img.decode === 'function') {
                            await img.decode().catch(err => console.warn('img.decode failed:', err));
                        }
                    } catch (e) {
                        console.warn('Failed to load/decode image:', e);
                        img.style.display = 'none';
                    }
                }));

                // Wait for Google font to be ready for clean rendering
                if (document.fonts && typeof document.fonts.ready === 'object') {
                    await document.fonts.ready;
                }

                // Additional wait for layout to fully paint
                await new Promise(r => setTimeout(r, 400));

                const canvas = await html2canvas(element, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    ignoreElements: (el) => {
                        const rect = el.getBoundingClientRect();
                        return rect.width === 0 && rect.height === 0;
                    },
                });

                // Restore wrapper to original off-screen position
                if (prevStyle) {
                    wrapper.setAttribute('style', prevStyle);
                } else {
                    wrapper.style.position   = 'absolute';
                    wrapper.style.left       = '-9999px';
                    wrapper.style.top        = '0px';
                    wrapper.style.zIndex     = '-1';
                    wrapper.style.visibility = 'hidden';
                    wrapper.style.opacity    = '0';
                }

                if (canvas.width === 0 || canvas.height === 0) {
                    throw new Error('Canvas has zero dimensions — element may not have rendered.');
                }

                const pdf     = new jsPDF('p', 'mm', 'a4');
                const pw      = pdf.internal.pageSize.getWidth();
                const ph      = pdf.internal.pageSize.getHeight();
                const imgData = canvas.toDataURL('image/png');
                const ratio   = canvas.height / canvas.width;
                pdf.addImage(imgData, 'PNG', 0, 0, pw, Math.min(pw * ratio, ph));
                
                const courseName = studentMarks[0]?.course_name || 'Course';
                pdf.save(`${student.name.replace(/\s+/g, '_')}_Transcript_${courseName.replace(/\s+/g, '_')}.pdf`);
            } catch (err) {
                console.error('Transcript PDF error:', err);
                showToast(`Failed to generate transcript PDF. Error: ${err.message || String(err)}`, 'error');
            } finally {
                setPrintTarget(null);
            }
        }, 1200);
    };

    // ── Computed data ──────────────────────────────────────────────────────────

    // Filter marks by search + selected course
    const filteredMarks = marks.filter(m => {
        const search = searchTerm.toLowerCase().trim();
        const matchSearch = !search ||
            (m.student_name || '').toLowerCase().includes(search) ||
            String(m.student_id).toLowerCase().includes(search) ||
            (m.course_name || '').toLowerCase().includes(search) ||
            (m.unit_name || '').toLowerCase().includes(search);
        const matchCourse = !selectedCourse || m.course_id === selectedCourse;
        return matchSearch && matchCourse;
    });

    // Group marks by student → course → units (for admin matrix)
    const studentCourseMap = {};
    filteredMarks.forEach(m => {
        const sid = String(m.student_id);
        const cid = String(m.course_id);
        if (!studentCourseMap[sid]) studentCourseMap[sid] = { studentId: sid, studentName: m.student_name || sid, courses: {} };
        if (!studentCourseMap[sid].courses[cid]) {
            studentCourseMap[sid].courses[cid] = { courseId: cid, courseName: m.course_name || cid, units: [] };
        }
        studentCourseMap[sid].courses[cid].units.push(m);
    });
    const studentRows = Object.values(studentCourseMap).sort((a, b) => a.studentName.localeCompare(b.studentName));

    // For student view: group own marks by course
    const ownByCourse = {};
    filteredMarks.forEach(m => {
        const cid = m.course_id;
        if (!ownByCourse[cid]) ownByCourse[cid] = { courseName: m.course_name || cid, units: [] };
        ownByCourse[cid].units.push(m);
    });

    // Stats
    const allMarsValues = filteredMarks.map(m => parseFloat(m.marks) || 0);
    const avgMarks = allMarsValues.length > 0 ? Math.round(allMarsValues.reduce((a, b) => a + b, 0) / allMarsValues.length) : 0;

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-maroon border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-black uppercase tracking-[0.2em] text-maroon animate-pulse">Loading Units Registry...</p>
            </div>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-10 py-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">

            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-white border border-black/5 shadow-xl rounded-2xl text-maroon">
                            <Layers className="w-6 h-6" />
                        </div>
                        <h1 className="text-2xl sm:text-4xl font-black text-black tracking-tight uppercase">
                            {isStudent ? 'My Units Covered' : 'Units Covered Registry'}
                        </h1>
                    </div>
                    <p className="text-xs text-black/40 font-bold tracking-[0.3em] uppercase sm:pl-14">
                        Competency-Based Assessment Tracker
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-4 w-full sm:w-auto">
                    <button
                        onClick={loadAll}
                        className="bg-white text-maroon p-3 sm:p-4 rounded-2xl hover:bg-maroon hover:text-white transition-all shadow-xl border border-maroon/10 group"
                        title="Refresh"
                    >
                        <History className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                    </button>
                    {isStudent && (
                        <button
                            onClick={() => {
                                const sid = user.student_id || user.id;
                                const courseIds = Object.keys(ownByCourse);
                                if (courseIds.length === 0) {
                                    alert("No completed academic records were found for the selected course.");
                                    return;
                                }
                                courseIds.forEach((cid, index) => {
                                    setTimeout(() => {
                                        handleDownloadTranscript(sid, cid);
                                    }, index * 1600);
                                });
                            }}
                            className="flex-1 sm:flex-none bg-maroon text-gold px-4 sm:px-8 py-3 sm:py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-elite-maroon transition-all shadow-2xl hover:scale-105 active:scale-95 font-black text-xs uppercase tracking-widest border border-black/5"
                        >
                            <FileDown className="w-5 h-5" /> Download Transcript(s)
                        </button>
                    )}
                    {canManage && (
                        <>
                            <button
                                onClick={() => {
                                    if (!selectedCourse) return alert('Select a course first.');
                                    loadBatchStudents(selectedCourse);
                                    setBatchUnit('');
                                    setBatchMarks({});
                                    setShowBatchModal(true);
                                }}
                                className="flex-1 sm:flex-none bg-white text-maroon px-4 sm:px-8 py-3 sm:py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-maroon hover:text-white transition-all shadow-2xl hover:scale-105 active:scale-95 font-black text-xs uppercase tracking-widest border border-maroon/10"
                            >
                                <Users className="w-5 h-5" /> Batch Entry
                            </button>
                            <button
                                onClick={() => { setEditingMark(null); setSingleForm({ student_id: '', course_id: selectedCourse, unit_id: '', marks: '' }); setShowModal(true); }}
                                className="flex-1 sm:flex-none bg-maroon text-gold px-4 sm:px-8 py-3 sm:py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-elite-maroon transition-all shadow-2xl hover:scale-105 active:scale-95 font-black text-xs uppercase tracking-widest border border-black/5"
                            >
                                <Plus className="w-5 h-5" /> Record Mark
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* ── Stats (student) ─────────────────────────────────────────────── */}
            {isStudent && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-6 opacity-[0.03]"><TrendingUp className="w-24 h-24 text-black" /></div>
                        <p className="text-black/40 text-[10px] font-black uppercase tracking-widest mb-2">Overall Average</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-black text-black">{avgMarks}%</span>
                        </div>
                        <div className="mt-6 h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
                            <div className="h-full bg-maroon transition-all duration-1000" style={{ width: `${avgMarks}%` }} />
                        </div>
                    </div>
                    <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-2xl">
                        <p className="text-black/40 text-[10px] font-black uppercase tracking-widest mb-2">Units Completed</p>
                        <p className="text-5xl font-black text-black">{marks.length}</p>
                        <p className="text-[10px] text-black/30 mt-3 font-bold uppercase tracking-wider">Across all courses</p>
                    </div>
                    {(() => {
                        const standing = calcGradeLabel(avgMarks, thresholds);
                        const standingStyles = {
                            Distinction: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', sub: 'text-green-500' },
                            Credit:      { bg: 'bg-blue-50 border-blue-200',   text: 'text-blue-700',  sub: 'text-blue-500' },
                            Pass:        { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', sub: 'text-amber-500' },
                            Fail:        { bg: 'bg-red-50 border-red-200',     text: 'text-red-700',   sub: 'text-red-400' },
                        };
                        const ss = standingStyles[standing] || { bg: 'bg-white border-black/5', text: 'text-black', sub: 'text-maroon' };
                        return (
                            <div className={`p-8 rounded-[2.5rem] border shadow-2xl ${ss.bg}`}>
                                <p className={`text-[10px] font-black uppercase tracking-widest mb-2 opacity-60 ${ss.text}`}>Current Standing</p>
                                <p className={`text-3xl font-black uppercase ${ss.text}`}>{standing}</p>
                                <p className={`text-[10px] mt-3 font-bold uppercase tracking-wider ${ss.sub}`}>Competency Profile</p>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* ── Main Registry Card ──────────────────────────────────────────── */}
            <div className="card-light overflow-hidden shadow-2xl border border-maroon/5 min-h-[500px]">
                {/* Toolbar */}
                <div className="bg-maroon/[0.02] px-4 sm:px-10 py-5 sm:py-8 border-b border-black/5 flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-xl sm:text-2xl font-black text-black uppercase tracking-tight">Units Covered Matrix</h3>
                            <p className="text-xs text-black/30 font-bold mt-1 uppercase tracking-widest">
                                {filteredMarks.length} marks recorded across {Object.keys(isStudent ? ownByCourse : studentCourseMap).length} {isStudent ? 'courses' : 'students'}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Course filter */}
                            <select
                                value={selectedCourse}
                                onChange={e => setSelectedCourse(e.target.value)}
                                className="bg-white border border-black/10 rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-black outline-none shadow-sm"
                            >
                                <option value="">All Courses</option>
                                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            {canManage && selectedCourse && (
                                <button
                                    onClick={() => setShowManageUnitsModal(true)}
                                    className="bg-white border border-maroon/20 hover:bg-maroon hover:text-white px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-maroon transition-all shadow-sm flex items-center gap-1.5"
                                >
                                    <BookOpen className="w-3.5 h-3.5" /> Manage Units
                                </button>
                            )}
                            {/* Search */}
                            <div className="flex-1 flex items-center gap-3 bg-white border border-black/5 p-2 px-4 rounded-2xl shadow-sm min-w-[200px]">
                                <Search className={`w-4 h-4 ${searchTerm ? 'text-maroon' : 'text-gray-300'}`} />
                                <input
                                    type="text"
                                    placeholder={isStudent ? 'Search units…' : 'Search students or units…'}
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="bg-transparent border-none outline-none text-xs font-bold text-black placeholder:text-black/10 uppercase tracking-widest w-full"
                                />
                                {searchTerm && (
                                    <button onClick={() => setSearchTerm('')} className="p-1 text-gray-400 hover:text-red-500 rounded-full">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={() => window.print()}
                                className="bg-white border border-black/5 p-3 rounded-2xl text-maroon hover:bg-maroon hover:text-white transition-all shadow-sm"
                                title="Print"
                            >
                                <Printer className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Admin stats bar */}
                {canManage && (
                    <div className="grid grid-cols-2 md:grid-cols-4 border-b border-black/5 divide-x divide-black/5 bg-white/50">
                        <div className="p-6 text-center">
                            <p className="text-[9px] font-black text-black/30 uppercase tracking-[0.2em] mb-1">Average Mark</p>
                            <p className="text-xl font-black text-maroon">{avgMarks}%</p>
                        </div>
                        <div className="p-6 text-center">
                            <p className="text-[9px] font-black text-black/30 uppercase tracking-[0.2em] mb-1">Total Marks</p>
                            <p className="text-xl font-black text-black">{marks.length}</p>
                        </div>
                        <div className="p-6 text-center">
                            <p className="text-[9px] font-black text-black/30 uppercase tracking-[0.2em] mb-1">Filtered</p>
                            <p className="text-xl font-black text-black">{filteredMarks.length}</p>
                        </div>
                        <div className="p-6 text-center bg-maroon/[0.01]">
                            <p className="text-[9px] font-black text-black/30 uppercase tracking-[0.2em] mb-1">Academic Cycle</p>
                            <p className="text-xl font-black text-maroon uppercase">{new Date().getFullYear()}/{new Date().getFullYear() + 1}</p>
                        </div>
                    </div>
                )}

                {/* Table content */}
                <div className="table-container custom-scrollbar">
                    {/* Grade legend */}
                    <div className="flex flex-wrap gap-4 px-6 py-3 bg-black/[0.01] border-b border-black/5 text-[9px] font-black uppercase tracking-widest">
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-200 inline-block" />≥{thresholds.distinction}% Distinction</span>
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-200 inline-block" />≥{thresholds.credit}% Credit</span>
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-200 inline-block" />≥{thresholds.pass}% Pass</span>
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-200 inline-block" />&lt;{thresholds.pass}% Fail</span>
                    </div>

                    {/* ── STUDENT VIEW ── */}
                    {isStudent ? (
                        Object.keys(ownByCourse).length === 0 ? (
                            <div className="py-24 text-center">
                                <p className="text-[10px] font-black text-black/20 uppercase tracking-[0.3em]">No unit marks recorded yet for your courses.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-black/5">
                                {Object.entries(ownByCourse).map(([cid, { courseName, units: courseUnits }]) => {
                                    const avg = Math.round(courseUnits.reduce((a, u) => a + parseFloat(u.marks || 0), 0) / courseUnits.length);
                                    return (
                                        <div key={cid}>
                                            <div className="flex items-center justify-between bg-maroon/[0.03] px-6 py-4 border-b border-black/5">
                                                <div className="flex items-center gap-3">
                                                    <BookOpen className="w-4 h-4 text-maroon" />
                                                    <p className="text-sm font-black text-black uppercase tracking-tight">{courseName}</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => handleViewTranscript(user.student_id || user.id, cid)}
                                                        className="p-2 bg-white hover:bg-maroon hover:text-white rounded-xl transition-all border border-black/5 text-maroon shadow-sm"
                                                        title="View Transcript"
                                                    >
                                                        <BookOpen className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDownloadTranscript(user.student_id || user.id, cid)}
                                                        className="p-2 bg-maroon hover:bg-elite-maroon rounded-xl transition-all text-gold shadow-md"
                                                        title="Download Transcript PDF"
                                                    >
                                                        <FileDown className="w-3.5 h-3.5" />
                                                    </button>
                                                    <GradeChip marks={avg} grade={calcGradeLabel(avg, thresholds)} />
                                                </div>
                                            </div>
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="bg-black/[0.015] border-b border-black/5">
                                                        <th className="px-6 py-3 text-left text-[10px] font-black text-black/40 uppercase tracking-widest">Module / Unit</th>
                                                        <th className="px-6 py-3 text-center text-[10px] font-black text-black/40 uppercase tracking-widest">Marks (%)</th>
                                                        <th className="px-6 py-3 text-center text-[10px] font-black text-black/40 uppercase tracking-widest">Grade</th>
                                                        <th className="px-6 py-3 text-left text-[10px] font-black text-black/40 uppercase tracking-widest">Lecturer</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-black/5">
                                                    {courseUnits.map((u, i) => (
                                                        <tr key={i} className="hover:bg-maroon/[0.012] transition-colors">
                                                            <td className="px-6 py-4">
                                                                <p className="text-xs font-black text-black uppercase tracking-tight">{u.unit_name}</p>
                                                            </td>
                                                            <td className="px-6 py-4 text-center">
                                                                <span className="text-sm font-black text-black">{parseFloat(u.marks).toFixed(1)}%</span>
                                                            </td>
                                                            <td className="px-6 py-4 text-center">
                                                                <GradeChip marks={parseFloat(u.marks).toFixed(0)} grade={u.grade} />
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <p className="text-[11px] font-bold text-black/50 uppercase">{u.lecturer || '—'}</p>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot>
                                                    <tr className="bg-black/[0.02] border-t-2 border-maroon/20">
                                                        <td className="px-6 py-3 text-[10px] font-black text-black/40 uppercase tracking-widest">Course Average</td>
                                                        <td className="px-6 py-3 text-center"><span className="text-xs font-black text-maroon">{avg}%</span></td>
                                                        <td className="px-6 py-3 text-center"><GradeChip marks={avg} grade={calcGradeLabel(avg, thresholds)} /></td>
                                                        <td />
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    ) : (
                        /* ── ADMIN/TEACHER VIEW ── */
                        studentRows.length === 0 ? (
                            <div className="py-24 text-center">
                                <p className="text-[10px] font-black text-black/20 uppercase tracking-[0.3em]">
                                    No unit marks found. Use Batch Entry or Record Mark to begin.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-maroon/[0.03] border-b border-black/5">
                                            <th className="px-6 py-5 text-left text-[10px] font-black text-black/40 uppercase tracking-[0.2em] sticky left-0 bg-maroon/[0.03] z-10 min-w-[200px]">Student</th>
                                            <th className="px-6 py-5 text-left text-[10px] font-black text-black/40 uppercase tracking-[0.2em] min-w-[160px]">Course</th>
                                            <th className="px-6 py-5 text-left text-[10px] font-black text-black/40 uppercase tracking-[0.2em]">Units Recorded</th>
                                            <th className="px-6 py-5 text-center text-[10px] font-black text-black/40 uppercase tracking-[0.2em] min-w-[100px]">Avg</th>
                                            <th className="px-6 py-5 text-center text-[10px] font-black text-black/40 uppercase tracking-[0.2em]">Standing</th>
                                            <th className="px-6 py-5 text-center text-[10px] font-black text-black/40 uppercase tracking-[0.2em]">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-black/5">
                                        {studentRows.map(row => (
                                            Object.values(row.courses).map(course => {
                                                const avg = course.units.length > 0
                                                    ? Math.round(course.units.reduce((a, u) => a + parseFloat(u.marks || 0), 0) / course.units.length)
                                                    : 0;
                                                const grade = calcGradeLabel(avg, thresholds);
                                                return (
                                                    <tr key={`${row.studentId}-${course.courseId}`} className="hover:bg-maroon/[0.015] transition-colors group">
                                                        <td className="px-6 py-5 sticky left-0 bg-white group-hover:bg-maroon/[0.015] z-10 border-r border-black/5">
                                                            <p className="text-sm font-black text-black uppercase tracking-tight">{row.studentName}</p>
                                                            <p className="text-[8px] font-bold text-black/30 mt-0.5">{row.studentId}</p>
                                                        </td>
                                                        <td className="px-6 py-5">
                                                            <p className="text-xs font-black text-maroon uppercase tracking-tight">{course.courseName}</p>
                                                        </td>
                                                        <td className="px-6 py-5">
                                                            {(() => {
                                                                const rowKey = `${row.studentId}-${course.courseId}`;
                                                                const isExpanded = expandedRows[rowKey];
                                                                const visibleUnits = isExpanded ? course.units : course.units.slice(0, 4);
                                                                const hasMore = course.units.length > 4;
                                                                return (
                                                                    <div className="flex flex-wrap gap-1 items-center">
                                                                        {visibleUnits.map((u, i) => (
                                                                            <span key={i} className="text-[9px] font-bold text-black/40 bg-black/[0.03] px-2 py-1 rounded-full uppercase truncate max-w-[120px]" title={u.unit_name}>
                                                                                {u.unit_name}
                                                                            </span>
                                                                        ))}
                                                                        {hasMore && (
                                                                            <button
                                                                                onClick={() => toggleRow(rowKey)}
                                                                                className="text-[9px] font-black text-maroon bg-maroon/5 hover:bg-maroon/10 px-2.5 py-1 rounded-full transition-colors flex items-center gap-0.5"
                                                                            >
                                                                                {isExpanded
                                                                                    ? <><ChevronUp className="w-2.5 h-2.5" /> Less</>
                                                                                    : <>+{course.units.length - 4} more</>}
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </td>
                                                        <td className="px-6 py-5 text-center">
                                                            <span className="text-sm font-black text-black">{avg}%</span>
                                                        </td>
                                                        <td className="px-6 py-5 text-center">
                                                            <GradeChip marks={avg} grade={grade} />
                                                        </td>
                                                        <td className="px-6 py-5">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <button
                                                                    onClick={() => handleViewTranscript(row.studentId, course.courseId)}
                                                                    className="p-2 hover:bg-maroon/5 rounded-xl transition-all border border-maroon/5 text-maroon/60"
                                                                    title="View Transcript"
                                                                >
                                                                    <BookOpen className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDownloadTranscript(row.studentId, course.courseId)}
                                                                    className="p-2 hover:bg-gold hover:text-maroon rounded-xl transition-all border border-maroon/5 text-maroon"
                                                                    title="Download Transcript PDF"
                                                                >
                                                                    <FileDown className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* ── Single Mark Modal ───────────────────────────────────────────── */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setShowModal(false)} />
                    <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl border border-black/5 p-8 animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                                    {editingMark ? 'Edit Academic Mark' : 'Record Unit Mark'}
                                </h2>
                                <p className="text-[10px] text-maroon font-bold uppercase tracking-[0.2em] mt-1">Competency-Based Registry</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSingleSubmit} className="space-y-5">
                            {/* Student */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Student Name / ID</label>
                                <div className="relative">
                                    <GraduationCap className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <select required value={singleForm.student_id} onChange={e => setSingleForm({ ...singleForm, student_id: e.target.value })}
                                        className="w-full bg-gray-50/50 border border-gray-200 focus:border-maroon focus:ring-1 focus:ring-maroon outline-none rounded-xl pl-11 pr-10 py-3 text-xs font-semibold text-gray-800 transition-all appearance-none shadow-sm">
                                        <option value="">Select Student</option>
                                        {(() => {
                                            const selectedCourseObj = courses.find(c => String(c.id) === String(singleForm.course_id));
                                            const filteredStudents = selectedCourseObj
                                                ? students.filter(s => {
                                                    const sc = Array.isArray(s.course) ? s.course : [s.course];
                                                    return sc.some(cn => cn?.toLowerCase() === selectedCourseObj.name?.toLowerCase());
                                                  })
                                                : students;
                                            return filteredStudents.map(s => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>);
                                        })()}
                                    </select>
                                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* Course */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Academic Course</label>
                                <div className="relative">
                                    <BookOpen className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <select required value={singleForm.course_id}
                                        onChange={e => { setSingleForm({ ...singleForm, course_id: e.target.value, unit_id: '' }); setSelectedCourse(e.target.value); }}
                                        className="w-full bg-gray-50/50 border border-gray-200 focus:border-maroon focus:ring-1 focus:ring-maroon outline-none rounded-xl pl-11 pr-10 py-3 text-xs font-semibold text-gray-800 transition-all appearance-none shadow-sm">
                                        <option value="">Select Course</option>
                                        {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* Unit */}
                            {singleForm.course_id && (
                                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Module / Unit</label>
                                    <div className="relative">
                                        <Layers className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <select required value={singleForm.unit_id} onChange={e => setSingleForm({ ...singleForm, unit_id: e.target.value })}
                                            className="w-full bg-gray-50/50 border border-gray-200 focus:border-maroon focus:ring-1 focus:ring-maroon outline-none rounded-xl pl-11 pr-10 py-3 text-xs font-semibold text-gray-800 transition-all appearance-none shadow-sm">
                                            <option value="">Select Unit</option>
                                            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    </div>
                                </div>
                            )}

                            {/* Marks */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Awarded Marks (%)</label>
                                <div className="relative">
                                    <Award className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input required type="number" min="0" max="100" placeholder="Enter score (0–100)"
                                        value={singleForm.marks} onChange={e => setSingleForm({ ...singleForm, marks: e.target.value })}
                                        className="w-full bg-gray-50/50 border border-gray-200 focus:border-maroon focus:ring-1 focus:ring-maroon focus:bg-white outline-none rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-gray-800 transition-all placeholder:text-gray-300 placeholder:font-normal shadow-sm" />
                                </div>
                            </div>

                            {/* Warn if mark already exists */}
                            {singleForm.student_id && singleForm.course_id && singleForm.unit_id && (() => {
                                const match = marks.find(m => String(m.student_id) === String(singleForm.student_id) && String(m.course_id) === String(singleForm.course_id) && String(m.unit_id) === String(singleForm.unit_id));
                                if (match && (!editingMark || String(editingMark.id) !== String(match.id))) {
                                    return (
                                        <div className="text-[10px] font-black text-amber-700 uppercase tracking-wider bg-amber-50/70 p-4 rounded-2xl border border-amber-200/50 leading-relaxed">
                                            ⚠️ Warning: A mark of <span className="font-extrabold text-amber-800">{match.marks}%</span> is already recorded for this unit. Saving will overwrite the existing entry.
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                            <button type="submit" className="w-full bg-black text-white py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] shadow-2xl hover:bg-maroon hover:scale-[1.02] active:scale-95 transition-all mt-4">
                                {editingMark ? 'Update Mark' : 'Save Mark'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Batch Modal ─────────────────────────────────────────────────── */}
            {showBatchModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setShowBatchModal(false)} />
                    <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-black/5 p-8 animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center mb-8 flex-shrink-0">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                                    <Users className="w-5 h-5 text-maroon" /> Batch Unit Entry
                                </h2>
                                <p className="text-[10px] text-maroon font-bold uppercase tracking-[0.2em] mt-1">Record marks for an entire class in one go</p>
                            </div>
                            <button onClick={() => setShowBatchModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Unit selector */}
                        <div className="space-y-1.5 mb-6 flex-shrink-0">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Select Unit / Module</label>
                            <div className="relative">
                                <Layers className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <select value={batchUnit} onChange={e => setBatchUnit(e.target.value)}
                                    className="w-full bg-gray-50/50 border border-gray-200 focus:border-maroon focus:ring-1 focus:ring-maroon outline-none rounded-xl pl-11 pr-10 py-3 text-xs font-semibold text-gray-800 transition-all appearance-none shadow-sm">
                                    <option value="">Choose unit…</option>
                                    {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>

                        {/* Student marks table */}
                        {batchStudents.length > 0 ? (
                            <div className="flex-1 overflow-y-auto custom-scrollbar mb-8">
                                <table className="w-full text-left">
                                    <thead className="sticky top-0 bg-white z-10">
                                        <tr>
                                            <th className="py-4 text-[10px] font-black text-black/30 uppercase tracking-widest">Student</th>
                                            <th className="py-4 text-[10px] font-black text-black/30 uppercase tracking-widest text-center">Marks (%)</th>
                                            <th className="py-4 text-[10px] font-black text-black/30 uppercase tracking-widest text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-black/5">
                                        {batchStudents.map(student => (
                                            <tr key={student.id} className="hover:bg-maroon/[0.02] transition-colors">
                                                <td className="py-5">
                                                    <p className="text-xs font-black text-black uppercase tracking-tight">{student.name}</p>
                                                    <p className="text-[9px] font-bold text-black/30">{student.id}</p>
                                                </td>
                                                <td className="py-5 text-center">
                                                    <input type="number" min="0" max="100"
                                                        value={batchMarks[student.id] ?? ''}
                                                        onChange={e => setBatchMarks({ ...batchMarks, [student.id]: e.target.value })}
                                                        placeholder="—"
                                                        className="w-24 bg-white border border-black/10 rounded-xl px-4 py-3 text-center text-sm font-black text-black" />
                                                </td>
                                                <td className="py-5 text-right">
                                                    {(() => {
                                                        const existingMark = marks.find(m => String(m.student_id) === String(student.id) && String(m.course_id) === String(selectedCourse) && String(m.unit_id) === String(batchUnit));
                                                        if (batchMarks[student.id] !== '' && batchMarks[student.id] !== undefined) {
                                                            return (
                                                                <span className="text-[9px] font-black text-green-600 bg-green-50 px-3 py-1.5 rounded-full uppercase flex items-center gap-1 justify-end ml-auto w-fit">
                                                                    <CheckCircle className="w-3 h-3" /> Ready
                                                                </span>
                                                            );
                                                        }
                                                        if (existingMark) {
                                                            return (
                                                                <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full uppercase flex items-center gap-1 justify-end ml-auto w-fit">
                                                                    Saved: {existingMark.marks}%
                                                                </span>
                                                            );
                                                        }
                                                        return (
                                                            <span className="text-[9px] font-black text-black/20 uppercase tracking-widest">Pending</span>
                                                        );
                                                    })()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="flex-1 py-20 text-center">
                                <p className="text-xs font-black text-black/20 uppercase tracking-widest">No enrolled students found for this course.</p>
                            </div>
                        )}

                        <div className="flex-shrink-0 pt-5 border-t border-black/5 flex justify-between items-center">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">* Empty fields will be skipped</p>
                            <button
                                onClick={handleBatchSubmit}
                                disabled={submittingBatch || !batchUnit || batchStudents.length === 0}
                                className="bg-black text-white px-8 py-3.5 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] shadow-2xl hover:bg-maroon hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40"
                            >
                                {submittingBatch ? 'Saving…' : 'Save All Marks'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── View Transcript Modal ───────────────────────────────────────── */}
            {viewTarget && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[110]">
                    <div className="bg-white border border-maroon/10 rounded-2xl sm:rounded-[2.5rem] p-6 sm:p-10 max-w-4xl w-full shadow-2xl relative max-h-[95vh] flex flex-col overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-maroon via-gold to-maroon opacity-60 rounded-t-[2.5rem]" />
                        <div className="flex justify-between items-center mb-8 shrink-0">
                            <div>
                                <h2 className="text-2xl font-black text-black uppercase tracking-tight">Student Transcript</h2>
                                <div className="w-10 h-0.5 bg-gold mt-2" />
                                <p className="text-[10px] text-black/30 font-black uppercase tracking-widest mt-1">Units Covered — Official Academic Registry</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleDownloadTranscript(viewTarget.student.id, viewTarget.courseId)} className="p-2 bg-maroon/5 hover:bg-maroon hover:text-white rounded-xl transition-all shadow-sm">
                                    <FileDown className="w-5 h-5" />
                                </button>
                                <button onClick={() => setViewTarget(null)} className="p-2 hover:bg-maroon/5 rounded-full transition-colors">
                                    <X className="w-6 h-6 text-black/30" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar pb-10">
                            {/* Student info */}
                            <div className="flex flex-col sm:flex-row gap-6 items-start border-b border-black/5 pb-6">
                                <div className="w-20 h-20 rounded-3xl bg-maroon text-gold flex items-center justify-center text-3xl font-black shadow-xl shrink-0">
                                    {viewTarget.student.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-black uppercase tracking-tight">{viewTarget.student.name}</h3>
                                    <p className="text-xs font-bold text-black/40 uppercase tracking-widest mt-1">Student ID: {viewTarget.student.id}</p>
                                    <p className="text-[10px] font-black text-maroon uppercase tracking-widest bg-maroon/5 px-3 py-1 rounded-full inline-block mt-2">
                                        {viewTarget.student.course || 'Independent Enrollment'}
                                    </p>
                                </div>
                            </div>

                            {/* Per-course tables */}
                            {(() => {
                                const byCourse = {};
                                viewTarget.marks.forEach(m => {
                                    if (!byCourse[m.course_id]) byCourse[m.course_id] = { name: m.course_name || m.course_id, units: [] };
                                    byCourse[m.course_id].units.push(m);
                                });
                                if (Object.keys(byCourse).length === 0) return (
                                    <p className="text-center text-[10px] font-black text-black/20 uppercase tracking-widest py-12">No unit marks recorded for this student.</p>
                                );
                                return Object.entries(byCourse).map(([cid, { name, units: cu }]) => {
                                    const avg = Math.round(cu.reduce((a, u) => a + parseFloat(u.marks || 0), 0) / cu.length);
                                    return (
                                        <div key={cid} className="rounded-2xl border border-black/8 overflow-hidden">
                                            <div className="flex items-center justify-between bg-maroon/[0.04] px-6 py-4 border-b border-black/8">
                                                <div className="flex items-center gap-3">
                                                    <BookOpen className="w-4 h-4 text-maroon" />
                                                    <p className="text-sm font-black text-black uppercase tracking-tight">{name}</p>
                                                </div>
                                                <GradeChip marks={avg} grade={calcGradeLabel(avg, thresholds)} />
                                            </div>
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="bg-black/[0.015] border-b border-black/5">
                                                        <th className="px-5 py-3 text-left text-[10px] font-black text-black/40 uppercase tracking-widest">Module / Unit</th>
                                                        <th className="px-5 py-3 text-center text-[10px] font-black text-black/40 uppercase tracking-widest">Marks (%)</th>
                                                        <th className="px-5 py-3 text-center text-[10px] font-black text-black/40 uppercase tracking-widest">Grade</th>
                                                        <th className="px-5 py-3 text-left text-[10px] font-black text-black/40 uppercase tracking-widest">Lecturer</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-black/5">
                                                    {cu.map((u, i) => (
                                                        <tr key={i} className="hover:bg-maroon/[0.012] transition-colors">
                                                            <td className="px-5 py-4"><p className="text-xs font-black text-black uppercase">{u.unit_name}</p></td>
                                                            <td className="px-5 py-4 text-center"><span className="text-xs font-black text-black">{parseFloat(u.marks).toFixed(1)}%</span></td>
                                                            <td className="px-5 py-4 text-center"><GradeChip marks={parseFloat(u.marks).toFixed(0)} grade={u.grade} /></td>
                                                            <td className="px-5 py-4"><p className="text-[11px] font-bold text-black/50 uppercase">{u.lecturer || '—'}</p></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot>
                                                    <tr className="bg-black/[0.02] border-t-2 border-maroon/20">
                                                        <td className="px-5 py-3 text-[10px] font-black text-black/40 uppercase tracking-widest">Course Average</td>
                                                        <td className="px-5 py-3 text-center"><span className="text-xs font-black text-maroon">{avg}%</span></td>
                                                        <td className="px-5 py-3 text-center"><GradeChip marks={avg} grade={calcGradeLabel(avg, thresholds)} /></td>
                                                        <td />
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Manage Units Modal ────────────────────────────────────────── */}
            {showManageUnitsModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setShowManageUnitsModal(false)} />
                    <div className="relative bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl border border-black/5 p-10 animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6 flex-shrink-0">
                            <div>
                                <h2 className="text-2xl font-black text-black uppercase tracking-tight flex items-center gap-2">
                                    Manage Course Units <span className="text-xs bg-maroon/10 text-maroon px-2 py-0.5 rounded-full">{units.length}</span>
                                </h2>
                                <p className="text-[10px] text-maroon font-bold uppercase tracking-[0.2em] mt-1">
                                    Course: {courses.find(c => c.id === selectedCourse)?.name || selectedCourse}
                                </p>
                            </div>
                            <button onClick={() => setShowManageUnitsModal(false)} className="p-3 bg-white border border-black/5 hover:bg-black hover:text-white rounded-2xl transition-all shadow-sm">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Add Unit Form */}
                        <form onSubmit={handleAddUnit} className="flex gap-3 mb-6 flex-shrink-0">
                            <input
                                type="text"
                                placeholder="Enter unit / module name..."
                                value={newUnitName}
                                onChange={e => setNewUnitName(e.target.value)}
                                className="flex-1 bg-gray-50 border border-black/10 outline-none rounded-2xl px-6 py-4 text-xs font-bold text-zinc-800"
                            />
                            <button type="submit" className="bg-maroon text-gold px-6 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-1 hover:bg-elite-maroon transition-all shadow-md">
                                <Plus className="w-4 h-4" /> Add
                            </button>
                        </form>

                        {/* Units List */}
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                            {units.length === 0 ? (
                                <p className="text-center text-xs font-bold text-black/30 py-8">No units defined yet for this course.</p>
                            ) : (
                                units.map((u, index) => (
                                    <div key={u.id} className="flex items-center justify-between p-4 bg-gray-50 border border-black/5 rounded-2xl hover:border-maroon/20 transition-all">
                                        {editingUnitId === u.id ? (
                                            <div className="flex-1 flex gap-2">
                                                <input
                                                    type="text"
                                                    value={editingUnitName}
                                                    onChange={e => setEditingUnitName(e.target.value)}
                                                    className="flex-1 bg-white border border-black/10 rounded-xl px-4 py-2 text-xs font-bold text-black"
                                                />
                                                <button onClick={() => handleUpdateUnit(u.id)} className="bg-green-600 text-white px-4 rounded-xl text-xs font-black uppercase">Save</button>
                                                <button onClick={() => setEditingUnitId(null)} className="bg-gray-200 text-black px-4 rounded-xl text-xs font-black uppercase">Cancel</button>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="text-xs font-black text-black uppercase tracking-tight">{u.name}</span>
                                                <div className="flex items-center gap-2">
                                                    {/* Move Up */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMoveUnit(index, 'up')}
                                                        disabled={index === 0}
                                                        className="p-1.5 hover:bg-black/5 rounded-lg text-black/40 disabled:opacity-20 flex items-center justify-center"
                                                        title="Move Up"
                                                    >
                                                        <ChevronUp className="w-3.5 h-3.5" />
                                                    </button>
                                                    {/* Move Down */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMoveUnit(index, 'down')}
                                                        disabled={index === units.length - 1}
                                                        className="p-1.5 hover:bg-black/5 rounded-lg text-black/40 disabled:opacity-20 flex items-center justify-center"
                                                        title="Move Down"
                                                    >
                                                        <ChevronDown className="w-3.5 h-3.5" />
                                                    </button>
                                                    {/* Edit */}
                                                    <button
                                                        type="button"
                                                        onClick={() => { setEditingUnitId(u.id); setEditingUnitName(u.name); }}
                                                        className="p-1.5 hover:bg-maroon/5 rounded-lg text-maroon/60"
                                                        title="Edit Unit"
                                                    >
                                                        <Edit className="w-3.5 h-3.5" />
                                                    </button>
                                                    {/* Delete */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteUnit(u.id)}
                                                        className="p-1.5 hover:bg-red-50 rounded-lg text-red-500"
                                                        title="Delete Unit"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Printable Transcript Template ──────────────────────────────── */}
            {printTarget && (
                <>
                    {/* Loading overlay */}
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] flex items-center justify-center">
                        <div className="bg-white rounded-3xl p-10 shadow-2xl text-center">
                            <div className="w-12 h-12 border-4 border-maroon border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-sm font-black text-black uppercase tracking-widest">Generating Transcript</p>
                            <p className="text-[10px] text-black/40 font-bold uppercase tracking-widest mt-1">Please wait...</p>
                        </div>
                    </div>

                    {/* Off-screen A4 render target */}
                    <div
                        id="units-printable-report"
                        style={{ position: 'absolute', left: '-9999px', top: 0, width: '794px', zIndex: -1, background: '#ffffff', backgroundColor: '#ffffff' }}
                    >
                        <div
                            id="units-print-a4-inner"
                            style={{
                                fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
                                width: '794px',
                                background: '#ffffff',
                                backgroundColor: '#ffffff',
                                padding: '0',
                                boxSizing: 'border-box',
                                display: 'flex',
                                flexDirection: 'column',
                                position: 'relative',
                                overflow: 'hidden',
                            }}
                        >
                            <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');`}</style>

                            {(() => {
                                const s = printTarget.student;
                                const allMarks = printTarget.marks;
                                const overallAvg = allMarks.length > 0
                                    ? Math.round(allMarks.reduce((a, m) => a + parseFloat(m.marks || 0), 0) / allMarks.length)
                                    : 0;
                                const overallGrade = calcGradeLabel(overallAvg, thresholds);
                                const byCourse = {};
                                allMarks.forEach(m => {
                                    if (!byCourse[m.course_id]) byCourse[m.course_id] = { name: m.course_name || m.course_id, units: [] };
                                    byCourse[m.course_id].units.push(m);
                                });
                                const gradeColors = { Distinction: '#166534', Credit: '#1e40af', Pass: '#92400e', Fail: '#991b1b' };
                                const gradeBg    = { Distinction: '#f0fdf4', Credit: '#eff6ff', Pass: '#fffbeb', Fail: '#fef2f2' };
                                const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
                                                                const transcriptNo = `BTEC-${new Date().getFullYear()}-${String(s.id).replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8)}-${randSuffix}`;
                                
                                const formatDate = (dateStr) => {
                                    if (!dateStr) return '—';
                                    try {
                                        const d = new Date(dateStr);
                                        if (isNaN(d.getTime())) return dateStr;
                                        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
                                    } catch (e) {
                                        return dateStr;
                                    }
                                };

                                const issuedDate = formatDate(new Date());

                                const getRemarks = (grade) => {
                                    if (grade === 'Distinction') return "Successfully completed the programme with Distinction and demonstrated excellent competence in all required units.";
                                    if (grade === 'Credit') return "Successfully completed the programme with Credit and demonstrated good competence in the required units.";
                                    if (grade === 'Pass') return "Successfully completed the programme and met the minimum academic requirements.";
                                    return "The student has not yet met the minimum requirements for programme completion.";
                                };



                                const courseName = allMarks[0]?.course_name || '—';

                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '1123px' }}>

                                        {/* ── MAROON HEADER BAND ── */}
                                        <div style={{ background: '#800000', padding: '22px 36px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                                            {printTarget.logoB64 ? (
                                                <img src={printTarget.logoB64} alt="College Logo"
                                                    style={{ width: '60px', height: '60px', objectFit: 'contain', flexShrink: 0, borderRadius: '50%', background: '#fff', padding: '4px' }} />
                                            ) : (
                                                <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#c8a84b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 900, color: '#800000', flexShrink: 0 }}>B</div>
                                            )}
                                            <div style={{ flex: 1, textAlign: 'center' }}>
                                                <div style={{ fontSize: '20px', fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.12em', lineHeight: 1.1 }}>Beautex Technical Training College</div>
                                                <div style={{ fontSize: '8.5px', color: '#f0c060', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.22em', marginTop: '4px' }}>Empowering minds. Shaping innovation.</div>
                                                <div style={{ width: '80px', height: '2px', background: '#c8a84b', margin: '6px auto 0' }} />
                                            </div>
                                            <div style={{ width: '60px', flexShrink: 0 }} />
                                        </div>

                                        {/* ── GOLD ACCENT LINE ── */}
                                        <div style={{ height: '4px', background: 'linear-gradient(90deg,#800000 0%,#c8a84b 50%,#800000 100%)' }} />

                                        {/* ── BODY ── */}
                                        <div style={{ flex: 1, padding: '24px 36px 20px', position: 'relative' }}>

                                            {/* Watermark */}
                                            {printTarget.logoB64 && (
                                                <img src={printTarget.logoB64} alt=""
                                                    style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '340px', height: '340px', objectFit: 'contain', opacity: 0.04, pointerEvents: 'none', zIndex: 0 }} />
                                            )}

                                            {/* ── STUDENT INFO CARD ── */}
                                            <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: '18px', alignItems: 'flex-start', background: '#fdf8f0', border: '1.5px solid #e8d5a3', borderRadius: '10px', padding: '16px 20px 14px', marginBottom: '18px' }}>
                                                {/* Photo */}
                                                <div style={{ flexShrink: 0 }}>
                                                    {s.photoB64 ? (
                                                        <img src={s.photoB64} alt="Student"
                                                            style={{ width: '72px', height: '88px', objectFit: 'cover', borderRadius: '6px', border: '2px solid #c8a84b' }} />
                                                    ) : (
                                                        <div style={{ width: '72px', height: '88px', background: '#800000', borderRadius: '6px', border: '2px solid #c8a84b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px', fontWeight: 900, color: '#c8a84b' }}>
                                                            {(s.name || 'S').charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Details grid */}
                                                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px 24px', minWidth: 0 }}>
                                                    {[
                                                        { label: 'Full Name',        value: s.name },
                                                        { label: 'Admission No.',    value: s.admission_number || s.admissionNumber || s.student_id || '—' },
                                                        { label: 'Registration No.', value: s.reg_number || s.registration_number || s.regNumber || '—' },
                                                        { label: 'Programme',        value: courseName },
                                                        { label: 'Level / Module',   value: s.level || s.module || s.intake_level || '—' },
                                                        { label: 'Intake',           value: s.intake || s.intake_name || s.cohort || '—' },
                                                        { label: 'Completion Date',  value: formatDate(s.completion_date || s.expected_completion) },
                                                    ].map(({ label, value }) => (
                                                        <div key={label} style={{ minWidth: 0 }}>
                                                            <div style={{ fontSize: '7px', fontWeight: 800, color: '#800000', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
                                                            <div style={{ fontSize: '10px', fontWeight: 700, color: '#1a1a1a', marginTop: '1px', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{value}</div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Status badge */}
                                                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                                    <div style={{ background: '#800000', color: '#c8a84b', fontSize: '7px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', padding: '4px 10px', borderRadius: '4px', textAlign: 'center' }}>Active</div>
                                                    <div style={{ fontSize: '6.5px', color: '#800000', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.4 }}>Student<br />Status</div>
                                                </div>
                                            </div>

                                            {/* ── PER-COURSE ACADEMIC TABLES ── */}
                                            <div style={{ position: 'relative', zIndex: 1 }}>
                                                {Object.entries(byCourse).map(([cid, { name, units: cu }]) => {
                                                    const courseAvg = Math.round(cu.reduce((a, u) => a + parseFloat(u.marks || 0), 0) / cu.length);
                                                    const courseGrade = calcGradeLabel(courseAvg, thresholds);
                                                    return (
                                                        <div key={cid} style={{ marginBottom: '16px' }}>
                                                            <div style={{ background: '#800000', padding: '6px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '5px 5px 0 0', gap: '10px' }}>
                                                                <div style={{ fontSize: '9.5px', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.1em', wordBreak: 'break-word', overflowWrap: 'break-word', flex: 1, minWidth: 0 }}>{name}</div>
                                                                <div style={{ fontSize: '8px', fontWeight: 700, color: '#c8a84b', background: 'rgba(200,168,75,0.15)', padding: '2px 8px', borderRadius: '3px', flexShrink: 0, whiteSpace: 'nowrap' }}>Course Avg: {courseAvg}% · {courseGrade}</div>
                                                            </div>
                                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                                                                <thead>
                                                                    <tr style={{ background: '#f9f4ec', borderBottom: '1.5px solid #e8d5a3' }}>
                                                                        <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: '8.5px', fontWeight: 800, color: '#800000', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Unit Covered</th>
                                                                        <th style={{ padding: '6px 12px', textAlign: 'center', fontSize: '8.5px', fontWeight: 800, color: '#800000', textTransform: 'uppercase', letterSpacing: '0.08em', width: '75px' }}>Marks (%)</th>
                                                                        <th style={{ padding: '6px 12px', textAlign: 'center', fontSize: '8.5px', fontWeight: 800, color: '#800000', textTransform: 'uppercase', letterSpacing: '0.08em', width: '105px' }}>Grade</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {cu.map((u, idx) => {
                                                                        const g = u.grade || calcGradeLabel(parseFloat(u.marks), thresholds);
                                                                        const gc = gradeColors[g] || '#555555';
                                                                        const gbg = gradeBg[g] || '#f9f9f9';
                                                                        const rowBg = idx % 2 === 0 ? '#ffffff' : '#fdf8f0';
                                                                        return (
                                                                            <tr key={idx} style={{ background: rowBg, borderBottom: '1px solid #f0e8d5' }}>
                                                                                <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1a1a1a', verticalAlign: 'middle', wordBreak: 'break-word', overflowWrap: 'break-word', lineHeight: 1.4 }}>{u.unit_name}</td>
                                                                                <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, color: '#1a1a1a', verticalAlign: 'middle', width: '75px' }}>{parseFloat(u.marks).toFixed(1)}%</td>
                                                                                <td style={{ padding: '8px 12px', textAlign: 'center', verticalAlign: 'middle', width: '105px' }}>
                                                                                    <span style={{ background: gbg, color: gc, fontWeight: 800, fontSize: '8px', padding: '2px 8px', borderRadius: '10px', border: `1px solid ${gc}33`, display: 'inline-block', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{g}</span>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* ── OVERALL PERFORMANCE SUMMARY CARDS ── */}
                                            <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', margin: '18px 0 16px' }}>
                                                {[
                                                    { label: 'Overall Average',  value: `${overallAvg}%`, sub: 'All Units Combined' },
                                                    { label: 'Final Grade',      value: overallGrade,     sub: 'Competency Level' },
                                                    { label: 'Units Completed',  value: String(allMarks.length),  sub: 'Across All Courses' },
                                                    { label: 'Programme Status', value: overallAvg >= (thresholds.pass || 50) ? 'PASSED' : 'IN PROGRESS', sub: overallAvg >= (thresholds.pass || 50) ? 'Eligible for Certificate' : 'Continuing Studies' },
                                                ].map(({ label, value, sub }) => {
                                                    const valStr = String(value);
                                                    const fontSize = valStr.length > 8 ? '10px' : valStr.length > 5 ? '12px' : '15px';
                                                    return (
                                                        <div key={label} style={{ background: '#fdf8f0', border: '1.5px solid #e8d5a3', borderRadius: '8px', padding: '10px 8px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '56px', boxSizing: 'border-box' }}>
                                                            <div style={{ fontSize: '7px', fontWeight: 800, color: '#800000', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>{label}</div>
                                                            <div style={{ fontSize: fontSize, fontWeight: 900, color: '#1a1a1a', lineHeight: 1.1, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>{value}</div>
                                                            <div style={{ fontSize: '6px', color: '#9ca3af', fontWeight: 600, marginTop: '3px', lineHeight: 1.1 }}>{sub}</div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* ── GRADING SCALE LEGEND ── */}
                                            <div style={{ position: 'relative', zIndex: 1, background: '#f9f4ec', border: '1px solid #e8d5a3', borderRadius: '6px', padding: '8px 14px', marginBottom: '16px' }}>
                                                <div style={{ fontSize: '7.5px', fontWeight: 800, color: '#800000', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px' }}>Grading Scale</div>
                                                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                                    {[
                                                        { label: 'Distinction', range: `${thresholds.distinction || 80}–100%`, color: '#166534', bg: '#f0fdf4' },
                                                        { label: 'Credit',      range: `${thresholds.credit || 65}–${(thresholds.distinction || 80) - 1}%`, color: '#1e40af', bg: '#eff6ff' },
                                                        { label: 'Pass',        range: `${thresholds.pass || 50}–${(thresholds.credit || 65) - 1}%`, color: '#92400e', bg: '#fffbeb' },
                                                        { label: 'Fail',        range: `Below ${thresholds.pass || 50}%`, color: '#991b1b', bg: '#fef2f2' },
                                                    ].map(({ label, range, color, bg }) => (
                                                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: bg, border: `1.5px solid ${color}`, flexShrink: 0 }} />
                                                            <span style={{ fontSize: '8px', fontWeight: 700, color: color }}>{label}:</span>
                                                            <span style={{ fontSize: '8px', color: '#4b5563' }}>{range}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* ── ACADEMIC REMARKS ── */}
                                            <div style={{ position: 'relative', zIndex: 1, background: '#fdf8f0', border: '1.5px solid #e8d5a3', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
                                                <div style={{ fontSize: '7.5px', fontWeight: 800, color: '#800000', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '4px' }}>Academic Remarks</div>
                                                <div style={{ fontSize: '9px', fontWeight: 700, color: '#1a1a1a', fontStyle: 'italic', wordBreak: 'break-word', overflowWrap: 'break-word', lineHeight: 1.4 }}>
                                                    "{getRemarks(overallGrade)}"
                                                </div>
                                            </div>

                                            {/* ── VERIFICATION SECTION ── */}
                                            <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: '16px', alignItems: 'flex-start', border: '1.5px solid #e8d5a3', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', background: '#fff' }}>
                                                {/* Verification details */}
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '9px', fontWeight: 800, color: '#800000', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>Official Verification</div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px', marginBottom: '8px' }}>
                                                        {[
                                                            { label: 'Transcript No.', value: transcriptNo },
                                                            { label: 'Date Issued',    value: issuedDate },
                                                            { label: 'Academic Year',  value: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}` },
                                                            { label: 'Institution',    value: 'Beautex Technical Training College' },
                                                        ].map(({ label, value }) => (
                                                            <div key={label}>
                                                                <div style={{ fontSize: '7px', fontWeight: 800, color: '#800000', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
                                                                <div style={{ fontSize: '9px', fontWeight: 700, color: '#1a1a1a', marginTop: '1px' }}>{value}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div style={{ fontSize: '7px', color: '#6b7280', lineHeight: 1.5, fontStyle: 'italic', borderTop: '1px dashed #e8d5a3', paddingTop: '6px' }}>
                                                        This document is digitally generated and constitutes an official academic record of Beautex Technical Training College.
                                                        Verification is available online at: <span style={{ color: '#800000', fontWeight: 700 }}>https://beautex.edu/verify/{transcriptNo}</span>
                                                    </div>
                                                </div>

                                                {/* College stamp ring */}
                                                <div style={{ flexShrink: 0, width: '72px', height: '72px', borderRadius: '50%', border: '3px double #800000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', background: 'rgba(200,168,75,0.04)' }}>
                                                    <div style={{ fontSize: '6px', fontWeight: 900, color: '#800000', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.2, letterSpacing: '0.04em' }}>OFFICIAL<br />SEAL</div>
                                                    <div style={{ width: '30px', height: '1px', background: '#c8a84b', margin: '3px 0' }} />
                                                    <div style={{ fontSize: '5px', color: '#c8a84b', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>BTEC</div>
                                                </div>
                                            </div>

                                            {/* ── SIGNATURE LINES ── */}
                                            <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '16px' }}>
                                                {[
                                                    { role: 'Prepared By',  title: 'Academic Registrar' },
                                                    { role: 'Verified By',  title: 'Head of Quality Assurance' },
                                                    { role: 'Approved By',  title: 'Director / Principal' },
                                                ].map(({ role, title }) => (
                                                    <div key={role} style={{ textAlign: 'center' }}>
                                                        <div style={{ height: '36px' }} />
                                                        <div style={{ borderBottom: '1.5px solid #800000', width: '100%', marginBottom: '4px' }} />
                                                        <div style={{ fontSize: '8px', fontWeight: 800, color: '#800000', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{role}</div>
                                                        <div style={{ fontSize: '7px', color: '#9ca3af', marginTop: '2px' }}>{title}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* ── SECURITY FOOTER ── */}
                                        <div style={{ background: '#1a1a1a', padding: '8px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                                            <div style={{ fontSize: '6.5px', color: '#c8a84b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em' }}>BTEC · Official Academic Record</div>
                                            <div style={{ fontSize: '6px', color: '#6b7280', textAlign: 'center' }}>
                                                Unauthorized alteration of this document is a criminal offence punishable by law.
                                            </div>
                                            <div style={{ fontSize: '6.5px', color: '#c8a84b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                                Ref: {transcriptNo}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </>
            )}
            {/* ── TOAST NOTIFICATION ── */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-[9999] animate-in slide-in-from-bottom-5 duration-300">
                    <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border text-xs font-black uppercase tracking-wider ${
                        toast.type === 'error'
                            ? 'bg-red-50 text-red-700 border-red-200 shadow-red-100'
                            : 'bg-green-50 text-green-700 border-green-200 shadow-green-100'
                    }`}>
                        <span>{toast.message}</span>
                        <button onClick={() => setToast(null)} className="p-1 hover:opacity-70 transition-opacity">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* ── CONFIRM DIALOG ── */}
            {confirmDialog && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeConfirm} />
                    <div className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-black/5 p-8 animate-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
                                <AlertTriangle className="w-7 h-7 text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-black uppercase tracking-tight mb-1">Confirm Action</h3>
                                <p className="text-xs text-black/50 font-semibold leading-relaxed">{confirmDialog.message}</p>
                            </div>
                            <div className="flex gap-3 w-full pt-2">
                                <button
                                    onClick={closeConfirm}
                                    className="flex-1 py-3 rounded-2xl border border-black/10 text-xs font-black uppercase tracking-widest text-black/50 hover:bg-black/5 transition-all"
                                >Cancel</button>
                                <button
                                    onClick={() => { confirmDialog.onConfirm(); closeConfirm(); }}
                                    className="flex-1 py-3 rounded-2xl bg-red-600 text-white text-xs font-black uppercase tracking-widest hover:bg-red-700 active:scale-95 transition-all shadow-lg"
                                >Delete</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
