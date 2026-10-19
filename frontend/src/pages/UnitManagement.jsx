import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { masterUnitsAPI, coursesAPI, facultyAPI, trainerUnitsAPI, unitOfferingsAPI, studentsAPI } from '../services/api';
import {
    Plus, Edit2, Trash2, Search, BookOpen, CheckCircle2,
    XCircle, AlertCircle, X, Layers, Link2, Unlink,
    ChevronDown, ChevronUp, ToggleLeft, ToggleRight, RefreshCw,
    BookMarked, Save, Filter, LayoutGrid, ListFilter, FolderOpen, Folder,
    Building2, Award, UserCheck, Users, GraduationCap, UserX, Globe
} from 'lucide-react';

// ─── Utility ─────────────────────────────────────────────────────────────────
function Badge({ status }) {
    const isActive = status === 'Active';
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            background: isActive ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.10)',
            color: isActive ? '#16a34a' : '#dc2626',
            border: `1px solid ${isActive ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.20)'}`,
        }}>
            {isActive ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
            {status}
        </span>
    );
}

function Toast({ message, type = 'success', onClose }) {
    useEffect(() => {
        const t = setTimeout(onClose, 4000);
        return () => clearTimeout(t);
    }, [onClose]);

    const colors = {
        success: { bg: '#d1fae5', border: '#a7f3d0', text: '#065f46', icon: <CheckCircle2 size={16} /> },
        error: { bg: '#fee2e2', border: '#fecaca', text: '#991b1b', icon: <AlertCircle size={16} /> },
        info: { bg: '#dbeafe', border: '#bfdbfe', text: '#1e40af', icon: <AlertCircle size={16} /> },
    };
    const c = colors[type] || colors.info;
    return (
        <div style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
            display: 'flex', alignItems: 'center', gap: 10,
            background: c.bg, border: `1px solid ${c.border}`, color: c.text,
            borderRadius: 12, padding: '12px 16px', fontWeight: 600, fontSize: 14,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            animation: 'slideUp 0.3s ease-out',
        }}>
            {c.icon}
            {message}
            <button onClick={onClose} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: c.text }}>
                <X size={14} />
            </button>
        </div>
    );
}

// ─── Unit Form Modal ──────────────────────────────────────────────────────────
function UnitFormModal({ unit, onClose, onSave }) {
    const [form, setForm] = useState({
        name: unit?.name || unit?.unit_name || '',
        code: unit?.code || unit?.unit_code || '',
        description: unit?.description || '',
        status: unit?.status || 'Active',
        is_common: !!unit?.is_common,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const isEdit = !!unit;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) { setError('Unit name is required'); return; }
        setLoading(true);
        setError('');
        try {
            if (isEdit) {
                const res = await masterUnitsAPI.update(unit.id, form);
                onSave(res.data, 'updated');
            } else {
                const res = await masterUnitsAPI.create(form);
                onSave(res.data, 'created');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save unit');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
            <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 500, boxShadow: '0 32px 80px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
                <div style={{ background: 'linear-gradient(135deg, #800000, #a00000)', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <BookMarked size={20} color="#FFD700" />
                        <span style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>{isEdit ? 'Edit Unit' : 'Add New Unit'}</span>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, padding: '6px 8px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center' }}>
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: 24 }}>
                    {error && (
                        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, color: '#991b1b', fontSize: 13 }}>
                            <AlertCircle size={14} /> {error}
                        </div>
                    )}

                    <div style={{ display: 'grid', gap: 16 }}>
                        <div>
                            <label style={labelStyle}>Unit Name *</label>
                            <input
                                autoFocus
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. Communication Skills"
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Unit Code</label>
                            <input
                                value={form.code}
                                onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                                placeholder="e.g. COM001"
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Description</label>
                            <textarea
                                value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="Brief description of the unit..."
                                rows={3}
                                style={{ ...inputStyle, resize: 'vertical' }}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Status</label>
                            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', background: form.is_common ? '#f0fdf4' : '#f8fafc', border: `1px solid ${form.is_common ? '#bbf7d0' : '#e2e8f0'}`, borderRadius: 12, padding: '12px 14px' }}>
                            <input
                                type="checkbox"
                                checked={form.is_common}
                                onChange={e => setForm(f => ({ ...f, is_common: e.target.checked }))}
                                style={{ marginTop: 3, accentColor: '#800000' }}
                            />
                            <span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Common unit (shared across courses)</span>
                                <span style={{ display: 'block', fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                    Its offerings appear in the Common Units folder instead of one course folder.
                                </span>
                            </span>
                        </label>
                    </div>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                        <button type="button" onClick={onClose} style={btnSecondary}>Cancel</button>
                        <button type="submit" disabled={loading} style={btnPrimary}>
                            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                            {loading ? 'Saving…' : (isEdit ? 'Update Unit' : 'Create Unit')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Course Assignment Modal (from Unit perspective) ─────────────────────────
function AssignCoursesModal({ unit, allCourses, onClose, onDone }) {
    const [assigned, setAssigned] = useState(
        new Set((unit.assigned_courses || []).map(c => String(c.course_id)))
    );
    const [search, setSearch] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const filtered = allCourses.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase())
    );

    const toggle = (courseId) => {
        setAssigned(prev => {
            const next = new Set(prev);
            if (next.has(String(courseId))) next.delete(String(courseId));
            else next.add(String(courseId));
            return next;
        });
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            const currentSet = new Set((unit.assigned_courses || []).map(c => String(c.course_id)));
            const toAdd = [...assigned].filter(id => !currentSet.has(id));
            const toRemove = [...currentSet].filter(id => !assigned.has(id));

            for (const courseId of toAdd) {
                try { await masterUnitsAPI.assignToCourse(unit.id, courseId); } catch (_) { }
            }
            for (const courseId of toRemove) {
                try { await masterUnitsAPI.removeFromCourse(unit.id, courseId); } catch (_) { }
            }

            onDone();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update assignments');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
            <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
                <div style={{ background: 'linear-gradient(135deg, #1a3a5c, #2a5298)', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Link2 size={18} color="#60a5fa" />
                            <span style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>Assign Unit to Courses</span>
                        </div>
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>{unit.name || unit.unit_name}</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, padding: '6px 8px', cursor: 'pointer', color: '#fff' }}>
                        <X size={16} />
                    </button>
                </div>

                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            autoFocus
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search courses..."
                            style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px 8px 32px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                        />
                    </div>
                    <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>{assigned.size} course(s) selected</p>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
                    {error && <div style={{ color: '#dc2626', fontSize: 12, margin: '8px 0', padding: '8px 12px', background: '#fee2e2', borderRadius: 8 }}>{error}</div>}
                    {filtered.length === 0 && <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 20 }}>No courses found</p>}
                    {filtered.map(course => {
                        const isSelected = assigned.has(String(course.id));
                        return (
                            <button
                                key={course.id}
                                onClick={() => toggle(course.id)}
                                style={{
                                    width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '10px 12px', marginBottom: 4, borderRadius: 10, border: 'none', cursor: 'pointer',
                                    background: isSelected ? 'rgba(59,130,246,0.08)' : '#fff',
                                    outline: isSelected ? '2px solid rgba(59,130,246,0.4)' : '1px solid #e2e8f0',
                                    transition: 'all 0.15s',
                                }}
                            >
                                <div style={{
                                    width: 18, height: 18, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: isSelected ? '#3b82f6' : '#e2e8f0', flexShrink: 0, transition: 'all 0.15s',
                                }}>
                                    {isSelected && <CheckCircle2 size={12} color="#fff" />}
                                </div>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{course.name}</div>
                                    {course.department && <div style={{ fontSize: 11, color: '#94a3b8' }}>{course.department}</div>}
                                </div>
                            </button>
                        );
                    })}
                </div>

                <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
                    <button onClick={onClose} style={btnSecondary}>Cancel</button>
                    <button onClick={handleSave} disabled={saving} style={btnPrimary}>
                        {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                        {saving ? 'Saving…' : 'Save Course Assignments'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Attach Units to Course Modal (from Course perspective) ─────────────────
function QuickAttachUnitsModal({ course, allUnits, onClose, onDone }) {
    // Find units currently attached to this course
    const initiallyAttached = useMemo(() => {
        const set = new Set();
        allUnits.forEach(u => {
            if ((u.assigned_courses || []).some(ac => String(ac.course_id) === String(course.id))) {
                set.add(String(u.id));
            }
        });
        return set;
    }, [allUnits, course]);

    const [selectedUnits, setSelectedUnits] = useState(initiallyAttached);
    const [search, setSearch] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const filtered = allUnits.filter(u => {
        const uName = String(u.name || u.unit_name || '').toLowerCase();
        const uCode = String(u.code || u.unit_code || '').toLowerCase();
        return uName.includes(search.toLowerCase()) || uCode.includes(search.toLowerCase());
    });

    const toggle = (unitId) => {
        setSelectedUnits(prev => {
            const next = new Set(prev);
            if (next.has(String(unitId))) next.delete(String(unitId));
            else next.add(String(unitId));
            return next;
        });
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            const toAdd = [...selectedUnits].filter(id => !initiallyAttached.has(id));
            const toRemove = [...initiallyAttached].filter(id => !selectedUnits.has(id));

            for (const unitId of toAdd) {
                try { await masterUnitsAPI.assignToCourse(unitId, course.id); } catch (_) { }
            }
            for (const unitId of toRemove) {
                try { await masterUnitsAPI.removeFromCourse(unitId, course.id); } catch (_) { }
            }

            onDone();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update course units');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
            <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 520, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
                <div style={{ background: 'linear-gradient(135deg, #800000, #a00000)', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <BookOpen size={18} color="#FFD700" />
                            <span style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>Manage Units for {course.name}</span>
                        </div>
                        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>
                            {course.department || 'Academic Course'}
                        </p>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, padding: '6px 8px', cursor: 'pointer', color: '#fff' }}>
                        <X size={16} />
                    </button>
                </div>

                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            autoFocus
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search master unit library by name or code..."
                            style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px 8px 32px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                        />
                    </div>
                    <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>{selectedUnits.size} unit(s) attached to {course.name}</p>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px' }}>
                    {error && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8, padding: '8px 12px', background: '#fee2e2', borderRadius: 8 }}>{error}</div>}
                    {filtered.length === 0 && <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 20 }}>No units found</p>}
                    {filtered.map(unit => {
                        const isSelected = selectedUnits.has(String(unit.id));
                        return (
                            <div
                                key={unit.id}
                                onClick={() => toggle(unit.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '10px 12px', marginBottom: 6, borderRadius: 10, cursor: 'pointer',
                                    background: isSelected ? 'rgba(128,0,0,0.04)' : '#fff',
                                    border: isSelected ? '1.5px solid rgba(128,0,0,0.4)' : '1px solid #e2e8f0',
                                    transition: 'all 0.15s',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{
                                        width: 20, height: 20, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: isSelected ? '#800000' : '#e2e8f0', flexShrink: 0, transition: 'all 0.15s',
                                    }}>
                                        {isSelected && <CheckCircle2 size={13} color="#FFD700" />}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{unit.name || unit.unit_name}</div>
                                        <div style={{ fontSize: 11, color: '#64748b' }}>
                                            {(unit.code || unit.unit_code) ? <span style={{ fontFamily: 'monospace', fontWeight: 700, background: '#f1f5f9', padding: '1px 5px', borderRadius: 4, marginRight: 6 }}>{unit.code || unit.unit_code}</span> : null}
                                            {unit.status}
                                        </div>
                                    </div>
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 600, color: isSelected ? '#800000' : '#94a3b8' }}>
                                    {isSelected ? 'Attached' : 'Click to attach'}
                                </span>
                            </div>
                        );
                    })}
                </div>

                <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
                    <button onClick={onClose} style={btnSecondary}>Cancel</button>
                    <button onClick={handleSave} disabled={saving} style={btnPrimary}>
                        {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                        {saving ? 'Saving…' : 'Save Course Units'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Assign Teacher to Unit Modal ────────────────────────────────────────────
function AssignTeacherModal({ unit, course, allFaculty, onClose, onDone }) {
    const currentTrainer = (unit.assigned_courses || []).find(
        ac => String(ac.course_id) === String(course?.id)
    );
    const [selectedFacultyId, setSelectedFacultyId] = useState(
        currentTrainer?.faculty_id ? String(currentTrainer.faculty_id) : ''
    );
    const [search, setSearch] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const filtered = allFaculty.filter(f => {
        const q = search.toLowerCase();
        return !q || f.name.toLowerCase().includes(q) || (f.department || '').toLowerCase().includes(q);
    });

    const handleSave = async () => {
        if (!course) return;
        setSaving(true);
        setError('');
        try {
            // Replace assignments for THIS unit+course only (bulk-set would wipe the
            // lecturer's other units in the course, and faculty IDs are strings).
            const existing = await trainerUnitsAPI.getAssignments({
                unit_id: unit.id, course_id: course.id
            });
            const rows = existing.data || [];
            const keep = selectedFacultyId
                ? rows.find(a => String(a.faculty_id) === selectedFacultyId)
                : null;
            for (const a of rows) {
                if (!keep || a.id !== keep.id) {
                    await trainerUnitsAPI.deleteAssignment(a.id);
                }
            }
            if (selectedFacultyId && !keep) {
                await trainerUnitsAPI.createAssignment({
                    faculty_id: selectedFacultyId,
                    unit_id: unit.id,
                    course_id: course.id
                });
            }
            onDone();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to assign teacher');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
            <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 500, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
                <div style={{ background: 'linear-gradient(135deg, #1e3a5f, #2563eb)', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <UserCheck size={18} color="#93c5fd" />
                            <span style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>Assign Lecturer to Unit</span>
                        </div>
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 }}>
                            {unit.name || unit.unit_name}
                            {course && <span style={{ marginLeft: 6, opacity: 0.5 }}>· {course.name}</span>}
                        </p>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, padding: '6px 8px', cursor: 'pointer', color: '#fff' }}>
                        <X size={16} />
                    </button>
                </div>

                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            autoFocus
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search lecturer by name or department..."
                            style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px 8px 32px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                        />
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
                    {error && <div style={{ color: '#dc2626', fontSize: 12, margin: '8px 0', padding: '8px 12px', background: '#fee2e2', borderRadius: 8 }}>{error}</div>}
                    {/* None option */}
                    <button
                        onClick={() => setSelectedFacultyId('')}
                        style={{
                            width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 12px', marginBottom: 4, borderRadius: 10, border: 'none', cursor: 'pointer',
                            background: selectedFacultyId === '' ? 'rgba(239,68,68,0.06)' : '#fff',
                            outline: selectedFacultyId === '' ? '2px solid rgba(239,68,68,0.3)' : '1px solid #e2e8f0',
                            transition: 'all 0.15s',
                        }}
                    >
                        <div style={{
                            width: 18, height: 18, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: selectedFacultyId === '' ? '#ef4444' : '#e2e8f0', flexShrink: 0,
                        }}>
                            {selectedFacultyId === '' && <UserX size={11} color="#fff" />}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', fontStyle: 'italic' }}>— No Lecturer Assigned —</div>
                    </button>

                    {filtered.map(f => {
                        const isSelected = String(f.id) === selectedFacultyId;
                        return (
                            <button
                                key={f.id}
                                onClick={() => setSelectedFacultyId(String(f.id))}
                                style={{
                                    width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '10px 12px', marginBottom: 4, borderRadius: 10, border: 'none', cursor: 'pointer',
                                    background: isSelected ? 'rgba(37,99,235,0.07)' : '#fff',
                                    outline: isSelected ? '2px solid rgba(37,99,235,0.35)' : '1px solid #e2e8f0',
                                    transition: 'all 0.15s',
                                }}
                            >
                                <div style={{
                                    width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    background: isSelected ? '#2563eb' : '#e2e8f0',
                                    color: isSelected ? '#fff' : '#64748b',
                                    fontWeight: 800, fontSize: 13,
                                }}>
                                    {f.name.charAt(0).toUpperCase()}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{f.name}</div>
                                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                                        {f.department && <span>{f.department}</span>}
                                        {f.email && <span style={{ marginLeft: 6, opacity: 0.7 }}>· {f.email}</span>}
                                    </div>
                                </div>
                                {isSelected && <CheckCircle2 size={16} color="#2563eb" />}
                            </button>
                        );
                    })}
                    {filtered.length === 0 && <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 20 }}>No faculty found</p>}
                </div>

                <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
                    <button onClick={onClose} style={btnSecondary}>Cancel</button>
                    <button onClick={handleSave} disabled={saving} style={btnPrimary}>
                        {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                        {saving ? 'Saving…' : 'Save Assignment'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Delete Confirmation Modal ────────────────────────────────────────────────
function DeleteModal({ unit, onClose, onDeleted }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleDelete = async () => {
        setLoading(true);
        try {
            await masterUnitsAPI.delete(unit.id);
            onDeleted(unit);
        } catch (err) {
            const data = err.response?.data;
            if (data?.hasData) {
                setError(`Cannot delete: ${data.error} Use "Deactivate" instead.`);
            } else {
                setError(data?.error || 'Failed to delete unit');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
            <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 420, boxShadow: '0 32px 80px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
                <div style={{ background: 'linear-gradient(135deg, #7f1d1d, #dc2626)', padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Trash2 size={18} color="#fca5a5" />
                        <span style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>Delete Unit</span>
                    </div>
                </div>
                <div style={{ padding: 24 }}>
                    {error ? (
                        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#991b1b', fontSize: 13 }}>
                            <AlertCircle size={14} style={{ display: 'inline', marginRight: 6 }} />
                            {error}
                        </div>
                    ) : (
                        <p style={{ color: '#374151', fontSize: 14, marginBottom: 16 }}>
                            Are you sure you want to permanently delete <strong>"{unit.name || unit.unit_name}"</strong>?
                            This action cannot be undone. Units with student records cannot be deleted — deactivate them instead.
                        </p>
                    )}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button onClick={onClose} style={btnSecondary}>{error ? 'Close' : 'Cancel'}</button>
                        {!error && (
                            <button onClick={handleDelete} disabled={loading} style={{ ...btnPrimary, background: '#dc2626', borderColor: '#dc2626' }}>
                                {loading ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                {loading ? 'Deleting…' : 'Delete'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Loading skeleton placeholder ─────────────────────────────────────────────
function Skeleton({ w = '100%', h = 14, r = 6, style = {} }) {
    return <div style={{ width: w, height: h, borderRadius: r, background: '#e9edf2', animation: 'shimmer 1.4s ease-in-out infinite', ...style }} />;
}

function FolderSkeletonCard() {
    return (
        <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #eceff3', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <Skeleton w={40} h={40} r={12} />
            <div style={{ flex: 1, display: 'grid', gap: 8 }}>
                <Skeleton w="38%" h={16} />
                <Skeleton w="22%" h={11} />
            </div>
            <Skeleton w={90} h={28} r={8} />
        </div>
    );
}

// ─── Unit Offerings (one unit → one lecturer → one group of students) ─────────
function OfferingRow({ offering: o, canManage, setModal }) {
    return (
        <div className="unit-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2.2fr) minmax(0,1.2fr) minmax(0,1fr) 56px 56px auto', gap: 12, alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{o.offering_name}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                    {o.unit_code ? `${o.unit_code} · ` : ''}{o.group_label}{o.term ? ` · ${o.term}` : ''}{o.is_default ? ' · auto-created default' : ''}
                </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: o.faculty_name ? '#1e293b' : '#f59e0b' }}>
                {o.faculty_name || 'No lecturer'}
            </div>
            <div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: o.course_id ? '#e0f2fe' : '#dcfce7', color: o.course_id ? '#0369a1' : '#166534' }}>
                    {o.course_name || o.course_id || 'All courses'}
                </span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: Number(o.student_count) > 0 ? '#1e293b' : '#f59e0b' }}>{o.student_count}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{o.marks_count}</div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                {canManage && (
                    <>
                        <button onClick={() => setModal({ type: 'offeringRoster', offering: o })} style={actionBtn} title="Manage class roster">
                            <Users size={14} color="#800000" />
                        </button>
                        <button onClick={() => setModal({ type: 'offering', offering: o })} style={actionBtn} title="Edit offering">
                            <Edit2 size={14} color="#64748b" />
                        </button>
                        <button onClick={() => setModal({ type: 'deleteOffering', offering: o })} style={actionBtn} title="Delete offering">
                            <Trash2 size={14} color="#dc2626" />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

function OfferingFormModal({ offering, initialUnitId, units, courses, faculty, onClose, onSaved }) {
    const isEdit = !!offering;
    const [form, setForm] = useState({
        unit_id: offering?.unit_id || initialUnitId || '',
        course_id: offering?.course_id || '',
        faculty_id: offering?.faculty_id || '',
        group_label: offering?.group_label || 'Default',
        term: offering?.term || '',
        academic_year: offering?.academic_year || '',
        status: offering?.status || 'Active',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const set = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));

    const submit = async () => {
        if (!form.unit_id) { setError('Choose the unit this offering teaches.'); return; }
        if (!form.group_label.trim()) { setError('A group label is required (e.g. "Group A", "Am").'); return; }
        setSaving(true);
        setError(null);
        try {
            const payload = {
                unit_id: form.unit_id,
                course_id: form.course_id || null,
                faculty_id: form.faculty_id || null,
                group_label: form.group_label.trim(),
                term: form.term || null,
                academic_year: form.academic_year || null,
                status: form.status,
            };
            const res = isEdit
                ? await unitOfferingsAPI.update(offering.id, payload)
                : await unitOfferingsAPI.create(payload);
            onSaved(res.data, isEdit ? 'updated' : 'created');
        } catch (err) {
            setError(err.response?.data?.error || `Could not ${isEdit ? 'update' : 'create'} the offering.`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#fff', borderRadius: 18, padding: 24, width: '100%', maxWidth: 520, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#800000' }}>
                        {isEdit ? 'Edit Offering' : 'New Offering'}
                    </h3>
                    <button onClick={onClose} style={{ ...actionBtn, color: '#94a3b8' }}><X size={16} /></button>
                </div>
                <p style={{ fontSize: 12, color: '#64748b', marginTop: -8, marginBottom: 16 }}>
                    A common unit (Communication Skills, ICT…) can have several offerings — one per lecturer and group.
                </p>

                <div style={{ display: 'grid', gap: 14 }}>
                    <div>
                        <label style={labelStyle}>Unit *</label>
                        <select value={form.unit_id} onChange={set('unit_id')} style={inputStyle}>
                            <option value="">Select unit</option>
                            {units.map(u => (
                                <option key={u.id} value={u.id}>{u.unit_name}{u.unit_code ? ` (${u.unit_code})` : ''}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={labelStyle}>Course / scope</label>
                        <select value={form.course_id} onChange={set('course_id')} style={inputStyle}>
                            <option value="">All courses — shared common unit</option>
                            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                            Pick a course for a normal class, or leave it on "All courses" when students from several courses attend together.
                        </p>
                    </div>

                    <div>
                        <label style={labelStyle}>Lecturer</label>
                        <select value={form.faculty_id} onChange={set('faculty_id')} style={inputStyle}>
                            <option value="">Not assigned yet</option>
                            {faculty.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={labelStyle}>Group label *</label>
                            <input value={form.group_label} onChange={set('group_label')} placeholder="Group A" style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Status</label>
                            <select value={form.status} onChange={set('status')} style={inputStyle}>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={labelStyle}>Term</label>
                            <input value={form.term} onChange={set('term')} placeholder="Term 1" style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Academic year</label>
                            <input value={form.academic_year} onChange={set('academic_year')} placeholder="2026" style={inputStyle} />
                        </div>
                    </div>
                </div>

                {error && (
                    <div style={{ marginTop: 14, background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 10, padding: '10px 12px', fontSize: 12, fontWeight: 600 }}>
                        {error}
                    </div>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                    <button onClick={onClose} style={btnSecondary}>Cancel</button>
                    <button onClick={submit} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
                        <Save size={14} /> {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Create offering')}
                    </button>
                </div>
            </div>
        </div>
    );
}

function OfferingRosterModal({ offering, onClose, onSaved }) {
    const [allStudents, setAllStudents] = useState([]);
    const [selected, setSelected] = useState(new Set());
    const [search, setSearch] = useState('');
    const [courseFilter, setCourseFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        let alive = true;
        Promise.all([
            studentsAPI.getAll({ all: 1 }),
            unitOfferingsAPI.getStudents(offering.id),
        ])
            .then(([sRes, rRes]) => {
                if (!alive) return;
                const data = sRes.data;
                setAllStudents(Array.isArray(data) ? data : (data?.students || []));
                setSelected(new Set((rRes.data || []).map(s => String(s.id))));
            })
            .catch(err => { if (alive) setError(err.response?.data?.error || 'Could not load students.'); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [offering.id]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return allStudents.filter(s => {
            if (q && !(`${s.name} ${s.id}`.toLowerCase().includes(q))) return false;
            if (courseFilter) {
                const names = Array.isArray(s.course) ? s.course : String(s.course || '').replace(/[[\]"]/g, '').split(',').map(x => x.trim());
                if (!names.map(String).some(n => n.toLowerCase() === courseFilter.toLowerCase())) return false;
            }
            return true;
        });
    }, [allStudents, search, courseFilter]);

    const courseNames = useMemo(() => {
        const set = new Set();
        allStudents.forEach(s => {
            const raw = Array.isArray(s.course) ? s.course : String(s.course || '').replace(/[[\]"]/g, '').split(',');
            raw.map(x => String(x).trim()).filter(Boolean).forEach(n => set.add(n));
        });
        return [...set].sort();
    }, [allStudents]);

    const toggle = (id) => setSelected(prev => {
        const next = new Set(prev);
        const key = String(id);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
    });

    const submit = async () => {
        setSaving(true);
        setError(null);
        try {
            const res = await unitOfferingsAPI.setStudents(offering.id, [...selected]);
            onSaved(res.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Could not save the roster.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#fff', borderRadius: 18, padding: 24, width: '100%', maxWidth: 640, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#800000' }}>Class roster</h3>
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
                            {offering.offering_name} — {offering.faculty_name || 'No lecturer'} — {offering.group_label}
                            {offering.course_id ? '' : ' (all courses)'}
                        </p>
                    </div>
                    <button onClick={onClose} style={{ ...actionBtn, color: '#94a3b8' }}><X size={16} /></button>
                </div>

                <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student name or reg no…" style={{ ...inputStyle, flex: '1 1 220px' }} />
                    <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
                        <option value="">All courses</option>
                        {courseNames.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <button onClick={() => setSelected(new Set(visible.map(s => String(s.id))))} style={btnSecondary}>Select visible</button>
                    <button onClick={() => setSelected(new Set())} style={btnSecondary}>Clear</button>
                </div>

                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>
                    {loading ? 'Loading students…' : `${selected.size} student(s) selected · showing ${visible.length} of ${allStudents.length}`}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 12, minHeight: 200 }}>
                    {visible.map(s => (
                        <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: 13 }}>
                            <input type="checkbox" checked={selected.has(String(s.id))} onChange={() => toggle(s.id)} />
                            <span style={{ fontWeight: 700, color: '#1e293b' }}>{s.name}</span>
                            <span style={{ color: '#94a3b8', fontSize: 11 }}>{s.id}</span>
                        </label>
                    ))}
                    {!loading && visible.length === 0 && (
                        <p style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>No students match this filter.</p>
                    )}
                </div>

                {error && (
                    <div style={{ marginTop: 12, background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 10, padding: '10px 12px', fontSize: 12, fontWeight: 600 }}>
                        {error}
                    </div>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                    <button onClick={onClose} style={btnSecondary}>Cancel</button>
                    <button onClick={submit} disabled={saving || loading} style={{ ...btnPrimary, opacity: (saving || loading) ? 0.6 : 1 }}>
                        <UserCheck size={14} /> {saving ? 'Saving…' : `Save roster (${selected.size})`}
                    </button>
                </div>
            </div>
        </div>
    );
}

function DeleteOfferingModal({ offering, onClose, onDeleted }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    const submit = async () => {
        setBusy(true);
        setError(null);
        try {
            await unitOfferingsAPI.delete(offering.id);
            onDeleted(offering);
        } catch (err) {
            setError(err.response?.data?.error || 'Could not delete this offering.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#fff', borderRadius: 18, padding: 24, width: '100%', maxWidth: 460, boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#800000' }}>Delete offering?</h3>
                <p style={{ fontSize: 13, color: '#475569', margin: '0 0 12px' }}>
                    <strong>{offering.offering_name}</strong> — {offering.group_label}
                    {offering.course_id ? ` (${offering.course_name || offering.course_id})` : ' (all courses)'}.
                    The class roster is removed with it; recorded marks are never deleted, so an offering with marks cannot be deleted.
                </p>

                {error && (
                    <div style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 10, padding: '10px 12px', fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
                        {error}
                    </div>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={btnSecondary}>Cancel</button>
                    <button onClick={submit} disabled={busy} style={{ ...btnPrimary, background: '#dc2626', borderColor: '#dc2626', opacity: busy ? 0.6 : 1 }}>
                        <Trash2 size={14} /> {busy ? 'Deleting…' : 'Delete offering'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const inputStyle = {
    width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '10px 12px',
    fontSize: 13, outline: 'none', boxSizing: 'border-box', transition: 'border 0.15s',
    color: '#1e293b',
};
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' };
const btnPrimary = {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10,
    background: 'linear-gradient(135deg, #800000, #a00000)', color: '#fff', border: '1px solid #800000',
    fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
};
const btnSecondary = {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10,
    background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0',
    fontWeight: 600, fontSize: 13, cursor: 'pointer',
};
const actionBtn = {
    background: 'none', border: '1px solid #e2e8f0', borderRadius: 8,
    padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center',
    transition: 'all 0.15s',
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function UnitManagement() {
    const { user } = useAuth();
    const role = (user?.role || '').toLowerCase();
    const canManage = ['admin', 'superadmin'].includes(role);

    const [units, setUnits] = useState([]);
    const [courses, setCourses] = useState([]);
    const [faculty, setFaculty] = useState([]);
    const [offerings, setOfferings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [selectedCourseFilter, setSelectedCourseFilter] = useState('ALL'); // 'ALL' | 'UNASSIGNED' | courseId
    const [viewMode, setViewMode] = useState('BY_COURSE'); // 'BY_COURSE' | 'ALL_UNITS'
    const [toast, setToast] = useState(null);
    const [modal, setModal] = useState(null); // { type: 'add'|'edit'|'assign'|'delete'|'quickAttachCourse'|'assignTeacher', unit?, course? }
    // Folders stay open/closed across reloads (localStorage)
    const [expandedCourses, setExpandedCourses] = useState(() => {
        try { return JSON.parse(localStorage.getItem('units-expanded-courses')) || {}; } catch { return {}; }
    });
    const persistExpanded = (next) => {
        setExpandedCourses(next);
        try { localStorage.setItem('units-expanded-courses', JSON.stringify(next)); } catch { /* storage unavailable */ }
    };
    const toggleCourseExpanded = (courseId) => setExpandedCourses(prev => {
        const next = { ...prev, [courseId]: !prev[courseId] };
        try { localStorage.setItem('units-expanded-courses', JSON.stringify(next)); } catch { /* storage unavailable */ }
        return next;
    });

    const showToast = (message, type = 'success') => setToast({ message, type });

    const fetchData = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [unitsRes, coursesRes, facultyRes, offeringsRes] = await Promise.allSettled([
                masterUnitsAPI.getAll({ status: filterStatus || undefined, search: search || undefined }),
                coursesAPI.getAll(),
                facultyAPI.getAll(),
                unitOfferingsAPI.getAll(),
            ]);
            if (unitsRes.status === 'fulfilled') setUnits(Array.isArray(unitsRes.value.data) ? unitsRes.value.data : []);
            if (coursesRes.status === 'fulfilled') {
                const data = coursesRes.value.data;
                setCourses(Array.isArray(data) ? data : (Array.isArray(data?.courses) ? data.courses : []));
            }
            if (facultyRes.status === 'fulfilled') {
                const fData = facultyRes.value.data;
                setFaculty(Array.isArray(fData) ? fData : (Array.isArray(fData?.faculty) ? fData.faculty : []));
            }
            if (offeringsRes.status === 'fulfilled') {
                const oData = offeringsRes.value.data;
                setOfferings(Array.isArray(oData) ? oData : []);
            }
            const failed = [unitsRes, coursesRes, facultyRes, offeringsRes].filter(r => r.status === 'rejected');
            if (failed.length > 0) {
                const status = failed[0].reason?.response?.status;
                setLoadError(status === 401
                    ? 'Your session expired or is not authorized for this page.'
                    : 'Could not reach the database. Check your connection and try again.');
            }
        } catch (err) {
            setLoadError('Failed to load data.');
        } finally {
            setLoading(false);
        }
    }, [search, filterStatus]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filteredOfferings = useMemo(() => {
        const q = search.trim().toLowerCase();
        return offerings.filter(o => {
            if (filterStatus && o.status !== filterStatus) return false;
            if (!q) return true;
            return `${o.offering_name} ${o.unit_name || ''} ${o.unit_code || ''} ${o.faculty_name || ''} ${o.group_label || ''} ${o.course_name || ''}`
                .toLowerCase().includes(q);
        });
    }, [offerings, search, filterStatus]);

    const handleOfferingSaved = (saved, action) => {
        setModal(null);
        if (action === 'updated') {
            setOfferings(prev => prev.map(o => (o.id === saved.id ? { ...o, ...saved } : o)));
            showToast('Offering updated.', 'success');
        } else {
            setOfferings(prev => [{ ...saved, student_count: 0, marks_count: 0, course_name: null }, ...prev]);
            showToast('Offering created. Add its class roster before entering marks.', 'success');
        }
    };

    const handleRosterSaved = (result) => {
        setModal(null);
        setOfferings(prev => prev.map(o => (o.id === result.offering_id ? { ...o, student_count: result.student_count } : o)));
        showToast(`Roster saved: ${result.student_count} student(s).`, 'success');
    };

    const handleOfferingDeleted = (removed) => {
        setModal(null);
        setOfferings(prev => prev.filter(o => o.id !== removed.id));
        showToast('Offering deleted.', 'success');
    };

    const handleSaveUnit = (savedUnit, action) => {
        if (action === 'created') {
            setUnits(prev => [{ ...savedUnit, assigned_courses: [] }, ...prev]);
        } else {
            setUnits(prev => prev.map(u => u.id === savedUnit.id ? { ...u, ...savedUnit } : u));
        }
        setModal(null);
        showToast(`Unit "${savedUnit.name || savedUnit.unit_name}" ${action} successfully`);
    };

    const handleToggleStatus = async (unit) => {
        const newStatus = unit.status === 'Active' ? 'Inactive' : 'Active';
        try {
            const res = await masterUnitsAPI.updateStatus(unit.id, newStatus);
            setUnits(prev => prev.map(u => u.id === unit.id ? { ...u, ...res.data } : u));
            showToast(`Unit "${unit.name || unit.unit_name}" set to ${newStatus}`);
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to update status', 'error');
        }
    };

    const handleDetachUnitFromCourse = async (unitId, courseId, courseName) => {
        try {
            await masterUnitsAPI.removeFromCourse(unitId, courseId);
            showToast(`Removed unit from ${courseName}`);
            fetchData();
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to remove unit from course', 'error');
        }
    };

    const handleDeleted = (deletedUnit) => {
        setUnits(prev => prev.filter(u => u.id !== deletedUnit.id));
        setModal(null);
        showToast(`Unit "${deletedUnit.name || deletedUnit.unit_name}" deleted`);
    };

    const handleAssignDone = () => {
        setModal(null);
        showToast('Course assignments updated');
        fetchData();
    };

    const handleTeacherAssignDone = () => {
        setModal(null);
        showToast('Lecturer assigned to unit successfully');
        fetchData();
    };

    // Group units by course
    const courseGroupedData = useMemo(() => {
        const q = search.toLowerCase();

        // Filter units first based on search & status
        const matchingUnits = units.filter(u => {
            const uName = String(u.name || u.unit_name || '').toLowerCase();
            const uCode = String(u.code || u.unit_code || '').toLowerCase();
            const matchSearch = !q || uName.includes(q) || uCode.includes(q);
            const matchStatus = !filterStatus || u.status === filterStatus;
            return matchSearch && matchStatus;
        });

        // Map courseId -> units array
        const courseMap = {};
        courses.forEach(c => {
            courseMap[String(c.id)] = {
                course: c,
                units: []
            };
        });

        const unassignedUnits = [];

        matchingUnits.forEach(u => {
            const assignedList = u.assigned_courses || [];
            if (assignedList.length === 0) {
                unassignedUnits.push(u);
            } else {
                const seenCids = new Set(); // dedupe: JOIN can return one row per course+lecturer
                assignedList.forEach(ac => {
                    const cId = String(ac.course_id);
                    if (courseMap[cId] && !seenCids.has(cId)) {
                        seenCids.add(cId);
                        courseMap[cId].units.push(u);
                    }
                });
            }
        });

        let groups = Object.values(courseMap);

        // Filter by course tab if selected
        if (selectedCourseFilter !== 'ALL') {
            if (selectedCourseFilter === 'UNASSIGNED') {
                groups = [];
            } else {
                groups = groups.filter(g => String(g.course.id) === String(selectedCourseFilter));
            }
        }

        return {
            groups,
            unassigned: unassignedUnits,
            allMatchingUnits: matchingUnits,
        };
    }, [units, courses, search, filterStatus, selectedCourseFilter]);

    // Offerings placed inside their course folder; shared ones collected in the Common Units folder
    const offeringFolders = useMemo(() => {
        const q = search.trim().toLowerCase();
        const commonUnitIds = new Set(units.filter(u => u.is_common).map(u => String(u.id)));
        const isCommonOffering = (o) => !o.course_id || commonUnitIds.has(String(o.unit_id));

        const matching = offerings.filter(o => {
            if (filterStatus && o.status !== filterStatus) return false;
            if (!q) return true;
            return `${o.offering_name} ${o.unit_name || ''} ${o.unit_code || ''} ${o.faculty_name || ''} ${o.group_label || ''}`
                .toLowerCase().includes(q);
        });

        const byCourse = {};
        const common = [];
        for (const o of matching) {
            if (isCommonOffering(o)) { common.push(o); continue; }
            (byCourse[String(o.course_id)] ||= []).push(o);
        }

        // Common units that have no offering yet — listed so they can still be found in the folder.
        const offeredUnitIds = new Set(offerings.map(o => String(o.unit_id)));
        const pendingUnits = units.filter(u => u.is_common && !offeredUnitIds.has(String(u.id)) && (!q ||
            `${u.unit_name || u.name || ''} ${u.unit_code || u.code || ''}`.toLowerCase().includes(q)));

        // When a single course tab is open, the Common folder still shows the offerings shared with it.
        const visibleCommon = (selectedCourseFilter === 'ALL' || selectedCourseFilter === 'UNASSIGNED')
            ? common
            : common.filter(o => !o.course_id || String(o.course_id) === String(selectedCourseFilter));
        const visiblePending = (selectedCourseFilter === 'ALL' || selectedCourseFilter === 'UNASSIGNED')
            ? pendingUnits
            : pendingUnits.filter(u => (u.assigned_courses || []).some(ac => String(ac.course_id) === String(selectedCourseFilter)));

        return { byCourse, common: visibleCommon, pendingUnits: visiblePending };
    }, [offerings, units, search, filterStatus, selectedCourseFilter]);

    const stats = useMemo(() => ({
        totalUnits: units.length,
        totalCourses: courses.length,
        activeUnits: units.filter(u => u.status === 'Active').length,
        unassignedCount: units.filter(u => (!u.assigned_courses || u.assigned_courses.length === 0)).length,
    }), [units, courses]);

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f8f9fa 0%, #f1f5f9 100%)' }}>
            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .unit-row:hover { background: #f8fafc !important; }
                @keyframes shimmer { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
                .unit-card { animation: slideUp 0.2s ease-out; }
                .folder-header:hover { filter: brightness(0.98); }
                .folder-header:focus-visible { outline: 2px solid rgba(128,0,0,0.45); outline-offset: -2px; }
                .folder-body { animation: slideUp 0.18s ease-out; }
                .folder-chev { transition: transform 0.2s ease; }
                .folder-chev-open { transform: rotate(180deg); }
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .tab-btn {
                    padding: 8px 16px; border-radius: 12px; font-size: 13px; font-weight: 700;
                    cursor: pointer; transition: all 0.2s; border: 1px solid transparent; white-space: nowrap;
                }
                .tab-btn-active {
                    background: #800000; color: #fff; border-color: #800000; box-shadow: 0 4px 12px rgba(128,0,0,0.25);
                }
                .tab-btn-inactive {
                    background: #fff; color: #475569; border-color: #e2e8f0;
                }
                .tab-btn-inactive:hover {
                    background: #f1f5f9; color: #1e293b;
                }
            `}</style>

            {/* Page Header */}
            <div style={{ background: 'linear-gradient(135deg, #800000 0%, #a00000 50%, #800000 100%)', padding: '28px 32px 24px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,215,0,0.06)' }} />
                <div style={{ position: 'absolute', bottom: -20, left: 100, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)' }}>
                                <BookOpen size={22} color="#FFD700" />
                            </div>
                            <div>
                                <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>Units Management</h1>
                                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, margin: 0 }}>Organize, edit, and assign units across academic courses</p>
                            </div>
                        </div>

                        {canManage && (
                            <button onClick={() => setModal({ type: 'add' })} style={{ ...btnPrimary, background: '#FFD700', color: '#800000', borderColor: '#FFD700', fontSize: 13, padding: '10px 20px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
                                <Plus size={16} /> Add Unit
                            </button>
                        )}
                    </div>

                    {/* Stats Row */}
                    <div style={{ display: 'flex', gap: 14, marginTop: 20, flexWrap: 'wrap' }}>
                        {[
                            { label: 'Total Units', value: stats.totalUnits, color: '#fff' },
                            { label: 'Active Courses', value: stats.totalCourses, color: '#FFD700' },
                            { label: 'Active Units', value: stats.activeUnits, color: '#4ade80' },
                            { label: 'Unassigned Units', value: stats.unassignedCount, color: stats.unassignedCount > 0 ? '#fbbf24' : 'rgba(255,255,255,0.5)' },
                        ].map(s => (
                            <div key={s.label} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</span>
                                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{s.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{ padding: '24px 32px', maxWidth: 1250, margin: '0 auto' }}>

                {/* Main View Mode Selector & Search Toolbar */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>

                    {/* View Switcher Tabs */}
                    <div style={{ display: 'flex', background: '#e2e8f0', padding: 4, borderRadius: 14, gap: 4 }}>
                        <button
                            onClick={() => setViewMode('BY_COURSE')}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10,
                                fontSize: 13, fontWeight: 800, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                                background: viewMode === 'BY_COURSE' ? '#fff' : 'transparent',
                                color: viewMode === 'BY_COURSE' ? '#800000' : '#64748b',
                                boxShadow: viewMode === 'BY_COURSE' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                            }}
                        >
                            <FolderOpen size={16} /> Organized by Course
                        </button>
                        <button
                            onClick={() => setViewMode('ALL_UNITS')}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10,
                                fontSize: 13, fontWeight: 800, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                                background: viewMode === 'ALL_UNITS' ? '#fff' : 'transparent',
                                color: viewMode === 'ALL_UNITS' ? '#800000' : '#64748b',
                                boxShadow: viewMode === 'ALL_UNITS' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                            }}
                        >
                            <LayoutGrid size={16} /> All Units ({units.length})
                        </button>
                        <button
                            onClick={() => setViewMode('OFFERINGS')}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10,
                                fontSize: 13, fontWeight: 800, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                                background: viewMode === 'OFFERINGS' ? '#fff' : 'transparent',
                                color: viewMode === 'OFFERINGS' ? '#800000' : '#64748b',
                                boxShadow: viewMode === 'OFFERINGS' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                            }}
                        >
                            <Users size={16} /> Offerings ({offerings.length})
                        </button>
                    </div>

                    {/* Controls (Search & Status Filter) */}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        {viewMode === 'BY_COURSE' && (
                            <div style={{ display: 'flex', gap: 4, background: '#e2e8f0', padding: 3, borderRadius: 10 }}>
                                <button
                                    onClick={() => persistExpanded(Object.fromEntries([...courseGroupedData.groups.map(g => [String(g.course.id), true]), ['_UNASSIGNED', true], ['_COMMON', true]]))}
                                    style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 800, border: 'none', cursor: 'pointer', background: '#fff', color: '#475569', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
                                >
                                    <ChevronDown size={12} style={{ verticalAlign: -1, marginRight: 4 }} />Expand All
                                </button>
                                <button
                                    onClick={() => persistExpanded({})}
                                    style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: 'transparent', color: '#64748b' }}
                                >
                                    <ChevronUp size={12} style={{ verticalAlign: -1, marginRight: 4 }} />Collapse All
                                </button>
                            </div>
                        )}
                        <div style={{ position: 'relative', width: 260 }}>
                            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search unit name or code..."
                                style={{ ...inputStyle, paddingLeft: 36 }}
                            />
                        </div>

                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '9px 32px 9px 12px', cursor: 'pointer' }}>
                            <option value="">All Statuses</option>
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                        </select>

                        <button onClick={fetchData} title="Refresh data" style={btnSecondary}>
                            <RefreshCw size={14} />
                        </button>
                    </div>
                </div>

                {/* Course Filter Quick Tabs (unit views only) */}
                {viewMode !== 'OFFERINGS' && (
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, marginBottom: 20, scrollbarWidth: 'thin' }}>
                    <button
                        onClick={() => setSelectedCourseFilter('ALL')}
                        className={`tab-btn ${selectedCourseFilter === 'ALL' ? 'tab-btn-active' : 'tab-btn-inactive'}`}
                    >
                        All Courses ({courses.length})
                    </button>

                    {courses.map(course => {
                        const count = units.filter(u => (u.assigned_courses || []).some(ac => String(ac.course_id) === String(course.id))).length;
                        return (
                            <button
                                key={course.id}
                                onClick={() => setSelectedCourseFilter(String(course.id))}
                                className={`tab-btn ${selectedCourseFilter === String(course.id) ? 'tab-btn-active' : 'tab-btn-inactive'}`}
                            >
                                {course.name} ({count})
                            </button>
                        );
                    })}

                    <button
                        onClick={() => setSelectedCourseFilter('UNASSIGNED')}
                        className={`tab-btn ${selectedCourseFilter === 'UNASSIGNED' ? 'tab-btn-active' : 'tab-btn-inactive'}`}
                    >
                        Unassigned Units ({stats.unassignedCount})
                    </button>
                </div>
                )}

                {/* VIEW MODE 1: ORGANIZED BY COURSE */}
                {viewMode === 'BY_COURSE' && (
                    <div style={{ display: 'grid', gap: 20 }}>
                        {loading && (
                            <div style={{ display: 'grid', gap: 14 }} aria-label="Loading course units" role="status">
                                {[0, 1, 2, 3].map(i => <FolderSkeletonCard key={i} />)}
                            </div>
                        )}
                        {!loading && loadError && (
                            <div style={{ background: '#fff', border: '1.5px solid #fecaca', borderRadius: 16, padding: '28px 24px', textAlign: 'center' }}>
                                <AlertCircle size={32} color="#dc2626" style={{ marginBottom: 10 }} />
                                <p style={{ fontSize: 14, fontWeight: 800, color: '#991b1b', margin: '0 0 4px' }}>{loadError}</p>
                                <p style={{ fontSize: 12, color: '#b91c1c', margin: '0 0 14px' }}>Units and courses could not be displayed.</p>
                                <button onClick={() => fetchData()} style={btnPrimary}>
                                    <RefreshCw size={14} /> Retry
                                </button>
                            </div>
                        )}

                        {/* Unassigned Units Block if selected or viewing ALL */}
                        {!loading && !loadError && (selectedCourseFilter === 'ALL' || selectedCourseFilter === 'UNASSIGNED') && courseGroupedData.unassigned.length > 0 && (() => {
                            const unExpanded = !!expandedCourses['_UNASSIGNED'] || search.trim() !== '' || selectedCourseFilter === 'UNASSIGNED';
                            return (
                            <div style={{ background: '#fff', borderRadius: 16, border: '1.5px dashed #f59e0b', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                                <div
                                    id="unassigned-folder-header"
                                    className="folder-header"
                                    role="button"
                                    tabIndex={0}
                                    aria-expanded={unExpanded}
                                    aria-controls="unassigned-folder-body"
                                    aria-label={`${unExpanded ? 'Collapse' : 'Expand'} unassigned master units (${courseGroupedData.unassigned.length})`}
                                    onClick={() => toggleCourseExpanded('_UNASSIGNED')}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCourseExpanded('_UNASSIGNED'); } }}
                                    style={{ background: '#fffbeb', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: unExpanded ? '1px solid #fef3c7' : '1px solid transparent', cursor: 'pointer', userSelect: 'none', outline: 'none' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <AlertCircle size={18} color="#d97706" />
                                        <div>
                                            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#92400e', margin: 0 }}>Unassigned Master Units ({courseGroupedData.unassigned.length})</h3>
                                            <p style={{ fontSize: 12, color: '#b45309', margin: 0 }}>Units created in library that are not attached to any course yet</p>
                                        </div>
                                    </div>
                                    <ChevronDown size={18} color="#b45309" className={`folder-chev ${unExpanded ? 'folder-chev-open' : ''}`} />
                                </div>
                                {unExpanded && (
                                <div id="unassigned-folder-body" className="folder-body" role="region" aria-labelledby="unassigned-folder-header" style={{ padding: '8px 16px' }}>
                                    {courseGroupedData.unassigned.map(unit => (
                                        <div key={unit.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
                                            <div>
                                                <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{unit.name || unit.unit_name}</div>
                                                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                                                    {(unit.code || unit.unit_code) ? <span style={{ fontFamily: 'monospace', fontWeight: 700, background: '#f1f5f9', padding: '1px 6px', borderRadius: 4, marginRight: 6 }}>{unit.code || unit.unit_code}</span> : null}
                                                    {unit.description}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <Badge status={unit.status} />
                                                {canManage && (
                                                    <button onClick={() => setModal({ type: 'assign', unit })} style={btnPrimary}>
                                                        <Link2 size={13} /> Assign to Course
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                )}
                            </div>
                            );
                        })()}

                        {/* Common Units folder — shared units and cross-course offerings */}
                        {!loading && !loadError && (offeringFolders.common.length > 0 || offeringFolders.pendingUnits.length > 0) && (() => {
                            const commonExpanded = !!expandedCourses['_COMMON'] || search.trim() !== '';
                            const headerId = 'common-folder-header';
                            return (
                            <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #86efac', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                                <div
                                    id={headerId}
                                    className="folder-header"
                                    role="button"
                                    tabIndex={0}
                                    aria-expanded={commonExpanded}
                                    aria-controls="common-folder-body"
                                    aria-label={`${commonExpanded ? 'Collapse' : 'Expand'} common units offerings (${offeringFolders.common.length})`}
                                    onClick={() => toggleCourseExpanded('_COMMON')}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCourseExpanded('_COMMON'); } }}
                                    style={{ background: '#f0fdf4', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: commonExpanded ? '1px solid #dcfce7' : '1px solid transparent', cursor: 'pointer', userSelect: 'none', outline: 'none' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#16a34a,#4ade80)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Globe size={18} color="#fff" />
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#166534', margin: 0 }}>Common Units ({offeringFolders.common.length + offeringFolders.pendingUnits.length})</h3>
                                            <p style={{ fontSize: 12, color: '#15803d', margin: 0 }}>
                                                Shared units taught across courses — e.g. Business Skills, Communication Skills, Salon Management, ICT
                                            </p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        {canManage && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setModal({ type: 'offering' }); }}
                                                style={{ ...btnSecondary, background: '#fff', color: '#166534', borderColor: '#86efac', fontWeight: 700 }}
                                            >
                                                <Plus size={14} /> New Offering
                                            </button>
                                        )}
                                        <ChevronDown size={18} color="#166534" className={`folder-chev ${commonExpanded ? 'folder-chev-open' : ''}`} />
                                    </div>
                                </div>
                                {commonExpanded && (
                                    <div id="common-folder-body" className="folder-body" role="region" aria-labelledby={headerId}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2.2fr) minmax(0,1.2fr) minmax(0,1fr) 56px 56px auto', gap: 12, padding: '10px 16px', background: '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                                            {['Unit / Offering', 'Lecturer', 'Scope', 'Students', 'Marks', ''].map((h, i) => (
                                                <div key={i} style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: i === 5 ? 'right' : 'left' }}>{h}</div>
                                            ))}
                                        </div>
                                        {offeringFolders.common.map(o => (
                                            <OfferingRow key={o.id} offering={o} canManage={canManage} setModal={setModal} />
                                        ))}
                                        {offeringFolders.pendingUnits.length > 0 && (
                                            <div style={{ padding: '12px 16px', borderTop: offeringFolders.common.length ? '1px solid #dcfce7' : 'none', background: '#f8fefb' }}>
                                                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                                                    Common units without an offering yet
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                                    {offeringFolders.pendingUnits.map(u => (
                                                        <span key={u.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #bbf7d0', borderRadius: 10, padding: '6px 10px', fontSize: 12, fontWeight: 700, color: '#166534' }}>
                                                            {u.name || u.unit_name}{(u.code || u.unit_code) ? ` (${u.code || u.unit_code})` : ''}
                                                            {canManage && (
                                                                <button
                                                                    onClick={() => setModal({ type: 'offering', unit_id: u.id })}
                                                                    style={{ fontSize: 11, fontWeight: 700, color: '#166534', background: '#f0fdf4', border: '1px dashed #86efac', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}
                                                                >
                                                                    <Plus size={11} style={{ verticalAlign: -2 }} /> offering
                                                                </button>
                                                            )}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            );
                        })()}

                        {/* Course Cards Grid */}
                        {!loading && !loadError && courseGroupedData.groups.length === 0 && selectedCourseFilter !== 'UNASSIGNED' && (
                            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', color: '#94a3b8' }}>
                                <BookOpen size={40} style={{ margin: '0 auto 12px' }} />
                                <p style={{ fontSize: 15, fontWeight: 700 }}>No courses match your filter</p>
                            </div>
                        )}

                        {!loading && !loadError && courseGroupedData.groups.map(({ course, units: courseUnits }) => {
                            const cid = String(course.id);
                            // Folders auto-open while searching or when a single course tab is selected
                            const isExpanded = !!expandedCourses[cid] || search.trim() !== '' || String(selectedCourseFilter) === cid;
                            const lecturerCount = courseUnits.filter(u =>
                                (u.assigned_courses || []).some(ac => String(ac.course_id) === cid && ac.faculty_id)
                            ).length;
                            const inactiveCount = courseUnits.filter(u => (u.status || 'Active') !== 'Active').length;
                            const courseOfferings = offeringFolders.byCourse[cid] || [];
                            const headerId = `course-folder-header-${cid}`;

                            return (
                            <div key={course.id} style={{ background: '#fff', borderRadius: 18, border: isExpanded ? '1px solid #e2e8f0' : '1px solid #eceff3', boxShadow: isExpanded ? '0 4px 20px rgba(0,0,0,0.05)' : '0 2px 8px rgba(0,0,0,0.035)', overflow: 'hidden', transition: 'all 0.2s' }}>
                                {/* Course Folder Header */}
                                <div
                                    id={headerId}
                                    className="folder-header"
                                    role="button"
                                    tabIndex={0}
                                    aria-expanded={isExpanded}
                                    aria-controls={`${headerId}-body`}
                                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${course.name} unit folder`}
                                    onClick={() => toggleCourseExpanded(cid)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCourseExpanded(cid); } }}
                                    style={{ background: isExpanded ? 'linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)' : '#fff', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: isExpanded ? '1px solid #e2e8f0' : '1px solid transparent', flexWrap: 'wrap', gap: 12, cursor: 'pointer', userSelect: 'none', outline: 'none' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ width: 40, height: 40, borderRadius: 12, background: isExpanded ? 'linear-gradient(135deg, #800000, #a00000)' : 'linear-gradient(135deg, #fbbf24, #f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isExpanded ? '#FFD700' : '#fff', boxShadow: isExpanded ? '0 4px 12px rgba(128,0,0,0.2)' : '0 3px 8px rgba(245,158,11,0.25)', transition: 'all 0.2s' }}>
                                            {isExpanded ? <FolderOpen size={20} /> : <Folder size={20} />}
                                        </div>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#1e293b', margin: 0 }}>{course.name}</h3>
                                                <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(128,0,0,0.08)', color: '#800000', padding: '2px 8px', borderRadius: 6 }}>
                                                    {courseUnits.length} Unit{courseUnits.length !== 1 ? 's' : ''}
                                                </span>
                                                {courseUnits.length > 0 && (
                                                    <span style={{ fontSize: 11, fontWeight: 700, background: lecturerCount === courseUnits.length ? 'rgba(22,163,74,0.1)' : 'rgba(100,116,139,0.1)', color: lecturerCount === courseUnits.length ? '#16a34a' : '#64748b', padding: '2px 8px', borderRadius: 6 }}>
                                                        {lecturerCount}/{courseUnits.length} lecturer{lecturerCount === 1 ? '' : 's'}
                                                    </span>
                                                )}
                                                {courseOfferings.length > 0 && (
                                                    <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(37,99,235,0.10)', color: '#1d4ed8', padding: '2px 8px', borderRadius: 6 }}>
                                                        {courseOfferings.length} Offering{courseOfferings.length !== 1 ? 's' : ''}
                                                    </span>
                                                )}
                                                {inactiveCount > 0 && (
                                                    <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(245,158,11,0.12)', color: '#b45309', padding: '2px 8px', borderRadius: 6 }}>
                                                        {inactiveCount} inactive
                                                    </span>
                                                )}
                                            </div>
                                            {course.department && <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>{course.department} Department</p>}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        {canManage && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setModal({ type: 'quickAttachCourse', course }); }}
                                                style={{ ...btnSecondary, background: '#fff', color: '#800000', borderColor: 'rgba(128,0,0,0.3)', fontWeight: 700 }}
                                            >
                                                <Plus size={14} /> Attach / Manage Units
                                            </button>
                                        )}
                                        <ChevronDown size={18} color="#64748b" className={`folder-chev ${isExpanded ? 'folder-chev-open' : ''}`} />
                                    </div>
                                </div>

                                {/* Units Table for this course */}
                                {isExpanded && (
                                <div id={`${headerId}-body`} className="folder-body" role="region" aria-labelledby={headerId}>
                                    {courseUnits.length === 0 ? (
                                        <div style={{ padding: '30px 24px', textAlign: 'center', color: '#94a3b8' }}>
                                            <p style={{ fontSize: 13, margin: 0 }}>No units currently assigned to <strong>{course.name}</strong>.</p>
                                            {canManage && (
                                                <button onClick={() => setModal({ type: 'quickAttachCourse', course })} style={{ ...btnSecondary, marginTop: 10, fontSize: 12 }}>
                                                    <Plus size={13} /> Attach Units Now
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                                <thead>
                                                    <tr style={{ background: '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                                                        <th style={thStyle}>Unit Name</th>
                                                        <th style={thStyle}>Code</th>
                                                        <th style={thStyle}>Lecturer</th>
                                                        <th style={thStyle}>Status</th>
                                                        <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {courseUnits.map(unit => {
                                                        const assignedCourse = (unit.assigned_courses || []).find(
                                                            ac => String(ac.course_id) === String(course.id)
                                                        );
                                                        const lecturerName = assignedCourse?.faculty_name || null;
                                                        return (
                                                            <tr key={unit.id} className="unit-row" style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                <td style={tdStyle}>
                                                                    <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>{unit.name || unit.unit_name}</div>
                                                                    {unit.description && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{unit.description}</div>}
                                                                </td>
                                                                <td style={tdStyle}>
                                                                    {(unit.code || unit.unit_code) ? (
                                                                        <span style={{ fontFamily: 'monospace', fontSize: 12, background: '#f1f5f9', padding: '2px 8px', borderRadius: 6, color: '#475569', fontWeight: 700 }}>{unit.code || unit.unit_code}</span>
                                                                    ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                                                                </td>
                                                                <td style={tdStyle}>
                                                                    {lecturerName ? (
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                            <div style={{ width: 26, height: 26, borderRadius: 8, background: 'linear-gradient(135deg,#2563eb,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                                                                                {lecturerName.charAt(0).toUpperCase()}
                                                                            </div>
                                                                            <div>
                                                                                <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>{lecturerName}</span>
                                                                                {canManage && (
                                                                                    <button onClick={() => setModal({ type: 'assignTeacher', unit, course })} style={{ marginLeft: 8, fontSize: 10, color: '#64748b', background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '2px 6px', cursor: 'pointer' }}>Change</button>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        canManage ? (
                                                                            <button
                                                                                onClick={() => setModal({ type: 'assignTeacher', unit, course })}
                                                                                style={{ fontSize: 11, color: '#94a3b8', background: 'none', border: '1px dashed #cbd5e1', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
                                                                            >
                                                                                <UserCheck size={12} /> Assign
                                                                            </button>
                                                                        ) : <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>
                                                                    )}
                                                                </td>
                                                                <td style={tdStyle}><Badge status={unit.status || 'Active'} /></td>
                                                                <td style={{ ...tdStyle, textAlign: 'right' }}>
                                                                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                                                        {canManage && (
                                                                            <>
                                                                                <button
                                                                                    title="Assign Lecturer"
                                                                                    onClick={() => setModal({ type: 'assignTeacher', unit, course })}
                                                                                    style={{ ...actionBtn, color: '#2563eb' }}
                                                                                >
                                                                                    <UserCheck size={14} />
                                                                                </button>
                                                                                <button
                                                                                    title="Edit Unit"
                                                                                    onClick={() => setModal({ type: 'edit', unit })}
                                                                                    style={{ ...actionBtn, color: '#8b5cf6' }}
                                                                                >
                                                                                    <Edit2 size={14} />
                                                                                </button>
                                                                                <button
                                                                                    title={`Detach from ${course.name}`}
                                                                                    onClick={() => handleDetachUnitFromCourse(unit.id, course.id, course.name)}
                                                                                    style={{ ...actionBtn, color: '#ef4444' }}
                                                                                >
                                                                                    <Unlink size={14} /> Detach
                                                                                </button>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {courseOfferings.length > 0 && (
                                        <div style={{ borderTop: '1px solid #e2e8f0', background: '#fcfdff' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px 2px', fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                <Users size={13} color="#1d4ed8" /> Offerings in {course.name}
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2.2fr) minmax(0,1.2fr) minmax(0,1fr) 56px 56px auto', gap: 12, padding: '8px 16px', borderBottom: '1px solid #f1f5f9' }}>
                                                {['Unit / Offering', 'Lecturer', 'Scope', 'Students', 'Marks', ''].map((h, i) => (
                                                    <div key={i} style={{ fontSize: 11, fontWeight: 800, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: i === 5 ? 'right' : 'left' }}>{h}</div>
                                                ))}
                                            </div>
                                            {courseOfferings.map(o => (
                                                <OfferingRow key={o.id} offering={o} canManage={canManage} setModal={setModal} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                                )}
                            </div>
                            );
                        })}
                    </div>
                )}

                {/* VIEW MODE 2: MASTER UNIT CATALOGUE (ALL UNITS) */}
                {viewMode === 'ALL_UNITS' && (
                    <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1fr auto', gap: 0, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 20px' }}>
                            {['Unit Name', 'Code', 'Courses Assigned', 'Status', 'Actions'].map(h => (
                                <div key={h} style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</div>
                            ))}
                        </div>

                        {loading && (
                            <div style={{ display: 'grid', gap: 10, padding: '4px 0' }} aria-label="Loading units" role="status">
                                {[0, 1, 2, 3, 4, 5].map(i => (
                                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1fr', gap: 16, padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
                                        <Skeleton w="65%" h={15} />
                                        <Skeleton w="55%" h={13} />
                                        <Skeleton w="70%" h={13} />
                                        <Skeleton w="45%" h={18} r={9} />
                                    </div>
                                ))}
                            </div>
                        )}
                        {!loading && loadError && (
                            <div style={{ background: '#fff', border: '1.5px solid #fecaca', borderRadius: 16, padding: '28px 24px', textAlign: 'center' }}>
                                <AlertCircle size={32} color="#dc2626" style={{ marginBottom: 10 }} />
                                <p style={{ fontSize: 14, fontWeight: 800, color: '#991b1b', margin: '0 0 14px' }}>{loadError}</p>
                                <button onClick={() => fetchData()} style={btnPrimary}>
                                    <RefreshCw size={14} /> Retry
                                </button>
                            </div>
                        )}

                        {!loading && !loadError && courseGroupedData.allMatchingUnits.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                                <Layers size={40} style={{ margin: '0 auto 12px' }} />
                                <p style={{ fontSize: 15, fontWeight: 700 }}>No master units match your search</p>
                            </div>
                        )}

                        {!loading && !loadError && courseGroupedData.allMatchingUnits.map((unit, idx) => {
                            const assignedCourses = unit.assigned_courses || [];
                            return (
                                <div key={unit.id} className="unit-card" style={{ borderBottom: idx < courseGroupedData.allMatchingUnits.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                    <div
                                        className="unit-row"
                                        style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1fr auto', gap: 0, padding: '14px 20px', alignItems: 'center', transition: 'background 0.15s' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #fef3c7, #fde68a)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <BookMarked size={16} color="#92400e" />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{unit.name || unit.unit_name}</div>
                                                {unit.description && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{unit.description}</div>}
                                            </div>
                                        </div>

                                        <div>
                                            {(unit.code || unit.unit_code) ? (
                                                <span style={{ fontFamily: 'monospace', fontSize: 12, background: '#f1f5f9', padding: '2px 8px', borderRadius: 6, color: '#475569', fontWeight: 700 }}>{unit.code || unit.unit_code}</span>
                                            ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                                        </div>

                                        <div>
                                            {assignedCourses.length === 0 ? (
                                                <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>Unassigned</span>
                                            ) : (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                    {assignedCourses.map((c, i) => (
                                                        <span key={i} style={{ fontSize: 11, background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
                                                            {c.course_name}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div><Badge status={unit.status || 'Active'} /></div>

                                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                            {canManage && (
                                                <>
                                                    <button
                                                        title={unit.status === 'Active' ? 'Deactivate' : 'Activate'}
                                                        onClick={() => handleToggleStatus(unit)}
                                                        style={{ ...actionBtn, color: unit.status === 'Active' ? '#f59e0b' : '#16a34a' }}
                                                    >
                                                        {unit.status === 'Active' ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                                                    </button>
                                                    <button
                                                        title="Assign to Courses"
                                                        onClick={() => setModal({ type: 'assign', unit })}
                                                        style={{ ...actionBtn, color: '#3b82f6' }}
                                                    >
                                                        <Link2 size={15} />
                                                    </button>
                                                    <button
                                                        title="Edit Unit"
                                                        onClick={() => setModal({ type: 'edit', unit })}
                                                        style={{ ...actionBtn, color: '#8b5cf6' }}
                                                    >
                                                        <Edit2 size={15} />
                                                    </button>
                                                    <button
                                                        title="Delete Unit"
                                                        onClick={() => setModal({ type: 'delete', unit })}
                                                        style={{ ...actionBtn, color: '#ef4444' }}
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* VIEW MODE 3: UNIT OFFERINGS (one unit → one lecturer → one group) */}
                {viewMode === 'OFFERINGS' && (
                    <div style={{ display: 'grid', gap: 16 }}>
                        {canManage && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button onClick={() => setModal({ type: 'offering' })} style={btnPrimary}>
                                    <Plus size={14} /> New Offering
                                </button>
                            </div>
                        )}

                        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr 1.4fr 0.8fr 0.7fr auto', gap: 0, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 20px' }}>
                                {['Unit / Offering', 'Lecturer', 'Scope', 'Students', 'Marks', 'Actions'].map(h => (
                                    <div key={h} style={thStyle}>{h}</div>
                                ))}
                            </div>

                            {loading && (
                                <div style={{ display: 'grid', gap: 10, padding: '4px 0' }} aria-label="Loading offerings" role="status">
                                    {[0, 1, 2, 3].map(i => (
                                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr 1.4fr 0.8fr 0.7fr', gap: 16, padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
                                            <Skeleton w="60%" h={15} /><Skeleton w="50%" h={13} /><Skeleton w="45%" h={13} />
                                            <Skeleton w="30%" h={13} /><Skeleton w="30%" h={13} />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {!loading && !loadError && filteredOfferings.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                                    <Users size={40} style={{ margin: '0 auto 12px' }} />
                                    <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>No offerings match your search</p>
                                    <p style={{ fontSize: 12, marginTop: 6 }}>
                                        An offering is one lecturer teaching one unit to one group — create one to mark a shared class such as Communication Skills.
                                    </p>
                                </div>
                            )}

                            {!loading && !loadError && filteredOfferings.map((o, idx) => (
                                <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr 1.4fr 0.8fr 0.7fr auto', gap: 0, padding: '14px 20px', alignItems: 'center', borderBottom: idx < filteredOfferings.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{o.offering_name}</div>
                                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                                            {o.unit_code ? `${o.unit_code} · ` : ''}{o.group_label}{o.term ? ` · ${o.term}` : ''}{o.is_default ? ' · auto-created default' : ''}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: o.faculty_name ? '#1e293b' : '#f59e0b' }}>
                                        {o.faculty_name || 'No lecturer'}
                                    </div>
                                    <div>
                                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: o.course_id ? '#e0f2fe' : '#dcfce7', color: o.course_id ? '#0369a1' : '#166534' }}>
                                            {o.course_name || o.course_id || 'All courses'}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: Number(o.student_count) > 0 ? '#1e293b' : '#f59e0b' }}>{o.student_count}</div>
                                    <div style={{ fontSize: 12, color: '#64748b' }}>{o.marks_count}</div>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                        {canManage && (
                                            <>
                                                <button onClick={() => setModal({ type: 'offeringRoster', offering: o })} style={actionBtn} title="Manage class roster">
                                                    <Users size={14} color="#800000" />
                                                </button>
                                                <button onClick={() => setModal({ type: 'offering', offering: o })} style={actionBtn} title="Edit offering">
                                                    <Edit2 size={14} color="#64748b" />
                                                </button>
                                                <button
                                                    onClick={() => setModal({ type: 'deleteOffering', offering: o })}
                                                    style={actionBtn} title="Delete offering"
                                                >
                                                    <Trash2 size={14} color="#dc2626" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            {modal?.type === 'add' && (
                <UnitFormModal onClose={() => setModal(null)} onSave={handleSaveUnit} />
            )}
            {modal?.type === 'edit' && (
                <UnitFormModal unit={modal.unit} onClose={() => setModal(null)} onSave={handleSaveUnit} />
            )}
            {modal?.type === 'assign' && (
                <AssignCoursesModal unit={modal.unit} allCourses={courses} onClose={() => setModal(null)} onDone={handleAssignDone} />
            )}
            {modal?.type === 'quickAttachCourse' && (
                <QuickAttachUnitsModal course={modal.course} allUnits={units} onClose={() => setModal(null)} onDone={handleAssignDone} />
            )}
            {modal?.type === 'assignTeacher' && (
                <AssignTeacherModal
                    unit={modal.unit}
                    course={modal.course}
                    allFaculty={faculty}
                    onClose={() => setModal(null)}
                    onDone={handleTeacherAssignDone}
                />
            )}
            {modal?.type === 'delete' && (
                <DeleteModal unit={modal.unit} onClose={() => setModal(null)} onDeleted={handleDeleted} />
            )}
            {modal?.type === 'offering' && (
                <OfferingFormModal
                    offering={modal.offering}
                    initialUnitId={modal.unit_id}
                    units={units}
                    courses={courses}
                    faculty={faculty}
                    onClose={() => setModal(null)}
                    onSaved={handleOfferingSaved}
                />
            )}
            {modal?.type === 'offeringRoster' && (
                <OfferingRosterModal offering={modal.offering} onClose={() => setModal(null)} onSaved={handleRosterSaved} />
            )}
            {modal?.type === 'deleteOffering' && (
                <DeleteOfferingModal offering={modal.offering} onClose={() => setModal(null)} onDeleted={handleOfferingDeleted} />
            )}

            {/* Toast */}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}

const thStyle = {
    padding: '10px 16px', fontSize: 11, fontWeight: 800, color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: '0.06em',
};
const tdStyle = {
    padding: '12px 16px', fontSize: 13, color: '#334155', verticalAlign: 'middle',
};
