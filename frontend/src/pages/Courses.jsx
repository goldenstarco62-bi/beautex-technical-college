import { useEffect, useState } from 'react';
import { coursesAPI, studentsAPI, facultyAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Plus, BookOpen, Edit, Monitor, ShieldAlert, Trash2, X, MessageSquare } from 'lucide-react';
import Interactions from '../components/shared/Interactions';

export default function Courses() {
    const { user } = useAuth();
    const [courses, setCourses] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingCourse, setEditingCourse] = useState(null);
    const [formData, setFormData] = useState({
        id: '', name: '', department: '', instructor: '', duration: '', capacity: 30, room: '', schedule: '', status: 'Active',
        programme_type: 'Short Course', parent_id: '', stream_ids: []
    });
    const [discussionEntity, setDiscussionEntity] = useState(null);
    const [availableFaculty, setAvailableFaculty] = useState([]);
    const [newStreamDraft, setNewStreamDraft] = useState({ id: '', name: '' });
    const [pendingStreams, setPendingStreams] = useState([]);

    const isStudent = user?.role === 'student';
    const departments = ['Cosmetology', 'Beauty Therapy', 'Hairdressing', 'Catering', 'IT & Computer Science', 'Business', 'Production Unit'];

    useEffect(() => {
        fetchCourses();
        fetchFaculty();
    }, [user]);

    const fetchFaculty = async () => {
        try {
            const { data } = await facultyAPI.getAll();
            setAvailableFaculty(data || []);
        } catch (error) {
            console.error('Error fetching faculty:', error);
        }
    };

    const fetchCourses = async () => {
        try {
            const { data } = await coursesAPI.getAll();

            if (isStudent) {
                // Backend now filters courses for students, but we'll double check profile 
                // ONLY if the backend returned more than expected or if we need specific profile data.
                // For now, trusting the backend is safer as it handles complex course name formats.
                if (data.length > 0) {
                    setCourses(data);
                } else {
                    // Fallback: Check if student has courses listed in profile that backend might have missed
                    const userEmail = String(user?.email || '').toLowerCase().trim();
                    const userSid = String(user?.student_id || user?.id || '').toLowerCase().trim();

                    const studentsRes = await studentsAPI.getAll();
                    const studentProfile = studentsRes.data.find(s =>
                        String(s.email || '').toLowerCase().trim() === userEmail ||
                        String(s.id || '').toLowerCase().trim() === userSid
                    ) || studentsRes.data[0];

                    if (studentProfile && studentProfile.course) {
                        const studentCourses = Array.isArray(studentProfile.course) ? studentProfile.course : [studentProfile.course].filter(Boolean);
                        const enrolledCourses = data.filter(c =>
                            studentCourses.some(scName => scName && scName.toLowerCase().trim() === c.name.toLowerCase().trim())
                        );
                        setCourses(enrolledCourses);
                    } else {
                        setCourses([]);
                    }
                }
            } else {
                // Admin/Teacher sees all
                setCourses(data);
            }
        } catch (error) {
            console.error('Error fetching courses:', error);
        }
    };

    const addPendingStream = () => {
        const name = newStreamDraft.name.trim();
        const code = newStreamDraft.id.trim();
        if (!name) return;
        const id = code || `CRS-${Date.now().toString().slice(-6)}`;
        if (pendingStreams.some(p => p.id === id) || courses.some(c => c.id === id)) return;
        setPendingStreams(prev => [...prev, { id, name }]);
        // Auto-select the freshly drafted discipline as a stream of this diploma.
        setFormData(prev => ({ ...prev, stream_ids: [...(prev.stream_ids || []), id] }));
        setNewStreamDraft({ id: '', name: '' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Materialise any newly drafted disciplines as Diploma courses first, so their
            // real ids can be attached as streams of this diploma.
            const createdIds = [];
            for (const ns of pendingStreams) {
                await coursesAPI.create({
                    id: ns.id, name: ns.name, programme_type: 'Diploma',
                    department: formData.department || '', duration: formData.duration || '',
                    capacity: formData.capacity || 30, status: 'Active'
                });
                createdIds.push(ns.id);
            }
            const finalStreamIds = [...new Set([...(formData.stream_ids || []), ...createdIds])];
            const payload = { ...formData, stream_ids: finalStreamIds };

            if (editingCourse) {
                await coursesAPI.update(editingCourse.id, payload);
            } else {
                const newId = formData.id || `CRS-${Date.now().toString().slice(-6)}`;
                await coursesAPI.create({ ...payload, id: newId });
            }
            setShowModal(false);
            fetchCourses();
            resetForm();
        } catch (error) {
            console.error('Error saving course:', error);
        }
    };

    const handleEdit = (course) => {
        setEditingCourse(course);
        setFormData({
            ...course,
            programme_type: course.programme_type || 'Short Course',
            parent_id: course.parent_id || '',
            stream_ids: Array.isArray(course.streams) ? course.streams.map(s => s.course_id) : (course.stream_ids || [])
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this course?')) {
            try {
                await coursesAPI.delete(id);
                fetchCourses();
            } catch (error) {
                console.error('Error deleting course:', error);
            }
        }
    };

    const resetForm = () => {
        setFormData({
            id: '', name: '', department: '', instructor: '', duration: '', capacity: 30, room: '', schedule: '', status: 'Active',
            programme_type: 'Short Course', parent_id: '', stream_ids: []
        });
        setEditingCourse(null);
        setNewStreamDraft({ id: '', name: '' });
        setPendingStreams([]);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-maroon tracking-tight uppercase">Courses</h1>
                    <p className="text-xs text-maroon/40 font-bold tracking-widest mt-1">Academic Programs & Curriculum</p>
                </div>
                {(user?.role === 'admin' || user?.role === 'superadmin') && (
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                        <a
                            href="/units"
                            className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-maroon px-5 py-3 rounded-2xl flex items-center justify-center gap-2 transition-all font-black text-xs uppercase tracking-widest border border-maroon/10"
                        >
                            <BookOpen className="w-4 h-4 text-maroon" /> Manage Units
                        </a>
                        <button
                            onClick={() => { resetForm(); setShowModal(true); }}
                            className="w-full sm:w-auto bg-maroon text-gold px-6 py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-elite-maroon shadow-lg transition-all border border-gold/20 font-black text-xs uppercase tracking-widest"
                        >
                            <Plus className="w-5 h-5" /> Add New Course
                        </button>
                    </div>
                )}
            </div>

            {/* Courses Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card-light p-6 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-maroon/40 uppercase tracking-widest">Active Programs</p>
                        <p className="text-2xl font-black text-maroon">{courses.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-maroon/5 rounded-2xl flex items-center justify-center">
                        <BookOpen className="w-6 h-6 text-maroon" />
                    </div>
                </div>
            </div>

            {/* Courses Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
                {courses.length > 0 ? (
                    courses.map((course) => (
                        <div key={course.id} className="card-light p-4 sm:p-8 hover:shadow-2xl hover:scale-[1.02] transition-all group border-b-4 border-b-maroon/10 hover:border-b-gold">
                            <div className="flex justify-between items-start mb-4 sm:mb-6">
                                <div className={`p-3 sm:p-4 rounded-2xl bg-maroon/5 group-hover:bg-maroon transition-colors`}>
                                    <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-maroon group-hover:text-gold transition-colors" />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setDiscussionEntity({
                                            type: 'course',
                                            id: course.id || course._id,
                                            title: `${course.name} - Discussion`
                                        })}
                                        className="p-2 bg-maroon/5 hover:bg-maroon hover:text-gold rounded-lg text-maroon transition-all"
                                        title="Join Discussion"
                                    >
                                        <MessageSquare className="w-4 h-4" />
                                    </button>
                                    {!isStudent && (
                                        <>
                                            <button onClick={() => handleEdit(course)} className="p-2 hover:bg-parchment-100 rounded-lg text-maroon/20 hover:text-maroon transition-all">
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(course.id)} className="p-2 hover:bg-red-50 rounded-lg text-maroon/10 hover:text-red-600 transition-all">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <h3 className="text-lg sm:text-xl font-black text-maroon tracking-tight mb-1 sm:mb-2 uppercase">{course.name}</h3>
                            <div className="flex flex-wrap items-center gap-2 mb-4 sm:mb-6">
                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${course.programme_type === 'Diploma' ? 'bg-maroon text-gold' : 'bg-gold/20 text-maroon'}`}>
                                    {course.programme_type || 'Short Course'}
                                </span>
                                {course.parent_name && (
                                    <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-slate-100 text-maroon/60">· {course.parent_name}</span>
                                )}
                                <span className="text-xs font-black text-maroon/40 uppercase tracking-widest">{course.department}</span>
                            </div>
                            {course.programme_type === 'Diploma' && course.streams?.length > 0 && (
                                <p className="text-[10px] font-bold text-maroon/50 -mt-3 mb-4 uppercase tracking-wide">Streams: {course.streams.map(s => s.name).join(' · ')}</p>
                            )}

                            <div className="mt-4 flex flex-col gap-2">
                                <div className="flex items-center gap-2 text-[10px] text-maroon/40 font-bold uppercase tracking-widest">
                                    <Monitor className="w-3 h-3" />
                                    <span>Room: {course.room || 'Hall A'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-maroon/40 font-bold uppercase tracking-widest">
                                    <ShieldAlert className="w-3 h-3" />
                                    <span>{course.schedule || 'Mon - Fri, 8:00 AM'}</span>
                                </div>
                            </div>

                            <div className="space-y-2 mt-4 sm:mt-6">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                    <span className="text-maroon/40">Enrollment</span>
                                    <span className="text-maroon">
                                        {course.enrolled || 0} / {course.capacity} Students
                                    </span>
                                </div>
                                <div className="w-full bg-parchment-200 h-2 rounded-full overflow-hidden">
                                    <div
                                        className="bg-maroon h-full rounded-full transition-all duration-1000"
                                        style={{ width: `${((course.enrolled || 0) / (course.capacity || 1)) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full text-center py-12 text-maroon/40 font-bold">
                        {isStudent ? 'You are not enrolled in any courses yet.' : 'No courses available.'}
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && !isStudent && (
                <div className="fixed inset-0 bg-maroon/40 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50">
                    <div className="bg-white rounded-2xl sm:rounded-[2rem] p-5 sm:p-10 max-w-md w-full shadow-2xl border border-maroon/10 max-h-[95vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6 shrink-0">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-black text-maroon uppercase tracking-tight">
                                    {editingCourse ? 'Update Curriculum' : 'Add New Program'}
                                </h2>
                                <p className="text-xs text-maroon/40 font-bold mt-1 uppercase tracking-widest">Academic Program Registry</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-parchment-100 rounded-full transition-colors">
                                <X className="w-6 h-6 text-maroon/20" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto pr-1 custom-scrollbar flex-1">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Course Code / ID</label>
                                <input
                                    type="text"
                                    value={formData.id}
                                    onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-maroon font-bold placeholder-maroon/20 outline-none focus:ring-2 focus:ring-maroon/5"
                                    placeholder="e.g. COS101"
                                    required={!editingCourse}
                                    disabled={!!editingCourse}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Course Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-maroon font-bold placeholder-maroon/20 outline-none focus:ring-2 focus:ring-maroon/5"
                                    placeholder="e.g. Cyber Security"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Programme Type</label>
                                    <select
                                        value={formData.programme_type}
                                        onChange={(e) => setFormData({ ...formData, programme_type: e.target.value, parent_id: '', stream_ids: [] })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/5"
                                    >
                                        <option value="Diploma">Diploma</option>
                                        <option value="Short Course">Short Course</option>
                                    </select>
                                </div>
                                {formData.programme_type === 'Short Course' && (
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Discipline</label>
                                        <select
                                            value={formData.parent_id}
                                            onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/5"
                                        >
                                            <option value="">Select discipline…</option>
                                            {courses.filter(c => c.programme_type === 'Diploma').map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                            {formData.programme_type === 'Diploma' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Streams (disciplines covered by this diploma)</label>
                                    <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100 max-h-40 overflow-y-auto custom-scrollbar">
                                        {courses.filter(c => c.programme_type === 'Diploma' && c.id !== formData.id).map(c => {
                                            const sel = Array.isArray(formData.stream_ids) && formData.stream_ids.includes(c.id);
                                            return (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, stream_ids: sel ? formData.stream_ids.filter(x => x !== c.id) : [...(formData.stream_ids || []), c.id] })}
                                                    className={`text-left px-3 py-2 rounded-lg text-[10px] font-bold transition-all border ${sel ? 'bg-maroon text-gold border-maroon' : 'bg-white text-gray-600 border-slate-100 hover:border-maroon/30'}`}
                                                >
                                                    {c.name}
                                                </button>
                                            );
                                        })}
                                        {pendingStreams.map(ns => {
                                            const sel = Array.isArray(formData.stream_ids) && formData.stream_ids.includes(ns.id);
                                            return (
                                                <div key={ns.id} className="relative">
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, stream_ids: sel ? formData.stream_ids.filter(x => x !== ns.id) : [...(formData.stream_ids || []), ns.id] })}
                                                        className={`w-full text-left px-3 py-2 pr-7 rounded-lg text-[10px] font-bold transition-all border ${sel ? 'bg-maroon text-gold border-maroon' : 'bg-white text-gray-600 border-slate-100 hover:border-maroon/30'}`}
                                                    >
                                                        {ns.name} <span className="opacity-70">· new</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setPendingStreams(prev => prev.filter(p => p.id !== ns.id));
                                                            setFormData({ ...formData, stream_ids: (formData.stream_ids || []).filter(x => x !== ns.id) });
                                                        }}
                                                        className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center rounded-full text-[10px] font-black text-maroon/40 hover:text-red-600"
                                                        title="Remove new discipline"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="grid grid-cols-[1fr_2fr_auto] gap-2 items-end">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-maroon/40 uppercase tracking-widest ml-1">New code</label>
                                            <input
                                                type="text"
                                                value={newStreamDraft.id}
                                                onChange={(e) => setNewStreamDraft({ ...newStreamDraft, id: e.target.value })}
                                                placeholder="auto"
                                                className="w-full px-3 py-2.5 bg-white border border-slate-100 rounded-xl text-maroon font-bold text-[11px] placeholder-maroon/20 outline-none focus:ring-2 focus:ring-maroon/5"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-maroon/40 uppercase tracking-widest ml-1">New diploma / discipline</label>
                                            <input
                                                type="text"
                                                value={newStreamDraft.name}
                                                onChange={(e) => setNewStreamDraft({ ...newStreamDraft, name: e.target.value })}
                                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPendingStream(); } }}
                                                placeholder="e.g. Diploma in Nail Technology"
                                                className="w-full px-3 py-2.5 bg-white border border-slate-100 rounded-xl text-maroon font-bold text-[11px] placeholder-maroon/20 outline-none focus:ring-2 focus:ring-maroon/5"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={addPendingStream}
                                            disabled={!newStreamDraft.name.trim()}
                                            className="px-4 py-2.5 mb-0 rounded-xl bg-maroon text-gold text-[10px] font-black uppercase tracking-widest hover:bg-elite-maroon transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            + Add
                                        </button>
                                    </div>
                                    <p className="text-[9px] font-bold text-black/40 ml-1">New disciplines are saved as standalone Diplomas and attached here.</p>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Duration</label>
                                    <input
                                        type="text"
                                        value={formData.duration}
                                        onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-maroon font-bold placeholder-maroon/20 outline-none focus:ring-2 focus:ring-maroon/5"
                                        placeholder="6 Months"
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Capacity</label>
                                    <input
                                        type="number"
                                        value={formData.capacity}
                                        onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-maroon font-bold placeholder-maroon/20 outline-none focus:ring-2 focus:ring-maroon/5"
                                        placeholder="30"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Room / Lab</label>
                                    <input
                                        type="text"
                                        value={formData.room}
                                        onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-maroon font-bold placeholder-maroon/20 outline-none focus:ring-2 focus:ring-maroon/5"
                                        placeholder="Room 101"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/5"
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Schedule</label>
                                <input
                                    type="text"
                                    value={formData.schedule}
                                    onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-maroon font-bold placeholder-maroon/20 outline-none focus:ring-2 focus:ring-maroon/5"
                                    placeholder="Mon, Wed, Fri 9:00-11:00 AM"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Instructor</label>
                                <select
                                    value={formData.instructor}
                                    onChange={(e) => setFormData({ ...formData, instructor: e.target.value })}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/5"
                                    required
                                >
                                    <option value="">Select Instructor</option>
                                    {availableFaculty.map(f => <option key={f.id || f._id} value={f.name}>{f.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Department</label>
                                <select
                                    value={formData.department}
                                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/5"
                                    required
                                >
                                    <option value="">Select Department</option>
                                    {departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                                </select>
                            </div>
                            <button type="submit" className="w-full bg-maroon text-gold py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-elite-maroon shadow-xl transition-all mt-4 border border-gold/20">
                                {editingCourse ? 'Synchronize Curriculum' : 'Release Program'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Discourse Panel */}
            {discussionEntity && (
                <div className="fixed inset-0 z-[120] flex items-center justify-end">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-500" onClick={() => setDiscussionEntity(null)}></div>
                    <div className="relative w-full max-w-xl h-full bg-white shadow-2xl animate-in slide-in-from-right duration-500 overflow-y-auto p-4 sm:p-12 custom-scrollbar">
                        <div className="flex justify-between items-start mb-6 sm:mb-8">
                            <div>
                                <h2 className="text-xl sm:text-3xl font-black text-maroon uppercase tracking-tight leading-none">{discussionEntity.title}</h2>
                                <p className="text-[9px] sm:text-[10px] text-maroon/40 font-bold uppercase tracking-[0.3em] mt-2 sm:mt-3 italic">Curriculum Discourse Module</p>
                            </div>
                            <button onClick={() => setDiscussionEntity(null)} className="p-2 sm:p-3 bg-gray-50 hover:bg-black hover:text-white rounded-xl sm:rounded-2xl transition-all shadow-sm">
                                <X className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                        </div>

                        <Interactions entityType={discussionEntity.type} entityId={discussionEntity.id} />
                    </div>
                </div>
            )}
        </div>
    );
}
