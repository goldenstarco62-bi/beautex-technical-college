import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { academicAPI, catResultsAPI, unitCoverageAPI, coursesAPI, studentsAPI } from '../services/api';
import {
    GraduationCap, CheckSquare, Award, BookOpen, Users, ArrowRight,
    TrendingUp, ShieldCheck, Clock, Layers, Sparkles, BarChart3, ChevronRight,
    FileText, Calendar, CheckCircle
} from 'lucide-react';

export default function AcademicsHub() {
    const { user } = useAuth();
    const userRole = (user?.role || '').toLowerCase().trim();
    const isStudent = userRole === 'student';
    const isTeacher = userRole === 'teacher';
    const isAdmin = ['admin', 'superadmin'].includes(userRole);

    const [activePeriod, setActivePeriod] = useState(null);
    const [coursesCount, setCoursesCount] = useState(0);
    const [studentsCount, setStudentsCount] = useState(0);
    const [catStats, setCatStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadHubStats() {
            setLoading(true);
            try {
                const [periodsRes, coursesRes, studentsRes, statsRes] = await Promise.all([
                    academicAPI.getPeriods().catch(() => ({ data: [] })),
                    coursesAPI.getAll().catch(() => ({ data: [] })),
                    isAdmin ? studentsAPI.getAll().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
                    catResultsAPI.getStats().catch(() => ({ data: null })),
                ]);

                const periods = Array.isArray(periodsRes.data) ? periodsRes.data : [];
                const active = periods.find(p => p.is_active || p.status === 'Ongoing') || periods[0] || null;
                setActivePeriod(active);

                const cList = Array.isArray(coursesRes.data) ? coursesRes.data : [];
                setCoursesCount(cList.length);

                const sList = Array.isArray(studentsRes.data) ? studentsRes.data : [];
                setStudentsCount(sList.length);

                setCatStats(statsRes.data || null);
            } catch (e) {
                console.error('AcademicsHub load error:', e);
            } finally {
                setLoading(false);
            }
        }
        loadHubStats();
    }, [isAdmin]);

    return (
        <div className="max-w-7xl mx-auto space-y-10 py-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 px-4 sm:px-6">

            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-black/8 pb-8">
                <div className="space-y-3">
                    <div className="flex items-center gap-4">
                        <div className="p-3.5 bg-gradient-to-br from-maroon to-maroon/80 shadow-2xl shadow-maroon/30 rounded-2xl text-gold">
                            <GraduationCap className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-3xl sm:text-4xl font-black text-black tracking-tight uppercase leading-none">
                                Academics Command Hub
                            </h1>
                            <div className="flex items-center gap-2 mt-2">
                                <div className="h-0.5 w-8 bg-gradient-to-r from-maroon to-gold rounded-full" />
                                <p className="text-[10px] text-black/40 font-black tracking-[0.3em] uppercase">
                                    Units Covered • Unit Coverage • CAT Results
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {activePeriod && (
                    <div className="bg-gradient-to-r from-maroon to-maroon/90 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-gold/20">
                        <Calendar className="w-5 h-5 text-gold shrink-0" />
                        <div>
                            <p className="text-[9px] font-black uppercase text-gold tracking-widest">Active Academic Term</p>
                            <p className="text-xs font-black uppercase">{activePeriod.name || `${activePeriod.year} Term ${activePeriod.term}`}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Summary Stats Strip ────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-[2rem] border border-black/5 shadow-xl relative overflow-hidden">
                    <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-1">Active Courses</p>
                    <p className="text-3xl font-black text-black">{coursesCount}</p>
                    <p className="text-[9px] font-bold text-maroon uppercase mt-2">Curriculum Programs</p>
                </div>
                {isAdmin && (
                    <div className="bg-white p-6 rounded-[2rem] border border-black/5 shadow-xl relative overflow-hidden">
                        <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-1">Total Enrolled</p>
                        <p className="text-3xl font-black text-black">{studentsCount}</p>
                        <p className="text-[9px] font-bold text-maroon uppercase mt-2">Registered Students</p>
                    </div>
                )}
                <div className="bg-white p-6 rounded-[2rem] border border-black/5 shadow-xl relative overflow-hidden">
                    <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-1">CAT Average Score</p>
                    <p className="text-3xl font-black text-maroon">
                        {catStats?.avgPercentage ? `${catStats.avgPercentage}%` : '—'}
                    </p>
                    <p className="text-[9px] font-bold text-emerald-600 uppercase mt-2">Overall Assessment</p>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-black/5 shadow-xl relative overflow-hidden">
                    <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-1">Pass Rate</p>
                    <p className="text-3xl font-black text-emerald-600">
                        {catStats?.passRate?.total > 0
                            ? `${Math.round((catStats.passRate.passed / catStats.passRate.total) * 100)}%`
                            : '—'}
                    </p>
                    <p className="text-[9px] font-bold text-black/40 uppercase mt-2">Assessment Threshold</p>
                </div>
            </div>

            {/* ── 3 Primary Subsections Grid ─────────────────────────────────── */}
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-black text-black uppercase tracking-tight">Academics Primary Modules</h2>
                    <div className="h-px flex-1 bg-black/10" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* 1. Units Covered Card */}
                    <div className="bg-white rounded-[2.5rem] p-8 border border-black/5 shadow-2xl flex flex-col justify-between group hover:border-maroon/30 transition-all duration-300 relative overflow-hidden">
                        <div className="space-y-4">
                            <div className="w-14 h-14 bg-maroon/5 rounded-2xl flex items-center justify-center text-maroon group-hover:bg-maroon group-hover:text-gold transition-all duration-300 shadow-md">
                                <GraduationCap className="w-7 h-7" />
                            </div>
                            <div>
                                <span className="text-[9px] font-black text-gold uppercase tracking-[0.25em] bg-maroon px-3 py-1 rounded-full">Module 1</span>
                                <h3 className="text-2xl font-black text-black uppercase tracking-tight mt-3">Units Covered</h3>
                                <p className="text-xs text-black/60 font-medium leading-relaxed mt-2">
                                    Competency-based module assessment matrix. Record individual and batch unit marks, evaluate student performance thresholds, and generate official academic transcripts.
                                </p>
                            </div>
                            <ul className="space-y-2 text-xs font-bold text-black/70 pt-2 border-t border-black/5">
                                <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Per-Unit Competency Marks</li>
                                <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Batch Class Grading</li>
                                <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Printable Official Transcripts</li>
                            </ul>
                        </div>
                        <div className="pt-8">
                            <Link
                                to="/grades"
                                className="w-full bg-maroon text-gold py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl hover:bg-maroon/90 transition-all group-hover:gap-3"
                            >
                                <span>Go to Units Covered</span>
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>

                    {/* 2. Unit Coverage Card */}
                    <div className="bg-white rounded-[2.5rem] p-8 border border-black/5 shadow-2xl flex flex-col justify-between group hover:border-maroon/30 transition-all duration-300 relative overflow-hidden">
                        <div className="space-y-4">
                            <div className="w-14 h-14 bg-maroon/5 rounded-2xl flex items-center justify-center text-maroon group-hover:bg-maroon group-hover:text-gold transition-all duration-300 shadow-md">
                                <CheckSquare className="w-7 h-7" />
                            </div>
                            <div>
                                <span className="text-[9px] font-black text-gold uppercase tracking-[0.25em] bg-maroon px-3 py-1 rounded-full">Module 2</span>
                                <h3 className="text-2xl font-black text-black uppercase tracking-tight mt-3">Unit Coverage</h3>
                                <p className="text-xs text-black/60 font-medium leading-relaxed mt-2">
                                    Real-time per-student curriculum delivery tracker. Teachers log covered topics and study materials, while students verify and submit confirmation feedback.
                                </p>
                            </div>
                            <ul className="space-y-2 text-xs font-bold text-black/70 pt-2 border-t border-black/5">
                                <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Topic Delivery Tracking</li>
                                <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Student Verification System</li>
                                <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Completion Rate Analytics</li>
                            </ul>
                        </div>
                        <div className="pt-8">
                            <Link
                                to="/unit-coverage"
                                className="w-full bg-maroon text-gold py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl hover:bg-maroon/90 transition-all group-hover:gap-3"
                            >
                                <span>Go to Unit Coverage</span>
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>

                    {/* 3. Results Card */}
                    <div className="bg-white rounded-[2.5rem] p-8 border border-black/5 shadow-2xl flex flex-col justify-between group hover:border-maroon/30 transition-all duration-300 relative overflow-hidden">
                        <div className="space-y-4">
                            <div className="w-14 h-14 bg-maroon/5 rounded-2xl flex items-center justify-center text-maroon group-hover:bg-maroon group-hover:text-gold transition-all duration-300 shadow-md">
                                <Award className="w-7 h-7" />
                            </div>
                            <div>
                                <span className="text-[9px] font-black text-gold uppercase tracking-[0.25em] bg-maroon px-3 py-1 rounded-full">Module 3</span>
                                <h3 className="text-2xl font-black text-black uppercase tracking-tight mt-3">Results Workflow</h3>
                                <p className="text-xs text-black/60 font-medium leading-relaxed mt-2">
                                    Continuous Assessment Test (CAT) results management. Formal 4-step governance workflow: Draft → Submit → Approve → Publish, plus audit logging & printable result slips.
                                </p>
                            </div>
                            <ul className="space-y-2 text-xs font-bold text-black/70 pt-2 border-t border-black/5">
                                <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Multi-Step Governance Workflow</li>
                                <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> CAT Assessment Period Control</li>
                                <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Printable CAT Result Slips</li>
                            </ul>
                        </div>
                        <div className="pt-8">
                            <Link
                                to="/results"
                                className="w-full bg-maroon text-gold py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl hover:bg-maroon/90 transition-all group-hover:gap-3"
                            >
                                <span>Go to CAT Results</span>
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
