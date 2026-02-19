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
} from 'lucide-react';



const navigation = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'teacher', 'student', 'superadmin'] },
    { name: 'User Management', path: '/users', icon: Shield, roles: ['superadmin'] },
    { name: 'Academic Master', path: '/academic-master', icon: Building2, roles: ['superadmin'] },
    { name: 'Finance', path: '/finance', icon: CreditCard, roles: ['admin', 'superadmin', 'student'] },
    { name: 'Students', path: '/students', icon: Users, roles: ['admin', 'superadmin'] },
    { name: 'Courses', path: '/courses', icon: BookOpen, roles: ['admin', 'teacher', 'student', 'superadmin'] },
    { name: 'Study Materials', path: '/materials', icon: FileStack, roles: ['admin', 'teacher', 'student', 'superadmin'] },
    { name: 'Faculty', path: '/faculty', icon: UserCheck, roles: ['admin', 'superadmin'] },
    { name: 'Attendance', path: '/attendance', icon: ClipboardList, roles: ['admin', 'teacher', 'student', 'superadmin'] },
    { name: 'Grades', path: '/grades', icon: GraduationCap, roles: ['admin', 'teacher', 'student', 'superadmin'] },
    { name: 'Schedule', path: '/schedule', icon: Calendar, roles: ['admin', 'teacher', 'student', 'superadmin'] },
    { name: 'Academic Reports', path: '/reports', icon: FileText, roles: ['admin', 'teacher', 'superadmin', 'student'] },
    { name: 'Activity Reports', path: '/activity-reports', icon: BarChart3, roles: ['admin', 'superadmin'] },
    { name: 'Audit Trail', path: '/audit-logs', icon: History, roles: ['superadmin'] },
    { name: 'Announcements', path: '/announcements', icon: Megaphone, roles: ['admin', 'teacher', 'student', 'superadmin'] },
    { name: 'Settings', path: '/settings', icon: SettingsIcon, roles: ['admin', 'superadmin'] },


];

export default function Sidebar({ isOpen, setIsOpen }) {
    const location = useLocation();
    const { user } = useAuth();
    const userRole = user?.role || 'student';

    const filteredNavigation = navigation.filter(item => item.roles.includes(userRole));

    return (
        <>
            {/* Mobile Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-maroon/20 backdrop-blur-sm z-[55] lg:hidden transition-opacity duration-300"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <div className={`fixed left-0 top-0 h-screen w-72 bg-white/95 dark:bg-black/95 backdrop-blur-xl border-r border-gray-100/10 flex flex-col z-[60] transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] transform shadow-2xl rounded-r-[2.5rem]
                ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>

                <div className="px-8 py-8 border-b border-gray-100/5 mb-4 flex justify-between items-center bg-maroon/5 rounded-tr-[2.5rem]">
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
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${isActive
                                            ? 'bg-[#FFD700] text-[#800000] font-black shadow-lg translate-x-1'
                                            : 'text-gray-400 hover:text-[#800000] hover:bg-gray-50'
                                            }`}
                                    >
                                        <Icon className={`w-5 h-5 ${isActive ? 'text-[#800000]' : ''}`} />
                                        <span className="text-xs font-bold uppercase tracking-widest">{item.name}</span>
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
