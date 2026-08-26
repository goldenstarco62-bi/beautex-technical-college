import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    X,
    LayoutDashboard,
    Users,
    BookOpen,
    UserCheck,
    GraduationCap,
    ClipboardList,
    Calendar,
    Megaphone,
    Settings as SettingsIcon,
    Shield,
    FileText,
    BarChart3,
    UserCircle,
    History,
    CreditCard,
    FileStack,
    Building2,
    LayoutList,
    TrendingUp,
    DollarSign,
    Receipt,
    PieChart,
    BookMarked,
    CheckSquare,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { academicAPI } from '../../services/api';

const navSections = [
    {
        label: 'MAIN',
        items: [
            { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'teacher', 'student', 'superadmin'] },
        ]
    },
    {
        label: 'ACADEMICS',
        items: [
            { name: 'Students', path: '/students', icon: Users, roles: ['admin', 'superadmin', 'teacher'] },
            { name: 'Courses', path: '/courses', icon: BookOpen, roles: ['admin', 'teacher', 'student', 'superadmin'] },
            { name: 'Faculty', path: '/faculty', icon: UserCheck, roles: ['admin', 'superadmin'] },
            { name: 'Attendance', path: '/attendance', icon: ClipboardList, roles: ['admin', 'teacher', 'student', 'superadmin'] },
            { name: 'Units Covered', path: '/grades', icon: GraduationCap, roles: ['admin', 'teacher', 'student', 'superadmin'] },
            { name: 'Unit Coverage', path: '/unit-coverage', icon: CheckSquare, roles: ['admin', 'teacher', 'student', 'superadmin'] },
            { name: 'Timetable', path: '/schedule', icon: Calendar, roles: ['admin', 'teacher', 'student', 'superadmin'] },
            { name: 'Daily Ledger', path: '/daily-student-logs', icon: History, roles: ['admin', 'teacher', 'student', 'superadmin'] },
            { name: 'Journal Entry', path: '/student-daily-reports', icon: FileText, roles: ['admin', 'superadmin', 'teacher'] },
        ]
    },
    {
        label: 'FINANCE',
        items: [
            { name: 'Fee Tracker', path: '/monthly-fee-tracker', icon: CreditCard, roles: ['admin', 'superadmin'] },
            { name: 'Revenue', path: '/finance', icon: DollarSign, roles: ['admin', 'superadmin', 'student'] },
            { name: 'Inventory', path: '/inventory', icon: LayoutList, roles: ['admin', 'superadmin', 'teacher'] },
        ]
    },
    {
        label: 'REPORTS',
        items: [
            { name: 'Academic Reports', path: '/reports', icon: FileText, roles: ['teacher', 'admin', 'superadmin'] },
            { name: 'Daily Reports', path: '/activity-reports', icon: BarChart3, roles: ['admin', 'superadmin'] },
            { name: 'Attendance Summary', path: '/attendance-summary', icon: TrendingUp, roles: ['admin', 'superadmin', 'teacher'] },
            { name: 'Monthly Attendance', path: '/monthly-attendance', icon: Calendar, roles: ['admin', 'teacher', 'student', 'superadmin'] },
            { name: 'Trainer Reports', path: '/trainer-reports', icon: BookMarked, roles: ['admin', 'teacher', 'superadmin'] },
            { name: 'Study Materials', path: '/materials', icon: FileStack, roles: ['admin', 'teacher', 'student', 'superadmin'] },
            { name: 'Announcements', path: '/announcements', icon: Megaphone, roles: ['admin', 'teacher', 'student', 'superadmin'] },
        ]
    },
    {
        label: 'SYSTEM',
        items: [
            { name: 'Users', path: '/users', icon: Shield, roles: ['superadmin'] },
            { name: 'Departments', path: '/academic-master', icon: Building2, roles: ['superadmin', 'admin'] },
            { name: 'Settings', path: '/settings', icon: SettingsIcon, roles: ['superadmin', 'admin'] },
            { name: 'Audit Logs', path: '/audit-logs', icon: History, roles: ['superadmin'] },
        ]
    },
];

export default function Sidebar({ isOpen, setIsOpen }) {
    const location = useLocation();
    const { user } = useAuth();
    const userRole = (user?.role ? String(user.role) : '').toLowerCase().trim() || 'student';
    const [activePeriod, setActivePeriod] = useState(null);

    useEffect(() => {
        academicAPI.getPeriods().then(res => {
            const periods = Array.isArray(res.data) ? res.data : [];
            const active = periods.find(p => p.is_active) || periods[0] || null;
            setActivePeriod(active);
        }).catch(() => {});
    }, []);

    // Calculate term progress
    let termProgress = 65;
    let termLabel = 'Apr - Aug 2026';
    if (activePeriod) {
        termLabel = activePeriod.name || termLabel;
        if (activePeriod.start_date && activePeriod.end_date) {
            const start = new Date(activePeriod.start_date);
            const end = new Date(activePeriod.end_date);
            const now = new Date();
            const total = end - start;
            const elapsed = now - start;
            termProgress = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
        }
    }

    return (
        <>
            {/* Mobile Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[55] lg:hidden transition-all duration-500 animate-in fade-in"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <div className={`fixed left-0 top-0 h-screen w-64 flex flex-col z-[60] transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] transform shadow-2xl overflow-hidden
                ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
                style={{ background: 'linear-gradient(175deg, #6b0000 0%, #800000 35%, #8a0000 65%, #6b0000 100%)' }}>

                {/* Sidebar texture overlay */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 opacity-[0.04]"
                        style={{
                            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
                            backgroundSize: '20px 20px'
                        }} />
                    <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-[0.08]"
                        style={{ background: 'radial-gradient(circle, #FFD700 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
                    <div className="absolute bottom-20 left-0 w-32 h-32 rounded-full opacity-[0.05]"
                        style={{ background: 'radial-gradient(circle, #FFD700 0%, transparent 70%)', transform: 'translate(-40%, 0)' }} />
                </div>

                {/* Logo */}
                <div className="relative z-10 px-5 py-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center overflow-hidden shadow-xl ring-2 ring-white/20 shrink-0">
                            <img src="/app-icon-v2.png" alt="Beautex Logo" className="w-full h-full object-cover rounded-xl" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-black text-white uppercase tracking-[0.15em] leading-tight drop-shadow-sm">Beautex</span>
                            <span className="text-[8px] font-bold uppercase tracking-[0.08em] leading-tight" style={{ color: '#FFD700' }}>Technical Training College</span>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="lg:hidden p-2 rounded-xl transition-all text-white/60 hover:text-white hover:bg-white/10"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="relative z-10 flex-1 px-3 py-3 overflow-y-auto custom-scrollbar-dark">
                    {navSections.map((section) => {
                        const filteredItems = section.items.filter(item =>
                            item.roles.map(r => String(r).toLowerCase().trim()).includes(userRole)
                        );
                        if (filteredItems.length === 0) return null;

                        return (
                            <div key={section.label} className="mb-4">
                                <div className="flex items-center gap-2 px-3 mb-2">
                                    <div className="h-px flex-1 bg-white/10" />
                                    <p className="text-[8px] font-black uppercase tracking-[0.25em] text-white/30">
                                        {section.label}
                                    </p>
                                    <div className="h-px flex-1 bg-white/10" />
                                </div>
                                <ul className="space-y-0.5">
                                    {filteredItems.map((item) => {
                                        const Icon = item.icon;
                                        const isActive = location.pathname === item.path;
                                        return (
                                            <li key={item.path}>
                                                <Link
                                                    to={item.path}
                                                    onClick={() => setIsOpen(false)}
                                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative
                                                        ${isActive
                                                            ? 'text-white shadow-lg'
                                                            : 'text-white/55 hover:text-white hover:bg-white/8'
                                                        }`}
                                                    style={isActive ? {
                                                        background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.08) 100%)',
                                                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 12px rgba(0,0,0,0.15)'
                                                    } : {}}
                                                >
                                                    {isActive && (
                                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" style={{ background: 'linear-gradient(to bottom, #FFD700, #E6C200)' }} />
                                                    )}
                                                    <Icon className={`w-4 h-4 shrink-0 transition-all duration-200 ${isActive ? 'text-yellow-300' : 'text-white/40 group-hover:text-white/70'}`} />
                                                    <span className={`text-[11px] font-semibold truncate tracking-wide ${isActive ? 'text-white font-bold' : ''}`}>
                                                        {item.name}
                                                    </span>
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        );
                    })}
                </nav>

                {/* Current Term Card */}
                {['admin', 'superadmin'].includes(userRole) && (
                    <div className="relative z-10 mx-3 mb-4 p-4 rounded-2xl overflow-hidden" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,215,0,0.12)' }}>
                        {/* Subtle gold shimmer top border */}
                        <div className="absolute top-0 left-4 right-4 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.4), transparent)' }} />
                        <div className="flex items-center gap-2 mb-2">
                            <GraduationCap className="w-3.5 h-3.5 shrink-0" style={{ color: '#FFD700' }} />
                            <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Current Term</p>
                        </div>
                        <p className="text-sm font-black text-white leading-tight">{termLabel}</p>
                        <div className="mt-3">
                            <div className="flex justify-between items-center mb-1.5">
                                <span className="text-[9px] text-white/35 font-bold">{termProgress}% Complete</span>
                                <span className="text-[9px] font-bold" style={{ color: '#FFD700' }}>{100 - termProgress}% Left</span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                                <div
                                    className="h-full rounded-full transition-all duration-1000"
                                    style={{ width: `${termProgress}%`, background: 'linear-gradient(90deg, #FFD700, #FFA500)' }}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .custom-scrollbar-dark::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar-dark::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar-dark::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
            `}</style>
        </>
    );
}
