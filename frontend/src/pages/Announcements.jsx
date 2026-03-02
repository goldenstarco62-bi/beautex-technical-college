import { useEffect, useState } from 'react';
import { Megaphone, Plus, Calendar, User, Tag, Trash2, X, Edit, Eye, MessageSquare, Bell } from 'lucide-react';
import { announcementsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Announcements() {
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState(null);
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
        } finally {
            if (!silent) setLoading(false);
        }
    };

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
        } catch (error) {
            console.error('Error deleting announcement:', error);
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
            } else {
                await announcementsAPI.create(announcementData);
            }
            await fetchAnnouncements(true);
            setShowModal(false);
            resetForm();
        } catch (error) {
            console.error('Error creating announcement:', error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-maroon/10 border-t-maroon rounded-full animate-spin"></div>
                    <Megaphone className="w-6 h-6 text-maroon absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>
                <div className="text-maroon font-black uppercase tracking-[0.3em] text-xs">Accessing Bulletins...</div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-12 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Elite Header section */}
            <div className="relative group">
                <div className="absolute -inset-4 bg-gradient-to-r from-maroon/5 to-gold/5 rounded-[3rem] blur-2xl opacity-50 group-hover:opacity-100 transition-opacity duration-1000"></div>

                <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-8 bg-white/40 backdrop-blur-xl p-8 md:p-12 rounded-[2.5rem] border border-white/60 shadow-2xl">
                    <div className="flex items-center gap-8">
                        <div className="w-20 h-20 bg-maroon rounded-3xl flex items-center justify-center shadow-2xl shadow-maroon/20 transform -rotate-3 transition-transform group-hover:rotate-0 duration-500">
                            <Megaphone className="w-10 h-10 text-gold" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <span className="h-[1px] w-8 bg-gold/40"></span>
                                <p className="text-[10px] text-maroon/60 font-black tracking-[0.3em] uppercase">Communication Portal</p>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black text-maroon tracking-tighter uppercase leading-none">
                                Bulletins <span className="text-gold">&</span> News
                            </h1>
                            <p className="text-sm text-gray-500 font-medium mt-3 border-l-2 border-gold/40 pl-4 italic">Official dispatches from the College Registry</p>
                        </div>
                    </div>
                    {(user?.role === 'admin' || user?.role === 'superadmin') && (
                        <button
                            onClick={() => { resetForm(); setShowModal(true); }}
                            className="group relative px-10 py-5 bg-maroon text-gold rounded-2xl overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-maroon/30"
                        >
                            <div className="absolute inset-0 bg-gold translate-y-full group-hover:translate-y-0 transition-transform duration-500 opacity-10"></div>
                            <div className="relative flex items-center gap-3">
                                <Plus className="w-5 h-5 text-gold" />
                                <span className="font-black text-xs uppercase tracking-[0.2em]">Broadcast News</span>
                            </div>
                        </button>
                    )}
                </div>
            </div>

            {/* Announcements Grid */}
            <div className="grid grid-cols-1 gap-8">
                {announcements.length === 0 ? (
                    <div className="text-center py-24 bg-white/30 rounded-[3rem] border-2 border-dashed border-maroon/10">
                        <Bell className="w-16 h-16 text-maroon/10 mx-auto mb-4" />
                        <p className="text-maroon/30 font-black uppercase tracking-widest">No active broadcasts found</p>
                    </div>
                ) : (
                    announcements.map((announcement, idx) => (
                        <div
                            key={announcement.id || announcement._id || `ann-${idx}`}
                            className={`relative group bg-white rounded-[2.5rem] p-1 shadow-xl hover:shadow-2xl transition-all duration-500 border border-maroon/5 flex flex-col md:flex-row overflow-hidden ${announcement.priority === 'High' ? 'hover:border-red-500/20' : 'hover:border-gold/30'
                                }`}
                        >
                            {/* Priority Sidebar Decoration */}
                            <div className={`w-2 md:w-3 shrink-0 ${announcement.priority === 'High' ? 'bg-red-600' :
                                    announcement.priority === 'Medium' ? 'bg-maroon' : 'bg-gold'
                                }`}></div>

                            <div className="flex-1 p-8 md:p-12">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                                    <div className="flex flex-wrap items-center gap-4">
                                        <div className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${announcement.priority === 'High'
                                                ? 'bg-red-50 text-red-700 border-red-100'
                                                : 'bg-maroon/5 text-maroon border-maroon/10'
                                            }`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${announcement.priority === 'High' ? 'bg-red-600' : 'bg-maroon'} ${announcement.priority === 'High' ? 'animate-pulse' : ''}`}></div>
                                            {announcement.priority} PRIORITY
                                        </div>
                                        <div className="flex items-center gap-2 px-5 py-2 bg-gold/5 text-gold-700 border border-gold/10 rounded-xl text-[10px] font-black uppercase tracking-widest">
                                            <Tag className="w-3 h-3" />
                                            {announcement.category}
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {new Date(announcement.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </div>
                                    </div>

                                    {(user?.role === 'admin' || user?.role === 'superadmin') && (
                                        <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
                                            <button onClick={() => handleEdit(announcement)} className="p-3 bg-gray-50 hover:bg-maroon hover:text-gold rounded-xl transition-all shadow-sm">
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(announcement.id)} className="p-3 bg-gray-50 hover:bg-red-600 hover:text-white rounded-xl transition-all shadow-sm">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-6 max-w-4xl">
                                    <h2 className="text-2xl md:text-3xl font-black text-maroon tracking-tight uppercase group-hover:text-black transition-colors duration-300">
                                        {announcement.title}
                                    </h2>
                                    <div className="relative group/text">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-gold/40 to-transparent rounded-full -ml-8"></div>
                                        <p className="text-gray-600 text-lg leading-[1.8] font-medium whitespace-pre-wrap pl-2">
                                            {announcement.content}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-12 pt-8 border-t border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-maroon/5 rounded-full flex items-center justify-center border border-maroon/10 uppercase font-black text-xs text-maroon">
                                            {announcement.author?.charAt(0) || 'A'}
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none mb-1">Dispatch Authority</p>
                                            <p className="text-xs font-black text-maroon uppercase tracking-wider">{announcement.author}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 px-4 py-2 bg-parchment-50 rounded-lg border border-maroon/5">
                                        <MessageSquare className="w-4 h-4 text-maroon/20" />
                                        <span className="text-[10px] font-black text-maroon/40 uppercase tracking-widest">Official Bulletin Dispatched</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Elite Modal for Creation/Edit */}
            {showModal && (
                <div className="fixed inset-0 bg-maroon-950/60 backdrop-blur-xl flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] shadow-4xl max-w-5xl w-full max-h-[90vh] overflow-hidden border border-white/20 flex flex-col md:flex-row">
                        {/* Sidebar Decoration / Context */}
                        <div className="hidden md:flex md:w-80 bg-maroon p-12 flex-col justify-between relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                            <div className="absolute bottom-0 left-0 w-48 h-48 bg-gold/10 rounded-full -ml-24 -mb-24 blur-3xl"></div>

                            <div className="relative">
                                <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-8 border border-white/20 shadow-xl">
                                    <Megaphone className="w-8 h-8 text-gold" />
                                </div>
                                <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
                                    {editingAnnouncement ? 'Refine' : 'New'} <br /><span className="text-gold">Broadcast</span>
                                </h3>
                                <p className="text-xs text-white/50 font-bold uppercase tracking-widest leading-relaxed">
                                    Broadcast official news to all students and faculty email addresses instantly.
                                </p>
                            </div>

                            <div className="relative space-y-4">
                                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                                    <p className="text-[10px] text-gold font-bold uppercase tracking-widest mb-1">Security Node</p>
                                    <p className="text-[9px] text-white/60 leading-relaxed font-medium">Verify all information before dispatching. Announcements are archived in the audit trail.</p>
                                </div>
                            </div>
                        </div>

                        {/* Main Content Area */}
                        <div className="flex-1 flex flex-col h-full overflow-hidden">
                            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setShowPreview(false)}
                                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!showPreview ? 'bg-maroon text-gold shadow-lg shadow-maroon/20' : 'text-maroon'}`}
                                    >
                                        Editor
                                    </button>
                                    <button
                                        onClick={() => setShowPreview(true)}
                                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${showPreview ? 'bg-maroon text-gold shadow-lg shadow-maroon/20' : 'text-maroon'}`}
                                    >
                                        <Eye className="w-3.5 h-3.5" /> Preview
                                    </button>
                                </div>
                                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-maroon">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-12">
                                {showPreview ? (
                                    <div className="animate-in fade-in zoom-in-95 duration-300">
                                        <div className="text-[10px] font-black text-gold uppercase tracking-[.3em] mb-8 text-center bg-maroon/5 py-3 rounded-full border border-maroon/5">Bulletin Live Preview</div>
                                        <div className="bg-white rounded-3xl p-10 border border-maroon/10 shadow-xl max-w-2xl mx-auto border-l-8 border-l-maroon">
                                            <div className="flex justify-between items-center mb-8">
                                                <div className="px-5 py-2 bg-maroon/5 text-maroon text-[10px] font-black uppercase tracking-[.2em] rounded-lg border border-maroon/10">
                                                    {formData.priority} Priority
                                                </div>
                                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest italic">{new Date().toLocaleDateString('en-GB')}</div>
                                            </div>
                                            <h4 className="text-2xl font-black text-maroon uppercase tracking-tight mb-6">{formData.title || 'Untitled Bulletin'}</h4>
                                            <p className="text-gray-600 font-medium leading-[1.8] whitespace-pre-wrap">{formData.content || 'Start typing in the editor to see your content here...'}</p>
                                            <div className="mt-10 pt-6 border-t border-gray-100 flex justify-between items-center">
                                                <div className="text-[10px] font-black text-maroon/50 uppercase tracking-widest">Authored by: {user?.name || 'Administrator'}</div>
                                                <div className="text-[10px] font-black text-gold uppercase tracking-widest">{formData.category}</div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in duration-300">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Bulletin Headline</label>
                                            <input
                                                type="text"
                                                value={formData.title}
                                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                                className="w-full px-8 py-5 bg-gray-50 border border-gray-100 rounded-[1.5rem] text-maroon font-bold placeholder-maroon/20 outline-none focus:ring-4 focus:ring-maroon/5 focus:border-maroon/20 transition-all text-xl"
                                                placeholder="e.g. End of Semester Gala Night"
                                                required
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-8">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Dispatch Priority</label>
                                                <select
                                                    value={formData.priority}
                                                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                                    className="w-full px-8 py-5 bg-gray-50 border border-gray-100 rounded-[1.5rem] text-maroon font-bold outline-none focus:ring-4 focus:ring-maroon/5 focus:border-maroon/20 transition-all cursor-pointer"
                                                >
                                                    <option value="Medium">Standard Bulletin</option>
                                                    <option value="High">Urgent Broadcast</option>
                                                    <option value="Low">General Update</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Publication Category</label>
                                                <select
                                                    value={formData.category}
                                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                                    className="w-full px-8 py-5 bg-gray-50 border border-gray-100 rounded-[1.5rem] text-maroon font-bold outline-none focus:ring-4 focus:ring-maroon/5 focus:border-maroon/20 transition-all cursor-pointer"
                                                >
                                                    <option value="General">General News</option>
                                                    <option value="Academic">Academic Affairs</option>
                                                    <option value="Facilities">Campus Life</option>
                                                    <option value="Events">Special Events</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Message Content</label>
                                            <textarea
                                                value={formData.content}
                                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                                className="w-full px-8 py-6 bg-gray-50 border border-gray-100 rounded-[2rem] text-maroon font-bold placeholder-maroon/20 outline-none focus:ring-4 focus:ring-maroon/5 focus:border-maroon/20 transition-all h-60 resize-none leading-[1.8]"
                                                placeholder="Craft your official message here..."
                                                required
                                            ></textarea>
                                        </div>

                                        <button
                                            type="submit"
                                            className="w-full bg-maroon text-gold py-6 rounded-2xl font-black text-sm uppercase tracking-[0.3em] hover:bg-black shadow-2xl shadow-maroon/30 transition-all transform active:scale-95 border border-gold/40 flex items-center justify-center gap-3"
                                        >
                                            <Bell className="w-5 h-5" />
                                            {editingAnnouncement ? 'Execute Revision' : 'Execute Broadcast'}
                                        </button>
                                    </form>
                                )}
                            </div>
                        </div>
                    </div >
                </div >
            )}
        </div >
    );
}
