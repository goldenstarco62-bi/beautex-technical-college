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
} from 'lucide-react';



const navigation = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'teacher', 'student', 'superadmin'] },
    { name: 'User Management', path: '/users', icon: Shield, roles: ['superadmin'] },
    { name: 'Academic Master', path: '/academic-master', icon: Building2, roles: ['admin', 'superadmin'] },
    { name: 'Finance', path: '/finance', icon: CreditCard, roles: ['admin', 'superadmin', 'student'] },
    { name: 'Students', path: '/students', icon: Users, roles: ['admin', 'superadmin'] },
    { name: 'Courses', path: '/courses', icon: BookOpen, roles: ['admin', 'teacher', 'student', 'superadmin'] },
    { name: 'Study Materials', path: '/materials', icon: FileStack, roles: ['admin', 'teacher', 'student', 'superadmin'] },
    { name: 'Faculty', path: '/faculty', icon: UserCheck, roles: ['admin', 'superadmin'] },
    { name: 'Attendance', path: '/attendance', icon: ClipboardList, roles: ['admin', 'teacher', 'student', 'superadmin'] },
    { name: 'Grades', path: '/grades', icon: GraduationCap, roles: ['admin', 'teacher', 'student', 'superadmin'] },
    { name: 'Schedule', path: '/schedule', icon: Calendar, roles: ['admin', 'teacher', 'student', 'superadmin'] },
    { name: 'Academic Reports', path: '/reports', icon: FileText, roles: ['teacher', 'admin', 'superadmin'] },
    { name: 'Student Daily Reports', path: '/student-daily-reports', icon: FileStack, roles: ['teacher', 'admin', 'superadmin'] },
    { name: 'Daily Student Ledger', path: '/daily-student-logs', icon: History, roles: ['teacher', 'admin', 'superadmin', 'student'] },
    { name: 'Activity Reports', path: '/activity-reports', icon: BarChart3, roles: ['admin', 'superadmin'] },
    { name: 'Audit Trail', path: '/audit-logs', icon: History, roles: ['superadmin'] },
    { name: 'Trainer Reports', path: '/trainer-reports', icon: LayoutList, roles: ['admin', 'teacher', 'superadmin'] },
    { name: 'Announcements', path: '/announcements', icon: Megaphone, roles: ['admin', 'teacher', 'student', 'superadmin'] },
    { name: 'Settings', path: '/settings', icon: SettingsIcon, roles: ['admin', 'superadmin'] },
    { name: 'My Profile', path: '/profile', icon: UserCircle, roles: ['admin', 'teacher', 'student', 'superadmin'] },

];

export default function Sidebar({ isOpen, setIsOpen }) {
    const location = useLocation();
    const { user } = useAuth();
    const userRole = (user?.role ? String(user.role) : '').toLowerCase().trim() || 'student';

    const filteredNavigation = navigation.filter(item => {
        const allowedRoles = item.roles.map(r => String(r).toLowerCase().trim());
        return allowedRoles.includes(userRole);
    });

    return (
        <>
            {/* Mobile Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-maroon/40 backdrop-blur-md z-[55] lg:hidden transition-all duration-500 animate-in fade-in"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <div className={`fixed left-0 top-0 h-screen w-80 bg-white dark:bg-black border-r border-gray-100/10 flex flex-col z-[60] transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] transform shadow-4xl rounded-r-[3rem] lg:rounded-none
                ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>

                <div className="px-6 py-10 border-b border-gray-50 mb-2 flex justify-between items-center bg-gradient-to-br from-maroon/[0.03] to-transparent rounded-tr-[3rem]">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white p-1 rounded-2xl flex items-center justify-center overflow-hidden shadow-xl border border-gray-100 group-hover:rotate-6 transition-transform">
                            <img src="/logo.jpg" alt="Beautex Logo" className="w-full h-full object-cover rounded-xl" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-black text-maroon uppercase tracking-[0.2em]">Beautex</span>
                            <span className="text-[10px] font-bold text-gold uppercase tracking-widest">Academy</span>
                        </div>
                    </div>
                    {/* Mobile Close Button */}
                    <button
                        onClick={() => setIsOpen(false)}
                        className="lg:hidden p-3 bg-maroon/5 hover:bg-maroon hover:text-white rounded-2xl transition-all active:scale-90"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-2 overflow-y-auto">
                    <ul className="space-y-1">
                        {filteredNavigation.map((item) => {
                            const Icon = item.icon;
                            const isActive = location.pathname === item.path;

                            return (
                                <li key={item.path}>
                                    <Link
                                        to={item.path}
                                        onClick={() => setIsOpen(false)}
                                        className={`flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 relative group overflow-hidden ${isActive
                                            ? 'bg-gold text-maroon scale-[1.02] shadow-xl shadow-gold/20'
                                            : 'text-gray-400 hover:text-maroon hover:bg-maroon/5'
                                            }`}
                                    >
                                        <div className={`transition-transform duration-500 ${isActive ? 'rotate-[10deg] scale-110' : 'group-hover:rotate-12'}`}>
                                            <Icon className={`w-5 h-5 ${isActive ? 'text-maroon' : 'text-gray-400 group-hover:text-maroon'}`} />
                                        </div>
                                        <span className={`text-[11px] font-black uppercase tracking-widest transition-colors ${isActive ? 'text-maroon' : 'group-hover:text-maroon'}`}>
                                            {item.name}
                                        </span>
                                        {isActive && (
                                            <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-maroon rounded-l-full"></div>
                                        )}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                {/* Profile Mini */}
                <div className="p-4 bg-gray-50/50">
                </div>
            </div>
        </>
    );
}
