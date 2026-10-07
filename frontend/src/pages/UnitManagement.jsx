import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { masterUnitsAPI, coursesAPI } from '../services/api';
import {
    Plus, Edit2, Trash2, Search, BookOpen, CheckCircle2,
    XCircle, AlertCircle, X, Layers, Link2, Unlink,
    ChevronDown, ChevronUp, ToggleLeft, ToggleRight, RefreshCw,
    BookMarked, Save, Filter, LayoutGrid, ListFilter, FolderOpen,
    Building2, Award
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

            let failedErr = null;
            for (const courseId of toAdd) {
                try {
                    await masterUnitsAPI.assignToCourse(unit.id, courseId);
                } catch (err) {
                    failedErr = err.response?.data?.error || err.message;
                }
            }
            for (const courseId of toRemove) {
                try {
                    await masterUnitsAPI.removeFromCourse(unit.id, courseId);
                } catch (err) {
                    failedErr = err.response?.data?.error || err.message;
                }
            }
            if (failedErr) {
                setError(failedErr);
                return;
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

            let failedErr = null;
            for (const unitId of toAdd) {
                try {
                    await masterUnitsAPI.assignToCourse(unitId, course.id);
                } catch (err) {
                    failedErr = err.response?.data?.error || err.message;
                }
            }
            for (const unitId of toRemove) {
                try {
                    await masterUnitsAPI.removeFromCourse(unitId, course.id);
                } catch (err) {
                    failedErr = err.response?.data?.error || err.message;
                }
            }
            if (failedErr) {
                setError(failedErr);
                return;
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
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [selectedCourseFilter, setSelectedCourseFilter] = useState('ALL'); // 'ALL' | 'UNASSIGNED' | courseId
    const [viewMode, setViewMode] = useState('BY_COURSE'); // 'BY_COURSE' | 'ALL_UNITS'
    const [toast, setToast] = useState(null);
    const [modal, setModal] = useState(null); // { type: 'add'|'edit'|'assign'|'delete'|'quickAttachCourse', unit?, course? }
    const [expandedCourseId, setExpandedCourseId] = useState(null);

    const showToast = (message, type = 'success') => setToast({ message, type });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [unitsRes, coursesRes] = await Promise.allSettled([
                masterUnitsAPI.getAll({ status: filterStatus || undefined, search: search || undefined }),
                coursesAPI.getAll(),
            ]);
            if (unitsRes.status === 'fulfilled') setUnits(Array.isArray(unitsRes.value.data) ? unitsRes.value.data : []);
            if (coursesRes.status === 'fulfilled') {
                const data = coursesRes.value.data;
                setCourses(Array.isArray(data) ? data : (Array.isArray(data?.courses) ? data.courses : []));
            }
        } catch (err) {
            showToast('Failed to load data', 'error');
        } finally {
            setLoading(false);
        }
    }, [search, filterStatus]);

    useEffect(() => { fetchData(); }, [fetchData]);

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
                assignedList.forEach(ac => {
                    const cId = String(ac.course_id);
                    if (courseMap[cId]) {
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
                .unit-card { animation: slideUp 0.2s ease-out; }
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
                    </div>

                    {/* Controls (Search & Status Filter) */}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
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

                {/* Course Filter Quick Tabs (Available in both views) */}
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

                {/* VIEW MODE 1: ORGANIZED BY COURSE */}
                {viewMode === 'BY_COURSE' && (
                    <div style={{ display: 'grid', gap: 20 }}>
                        {loading && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 60, gap: 12, color: '#94a3b8' }}>
                                <RefreshCw size={20} className="animate-spin" />
                                <span style={{ fontSize: 14, fontWeight: 600 }}>Loading course units…</span>
                            </div>
                        )}

                        {/* Unassigned Units Block if selected or viewing ALL */}
                        {(selectedCourseFilter === 'ALL' || selectedCourseFilter === 'UNASSIGNED') && courseGroupedData.unassigned.length > 0 && (
                            <div style={{ background: '#fff', borderRadius: 16, border: '1.5px dashed #f59e0b', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                                <div style={{ background: '#fffbeb', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #fef3c7' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <AlertCircle size={18} color="#d97706" />
                                        <div>
                                            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#92400e', margin: 0 }}>Unassigned Master Units ({courseGroupedData.unassigned.length})</h3>
                                            <p style={{ fontSize: 12, color: '#b45309', margin: 0 }}>Units created in library that are not attached to any course yet</p>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ padding: '8px 16px' }}>
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
                            </div>
                        )}

                        {/* Course Cards Grid */}
                        {!loading && courseGroupedData.groups.length === 0 && selectedCourseFilter !== 'UNASSIGNED' && (
                            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', color: '#94a3b8' }}>
                                <BookOpen size={40} style={{ margin: '0 auto 12px' }} />
                                <p style={{ fontSize: 15, fontWeight: 700 }}>No courses match your filter</p>
                            </div>
                        )}

                        {!loading && courseGroupedData.groups.map(({ course, units: courseUnits }) => (
                            <div key={course.id} style={{ background: '#fff', borderRadius: 18, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                                {/* Course Header Card */}
                                <div style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #800000, #a00000)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD700', boxShadow: '0 4px 12px rgba(128,0,0,0.2)' }}>
                                            <BookOpen size={20} />
                                        </div>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#1e293b', margin: 0 }}>{course.name}</h3>
                                                <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(128,0,0,0.08)', color: '#800000', padding: '2px 8px', borderRadius: 6 }}>
                                                    {courseUnits.length} Unit{courseUnits.length !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                            {course.department && <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>{course.department} Department</p>}
                                        </div>
                                    </div>

                                    {canManage && (
                                        <button
                                            onClick={() => setModal({ type: 'quickAttachCourse', course })}
                                            style={{ ...btnSecondary, background: '#fff', color: '#800000', borderColor: 'rgba(128,0,0,0.3)', fontWeight: 700 }}
                                        >
                                            <Plus size={14} /> Attach / Manage Units
                                        </button>
                                    )}
                                </div>

                                {/* Units Table for this course */}
                                <div>
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
                                                        <th style={thStyle}>Status</th>
                                                        <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {courseUnits.map(unit => (
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
                                                            <td style={tdStyle}><Badge status={unit.status || 'Active'} /></td>
                                                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                                                                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                                                    {canManage && (
                                                                        <>
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
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
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
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 60, gap: 12, color: '#94a3b8' }}>
                                <RefreshCw size={20} className="animate-spin" />
                                <span style={{ fontSize: 14, fontWeight: 600 }}>Loading units…</span>
                            </div>
                        )}

                        {!loading && courseGroupedData.allMatchingUnits.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                                <Layers size={40} style={{ margin: '0 auto 12px' }} />
                                <p style={{ fontSize: 15, fontWeight: 700 }}>No master units match your search</p>
                            </div>
                        )}

                        {!loading && courseGroupedData.allMatchingUnits.map((unit, idx) => {
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
            {modal?.type === 'delete' && (
                <DeleteModal unit={modal.unit} onClose={() => setModal(null)} onDeleted={handleDeleted} />
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
