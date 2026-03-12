import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, BookOpen, UserCircle, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useEffect, useRef, useState } from 'react';

export default function MobileBottomNav({ onMenuClick }) {
    const location = useLocation();
    const { user } = useAuth();
    const userRole = (user?.role ? String(user.role) : '').toLowerCase().trim() || 'student';
    const [hidden, setHidden] = useState(false);
    const lastScrollY = useRef(0);

    useEffect(() => {
        const handleScroll = () => {
            const currentY = window.scrollY;
            // Hide when scrolling down more than 10px, show when scrolling up
            if (currentY > lastScrollY.current + 10) {
                setHidden(true);
            } else if (currentY < lastScrollY.current - 5) {
                setHidden(false);
            }
            lastScrollY.current = currentY;
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Always show when route changes
    useEffect(() => {
        setHidden(false);
    }, [location.pathname]);

    const navItems = [
        { name: 'Home', path: '/dashboard', icon: LayoutDashboard },
        { name: 'Students', path: '/students', icon: Users, roles: ['admin', 'superadmin'] },
        { name: 'Courses', path: '/courses', icon: BookOpen },
        { name: 'Profile', path: '/settings', icon: UserCircle },
    ];

    const filteredItems = navItems.filter(item => {
        if (!item.roles) return true;
        const allowedRoles = item.roles.map(r => String(r).toLowerCase().trim());
        return allowedRoles.includes(userRole);
    });

    return (
        <div className={`lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] z-[100] mobile-bottom-nav transition-all duration-500 ${hidden ? 'translate-y-[120%] opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
            <div className="bg-white/90 dark:bg-black/90 backdrop-blur-2xl border border-white/40 dark:border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.15)] rounded-[2.5rem] flex items-center justify-around h-18 px-4 py-2 overflow-hidden transition-all duration-300">
                {filteredItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-500 relative group ${isActive ? 'text-maroon' : 'text-gray-400 hover:text-maroon/60'}`}
                        >
                            <div className={`relative p-2 rounded-xl transition-all duration-500 ${isActive ? 'bg-maroon/5 scale-110' : ''}`}>
                                <Icon className={`w-5 h-5 ${isActive ? 'text-maroon animate-pulse' : ''}`} />
                                {isActive && (
                                    <div className="absolute -inset-1 bg-maroon/5 rounded-xl blur-sm -z-10 animate-pulse"></div>
                                )}
                            </div>
                            <span className={`text-[8px] font-black uppercase tracking-widest mt-1 transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                                {item.name}
                            </span>
                        </Link>
                    );
                })}

                {/* Menu trigger for sidebar */}
                <button
                    onClick={onMenuClick}
                    className="flex flex-col items-center justify-center p-3 rounded-2xl text-gray-400 hover:text-maroon transition-all active:scale-90"
                >
                    <div className="p-2">
                        <Menu className="w-5 h-5" />
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-widest mt-1 opacity-40">Menu</span>
                </button>
            </div>
        </div>
    );
}
