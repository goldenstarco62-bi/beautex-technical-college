import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { sessionsAPI } from '../services/api';
import { Calendar as CalendarIcon, Clock, MapPin, Plus, X, Trash2 } from 'lucide-react';

export default function Schedule() {
    const { user } = useAuth();
    const [view, setView] = useState('Weekly');
    const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    const [filteredClasses, setFilteredClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        day: 'Monday', time: '08:00', course: '', room: '', instructor: ''
    });

    const fetchSessions = async () => {
        try {
            setLoading(true);
            const response = await sessionsAPI.getAll();
            let allData = response.data;

            if (user?.role === 'teacher') {
                setFilteredClasses(allData.filter(c => c.teacher_email === user.email));
            } else if (user?.role === 'student') {
                // Students see all for demo, or filter by their specific course
                setFilteredClasses(allData.filter(c => c.course === (user.course || 'Cosmetology')));
            } else {
                setFilteredClasses(allData);
            }
        } catch (error) {
            console.error('Error fetching schedule:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, [user]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await sessionsAPI.create({
                ...formData,
                teacher_email: user?.role === 'teacher' ? user.email : 'staff@beautex.edu'
            });
            setShowModal(false);
            setFormData({ day: 'Monday', time: '08:00', course: '', room: '', instructor: '' });
            fetchSessions();
        } catch (error) {
            console.error('Error creating session:', error);
            alert('Failed to provision session. Please check backend.');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this session?')) return;
        try {
            await sessionsAPI.delete(id);
            fetchSessions();
        } catch (error) {
            console.error('Error deleting session:', error);
        }
    };

    const getClass = (day, time) => filteredClasses.find(c => c.day === day && c.time === time);

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-maroon border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-maroon animate-pulse">Syncing Registry...</p>
            </div>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-10 py-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-black text-white rounded-2xl shadow-xl">
                            <CalendarIcon className="w-6 h-6" />
                        </div>
                        <h1 className="text-4xl font-black text-black tracking-tight uppercase">Academic Schedule</h1>
                    </div>
                    <p className="text-xs text-black/40 font-bold tracking-[0.3em] uppercase pl-16">
                        Official Session Registry
                    </p>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-6 w-full md:w-auto">
                    <div className="bg-black/5 p-1.5 rounded-2xl border border-black/5 flex w-full md:w-auto">
                        {['Daily', 'Weekly', 'Monthly'].map(v => (
                            <button
                                key={v}
                                onClick={() => setView(v)}
                                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === v
                                    ? 'bg-white text-black shadow-lg scale-105'
                                    : 'text-black/40 hover:bg-black/5 hover:text-black'
                                    }`}
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                    {(user?.role === 'admin' || user?.role === 'superadmin') && (
                        <button
                            onClick={() => setShowModal(true)}
                            className="bg-black text-white px-8 py-4 rounded-2xl flex items-center gap-3 hover:bg-gray-800 transition-all shadow-2xl hover:scale-105 active:scale-95 font-black text-xs uppercase tracking-widest w-full md:w-auto whitespace-nowrap"
                        >
                            <Plus className="w-5 h-5" /> New Session
                        </button>
                    )}
                </div>
            </div>

            {/* Main Schedule Table */}
            <div className="table-container custom-scrollbar">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-black/5">
                            <th className="p-6 border-b border-r border-black/5 w-24 bg-black/10"></th>
                            {days.map(day => (
                                <th key={day} className="p-6 border-b border-r border-black/5 text-[10px] font-black text-black/40 uppercase tracking-[0.2em] last:border-r-0">
                                    {day}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                        {hours.map(hour => (
                            <tr key={hour}>
                                <td className="p-6 border-r border-black/5 text-center text-[10px] font-black text-black/20 uppercase tracking-widest bg-black/[0.02]">
                                    {hour}
                                </td>
                                {days.map((day, idx) => {
                                    const session = getClass(day, hour);
                                    return (
                                        <td key={day} className={`p-3 border-r border-black/5 min-w-[180px] last:border-r-0 ${idx % 2 === 0 ? 'bg-transparent' : 'bg-black/[0.01]'}`}>
                                            {session && (
                                                <div className="bg-white border-l-4 border-black p-5 rounded-2xl space-y-2 group hover:bg-black hover:text-white transition-all duration-300 cursor-pointer shadow-xl relative scale-in-center overflow-hidden">
                                                    <p className="text-[11px] font-black tracking-widest uppercase truncate relative z-10">
                                                        {session.course}
                                                    </p>
                                                    <div className="space-y-1 relative z-10">
                                                        <div className="flex items-center gap-2 text-[9px] font-bold opacity-60">
                                                            <MapPin className="w-3 h-3" /> {session.room}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[9px] font-bold opacity-60">
                                                            <Clock className="w-3 h-3" /> {session.instructor}
                                                        </div>
                                                    </div>
                                                    {(user?.role === 'admin' || user?.role === 'superadmin') && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(session.id); }}
                                                            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-2 hover:bg-red-600 rounded-lg transition-all z-20"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    )
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* New Session Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setShowModal(false)}></div>
                    <div className="relative bg-white w-full max-w-lg rounded-[3rem] shadow-2xl border border-black/5 p-10 animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-10">
                            <div>
                                <h2 className="text-3xl font-black text-black uppercase tracking-tight">Provision Session</h2>
                                <p className="text-[10px] text-black/40 font-bold uppercase tracking-[0.3em] mt-1 italic">Official Calendar Registry</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-3 bg-black/5 hover:bg-black hover:text-white rounded-2xl transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-black uppercase tracking-widest ml-1">Day of Week</label>
                                    <select
                                        value={formData.day}
                                        onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                                        className="w-full bg-black/5 border-none outline-none rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest text-black appearance-none focus:ring-2 ring-black/10 transition-all shadow-inner"
                                    >
                                        {days.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-black uppercase tracking-widest ml-1">Time Slot</label>
                                    <select
                                        value={formData.time}
                                        onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                        className="w-full bg-black/5 border-none outline-none rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest text-black appearance-none focus:ring-2 ring-black/10 transition-all shadow-inner"
                                    >
                                        {hours.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-black uppercase tracking-widest ml-1">Course Assignment</label>
                                <input
                                    type="text"
                                    value={formData.course}
                                    onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                                    className="w-full bg-black/5 border-none outline-none rounded-2xl px-6 py-4 text-xs font-black text-black placeholder:text-black/10 focus:ring-2 ring-black/10 transition-all uppercase tracking-widest shadow-inner"
                                    placeholder="e.g. Cosmetology II"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-black uppercase tracking-widest ml-1">Room / Lab</label>
                                    <input
                                        type="text"
                                        value={formData.room}
                                        onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                                        className="w-full bg-black/5 border-none outline-none rounded-2xl px-6 py-4 text-xs font-black text-black placeholder:text-black/10 focus:ring-2 ring-black/10 transition-all uppercase tracking-widest shadow-inner"
                                        placeholder="Room 101"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-black uppercase tracking-widest ml-1">Lead Instructor</label>
                                    <input
                                        type="text"
                                        value={formData.instructor}
                                        onChange={(e) => setFormData({ ...formData, instructor: e.target.value })}
                                        className="w-full bg-black/5 border-none outline-none rounded-2xl px-6 py-4 text-xs font-black text-black placeholder:text-black/10 focus:ring-2 ring-black/10 transition-all uppercase tracking-widest shadow-inner"
                                        placeholder="Instructor Name"
                                        required
                                    />
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-black text-white py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all mt-4">
                                Provision Session
                            </button>
                        </form>
                    </div>
                </div>
            )
            }
        </div >
    );
}
