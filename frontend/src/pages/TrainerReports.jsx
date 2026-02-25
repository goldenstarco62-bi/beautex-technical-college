import React, { useState, useEffect } from 'react';
import { trainerReportsAPI, coursesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ClipboardList, Plus, Search, Trash2, Calendar, User, BookOpen, Send, X, FileText, LayoutList, Printer, FileDown, Eye } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function TrainerReports() {
    const { user } = useAuth();
    const [reports, setReports] = useState([]);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [viewingReport, setViewingReport] = useState(null);
    const [printingReport, setPrintingReport] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({
        week_number: '',
        report_date: new Date().toISOString().split('T')[0],
        daily_report: '',
        record_of_work: '',
        course_id: ''
    });

    const isTrainer = user?.role === 'teacher';
    const isAdmin = ['admin', 'superadmin'].includes(user?.role);

    useEffect(() => {
        fetchReports();
        fetchCourses();
    }, []);

    const fetchReports = async () => {
        try {
            setLoading(true);
            const { data } = await trainerReportsAPI.getAll();
            setReports(data);
        } catch (error) {
            console.error('Error fetching reports:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCourses = async () => {
        try {
            const { data } = await coursesAPI.getAll();
            setCourses(data);
        } catch (error) {
            console.error('Error fetching courses:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await trainerReportsAPI.create(formData);
            setShowModal(false);
            fetchReports();
            setFormData({
                week_number: '',
                report_date: new Date().toISOString().split('T')[0],
                daily_report: '',
                record_of_work: '',
                course_id: ''
            });
        } catch (error) {
            console.error('Error submitting report:', error);
            alert('Failed to submit report');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this report?')) return;
        try {
            await trainerReportsAPI.delete(id);
            fetchReports();
        } catch (error) {
            console.error('Error deleting report:', error);
        }
    };

    const handlePrint = (report) => {
        setPrintingReport(report);
        setTimeout(() => { window.print(); setPrintingReport(null); }, 1500);
    };

    const handleDownload = async (report) => {
        setPrintingReport(report);
        setTimeout(async () => {
            const element = document.getElementById('trainer-report-print');
            if (!element) return;
            try {
                const canvas = await html2canvas(element, {
                    scale: 3,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    windowWidth: 794
                });
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();

                const imgProps = pdf.getImageProperties(imgData);
                const ratio = imgProps.height / imgProps.width;
                const renderedHeight = pdfWidth * ratio;

                // Center the image if it's smaller than A4
                const yPos = 0;
                pdf.addImage(imgData, 'PNG', 0, yPos, pdfWidth, Math.min(renderedHeight, pdfHeight));
                pdf.save(`Trainer_Report_${report.trainer_name}_${report.week_number}.pdf`);
            } catch (error) {
                console.error('Download failed:', error);
                alert('Connection to document engine interrupted.');
            } finally {
                setPrintingReport(null);
            }
        }, 1500);
    };

    const filteredReports = reports.filter(r =>
        r.trainer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.daily_report?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-maroon tracking-tight uppercase">Trainer Accountability Registry</h1>
                    <p className="text-xs text-maroon/40 font-bold tracking-widest mt-1 uppercase italic">Daily Operations & Record of Work</p>
                </div>
                {isTrainer && (
                    <button
                        onClick={() => setShowModal(true)}
                        className="w-full sm:w-auto bg-maroon text-gold px-6 py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-elite-maroon shadow-lg transition-all border border-gold/20 font-black text-xs uppercase tracking-widest"
                    >
                        <Plus className="w-5 h-5" /> Log Daily Activity
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-3xl shadow-sm border border-maroon/5">
                <div className="flex-1 relative w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-maroon/20" />
                    <input
                        type="text"
                        placeholder="Search reports by trainer or content..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl text-xs font-bold text-maroon placeholder:text-maroon/20 outline-none focus:ring-2 focus:ring-maroon/5 uppercase tracking-widest"
                    />
                </div>
            </div>

            {/* Reports List */}
            <div className="grid grid-cols-1 gap-6">
                {loading ? (
                    <div className="py-20 text-center">
                        <div className="animate-spin w-10 h-10 border-4 border-maroon border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p className="text-[10px] font-black text-maroon/40 uppercase tracking-widest">Accessing Registry...</p>
                    </div>
                ) : filteredReports.length > 0 ? (
                    filteredReports.map((report) => (
                        <div key={report._id || report.id} className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-maroon/5 hover:shadow-xl transition-all group overflow-hidden relative">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-maroon/[0.02] rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>

                            <div className="flex flex-col lg:flex-row gap-8 relative z-10">
                                <div className="lg:w-1/4 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-2xl bg-maroon text-gold flex items-center justify-center font-black text-xs shadow-lg">
                                            {report.week_number}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-maroon/40 uppercase tracking-widest">Academic Period</p>
                                            <p className="text-sm font-black text-maroon uppercase tracking-tight">{report.week_number}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-2 pt-4 border-t border-maroon/5">
                                        <div className="flex items-center gap-2 text-[10px] font-black text-maroon/60 uppercase tracking-widest">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(report.report_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] font-black text-maroon/60 uppercase tracking-widest">
                                            <User className="w-3 h-3" />
                                            {report.trainer_name}
                                        </div>
                                        {report.course_id && (
                                            <div className="flex items-center gap-2 text-[10px] font-black text-maroon/60 uppercase tracking-widest">
                                                <BookOpen className="w-3 h-3" />
                                                {report.course_id}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2 pt-4">
                                        <button
                                            onClick={() => setViewingReport(report)}
                                            className="p-2 bg-maroon/5 hover:bg-maroon hover:text-white rounded-xl transition-all shadow-sm group/btn"
                                            title="View Full Report"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleDownload(report)}
                                            className="p-2 bg-maroon/5 hover:bg-maroon hover:text-white rounded-xl transition-all shadow-sm group/btn"
                                            title="Download PDF"
                                        >
                                            <FileDown className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handlePrint(report)}
                                            className="p-2 bg-maroon/5 hover:bg-maroon hover:text-white rounded-xl transition-all shadow-sm group/btn"
                                            title="Print Report"
                                        >
                                            <Printer className="w-3.5 h-3.5" />
                                        </button>
                                        {(isAdmin || report.trainer_id == user?.id) && (
                                            <button
                                                onClick={() => handleDelete(report._id || report.id)}
                                                className="p-2 bg-red-50 hover:bg-red-500 hover:text-white rounded-xl transition-all shadow-sm text-red-400 group/btn"
                                                title="Purge Record"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="bg-gray-50/50 rounded-3xl p-6 border border-maroon/5">
                                        <div className="flex items-center gap-2 mb-4">
                                            <FileText className="w-4 h-4 text-maroon opacity-40" />
                                            <h3 className="text-[10px] font-black text-maroon uppercase tracking-[0.2em]">Daily Operations Report</h3>
                                        </div>
                                        <p className="text-sm text-gray-700 font-medium leading-relaxed whitespace-pre-wrap">
                                            {report.daily_report}
                                        </p>
                                    </div>
                                    <div className="bg-gold/5 rounded-3xl p-6 border border-gold/20">
                                        <div className="flex items-center gap-2 mb-4">
                                            <LayoutList className="w-4 h-4 text-maroon opacity-40" />
                                            <h3 className="text-[10px] font-black text-maroon uppercase tracking-[0.2em]">Academic Record of Work</h3>
                                        </div>
                                        <p className="text-sm text-gray-700 font-medium leading-relaxed whitespace-pre-wrap italic">
                                            {report.record_of_work}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="py-32 text-center bg-white rounded-[3rem] border border-dashed border-maroon/10">
                        <div className="w-20 h-20 bg-maroon/5 rounded-full flex items-center justify-center mx-auto mb-6">
                            <ClipboardList className="w-10 h-10 text-maroon/10" />
                        </div>
                        <h3 className="text-xl font-black text-maroon uppercase tracking-tight">Registry Empty</h3>
                        <p className="text-[10px] font-bold text-maroon/20 uppercase tracking-[0.3em] mt-2">No activity records documented for this period.</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-maroon/20 backdrop-blur-xl animate-in fade-in duration-500" onClick={() => setShowModal(false)}></div>
                    <div className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-8 sm:p-12 border-b border-maroon/5 flex justify-between items-center shrink-0">
                            <div>
                                <h2 className="text-2xl sm:text-3xl font-black text-maroon uppercase tracking-tight leading-none">Activity Entry</h2>
                                <p className="text-[10px] text-maroon/40 font-bold uppercase tracking-[0.3em] mt-3 italic">Daily Operational Documentation</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-3 bg-gray-50 hover:bg-black hover:text-white rounded-2xl transition-all shadow-sm">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 sm:p-12 space-y-8 overflow-y-auto custom-scrollbar flex-1">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-left">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-[0.2em] ml-1">Academic Week</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.week_number}
                                        onChange={(e) => setFormData({ ...formData, week_number: e.target.value })}
                                        placeholder="e.g. Week 5"
                                        className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-maroon placeholder:text-maroon/10 outline-none focus:ring-4 focus:ring-maroon/5 transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-[0.2em] ml-1">Operational Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.report_date}
                                        onChange={(e) => setFormData({ ...formData, report_date: e.target.value })}
                                        className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-maroon outline-none focus:ring-4 focus:ring-maroon/5 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 text-left">
                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-[0.2em] ml-1">Daily Operations Report</label>
                                <textarea
                                    required
                                    rows="4"
                                    value={formData.daily_report}
                                    onChange={(e) => setFormData({ ...formData, daily_report: e.target.value })}
                                    placeholder="Document daily activities, observations, and incidents..."
                                    className="w-full px-6 py-4 bg-gray-50 border-none rounded-3xl text-sm font-medium text-gray-700 outline-none focus:ring-4 focus:ring-maroon/5 transition-all min-h-[120px] shadow-inner"
                                />
                            </div>

                            <div className="space-y-2 text-left">
                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-[0.2em] ml-1">Record of Work</label>
                                <textarea
                                    required
                                    rows="4"
                                    value={formData.record_of_work}
                                    onChange={(e) => setFormData({ ...formData, record_of_work: e.target.value })}
                                    placeholder="Detail curriculum coverage, topics taught, and academic progress..."
                                    className="w-full px-6 py-4 bg-gold/5 border border-gold/10 rounded-3xl text-sm font-medium text-gray-700 outline-none focus:ring-4 focus:ring-gold/5 transition-all min-h-[120px] shadow-inner"
                                />
                            </div>

                            <div className="space-y-2 text-left">
                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-[0.2em] ml-1">Associated Program (Optional)</label>
                                <select
                                    value={formData.course_id}
                                    onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                                    className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold text-maroon outline-none focus:ring-4 focus:ring-maroon/5 transition-all"
                                >
                                    <option value="">N/A - General Operations</option>
                                    {courses.map(course => (
                                        <option key={course.id} value={course.name}>{course.name}</option>
                                    ))}
                                </select>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-maroon text-gold py-6 rounded-3xl font-black text-xs uppercase tracking-[0.3em] shadow-2xl hover:bg-elite-maroon transition-all flex items-center justify-center gap-3 border border-gold/20"
                            >
                                <Send className="w-4 h-4" /> Finalize & Transmit to Registry
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* View Modal */}
            {viewingReport && (
                <div className="fixed inset-0 bg-maroon/40 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50">
                    <div className="bg-white border border-maroon/10 rounded-2xl sm:rounded-[2.5rem] p-5 sm:p-10 max-w-3xl w-full shadow-2xl overflow-hidden relative max-h-[95vh] flex flex-col">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-maroon via-gold to-maroon opacity-60"></div>

                        <div className="flex justify-between items-center mb-8 shrink-0">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-black text-maroon uppercase tracking-tight">Trainer Activity Details</h2>
                                <div className="w-10 h-0.5 bg-gold mt-2"></div>
                                <p className="text-[10px] text-maroon/30 font-black uppercase tracking-widest mt-1">Operational & Academic Documentation</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleDownload(viewingReport)} className="p-2 bg-maroon/5 hover:bg-maroon hover:text-white rounded-xl transition-all shadow-sm">
                                    <FileDown className="w-5 h-5" />
                                </button>
                                <button onClick={() => handlePrint(viewingReport)} className="p-2 bg-maroon/5 hover:bg-maroon hover:text-white rounded-xl transition-all shadow-sm">
                                    <Printer className="w-5 h-5" />
                                </button>
                                <button onClick={() => setViewingReport(null)} className="p-2 hover:bg-maroon/5 rounded-full transition-colors">
                                    <X className="w-6 h-6 text-maroon/30" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-8 overflow-y-auto pr-2 flex-1 pb-10">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Lead Trainer</p>
                                    <p className="text-lg font-bold text-maroon uppercase">{viewingReport.trainer_name}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Academic Week</p>
                                    <p className="text-lg font-bold text-maroon uppercase">{viewingReport.week_number}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Report Date</p>
                                    <p className="text-sm font-bold text-gray-800">{new Date(viewingReport.report_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Module / Course</p>
                                    <p className="text-sm font-bold text-gray-800">{viewingReport.course_id || 'Institutional Operations'}</p>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-maroon/5 space-y-6 text-left text-gray-700">
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Daily Operations Report</p>
                                    <p className="text-sm leading-relaxed bg-gray-50 p-6 rounded-[2rem] border border-gray-100 whitespace-pre-wrap">{viewingReport.daily_report}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Record of Work</p>
                                    <p className="text-sm leading-relaxed bg-gold/5 p-6 rounded-[2rem] border border-gold/10 italic whitespace-pre-wrap">{viewingReport.record_of_work}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden Print View */}
            {printingReport && (
                <>
                    <style>{`
                        @media print {
                            @page { size: A4; margin: 0; }
                            body { margin: 0; padding: 0 !important; }
                            .print-a4 { 
                                width: 210mm !important; 
                                height: 297mm !important; 
                                padding: 15mm !important; 
                                margin: 0 auto !important;
                                box-shadow: none !important;
                                border: 4px double #800000 !important;
                                box-sizing: border-box !important;
                            }
                            #trainer-report-print { position: static !important; overflow: visible !important; }
                        }
                    `}</style>
                    <div id="trainer-report-print" className="fixed inset-0 bg-white z-[9999] p-8 font-serif overflow-auto print:absolute print:inset-0 print:p-0">
                        <div className="print-a4 mx-auto border-4 border-double border-maroon p-10 bg-white min-h-[297mm] flex flex-col justify-between">
                            <div>
                                <div className="text-center mb-6 border-b-2 border-maroon pb-6">
                                    <div className="flex flex-col items-center mb-4">
                                        <img src="/logo.jpg" alt="College Logo" className="w-20 h-20 object-contain mb-3" />
                                        <h1 className="text-xl font-black text-maroon uppercase tracking-widest mb-1">Beautex Technical Training College</h1>
                                        <p className="text-[10px] font-bold text-gray-400 tracking-[0.2em] uppercase italic">"Empowering minds, shaping innovations"</p>
                                    </div>
                                    <div className="w-16 h-0.5 bg-gold mx-auto mb-6" />
                                    <p className="text-sm text-black font-black uppercase tracking-[0.2em]">Trainer Operational Registry Account</p>
                                </div>

                                <div className="grid grid-cols-2 gap-8 mb-10 pb-8 border-b border-maroon/10">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Lead Trainer</p>
                                        <p className="text-lg font-bold text-maroon uppercase">{printingReport.trainer_name}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Academic Cycle</p>
                                        <p className="text-lg font-bold text-maroon uppercase">{printingReport.week_number}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Documented Date</p>
                                        <p className="text-sm font-bold text-maroon">
                                            {new Date(printingReport.report_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Module/Course</p>
                                        <p className="text-sm font-bold text-maroon">{printingReport.course_id || 'Institutional Operations'}</p>
                                    </div>
                                </div>

                                <div className="space-y-10">
                                    <div className="bg-gray-50 p-6 rounded-2xl border border-maroon/5">
                                        <div className="flex items-center gap-2 mb-4">
                                            <FileText className="w-4 h-4 text-maroon opacity-40" />
                                            <h3 className="text-xs font-black text-maroon uppercase tracking-widest">Daily Operations Report</h3>
                                        </div>
                                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                                            {printingReport.daily_report}
                                        </p>
                                    </div>

                                    <div className="bg-maroon/[0.02] p-6 rounded-2xl border border-maroon/5">
                                        <div className="flex items-center gap-2 mb-4">
                                            <LayoutList className="w-4 h-4 text-maroon opacity-40" />
                                            <h3 className="text-xs font-black text-maroon uppercase tracking-widest">Academic Record of Work</h3>
                                        </div>
                                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap italic">
                                            {printingReport.record_of_work}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-12 border-t border-maroon/10 pt-8 text-center shrink-0">
                                <p className="text-[10px] font-black text-maroon uppercase tracking-widest mb-1">
                                    Beautex Technical Training College - Registry Department
                                </p>
                                <p className="text-[8px] text-gray-400 uppercase tracking-widest leading-relaxed">
                                    Contact: 0708247557 | Email: beautexcollege01@gmail.com <br />
                                    Location: Utawala, Geokarma behind Astrol Petrol Station | Document Verified: {new Date().toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
