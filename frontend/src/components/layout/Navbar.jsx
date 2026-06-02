import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Bell, Moon, Sun, LogOut, Menu, Check, CheckCheck, Megaphone, AlertTriangle, Info, X, Search, Command, Mail, ChevronDown } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { notificationsAPI } from '../../services/api';

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

    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        try {
            setLoading(true);
            const { data } = await notificationsAPI.getAll();
            if (Array.isArray(data)) setNotifications(data);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 2 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

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

    const handleLogout = () => { logout(); navigate('/login'); };

    const markRead = async (id) => {
        try {
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
            await notificationsAPI.markRead(id);
        } catch (error) { console.error('Failed to mark notification as read:', error); }
    };

    const markAllRead = async (e) => {
        e.stopPropagation();
        try {
            const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            await Promise.all(unreadIds.map(id => notificationsAPI.markRead(id)));
        } catch (error) { console.error('Failed to mark all as read:', error); }
    };

    const handleNotificationClick = (notification) => {
        markRead(notification.id);
        setShowNotifications(false);
        navigate('/announcements');
    };

    const unreadCount = notifications.filter(n => !n.read).length;
    const hasUnread = unreadCount > 0;

    const userName = user?.name || user?.email?.split('@')[0] || 'User';
    const userInitial = (user?.name?.[0] || user?.email?.[0] || 'U').toUpperCase();

    return (
        <div className={`h-16 px-4 md:px-6 flex items-center justify-between sticky top-0 left-0 w-full z-40 transition-all duration-300
            ${darkMode
                ? 'bg-[#1a1a1a] border-b border-white/10 shadow-lg'
                : 'bg-white border-b border-gray-200 shadow-sm'
            }`}>

            {/* Left: Hamburger + Mobile Logo */}
            <div className="flex items-center gap-3">
                <button
                    onClick={onMenuClick}
                    className={`p-2 rounded-xl lg:hidden transition-all active:scale-95
                        ${darkMode ? 'text-white/60 hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                    <Menu className="w-5 h-5" />
                </button>
                {/* Hamburger for desktop too for collapse */}
                <button
                    onClick={onMenuClick}
                    className={`p-2 rounded-xl hidden lg:flex transition-all active:scale-95
                        ${darkMode ? 'text-white/60 hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                    <Menu className="w-5 h-5" />
                </button>
            </div>

            {/* Center: Search Bar */}
            <div className="flex-1 max-w-sm mx-4 hidden sm:block">
                <button
                    onClick={onSearchClick}
                    className={`w-full flex items-center justify-between px-4 py-2 rounded-xl transition-all group
                        ${darkMode
                            ? 'bg-white/5 hover:bg-white/10 border border-white/10'
                            : 'bg-gray-100 hover:bg-gray-200 border border-gray-200'
                        }`}
                >
                    <div className="flex items-center gap-2.5">
                        <Search className={`w-4 h-4 ${darkMode ? 'text-white/40' : 'text-gray-400'}`} />
                        <span className={`text-[11px] font-medium ${darkMode ? 'text-white/30' : 'text-gray-400'}`}>
                            Search anything...
                        </span>
                    </div>
                    <div className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md
                        ${darkMode ? 'bg-white/10 text-white/30' : 'bg-gray-200 text-gray-400'}`}>
                        <Command className="w-2.5 h-2.5" />K
                    </div>
                </button>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1 sm:gap-2">

                {/* Notifications Bell */}
                <div className="relative">
                    <button
                        ref={bellRef}
                        onClick={() => setShowNotifications(!showNotifications)}
                        className={`relative p-2 rounded-xl transition-all
                            ${darkMode ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
                        aria-label={`Notifications (${unreadCount} unread)`}
                    >
                        <Bell className={`w-5 h-5 ${hasUnread ? 'animate-[wiggle_2s_ease-in-out_infinite]' : ''}`} />
                        {hasUnread && (
                            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center px-1 border-2 border-white">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {/* Notifications Dropdown */}
                    {showNotifications && (
                        <div
                            ref={dropdownRef}
                            className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-1rem)] bg-white border border-gray-100 rounded-2xl shadow-2xl z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right"
                        >
                            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 bg-[#800000] rounded-lg flex items-center justify-center">
                                        <Bell className="w-3 h-3 text-yellow-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-[11px] font-black text-gray-800 uppercase tracking-widest">Notifications</h3>
                                        <p className="text-[9px] font-bold text-gray-400">{unreadCount} unread</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {hasUnread && (
                                        <button
                                            onClick={markAllRead}
                                            className="flex items-center gap-1 px-2 py-1 text-[9px] font-black text-[#800000] uppercase tracking-wider bg-red-50 hover:bg-[#800000] hover:text-white rounded-lg transition-all"
                                        >
                                            <CheckCheck className="w-3 h-3" /> All Read
                                        </button>
                                    )}
                                    <button onClick={() => setShowNotifications(false)} className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                            <div className="max-h-72 overflow-y-auto custom-scrollbar">
                                {loading && notifications.length === 0 ? (
                                    <div className="py-10 text-center">
                                        <div className="w-5 h-5 border-2 border-red-200 border-t-[#800000] rounded-full animate-spin mx-auto mb-2" />
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Loading...</p>
                                    </div>
                                ) : notifications.length > 0 ? (
                                    notifications.map(n => (
                                        <div
                                            key={n.id}
                                            onClick={() => handleNotificationClick(n)}
                                            className={`flex gap-3 px-4 py-3 border-b border-gray-50 cursor-pointer transition-all hover:bg-gray-50 ${n.read ? 'opacity-50' : ''}`}
                                        >
                                            <div className="mt-0.5 shrink-0">{priorityIcon(n.priority)}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className={`text-[11px] font-black uppercase tracking-tight line-clamp-1 ${n.read ? 'text-gray-400' : 'text-gray-800'}`}>{n.title}</p>
                                                    {!n.read && <div className="w-2 h-2 bg-yellow-400 rounded-full shrink-0 mt-1" />}
                                                </div>
                                                <p className="text-[10px] text-gray-400 font-medium line-clamp-2 mt-0.5">{n.content}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${priorityBadge(n.priority)}`}>{n.priority || 'general'}</span>
                                                    <span className="text-[9px] font-bold text-gray-300">{n.time}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="py-12 text-center">
                                        <Bell className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">No announcements yet</p>
                                    </div>
                                )}
                            </div>
                            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
                                <Link to="/announcements" onClick={() => setShowNotifications(false)} className="block text-center text-[10px] font-black text-[#800000] uppercase tracking-widest hover:text-yellow-600 transition-colors">
                                    View All Announcements →
                                </Link>
                            </div>
                        </div>
                    )}
                </div>

                {/* Messages */}
                <Link
                    to="/announcements"
                    className={`relative p-2 rounded-xl transition-all
                        ${darkMode ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
                >
                    <Mail className="w-5 h-5" />
                </Link>

                {/* Dark Mode Toggle */}
                <button
                    onClick={toggleDarkMode}
                    className={`p-2 rounded-xl transition-all
                        ${darkMode ? 'text-white/60 hover:bg-white/10 hover:text-yellow-400' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
                >
                    {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>

                {/* Divider */}
                <div className={`hidden sm:block w-px h-6 mx-1 ${darkMode ? 'bg-white/10' : 'bg-gray-200'}`} />

                {/* User Info */}
                <Link
                    to="/profile"
                    className={`hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all group
                        ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                >
                    <div className={`text-right ${darkMode ? '' : ''}`}>
                        <p className={`text-[11px] font-black uppercase leading-tight ${darkMode ? 'text-white group-hover:text-yellow-400' : 'text-gray-700 group-hover:text-[#800000]'}`}>
                            {(user?.name || user?.email?.split('@')[0] || 'User').toUpperCase().substring(0, 16)}
                        </p>
                        <p className={`text-[9px] font-semibold capitalize ${darkMode ? 'text-white/40' : 'text-gray-400'}`}>
                            {user?.role || 'Admin'}
                        </p>
                    </div>
                    <div className="w-8 h-8 bg-[#800000] text-yellow-400 font-black rounded-full flex items-center justify-center text-xs shadow-md group-hover:scale-105 transition-transform overflow-hidden border-2 border-yellow-400/30">
                        {user?.photo ? (
                            <img src={user?.photo} alt="Avatar" className="w-full h-full object-cover" />
                        ) : userInitial}
                    </div>
                </Link>

                {/* Logout */}
                <button
                    onClick={handleLogout}
                    title="Logout"
                    className={`p-2 rounded-xl transition-all
                        ${darkMode ? 'text-white/20 hover:text-red-400 hover:bg-red-500/10' : 'text-gray-300 hover:text-red-500 hover:bg-red-50'}`}
                >
                    <LogOut className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
