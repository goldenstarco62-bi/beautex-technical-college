import { useState, useEffect } from 'react';
import {
    FileText,
    Search,
    Calendar,
    User,
    BookOpen,
    Filter,
    Download,
    Trash2,
    ChevronLeft,
    ChevronRight,
    MessageSquare,
    History
} from 'lucide-react';
import { studentDailyReportsAPI, coursesAPI, studentsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

export default function DailyStudentLogs() {
    const { user } = useAuth();
    const [logs, setLogs] = useState([]);
    const [courses, setCourses] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [filters, setFilters] = useState({
        student_id: '',
        course: '',
        date: '',
        search: ''
    });

    const [stats, setStats] = useState({
        totalEntries: 0,
        uniqueStudents: 0
    });

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        fetchLogs();
    }, [filters]);

    const fetchInitialData = async () => {
        try {
            const [coursesRes, studentsRes] = await Promise.all([
                coursesAPI.getAll(),
                studentsAPI.getAll()
            ]);
            setCourses(coursesRes.data || []);
            setStudents(studentsRes.data || []);
        } catch (error) {
            console.error('Error fetching initial data:', error);
            toast.error('Failed to load filter options');
        }
    };

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const { data } = await studentDailyReportsAPI.getAll(filters);
            setLogs(data || []);

            // Calc stats locally
            const uniqueSids = new Set(data.map(l => l.student_id));
            setStats({
                totalEntries: data.length,
                uniqueStudents: uniqueSids.size
            });
        } catch (error) {
            console.error('Error fetching logs:', error);
            toast.error('Failed to load daily logs');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to remove this academic log entry?')) return;
        try {
            await studentDailyReportsAPI.delete(id);
            toast.success('Log entry removed');
            fetchLogs();
        } catch (error) {
            toast.error('Failed to delete log');
        }
    };

    const handleFilterChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    const filteredLogs = logs.filter(l =>
        l.student_name.toLowerCase().includes(filters.search.toLowerCase()) ||
        l.student_id.toLowerCase().includes(filters.search.toLowerCase()) ||
        l.topics_covered.toLowerCase().includes(filters.search.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-maroon/[0.02] rounded-full translate-x-1/2 -translate-y-1/2 blur-2xl"></div>
                <div>
                    <h1 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">Student Daily Ledger</h1>
                    <p className="text-sm text-gray-400 font-medium">Beautex Academic Audit • Daily Progress Journals</p>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                    <div className="bg-maroon/5 px-6 py-4 rounded-2xl flex flex-col items-center justify-center min-w-[120px]">
                        <p className="text-[9px] font-black text-maroon/40 uppercase tracking-widest mb-1">Total Logs</p>
                        <p className="text-xl font-black text-maroon">{stats.totalEntries}</p>
                    </div>
                    <div className="bg-gold/10 px-6 py-4 rounded-2xl flex flex-col items-center justify-center min-w-[120px]">
                        <p className="text-[9px] font-black text-maroon/40 uppercase tracking-widest mb-1">Students</p>
                        <p className="text-xl font-black text-maroon">{stats.uniqueStudents}</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <Search className="w-3 h-3" /> Quick Search
                        </label>
                        <input
                            name="search"
                            value={filters.search}
                            onChange={handleFilterChange}
                            placeholder="Student, ID, or Topic..."
                            className="w-full px-5 py-3.5 bg-gray-50 border-transparent rounded-xl text-xs font-bold text-gray-700 focus:bg-white focus:border-maroon/20 transition-all outline-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <BookOpen className="w-3 h-3" /> Course Filter
                        </label>
                        <select
                            name="course"
                            value={filters.course}
                            onChange={handleFilterChange}
                            className="w-full px-5 py-3.5 bg-gray-50 border-transparent rounded-xl text-xs font-bold text-gray-700 focus:bg-white focus:border-maroon/20 outline-none cursor-pointer"
                        >
                            <option value="">All Departments</option>
                            {courses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <Calendar className="w-3 h-3" /> Specific Date
                        </label>
                        <input
                            type="date"
                            name="date"
                            value={filters.date}
                            onChange={handleFilterChange}
                            className="w-full px-5 py-3.5 bg-gray-50 border-transparent rounded-xl text-xs font-bold text-gray-700 focus:bg-white focus:border-maroon/20 outline-none"
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={() => setFilters({ student_id: '', course: '', date: '', search: '' })}
                            className="w-full h-[47px] bg-maroon/5 text-maroon rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-maroon hover:text-white transition-all flex items-center justify-center gap-2"
                        >
                            <Filter className="w-3.5 h-3.5" /> Clear Filters
                        </button>
                    </div>
                </div>
            </div>

            {/* Logs Table */}
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="px-8 py-6 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest">Entry Date</th>
                                <th className="px-8 py-6 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest">Student Information</th>
                                <th className="px-8 py-6 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest">Daily Coverage Detail</th>
                                <th className="px-8 py-6 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest">Lead Trainer</th>
                                <th className="px-8 py-6 text-right text-[9px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-8 py-20 text-center text-maroon font-black uppercase tracking-widest animate-pulse">Syncing Ledger...</td>
                                </tr>
                            ) : filteredLogs.length > 0 ? (
                                filteredLogs.map((log) => (
                                    <tr key={log.id || log._id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-3 h-3 text-maroon/30" />
                                                <span className="text-[11px] font-black text-gray-600">{new Date(log.report_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-maroon/5 rounded-xl flex items-center justify-center text-maroon font-black text-xs">
                                                    {log.student_name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-gray-800 uppercase leading-none mb-1">{log.student_name}</p>
                                                    <p className="text-[10px] text-gray-400 font-bold tracking-widest">{log.student_id} • {log.course}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 max-w-md">
                                            <div className="space-y-2">
                                                <p className="text-xs text-gray-600 font-medium leading-relaxed line-clamp-2 italic">"{log.topics_covered}"</p>
                                                {log.trainer_remarks && (
                                                    <div className="flex items-start gap-2 bg-white p-2 rounded-lg border border-gray-100 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <MessageSquare className="w-3 h-3 text-maroon mt-0.5" />
                                                        <p className="text-[10px] text-gray-400 font-bold">{log.trainer_remarks}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div>
                                                <p className="text-xs font-bold text-gray-700">{log.trainer_name}</p>
                                                <p className="text-[9px] text-gray-400 font-medium">{log.trainer_email}</p>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleDelete(log.id || log._id)}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="px-8 py-32 text-center">
                                        <div className="flex flex-col items-center justify-center grayscale opacity-30">
                                            <History className="w-16 h-16 mb-4" />
                                            <p className="text-[11px] font-black uppercase tracking-[0.3em]">No academic logs matching your criteria</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
