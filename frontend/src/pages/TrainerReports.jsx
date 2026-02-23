import React, { useState, useEffect } from 'react';
import { trainerReportsAPI, coursesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ClipboardList, Plus, Search, Trash2, Calendar, User, BookOpen, Send, X, FileText, LayoutList } from 'lucide-react';

export default function TrainerReports() {
    const { user } = useAuth();
    const [reports, setReports] = useState([]);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
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
                                    {(isAdmin || report.trainer_id === user?.id) && (
                                        <button
                                            onClick={() => handleDelete(report._id || report.id)}
                                            className="mt-6 flex items-center gap-2 text-[10px] font-black text-red-400 hover:text-red-600 uppercase tracking-widest transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" /> Purge Record
                                        </button>
                                    )}
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
        </div>
    );
}
