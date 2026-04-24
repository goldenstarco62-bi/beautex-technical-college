import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Bell, Moon, Sun, LogOut, Menu, Check, CheckCheck, Megaphone, AlertTriangle, Info, X, Search, Command } from 'lucide-react';

import { useNavigate, Link } from 'react-router-dom';
import { notificationsAPI } from '../../services/api';

// Storage key is kept for legacy but no longer primary source of truth
const STORAGE_KEY = 'bttc_read_notifications';


const priorityIcon = (priority) => {
    switch ((priority || '').toLowerCase()) {
        case 'high': return <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />;
        case 'medium': return <Megaphone className="w-3 h-3 text-amber-500 shrink-0" />;
        default: return <Info className="w-3 h-3 text-blue-500 shrink-0" />;
    }
};

const priorityBadge = (priority) => {
    switch ((priority || '').toLowerCase()) {
        case 'high': return 'bg-red-100 text-red-600';
        case 'medium': return 'bg-amber-100 text-amber-600';
        default: return 'bg-blue-100 text-blue-600';
    }
};

export default function Navbar({ onMenuClick, onSearchClick }) {

    const { user, logout } = useAuth();
    const { darkMode, toggleDarkMode } = useTheme();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [loading, setLoading] = useState(false);

    const dropdownRef = useRef(null);
    const bellRef = useRef(null);

    // Fetch notifications from backend (announcements shaped as notifications)
    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        try {
            setLoading(true);
            const { data } = await notificationsAPI.getAll();
            if (Array.isArray(data)) {
                setNotifications(data);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    // Initial fetch + auto-refresh every 2 minutes
    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 2 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                dropdownRef.current && !dropdownRef.current.contains(e.target) &&
                bellRef.current && !bellRef.current.contains(e.target)
            ) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const markRead = async (id) => {
        try {
            // Optimistic update
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
            await notificationsAPI.markRead(id);
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    };


    const markAllRead = async (e) => {
        e.stopPropagation();
        try {
            const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
            // Optimistic update
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            await Promise.all(unreadIds.map(id => notificationsAPI.markRead(id)));
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };


    const handleNotificationClick = (notification) => {
        markRead(notification.id);
        setShowNotifications(false);
        navigate('/announcements');
    };

    // Local read state is now handled by the backend 'read' property
    const unreadCount = notifications.filter(n => !n.read).length;
    const hasUnread = unreadCount > 0;


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

            <div className="flex-1 max-w-md mx-8 hidden lg:block">
                <button 
                    onClick={onSearchClick}
                    className="w-full flex items-center justify-between px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all group"
                >
                    <div className="flex items-center gap-3">
                        <Search className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" />
                        <span className="text-[11px] font-black text-white/30 uppercase tracking-widest group-hover:text-white/60">Search Anything...</span>
                    </div>
                    <div className="flex items-center gap-1 text-white/20">
                        <Command className="w-3 h-3" />
                        <span className="text-[10px] font-black uppercase">K</span>
                    </div>
                </button>
            </div>

            <div className="flex items-center gap-2 sm:gap-6">

                {/* Theme Toggle */}
                <button
                    onClick={toggleDarkMode}
                    className="p-2.5 text-white/40 hover:text-accent hover:bg-white/5 rounded-xl transition-all"
                >
                    {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>

                {/* Notifications Bell */}
                <div className="relative">
                    <button
                        ref={bellRef}
                        onClick={() => setShowNotifications(!showNotifications)}
                        className="relative p-2.5 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all group"
                        aria-label={`Notifications (${unreadCount} unread)`}
                    >
                        {/* Animated bell when unread */}
                        <Bell className={`w-5 h-5 transition-transform ${hasUnread ? 'animate-[wiggle_1s_ease-in-out]' : ''}`} />

                        {/* Unread count badge */}
                        {hasUnread && (
                            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-gold text-maroon text-[9px] font-black rounded-full flex items-center justify-center px-1 border-2 border-maroon shadow-lg animate-in zoom-in-50 duration-200">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {/* Dropdown */}
                    {showNotifications && (
                        <div
                            ref={dropdownRef}
                            className="absolute right-0 mt-4 w-80 sm:w-96 max-w-[calc(100vw-1rem)] bg-white border border-gray-100 rounded-[1.5rem] shadow-2xl z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right"
                        >
                            {/* Header */}
                            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 bg-maroon rounded-lg flex items-center justify-center">
                                        <Bell className="w-3.5 h-3.5 text-gold" />
                                    </div>
                                    <div>
                                        <h3 className="text-[11px] font-black text-gray-800 uppercase tracking-widest">Notifications</h3>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{unreadCount} unread</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {hasUnread && (
                                        <button
                                            onClick={markAllRead}
                                            className="flex items-center gap-1 px-3 py-1.5 text-[9px] font-black text-maroon uppercase tracking-widest bg-maroon/5 hover:bg-maroon hover:text-gold rounded-lg transition-all"
                                        >
                                            <CheckCheck className="w-3 h-3" />
                                            All Read
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setShowNotifications(false)}
                                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* List */}
                            <div className="max-h-[360px] overflow-y-auto custom-scrollbar">
                                {loading && notifications.length === 0 ? (
                                    <div className="py-12 text-center">
                                        <div className="w-6 h-6 border-2 border-maroon/20 border-t-maroon rounded-full animate-spin mx-auto mb-2" />
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Loading...</p>
                                    </div>
                                ) : notifications.length > 0 ? (
                                    notifications.map(n => (

                                        <div
                                            key={n.id}
                                            onClick={() => handleNotificationClick(n)}
                                            className={`flex gap-3 px-5 py-4 border-b border-gray-50 cursor-pointer transition-all hover:bg-maroon/[0.02] ${n.read ? 'opacity-50' : 'bg-white'}`}
                                        >
                                            {/* Priority icon */}
                                            <div className="mt-0.5 shrink-0">
                                                {priorityIcon(n.priority)}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className={`text-[11px] font-black uppercase tracking-tight leading-tight line-clamp-1 ${n.read ? 'text-gray-400' : 'text-gray-800'}`}>
                                                        {n.title}
                                                    </p>
                                                    {!n.read && (
                                                        <div className="w-2 h-2 bg-gold rounded-full shrink-0 mt-1" />
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-gray-400 font-medium line-clamp-2 mt-0.5">{n.content}</p>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${priorityBadge(n.priority)}`}>
                                                        {n.priority || 'general'}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-gray-300">{n.time}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="py-16 text-center">
                                        <div className="w-14 h-14 bg-gray-100 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4">
                                            <Bell className="w-7 h-7 text-gray-300" />
                                        </div>
                                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">No announcements yet</p>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60">
                                <Link
                                    to="/announcements"
                                    onClick={() => setShowNotifications(false)}
                                    className="block text-center text-[10px] font-black text-maroon uppercase tracking-widest hover:text-gold transition-colors py-1"
                                >
                                    View All Announcements →
                                </Link>
                            </div>
                        </div>
                    )}
                </div>

                {/* User Info - Clickable for Profile Settings */}
                <Link
                    to="/profile"
                    className="flex items-center gap-2 sm:gap-4 border-l border-white/10 hover:bg-white/5 pl-2 sm:pl-6 px-2 sm:px-4 py-1.5 rounded-2xl transition-all group"
                >
                    <div className="text-right hidden md:block">
                        <p className="text-[10px] font-black text-white uppercase whitespace-nowrap group-hover:text-gold transition-colors">
                            {user?.name || user?.email?.split('@')[0]}
                        </p>
                        <p className="text-[9px] text-gold/60 font-bold uppercase tracking-widest mt-0.5 group-hover:text-gold transition-colors">{user?.role}</p>
                    </div>
                    <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gold text-maroon font-black rounded-full flex items-center justify-center shadow-lg text-xs sm:text-sm group-hover:scale-110 group-hover:rotate-6 transition-all overflow-hidden border-2 border-transparent group-hover:border-gold">
                        {user?.photo ? (
                            <img src={user?.photo} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            (user?.name?.[0] || user?.email?.[0] || 'U').toUpperCase()
                        )}
                    </div>
                </Link>

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
