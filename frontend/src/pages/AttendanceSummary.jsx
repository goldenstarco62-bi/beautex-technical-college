import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { attendanceAPI, coursesAPI } from '../services/api';
import {
    Users, CheckCircle2, Clock, AlertCircle, Calendar,
    Filter, Search, RefreshCw, FileDown, ChevronDown, ChevronUp,
    TrendingUp, BarChart3, Award, BookOpen, Printer, HelpCircle,
    ChevronLeft, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function AttendanceSummary() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [courses, setCourses] = useState([]);
    const [summaryData, setSummaryData] = useState([]);
    
    // Filters
    const [selectedCourse, setSelectedCourse] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Tabs: 'overall' | 'weekly' | 'monthly'
    const [activeTab, setActiveTab] = useState('overall');
    
    // Expandable Rows
    const [expandedRows, setExpandedRows] = useState({});

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    const [downloadingPDF, setDownloadingPDF] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

    // Fetch courses on mount
    useEffect(() => {
        const fetchCourses = async () => {
            try {
                const res = await coursesAPI.getAll();
                setCourses(res.data || res || []);
            } catch (err) {
                console.error('Error fetching courses:', err);
                toast.error('Failed to load courses dropdown.');
            }
        };
        fetchCourses();
    }, []);

    // Fetch summary data when course filter changes
    const fetchSummary = async () => {
        setLoading(true);
        try {
            const params = {};
            if (selectedCourse) {
                params.course = selectedCourse;
            }
            const res = await attendanceAPI.getSummary(params);
            setSummaryData(res.data || res || []);
        } catch (err) {
            console.error('Error fetching attendance summary:', err);
            toast.error('Failed to load attendance summary.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSummary();
    }, [selectedCourse]);

    // Toggle expand row
    const toggleRow = (studentId) => {
        setExpandedRows(prev => ({
            ...prev,
            [studentId]: !prev[studentId]
        }));
    };

    // Filter summary data client-side by search query
    const filteredData = summaryData.filter(student => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return true;
        return (
            (student.student_name || '').toLowerCase().includes(q) ||
            (student.student_id || '').toLowerCase().includes(q) ||
            (student.course || '').toLowerCase().includes(q)
        );
    });

    // Calculations for overall summary statistics cards
    const totalStudents = filteredData.length;
    
    // Pagination calculations
    const totalPages = Math.ceil(totalStudents / pageSize);
    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = currentPage * pageSize;

    // Reset page on filters or tab change
    useEffect(() => {
        setCurrentPage(1);
        setExpandedRows({});
    }, [searchQuery, selectedCourse, activeTab]);

    const pageNumbers = [];
    for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
    }

    const avgAttendanceRate = totalStudents > 0
        ? Math.round(filteredData.reduce((sum, item) => sum + (item.overall?.rate || 0), 0) / totalStudents)
        : 0;

    // Find the week with highest average rate across all filtered students
    const getBestWeek = () => {
        const weekStats = {}; // { week: { sum: 0, count: 0 } }
        filteredData.forEach(student => {
            (student.weekly || []).forEach(w => {
                if (!weekStats[w.week]) {
                    weekStats[w.week] = { sum: 0, count: 0 };
                }
                weekStats[w.week].sum += w.rate;
                weekStats[w.week].count += 1;
            });
        });

        let best = 'N/A';
        let bestRate = -1;
        Object.entries(weekStats).forEach(([week, stat]) => {
            const avg = stat.count > 0 ? stat.sum / stat.count : 0;
            if (avg > bestRate) {
                bestRate = avg;
                best = week;
            }
        });
        return { name: best, rate: bestRate > -1 ? Math.round(bestRate) : 0 };
    };

    // Find the month with highest average rate across all filtered students
    const getBestMonth = () => {
        const monthStats = {}; // { month: { sum: 0, count: 0 } }
        filteredData.forEach(student => {
            (student.monthly || []).forEach(m => {
                if (!monthStats[m.month]) {
                    monthStats[m.month] = { sum: 0, count: 0 };
                }
                monthStats[m.month].sum += m.rate;
                monthStats[m.month].count += 1;
            });
        });

        let best = 'N/A';
        let bestRate = -1;
        Object.entries(monthStats).forEach(([month, stat]) => {
            const avg = stat.count > 0 ? stat.sum / stat.count : 0;
            if (avg > bestRate) {
                bestRate = avg;
                best = month;
            }
        });

        // Format Month Key (YYYY-MM) to human readable (e.g., May 2026)
        const formatMonthName = (monthKey) => {
            if (monthKey === 'N/A') return 'N/A';
            const [year, month] = monthKey.split('-');
            const date = new Date(parseInt(year), parseInt(month) - 1, 1);
            return date.toLocaleString('default', { month: 'short', year: 'numeric' });
        };

        return { name: formatMonthName(best), rate: bestRate > -1 ? Math.round(bestRate) : 0 };
    };

    const bestWeek = getBestWeek();
    const bestMonth = getBestMonth();

    // Helper: color-code attendance rate values
    const getRateColor = (rate) => {
        if (rate >= 90) return 'text-emerald-600 bg-emerald-50 border-emerald-100';
        if (rate >= 75) return 'text-amber-600 bg-amber-50 border-amber-100';
        return 'text-rose-600 bg-rose-50 border-rose-100';
    };

    // Helper: find best and worst periods for a single student
    const getStudentExtremes = (student, type) => {
        const list = type === 'monthly' ? (student.monthly || []) : (student.weekly || []);
        if (list.length === 0) return { best: 'N/A', worst: 'N/A' };
        
        let best = list[0];
        let worst = list[0];
        list.forEach(item => {
            if (item.rate > best.rate) best = item;
            if (item.rate < worst.rate) worst = item;
        });

        const key = type === 'monthly' ? 'month' : 'week';
        
        // Format labels elegantly
        const formatLabel = (val) => {
            if (type === 'monthly') {
                const [y, m] = val.split('-');
                const d = new Date(parseInt(y), parseInt(m) - 1, 1);
                return d.toLocaleString('default', { month: 'short' }) + ' ' + y.slice(2);
            }
            return 'Wk ' + val.split('-W')[1];
        };

        return {
            best: `${formatLabel(best[key])} (${best.rate}%)`,
            worst: `${formatLabel(worst[key])} (${worst.rate}%)`
        };
    };

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPDF = async () => {
        setDownloadingPDF(true);
        setIsGeneratingPDF(true);
        const loadToast = toast.loading('Generating Attendance PDF Report...', { id: 'pdf-gen' });
        
        setTimeout(async () => {
            const element = document.getElementById('attendance-summary-pdf-view');
            if (!element) {
                toast.error('PDF view container not found.', { id: 'pdf-gen' });
                setIsGeneratingPDF(false);
                setDownloadingPDF(false);
                return;
            }
            try {
                const canvas = await html2canvas(element, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#ffffff'
                });
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                
                const imgProps = pdf.getImageProperties(imgData);
                const ratio = imgProps.height / imgProps.width;
                const renderedHeight = pdfWidth * ratio;
                
                let heightLeft = renderedHeight;
                let position = 0;
                
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, renderedHeight);
                heightLeft -= pdfHeight;
                
                let pageNum = 1;
                while (heightLeft > 0) {
                    position = -pdfHeight * pageNum;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, renderedHeight);
                    heightLeft -= pdfHeight;
                    pageNum++;
                }
                
                const courseName = selectedCourse ? selectedCourse.replace(/\s+/g, '_') : 'All_Programs';
                pdf.save(`Attendance_Summary_Report_${courseName}_${new Date().toISOString().split('T')[0]}.pdf`);
                toast.success('PDF Report Downloaded Successfully', { id: 'pdf-gen' });
            } catch (error) {
                console.error('PDF Generation Error:', error);
                toast.error('Failed to generate PDF report', { id: 'pdf-gen' });
            } finally {
                setIsGeneratingPDF(false);
                setDownloadingPDF(false);
            }
        }, 800);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 print:space-y-4 print:p-0">
            {/* Print Only Header */}
            <div className="hidden print:flex items-center justify-between border-b-2 border-maroon pb-4 mb-6">
                <div className="flex items-center gap-4">
                    <img src="/app-icon-v2.png" alt="Beautex Logo" className="w-16 h-16 object-cover rounded-xl" />
                    <div>
                        <h1 className="text-2xl font-black text-maroon uppercase tracking-tight">Beautex Technical Training College</h1>
                        <p className="text-xs font-bold text-gold uppercase tracking-widest">Attendance Summary Report</p>
                    </div>
                </div>
                <div className="text-right text-[10px] text-gray-500 font-mono">
                    <p>Date Generated: {new Date().toLocaleDateString()}</p>
                    {selectedCourse && <p>Course: {selectedCourse}</p>}
                </div>
            </div>

            {/* Top Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 print:hidden">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white p-1 rounded-2xl flex items-center justify-center overflow-hidden shadow-xl border border-gray-100 hover:rotate-6 transition-transform">
                        <img src="/app-icon-v2.png" alt="Beautex Logo" className="w-full h-full object-cover rounded-xl" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-maroon/40 uppercase tracking-[0.4em] mb-1">Administrative Insights</p>
                        <h1 className="text-3xl font-black text-maroon uppercase tracking-tight flex items-center gap-3">
                            Attendance Ledger Hub
                        </h1>
                    </div>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <button
                        onClick={fetchSummary}
                        disabled={loading}
                        className="flex-1 md:flex-none bg-white border border-gray-100 rounded-2xl shadow-sm px-6 py-3.5 text-[9px] font-black uppercase tracking-widest text-maroon flex items-center justify-center gap-2 hover:bg-gray-50 transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Sync Data
                    </button>
                    <button
                        onClick={handleDownloadPDF}
                        disabled={downloadingPDF || loading}
                        className="bg-gold text-maroon hover:bg-gold/90 px-6 py-3.5 rounded-2xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50"
                    >
                        <FileDown className="w-3.5 h-3.5" />
                        Download PDF
                    </button>
                    <button
                        onClick={handlePrint}
                        className="bg-maroon text-gold px-6 py-3.5 rounded-2xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg hover:bg-maroon/90 hover:scale-[1.02] transition-all"
                    >
                        <Printer className="w-3.5 h-3.5" />
                        Print Report
                    </button>
                </div>
            </div>

            {/* Filter Controls Bar */}
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xl grid grid-cols-1 md:grid-cols-3 gap-6 print:hidden">
                <div className="flex flex-col gap-1.5">
                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-wider">Select Course Program</label>
                    <div className="relative">
                        <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <select
                            value={selectedCourse}
                            onChange={(e) => setSelectedCourse(e.target.value)}
                            className="w-full bg-gray-50 border-none rounded-2xl text-xs font-bold py-4 pl-12 pr-4 focus:ring-2 focus:ring-maroon/20 transition-all appearance-none"
                        >
                            <option value="">All Course Programs</option>
                            {courses.map(course => (
                                <option key={course.id || course._id} value={course.name}>{course.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                </div>

                <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-wider">Search Student</label>
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Type student name, student ID, or course to filter records..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-maroon/20 transition-all placeholder:text-gray-400"
                        />
                    </div>
                </div>
            </div>

            {/* Stats Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 print:grid-cols-4 print:gap-4">
                {/* Card 1 */}
                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-lg relative overflow-hidden group print:border-gray-200 print:shadow-none">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-maroon/5 opacity-30 rounded-full -mr-12 -mt-12 transition-all print:hidden" />
                    <Users className="w-8 h-8 text-maroon mb-4 print:w-6 print:h-6 print:mb-2" />
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 print:text-[7px]">Cohort Strength</p>
                    <p className="text-2xl font-black text-gray-800 tracking-tight print:text-lg">{totalStudents}</p>
                    <p className="text-[9px] text-gray-400 font-bold mt-1 print:text-[8px]">Active Filtered Students</p>
                </div>

                {/* Card 2 */}
                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-lg relative overflow-hidden group print:border-gray-200 print:shadow-none">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gold/5 opacity-30 rounded-full -mr-12 -mt-12 transition-all print:hidden" />
                    <CheckCircle2 className="w-8 h-8 text-gold mb-4 print:w-6 print:h-6 print:mb-2" />
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 print:text-[7px]">Avg Attendance Rate</p>
                    <p className={`text-2xl font-black tracking-tight print:text-lg ${avgAttendanceRate >= 80 ? 'text-emerald-600' : 'text-amber-500'}`}>{avgAttendanceRate}%</p>
                    <p className="text-[9px] text-gray-400 font-bold mt-1 print:text-[8px]">All-time Aggregate Rate</p>
                </div>

                {/* Card 3 */}
                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-lg relative overflow-hidden group print:border-gray-200 print:shadow-none">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 opacity-30 rounded-full -mr-12 -mt-12 transition-all print:hidden" />
                    <Award className="w-8 h-8 text-emerald-500 mb-4 print:w-6 print:h-6 print:mb-2" />
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 print:text-[7px]">Peak Week Program</p>
                    <p className="text-xl font-black text-emerald-600 tracking-tight print:text-sm truncate" title={bestWeek.name}>{bestWeek.name || 'N/A'}</p>
                    <p className="text-[9px] text-gray-400 font-bold mt-1 print:text-[8px]">Highest Avg: {bestWeek.rate}%</p>
                </div>

                {/* Card 4 */}
                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-lg relative overflow-hidden group print:border-gray-200 print:shadow-none">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 opacity-30 rounded-full -mr-12 -mt-12 transition-all print:hidden" />
                    <Calendar className="w-8 h-8 text-blue-500 mb-4 print:w-6 print:h-6 print:mb-2" />
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 print:text-[7px]">Peak Month Program</p>
                    <p className="text-xl font-black text-blue-600 tracking-tight print:text-sm truncate" title={bestMonth.name}>{bestMonth.name || 'N/A'}</p>
                    <p className="text-[9px] text-gray-400 font-bold mt-1 print:text-[8px]">Highest Avg: {bestMonth.rate}%</p>
                </div>
            </div>

            {/* View Switching Tab Bar */}
            <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl w-fit print:hidden">
                {[
                    { id: 'overall', label: 'Overall Summary', icon: BarChart3 },
                    { id: 'weekly', label: 'Weekly Matrix', icon: Clock },
                    { id: 'monthly', label: 'Monthly Matrix', icon: Calendar }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => {
                            setActiveTab(tab.id);
                            // Clear expanded rows on tab change to prevent weird scroll jumps
                            setExpandedRows({});
                        }}
                        className={`px-5 py-2.5 rounded-xl flex items-center gap-2 text-[9px] font-black uppercase tracking-wider transition-all ${
                            activeTab === tab.id ? 'bg-white text-maroon shadow-sm' : 'text-gray-400 hover:text-maroon'
                        }`}
                    >
                        <tab.icon className="w-3.5 h-3.5" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Data Grid Section */}
            {loading ? (
                <div className="py-24 text-center">
                    <RefreshCw className="w-8 h-8 animate-spin text-maroon mx-auto mb-4" />
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Loading Attendance Matrices...</p>
                </div>
            ) : (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden print:border-none print:shadow-none print:bg-transparent">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse print:text-[10px]">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100 print:bg-transparent print:border-b-2 print:border-gray-300">
                                    <th className="px-6 py-4.5 text-[9px] font-black text-gray-400 uppercase tracking-widest print:py-2">Student & ID</th>
                                    <th className="px-6 py-4.5 text-[9px] font-black text-gray-400 uppercase tracking-widest print:py-2">Course Program</th>
                                    
                                    {activeTab === 'overall' && (
                                        <>
                                            <th className="px-6 py-4.5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center print:py-2">Classes</th>
                                            <th className="px-6 py-4.5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center print:py-2">Present/Late/Absent</th>
                                            <th className="px-6 py-4.5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center print:py-2">Overall Rate</th>
                                            <th className="px-6 py-4.5 text-[9px] font-black text-gray-400 uppercase tracking-widest print:py-2">Monthly extremes</th>
                                        </>
                                    )}

                                    {activeTab === 'weekly' && (
                                        <>
                                            <th className="px-6 py-4.5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center print:py-2">Total Weeks</th>
                                            <th className="px-6 py-4.5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center print:py-2">Weekly Average</th>
                                            <th className="px-6 py-4.5 text-[9px] font-black text-gray-400 uppercase tracking-widest print:py-2">Weekly Extremes</th>
                                        </>
                                    )}

                                    {activeTab === 'monthly' && (
                                        <>
                                            <th className="px-6 py-4.5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center print:py-2">Total Months</th>
                                            <th className="px-6 py-4.5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center print:py-2">Monthly Average</th>
                                            <th className="px-6 py-4.5 text-[9px] font-black text-gray-400 uppercase tracking-widest print:py-2">Monthly Extremes</th>
                                        </>
                                    )}

                                    <th className="px-6 py-4.5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center print:hidden">Breakdown</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 print:divide-y print:divide-gray-200">
                                {filteredData.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-16 text-center text-gray-400 text-xs font-bold uppercase tracking-widest">
                                            No student attendance summary matched the selected filters.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredData.map((student, idx) => {
                                        const isExpanded = !!expandedRows[student.student_id];
                                        const extremes = getStudentExtremes(student, activeTab === 'weekly' ? 'weekly' : 'monthly');
                                        
                                        const isVisible = idx >= (currentPage - 1) * pageSize && idx < currentPage * pageSize;
                                        
                                        return (
                                            <>
                                                {/* Parent Row */}
                                                <tr key={student.student_id} className={`hover:bg-gray-50/50 transition-colors print:hover:bg-transparent ${isVisible ? '' : 'hidden print:table-row'}`}>
                                                    <td className="px-6 py-4.5">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-gray-800 print:text-[10px]">{student.student_name}</span>
                                                            <span className="text-[10px] text-gray-400 font-mono mt-0.5 print:text-[8px]">{student.student_id}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4.5">
                                                        <span className="text-xs text-gray-600 font-medium print:text-[10px]">{student.course}</span>
                                                    </td>

                                                    {activeTab === 'overall' && (
                                                        <>
                                                            <td className="px-6 py-4.5 text-center text-xs font-bold text-gray-700">
                                                                {student.overall?.total || 0}
                                                            </td>
                                                            <td className="px-6 py-4.5 text-center text-xs font-semibold">
                                                                <span className="text-emerald-600">{student.overall?.present || 0}P</span>
                                                                <span className="text-gray-400 mx-1">/</span>
                                                                <span className="text-amber-600">{student.overall?.late || 0}L</span>
                                                                <span className="text-gray-400 mx-1">/</span>
                                                                <span className="text-rose-500">{student.overall?.absent || 0}A</span>
                                                            </td>
                                                            <td className="px-6 py-4.5 text-center">
                                                                <span className={`inline-flex items-center gap-1 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-wider border ${getRateColor(student.overall?.rate || 0)}`}>
                                                                    {student.overall?.rate || 0}%
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4.5 text-xs text-gray-500">
                                                                <div className="flex flex-col gap-0.5">
                                                                    <span className="text-[9px]"><strong className="text-emerald-600">Peak:</strong> {extremes.best}</span>
                                                                    <span className="text-[9px]"><strong className="text-rose-500">Low:</strong> {extremes.worst}</span>
                                                                </div>
                                                            </td>
                                                        </>
                                                    )}

                                                    {activeTab === 'weekly' && (
                                                        <>
                                                            <td className="px-6 py-4.5 text-center text-xs font-bold text-gray-700">
                                                                {(student.weekly || []).length} wks
                                                            </td>
                                                            <td className="px-6 py-4.5 text-center">
                                                                <span className={`inline-flex items-center gap-1 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-wider border ${getRateColor(student.overall?.rate || 0)}`}>
                                                                    {student.overall?.rate || 0}%
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4.5 text-xs text-gray-500">
                                                                <div className="flex flex-col gap-0.5">
                                                                    <span className="text-[9px]"><strong className="text-emerald-600">Best:</strong> {extremes.best}</span>
                                                                    <span className="text-[9px]"><strong className="text-rose-500">Worst:</strong> {extremes.worst}</span>
                                                                </div>
                                                            </td>
                                                        </>
                                                    )}

                                                    {activeTab === 'monthly' && (
                                                        <>
                                                            <td className="px-6 py-4.5 text-center text-xs font-bold text-gray-700">
                                                                {(student.monthly || []).length} mos
                                                            </td>
                                                            <td className="px-6 py-4.5 text-center">
                                                                <span className={`inline-flex items-center gap-1 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-wider border ${getRateColor(student.overall?.rate || 0)}`}>
                                                                    {student.overall?.rate || 0}%
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4.5 text-xs text-gray-500">
                                                                <div className="flex flex-col gap-0.5">
                                                                    <span className="text-[9px]"><strong className="text-emerald-600">Best:</strong> {extremes.best}</span>
                                                                    <span className="text-[9px]"><strong className="text-rose-500">Worst:</strong> {extremes.worst}</span>
                                                                </div>
                                                            </td>
                                                        </>
                                                    )}

                                                    <td className="px-6 py-4.5 text-center print:hidden">
                                                        <button
                                                            onClick={() => toggleRow(student.student_id)}
                                                            className="p-2 bg-gray-50 hover:bg-maroon hover:text-white rounded-xl transition-all duration-200 active:scale-95 border border-gray-100 flex items-center justify-center gap-1 mx-auto text-[9px] font-black uppercase tracking-wider"
                                                        >
                                                            {isExpanded ? (
                                                                <>
                                                                    <ChevronUp className="w-3.5 h-3.5" />
                                                                    Hide
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <ChevronDown className="w-3.5 h-3.5" />
                                                                    Details
                                                                </>
                                                            )}
                                                        </button>
                                                    </td>
                                                </tr>

                                                {/* Expanded Breakdown Row */}
                                                {isExpanded && isVisible && (
                                                    <tr className="bg-maroon/[0.01] animate-in slide-in-from-top-2 duration-300 print:hidden">
                                                        <td colSpan={7} className="px-8 py-6 border-l-4 border-maroon">
                                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                                                {/* Weekly Breakdown Table */}
                                                                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
                                                                    <div className="flex justify-between items-center pb-2 border-b border-gray-50">
                                                                        <h4 className="text-[10px] font-black text-maroon uppercase tracking-wider flex items-center gap-2">
                                                                            <Clock className="w-3.5 h-3.5 text-gold" />
                                                                            Weekly Attendance Ledger
                                                                        </h4>
                                                                        <span className="text-[8px] font-black text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md">
                                                                            {(student.weekly || []).length} weeks total
                                                                        </span>
                                                                    </div>
                                                                    <div className="max-h-60 overflow-y-auto">
                                                                        <table className="w-full text-left text-[11px]">
                                                                            <thead>
                                                                                <tr className="text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-1">
                                                                                    <th className="py-2">Week Period</th>
                                                                                    <th className="py-2 text-center">Classes</th>
                                                                                    <th className="py-2 text-center">P / L / A</th>
                                                                                    <th className="py-2 text-right">Weekly Rate</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-gray-50">
                                                                                {(student.weekly || []).length === 0 ? (
                                                                                    <tr>
                                                                                        <td colSpan={4} className="py-4 text-center text-gray-400 font-bold uppercase tracking-wider text-[9px]">No weekly records.</td>
                                                                                    </tr>
                                                                                ) : (
                                                                                    student.weekly.map(w => (
                                                                                        <tr key={w.week} className="hover:bg-gray-50/50">
                                                                                            <td className="py-2.5 font-mono text-gray-500">
                                                                                                Wk {w.week.split('-W')[1]} ({w.week.split('-W')[0]})
                                                                                            </td>
                                                                                            <td className="py-2.5 text-center font-bold text-gray-700">
                                                                                                {w.total}
                                                                                            </td>
                                                                                            <td className="py-2.5 text-center font-medium">
                                                                                                <span className="text-emerald-600">{w.present}</span>
                                                                                                <span className="text-gray-300 mx-1">/</span>
                                                                                                <span className="text-amber-600">{w.late}</span>
                                                                                                <span className="text-gray-300 mx-1">/</span>
                                                                                                <span className="text-rose-500">{w.absent}</span>
                                                                                            </td>
                                                                                            <td className="py-2.5 text-right font-black text-gray-800">
                                                                                                <span className={`inline-block px-2 py-0.5 rounded text-[9px] border ${getRateColor(w.rate)}`}>
                                                                                                    {w.rate}%
                                                                                                </span>
                                                                                            </td>
                                                                                        </tr>
                                                                                    ))
                                                                                )}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>

                                                                {/* Monthly Breakdown Table */}
                                                                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
                                                                    <div className="flex justify-between items-center pb-2 border-b border-gray-50">
                                                                        <h4 className="text-[10px] font-black text-maroon uppercase tracking-wider flex items-center gap-2">
                                                                            <Calendar className="w-3.5 h-3.5 text-gold" />
                                                                            Monthly Attendance Ledger
                                                                        </h4>
                                                                        <span className="text-[8px] font-black text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md">
                                                                            {(student.monthly || []).length} months total
                                                                        </span>
                                                                    </div>
                                                                    <div className="max-h-60 overflow-y-auto">
                                                                        <table className="w-full text-left text-[11px]">
                                                                            <thead>
                                                                                <tr className="text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-1">
                                                                                    <th className="py-2">Month Period</th>
                                                                                    <th className="py-2 text-center">Classes</th>
                                                                                    <th className="py-2 text-center">P / L / A</th>
                                                                                    <th className="py-2 text-right">Monthly Rate</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-gray-50">
                                                                                {(student.monthly || []).length === 0 ? (
                                                                                    <tr>
                                                                                        <td colSpan={4} className="py-4 text-center text-gray-400 font-bold uppercase tracking-wider text-[9px]">No monthly records.</td>
                                                                                    </tr>
                                                                                ) : (
                                                                                    student.monthly.map(m => {
                                                                                        const [year, month] = m.month.split('-');
                                                                                        const dateName = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
                                                                                        return (
                                                                                            <tr key={m.month} className="hover:bg-gray-50/50">
                                                                                                <td className="py-2.5 font-bold text-gray-600">
                                                                                                    {dateName}
                                                                                                </td>
                                                                                                <td className="py-2.5 text-center font-bold text-gray-700">
                                                                                                    {m.total}
                                                                                                </td>
                                                                                                <td className="py-2.5 text-center font-medium">
                                                                                                    <span className="text-emerald-600">{m.present}</span>
                                                                                                    <span className="text-gray-300 mx-1">/</span>
                                                                                                    <span className="text-amber-600">{m.late}</span>
                                                                                                    <span className="text-gray-300 mx-1">/</span>
                                                                                                    <span className="text-rose-500">{m.absent}</span>
                                                                                                </td>
                                                                                                <td className="py-2.5 text-right font-black text-gray-800">
                                                                                                    <span className={`inline-block px-2 py-0.5 rounded text-[9px] border ${getRateColor(m.rate)}`}>
                                                                                                        {m.rate}%
                                                                                                    </span>
                                                                                                </td>
                                                                                            </tr>
                                                                                        );
                                                                                    })
                                                                                )}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex flex-col sm:flex-row justify-between items-center px-6 py-4 border-t border-gray-100 gap-4 print:hidden bg-gray-50/50">
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                Showing <span className="text-maroon font-black">{startIdx + 1}</span> to <span className="text-maroon font-black">{Math.min(endIdx, totalStudents)}</span> of <span className="text-maroon font-black">{totalStudents}</span> students
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 border border-gray-100 rounded-xl bg-white text-gray-400 hover:text-maroon disabled:opacity-40 disabled:hover:text-gray-400 transition-all shadow-sm"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                
                                {pageNumbers.map(page => (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={`w-8 h-8 rounded-xl text-[10px] font-black transition-all shadow-sm ${
                                            currentPage === page
                                                ? 'bg-maroon text-gold border border-maroon scale-105'
                                                : 'bg-white text-gray-500 border border-gray-100 hover:text-maroon hover:border-maroon/20'
                                        }`}
                                    >
                                        {page}
                                    </button>
                                ))}

                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 border border-gray-100 rounded-xl bg-white text-gray-400 hover:text-maroon disabled:opacity-40 disabled:hover:text-gray-400 transition-all shadow-sm"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Hidden PDF/Print Capture Container */}
            {isGeneratingPDF && (
                <div className="fixed -left-[9999px] -top-[9999px] z-[-50]">
                    <div id="attendance-summary-pdf-view" className="w-[210mm] bg-white p-8 font-sans">
                        {/* Letterhead */}
                        <div className="text-center mb-6 border-b-2 border-maroon pb-6">
                            <div className="flex flex-col items-center mb-4">
                                <img src="/app-icon-v2.png" alt="College Logo" className="w-20 h-20 object-contain mb-3" />
                                <h1 className="text-2xl font-black text-maroon uppercase tracking-widest mb-1">Beautex Technical Training College</h1>
                                <p className="text-[10px] font-bold text-gray-400 tracking-[0.2em] uppercase italic">"Empowering minds, shaping innovations"</p>
                            </div>
                            <div className="w-16 h-0.5 bg-gold mx-auto mb-4" />
                            <h2 className="text-sm text-black font-black uppercase tracking-[0.2em]">Attendance Summary Audit Report</h2>
                        </div>

                        {/* Report Parameters */}
                        <div className="grid grid-cols-2 gap-4 mb-6 pb-4 border-b border-maroon/10 text-xs">
                            <div>
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Academic Scope</p>
                                <p className="font-bold text-maroon uppercase">{selectedCourse || 'All Registered Course Programs'}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Date Generated</p>
                                <p className="font-bold text-maroon">{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Audit View Matrix</p>
                                <p className="font-bold text-gray-800 uppercase">{activeTab} Ledger View</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Cohort Strength</p>
                                <p className="font-bold text-gray-800">{totalStudents} Active Students</p>
                            </div>
                        </div>

                        {/* Metrics Cards */}
                        <div className="grid grid-cols-4 gap-4 mb-6">
                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
                                <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Cohort Size</p>
                                <p className="text-sm font-black text-gray-800">{totalStudents}</p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
                                <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Avg Attendance</p>
                                <p className="text-sm font-black text-emerald-600">{avgAttendanceRate}%</p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
                                <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Peak Week</p>
                                <p className="text-[10px] font-black text-maroon truncate" title={bestWeek.name}>{bestWeek.name || 'N/A'}</p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
                                <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Peak Month</p>
                                <p className="text-[10px] font-black text-blue-600 truncate" title={bestMonth.name}>{bestMonth.name || 'N/A'}</p>
                            </div>
                        </div>

                        {/* Data Table */}
                        <table className="w-full text-left border-collapse border border-gray-150 text-[10px]">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-4 py-2 font-black text-gray-600 uppercase tracking-wider">Student Name & ID</th>
                                    <th className="px-4 py-2 font-black text-gray-600 uppercase tracking-wider">Course Program</th>
                                    {activeTab === 'overall' && (
                                        <>
                                            <th className="px-4 py-2 font-black text-gray-600 uppercase tracking-wider text-center">Classes</th>
                                            <th className="px-4 py-2 font-black text-gray-600 uppercase tracking-wider text-center">P / L / A</th>
                                            <th className="px-4 py-2 font-black text-gray-600 uppercase tracking-wider text-center">Overall Rate</th>
                                        </>
                                    )}
                                    {activeTab === 'weekly' && (
                                        <>
                                            <th className="px-4 py-2 font-black text-gray-600 uppercase tracking-wider text-center">Weeks</th>
                                            <th className="px-4 py-2 font-black text-gray-600 uppercase tracking-wider text-center">Weekly Rate</th>
                                        </>
                                    )}
                                    {activeTab === 'monthly' && (
                                        <>
                                            <th className="px-4 py-2 font-black text-gray-600 uppercase tracking-wider text-center">Months</th>
                                            <th className="px-4 py-2 font-black text-gray-600 uppercase tracking-wider text-center">Monthly Rate</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredData.map(student => {
                                    return (
                                        <tr key={student.student_id} className="hover:bg-gray-50/20">
                                            <td className="px-4 py-2">
                                                <div className="font-bold text-gray-800">{student.student_name}</div>
                                                <div className="text-[8px] text-gray-400 font-mono mt-0.5">{student.student_id}</div>
                                            </td>
                                            <td className="px-4 py-2 text-gray-600">{student.course}</td>
                                            {activeTab === 'overall' && (
                                                <>
                                                    <td className="px-4 py-2 text-center font-bold text-gray-700">{student.overall?.total || 0}</td>
                                                    <td className="px-4 py-2 text-center">
                                                        <span className="text-emerald-600">{student.overall?.present || 0}P</span>
                                                        <span className="text-gray-300 mx-1">/</span>
                                                        <span className="text-amber-500">{student.overall?.late || 0}L</span>
                                                        <span className="text-gray-300 mx-1">/</span>
                                                        <span className="text-rose-500">{student.overall?.absent || 0}A</span>
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        <span className="font-black text-gray-800">{student.overall?.rate || 0}%</span>
                                                    </td>
                                                </>
                                            )}
                                            {activeTab === 'weekly' && (
                                                <>
                                                    <td className="px-4 py-2 text-center font-bold text-gray-700">{(student.weekly || []).length} wks</td>
                                                    <td className="px-4 py-2 text-center font-black text-gray-800">{student.overall?.rate || 0}%</td>
                                                </>
                                            )}
                                            {activeTab === 'monthly' && (
                                                <>
                                                    <td className="px-4 py-2 text-center font-bold text-gray-700">{(student.monthly || []).length} mos</td>
                                                    <td className="px-4 py-2 text-center font-black text-gray-800">{student.overall?.rate || 0}%</td>
                                                </>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* Signatures */}
                        <div className="mt-12 pt-8 border-t border-maroon/10">
                            <div className="grid grid-cols-2 gap-20">
                                <div className="text-center">
                                    <div className="h-10 border-b border-gray-300 mb-2" />
                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Academic Director Signature</p>
                                </div>
                                <div className="text-center">
                                    <div className="h-10 border-b border-gray-300 mb-2" />
                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Registrar Verification Stamp</p>
                                </div>
                            </div>
                            <div className="text-center mt-8">
                                <p className="text-[8px] font-black text-maroon uppercase tracking-widest">
                                    Beautex Technical Training College - Registry Division
                                </p>
                                <p className="text-[6px] text-gray-400 uppercase tracking-widest mt-1">
                                    Report Generated: {new Date().toLocaleString()} | Digital Signature Verified
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
