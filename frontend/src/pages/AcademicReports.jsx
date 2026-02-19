import { useState, useEffect } from 'react';
import { reportsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
    FileText, Calendar, BookOpen, CheckCircle2,
    Plus, Trash2, Printer, TrendingUp, ShieldCheck,
    ClipboardCheck, Edit, X, Users
} from 'lucide-react';

const ALL_COURSES = [
    'Cosmetology', 'Beauty Therapy', 'Catering', 'Computer Packages',
    'Website Development', 'Cyber Security', 'Makeup', 'Sista Locks',
    'Braiding, Plaiting & Crotcheting', 'Weaving & Wig Installation', 'Nail Technology'
];

const EMPTY_FORM = {
    course_name: '',
    reporting_period: 'Week 1',
    total_lessons: 10,
    attended_lessons: 10,
    theory_topics: '',
    theory_score: 0,
    theory_remarks: '',
    practical_tasks: '',
    equipment_used: '',
    skill_level: 'Good',
    safety_compliance: 'Yes',
    discipline_issues: '',
    trainer_observations: '',
    progress_summary: '',
    recommendation: 'Proceed'
};

export default function AcademicReports() {
    const { user } = useAuth();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingReport, setEditingReport] = useState(null);
    const [printingReport, setPrintingReport] = useState(null);
    const [formData, setFormData] = useState(EMPTY_FORM);

    const fetchReports = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const params = {};
            if (user?.role === 'teacher') params.trainer_email = user.email;
            const { data } = await reportsAPI.getAll(params);
            setReports(data);
        } catch (error) {
            console.error('Error fetching reports:', error);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => { fetchReports(); }, []);

    const handlePrint = (report) => {
        setPrintingReport(report);
        setTimeout(() => { window.print(); setPrintingReport(null); }, 500);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const reportPayload = {
            ...formData,
            // Map to backend fields — course_name is the "class" identifier
            student_name: formData.course_name,          // reuse student_name column for course/class
            course_unit: formData.course_name,
            registration_number: `CLASS-${formData.course_name.replace(/\s+/g, '-').toUpperCase()}`,
            student_id: `class-${formData.course_name.toLowerCase().replace(/\s+/g, '-')}`,
            attendance_percentage: ((formData.attended_lessons / formData.total_lessons) * 100).toFixed(1)
        };

        try {
            if (editingReport) {
                await reportsAPI.update(editingReport.id, reportPayload);
            } else {
                await reportsAPI.create(reportPayload);
            }
            setShowModal(false);
            setEditingReport(null);
            setFormData(EMPTY_FORM);
            fetchReports(true);
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to submit report');
        }
    };

    const handleEdit = (report) => {
        setEditingReport(report);
        setFormData({
            course_name: report.course_unit || report.student_name || '',
            reporting_period: report.reporting_period,
            total_lessons: report.total_lessons,
            attended_lessons: report.attended_lessons,
            theory_topics: report.theory_topics,
            theory_score: report.theory_score,
            theory_remarks: report.theory_remarks,
            practical_tasks: report.practical_tasks,
            equipment_used: report.equipment_used,
            skill_level: report.skill_level,
            safety_compliance: report.safety_compliance,
            discipline_issues: report.discipline_issues,
            trainer_observations: report.trainer_observations,
            progress_summary: report.progress_summary,
            recommendation: report.recommendation
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this report?')) return;
        try {
            await reportsAPI.delete(id);
            fetchReports(true);
        } catch (error) {
            alert('Deletion failed');
        }
    };

    const openNew = () => {
        setEditingReport(null);
        setFormData(EMPTY_FORM);
        setShowModal(true);
    };

    const attendancePct = (r) => r.total_lessons > 0
        ? ((r.attended_lessons / r.total_lessons) * 100).toFixed(0)
        : 0;

    if (loading) return <div className="p-10 text-maroon font-black animate-pulse uppercase tracking-widest">Compiling Academic Data...</div>;

    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <p className="text-[10px] font-black text-maroon/30 uppercase tracking-[0.3em] mb-1">Beautex Training Centre</p>
                    <h1 className="text-2xl md:text-3xl font-black text-maroon uppercase tracking-tight">Academic Reports</h1>
                    <div className="w-16 h-0.5 bg-gold mt-3"></div>
                    <p className="text-xs text-maroon/40 font-bold mt-2">General class & course progress reports by trainer</p>
                </div>
                {user?.role !== 'student' && (
                    <button
                        onClick={openNew}
                        className="w-full md:w-auto bg-maroon text-gold px-8 py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:bg-maroon/90 shadow-lg transition-all border border-gold/20 font-black text-xs uppercase tracking-widest"
                    >
                        <Plus className="w-4 h-4" /> Capture New Report
                    </button>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Total Reports', value: reports.length },
                    { label: 'This Month', value: reports.filter(r => new Date(r.created_at || r.date).getMonth() === new Date().getMonth()).length },
                    { label: 'Courses Covered', value: [...new Set(reports.map(r => r.course_unit || r.student_name))].length },
                ].map((s, i) => (
                    <div key={i} className="bg-white border border-maroon/8 rounded-2xl p-5 shadow-sm text-center">
                        <p className="text-2xl font-black text-maroon">{s.value}</p>
                        <p className="text-[9px] font-black text-maroon/30 uppercase tracking-widest mt-1">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Reports Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {reports.length === 0 && (
                    <div className="col-span-2 text-center py-20 text-maroon/30 font-black uppercase tracking-widest text-sm">
                        No reports captured yet.
                    </div>
                )}
                {reports.map((report) => (
                    <div key={report.id} className="bg-white border border-maroon/8 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all group">
                        <div className="h-1 bg-gradient-to-r from-maroon via-gold to-maroon opacity-60"></div>
                        <div className="p-7">
                            {/* Top */}
                            <div className="flex items-start justify-between mb-5">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-maroon rounded-2xl flex items-center justify-center shadow-lg shrink-0">
                                        <BookOpen className="w-5 h-5 text-gold" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-maroon leading-tight">{report.course_unit || report.student_name}</h3>
                                        <p className="text-[10px] font-black text-maroon/40 uppercase tracking-widest mt-0.5">{report.reporting_period}</p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <span className={`px-3 py-1 rounded-full font-black text-[8px] uppercase tracking-widest border ${report.recommendation === 'Proceed' ? 'bg-green-50 border-green-200 text-green-600' :
                                            report.recommendation === 'Improve' ? 'bg-orange-50 border-orange-200 text-orange-600' :
                                                'bg-red-50 border-red-200 text-red-600'
                                        }`}>
                                        {report.recommendation}
                                    </span>
                                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handlePrint(report)} className="p-1.5 rounded-lg border border-maroon/10 hover:bg-maroon/5 transition-colors">
                                            <Printer className="w-3.5 h-3.5 text-maroon/40" />
                                        </button>
                                        {(user?.role === 'admin' || user?.role === 'superadmin' || user?.email === report.trainer_email) && (
                                            <>
                                                <button onClick={() => handleEdit(report)} className="p-1.5 rounded-lg border border-maroon/10 hover:bg-maroon/5 transition-colors">
                                                    <Edit className="w-3.5 h-3.5 text-maroon/40" />
                                                </button>
                                                <button onClick={() => handleDelete(report.id)} className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition-colors">
                                                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Metrics */}
                            <div className="grid grid-cols-3 gap-3 mb-5">
                                <div className="bg-maroon/3 rounded-xl p-3 border border-maroon/5 text-center">
                                    <p className="text-lg font-black text-maroon">{attendancePct(report)}%</p>
                                    <p className="text-[8px] font-black text-maroon/30 uppercase tracking-widest">Attendance</p>
                                </div>
                                <div className="bg-maroon/3 rounded-xl p-3 border border-maroon/5 text-center">
                                    <p className="text-lg font-black text-maroon">{report.theory_score ?? '—'}</p>
                                    <p className="text-[8px] font-black text-maroon/30 uppercase tracking-widest">Theory Score</p>
                                </div>
                                <div className="bg-gold/8 rounded-xl p-3 border border-gold/15 text-center">
                                    <p className="text-lg font-black text-maroon">{report.skill_level}</p>
                                    <p className="text-[8px] font-black text-maroon/30 uppercase tracking-widest">Skill Level</p>
                                </div>
                            </div>

                            {/* Observations */}
                            {report.trainer_observations && (
                                <div className="bg-maroon/3 rounded-xl p-4 border border-maroon/5 mb-4">
                                    <p className="text-[9px] font-black text-maroon/30 uppercase tracking-widest mb-1">Trainer Observations</p>
                                    <p className="text-xs text-maroon/70 font-medium leading-relaxed">{report.trainer_observations}</p>
                                </div>
                            )}

                            {/* Footer */}
                            <div className="flex items-center justify-between border-t border-maroon/5 pt-4">
                                <p className="text-[9px] font-black text-maroon/30 uppercase tracking-widest">
                                    {report.trainer_name || report.trainer_email || 'Trainer'}
                                </p>
                                <p className="text-[9px] font-black text-maroon/30 uppercase tracking-widest">
                                    {report.created_at ? new Date(report.created_at).toLocaleDateString() : ''}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Capture / Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-maroon/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
                    <div className="bg-white border border-maroon/10 rounded-[2.5rem] p-10 max-w-3xl w-full shadow-2xl overflow-hidden relative max-h-[90vh] flex flex-col">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-maroon via-gold to-maroon opacity-60"></div>

                        {/* Modal Header */}
                        <div className="flex justify-between items-center mb-8 shrink-0">
                            <div>
                                <h2 className="text-2xl font-black text-maroon uppercase tracking-tight">
                                    {editingReport ? 'Update Report' : 'Capture Class Report'}
                                </h2>
                                <div className="w-10 h-0.5 bg-gold mt-2"></div>
                                <p className="text-[10px] text-maroon/30 font-black uppercase tracking-widest mt-1">General Course Progress Report</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-maroon/5 rounded-full transition-colors">
                                <X className="w-6 h-6 text-maroon/30" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto pr-2 flex-1">
                            {/* Course / Class */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Course / Class</label>
                                <select
                                    value={formData.course_name}
                                    onChange={(e) => setFormData({ ...formData, course_name: e.target.value })}
                                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10"
                                    required
                                >
                                    <option value="">Select Course / Class</option>
                                    {ALL_COURSES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            {/* Period + Lessons */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Reporting Period</label>
                                    <select
                                        value={formData.reporting_period}
                                        onChange={(e) => setFormData({ ...formData, reporting_period: e.target.value })}
                                        className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10"
                                    >
                                        {['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Month 1', 'Month 2', 'Month 3', 'Month 4', 'Month 5', 'Month 6', 'End of Term'].map(p =>
                                            <option key={p} value={p}>{p}</option>
                                        )}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Total Lessons</label>
                                    <input type="number" min="1" value={formData.total_lessons}
                                        onChange={(e) => setFormData({ ...formData, total_lessons: parseInt(e.target.value) })}
                                        className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Lessons Attended</label>
                                    <input type="number" min="0" max={formData.total_lessons} value={formData.attended_lessons}
                                        onChange={(e) => setFormData({ ...formData, attended_lessons: parseInt(e.target.value) })}
                                        className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10" />
                                </div>
                            </div>

                            {/* Theory */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Theory Topics Covered</label>
                                    <input type="text" placeholder="e.g. Hair anatomy, Color theory" value={formData.theory_topics}
                                        onChange={(e) => setFormData({ ...formData, theory_topics: e.target.value })}
                                        className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold placeholder-maroon/20 outline-none focus:ring-2 focus:ring-maroon/10" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Theory Score (Class Avg)</label>
                                    <input type="number" min="0" max="100" value={formData.theory_score}
                                        onChange={(e) => setFormData({ ...formData, theory_score: parseFloat(e.target.value) })}
                                        className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10" />
                                </div>
                            </div>

                            {/* Practical */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Practical Tasks Done</label>
                                    <input type="text" placeholder="e.g. Blow-dry, Braiding demo" value={formData.practical_tasks}
                                        onChange={(e) => setFormData({ ...formData, practical_tasks: e.target.value })}
                                        className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold placeholder-maroon/20 outline-none focus:ring-2 focus:ring-maroon/10" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Equipment Used</label>
                                    <input type="text" placeholder="e.g. Curling iron, Mannequin" value={formData.equipment_used}
                                        onChange={(e) => setFormData({ ...formData, equipment_used: e.target.value })}
                                        className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold placeholder-maroon/20 outline-none focus:ring-2 focus:ring-maroon/10" />
                                </div>
                            </div>

                            {/* Skill + Safety + Discipline */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Overall Skill Level</label>
                                    <select value={formData.skill_level}
                                        onChange={(e) => setFormData({ ...formData, skill_level: e.target.value })}
                                        className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10">
                                        {['Excellent', 'Good', 'Average', 'Needs Improvement'].map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Safety Compliance</label>
                                    <select value={formData.safety_compliance}
                                        onChange={(e) => setFormData({ ...formData, safety_compliance: e.target.value })}
                                        className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10">
                                        <option value="Yes">Yes — Compliant</option>
                                        <option value="No">No — Issues Noted</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Recommendation</label>
                                    <select value={formData.recommendation}
                                        onChange={(e) => setFormData({ ...formData, recommendation: e.target.value })}
                                        className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10">
                                        <option value="Proceed">Proceed</option>
                                        <option value="Improve">Needs Improvement</option>
                                        <option value="Repeat">Repeat Module</option>
                                    </select>
                                </div>
                            </div>

                            {/* Observations + Summary */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Trainer Observations</label>
                                <textarea value={formData.trainer_observations}
                                    onChange={(e) => setFormData({ ...formData, trainer_observations: e.target.value })}
                                    placeholder="General observations about the class performance, engagement, challenges..."
                                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold placeholder-maroon/20 outline-none focus:ring-2 focus:ring-maroon/10 h-28 resize-none" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Progress Summary</label>
                                <textarea value={formData.progress_summary}
                                    onChange={(e) => setFormData({ ...formData, progress_summary: e.target.value })}
                                    placeholder="Summary of overall class progress this period..."
                                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold placeholder-maroon/20 outline-none focus:ring-2 focus:ring-maroon/10 h-24 resize-none" />
                            </div>

                            <button type="submit" className="w-full bg-maroon text-gold py-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-maroon/90 shadow-xl transition-all border border-gold/20">
                                {editingReport ? 'Update Report' : 'Submit Class Report'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Hidden Print View */}
            {printingReport && (
                <div className="hidden print:block fixed inset-0 bg-white z-[9999] p-12">
                    <div className="max-w-2xl mx-auto">
                        <div className="text-center mb-8 border-b-2 border-maroon pb-6">
                            <h1 className="text-2xl font-black text-maroon uppercase tracking-widest">Beautex Training Centre</h1>
                            <p className="text-sm text-gray-500 mt-1">Academic Progress Report</p>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><p className="text-xs font-black text-gray-400 uppercase">Course</p><p className="font-bold text-maroon">{printingReport.course_unit || printingReport.student_name}</p></div>
                                <div><p className="text-xs font-black text-gray-400 uppercase">Period</p><p className="font-bold text-maroon">{printingReport.reporting_period}</p></div>
                                <div><p className="text-xs font-black text-gray-400 uppercase">Attendance</p><p className="font-bold text-maroon">{printingReport.attended_lessons}/{printingReport.total_lessons} lessons ({attendancePct(printingReport)}%)</p></div>
                                <div><p className="text-xs font-black text-gray-400 uppercase">Theory Score</p><p className="font-bold text-maroon">{printingReport.theory_score}/100</p></div>
                                <div><p className="text-xs font-black text-gray-400 uppercase">Skill Level</p><p className="font-bold text-maroon">{printingReport.skill_level}</p></div>
                                <div><p className="text-xs font-black text-gray-400 uppercase">Recommendation</p><p className="font-bold text-maroon">{printingReport.recommendation}</p></div>
                            </div>
                            {printingReport.trainer_observations && (
                                <div className="mt-4 p-4 border border-gray-200 rounded-xl">
                                    <p className="text-xs font-black text-gray-400 uppercase mb-2">Trainer Observations</p>
                                    <p className="text-sm text-gray-700">{printingReport.trainer_observations}</p>
                                </div>
                            )}
                            {printingReport.progress_summary && (
                                <div className="mt-4 p-4 border border-gray-200 rounded-xl">
                                    <p className="text-xs font-black text-gray-400 uppercase mb-2">Progress Summary</p>
                                    <p className="text-sm text-gray-700">{printingReport.progress_summary}</p>
                                </div>
                            )}
                        </div>
                        <div className="mt-12 border-t border-gray-200 pt-6 flex justify-between text-xs text-gray-400">
                            <span>Trainer: {printingReport.trainer_name || printingReport.trainer_email}</span>
                            <span>Date: {new Date().toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
