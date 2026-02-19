import { useEffect, useState } from 'react';
import { Megaphone, Plus, Calendar, User, Tag, Trash2, X, Edit } from 'lucide-react';
import { announcementsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const priorityColors = {
    High: 'text-red-500',
    Medium: 'text-blue-500',
    Low: 'text-green-500'
};

export default function Announcements() {
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
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
            // Normalize IDs immediately
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
    };

    const handleEdit = (announcement) => {
        setEditingAnnouncement(announcement);
        // Ensure date is in YYYY-MM-DD format for the input
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
            await fetchAnnouncements(true); // Silent refresh
            setShowModal(false);
            resetForm();
        } catch (error) {
            console.error('Error creating announcement:', error);
        }
    };

    if (loading) return <div className="p-8 text-center font-black uppercase tracking-widest text-maroon">Syncing Bulletins...</div>;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-maroon tracking-tight uppercase">Announcements</h1>
                    <p className="text-xs text-maroon/40 font-bold tracking-widest mt-1">Official College Communications</p>
                </div>
                {(user?.role === 'admin' || user?.role === 'superadmin') && (
                    <button
                        onClick={() => { resetForm(); setShowModal(true); }}
                        className="w-full md:w-auto bg-maroon text-gold px-8 py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:bg-elite-maroon shadow-lg transition-all border border-gold/20 font-black text-xs uppercase tracking-widest"
                    >
                        <Plus className="w-5 h-5" /> Broadcast News
                    </button>
                )}
            </div>

            <div className="space-y-6">
                {announcements.map((announcement, idx) => (
                    <div key={announcement.id || announcement._id || `ann-${idx}`} className="card-light p-8 group relative overflow-hidden transition-all hover:scale-[1.01] bg-white border border-maroon/5">
                        {announcement.priority === 'High' && (
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-gold/15 transition-all"></div>
                        )}

                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-4">
                                <div className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border ${announcement.priority === 'High'
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : 'bg-parchment-100 text-maroon border-maroon/5'
                                    }`}>
                                    {announcement.priority} Priority
                                </div>
                                <span className="text-[10px] font-bold text-maroon/40 uppercase tracking-widest flex items-center gap-2">
                                    <div className="w-1 h-1 bg-maroon/20 rounded-full"></div>
                                    {announcement.date}
                                </span>
                            </div>
                            {(user?.role === 'admin' || user?.role === 'superadmin') && (
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEdit(announcement)} className="p-2 hover:bg-parchment-100 rounded-lg text-black transition-all">
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(announcement.id)} className="p-2 hover:bg-red-50 rounded-lg text-black hover:text-red-600 transition-all">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>

                        <h2 className="text-2xl font-black text-black tracking-tight mb-4 uppercase transition-colors">{announcement.title}</h2>
                        <p className="text-gray-600 leading-relaxed font-medium mb-8 border-l-2 border-maroon/5 pl-6">{announcement.content}</p>

                        <div className="flex justify-between items-center border-t border-maroon/5 pt-6">
                            <p className="text-[10px] font-black text-maroon/60 uppercase tracking-widest">Issued by: {announcement.author}</p>
                            <button className="text-maroon/40 hover:text-maroon text-[10px] font-black uppercase tracking-widest transition-all">
                                {announcement.category} Bulletin
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-maroon-950/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-[2.5rem] p-12 max-w-2xl w-full border border-maroon/10 shadow-3xl animate-in zoom-in-95 duration-300 overflow-hidden relative">
                        {/* Subtle background patterns */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-maroon/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gold/5 rounded-full -ml-24 -mb-24 blur-3xl"></div>

                        <div className="relative flex justify-between items-center mb-10">
                            <div>
                                <h2 className="text-3xl font-black text-black uppercase tracking-tight">
                                    {editingAnnouncement ? 'Refine Broadcast' : 'New Broadcast'}
                                </h2>
                                <p className="text-xs text-maroon/40 font-bold mt-1 uppercase tracking-widest">Elite Communication Portal</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-3 bg-parchment-100 hover:bg-parchment-200 rounded-full transition-colors group">
                                <X className="w-8 h-8 text-maroon group-hover:rotate-90 transition-transform" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="relative space-y-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Subject Headline</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-6 py-5 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold placeholder-maroon/20 outline-none focus:ring-2 focus:ring-maroon/10 transition-all"
                                    placeholder="e.g. End of Semester Gala"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Priority Level</label>
                                    <select
                                        value={formData.priority}
                                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                        className="w-full px-6 py-5 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10 transition-all"
                                    >
                                        <option value="Medium">Normal</option>
                                        <option value="High">High Priority</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Category</label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full px-6 py-5 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10 transition-all"
                                    >
                                        <option value="General">General</option>
                                        <option value="Academic">Academic</option>
                                        <option value="Facilities">Facilities</option>
                                        <option value="Events">Events</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Detailed Message</label>
                                <textarea
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                    className="w-full px-6 py-5 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold placeholder-maroon/20 outline-none focus:ring-2 focus:ring-maroon/10 transition-all h-40 resize-none"
                                    placeholder="Enter the broadcast details..."
                                    required
                                ></textarea>
                            </div>
                            <button type="submit" className="w-full bg-maroon text-gold py-6 rounded-2xl font-black text-sm uppercase tracking-[0.3em] hover:bg-elite-maroon shadow-xl transition-all transform active:scale-95 border border-gold/20">
                                {editingAnnouncement ? 'Update Broadcast' : 'Execute Broadcast'}
                            </button>
                        </form>
                    </div >
                </div >
            )
            }
        </div >
    );
}
