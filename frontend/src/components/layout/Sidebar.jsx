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
            { name: 'Grades', path: '/grades', icon: GraduationCap, roles: ['admin', 'teacher', 'student', 'superadmin'] },
            { name: 'Timetable', path: '/schedule', icon: Calendar, roles: ['admin', 'teacher', 'student', 'superadmin'] },
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
            { name: 'Trainer Reports', path: '/trainer-reports', icon: BookMarked, roles: ['admin', 'teacher', 'superadmin'] },
            { name: 'Study Materials', path: '/materials', icon: FileStack, roles: ['admin', 'teacher', 'student', 'superadmin'] },
            { name: 'Announcements', path: '/announcements', icon: Megaphone, roles: ['admin', 'teacher', 'student', 'superadmin'] },
        ]
    },
    {
        label: 'SYSTEM',
        items: [
            { name: 'Users', path: '/users', icon: Shield, roles: ['superadmin'] },
            { name: 'Settings', path: '/settings', icon: SettingsIcon, roles: ['superadmin'] },
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
        if (['admin', 'superadmin'].includes(userRole)) {
            academicAPI.getPeriods().then(res => {
                const periods = Array.isArray(res.data) ? res.data : [];
                const active = periods.find(p => p.is_active) || periods[0] || null;
                setActivePeriod(active);
            }).catch(() => {});
        }
    }, [userRole]);

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

            <div className={`fixed left-0 top-0 h-screen w-64 bg-[#7a0000] flex flex-col z-[60] transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] transform shadow-2xl
                ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>

                {/* Logo */}
                <div className="px-5 py-5 flex items-center justify-between border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center overflow-hidden shadow-lg shrink-0">
                            <img src="/app-icon-v2.png" alt="Beautex Logo" className="w-full h-full object-cover rounded-xl" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-black text-white uppercase tracking-[0.15em] leading-tight">Beautex</span>
                            <span className="text-[8px] font-bold text-yellow-300 uppercase tracking-[0.08em] leading-tight">Technical Training College</span>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="lg:hidden p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all text-white"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-3 overflow-y-auto custom-scrollbar-dark">
                    {navSections.map((section) => {
                        const filteredItems = section.items.filter(item =>
                            item.roles.map(r => String(r).toLowerCase().trim()).includes(userRole)
                        );
                        if (filteredItems.length === 0) return null;

                        return (
                            <div key={section.label} className="mb-3">
                                <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] px-3 mb-1.5">
                                    {section.label}
                                </p>
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
                                                            ? 'bg-[#a00000] text-white shadow-lg'
                                                            : 'text-white/60 hover:text-white hover:bg-white/10'
                                                        }`}
                                                >
                                                    {isActive && (
                                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-yellow-400 rounded-r-full" />
                                                    )}
                                                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-yellow-400' : 'text-white/50 group-hover:text-white/80'}`} />
                                                    <span className={`text-[11px] font-semibold truncate ${isActive ? 'text-white' : ''}`}>
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
                    <div className="mx-3 mb-4 p-4 bg-[#5a0000] rounded-2xl border border-white/10">
                        <div className="flex items-center gap-2 mb-1">
                            <GraduationCap className="w-4 h-4 text-yellow-400 shrink-0" />
                            <p className="text-[9px] font-black text-white/50 uppercase tracking-widest">Current Term</p>
                        </div>
                        <p className="text-sm font-black text-white mt-1 leading-tight">{termLabel}</p>
                        <div className="mt-3">
                            <div className="flex justify-between items-center mb-1.5">
                                <span className="text-[9px] text-white/40 font-bold">{termProgress}% Complete</span>
                            </div>
                            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full transition-all duration-1000"
                                    style={{ width: `${termProgress}%` }}
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
