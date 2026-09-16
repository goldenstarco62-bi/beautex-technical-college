import { useEffect, useState, useRef } from 'react';
import { materialsAPI, coursesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
    FileStack, Download, Plus, Trash2, Search, X,
    UploadCloud, Link, CheckCircle2, BookOpen
} from 'lucide-react';

const EMPTY_UPLOAD = { course_id: '', title: '', description: '', file: null, file_url: '', uploadMode: 'file', dept_filter: '' };

function fileIcon(name = '', mimeType = '') {
    if (mimeType) {
        if (mimeType === 'application/pdf') return { label: 'PDF', color: 'bg-red-100 text-red-600' };
        if (mimeType.includes('word')) return { label: 'DOC', color: 'bg-blue-100 text-blue-600' };
        if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return { label: 'XLS', color: 'bg-green-100 text-green-600' };
        if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return { label: 'PPT', color: 'bg-orange-100 text-orange-600' };
        if (mimeType.startsWith('image/')) return { label: 'IMG', color: 'bg-purple-100 text-purple-600' };
        if (mimeType.startsWith('video/')) return { label: 'VID', color: 'bg-pink-100 text-pink-600' };
        if (mimeType.startsWith('audio/')) return { label: 'AUD', color: 'bg-indigo-100 text-indigo-600' };
        if (mimeType.includes('zip')) return { label: 'ZIP', color: 'bg-yellow-100 text-yellow-700' };
        if (mimeType === 'text/plain') return { label: 'TXT', color: 'bg-gray-100 text-gray-600' };
    }
    const ext = name.split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) return { label: 'PDF', color: 'bg-red-100 text-red-600' };
    if (['doc', 'docx'].includes(ext)) return { label: 'DOC', color: 'bg-blue-100 text-blue-600' };
    if (['xls', 'xlsx'].includes(ext)) return { label: 'XLS', color: 'bg-green-100 text-green-600' };
    if (['ppt', 'pptx'].includes(ext)) return { label: 'PPT', color: 'bg-orange-100 text-orange-600' };
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return { label: 'IMG', color: 'bg-purple-100 text-purple-600' };
    if (['mp4', 'webm'].includes(ext)) return { label: 'VID', color: 'bg-pink-100 text-pink-600' };
    if (['zip'].includes(ext)) return { label: 'ZIP', color: 'bg-yellow-100 text-yellow-700' };
    return { label: ext.toUpperCase() || 'FILE', color: 'bg-gray-100 text-gray-600' };
}

function formatBytes(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MaterialCard({ m, user, downloadingId, onDownload, onDelete }) {
    const icon = fileIcon(m.file_name || m.file_url || m.title || '', m.mime_type || '');
    const isDownloading = downloadingId === (m.id || m._id);
    const canDelete = user?.role === 'admin' || user?.role === 'superadmin' || m.uploaded_by === user?.email;

    return (
        <div className="bg-white rounded-[1.75rem] border border-gray-100 shadow-lg overflow-hidden group hover:-translate-y-1 transition-all duration-300">
            <div className="h-0.5 bg-gradient-to-r from-maroon via-gold to-maroon opacity-40" />
            <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div className={`px-3 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-widest ${icon.color}`}>
                        {icon.label}
                    </div>
                    <span className="text-[9px] font-black px-2 py-1 bg-gray-50 text-gray-400 rounded-lg uppercase tracking-widest max-w-[130px] truncate">
                        {m.course_name || 'General'}
                    </span>
                </div>
                <h3 className="text-sm font-black text-gray-800 mb-1.5 line-clamp-2 leading-tight">{m.title}</h3>
                <p className="text-[11px] text-gray-400 font-medium line-clamp-2 mb-4 italic">
                    {m.description || 'Course resource. Click download to access.'}
                </p>
                <div className="flex items-center gap-2 pt-4 border-t border-gray-50">
                    <button
                        onClick={() => onDownload(m)}
                        disabled={isDownloading}
                        className="flex-1 bg-maroon text-gold h-9 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-maroon/90 transition-colors border border-gold/20 disabled:opacity-60"
                        title={m.file_name || 'Download'}
                    >
                        {isDownloading
                            ? <div className="w-3 h-3 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                            : <Download className="w-3 h-3" />}
                        {isDownloading ? 'Downloading…' : 'Download'}
                    </button>
                    {canDelete && (
                        <button
                            onClick={() => onDelete(m.id || m._id)}
                            className="w-9 h-9 bg-gray-50 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl flex items-center justify-center transition-colors border border-gray-100"
                            title="Delete resource"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>
            <div className="px-6 py-2.5 bg-gray-50/50 flex justify-between items-center text-[8px] font-black text-gray-300 uppercase tracking-widest border-t border-gray-50">
                <span>By: {m.uploaded_by || 'Unknown'}</span>
                <span>{m.created_at ? new Date(m.created_at).toLocaleDateString() : '—'}</span>
            </div>
        </div>
    );
}

export default function Materials() {
    const { user } = useAuth();
    const [materials, setMaterials] = useState([]);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [downloadingId, setDownloadingId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDept, setSelectedDept] = useState('ALL');
    const [selectedCourse, setSelectedCourse] = useState('ALL');
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadForm, setUploadForm] = useState(EMPTY_UPLOAD);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const [matRes, courseRes] = await Promise.all([
                materialsAPI.getAll().catch(() => ({ data: [] })),
                coursesAPI.getAll().catch(() => ({ data: [] })),
            ]);
            setMaterials(Array.isArray(matRes.data) ? matRes.data : []);
            setCourses(Array.isArray(courseRes.data) ? courseRes.data : []);
        } catch (err) {
            console.error('Error fetching materials:', err);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const handleFileSelected = (file) => {
        if (!file) return;
        if (file.size > 50 * 1024 * 1024) { alert('File is too large. Maximum size is 50 MB.'); return; }
        const autoTitle = uploadForm.title || file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
        setUploadForm(prev => ({ ...prev, file, title: autoTitle }));
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelected(file);
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!uploadForm.course_id) { alert('Please select a course.'); return; }
        if (!uploadForm.title.trim()) { alert('Please enter a resource title.'); return; }
        if (uploadForm.uploadMode === 'file' && !uploadForm.file) { alert('Please select a file to upload.'); return; }
        if (uploadForm.uploadMode === 'url' && !uploadForm.file_url.trim()) { alert('Please enter a file URL.'); return; }
        try {
            setUploading(true);
            setUploadProgress(0);
            const payload = {
                course_id: uploadForm.course_id,
                title: uploadForm.title,
                description: uploadForm.description,
                ...(uploadForm.uploadMode === 'file' ? { file: uploadForm.file } : { file_url: uploadForm.file_url })
            };
            let timer;
            if (uploadForm.uploadMode === 'file') {
                timer = setInterval(() => setUploadProgress(p => p < 90 ? p + 10 : p), 200);
            }
            await materialsAPI.upload(payload);
            if (timer) { clearInterval(timer); setUploadProgress(100); }
            setTimeout(() => {
                setShowUploadModal(false);
                setUploadForm(EMPTY_UPLOAD);
                setUploadProgress(0);
                fetchAll(true);
            }, 400);
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to upload resource. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this resource?')) return;
        try { await materialsAPI.delete(id); fetchAll(true); }
        catch { alert('Failed to delete material.'); }
    };

    const handleDownload = async (m) => {
        try {
            setDownloadingId(m.id || m._id);
            await materialsAPI.download(m.id || m._id, m.file_name || m.title);
        } catch { alert('Download failed. Please try again.'); }
        finally { setDownloadingId(null); }
    };

    // ── Derived ──────────────────────────────────────────────────────────────
    const allDeptNames = [...new Set(courses.map(c => c.department || 'General').filter(Boolean))].sort();

    const filteredMaterials = materials.filter(m => {
        const matchSearch = !searchQuery ||
            m.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.course_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.description?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchCourse = selectedCourse === 'ALL' || String(m.course_id) === String(selectedCourse);
        const matchDept = selectedDept === 'ALL' || (() => {
            const c = courses.find(c => String(c.id) === String(m.course_id));
            return (c?.department || 'General') === selectedDept;
        })();
        return matchSearch && matchCourse && matchDept;
    });

    const deptCourses = selectedDept === 'ALL'
        ? courses
        : courses.filter(c => (c.department || 'General') === selectedDept);

    const uploadModalCourses = uploadForm.dept_filter
        ? courses.filter(c => (c.department || 'General') === uploadForm.dept_filter)
        : courses;

    const canUpload = ['teacher', 'admin', 'superadmin'].includes(user?.role);

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon" />
        </div>
    );

    return (
        <div className="space-y-5 animate-in fade-in duration-700 pb-12">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <p className="text-[10px] font-black text-maroon/30 uppercase tracking-[0.3em] mb-1">Beautex Training Centre</p>
                    <h1 className="text-3xl font-black text-maroon uppercase tracking-tight">Study Material Hub</h1>
                    <div className="w-12 h-0.5 bg-gold mt-2" />
                    <p className="text-xs text-maroon/40 font-bold mt-1">Resource Repository &amp; Course Content</p>
                </div>
                {canUpload && (
                    <button
                        id="upload-resource-btn"
                        onClick={() => { setUploadForm(EMPTY_UPLOAD); setShowUploadModal(true); }}
                        className="bg-maroon text-gold px-5 py-3 rounded-2xl flex items-center gap-2 shadow-xl hover:bg-maroon/90 transition-all font-black text-[10px] uppercase tracking-widest border border-gold/20"
                    >
                        <Plus className="w-4 h-4" /> Upload Resource
                    </button>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Total Resources', value: materials.length },
                    { label: 'Departments', value: allDeptNames.length },
                    { label: 'Courses Covered', value: [...new Set(materials.map(m => m.course_id).filter(Boolean))].length },
                    { label: 'Showing', value: filteredMaterials.length },
                ].map((s, i) => (
                    <div key={i} className="bg-white border border-maroon/8 rounded-2xl p-4 shadow-sm text-center">
                        <p className="text-xl font-black text-maroon">{s.value}</p>
                        <p className="text-[9px] font-black text-maroon/30 uppercase tracking-widest mt-1">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm relative">
                <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <input
                    type="text"
                    placeholder="Search by title, course, or description..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-1.5 bg-gray-50/50 rounded-xl text-sm font-medium border-none outline-none focus:ring-2 focus:ring-maroon/10"
                />
            </div>

            {/* ── Tab panel ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

                {/* Row 1: Department tabs */}
                <div className="flex items-center overflow-x-auto border-b border-gray-100" style={{ scrollbarWidth: 'none' }}>
                    <button
                        onClick={() => { setSelectedDept('ALL'); setSelectedCourse('ALL'); }}
                        className={`relative shrink-0 px-5 py-3.5 text-[10px] font-black uppercase tracking-widest transition-colors whitespace-nowrap ${selectedDept === 'ALL' ? 'text-maroon' : 'text-gray-400 hover:text-maroon hover:bg-gray-50'}`}
                    >
                        All Departments
                        {selectedDept === 'ALL' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-maroon rounded-t-full" />}
                        <span className="ml-2 text-[8px] font-black px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-400">{materials.length}</span>
                    </button>

                    {allDeptNames.map(d => {
                        const count = materials.filter(m => {
                            const c = courses.find(c => String(c.id) === String(m.course_id));
                            return (c?.department || 'General') === d;
                        }).length;
                        const active = selectedDept === d;
                        return (
                            <button
                                key={d}
                                onClick={() => { setSelectedDept(d); setSelectedCourse('ALL'); }}
                                className={`relative shrink-0 px-5 py-3.5 text-[10px] font-black uppercase tracking-widest transition-colors whitespace-nowrap ${active ? 'text-maroon' : 'text-gray-400 hover:text-maroon hover:bg-gray-50'}`}
                            >
                                {d}
                                {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-maroon rounded-t-full" />}
                                <span className={`ml-2 text-[8px] font-black px-1.5 py-0.5 rounded-md ${active ? 'bg-maroon/10 text-maroon' : 'bg-gray-100 text-gray-400'}`}>{count}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Row 2: Course sub-tabs */}
                {deptCourses.length > 0 && (
                    <div className="flex items-center overflow-x-auto bg-gray-50/60 border-b border-gray-100" style={{ scrollbarWidth: 'none' }}>
                        <button
                            onClick={() => setSelectedCourse('ALL')}
                            className={`shrink-0 px-4 py-2.5 text-[9px] font-black uppercase tracking-widest transition-colors whitespace-nowrap flex items-center gap-1.5 ${selectedCourse === 'ALL' ? 'text-maroon' : 'text-gray-300 hover:text-maroon'}`}
                        >
                            <BookOpen className="w-3 h-3" />
                            All Courses
                        </button>
                        {deptCourses.map(c => {
                            const cnt = filteredMaterials.filter(m => String(m.course_id) === String(c.id)).length;
                            const active = String(selectedCourse) === String(c.id);
                            return (
                                <button
                                    key={c.id}
                                    onClick={() => setSelectedCourse(String(c.id))}
                                    className={`shrink-0 px-4 py-2.5 text-[9px] font-black uppercase tracking-widest transition-colors whitespace-nowrap flex items-center gap-1.5 ${active ? 'text-maroon' : 'text-gray-300 hover:text-maroon'}`}
                                >
                                    <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-gold' : 'bg-gray-200'}`} />
                                    {c.name}
                                    {cnt > 0 && (
                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${active ? 'bg-maroon/10 text-maroon' : 'bg-gray-100 text-gray-300'}`}>{cnt}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Materials grid */}
                <div className="p-5">
                    {filteredMaterials.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredMaterials.map(m => (
                                <MaterialCard
                                    key={m.id || m._id}
                                    m={m}
                                    user={user}
                                    downloadingId={downloadingId}
                                    onDownload={handleDownload}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="py-20 text-center">
                            <div className="flex flex-col items-center gap-4">
                                <FileStack className="w-14 h-14 text-maroon/10" />
                                <p className="text-sm font-black text-maroon/20 uppercase tracking-[0.3em]">
                                    {searchQuery || selectedCourse !== 'ALL' ? 'No resources match your filter' : 'No resources uploaded yet'}
                                </p>
                                {canUpload && !searchQuery && selectedCourse === 'ALL' && (
                                    <button
                                        onClick={() => { setUploadForm(EMPTY_UPLOAD); setShowUploadModal(true); }}
                                        className="text-xs font-black text-maroon underline uppercase tracking-widest"
                                    >
                                        Upload First Resource
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Upload Modal ── */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 z-50">
                    <div className="bg-white border border-maroon/10 rounded-[2.5rem] p-10 max-w-lg w-full shadow-2xl relative max-h-[90vh] flex flex-col">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-maroon via-gold to-maroon opacity-60 rounded-t-[2.5rem]" />

                        <div className="flex justify-between items-center mb-6 shrink-0">
                            <div>
                                <h2 className="text-2xl font-black text-maroon uppercase tracking-tight">Upload Resource</h2>
                                <div className="w-10 h-0.5 bg-gold mt-2" />
                                <p className="text-[10px] text-maroon/30 font-black uppercase tracking-widest mt-1">Study Material Repository</p>
                            </div>
                            <button onClick={() => setShowUploadModal(false)} className="p-2 hover:bg-maroon/5 rounded-full transition-colors">
                                <X className="w-6 h-6 text-maroon/30" />
                            </button>
                        </div>

                        <form onSubmit={handleUpload} className="space-y-5 overflow-y-auto flex-1 pr-1">
                            {/* Department filter */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Department</label>
                                <select
                                    value={uploadForm.dept_filter}
                                    onChange={e => setUploadForm({ ...uploadForm, dept_filter: e.target.value, course_id: '' })}
                                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10"
                                >
                                    <option value="">All Departments</option>
                                    {allDeptNames.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>

                            {/* Course */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Course *</label>
                                <select
                                    value={uploadForm.course_id}
                                    onChange={e => setUploadForm({ ...uploadForm, course_id: e.target.value })}
                                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10"
                                    required
                                >
                                    <option value="">Select Course</option>
                                    {uploadModalCourses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            {/* Title */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Resource Title *</label>
                                <input
                                    type="text"
                                    value={uploadForm.title}
                                    onChange={e => setUploadForm({ ...uploadForm, title: e.target.value })}
                                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold placeholder-maroon/20 outline-none focus:ring-2 focus:ring-maroon/10"
                                    placeholder="e.g. Hair Coloring Theory Notes"
                                    required
                                />
                            </div>

                            {/* Upload mode toggle */}
                            <div className="flex gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
                                {[{ mode: 'file', icon: <UploadCloud className="w-3.5 h-3.5" />, label: 'Upload File' },
                                  { mode: 'url', icon: <Link className="w-3.5 h-3.5" />, label: 'Paste URL' }]
                                .map(({ mode, icon, label }) => (
                                    <button
                                        key={mode}
                                        type="button"
                                        onClick={() => setUploadForm({ ...uploadForm, uploadMode: mode, file: mode === 'url' ? null : uploadForm.file, file_url: mode === 'file' ? '' : uploadForm.file_url })}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${uploadForm.uploadMode === mode ? 'bg-maroon text-gold shadow-lg border border-gold/20' : 'text-maroon/40 hover:text-maroon hover:bg-white'}`}
                                    >
                                        {icon} {label}
                                    </button>
                                ))}
                            </div>

                            {/* File drop zone */}
                            {uploadForm.uploadMode === 'file' && (
                                <div className="space-y-3">
                                    <div
                                        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                                        onDragLeave={() => setDragOver(false)}
                                        onDrop={handleDrop}
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`cursor-pointer border-2 border-dashed rounded-2xl p-8 text-center transition-all ${dragOver ? 'border-maroon bg-maroon/5 scale-[1.02]' : uploadForm.file ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-maroon/40 hover:bg-gray-50'}`}
                                    >
                                        {uploadForm.file ? (
                                            <div className="flex flex-col items-center gap-3">
                                                <CheckCircle2 className="w-8 h-8 text-green-500" />
                                                <p className="text-sm font-black text-maroon truncate max-w-[260px]">{uploadForm.file.name}</p>
                                                <p className="text-[10px] text-gray-400 font-bold">{formatBytes(uploadForm.file.size)} · Click to change</p>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-3">
                                                <UploadCloud className="w-10 h-10 text-maroon/20" />
                                                <p className="text-sm font-black text-maroon/60">Drag &amp; drop a file here</p>
                                                <p className="text-[10px] text-gray-400 font-bold mt-1">or click to browse · Max 50 MB</p>
                                                <p className="text-[9px] text-gray-300 uppercase tracking-widest">PDF · DOC · XLS · PPT · Images · Videos · ZIP</p>
                                            </div>
                                        )}
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        className="hidden"
                                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.mp3,.wav"
                                        onChange={e => handleFileSelected(e.target.files[0])}
                                    />
                                    {uploadForm.file && (
                                        <button type="button" onClick={() => setUploadForm({ ...uploadForm, file: null })} className="text-[10px] font-black text-red-400 hover:text-red-600 uppercase tracking-widest flex items-center gap-1">
                                            <X className="w-3 h-3" /> Remove file
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* URL input */}
                            {uploadForm.uploadMode === 'url' && (
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">File URL *</label>
                                    <input
                                        type="url"
                                        value={uploadForm.file_url}
                                        onChange={e => setUploadForm({ ...uploadForm, file_url: e.target.value })}
                                        className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold placeholder-maroon/20 outline-none focus:ring-2 focus:ring-maroon/10"
                                        placeholder="https://drive.google.com/file/..."
                                        required={uploadForm.uploadMode === 'url'}
                                    />
                                    <p className="text-[9px] text-maroon/30 ml-1 mt-1">Paste a Google Drive, Dropbox, or direct download link</p>
                                </div>
                            )}

                            {/* Description */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Description (optional)</label>
                                <textarea
                                    value={uploadForm.description}
                                    onChange={e => setUploadForm({ ...uploadForm, description: e.target.value })}
                                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold placeholder-maroon/20 outline-none focus:ring-2 focus:ring-maroon/10 h-20 resize-none"
                                    placeholder="What does this resource cover?"
                                />
                            </div>

                            {/* Progress */}
                            {uploading && uploadForm.uploadMode === 'file' && (
                                <div className="space-y-2">
                                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-maroon to-gold transition-all duration-300 rounded-full" style={{ width: `${uploadProgress}%` }} />
                                    </div>
                                    <p className="text-[10px] font-black text-maroon/40 uppercase tracking-widest text-center">Uploading... {uploadProgress}%</p>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={uploading}
                                className="w-full bg-maroon text-gold py-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-maroon/90 shadow-xl transition-all border border-gold/20 disabled:opacity-60 flex items-center justify-center gap-2"
                            >
                                {uploading
                                    ? <><div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" /> Uploading...</>
                                    : <><UploadCloud className="w-4 h-4" /> {uploadForm.uploadMode === 'file' ? 'Upload File' : 'Save Resource Link'}</>
                                }
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
