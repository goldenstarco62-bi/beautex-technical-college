import { useState, useEffect, useCallback, useRef } from 'react';
import { activityReportsAPI, facultyAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from 'recharts';
import {
  BarChart2, Calendar, AlertTriangle, CheckCircle, Download,
  RefreshCw, Filter, X, BookOpen, Users, Activity, Layers,
  ChevronDown, ChevronUp, Sparkles, FileText, TrendingUp
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ── Helpers ────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().split('T')[0];
const weekStart = () => {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1);
  return d.toISOString().split('T')[0];
};
const monthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

const REPORT_TYPES = [
  { id: 'daily',   label: 'Daily Summary',   icon: Calendar,  start: today,      end: today },
  { id: 'weekly',  label: 'Weekly Summary',  icon: BarChart2, start: weekStart,  end: today },
  { id: 'monthly', label: 'Monthly Summary', icon: TrendingUp, start: monthStart, end: today },
];

const MAROON = '#800000';
const GOLD   = '#FFD700';

const StatCard = ({ label, value, sub, icon: Icon, color = 'maroon' }) => (
  <div className="bg-white border border-maroon/8 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color === 'gold' ? 'bg-gold/10' : color === 'green' ? 'bg-green-50' : color === 'amber' ? 'bg-amber-50' : 'bg-maroon/8'}`}>
      <Icon className={`w-6 h-6 ${color === 'gold' ? 'text-yellow-600' : color === 'green' ? 'text-green-600' : color === 'amber' ? 'text-amber-600' : 'text-maroon'}`} />
    </div>
    <div>
      <p className="text-2xl font-black text-maroon">{value}</p>
      <p className="text-[10px] font-black text-maroon/40 uppercase tracking-widest">{label}</p>
      {sub && <p className="text-[9px] text-maroon/30 font-medium mt-0.5">{sub}</p>}
    </div>
  </div>
);

export default function AcademicSummaryReport() {
  const { user } = useAuth();
  const printRef = useRef(null);

  const [activeType, setActiveType] = useState('monthly');
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate,   setEndDate]   = useState(today());
  const [department, setDepartment] = useState('');
  const [trainer,    setTrainer]    = useState('');
  const [trainers,   setTrainers]   = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [expandedDepts, setExpandedDepts] = useState({});

  // Set date range when tab changes
  useEffect(() => {
    const tab = REPORT_TYPES.find(t => t.id === activeType);
    if (tab) { setStartDate(tab.start()); setEndDate(tab.end()); }
  }, [activeType]);

  useEffect(() => {
    facultyAPI.getAll().then(r => setTrainers(r.data || [])).catch(() => {});
  }, []);

  const fetchSummary = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await activityReportsAPI.getAcademicSummary({ startDate, endDate, department: department || undefined, trainer: trainer || undefined });
      setData(res.data.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load summary');
    } finally { setLoading(false); }
  }, [startDate, endDate, department, trainer]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const clearFilters = () => { setDepartment(''); setTrainer(''); };

  const handlePDF = async () => {
    if (!printRef.current) return;
    setPdfLoading(true);
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, backgroundColor: '#fff' });
      const img = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      const pageH = pdf.internal.pageSize.getHeight();
      let y = 0;
      while (y < h) {
        pdf.addImage(img, 'PNG', 0, -y, w, h);
        y += pageH;
        if (y < h) pdf.addPage();
      }
      pdf.save(`Academic_Summary_${activeType}_${startDate}_to_${endDate}.pdf`);
    } catch (e) { alert('PDF generation failed'); }
    finally { setPdfLoading(false); }
  };

  const toggleDept = dept => setExpandedDepts(p => ({ ...p, [dept]: !p[dept] }));

  const stats = data?.stats || {};
  const deptBreakdown = data?.departmentBreakdown || {};
  const deptActivity  = data?.departmentActivity || [];
  const trend         = data?.attendanceTrend || [];
  const warnings      = data?.warnings || [];
  const aiNarrative   = data?.aiNarrative || '';
  const knownDepts    = Object.keys(deptBreakdown).sort();
  const attendRate    = stats.totalStudentsExpected > 0 ? Math.round((stats.totalStudentsPresent / stats.totalStudentsExpected) * 100) : null;

  return (
    <div className="space-y-8 pb-20">

      {/* ── Header ───────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <p className="text-[10px] font-black text-maroon/30 uppercase tracking-[0.3em] mb-1">Beautex Technical College</p>
          <h1 className="text-2xl sm:text-3xl font-black text-maroon uppercase tracking-tight">Academic Summary Report</h1>
          <div className="w-16 h-0.5 bg-gold mt-3" />
          <p className="text-xs text-maroon/40 font-bold mt-2">Auto-aggregated from daily trainer & activity reports</p>
        </div>
        <button
          onClick={handlePDF}
          disabled={pdfLoading || loading || !data}
          className="flex items-center gap-2 px-6 py-3 bg-maroon text-gold rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-maroon/90 shadow-lg transition-all disabled:opacity-50 border border-gold/20"
        >
          {pdfLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Download PDF
        </button>
      </div>

      {/* ── Report Type Tabs ─────────────────────── */}
      <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-2xl border border-gray-200/50 w-fit">
        {REPORT_TYPES.map(tab => {
          const Icon = tab.icon;
          const active = activeType === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveType(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${active ? 'bg-white text-maroon shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}>
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Filters ──────────────────────────────── */}
      <div className="bg-white border border-maroon/8 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-maroon/50" />
          <p className="text-[10px] font-black text-maroon/50 uppercase tracking-widest">Filters</p>
          {(department || trainer) && (
            <button onClick={clearFilters} className="ml-auto text-[9px] font-black text-red-400 uppercase tracking-widest hover:text-red-600 flex items-center gap-1">
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-[9px] font-black text-maroon/40 uppercase tracking-widest">From</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-maroon font-bold text-xs outline-none focus:ring-2 focus:ring-maroon/10" />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-maroon/40 uppercase tracking-widest">To</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-maroon font-bold text-xs outline-none focus:ring-2 focus:ring-maroon/10" />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-maroon/40 uppercase tracking-widest">Department</label>
            <select value={department} onChange={e => setDepartment(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-maroon font-bold text-xs outline-none focus:ring-2 focus:ring-maroon/10">
              <option value="">All Departments</option>
              {knownDepts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-maroon/40 uppercase tracking-widest">Trainer</label>
            <select value={trainer} onChange={e => setTrainer(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-maroon font-bold text-xs outline-none focus:ring-2 focus:ring-maroon/10">
              <option value="">All Trainers</option>
              {trainers.map(t => <option key={t.id || t._id} value={t.name}>{t.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Loading / Error ───────────────────────── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <RefreshCw className="w-10 h-10 text-maroon animate-spin" />
          <p className="text-sm font-black text-maroon/40 uppercase tracking-widest animate-pulse">Compiling Academic Data...</p>
        </div>
      )}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-center gap-4">
          <AlertTriangle className="w-6 h-6 text-red-500 shrink-0" />
          <div>
            <p className="font-black text-red-700 text-sm">Failed to load summary</p>
            <p className="text-xs text-red-500 mt-1">{error}</p>
          </div>
          <button onClick={fetchSummary} className="ml-auto px-4 py-2 bg-red-100 text-red-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-200 transition-colors">Retry</button>
        </div>
      )}

      {!loading && !error && data && (
        <div ref={printRef} className="space-y-8">

          {/* ── Institutional PDF Header (visible in PDF) ─────── */}
          <div className="hidden print:block mb-8">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <img src="/app-icon-v2.png" alt="Logo" className="w-20 h-20 object-contain" />
                <div>
                  <h1 className="text-2xl font-black text-maroon tracking-tighter uppercase leading-tight">Beautex Technical Training College</h1>
                  <p className="text-[10px] font-black text-maroon/60 tracking-[0.2em] uppercase">Institutional Management System</p>
                </div>
              </div>
              <div className="text-right">
                <div className="bg-maroon text-white px-4 py-2 rounded-lg inline-block mb-1">
                  <p className="text-[10px] font-black uppercase tracking-widest">Academic Summary Report</p>
                </div>
                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Institutional Performance Record</p>
              </div>
            </div>

            {/* Maroon Info Bar */}
            <div className="bg-maroon rounded-2xl p-4 grid grid-cols-3 gap-4 text-white shadow-xl">
              <div className="border-r border-white/20">
                <p className="text-[8px] font-black text-gold/60 uppercase tracking-widest mb-1">Audit Period</p>
                <p className="text-xs font-black uppercase tracking-tight">
                  {startDate === endDate 
                    ? new Date(startDate).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                    : `${startDate} to ${endDate}`
                  }
                </p>
              </div>
              <div className="border-r border-white/20 px-4">
                <p className="text-[8px] font-black text-gold/60 uppercase tracking-widest mb-1">Scope / Department</p>
                <p className="text-xs font-black uppercase tracking-tight">{department || 'Institutional Wide'}</p>
              </div>
              <div className="px-4">
                <p className="text-[8px] font-black text-gold/60 uppercase tracking-widest mb-1">Lead Auditor</p>
                <p className="text-xs font-black uppercase tracking-tight">{user?.name || 'Administrator'}</p>
              </div>
            </div>
          </div>

          {/* ── Warnings Panel ───────────────────── */}
          {warnings.length > 0 && (
            <div className="space-y-2">
              {warnings.map((w, i) => (
                <div key={i} className={`flex items-center gap-3 px-5 py-3 rounded-xl border text-xs font-bold ${w.type === 'no_submissions' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {w.message}
                </div>
              ))}
            </div>
          )}

          {/* ── Section Header: Overview ───────────────────── */}
          <div className="flex items-center gap-2 px-4 py-2 bg-maroon/5 border-l-4 border-maroon mb-6">
            <Activity className="w-4 h-4 text-maroon" />
            <h2 className="text-[10px] font-black text-maroon uppercase tracking-[0.2em]">Institutional Performance Overview</h2>
          </div>

          {/* ── Summary Cards ────────────────────── */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="border-2 border-gray-100 rounded-2xl p-4 text-center bg-white shadow-sm">
              <p className="text-[22px] font-black text-maroon">{stats.totalClassesConducted ?? 0}</p>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Classes Conducted</p>
            </div>
            <div className="border-2 border-gray-100 rounded-2xl p-4 text-center bg-white shadow-sm">
              <p className="text-[22px] font-black text-green-600">{stats.totalStudentsPresent ?? 0}</p>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Students Present</p>
              {attendRate !== null && <p className="text-[8px] font-bold text-green-500 mt-1">{attendRate}% Rate</p>}
            </div>
            <div className="border-2 border-gray-100 rounded-2xl p-4 text-center bg-white shadow-sm">
              <p className="text-[22px] font-black text-gold">{stats.activeDepartments ?? 0}</p>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Active Depts</p>
            </div>
            <div className="border-2 border-gray-100 rounded-2xl p-4 text-center bg-white shadow-sm">
              <p className="text-[22px] font-black text-amber-600">{(stats.totalReports ?? 0) + (stats.totalTrainerReports ?? 0) + (stats.totalAcademicReports ?? 0)}</p>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total Reports</p>
            </div>
          </div>

          {/* ── AI Narrative: Executive Summary ─────── */}
          {aiNarrative && (
            <div className="mb-8">
              <div className="flex items-center gap-2 px-4 py-2 bg-gold/10 border-l-4 border-gold mb-4">
                <Sparkles className="w-4 h-4 text-gold" />
                <h2 className="text-[10px] font-black text-maroon uppercase tracking-[0.2em]">Executive Academic Summary</h2>
              </div>
              <div className="bg-white border-2 border-gold/10 rounded-2xl p-6 italic relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gold/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
                <p className="text-sm text-maroon/80 leading-relaxed font-medium relative z-10">"{aiNarrative}"</p>
              </div>
            </div>
          )}

          {/* ── Charts Row ───────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Dept Activity Bar Chart */}
            <div className="bg-white border border-maroon/8 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-5">
                <BarChart2 className="w-4 h-4 text-maroon" />
                <h3 className="text-xs font-black text-maroon uppercase tracking-widest">Department Activity</h3>
              </div>
              {deptActivity.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={deptActivity} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="department" tick={{ fontSize: 9, fontWeight: 800, fill: '#800000' }} angle={-30} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: 'none', fontSize: 10, fontWeight: 'bold' }} />
                    <Bar dataKey="classes" name="Classes" fill={MAROON} radius={[4,4,0,0]} />
                    <Bar dataKey="students" name="Students Present" fill={GOLD} radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-maroon/20 font-black uppercase text-xs">No data for period</div>
              )}
            </div>

            {/* Attendance Trend Line Chart */}
            <div className="bg-white border border-maroon/8 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-5">
                <Activity className="w-4 h-4 text-maroon" />
                <h3 className="text-xs font-black text-maroon uppercase tracking-widest">Attendance Trend</h3>
              </div>
              {trend.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fontWeight: 800 }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: 'none', fontSize: 10, fontWeight: 'bold' }} />
                    <Legend wrapperStyle={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }} />
                    <Line type="monotone" dataKey="present" name="Present" stroke={MAROON} strokeWidth={2.5} dot={{ r: 4, fill: MAROON }} />
                    <Line type="monotone" dataKey="expected" name="Expected" stroke={GOLD} strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-maroon/20 font-black uppercase text-xs">No attendance data</div>
              )}
            </div>
          </div>

          {/* ── Department Breakdown Table (UI ONLY) ────────── */}
          <div className="print:hidden bg-white border border-maroon/8 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-maroon/5 bg-maroon/[0.02]">
              <Layers className="w-4 h-4 text-maroon" />
              <h3 className="text-xs font-black text-maroon uppercase tracking-widest">Departmental Activity Hub</h3>
            </div>
            <div className="divide-y divide-maroon/5">
              {knownDepts.map(dept => {
                const d = deptBreakdown[dept];
                const rate = d.studentsExpected > 0 ? Math.round((d.studentsPresent / d.studentsExpected) * 100) : null;
                const isExpanded = expandedDepts[dept];
                const hasData = d.classCount > 0 || d.trainerReportCount > 0;
                return (
                  <div key={dept}>
                    <button onClick={() => toggleDept(dept)}
                      className="w-full flex items-center gap-4 px-6 py-4 hover:bg-maroon/[0.02] transition-colors text-left">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${hasData ? 'bg-green-400' : 'bg-red-300'}`} />
                      <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-3 items-center">
                        <p className="font-black text-maroon text-xs uppercase tracking-wider col-span-2 md:col-span-1">{dept}</p>
                        <div className="text-center hidden md:block">
                          <p className="font-black text-maroon text-sm">{d.classCount}</p>
                          <p className="text-[8px] font-black text-maroon/30 uppercase">Classes</p>
                        </div>
                        <div className="text-center hidden md:block">
                          <p className="font-black text-maroon text-sm">{d.studentsPresent}</p>
                          <p className="text-[8px] font-black text-maroon/30 uppercase">Students</p>
                        </div>
                        <div className="text-center hidden md:block">
                          <p className={`font-black text-sm ${rate !== null ? (rate >= 75 ? 'text-green-600' : rate >= 50 ? 'text-amber-600' : 'text-red-500') : 'text-maroon/30'}`}>
                            {rate !== null ? `${rate}%` : '—'}
                          </p>
                          <p className="text-[8px] font-black text-maroon/30 uppercase">Attendance</p>
                        </div>
                        <div className="hidden md:block">
                          {!hasData ? (
                            <span className="px-2 py-1 bg-red-50 border border-red-200 text-red-600 rounded-lg text-[9px] font-black uppercase">No Data</span>
                          ) : (
                            <span className="px-2 py-1 bg-green-50 border border-green-200 text-green-600 rounded-lg text-[9px] font-black uppercase">Active</span>
                          )}
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-maroon/30 shrink-0" /> : <ChevronDown className="w-4 h-4 text-maroon/30 shrink-0" />}
                    </button>

                    {isExpanded && (
                      <div className="px-6 pb-5 pt-2 bg-maroon/[0.01] border-t border-maroon/5 grid md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-[9px] font-black text-maroon/40 uppercase tracking-widest mb-2">Topics Covered</p>
                          {d.topics.length > 0 ? d.topics.map((t, i) => <p key={i} className="text-xs text-maroon/70 font-medium leading-relaxed">• {t}</p>) : <p className="text-xs text-maroon/30 italic">None recorded</p>}
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-maroon/40 uppercase tracking-widest mb-2">Practical Activities</p>
                          {d.practicals.length > 0 ? d.practicals.map((p, i) => <p key={i} className="text-xs text-maroon/70 font-medium leading-relaxed">• {p}</p>) : <p className="text-xs text-maroon/30 italic">None recorded</p>}
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-maroon/40 uppercase tracking-widest mb-2">Challenges</p>
                          {d.challenges.length > 0 ? d.challenges.map((c, i) => <p key={i} className="text-xs text-red-600/70 font-medium leading-relaxed">• {c}</p>) : <p className="text-xs text-green-600/60 italic font-medium">No challenges reported</p>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Department Breakdown Boxed List (PRINT ONLY) ──── */}
          <div className="hidden print:block mb-8">
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-l-4 border-blue-600 mb-6">
              <Layers className="w-4 h-4 text-blue-600" />
              <h2 className="text-[10px] font-black text-maroon uppercase tracking-[0.2em]">Departmental Operations & Curriculum Delivery</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              {knownDepts.map(dept => {
                const d = deptBreakdown[dept];
                const hasData = d.classCount > 0 || d.trainerReportCount > 0;
                return (
                  <div key={dept} className="bg-white border-2 border-gray-100 rounded-2xl p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-50">
                      <h3 className="text-xs font-black text-maroon uppercase tracking-wider">{dept}</h3>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${hasData ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                        {hasData ? 'Active' : 'Missing Logs'}
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-[9px]">
                        <span className="font-black text-gray-400 uppercase tracking-tight">Classes Conducted:</span>
                        <span className="font-bold text-maroon">{d.classCount}</span>
                      </div>
                      <div className="flex justify-between text-[9px]">
                        <span className="font-black text-gray-400 uppercase tracking-tight">Attendance:</span>
                        <span className="font-bold text-maroon">{d.studentsExpected > 0 ? `${Math.round((d.studentsPresent/d.studentsExpected)*100)}%` : 'N/A'}</span>
                      </div>
                      <div className="pt-2 border-t border-gray-50">
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Topics Covered:</p>
                        <p className="text-[9px] text-maroon/80 font-medium leading-relaxed italic line-clamp-3">
                          {d.topics.length > 0 ? d.topics.join('; ') : 'No topics logged.'}
                        </p>
                      </div>
                      <div className="pt-2">
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Practical/Record of Work:</p>
                        <p className="text-[9px] text-maroon/80 font-medium leading-relaxed italic line-clamp-3">
                          {d.practicals.length > 0 ? d.practicals.join('; ') : 'No practical work logged.'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Institutional Signature & Authentication ────── */}
          <div className="hidden print:block mt-12 pt-8 border-t-2 border-gray-100">
            <div className="grid grid-cols-3 gap-8">
              <div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-12">Lead Auditor Verification</p>
                <div className="border-b-2 border-maroon w-full mb-2"></div>
                <p className="text-[10px] font-black text-maroon uppercase tracking-tight">{user?.name || 'Authorized Auditor'}</p>
                <p className="text-[8px] font-bold text-gray-400 uppercase">Beautex Quality Assurance</p>
              </div>
              
              <div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-12">Institutional Approval</p>
                <div className="border-b-2 border-maroon w-full mb-2"></div>
                <p className="text-[10px] font-black text-maroon uppercase tracking-tight">Managing Director</p>
                <p className="text-[8px] font-bold text-gray-400 uppercase">Beautex Technical Training College</p>
              </div>

              <div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-12">Certification Date</p>
                <div className="border-b-2 border-maroon w-full mb-2"></div>
                <p className="text-[10px] font-black text-maroon uppercase tracking-tight">
                  {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="text-[8px] font-bold text-gray-400 uppercase">Official Audit Timestamp</p>
              </div>
            </div>
            
            <div className="mt-8 flex justify-center">
              <div className="px-6 py-2 border-2 border-maroon/10 rounded-full">
                <p className="text-[7px] font-black text-maroon/30 uppercase tracking-[0.4em]">Official Institutional Performance Record • Confidential</p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── Empty state ───────────────────────────── */}
      {!loading && !error && !data && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <BarChart2 className="w-16 h-16 text-maroon/10" />
          <p className="text-sm font-black text-maroon/30 uppercase tracking-widest">Select a date range to generate the academic summary</p>
        </div>
      )}
    </div>
  );
}

