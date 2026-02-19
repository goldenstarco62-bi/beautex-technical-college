import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, BookOpen, UserCircle, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function MobileBottomNav({ onMenuClick }) {
    const location = useLocation();
    const { user } = useAuth();
    const role = user?.role || 'student';

    const navItems = [
        { name: 'Home', path: '/dashboard', icon: LayoutDashboard },
        { name: 'Students', path: '/students', icon: Users, roles: ['admin', 'superadmin'] },
        { name: 'Courses', path: '/courses', icon: BookOpen },
        { name: 'Profile', path: '/settings', icon: UserCircle },
    ];

    const filteredItems = navItems.filter(item => !item.roles || item.roles.includes(role));

    return (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] px-4 pb-4">
            <div className="bg-white/80 dark:bg-black/80 backdrop-blur-xl border border-white/20 shadow-[0_-8px_30px_rgb(0,0,0,0.12)] rounded-[2rem] flex items-center justify-around h-16 px-2 overflow-hidden">
                {filteredItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-300 relative group ${isActive ? 'text-maroon scale-110' : 'text-gray-400 hover:text-maroon'
                                }`}
                        >
                            <Icon className={`w-5 h-5 ${isActive ? 'text-maroon animate-pulse' : ''}`} />
                            <span className={`text-[8px] font-black uppercase tracking-tighter mt-1 ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                                {item.name}
                            </span>
                            {isActive && (
                                <div className="absolute -bottom-1 w-1 h-1 bg-maroon rounded-full"></div>
                            )}
                        </Link>
                    );
                })}

                {/* Menu trigger for sidebar */}
                <button
                    onClick={onMenuClick}
                    className="flex flex-col items-center justify-center p-2 rounded-2xl text-gray-400 hover:text-maroon transition-all active:scale-90"
                >
                    <Menu className="w-5 h-5" />
                    <span className="text-[8px] font-black uppercase tracking-tighter mt-1 opacity-40">Menu</span>
                </button>
            </div>
        </div>
    );
}
