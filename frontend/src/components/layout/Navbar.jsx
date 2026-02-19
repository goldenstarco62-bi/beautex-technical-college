import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Bell, Moon, Sun, LogOut, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notificationsAPI } from '../../services/api';

export default function Navbar({ onMenuClick }) {
    const { user, logout } = useAuth();
    const { darkMode, toggleDarkMode } = useTheme();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);

    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const { data } = await notificationsAPI.getAll();
                setNotifications(data);
            } catch (error) {
                console.error('Error fetching notifications:', error);
            }
        };
        if (user) fetchNotifications();
    }, [user]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };


    // Ensure notifications is an array
    const safeNotifications = Array.isArray(notifications) ? notifications : [];
    const unreadCount = safeNotifications.filter(n => !n.read).length;

    return (
        <div className="h-20 bg-maroon backdrop-blur-md px-4 md:px-8 flex items-center justify-between sticky top-0 left-0 w-full z-40 shadow-2xl transition-all duration-300 border-b border-white/5">
            <div className="flex items-center gap-4">
                <button
                    onClick={onMenuClick}
                    className="p-2.5 text-white/60 hover:text-white hover:bg-white/10 rounded-2xl lg:hidden transition-all active:scale-95 bg-white/5"
                >
                    <Menu className="w-5 h-5" />
                </button>
                <div className="lg:hidden flex flex-col">
                    <span className="text-[10px] font-black text-white uppercase tracking-[0.2em] truncate max-w-[120px]">
                        Beautex
                    </span>
                    <span className="text-[8px] font-bold text-accent uppercase tracking-[0.1em] opacity-60">
                        Academy
                    </span>
                </div>
            </div>
            {/* ... header ... */}

            <div className="flex items-center gap-6">
                {/* Theme Toggle */}
                <button
                    onClick={toggleDarkMode}
                    className="p-2.5 text-white/40 hover:text-accent hover:bg-white/5 rounded-xl transition-all"
                >
                    {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>

                {/* Notifications */}
                <div className="relative">
                    <button
                        onClick={() => setShowNotifications(!showNotifications)}
                        className="p-2.5 text-white/40 hover:text-white hover:bg-white/5 rounded-xl relative transition-all"
                    >
                        <Bell className="w-5 h-5" />
                        {unreadCount > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full border-2 border-primary"></span>}
                    </button>

                    {showNotifications && (
                        <div className="absolute right-0 mt-4 w-80 bg-white dark:bg-card-bg border border-primary/10 rounded-2xl shadow-2xl z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="p-4 border-b border-primary/5 flex justify-between items-center">
                                <h3 className="text-[10px] font-black text-primary uppercase tracking-widest">Notifications</h3>
                                <span className="text-[9px] font-bold text-accent px-2 py-0.5 bg-primary/5 rounded-full">{unreadCount} New</span>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto">
                                {safeNotifications.length > 0 ? safeNotifications.map(n => (
                                    <div key={n.id} className={`p-4 border-b border-primary/5 hover:bg-parchment transition-colors cursor-pointer ${n.read ? 'opacity-60' : ''}`}>
                                        <p className="text-[11px] font-black text-primary uppercase">{n.title}</p>
                                        <div className="flex justify-between items-center mt-1">
                                            <span className="text-[9px] font-bold text-primary/40 uppercase">{n.type}</span>
                                            <span className="text-[9px] font-bold text-accent">{n.time}</span>
                                        </div>
                                    </div>
                                )) : (
                                    <p className="p-8 text-center text-[10px] font-bold text-primary/20 uppercase tracking-widest">No notifications</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* User Info from Screenshot 1 */}
                <div className="flex items-center gap-4 pl-6 border-l border-white/10">
                    <div className="text-right">
                        <p className="text-[10px] font-black text-white uppercase whitespace-nowrap">
                            {user?.name || user?.email?.split('@')[0]}
                        </p>
                        <p className="text-[9px] text-[#FFD700] font-bold uppercase tracking-widest mt-0.5">{user?.role}</p>
                    </div>
                    <div className="w-10 h-10 bg-[#FFD700] text-[#800000] font-black rounded-full flex items-center justify-center shadow-lg text-sm">
                        {(user?.name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
                    </div>
                </div>

                {/* Logout */}
                <button
                    onClick={handleLogout}
                    className="p-2.5 text-white/10 hover:text-red-400 hover:bg-red-500/5 rounded-xl transition-all"
                >
                    <LogOut className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
