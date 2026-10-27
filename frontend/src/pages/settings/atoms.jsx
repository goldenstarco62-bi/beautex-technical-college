import React, { useState, useId } from 'react';
import { CheckCircle, XCircle, Eye, EyeOff, Lock } from 'lucide-react';

// ─── Design Tokens ─────────────────────────────────────────────────────────────
export const GOLD = '#c8a94a';
export const GOLD_BRIGHT = '#FFD700';

// ─── Small Reusable Atoms ─────────────────────────────────────────────────────
// All defined at module scope: components defined inside a render function are
// remounted on every keystroke, which makes text fields lose focus mid-typing.

export const Toggle = ({ value, onChange, locked, id }) => (
    <button id={id} onClick={() => !locked && onChange(!value)} disabled={locked} aria-pressed={!!value}
        className={`relative inline-flex items-center h-6 w-12 rounded-full transition-all duration-300 focus:outline-none ${value ? 'bg-green-500' : 'bg-gray-300 dark:bg-white/20'} ${locked ? 'opacity-50 cursor-not-allowed' : ''}`}>
        <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform duration-300 ${value ? 'translate-x-7' : 'translate-x-1'}`} />
    </button>
);

export const StatusBadge = ({ active, labelOn, labelOff }) => (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${active ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400'}`}>
        {active ? <CheckCircle className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
        {active ? labelOn : labelOff}
    </span>
);

export const FieldRow = ({ label, description, children, locked }) => {
    // Associate the label with its control via a generated id. A single child
    // element receives the id; leaf atoms (Inp/PwdField/TA/Sel/Toggle) forward
    // it to the real input/button so screen readers announce the label.
    const fieldId = useId();
    const arr = React.Children.toArray(children);
    const single = arr.length === 1 && React.isValidElement(arr[0]);
    const control = single ? React.cloneElement(arr[0], { id: fieldId }) : children;
    return (
        <div className={`flex flex-col md:flex-row md:items-start justify-between py-4 border-b border-gray-100 dark:border-white/5 last:border-0 gap-3 ${locked ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="md:w-56 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                    <label htmlFor={single ? fieldId : undefined} className="text-[10px] font-black text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">{label}</label>
                    {locked && <Lock className="w-3 h-3 text-gray-400" />}
                </div>
                {description && <p className="text-[9px] text-gray-400 font-medium mt-0.5 leading-relaxed">{description}</p>}
            </div>
            <div className="flex-1 max-w-md w-full">{control}</div>
        </div>
    );
};

export const Inp = ({ value, onChange, placeholder, type = 'text', readOnly, mono, id }) => (
    <input id={id} type={type} value={value || ''} onChange={onChange} placeholder={placeholder} readOnly={readOnly}
        className={`w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-maroon/30 focus:border-maroon transition-all ${mono ? 'font-mono' : ''} ${readOnly ? 'cursor-not-allowed text-gray-400' : ''}`} />
);

export const PwdField = ({ value, onChange, readOnly, id }) => {
    const [show, setShow] = useState(false);
    return (
        <div className="relative">
            <input id={id} type={show ? 'text' : 'password'} value={value || ''} onChange={onChange} readOnly={readOnly}
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2.5 pr-9 text-xs font-mono outline-none focus:ring-2 focus:ring-maroon/30 focus:border-maroon transition-all" />
            {!readOnly && (
                <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-maroon">
                    {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
            )}
        </div>
    );
};

export const TagInputList = ({ value, onChange, placeholder, readOnly, id }) => {
    const tags = (value || '').split(',').map(t => t.trim()).filter(Boolean);
    const [newTag, setNewTag] = useState('');
    const handleAdd = () => {
        if (!newTag.trim()) return;
        if (tags.includes(newTag.trim())) return;
        const updated = [...tags, newTag.trim()].join(', ');
        onChange(updated);
        setNewTag('');
    };
    const handleRemove = (tagToRemove) => {
        const updated = tags.filter(t => t !== tagToRemove).join(', ');
        onChange(updated);
    };
    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5 p-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl min-h-[50px]">
                {tags.map(t => (
                    <span key={t} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-maroon/5 text-maroon dark:bg-gold/10 dark:text-gold border border-maroon/10 dark:border-gold/20">
                        {t}
                        {!readOnly && (
                            <button type="button" onClick={() => handleRemove(t)} className="hover:text-red-500 font-extrabold text-[11px] leading-none transition-colors">×</button>
                        )}
                    </span>
                ))}
                {tags.length === 0 && <span className="text-[10px] text-zinc-400 font-semibold self-center px-1">No items defined.</span>}
            </div>
            {!readOnly && (
                <div className="flex gap-2">
                    <input id={id} type="text" value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }} placeholder={placeholder || "Add item..."} className="flex-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-maroon/30 focus:border-maroon transition-all" />
                    <button type="button" onClick={handleAdd} className="bg-maroon hover:opacity-90 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border border-gold/30 transition-all shadow-sm">Add</button>
                </div>
            )}
        </div>
    );
};

export const TA = ({ value, onChange, rows = 3, id }) => (
    <textarea id={id} value={value || ''} onChange={onChange} rows={rows}
        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-maroon/30 focus:border-maroon transition-all resize-none" />
);

export const Sel = ({ value, onChange, children, id }) => (
    <select id={id} value={value || ''} onChange={onChange}
        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-maroon/30 focus:border-maroon transition-all">
        {children}
    </select>
);
