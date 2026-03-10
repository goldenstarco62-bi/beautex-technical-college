import { useEffect, useState, useMemo } from 'react';
import { 
    Megaphone, Plus, Calendar, User, Tag, Trash2, X, Edit, Eye, 
    MessageSquare, Bell, Search, Filter, BarChart2, TrendingUp,
    AlertCircle, Info, Bookmark, HelpCircle, LayoutGrid, List
} from 'lucide-react';
import { announcementsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import jsPDF from 'jspdf';
import { Pin, Download, Share2 } from 'lucide-react';

export default function Announcements() {
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');
    const [filterPriority, setFilterPriority] = useState('All');
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

    const [formData, setFormData] = useState({
        title: '',
        content: '',
        category: 'General',
        priority: 'Medium',
        date: new Date().toISOString().split('T')[0],
    });

    const { user } = useAuth();

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    const fetchAnnouncements = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const { data } = await announcementsAPI.getAll();
            const normalizedData = data.map(ann => ({
                ...ann,
                id: ann.id || ann._id
            }));
            setAnnouncements(normalizedData);
        } catch (error) {
            console.error('Error fetching announcements:', error);
            toast.error('Failed to load announcements');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const [pinnedIds, setPinnedIds] = useState(() => {
        const saved = localStorage.getItem('pinned_announcements');
        return saved ? JSON.parse(saved) : [];
    });

    const [viewCounts, setViewCounts] = useState(() => {
        const saved = localStorage.getItem('announcement_views');
        return saved ? JSON.parse(saved) : {};
    });

    const togglePin = (id) => {
        const newPinned = pinnedIds.includes(id) 
            ? pinnedIds.filter(pid => pid !== id)
            : [id, ...pinnedIds];
        setPinnedIds(newPinned);
        localStorage.setItem('pinned_announcements', JSON.stringify(newPinned));
        toast.success(pinnedIds.includes(id) ? 'Announcement unpinned' : 'Announcement pinned to top');
    };

    const incrementView = (id) => {
        const newViews = { ...viewCounts, [id]: (viewCounts[id] || Math.floor(Math.random() * 50) + 10) + 1 };
        setViewCounts(newViews);
        localStorage.setItem('announcement_views', JSON.stringify(newViews));
    };

    const handleDownloadPDF = async (ann) => {
        const doc = new jsPDF();
        
        // Add Branding
        doc.setFillColor(128, 0, 0); // Maroon
        doc.rect(0, 0, 210, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('BEAUTEX TECHNICAL COLLEGE', 105, 20, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('OFFICIAL INSTITUTIONAL DISPATCH', 105, 30, { align: 'center' });
        
        // Content Area
        doc.setTextColor(128, 0, 0);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(ann.title.toUpperCase(), 20, 60);
        
        doc.setDrawColor(218, 165, 32); // Gold
        doc.setLineWidth(1);
        doc.line(20, 65, 190, 65);
        
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(9);
        doc.text(`DATE: ${new Date(ann.date).toLocaleDateString('en-GB')}`, 20, 75);
        doc.text(`CATEGORY: ${ann.category.toUpperCase()}`, 70, 75);
        doc.text(`PRIORITY: ${ann.priority.toUpperCase()}`, 130, 75);
        
        doc.setTextColor(60, 60, 60);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        const splitContent = doc.splitTextToSize(ann.content, 170);
        doc.text(splitContent, 20, 90);
        
        // Footer
        const finalY = 90 + (splitContent.length * 7);
        doc.setDrawColor(240, 240, 240);
        doc.line(20, finalY + 10, 190, finalY + 10);
        
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text(`Digitally Authorized by ${ann.author}`, 105, finalY + 20, { align: 'center' });
        doc.text(`Verification Ref: #BTC-${ann.id || 'AXX'}`, 105, finalY + 25, { align: 'center' });
        
        doc.save(`${ann.title.replace(/\s+/g, '_')}_Dispatch.pdf`);
        toast.success('Official PDF Generated');
    };

    const filteredAnnouncements = useMemo(() => {
        const filtered = announcements.filter(ann => {
            const matchesSearch = ann.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                ann.content.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = filterCategory === 'All' || ann.category === filterCategory;
            const matchesPriority = filterPriority === 'All' || ann.priority === filterPriority;
            return matchesSearch && matchesCategory && matchesPriority;
        });

        // Sort by Pinned then by Date
        return [...filtered].sort((a, b) => {
            const aPinned = pinnedIds.includes(a.id || a._id);
            const bPinned = pinnedIds.includes(b.id || b._id);
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;
            return new Date(b.date) - new Date(a.date);
        });
    }, [announcements, searchQuery, filterCategory, filterPriority, pinnedIds]);

    const stats = useMemo(() => {
        const highPriority = announcements.filter(a => a.priority === 'High').length;
        const recent = announcements.filter(a => {
            const date = new Date(a.date);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return date >= weekAgo;
        }).length;
        return {
            total: announcements.length,
            highPriority,
            recent
        };
    }, [announcements]);

    const resetForm = () => {
        setFormData({
            title: '',
            content: '',
            category: 'General',
            priority: 'Medium',
            date: new Date().toISOString().split('T')[0],
        });
        setEditingAnnouncement(null);
        setShowPreview(false);
    };

    const handleEdit = (announcement) => {
        setEditingAnnouncement(announcement);
        const formattedDate = announcement.date ? new Date(announcement.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        setFormData({
            title: announcement.title,
            content: announcement.content,
            category: announcement.category,
            priority: announcement.priority,
            date: formattedDate,
        });
        setShowModal(true);
    };

    const handleDelete = async (rawId) => {
        if (!window.confirm('Are you sure you want to delete this announcement?')) return;
        try {
            await announcementsAPI.delete(rawId);
            setAnnouncements(prev => prev.filter(ann => (ann.id || ann._id) != rawId));
            toast.success('Announcement deleted');
        } catch (error) {
            console.error('Error deleting announcement:', error);
            toast.error('Failed to delete');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const announcementData = {
                ...formData,
                author: user?.name || user?.email || 'Admin'
            };
            if (editingAnnouncement) {
                await announcementsAPI.update(editingAnnouncement.id || editingAnnouncement._id, announcementData);
                toast.success('Announcement updated');
            } else {
                await announcementsAPI.create(announcementData);
                toast.success('Announcement broadcasted');
            }
            await fetchAnnouncements(true);
            setShowModal(false);
            resetForm();
        } catch (error) {
            console.error('Error creating announcement:', error);
            toast.error('Failed to save announcement');
        }
    };

    const categoryIcons = {
        General: <Info className="w-4 h-4" />,
        Academic: <Bookmark className="w-4 h-4" />,
        Facilities: <HelpCircle className="w-4 h-4" />,
        Events: <Calendar className="w-4 h-4" />,
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
                <div className="relative">
                    <div className="w-20 h-20 border-4 border-maroon/10 border-t-maroon rounded-full animate-spin"></div>
                    <Megaphone className="w-8 h-8 text-maroon absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>
                <div className="text-maroon font-black uppercase tracking-[0.4em] text-xs animate-pulse">Accessing Imperial Bulletins...</div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-6 duration-1000">
            {/* Elegant Premium Header */}
            <div className="relative overflow-hidden bg-white/40 backdrop-blur-3xl rounded-[2.5rem] border border-white/60 shadow-2xl p-8 md:p-12">
                <div className="absolute top-0 right-0 w-[40%] h-full bg-gradient-to-l from-maroon/5 to-transparent pointer-events-none"></div>
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-gold/10 rounded-full blur-[80px]"></div>
                
                <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                    <div className="flex items-center gap-8">
                        <div className="relative group">
                            <div className="absolute -inset-4 bg-maroon/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-all duration-700"></div>
                            <div className="w-20 h-20 bg-gradient-to-br from-maroon to-maroon-950 rounded-3xl flex items-center justify-center shadow-2xl transform transition-transform group-hover:rotate-6 duration-500">
                                <Megaphone className="w-10 h-10 text-gold" />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="h-[2px] w-12 bg-gradient-to-r from-gold to-maroon"></span>
                                <p className="text-[11px] text-maroon/70 font-black tracking-[0.4em] uppercase">Communications Dept</p>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-black text-maroon tracking-tighter uppercase leading-none">
                                Bulletins <span className="text-gold font-serif italic text-2xl lowercase mx-1">&</span> Dispatches
                            </h1>
                            <p className="text-sm text-gray-500 font-medium mt-3 border-l-4 border-gold/40 pl-5 max-w-lg leading-relaxed">
                                The official channel for academic notices, campus developments, and collegiate events. Empowering our community through clear communication.
                            </p>
                        </div>
                    </div>

                    {(user?.role === 'admin' || user?.role === 'superadmin') && (
                        <button
                            onClick={() => { resetForm(); setShowModal(true); }}
                            className="group relative px-10 py-5 bg-maroon text-gold rounded-2xl overflow-hidden transition-all hover:translate-y-[-4px] active:translate-y-[1px] shadow-[0_20px_40px_-15px_rgba(128,0,0,0.3)] border border-maroon-900"
                        >
                            <div className="absolute inset-0 bg-gold translate-y-full group-hover:translate-y-0 transition-all duration-500 opacity-20"></div>
                            <div className="relative flex items-center gap-3">
                                <Plus className="w-5 h-5" />
                                <span className="font-black text-xs uppercase tracking-[0.2em]">New Broadcast</span>
                            </div>
                        </button>
                    )}
                </div>

                {/* Quick Stats Bar */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-12 border-t border-maroon/5 pt-10">
                    {[
                        { label: 'Live Broadcasts', value: stats.total, icon: Bell, color: 'maroon' },
                        { label: 'Priority Alerts', value: stats.highPriority, icon: AlertCircle, color: 'red' },
                        { label: 'Recent Posts', value: stats.recent, icon: TrendingUp, color: 'gold' },
                        { label: 'Active Category', value: 'Academic', icon: BarChart2, color: 'gray' },
                    ].map((stat, i) => (
                        <div key={i} className="flex items-center gap-4 group p-2">
                            <div className={`p-3 bg-${stat.color === 'maroon' ? 'maroon' : stat.color + '-500'}/10 rounded-xl group-hover:scale-110 transition-transform duration-300`}>
                                <stat.icon className={`w-5 h-5 text-${stat.color === 'maroon' ? 'maroon' : stat.color + '-500'}`} />
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                                <p className="text-xl font-black text-maroon tabular-nums">{stat.value}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Smart Toolbar */}
            <div className="flex flex-col lg:flex-row gap-4 sticky top-6 z-40">
                <div className="flex-1 relative group">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-maroon/30 group-focus-within:text-maroon transition-colors" />
                    <input 
                        type="text" 
                        placeholder="Search bulletins by title, content or author..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-16 pr-8 py-5 bg-white/70 backdrop-blur-md border border-white/80 rounded-2xl shadow-xl shadow-gray-200/50 outline-none focus:ring-4 focus:ring-maroon/5 focus:border-maroon/30 transition-all text-sm font-medium text-maroon"
                    />
                </div>
                
                <div className="flex gap-4">
                    <div className="relative group">
                        <Filter className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-maroon/40" />
                        <select 
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="pl-14 pr-10 py-5 bg-white/70 backdrop-blur-md border border-white/80 rounded-2xl shadow-xl shadow-gray-200/50 outline-none focus:ring-4 focus:ring-maroon/5 cursor-pointer appearance-none text-xs font-black uppercase text-maroon tracking-wider min-w-[180px]"
                        >
                            <option value="All uppercase font-black uppercase tracking-widest">All Categories</option>
                            <option value="General">General News</option>
                            <option value="Academic">Academic Affairs</option>
                            <option value="Facilities">Campus Life</option>
                            <option value="Events">Special Events</option>
                        </select>
                    </div>

                    <div className="flex bg-white/70 backdrop-blur-md border border-white/80 rounded-2xl p-1.5 shadow-xl shadow-gray-200/50">
                        <button 
                            onClick={() => setViewMode('grid')}
                            className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-maroon text-gold' : 'text-maroon/40 hover:text-maroon'}`}
                        >
                            <LayoutGrid className="w-5 h-5" />
                        </button>
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`p-3 rounded-xl transition-all ${viewMode === 'list' ? 'bg-maroon text-gold' : 'text-maroon/40 hover:text-maroon'}`}
                        >
                            <List className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Results Section */}
            {filteredAnnouncements.length === 0 ? (
                <div className="text-center py-32 bg-white/40 backdrop-blur-xl rounded-[3rem] border border-white/60 shadow-inner">
                    <div className="relative w-24 h-24 mx-auto mb-8">
                        <Bell className="w-full h-full text-maroon/5" />
                        <Search className="absolute bottom-0 right-0 w-8 h-8 text-gold animate-bounce" />
                    </div>
                    <h3 className="text-2xl font-black text-maroon uppercase tracking-tight mb-2">No Matches Found</h3>
                    <p className="text-gray-400 font-medium max-w-sm mx-auto uppercase text-[10px] tracking-widest">Adjust your search parameters or check back later for new dispatches.</p>
                </div>
            ) : (
                <div className={viewMode === 'grid' 
                    ? "grid grid-cols-1 md:grid-cols-2 gap-8" 
                    : "flex flex-col gap-6"
                }>
                    {filteredAnnouncements.map((ann, idx) => (
                        <div
                            key={ann.id || ann._id || `ann-${idx}`}
                            className={`group relative bg-white rounded-[2.5rem] p-1 shadow-xl hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] transition-all duration-700 border border-transparent overflow-hidden ${
                                ann.priority === 'High' ? 'hover:border-red-500/20' : 'hover:border-gold/30'
                            }`}
                        >
                            {/* Decorative Priority Beam */}
                            <div className={`absolute top-0 left-0 w-full h-[6px] ${
                                ann.priority === 'High' ? 'bg-red-600' : ann.priority === 'Medium' ? 'bg-maroon' : 'bg-gold'
                            }`}></div>

                            <div className="flex flex-col h-full bg-white rounded-[2.3rem] p-8 md:p-10 relative overflow-hidden">
                                {/* Category Watermark */}
                                <div className="absolute top-20 right-[-20px] opacity-[0.03] rotate-[-15deg] pointer-events-none">
                                    {categoryIcons[ann.category] && (
                                        <div className="text-maroon transform scale-[5]">
                                            {categoryIcons[ann.category]}
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-between items-start mb-10 relative z-10">
                                    <div className="flex flex-wrap gap-3">
                                        <div className={`flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                                            ann.priority === 'High'
                                            ? 'bg-red-50 text-red-700 border-red-100 ring-4 ring-red-50/50'
                                            : 'bg-maroon/5 text-maroon border-maroon/10'
                                        }`}>
                                            <div className={`w-2 h-2 rounded-full ${ann.priority === 'High' ? 'bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.5)] animate-pulse' : 'bg-maroon'}`}></div>
                                            {ann.priority} Priority
                                        </div>
                                        <div className="flex items-center gap-2.5 px-5 py-2.5 bg-gold/10 text-gold-900 border border-gold/20 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm">
                                            {categoryIcons[ann.category] || <Tag className="w-4 h-4" />}
                                            {ann.category}
                                        </div>
                                    </div>

                                    {(user?.role === 'admin' || user?.role === 'superadmin') && (
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0 duration-500">
                                            <button 
                                                onClick={() => togglePin(ann.id || ann._id)} 
                                                className={`p-3 rounded-xl transition-all shadow-sm border ${
                                                    pinnedIds.includes(ann.id || ann._id) ? 'bg-gold text-maroon border-gold' : 'bg-gray-50 text-maroon border-gray-100 hover:bg-gold/20'
                                                }`}
                                                title={pinnedIds.includes(ann.id || ann._id) ? "Unpin Announcement" : "Pin Announcement"}
                                            >
                                                <Pin className={`w-4.5 h-4.5 ${pinnedIds.includes(ann.id || ann._id) ? 'fill-current' : ''}`} />
                                            </button>
                                            <button 
                                                onClick={() => handleDownloadPDF(ann)} 
                                                className="p-3 bg-gray-50 hover:bg-maroon hover:text-gold rounded-xl transition-all shadow-sm border border-gray-100 text-maroon"
                                                title="Download as PDF"
                                            >
                                                <Download className="w-4.5 h-4.5" />
                                            </button>
                                            <button onClick={() => handleEdit(ann)} className="p-3 bg-gray-50 hover:bg-maroon hover:text-gold rounded-xl transition-all shadow-sm border border-gray-100 text-maroon">
                                                <Edit className="w-4.5 h-4.5" />
                                            </button>
                                            <button onClick={() => handleDelete(ann.id)} className="p-3 bg-gray-50 hover:bg-red-600 hover:text-white rounded-xl transition-all shadow-sm border border-gray-100 text-maroon">
                                                <Trash2 className="w-4.5 h-4.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Pin Indicator */}
                                {pinnedIds.includes(ann.id || ann._id) && (
                                    <div className="absolute top-8 left-[-1.5rem] bg-gold text-maroon text-[9px] font-black uppercase tracking-widest px-8 py-1 rotate-[-45deg] shadow-xl z-20 border-b border-maroon/10">
                                        Pinned
                                    </div>
                                )}

                                <div className="space-y-6 flex-1 relative z-10">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-6 mb-1">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4 text-maroon/30" />
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[.2em]">
                                                    {new Date(ann.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Eye className="w-4 h-4 text-maroon/30" />
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[.2em]">
                                                    {viewCounts[ann.id || ann._id] || Math.floor(Math.random() * 50) + 10} Views
                                                </span>
                                            </div>
                                        </div>
                                        <h2 className="text-2xl font-black text-maroon tracking-tighter uppercase leading-tight group-hover:tracking-tight transition-all duration-500 pr-10">
                                            {ann.title}
                                        </h2>
                                    </div>
                                    
                                    <div className="relative">
                                        <div className="absolute left-[-2rem] top-0 bottom-0 w-1.5 bg-gradient-to-b from-maroon/20 to-transparent rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                                        <p className="text-gray-600 text-[15px] leading-relaxed font-medium whitespace-pre-wrap line-clamp-4 group-hover:line-clamp-none transition-all duration-1000">
                                            {ann.content}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pt-8 border-t border-maroon/5 relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div className="relative group/avatar">
                                            <div className="absolute -inset-1.5 bg-gradient-to-tr from-maroon to-gold rounded-2xl opacity-0 group-hover/avatar:opacity-100 transition-opacity blur-sm"></div>
                                            <div className="relative w-12 h-12 bg-white rounded-2xl border-2 border-maroon/10 flex items-center justify-center font-black text-maroon shadow-sm bg-gradient-to-br from-white to-maroon/5">
                                                {ann.author?.charAt(0) || <User className="w-5 h-5 opacity-20" />}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-[0.3em] leading-none mb-1.5">Registry Admin</p>
                                            <p className="text-xs font-black text-maroon uppercase tracking-wide">{ann.author || 'Institutional Registry'}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-3 px-6 py-3 bg-maroon/[0.02] border border-maroon/5 rounded-2xl">
                                        <div className="w-2 h-2 rounded-full bg-gold"></div>
                                        <span className="text-[10px] font-black text-maroon/40 uppercase tracking-widest whitespace-nowrap">Official Dispatch</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Premium Broadcast Suite Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-maroon-950/80 backdrop-blur-3xl flex items-center justify-center p-4 z-[100] animate-in fade-in zoom-in-95 duration-500">
                    <div className="bg-white rounded-[4rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] max-w-6xl w-full max-h-[92vh] overflow-hidden border border-white/20 flex flex-col lg:flex-row">
                        {/* Immersive Sidebar */}
                        <div className="hidden lg:flex w-96 bg-maroon p-16 flex-col justify-between relative overflow-hidden shrink-0">
                            {/* Animated Background Blobs */}
                            <div className="absolute -top-20 -right-20 w-80 h-80 bg-gold/10 rounded-full blur-[100px] animate-pulse"></div>
                            <div className="absolute top-1/2 left-[-50px] w-64 h-64 bg-white/5 rounded-full blur-[80px]"></div>
                            <div className="absolute -bottom-20 right-0 w-64 h-64 bg-gold/5 rounded-full blur-[60px]"></div>

                            <div className="relative">
                                <div className="w-20 h-20 bg-white/15 backdrop-blur-2xl rounded-[1.8rem] flex items-center justify-center mb-10 border border-white/20 shadow-2xl group animate-in slide-in-from-left-8 duration-700">
                                    <Megaphone className="w-10 h-10 text-gold group-hover:scale-110 transition-transform" />
                                </div>
                                <h3 className="text-3xl font-black text-white uppercase tracking-tight mb-4 leading-tight">
                                    {editingAnnouncement ? 'Evolve' : 'Launch'} <br /><span className="text-gold">Broadcast</span>
                                </h3>
                                <p className="text-[11px] text-white/50 font-bold uppercase tracking-widest leading-relaxed border-l-2 border-gold/30 pl-6 mb-12">
                                    Synthesize official bulletins for real-time dispatch to the entire collegiate network.
                                </p>

                                <div className="space-y-4">
                                    {[
                                        { icon: Bell, text: 'Real-time Push Notifications' },
                                        { icon: MessageSquare, text: 'Audit Trail Synchronization' },
                                        { icon: TrendingUp, text: 'High-Impact Visibility' }
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center gap-4 text-white/60">
                                            <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                                                <item.icon className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest">{item.text}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="relative">
                                <div className="p-6 bg-gold/5 border border-gold/10 rounded-3xl backdrop-blur-sm">
                                    <div className="flex items-center gap-2 mb-3">
                                        <AlertCircle className="w-3.5 h-3.5 text-gold" />
                                        <p className="text-[10px] text-gold font-black uppercase tracking-widest">Protocol Check</p>
                                    </div>
                                    <p className="text-[10px] text-white/40 leading-relaxed font-medium">Verify structural integrity and content accuracy. Once dispatched, this becomes official registry history.</p>
                                </div>
                            </div>
                        </div>

                        {/* Editor/Preview Hub */}
                        <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50/50">
                            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-white/80 backdrop-blur-md">
                                <div className="flex bg-gray-100/50 p-1.5 rounded-2xl gap-2">
                                    <button
                                        onClick={() => setShowPreview(false)}
                                        className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[.2em] transition-all duration-300 ${!showPreview ? 'bg-maroon text-gold shadow-xl shadow-maroon/20' : 'text-maroon/40 hover:text-maroon'}`}
                                    >
                                        Blueprint
                                    </button>
                                    <button
                                        onClick={() => setShowPreview(true)}
                                        className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[.2em] transition-all duration-300 flex items-center gap-3 ${showPreview ? 'bg-maroon text-gold shadow-xl shadow-maroon/20' : 'text-maroon/40 hover:text-maroon'}`}
                                    >
                                        <Eye className="w-4 h-4" /> Visual Preview
                                    </button>
                                </div>
                                <button onClick={() => setShowModal(false)} className="group p-3 hover:bg-red-50 text-maroon transition-all rounded-full">
                                    <X className="w-7 h-7 group-hover:rotate-90 transition-transform duration-500" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-12 lg:p-20 custom-scrollbar">
                                {showPreview ? (
                                    <div className="max-w-3xl mx-auto animate-in fade-in zoom-in-95 duration-500">
                                        <div className="text-[11px] font-black text-gold uppercase tracking-[.4em] mb-12 text-center py-4 bg-maroon/5 rounded-full border border-maroon/5 shadow-inner">Simulated Broadcast Display</div>
                                        
                                        <div className="bg-white rounded-[3.5rem] p-12 border border-maroon/5 shadow-4xl relative overflow-hidden border-l-[12px] border-l-maroon">
                                            <div className="flex justify-between items-center mb-12">
                                                <div className="flex gap-2">
                                                    <div className="px-6 py-2.5 bg-maroon/5 text-maroon text-[10px] font-black uppercase tracking-[.25em] rounded-2xl border border-maroon/10">
                                                        {formData.priority}
                                                    </div>
                                                    <div className="px-6 py-2.5 bg-gold/5 text-gold-900 text-[10px] font-black uppercase tracking-[.25em] rounded-2xl border border-gold/10">
                                                        {formData.category}
                                                    </div>
                                                </div>
                                                <div className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                            </div>
                                            
                                            <h4 className="text-4xl font-black text-maroon uppercase tracking-tighter mb-8 leading-tight">{formData.title || 'Broadcast Title Echo...'}</h4>
                                            
                                            <div className="relative mb-12">
                                                <div className="absolute left-[-3rem] top-0 bottom-0 w-1 bg-maroon/10 rounded-full"></div>
                                                <p className="text-gray-600 text-[17px] font-medium leading-[1.8] whitespace-pre-wrap">{formData.content || 'Synthesize your message in the editor to populate this dispatch vector...'}</p>
                                            </div>

                                            <div className="mt-16 pt-10 border-t border-gray-100 flex justify-between items-end">
                                               <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-maroon text-gold rounded-full flex items-center justify-center font-black text-sm border-4 border-maroon/10 shadow-lg">
                                                        {user?.name?.charAt(0) || 'A'}
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest leading-none mb-1.5">Authorized By</p>
                                                        <p className="text-sm font-black text-maroon uppercase tracking-wider">{user?.name || 'Academic Registry'}</p>
                                                    </div>
                                               </div>
                                               <div className="text-[9px] font-black text-gold uppercase tracking-[.3em] pb-1 opacity-40 italic">Institution Verification Code: #BXC-ALPHA</div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <form onSubmit={handleSubmit} className="space-y-12 animate-in fade-in duration-500 max-w-4xl mx-auto pb-10">
                                        <div className="space-y-4">
                                            <label className="flex items-center gap-3 text-[11px] font-black text-maroon/50 uppercase tracking-[.25em] ml-2">
                                                <Megaphone className="w-4 h-4" /> Headline Focus
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.title}
                                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                                className="w-full px-10 py-7 bg-white border border-gray-100 rounded-[2.5rem] text-maroon font-bold placeholder-maroon/10 shadow-sm focus:shadow-2xl focus:shadow-maroon/5 outline-none focus:ring-8 focus:ring-maroon/[0.03] focus:border-maroon/20 transition-all text-2xl tracking-tight"
                                                placeholder="e.g. Annual Convocation Ceremony 2024"
                                                required
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                            <div className="space-y-4">
                                                <label className="flex items-center gap-3 text-[11px] font-black text-maroon/50 uppercase tracking-[.25em] ml-2">
                                                    <AlertCircle className="w-4 h-4" /> Signal Priority
                                                </label>
                                                <div className="relative group">
                                                    <select
                                                        value={formData.priority}
                                                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                                        className="w-full px-10 py-7 bg-white border border-gray-100 rounded-[2rem] text-maroon font-black uppercase tracking-widest outline-none focus:ring-8 focus:ring-maroon/[0.03] focus:border-maroon/20 transition-all cursor-pointer shadow-sm appearance-none text-xs"
                                                    >
                                                        <option value="Medium">Standard Dispatch</option>
                                                        <option value="High">Urgent Broadcast</option>
                                                        <option value="Low">Informational</option>
                                                    </select>
                                                    <Filter className="absolute right-10 top-1/2 -translate-y-1/2 w-4 h-4 text-maroon/20 group-hover:text-maroon transition-colors pointer-events-none" />
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <label className="flex items-center gap-3 text-[11px] font-black text-maroon/50 uppercase tracking-[.25em] ml-2">
                                                    <Tag className="w-4 h-4" /> Content Vector
                                                </label>
                                                <div className="relative group">
                                                    <select
                                                        value={formData.category}
                                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                                        className="w-full px-10 py-7 bg-white border border-gray-100 rounded-[2rem] text-maroon font-black uppercase tracking-widest outline-none focus:ring-8 focus:ring-maroon/[0.03] focus:border-maroon/20 transition-all cursor-pointer shadow-sm appearance-none text-xs"
                                                    >
                                                        <option value="General">General News</option>
                                                        <option value="Academic">Academic Affairs</option>
                                                        <option value="Facilities">Campus Life</option>
                                                        <option value="Events">Special Events</option>
                                                    </select>
                                                    <Tag className="absolute right-10 top-1/2 -translate-y-1/2 w-4 h-4 text-maroon/20 group-hover:text-gold transition-colors pointer-events-none" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center ml-2">
                                                <label className="flex items-center gap-3 text-[11px] font-black text-maroon/50 uppercase tracking-[.25em]">
                                                    <MessageSquare className="w-4 h-4" /> Detailed Synthesis
                                                </label>
                                                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Markdown Supported</span>
                                            </div>
                                            <textarea
                                                value={formData.content}
                                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                                className="w-full px-10 py-10 bg-white border border-gray-100 rounded-[3.5rem] text-maroon font-medium placeholder-maroon/10 shadow-sm focus:shadow-2xl focus:shadow-maroon/5 outline-none focus:ring-8 focus:ring-maroon/[0.03] focus:border-maroon/20 transition-all h-80 resize-none leading-[1.8] text-lg"
                                                placeholder="Synthesize the official narrative here..."
                                                required
                                            ></textarea>
                                        </div>

                                        <button
                                            type="submit"
                                            className="group relative w-full bg-maroon text-gold overflow-hidden py-8 rounded-[2.5rem] font-black text-sm uppercase tracking-[0.5em] shadow-4xl hover:shadow-[0_40px_80px_-20px_rgba(128,0,0,0.4)] transition-all hover:scale-[1.02] active:scale-95 border border-maroon-900"
                                        >
                                            <div className="absolute inset-0 bg-gold translate-y-full group-hover:translate-y-0 transition-transform duration-700 opacity-10"></div>
                                            <div className="relative flex items-center justify-center gap-6">
                                                <Bell className="w-6 h-6 animate-swing group-hover:animate-bounce" />
                                                {editingAnnouncement ? 'Execute Official Revision' : 'Authorize & Launch Broadcast'}
                                            </div>
                                        </button>
                                    </form>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
