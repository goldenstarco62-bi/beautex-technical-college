import { useState, useEffect, useRef } from 'react';
import { Search, User, Book, Package, Users, X, Command, ArrowRight, CornerDownLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI } from '../../services/api';

export default function SearchHub({ isOpen, onClose }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setResults([]);
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    useEffect(() => {
        const handler = setTimeout(async () => {
            if (query.length > 1) {
                setLoading(true);
                try {
                    const { data } = await dashboardAPI.search(query);
                    setResults(data.results || []);
                } catch (error) {
                    console.error('Search error:', error);
                } finally {
                    setLoading(false);
                }
            } else {
                setResults([]);
            }
        }, 300);

        return () => clearTimeout(handler);
    }, [query]);

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % results.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
        } else if (e.key === 'Enter' && results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    const handleSelect = (item) => {
        onClose();
        navigate(item.link);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
            <div className="absolute inset-0 bg-maroon/20 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />
            
            <div className="relative w-full max-w-2xl bg-white dark:bg-[#111] rounded-[2.5rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] border border-maroon/10 dark:border-white/5 overflow-hidden animate-in zoom-in-95 slide-in-from-top-10 duration-300">
                {/* Search Input */}
                <div className="relative flex items-center p-6 border-b border-gray-100 dark:border-white/5">
                    <Search className="w-6 h-6 text-maroon/40 dark:text-gold/40" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search students, courses, or inventory..."
                        className="flex-1 bg-transparent border-none outline-none px-4 text-lg font-bold text-gray-800 dark:text-white placeholder-gray-300 dark:placeholder-gray-600"
                    />
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ESC</span>
                    </div>
                </div>

                {/* Results List */}
                <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {query.length > 1 ? (
                        loading ? (
                            <div className="p-12 text-center">
                                <div className="w-8 h-8 border-4 border-maroon/10 border-t-maroon rounded-full animate-spin mx-auto mb-4" />
                                <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Crawling Neural Registry...</p>
                            </div>
                        ) : results.length > 0 ? (
                            <div className="p-3">
                                {results.map((item, index) => (
                                    <button
                                        key={`${item.type}-${item.id}`}
                                        onClick={() => handleSelect(item)}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                        className={`w-full flex items-center gap-4 p-4 rounded-[1.5rem] transition-all text-left group ${
                                            selectedIndex === index 
                                                ? 'bg-maroon text-gold shadow-xl shadow-maroon/20 translate-x-2' 
                                                : 'hover:bg-gray-50 dark:hover:bg-white/5'
                                        }`}
                                    >
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
                                            selectedIndex === index ? 'bg-white/20' : 'bg-gray-100 dark:bg-white/5'
                                        }`}>
                                            {item.type === 'student' && <User className="w-5 h-5" />}
                                            {item.type === 'course' && <Book className="w-5 h-5" />}
                                            {item.type === 'inventory' && <Package className="w-5 h-5" />}
                                            {item.type === 'faculty' && <Users className="w-5 h-5" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className={`text-sm font-black uppercase tracking-tight truncate ${
                                                selectedIndex === index ? 'text-gold' : 'text-gray-800 dark:text-white'
                                            }`}>
                                                {item.name}
                                            </h4>
                                            <p className={`text-[10px] font-bold uppercase tracking-widest ${
                                                selectedIndex === index ? 'text-gold/60' : 'text-gray-400'
                                            }`}>
                                                {item.type} • {item.sub}
                                            </p>
                                        </div>
                                        {selectedIndex === index && (
                                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-300">
                                                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Open</span>
                                                <CornerDownLeft className="w-4 h-4 opacity-60" />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="p-12 text-center">
                                <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-4">
                                    <X className="w-8 h-8 text-gray-300 dark:text-gray-700" />
                                </div>
                                <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">No results found for "{query}"</p>
                            </div>
                        )
                    ) : (
                        <div className="p-8">
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: 'Search Students', icon: User, q: 'st:' },
                                    { label: 'Browse Courses', icon: Book, q: 'co:' },
                                    { label: 'Check Stock', icon: Package, q: 'inv:' },
                                    { label: 'Staff Registry', icon: Users, q: 'fac:' },
                                ].map((hint) => (
                                    <button
                                        key={hint.label}
                                        onClick={() => setQuery(hint.q)}
                                        className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl hover:bg-maroon hover:text-gold transition-all group border border-black/5 dark:border-white/5 text-left"
                                    >
                                        <hint.icon className="w-4 h-4 text-maroon dark:text-gold group-hover:text-gold transition-colors" />
                                        <span className="text-[10px] font-black uppercase tracking-widest opacity-60 group-hover:opacity-100">{hint.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50/50 dark:bg-white/[0.02] border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-1 bg-white dark:bg-white/10 rounded border border-black/10 dark:border-white/10 text-[9px] font-bold">↑↓</span>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Navigate</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-1 bg-white dark:bg-white/10 rounded border border-black/10 dark:border-white/10 text-[9px] font-bold">ENTER</span>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Select</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Command className="w-3.5 h-3.5 text-gray-300" />
                        <span className="text-[9px] font-black text-gray-300 uppercase tracking-[0.2em]">Spotlight Engine v2.0</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
