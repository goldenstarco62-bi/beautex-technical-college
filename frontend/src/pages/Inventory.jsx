import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { inventoryAPI } from '../services/api';
import {
    Package, BarChart3, Boxes, TrendingDown, ArrowUpFromLine, Clock, Calendar, 
    AlertCircle, AlertTriangle, DollarSign, Activity, ShoppingCart, Truck,
    Tags, Wrench, FileText, ClipboardList, Plus, Search, Layers, X, Eye, 
    Pencil, Trash2, CheckCircle2, RefreshCcw, ArrowDownToLine, MapPin, PackageOpen,
    Download, Scan, Filter, ChevronRight, ChevronLeft, MoreVertical, LayoutGrid, List, Info, TrendingUp,
    Box, FileSpreadsheet, User, Building2, MessageSquare, CalendarDays, ArrowLeftRight
} from 'lucide-react';

const Toast = ({ message, type, onClose }) => (
    <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-4 px-8 py-4 rounded-2xl shadow-[0_20px_50px_-10px_rgba(0,0,0,0.3)] border animate-in slide-in-from-bottom-10 duration-500 ${
        type === 'error' ? 'bg-rose-500 text-white border-rose-400' : 'bg-[#111] text-gold border-white/10'
    }`}>
        <p className="text-[10px] font-black uppercase tracking-[0.2em]">{message}</p>
        <button onClick={onClose} className="p-1 hover:rotate-90 transition-transform"><X className="w-4 h-4" /></button>
    </div>
);

const Modal = ({ title, onClose, children }) => (
    <div className="fixed inset-0 bg-[#00000040] dark:bg-[#00000080] backdrop-blur-xl z-[100] flex items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
        <div className="bg-white dark:bg-[#111] rounded-3xl shadow-[0_40px_100px_-20px_rgba(0,0,0,0.3)] w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/40 dark:border-white/5 ring-1 ring-black/5">
            <div className="px-6 py-4 flex justify-between items-center border-b border-gray-50/50 dark:border-white/5 bg-gray-50/30 dark:bg-white/[0.02]">
                <div>
                    <h3 className="text-sm font-black text-maroon dark:text-gold uppercase tracking-[0.3em] mb-1">{title}</h3>
                    <div className="h-1 w-10 bg-maroon rounded-full" />
                </div>
                <button onClick={onClose} className="group p-3 bg-white dark:bg-black hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 rounded-2xl transition-all shadow-sm">
                    <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                </button>
            </div>
            <div className="p-6">{children}</div>
        </div>
    </div>
);

const InputField = ({ label, ...props }) => (
    <div>
        <label className="block text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 ml-1">{label}</label>
        <input className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[11px] font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-maroon/20 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600" {...props} />
    </div>
);

const SelectField = ({ label, children, ...props }) => (
    <div>
        <label className="block text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 ml-1">{label}</label>
        <select className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[11px] font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-maroon/20 transition-all appearance-none" {...props}>
            {children}
        </select>
    </div>
);

function ItemsTab() {
    const { user } = useAuth();
    const isAdmin = ['admin', 'superadmin'].includes((user?.role || '').toLowerCase());
    const [items, setItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [entryMode, setEntryMode] = useState('single');
    const [selectedDepartment, setSelectedDepartment] = useState(null);
    const [formData, setFormData] = useState({ 
        name: '', 
        category: '', 
        quantity: 0, 
        unit_type: 'Piece', 
        minimum_stock_level: 5, 
        location: '', 
        purchase_price: 0, 
        status: 'Available',
        date_purchased: new Date().toISOString().split('T')[0],
        serial_number: '',
        image_url: ''
    });
    const [bulkItems, setBulkItems] = useState([
        { name: '', quantity: 1, unit_type: 'Piece', purchase_price: 0, minimum_stock_level: 5 }
    ]);
    const [filterCategory, setFilterCategory] = useState('ALL');
    const [filterDate, setFilterDate] = useState('');
    const [bulkDate, setBulkDate] = useState(new Date().toISOString().split('T')[0]);
    const [toast, setToast] = useState(null);
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');
    const [selectedItem, setSelectedItem] = useState(null);
    const [moveDeptItem, setMoveDeptItem] = useState(null);
    const [moveDeptDest, setMoveDeptDest] = useState('');
    const [moveDeptLocation, setMoveDeptLocation] = useState('');
    const [clientPage, setClientPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const ITEMS_PER_PAGE = 10;

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    const loadData = useCallback(() => {
        setLoading(true);
        // Use server-side filters and pagination
        const params = { 
            search, 
            page: clientPage, 
            limit: ITEMS_PER_PAGE, 
            sortBy, 
            sortOrder,
            category_id: filterCategory !== 'ALL' ? filterCategory : undefined,
            purchase_date: filterDate || undefined
        };

        Promise.all([
            inventoryAPI.getItems(params),
            inventoryAPI.getCategories(),
            inventoryAPI.getLocations()
        ]).then(([i, c, l]) => {
            const result = i.data;
            setItems(result.data || []);
            setTotalItems(result.pagination?.total || (result.data ? result.data.length : 0));
            setCategories(c.data);
            setLocations(l.data);
        }).catch(err => {
            showToast('LOGISTICS SYNC FAILED', 'error');
            console.error(err);
        }).finally(() => setLoading(false));
    }, [search, sortBy, sortOrder, clientPage, filterCategory]);

    useEffect(() => { loadData(); }, [loadData]);
    // Reset to page 1 whenever any filter changes
    useEffect(() => { setClientPage(1); }, [search, filterCategory, filterDate, sortBy, sortOrder]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (formData.id) {
                await inventoryAPI.updateItem(formData.id, formData);
                showToast('ASSET DATA RECONFIGURED');
            } else {
                await inventoryAPI.createItem(formData);
                showToast('ASSET SECURED IN VAULT');
            }
            setShowAddModal(false);
            loadData();
            setFormData({ name: '', category: '', quantity: 0, unit_type: 'Piece', minimum_stock_level: 5, location: '', purchase_price: 0, status: 'Available', date_purchased: new Date().toISOString().split('T')[0], serial_number: '', image_url: '' });
        } catch (e) { 
            const msg = e.response?.data?.details || e.response?.data?.error || 'Failed to save';
            showToast(msg.toUpperCase(), 'error'); 
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) return;
        try {
            await inventoryAPI.deleteItem(id);
            showToast('ASSET PURGED FROM VAULT');
            loadData();
        } catch (e) {
            const msg = e.response?.data?.error || 'Failed to delete item';
            showToast(msg.toUpperCase(), 'error');
        }
    };

    const DEPARTMENTS = {
        ICT: {
            label: 'ICT Department', color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20',
            category: 'ICT', location: 'ICT Lab', unit_type: 'Piece', emoji: '💻',
            items: ['Laptop', 'Desktop Computer', 'Printer', 'Projector', 'Router', 'Network Switch', 'UPS', 'Monitor', 'Keyboard', 'Mouse', 'Flash Drive', 'External HDD', 'Webcam', 'Headset', 'Ethernet Cable', 'HDMI Cable', 'Power Strip', 'Ink Cartridge', 'Toner Cartridge', 'Mouse Pad']
        },
        BEAUTY: {
            label: 'Beauty Therapy', color: 'text-pink-500', bg: 'bg-pink-500/10', border: 'border-pink-500/20',
            category: 'Beauty Therapy', location: 'Beauty Lab', unit_type: 'Bottle', emoji: '💄',
            items: ['Facial Cream', 'Moisturizer', 'Facial Toner', 'Cleanser', 'Face Mask', 'Exfoliator', 'Skin Serum', 'Sunscreen', 'Foundation', 'Concealer', 'Mascara', 'Lipstick', 'Eye Shadow Palette', 'Nail Polish', 'Cotton Pads', 'Beauty Sponge', 'Facial Brush Set', 'Face Steamer', 'Magnifying Lamp', 'Treatment Chair']
        },
        HAIR: {
            label: 'Hair Dressing', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20',
            category: 'Hair Dressing', location: 'Hair Salon', unit_type: 'Bottle', emoji: '✂️',
            items: ['Shampoo', 'Conditioner', 'Hair Dye', 'Bleaching Powder', 'Developer', 'Hair Relaxer', 'Hair Oil', 'Hair Serum', 'Hairspray', 'Styling Gel', 'Hair Wax', 'Curling Iron', 'Flat Iron', 'Hair Dryer', 'Scissors', 'Hair Clippers', 'Combs Set', 'Hair Clips', 'Aluminium Foils', 'Mixing Bowl']
        },
        PRODUCTION: {
            label: 'Production Unit', color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20',
            category: 'Production Unit', location: 'Production Workshop', unit_type: 'Piece', emoji: '🏭',
            items: ['Raw Material', 'Packaging Box', 'Adhesive Tape', 'Work Bench', 'Safety Gear', 'Measuring Tape', 'Cutter', 'Mold', 'Finishing Kit']
        }
    };

    const handleBulkSubmit = async () => {
        const dept = DEPARTMENTS[selectedDepartment];
        const validItems = bulkItems.filter(i => i.name.trim());
        if (!validItems.length) { showToast('ADD AT LEAST ONE ITEM', 'error'); return; }
        try {
            await Promise.all(validItems.map(item => inventoryAPI.createItem({
                ...item,
                category: dept?.category || '',
                location: dept?.location || '',
                status: 'Available',
                date_purchased: bulkDate || new Date().toISOString().split('T')[0],
                serial_number: '',
                image_url: ''
            })));
            showToast(`${validItems.length} ASSETS SECURED IN VAULT`);
            setShowAddModal(false);
            setBulkItems([{ name: '', quantity: 1, unit_type: 'Piece', purchase_price: 0, minimum_stock_level: 5 }]);
            setBulkDate(new Date().toISOString().split('T')[0]);
            setSelectedDepartment(null);
            setEntryMode('single');
            loadData();
        } catch (e) {
            const msg = e.response?.data?.error || 'Bulk entry failed';
            showToast(msg.toUpperCase(), 'error');
        }
    };

    const DEPT_OPTIONS = [
        { label: 'ICT Department', category: 'ICT', location: 'ICT Lab', color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', emoji: '💻' },
        { label: 'Beauty Therapy', category: 'Beauty Therapy', location: 'Beauty Lab', color: 'text-pink-500', bg: 'bg-pink-500/10', border: 'border-pink-500/20', emoji: '💄' },
        { label: 'Hair Dressing', category: 'Hair Dressing', location: 'Hair Salon', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', emoji: '✂️' },
        { label: 'Administration', category: 'Administration', location: 'Admin Office', color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20', emoji: '🏛️' },
        { label: 'Barbering', category: 'Barbering', location: 'Barbering Lab', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', emoji: '🪒' },
        { label: 'Production Unit', category: 'Production Unit', location: 'Production Workshop', color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20', emoji: '🏭' },
    ];

    const handleMoveDept = async () => {
        if (!moveDeptItem || !moveDeptDest) return;
        const dept = DEPT_OPTIONS.find(d => d.category === moveDeptDest);
        try {
            await inventoryAPI.updateItem(moveDeptItem.id, {
                ...moveDeptItem,
                category: moveDeptDest,
                location: moveDeptLocation || dept?.location || '',
            });
            showToast(`${moveDeptItem.name.toUpperCase()} MOVED TO ${moveDeptDest.toUpperCase()}`);
            setMoveDeptItem(null);
            setMoveDeptDest('');
            setMoveDeptLocation('');
            loadData();
        } catch (e) {
            showToast('FAILED TO MOVE ITEM', 'error');
        }
    };

    const handleExport = () => {
        const headers = ['Name', 'Category', 'Quantity', 'Location', 'Price', 'Serial Number'];
        const csvContent = [
            headers.join(','),
            ...items.map(i => [i.name, i.category_name, i.quantity, i.location_name, i.purchase_price, i.serial_number].join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inventory_manifest_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        showToast('MANIFEST EXPORTED');
    };

    const toggleSort = (val) => {
        if (sortBy === val) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        else {
            setSortBy(val);
            setSortOrder('asc');
        }
    };

    // Pagination calculation
    const totalClientPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
    const pagedItems = items; // Already paginated by server

    const PaginationControl = () => {
        if (totalClientPages <= 1) return null;

        return (
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50/30 dark:bg-white/[0.01] border-t border-gray-100 dark:border-white/5">
                <div className="flex items-center gap-2">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Showing <span className="text-maroon dark:text-gold">
                            {Math.min(totalItems, (clientPage - 1) * ITEMS_PER_PAGE + pagedItems.length)}
                        </span> of <span className="text-maroon dark:text-gold">{totalItems}</span> Assets
                    </p>
                </div>
                <div className="flex items-center gap-1">
                    <button 
                        disabled={clientPage === 1}
                        onClick={() => setClientPage(p => Math.max(1, p - 1))}
                        className="p-2 rounded-xl hover:bg-maroon hover:text-gold disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-inherit transition-all"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    {[...Array(totalClientPages)].map((_, i) => (
                        <button 
                            key={i}
                            onClick={() => setClientPage(i + 1)}
                            className={`w-9 h-9 rounded-xl text-[10px] font-black transition-all ${
                                clientPage === i + 1 ? 'bg-maroon text-gold shadow-lg shadow-maroon/20' : 'hover:bg-maroon/5 text-gray-400 hover:text-maroon'
                            }`}
                        >
                            {i + 1}
                        </button>
                    ))}
                    <button 
                        disabled={clientPage === totalClientPages}
                        onClick={() => setClientPage(p => Math.min(totalClientPages, p + 1))}
                        className="p-2 rounded-xl hover:bg-maroon hover:text-gold disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-inherit transition-all"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-10 animate-in slide-in-from-bottom-8 duration-700">
            <div className="flex flex-col lg:flex-row gap-4 items-stretch justify-between">
                <div className="flex flex-col md:flex-row gap-3 flex-1">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-maroon transition-all" />
                        <input 
                            type="text" placeholder="QUERY LOGISTICS CLOUD..." 
                            className="w-full pl-12 pr-6 py-3 bg-white dark:bg-[#111] border border-gray-100 dark:border-white/5 rounded-xl text-[9px] font-black tracking-[0.2em] focus:outline-none focus:ring-4 focus:ring-maroon/5 transition-all shadow-sm ring-1 ring-black/5"
                            value={search} onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-1.5 p-1.5 bg-gray-50/50 dark:bg-white/[0.02] rounded-xl border border-black/5 dark:border-white/5 flex-wrap">
                        {[
                            { id: 'ALL',   label: 'All' },
                            { id: 'BEAUTY', label: 'Beauty' },
                            { id: 'HAIR',   label: 'Hair' },
                            { id: 'ICT',    label: 'ICT' },
                            { id: 'ADMIN',  label: 'Admin' },
                        ].map(({ id, label }) => (
                            <button 
                                key={id}
                                onClick={() => setFilterCategory(id)}
                                className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${
                                    filterCategory === id ? 'bg-maroon text-gold shadow-lg shadow-maroon/20' : 'text-gray-400 hover:text-maroon'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    {/* Date Filter */}
                    <div className="relative group flex items-center gap-2 bg-white dark:bg-[#111] border border-gray-100 dark:border-white/5 rounded-xl px-4 shadow-sm ring-1 ring-black/5">
                        <CalendarDays className="w-4 h-4 text-gray-400 group-focus-within:text-maroon shrink-0 transition-colors" />
                        <input
                            type="date"
                            className="py-3 bg-transparent text-[9px] font-black tracking-[0.15em] text-gray-600 dark:text-gray-300 focus:outline-none w-[140px] cursor-pointer"
                            value={filterDate}
                            onChange={e => setFilterDate(e.target.value)}
                            title="Filter by purchase date"
                        />
                        {filterDate && (
                            <button
                                onClick={() => setFilterDate('')}
                                className="ml-1 p-1 hover:text-maroon text-gray-300 transition-colors rounded-lg"
                                title="Clear date filter"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                </div>
                {isAdmin && (
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => showToast('Asset Scanner Initializing...', 'success')}
                            className="p-3 bg-white dark:bg-[#111] text-gray-400 hover:text-maroon border border-black/5 dark:border-white/5 rounded-xl transition-all"
                        >
                            <Scan className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={handleExport}
                            className="p-3 bg-white dark:bg-[#111] text-gray-400 hover:text-maroon border border-black/5 dark:border-white/5 rounded-xl transition-all"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-3 bg-gradient-to-r from-maroon to-[#800000] hover:scale-105 active:scale-95 text-gold px-4 py-3 rounded-xl shadow-lg text-[9px] font-black uppercase tracking-[0.1em] transition-all border border-white/10"
                        >
                            <Plus className="w-4 h-4 stroke-[3]" /> NEW ASSET
                        </button>
                    </div>
                )}
            </div>
            {/* Active date filter badge */}
            {filterDate && (
                <div className="flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2 px-4 py-2 bg-maroon/5 border border-maroon/10 rounded-xl">
                        <CalendarDays className="w-3.5 h-3.5 text-maroon" />
                        <span className="text-[9px] font-black text-maroon uppercase tracking-widest">
                            Showing assets purchased on {new Date(filterDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                        <span className="ml-2 text-[8px] px-2 py-0.5 bg-maroon text-gold rounded-full font-black">{filteredItems.length} found</span>
                        <button onClick={() => setFilterDate('')} className="ml-1 p-0.5 hover:text-maroon text-gray-400 transition-colors"><X className="w-3 h-3" /></button>
                    </div>
                </div>
            )}

            {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

            <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-100 dark:border-white/5 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.08)] overflow-hidden ring-1 ring-black/5">
                <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-50/30 dark:bg-white/[0.01] border-b border-gray-100 dark:border-white/5">
                                <th className="px-4 py-3 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] cursor-pointer hover:text-maroon transition-colors" onClick={() => toggleSort('name')}>
                                    Operational Unit {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-3 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Classification</th>
                                <th className="px-4 py-3 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] cursor-pointer hover:text-maroon transition-colors" onClick={() => toggleSort('qty')}>
                                    Status & Volume {sortBy === 'qty' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-3 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] cursor-pointer hover:text-maroon transition-colors" onClick={() => toggleSort('price')}>
                                    Valuations {sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-3 text-left text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Availability</th>
                                <th className="px-4 py-3 text-right text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Controls</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50/50 dark:divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-12 h-12 border-4 border-maroon border-t-gold rounded-2xl animate-spin shadow-xl"></div>
                                            <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.4em]">Deciphering Stock Lattice...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <PackageOpen className="w-12 h-12 text-gray-200" />
                                            <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">No assets found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : pagedItems.map(item => (
                                <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.015] transition-all duration-300 group">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-6">
                                            <div className="relative">
                                                <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-black flex items-center justify-center shadow-inner border border-black/5 dark:border-white/5 group-hover:scale-110 transition-transform overflow-hidden font-black text-maroon text-[8px]">
                                                    {item.image_url ? <img src={item.image_url} className="w-full h-full object-cover" /> : <PackageOpen className="w-7 h-7" />}
                                                </div>
                                                {item.quantity <= item.minimum_stock_level && (
                                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-2 border-white dark:border-[#111] animate-pulse" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none group-hover:text-maroon dark:group-hover:text-gold transition-colors">{item.name}</p>
                                                <div className="flex items-center gap-3 mt-1.5 opacity-60">
                                                    <p className="text-[8px] text-gray-400 font-black tracking-[0.2em] uppercase">SN: {item.serial_number || 'NORECORD'}</p>
                                                    <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                                    <p className="text-[8px] text-gray-400 font-black tracking-[0.2em] uppercase">{item.item_code}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-[9px] font-black text-maroon dark:text-gold uppercase tracking-[0.2em] opacity-80">{item.category_name}</span>
                                            <div className="flex items-center gap-1.5">
                                                <MapPin className="w-2.5 h-2.5 text-gray-400" />
                                                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{item.location_name || 'UNASSIGNED'}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-end justify-between w-36">
                                                <div className="flex flex-col">
                                                    <span className={`text-sm font-black ${item.quantity <= item.minimum_stock_level ? 'text-rose-500' : 'text-gray-900 dark:text-white'} leading-none`}>
                                                        {item.quantity}
                                                    </span>
                                                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-[0.1em] mt-1">AVAILABLE UNIT</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className={`text-[8px] font-black uppercase tracking-widest ${item.quantity <= item.minimum_stock_level ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                        {item.quantity <= item.minimum_stock_level ? 'CRITICAL' : 'OPTIMAL'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="w-36 h-1.5 bg-gray-100 dark:bg-black rounded-full overflow-hidden shadow-inner flex border border-black/5 dark:border-white/5">
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-1000 ${
                                                        item.quantity <= item.minimum_stock_level 
                                                            ? 'bg-gradient-to-r from-rose-500 to-red-400 shadow-[0_0_10px_rgba(244,63,94,0.4)]' 
                                                            : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                                                     }`}
                                                    style={{ width: `${Math.min(100, (item.quantity / (item.minimum_stock_level * 4)) * 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col items-start gap-1">
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Vault Price</p>
                                            <p className="text-[11px] font-black text-gray-800 dark:text-white uppercase tracking-tight">KSh {item.purchase_price?.toLocaleString()}</p>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2 translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                                            <button onClick={() => setSelectedItem(item)} className="w-9 h-9 bg-white dark:bg-black hover:bg-maroon hover:text-gold rounded-xl transition-all shadow-sm flex items-center justify-center border border-black/5 dark:border-white/5"><Eye className="w-3.5 h-3.5" /></button>
                                            {isAdmin && (
                                                <>
                                                    <button 
                                                        onClick={() => { setMoveDeptItem(item); setMoveDeptDest(item.category_name || ''); setMoveDeptLocation(item.location_name || ''); }}
                                                        className="w-9 h-9 bg-white dark:bg-black hover:bg-blue-500 hover:text-white rounded-xl transition-all shadow-sm flex items-center justify-center border border-black/5 dark:border-white/5"
                                                        title="Move to Department"
                                                    >
                                                        <ArrowLeftRight className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => { setFormData(item); setShowAddModal(true); }} className="w-9 h-9 bg-white dark:bg-black hover:bg-maroon hover:text-gold rounded-xl transition-all shadow-sm flex items-center justify-center border border-black/5 dark:border-white/5"><Pencil className="w-3.5 h-3.5" /></button>
                                                    <button onClick={() => handleDelete(item.id, item.name)} className="w-9 h-9 bg-white dark:bg-black hover:bg-rose-500 hover:text-white rounded-xl transition-all shadow-sm flex items-center justify-center border border-black/5 dark:border-white/5"><Trash2 className="w-3.5 h-3.5" /></button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <PaginationControl />
            </div>

            {/* Asset Insight Theater */}
            {selectedItem && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-3xl animate-in fade-in duration-500">
                    <div className="absolute inset-0 bg-black/80" onClick={() => setSelectedItem(null)} />
                    <div className="bg-white dark:bg-[#0a0a0a] w-full max-w-4xl rounded-2xl border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.5)] overflow-hidden relative flex flex-col md:flex-row animate-in zoom-in-95 duration-700">
                        <div className="md:w-1/2 bg-gray-100 dark:bg-black/50 p-6 flex items-center justify-center border-r border-white/5">
                            {selectedItem.image_url ? (
                                <img src={selectedItem.image_url} className="w-full h-auto rounded-3xl shadow-2xl" />
                            ) : (
                                <PackageOpen className="w-40 h-40 text-maroon/20" />
                            )}
                        </div>
                        <div className="md:w-1/2 p-16 flex flex-col gap-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-[10px] font-black text-maroon dark:text-gold uppercase tracking-[0.4em] mb-4 block">{selectedItem.category_name}</span>
                                    <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase leading-none">{selectedItem.name}</h2>
                                    <p className="text-xs font-bold text-gray-400 mt-4 uppercase tracking-widest">{selectedItem.item_code} • SN: {selectedItem.serial_number || 'NONE'}</p>
                                </div>
                                <button onClick={() => setSelectedItem(null)} className="p-4 hover:rotate-90 transition-transform"><X className="w-6 h-6 text-gray-400" /></button>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2">Vault Balance</p>
                                    <p className="text-2xl font-black text-gray-900 dark:text-white">{selectedItem.quantity} <span className="text-[10px] text-gray-400">{selectedItem.unit_type}s</span></p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2">Valuation</p>
                                    <p className="text-2xl font-black text-gray-900 dark:text-white">KSh {selectedItem.purchase_price?.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2">Logistic Hub</p>
                                    <p className="text-[11px] font-black text-gray-900 dark:text-white uppercase">{selectedItem.location_name || 'CENTRAL'}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2">Acquisition</p>
                                    <p className="text-[11px] font-black text-gray-900 dark:text-white uppercase">{selectedItem.date_purchased || 'NO.REC'}</p>
                                </div>
                            </div>

                            <div className="mt-auto flex gap-4">
                                <button className="flex-1 bg-maroon text-gold py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-lg shadow-maroon/20">Commence Requisition</button>
                                <button className="p-5 bg-gray-50 dark:bg-white/5 rounded-2xl text-gray-400 hover:text-maroon transition-all"><MoreVertical className="w-5 h-5" /></button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Move to Department Modal */}
            {moveDeptItem && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[150] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300">
                    <div className="bg-white dark:bg-[#0f0f0f] rounded-3xl shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] w-full max-w-lg border border-white/10 overflow-hidden">
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-gray-100 dark:border-white/5 bg-blue-50/30 dark:bg-blue-950/10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                                    <ArrowLeftRight className="w-5 h-5 text-blue-500" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest leading-none">Transfer Department</h3>
                                    <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest mt-0.5">Move item to a new sector</p>
                                </div>
                            </div>
                            <button onClick={() => { setMoveDeptItem(null); setMoveDeptDest(''); setMoveDeptLocation(''); }} className="p-2 hover:rotate-90 transition-transform text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Current asset info */}
                            <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Asset Being Transferred</p>
                                <p className="text-[14px] font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">{moveDeptItem.name}</p>
                                <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-maroon/5 border border-maroon/10 rounded-lg">
                                        <Building2 className="w-3 h-3 text-maroon" />
                                        <span className="text-[8px] font-black text-maroon uppercase tracking-widest">{moveDeptItem.category_name || 'Unclassified'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100/50 dark:bg-white/5 border border-gray-200/50 dark:border-white/5 rounded-lg">
                                        <MapPin className="w-3 h-3 text-gray-400" />
                                        <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">{moveDeptItem.location_name || 'No location'}</span>
                                    </div>
                                    <div className="flex items-center gap-1 px-2.5 py-1 bg-gray-100/50 dark:bg-white/5 border border-gray-200/50 dark:border-white/5 rounded-lg">
                                        <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Qty: {moveDeptItem.quantity}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Department selector */}
                            <div>
                                <p className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 ml-1">Select Target Department</p>
                                <div className="grid grid-cols-1 gap-2">
                                    {DEPT_OPTIONS.map(dept => (
                                        <button
                                            key={dept.category}
                                            type="button"
                                            onClick={() => { setMoveDeptDest(dept.category); setMoveDeptLocation(dept.location); }}
                                            className={`flex items-center gap-4 p-3.5 rounded-2xl border-2 transition-all text-left ${
                                                moveDeptDest === dept.category
                                                    ? `${dept.border} ${dept.bg}`
                                                    : 'border-gray-100 dark:border-white/5 hover:border-gray-200 dark:hover:border-white/10'
                                            } ${moveDeptItem.category_name === dept.category ? 'opacity-40 pointer-events-none' : ''}`}
                                        >
                                            <span className="text-xl shrink-0">{dept.emoji}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-[10px] font-black uppercase tracking-widest ${
                                                    moveDeptDest === dept.category ? dept.color : 'text-gray-600 dark:text-gray-400'
                                                }`}>{dept.label}</p>
                                                <p className="text-[8px] text-gray-400 uppercase tracking-widest mt-0.5 flex items-center gap-1">
                                                    <MapPin className="w-2.5 h-2.5" />{dept.location}
                                                </p>
                                            </div>
                                            {moveDeptItem.category_name === dept.category && (
                                                <span className="text-[7px] font-black text-gray-400 uppercase tracking-widest shrink-0">Current</span>
                                            )}
                                            {moveDeptDest === dept.category && moveDeptItem.category_name !== dept.category && (
                                                <CheckCircle2 className={`w-4 h-4 ${dept.color} shrink-0`} />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Optional custom location override */}
                            {moveDeptDest && (
                                <div className="animate-in slide-in-from-top-2 duration-300">
                                    <label className="block text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 ml-1">Storage Location <span className="text-gray-300">(optional override)</span></label>
                                    <input
                                        type="text"
                                        value={moveDeptLocation}
                                        onChange={e => setMoveDeptLocation(e.target.value)}
                                        placeholder="e.g. Cabinet B, Shelf 3…"
                                        className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[11px] font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-gray-300"
                                    />
                                </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex gap-3 pt-1">
                                <button
                                    onClick={() => { setMoveDeptItem(null); setMoveDeptDest(''); setMoveDeptLocation(''); }}
                                    className="flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-gray-100 dark:border-white/5 text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleMoveDept}
                                    disabled={!moveDeptDest || moveDeptDest === moveDeptItem.category_name}
                                    className="flex-1 py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
                                >
                                    <ArrowLeftRight className="w-4 h-4" /> Transfer Item
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showAddModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-[#0f0f0f] rounded-3xl shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] w-full max-w-4xl max-h-[95vh] overflow-y-auto border border-white/10 ring-1 ring-black/10">

                        {/* Header */}
                        <div className="px-8 py-5 flex justify-between items-center border-b border-gray-100 dark:border-white/5 sticky top-0 bg-white dark:bg-[#0f0f0f] z-10">
                            <div>
                                <h3 className="text-sm font-black text-maroon dark:text-gold uppercase tracking-[0.3em] mb-1">
                                    {formData.id ? 'Update Asset' : 'Register New Asset'}
                                </h3>
                                <div className="h-1 w-10 bg-maroon rounded-full" />
                            </div>
                            <div className="flex items-center gap-3">
                                {!formData.id && (
                                    <div className="flex p-1 bg-gray-100 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
                                        {[['single', '⊕ Single'], ['bulk', '⊞ Bulk']].map(([mode, label]) => (
                                            <button key={mode} type="button"
                                                onClick={() => setEntryMode(mode)}
                                                className={`px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                                                    entryMode === mode ? 'bg-maroon text-gold shadow-lg' : 'text-gray-400 hover:text-maroon'
                                                }`}>
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <button
                                    onClick={() => { setShowAddModal(false); setSelectedDepartment(null); setEntryMode('single'); setFormData({ name: '', category: '', quantity: 0, unit_type: 'Piece', minimum_stock_level: 5, location: '', purchase_price: 0, status: 'Available', date_purchased: new Date().toISOString().split('T')[0], serial_number: '', image_url: '' }); }}
                                    className="p-3 bg-gray-50 dark:bg-white/5 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 rounded-2xl transition-all">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="p-8 space-y-8">

                            {/* Department Picker */}
                            {!formData.id && (
                                <div>
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Select Department</p>
                                    <div className="grid grid-cols-3 gap-3">
                                        {Object.entries(DEPARTMENTS).map(([key, dept]) => (
                                            <button key={key} type="button"
                                                onClick={() => {
                                                    const next = selectedDepartment === key ? null : key;
                                                    setSelectedDepartment(next);
                                                    if (next) {
                                                        setFormData(p => ({ ...p, category: dept.category, location: dept.location, unit_type: dept.unit_type }));
                                                        setBulkItems(p => p.map(r => ({ ...r, unit_type: dept.unit_type })));
                                                    }
                                                }}
                                                className={`p-4 rounded-2xl border-2 transition-all text-left ${
                                                    selectedDepartment === key
                                                        ? `${dept.border} ${dept.bg}`
                                                        : 'border-gray-100 dark:border-white/5 hover:border-gray-200 dark:hover:border-white/10'
                                                }`}>
                                                <span className="text-2xl mb-2 block">{dept.emoji}</span>
                                                <p className={`text-[10px] font-black uppercase tracking-widest ${
                                                    selectedDepartment === key ? dept.color : 'text-gray-500 dark:text-gray-400'
                                                }`}>{dept.label}</p>
                                                {selectedDepartment === key && (
                                                    <p className="text-[8px] text-gray-400 mt-1 uppercase tracking-widest">{dept.location}</p>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ── SINGLE ENTRY ── */}
                            {(entryMode === 'single' || formData.id) && (
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    {/* Quick-fill chips */}
                                    {selectedDepartment && !formData.id && (
                                        <div>
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Quick-fill — Common Items</p>
                                            <div className="flex flex-wrap gap-2">
                                                {DEPARTMENTS[selectedDepartment].items.map(item => (
                                                    <button key={item} type="button"
                                                        onClick={() => setFormData(p => ({ ...p, name: item }))}
                                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                                                            formData.name === item
                                                                ? 'bg-maroon text-gold border-maroon/30'
                                                                : 'bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/5 text-gray-500 hover:text-maroon dark:hover:text-gold hover:border-maroon/30'
                                                        }`}>
                                                        {item}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <InputField label="Item Name / Nomenclature" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g., Facial Cream Hydrating" required />
                                        <InputField label="Serial Number / Identifier" value={formData.serial_number} onChange={e => setFormData({...formData, serial_number: e.target.value})} placeholder="UNIQUE ASSET SN" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <InputField label="Category / Department" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} placeholder="e.g. Beauty Therapy" required />
                                        <InputField label="Storage Location" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="e.g. Cabinet A" />
                                    </div>
                                    <div className="grid grid-cols-3 gap-6">
                                        <InputField label="Initial Quantity" type="number" value={formData.quantity} onChange={e => setFormData({...formData, quantity: Number(e.target.value)})} />
                                        <InputField label="Unit Type" value={formData.unit_type} onChange={e => setFormData({...formData, unit_type: e.target.value})} placeholder="e.g. Bottle" />
                                        <InputField label="Min Stock Threshold" type="number" value={formData.minimum_stock_level} onChange={e => setFormData({...formData, minimum_stock_level: Number(e.target.value)})} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <InputField label="Date of Purchase" type="date" value={formData.date_purchased} onChange={e => setFormData({...formData, date_purchased: e.target.value})} />
                                        <InputField label="Purchase Price (KSh)" type="number" step="0.01" value={formData.purchase_price} onChange={e => setFormData({...formData, purchase_price: Number(e.target.value)})} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 ml-1">Status</label>
                                            <select className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[11px] font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-maroon/20 transition-all appearance-none"
                                                value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                                                {['Available', 'Issued', 'Damaged', 'Expired', 'Pending'].map(s => <option key={s}>{s}</option>)}
                                            </select>
                                        </div>
                                        <InputField label="Asset Image URL" value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} placeholder="https://..." />
                                    </div>
                                    <button type="submit" className="w-full bg-gradient-to-r from-maroon to-[#800000] text-gold h-16 rounded-2xl text-[12px] font-black uppercase tracking-[0.3em] shadow-[0_20px_50px_-10px_rgba(128,0,0,0.4)] hover:scale-[1.02] active:scale-95 transition-all border border-white/10">
                                        {formData.id ? '↻ Update Asset' : '⊕ Commit To Vault'}
                                    </button>
                                </form>
                            )}

                            {/* ── BULK ENTRY ── */}
                            {entryMode === 'bulk' && !formData.id && (
                                <div className="space-y-6">
                                    {/* Shared Date for Bulk */}
                                    <div className="flex items-center gap-4 p-4 bg-amber-50/30 dark:bg-amber-950/10 rounded-2xl border border-amber-500/10">
                                        <div className="w-9 h-9 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20 shrink-0">
                                            <CalendarDays className="w-4 h-4 text-amber-500" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">Bulk Purchase Date</p>
                                            <p className="text-[8px] text-gray-400 uppercase tracking-widest">Applied to all items below</p>
                                        </div>
                                        <input
                                            type="date"
                                            value={bulkDate}
                                            onChange={e => setBulkDate(e.target.value)}
                                            className="px-4 py-2.5 bg-white dark:bg-gray-800/50 border border-amber-200 dark:border-amber-500/20 rounded-xl text-[10px] font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all"
                                        />
                                    </div>
                                    {/* Preset chips */}
                                    {selectedDepartment && (
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Quick-add — Click to Add Row</p>
                                                <button type="button"
                                                    onClick={() => {
                                                        const dept = DEPARTMENTS[selectedDepartment];
                                                        const existing = bulkItems.map(i => i.name.toLowerCase());
                                                        const toAdd = dept.items.filter(i => !existing.includes(i.toLowerCase()));
                                                        setBulkItems(p => [
                                                            ...p.filter(i => i.name.trim()),
                                                            ...toAdd.map(name => ({ name, quantity: 1, unit_type: dept.unit_type, purchase_price: 0, minimum_stock_level: 5 }))
                                                        ]);
                                                    }}
                                                    className="text-[9px] font-black text-maroon dark:text-gold uppercase tracking-widest hover:underline">
                                                    + Add All Presets
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {DEPARTMENTS[selectedDepartment].items.map(item => {
                                                    const dept = DEPARTMENTS[selectedDepartment];
                                                    const added = bulkItems.some(i => i.name.toLowerCase() === item.toLowerCase());
                                                    return (
                                                        <button key={item} type="button"
                                                            onClick={() => {
                                                                if (!added) setBulkItems(p => [...p.filter(i => i.name.trim()), { name: item, quantity: 1, unit_type: dept.unit_type, purchase_price: 0, minimum_stock_level: 5 }]);
                                                            }}
                                                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                                                                added ? 'bg-maroon text-gold border-maroon/30 cursor-default' : 'bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/5 text-gray-500 hover:text-maroon hover:border-maroon/30'
                                                            }`}>
                                                            {added ? '✓ ' : ''}{item}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Table */}
                                    <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-white/5">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5">
                                                    {['#', 'Item Name', 'Qty', 'Unit', 'Price (KSh)', 'Min Stock', ''].map(h => (
                                                        <th key={h} className="px-3 py-3 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                                                {bulkItems.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50/40 dark:hover:bg-white/[0.01] transition-colors">
                                                        <td className="px-3 py-2 text-[9px] font-black text-gray-300 w-8">{idx + 1}</td>
                                                        <td className="px-3 py-2">
                                                            <input
                                                                className="w-full min-w-[140px] px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[11px] font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-maroon/20 transition-all placeholder:text-gray-300"
                                                                placeholder="Item name..."
                                                                value={item.name}
                                                                onChange={e => { const n = [...bulkItems]; n[idx].name = e.target.value; setBulkItems(n); }}
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <input type="number" min="0"
                                                                className="w-16 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[11px] font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-maroon/20 transition-all"
                                                                value={item.quantity}
                                                                onChange={e => { const n = [...bulkItems]; n[idx].quantity = Number(e.target.value); setBulkItems(n); }}
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <input
                                                                className="w-20 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[11px] font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-maroon/20 transition-all"
                                                                placeholder="Piece"
                                                                value={item.unit_type}
                                                                onChange={e => { const n = [...bulkItems]; n[idx].unit_type = e.target.value; setBulkItems(n); }}
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <input type="number" min="0" step="0.01"
                                                                className="w-24 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[11px] font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-maroon/20 transition-all"
                                                                value={item.purchase_price}
                                                                onChange={e => { const n = [...bulkItems]; n[idx].purchase_price = Number(e.target.value); setBulkItems(n); }}
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <input type="number" min="0"
                                                                className="w-16 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl text-[11px] font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-maroon/20 transition-all"
                                                                value={item.minimum_stock_level}
                                                                onChange={e => { const n = [...bulkItems]; n[idx].minimum_stock_level = Number(e.target.value); setBulkItems(n); }}
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <button type="button"
                                                                onClick={() => setBulkItems(p => p.length > 1 ? p.filter((_, i) => i !== idx) : p)}
                                                                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-500 text-gray-300 transition-all">
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="flex items-center justify-between pt-2">
                                        <button type="button"
                                            onClick={() => setBulkItems(p => [...p, { name: '', quantity: 1, unit_type: selectedDepartment ? DEPARTMENTS[selectedDepartment].unit_type : 'Piece', purchase_price: 0, minimum_stock_level: 5 }])}
                                            className="flex items-center gap-2 px-5 py-3 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-maroon dark:hover:text-gold hover:border-maroon/30 transition-all">
                                            <Plus className="w-4 h-4" /> Add Row
                                        </button>
                                        <div className="flex items-center gap-4">
                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                                {bulkItems.filter(i => i.name.trim()).length} item{bulkItems.filter(i => i.name.trim()).length !== 1 ? 's' : ''} ready
                                            </span>
                                            <button type="button"
                                                onClick={handleBulkSubmit}
                                                className="flex items-center gap-3 bg-gradient-to-r from-maroon to-[#800000] text-gold px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-lg hover:scale-[1.02] active:scale-95 transition-all border border-white/10">
                                                <CheckCircle2 className="w-4 h-4" /> Commit All To Vault
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const StatusBadge = ({ status }) => {
    const cfg = {
        Available: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: CheckCircle2 },
        Issued: { bg: 'bg-blue-50 text-blue-700 border-blue-100', icon: Box },
        Damaged: { bg: 'bg-red-50 text-red-700 border-red-100', icon: AlertTriangle },
        Expired: { bg: 'bg-rose-50 text-rose-700 border-rose-100', icon: AlertCircle },
        Pending: { bg: 'bg-amber-50 text-amber-700 border-amber-100', icon: Clock },
        PENDING: { bg: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: Clock },
        DRAFT: { bg: 'bg-gray-500/10 text-gray-500 border-gray-500/20', icon: Pencil },
        Approved: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: CheckCircle2 },
        APPROVED: { bg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: CheckCircle2 },
        Rejected: { bg: 'bg-red-50 text-red-700 border-red-100', icon: X },
        REJECTED: { bg: 'bg-rose-500/10 text-rose-600 border-rose-500/20', icon: X },
        Purchased: { bg: 'bg-blue-50 text-blue-700 border-blue-100', icon: ShoppingCart },
        MODIFICATION_REQUIRED: { bg: 'bg-orange-500/10 text-orange-600 border-orange-500/20', icon: RefreshCcw },
        PARTIALLY_ISSUED: { bg: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: PackageOpen },
        ISSUED: { bg: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20', icon: Box },
        COMPLETED: { bg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: CheckCircle2 },
        CANCELLED: { bg: 'bg-gray-500/10 text-gray-400 border-gray-500/20', icon: X }
    };
    const c = cfg[status] || { bg: 'bg-gray-50 text-gray-500 border-gray-100', icon: Package };
    return (
        <span className={`inline-flex items-center gap-1.5 text-[9px] font-black px-3.5 py-1 rounded-full uppercase tracking-widest border ${c.bg} transition-all cursor-default`}>
            <c.icon className="w-3 h-3" />
            {status?.replace(/_/g, ' ')}
        </span>
    );
};

export default function Inventory() {
    const { user } = useAuth();
    const userRole = (user?.role || 'student').toLowerCase().trim();
    const [activeTab, setActiveTab] = useState(userRole === 'teacher' ? 'items' : 'dashboard');
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [syncError, setSyncError] = useState("");
    const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString());

    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: Activity, roles: ['admin', 'superadmin', 'teacher', 'student'] },
        { id: 'items', label: 'Inventory', icon: Boxes, roles: ['admin', 'superadmin', 'teacher', 'student'] },
        { id: 'mystock', label: 'My Stock', icon: Package, roles: ['teacher'] },
        { id: 'requests', label: 'Requisitions', icon: ClipboardList, roles: ['admin', 'superadmin', 'teacher', 'student'] },
        { id: 'procurement', label: 'Procurement', icon: ShoppingCart, roles: ['admin', 'superadmin', 'teacher'] },
        { id: 'stock', label: 'Movements', icon: ArrowUpFromLine, roles: ['admin', 'superadmin'] },
    ];

    const filteredTabs = useMemo(() => tabs.filter(tab => tab.roles.includes(userRole)), [userRole]);
    console.log('[Inventory] filteredTabs:', filteredTabs);

    const refreshDashboard = () => {
        setLoading(true);
        setSyncError("");
        inventoryAPI.getDashboard()
            .then(r => {
                setStats(r.data);
                setLastUpdated(new Date().toLocaleTimeString());
            })
            .catch(e => {
                console.error(e);
                setSyncError(e.response?.data?.error || e.message || "Sync Error");
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (activeTab === 'dashboard') {
            refreshDashboard();
        } else {
            setLoading(false);
        }
    }, [activeTab]);



    const WelcomeBanner = () => {
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
        const roleName = userRole.charAt(0).toUpperCase() + userRole.slice(1);
        
        return (
            <div className="relative overflow-hidden bg-gradient-to-br from-maroon via-[#800000] to-black p-4 lg:p-5 rounded-2xl border border-white/10 shadow-[0_20px_60px_-15px_rgba(128,0,0,0.4)] mb-4 group transition-all duration-700">
                <div className="absolute top-0 right-0 w-1/4 h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5 pointer-events-none" />
                <div className="absolute top-6 right-6 flex flex-col items-end">
                    <div className="flex items-center gap-2 px-3 py-1 bg-white/5 backdrop-blur-md rounded-lg border border-white/10 text-gold shadow-lg">
                        <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
                        <span className="text-[8px] font-black uppercase tracking-[0.2em]">Live</span>
                    </div>
                </div>
                <div className="relative z-10 max-w-lg">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-6 h-[1.5px] bg-gold rounded-full" />
                        <span className="text-[8px] font-black text-gold uppercase tracking-[0.4em]">{roleName} Portal</span>
                    </div>
                    <h2 className="text-xl lg:text-2xl font-black text-white uppercase tracking-tight leading-none mb-3">
                        {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-amber-200 to-gold">{user?.name || 'Commander'}</span>
                    </h2>
                    <p className="text-white/50 text-[9px] lg:text-[10px] font-medium tracking-wide leading-relaxed max-w-sm mb-4 uppercase italic">
                        Real-time logistics monitoring active.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <div className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg transition-all cursor-default">
                            <span className="text-[7px] font-black text-gold/60 block uppercase tracking-widest leading-none mb-1">Local</span>
                            <span className="text-[10px] font-bold text-white tracking-widest">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg transition-all cursor-default">
                            <span className="text-[7px] font-black text-gold/60 block uppercase tracking-widest leading-none mb-1">Update</span>
                            <span className="text-[10px] font-bold text-white tracking-widest">{lastUpdated}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#fafafa] dark:bg-[#050505] p-4 lg:p-6 animate-in fade-in duration-700">
            {/* Premium Header Architecture */}
            <header className="mb-6 relative">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="animate-in slide-in-from-left-8 duration-700">
                        <div className="flex items-center gap-5 mb-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-maroon to-[#600000] rounded-2xl flex items-center justify-center shadow-[0_20px_50px_-10px_rgba(128,0,0,0.4)] border border-white/20 relative group">
                                <div className="absolute inset-0 bg-gold/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                <Package className="w-8 h-8 text-gold stroke-[2.5] relative z-10" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-[-0.04em] uppercase leading-none mb-2">Inventory Vault</h1>
                                <div className="flex items-center gap-3">
                                    <div className="h-0.5 w-8 bg-maroon rounded-full" />
                                    <p className="text-[10px] font-black text-maroon/60 dark:text-gold/60 uppercase tracking-[0.4em]">Integrated Logistics Engine</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tactical Tab Navigation */}
                    <nav className="animate-in slide-in-from-right-8 duration-700">
                        <div className="flex bg-white dark:bg-[#111] p-2 rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.08)] border border-gray-100 dark:border-white/5 ring-1 ring-black/5 overflow-x-auto no-scrollbar max-w-[90vw] lg:max-w-none">
                            {filteredTabs.map(tab => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-3 px-8 py-4 rounded-2xl transition-all duration-500 whitespace-nowrap group relative ${
                                            isActive 
                                            ? 'bg-maroon text-gold shadow-2xl shadow-maroon/30 scale-100' 
                                            : 'text-gray-400 hover:text-maroon dark:hover:text-gold hover:bg-maroon/5 scale-95 hover:scale-100'
                                        }`}
                                    >
                                        <Icon className={`w-4 h-4 ${isActive ? 'stroke-[3]' : 'stroke-[2]'} group-hover:rotate-12 transition-transform`} />
                                        <span className={`text-[10px] font-black uppercase tracking-[0.15em]`}>{tab.label}</span>
                                        {isActive && (
                                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-gold rounded-full shadow-[0_0_10px_#FFD700]" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </nav>
                </div>
            </header>

            {/* Main Operational Theater */}
            <main className="max-w-[1600px] mx-auto">
                {activeTab === 'dashboard' && (
                    <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000">
                        <WelcomeBanner />
                        
                        {loading && !stats ? (
                            <div className="py-20 flex flex-col items-center justify-center gap-4">
                                <div className="w-12 h-12 border-4 border-maroon border-t-gold rounded-2xl animate-spin shadow-xl"></div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.5em] animate-pulse">Synchronizing Data Lattice...</p>
                            </div>
                        ) : syncError ? (
                            <div className="bg-rose-500/10 border border-rose-500/20 p-8 rounded-[2rem] text-center">
                                <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
                                <h3 className="text-xl font-black text-rose-500 uppercase mb-2 tracking-widest">Neural Link Disrupted</h3>
                                <p className="text-rose-500/70 text-sm mb-6">{syncError}</p>
                                <button onClick={refreshDashboard} className="px-8 py-4 bg-rose-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-rose-500/20 active:scale-95 transition-all">Retry Link</button>
                            </div>
                        ) : stats ? (
                            <div className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    {(userRole === 'admin' || userRole === 'superadmin' ? [
                                        { l: 'Total Assets', v: stats.totalItems, sub: `${stats.totalQty} Units In-Stock`, icon: Boxes, color: 'text-blue-500', bg: 'bg-blue-500/10', trend: '+2.4%' },
                                        { l: 'Vault Valuation', v: `KSh ${Number(stats.totalValue || 0).toLocaleString()}`, sub: 'Asset Investment', icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-500/10', trend: 'Optimal' },
                                        { l: 'Supply Risk', v: stats.lowStockCount, sub: 'Needs Critical Restock', icon: TrendingDown, color: 'text-rose-500', bg: 'bg-rose-500/10', trend: stats.lowStockCount > 0 ? 'CRITICAL' : 'SECURE' },
                                        { l: 'Outbound Flow', v: stats.issuedToday, sub: 'Units Released Today', icon: ArrowUpFromLine, color: 'text-purple-500', bg: 'bg-purple-500/10', trend: 'Active' },
                                    ] : [
                                        { l: 'Pending Orders', v: stats.pendingRequests, sub: 'Awaiting Authorization', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10', trend: 'In-Review' },
                                        { l: 'Authorized', v: stats.approvedRequests, sub: 'Ready for Collection', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10', trend: 'Released' },
                                        { l: 'Received Units', v: stats.issuedToday, sub: 'Delivered Today', icon: ArrowDownToLine, color: 'text-blue-500', bg: 'bg-blue-500/10', trend: 'Today' },
                                        { l: 'Total Provision', v: stats.totalQty, sub: 'Lifetime Units Received', icon: Boxes, color: 'text-maroon', bg: 'bg-maroon/10', trend: 'Total' },
                                    ]).map((c, i) => (
                                        <div key={i} className="bg-white dark:bg-[#111] p-4 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm group hover:-translate-y-1 transition-all duration-500 relative overflow-hidden ring-1 ring-black/5">
                                            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-white/0 to-black/5 dark:to-white/5 translate-x-6 -translate-y-6 rotate-45 group-hover:translate-x-3 group-hover:-translate-y-3 transition-transform duration-700" />
                                            <div className="flex justify-between items-start mb-4">
                                                <div className={`${c.bg} w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-black/5 dark:border-white/5 shadow-inner`}>
                                                    <c.icon className={`w-5 h-5 ${c.color} stroke-[2.5]`} />
                                                </div>
                                                <span className={`text-[7px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${c.color} ${c.bg} border border-black/5`}>{c.trend}</span>
                                            </div>
                                            <div>
                                                <p className="text-[8px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-0.5">{c.l}</p>
                                                <p className="text-lg font-black text-gray-900 dark:text-white tracking-tight leading-none mb-1.5">{c.v}</p>
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-1 h-1 bg-gray-300 rounded-full" />
                                                    <p className="text-[8px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">{c.sub}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                                    <div className="lg:col-span-2 bg-white dark:bg-[#111] rounded-xl border border-gray-100 dark:border-white/5 shadow-sm p-3 flex flex-col relative overflow-hidden">
                                        <div className="flex items-center justify-between mb-2">
                                            <div>
                                                <h3 className="text-[10px] font-black text-gray-900 dark:text-gray-100 uppercase tracking-[0.15em]">Volume Heatmap</h3>
                                                <p className="text-[8px] text-gray-400 uppercase tracking-widest">Velocity</p>
                                            </div>
                                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                                                <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                                                <span className="text-[7px] font-black text-emerald-600 uppercase">Live</span>
                                            </div>
                                        </div>
                                        <div className="flex items-end gap-1.5 h-[140px] group/chart">
                                            {[45, 60, 30, 85, 40, 55, 70, 45, 90, 65, 50, 80].map((v, i) => (
                                                <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                                                    <div 
                                                        className="w-full bg-gradient-to-t from-maroon/20 to-maroon rounded-t-lg transition-all duration-700 relative cursor-pointer"
                                                        style={{ height: `${v}%`, opacity: 0.3 + (v/100) }}
                                                    >
                                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-gold text-[7px] font-black px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                                            {v}%
                                                        </div>
                                                    </div>
                                                    <span className="text-[7px] font-black text-gray-300 uppercase">{['J','F','M','A','M','J','J','A','S','O','N','D'][i]}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {(userRole === 'admin' || userRole === 'superadmin') ? (
                                        <div className="bg-white dark:bg-[#111] rounded-xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden flex flex-col">
                                            <div className="px-3 py-2 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 bg-rose-50 dark:bg-rose-950/20 rounded-lg flex items-center justify-center">
                                                        <Calendar className="w-3.5 h-3.5 text-rose-500" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-[0.1em]">Expiring</h3>
                                                        <p className="text-[8px] text-gray-400 uppercase">Shelf-Life</p>
                                                    </div>
                                                </div>
                                                {stats.expiringSoon?.length > 0 && (
                                                    <span className="bg-rose-500 text-white px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase">
                                                        {stats.expiringSoon.length} Crit
                                                    </span>
                                                )}
                                            </div>
                                            <div className="divide-y divide-gray-50 dark:divide-white/5 overflow-y-auto max-h-[280px] no-scrollbar">
                                                {stats.expiringSoon?.length > 0 ? stats.expiringSoon.map((item, idx) => (
                                                    <div key={idx} className="px-4 py-2.5 flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors group">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                                                            <div>
                                                                <p className="text-[11px] font-black text-gray-800 dark:text-gray-200 uppercase">{item.name}</p>
                                                                <p className="text-[9px] text-gray-400 uppercase">{item.category} • {item.quantity} units</p>
                                                            </div>
                                                        </div>
                                                        <p className="text-[10px] font-black text-rose-500">{new Date(item.expiry_date).toLocaleDateString()}</p>
                                                    </div>
                                                )) : (
                                                    <div className="py-8 flex flex-col items-center justify-center opacity-30">
                                                        <CheckCircle2 className="w-8 h-8 text-gray-400 mb-2" />
                                                        <p className="text-[9px] font-black uppercase tracking-widest">All dates optimal</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-white dark:bg-[#111] rounded-xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden flex flex-col">
                                            <div className="px-3 py-2 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 bg-amber-50 dark:bg-amber-950/20 rounded-lg flex items-center justify-center">
                                                        <ClipboardList className="w-3.5 h-3.5 text-amber-500" />
                                                    </div>
                                                    <h3 className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-[0.1em]">Recent Req</h3>
                                                </div>
                                                <button onClick={() => setActiveTab('requests')} className="text-[8px] font-black text-maroon hover:underline uppercase">All</button>
                                            </div>
                                            <div className="divide-y divide-gray-50 dark:divide-white/5 overflow-y-auto max-h-[220px] no-scrollbar flex-1">
                                                {stats.recentRequests?.length > 0 ? stats.recentRequests.map((req, idx) => (
                                                    <div key={idx} className="px-3 py-2 flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                                                        <div>
                                                            <p className="text-[10px] font-black text-gray-800 dark:text-gray-200 uppercase">{req.item_name}</p>
                                                            <p className="text-[8px] text-gray-400 uppercase">{req.quantity} units • {new Date(req.created_at).toLocaleDateString()}</p>
                                                        </div>
                                                        <StatusBadge status={req.status} />
                                                    </div>
                                                )) : (
                                                    <div className="py-6 text-center flex-1 flex flex-col items-center justify-center opacity-30">
                                                        <Clock className="w-6 h-6 text-gray-300 mb-2" />
                                                        <p className="text-[8px] font-black uppercase tracking-widest">None</p>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="px-3 py-2 border-t border-gray-50 dark:border-white/5">
                                                <button 
                                                    onClick={() => setActiveTab('requests')}
                                                    className="w-full py-1.5 bg-maroon text-gold rounded-lg text-[8px] font-black uppercase tracking-widest hover:opacity-90 transition-all"
                                                >
                                                    New Request
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-white dark:bg-[#111] rounded-xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden flex flex-col">
                                        <div className="px-3 py-2 border-b border-gray-100 dark:border-white/5 flex items-center gap-2">
                                            <div className={`w-7 h-7 ${userRole === 'teacher' ? 'bg-blue-50 dark:bg-blue-950/20' : 'bg-emerald-50 dark:bg-emerald-950/20'} rounded-lg flex items-center justify-center`}>
                                                <Activity className={`w-3.5 h-3.5 ${userRole === 'teacher' ? 'text-blue-500' : 'text-emerald-500'}`} />
                                            </div>
                                            <div>
                                                <h3 className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-[0.1em]">
                                                    {userRole === 'teacher' ? 'Personal Logs' : 'Movement'}
                                                </h3>
                                                <p className="text-[8px] text-gray-400 uppercase">Stream</p>
                                            </div>
                                        </div>
                                        <div className="divide-y divide-gray-50 dark:divide-white/5 overflow-y-auto max-h-[220px] no-scrollbar flex-1">
                                            {stats.recentTransactions?.length > 0 ? stats.recentTransactions.map((tx, idx) => (
                                                <div key={idx} className="px-3 py-2 flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors group">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-7 h-7 rounded-md flex items-center justify-center border border-black/5 dark:border-white/5 ${userRole === 'teacher' ? 'bg-blue-50/50' : 'bg-emerald-50/50'}`}>
                                                            {userRole === 'teacher' ? <ArrowDownToLine className="w-3.5 h-3.5 text-blue-600" /> : <ArrowUpFromLine className="w-3.5 h-3.5 text-emerald-600" />}
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-black text-gray-800 dark:text-gray-200 uppercase">{tx.item_name}</p>
                                                            <p className="text-[8px] text-gray-400 uppercase">{tx.department}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className={`text-[10px] font-black ${userRole === 'teacher' ? 'text-blue-600' : 'text-emerald-600'}`}>
                                                            {userRole === 'teacher' ? '+' : '-'}{tx.quantity_issued}
                                                        </p>
                                                        <p className="text-[7px] text-gray-400">{new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                    </div>
                                                </div>
                                            )) : (
                                                <div className="py-6 flex flex-col items-center justify-center opacity-30">
                                                    <Package className="w-6 h-6 text-gray-400 mb-2" />
                                                    <p className="text-[8px] font-black uppercase tracking-widest">Empty</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-20 text-center flex flex-col items-center justify-center gap-4">
                                <div className="w-16 h-16 border-4 border-maroon border-t-gold rounded-3xl animate-spin shadow-2xl"></div>
                                <p className="text-gray-400 font-black uppercase tracking-[0.5em] text-sm mt-6">Initializing Sector Alpha...</p>
                            </div>
                        )}
                    </div>
                )}
                
                {activeTab === 'items' && <ItemsTab />}
                {activeTab === 'mystock' && <MyStockTab />}
                {activeTab === 'requests' && <RequestsTab role={userRole} />}
                {activeTab === 'procurement' && <ProcurementTab />}
                {activeTab === 'stock' && <StockMovementTab />}
            </main>
        </div>
    );
}

function RequestsTab({ role }) {
    const { user } = useAuth();
    const isAdmin = ['admin', 'superadmin'].includes((user?.role || '').toLowerCase());

    const [requisitions, setRequisitions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    const [filterStatus, setFilterStatus] = useState('ALL');
    const [filterDept, setFilterDept] = useState('ALL');
    const [filterPriority, setFilterPriority] = useState('ALL');
    const [search, setSearch] = useState('');

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedReqId, setSelectedReqId] = useState(null);
    const [detailModal, setDetailModal] = useState(false);
    const [issueModal, setIssueModal] = useState(false);
    const [toast, setToast] = useState(null);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    const fetchRequisitions = useCallback(() => {
        setLoading(true);
        const params = {
            page,
            limit: 10,
            status: filterStatus !== 'ALL' ? filterStatus : undefined,
            department: filterDept !== 'ALL' ? filterDept : undefined,
            priority: filterPriority !== 'ALL' ? filterPriority : undefined,
            search: search.trim() || undefined
        };

        inventoryAPI.getRequisitions(params)
            .then(res => {
                setRequisitions(res.data.data || []);
                setTotalPages(res.data.pagination?.totalPages || 1);
                setTotalCount(res.data.pagination?.total || 0);
            })
            .catch(err => {
                console.error('Failed to fetch requisitions:', err);
                showToast('REQUISITIONS SYNC FAILED', 'error');
            })
            .finally(() => setLoading(false));
    }, [page, filterStatus, filterDept, filterPriority, search]);

    useEffect(() => { fetchRequisitions(); }, [fetchRequisitions]);
    useEffect(() => { setPage(1); }, [filterStatus, filterDept, filterPriority, search]);

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-700">
            {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

            {/* Header & Controls */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Requisition & Stock Control</h2>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mt-1">
                        <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
                        Multi-Item Operational Requisitions Lattice
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-3 bg-gradient-to-r from-maroon to-[#800000] text-gold px-6 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] shadow-lg hover:scale-105 active:scale-95 transition-all border border-white/10"
                    >
                        <Plus className="w-4 h-4 stroke-[3]" /> NEW REQUISITION
                    </button>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row items-stretch gap-3 bg-white dark:bg-[#111] p-3 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm ring-1 ring-black/5">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="SEARCH BY REQ#, NAME, PURPOSE..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-black border border-gray-100 dark:border-white/5 rounded-xl text-[10px] font-bold tracking-widest text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-maroon/20 transition-all"
                    />
                </div>

                <div className="flex flex-wrap gap-2">
                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        className="px-4 py-3 bg-gray-50 dark:bg-black border border-gray-100 dark:border-white/5 rounded-xl text-[9px] font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest focus:outline-none cursor-pointer"
                    >
                        <option value="ALL">All Statuses</option>
                        <option value="DRAFT">Draft</option>
                        <option value="PENDING">Pending Approval</option>
                        <option value="APPROVED">Approved</option>
                        <option value="MODIFICATION_REQUIRED">Modification Req.</option>
                        <option value="PARTIALLY_ISSUED">Partially Issued</option>
                        <option value="ISSUED">Issued (Ready Pickup)</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="REJECTED">Rejected</option>
                        <option value="CANCELLED">Cancelled</option>
                    </select>

                    <select
                        value={filterDept}
                        onChange={e => setFilterDept(e.target.value)}
                        className="px-4 py-3 bg-gray-50 dark:bg-black border border-gray-100 dark:border-white/5 rounded-xl text-[9px] font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest focus:outline-none cursor-pointer"
                    >
                        <option value="ALL">All Departments</option>
                        <option value="Beauty Therapy">Beauty Therapy</option>
                        <option value="Hairdressing">Hairdressing</option>
                        <option value="ICT Department">ICT Sector</option>
                        <option value="Administration">Administration</option>
                        <option value="Barbering">Barbering</option>
                    </select>

                    <select
                        value={filterPriority}
                        onChange={e => setFilterPriority(e.target.value)}
                        className="px-4 py-3 bg-gray-50 dark:bg-black border border-gray-100 dark:border-white/5 rounded-xl text-[9px] font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest focus:outline-none cursor-pointer"
                    >
                        <option value="ALL">All Priorities</option>
                        <option value="Normal">Normal Priority</option>
                        <option value="Urgent">Urgent Priority</option>
                    </select>
                </div>
            </div>

            {/* List Table / Cards */}
            <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden ring-1 ring-black/5 min-h-[400px]">
                <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-white/[0.01] border-b border-gray-100 dark:border-white/5">
                                <th className="px-5 py-4 text-left text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Requisition #</th>
                                <th className="px-5 py-4 text-left text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Requester & Sector</th>
                                <th className="px-5 py-4 text-left text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Items & Qty</th>
                                <th className="px-5 py-4 text-left text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Priority</th>
                                <th className="px-5 py-4 text-left text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Status</th>
                                <th className="px-5 py-4 text-right text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50/50 dark:divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-10 h-10 border-4 border-maroon border-t-gold rounded-xl animate-spin shadow-lg" />
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Querying Requisition Lattice...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : requisitions.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <PackageOpen className="w-12 h-12 text-gray-300" />
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">No Requisitions Found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : requisitions.map(req => (
                                <tr key={req.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.015] transition-all group">
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-maroon/5 flex items-center justify-center border border-maroon/10 shrink-0">
                                                <ClipboardList className="w-4 h-4 text-maroon" />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-black text-gray-900 dark:text-white tracking-tight uppercase group-hover:text-maroon transition-colors">{req.requisition_number}</p>
                                                <p className="text-[8px] font-bold text-gray-400 uppercase mt-0.5">{new Date(req.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-5 py-4">
                                        <div>
                                            <p className="text-[11px] font-black text-gray-800 dark:text-gray-200 uppercase">{req.requester_name}</p>
                                            <p className="text-[8px] font-bold text-gray-400 uppercase mt-0.5">{req.department}</p>
                                        </div>
                                    </td>

                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2.5 py-1 bg-gray-100 dark:bg-white/5 rounded-lg text-[10px] font-black text-gray-700 dark:text-gray-300 uppercase">
                                                {req.total_items || 0} line items
                                            </span>
                                            <span className="text-[9px] font-bold text-gray-400 uppercase">
                                                ({req.total_issued_qty || 0}/{req.total_requested_qty || 0} units)
                                            </span>
                                        </div>
                                    </td>

                                    <td className="px-5 py-4">
                                        <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider border ${
                                            req.priority === 'Urgent' 
                                                ? 'bg-rose-500/10 text-rose-600 border-rose-500/20 animate-pulse' 
                                                : 'bg-gray-100 dark:bg-white/5 text-gray-500 border-gray-200 dark:border-white/5'
                                        }`}>
                                            {req.priority}
                                        </span>
                                    </td>

                                    <td className="px-5 py-4">
                                        <StatusBadge status={req.status} />
                                    </td>

                                    <td className="px-5 py-4 text-right">
                                        <button
                                            onClick={() => { setSelectedReqId(req.id); setDetailModal(true); }}
                                            className="px-4 py-2 bg-maroon text-gold hover:bg-maroon/90 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-md flex items-center gap-2 ml-auto"
                                        >
                                            <Eye className="w-3.5 h-3.5" /> View & Action
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 bg-gray-50/50 dark:bg-white/[0.01] border-t border-gray-100 dark:border-white/5">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                            Page {page} of {totalPages} ({totalCount} requisitions)
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                className="p-2 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-maroon hover:text-gold disabled:opacity-30 transition-all"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                disabled={page === totalPages}
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                className="p-2 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-maroon hover:text-gold disabled:opacity-30 transition-all"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            {showCreateModal && (
                <NewRequisitionModal
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={() => { setShowCreateModal(false); fetchRequisitions(); showToast('REQUISITION CREATED SUCCESSFULLY'); }}
                />
            )}

            {detailModal && selectedReqId && (
                <RequisitionDetailModal
                    requisitionId={selectedReqId}
                    onClose={() => { setDetailModal(false); setSelectedReqId(null); }}
                    onRefresh={() => { fetchRequisitions(); }}
                    onOpenIssueModal={() => { setIssueModal(true); }}
                    showToast={showToast}
                />
            )}

            {issueModal && selectedReqId && (
                <IssueItemsModal
                    requisitionId={selectedReqId}
                    onClose={() => setIssueModal(false)}
                    onSuccess={() => {
                        setIssueModal(false);
                        fetchRequisitions();
                        showToast('STOCK ISSUED SUCCESSFULLY');
                    }}
                />
            )}
        </div>
    );
}

/**
 * Modal to Create a Multi-Item Requisition
 */
function NewRequisitionModal({ onClose, onSuccess }) {
    const { user } = useAuth();
    const userDept = user?.department || 'Beauty Therapy';

    const [department, setDepartment] = useState(userDept);
    const [priority, setPriority] = useState('Normal');
    const [requiredDate, setRequiredDate] = useState('');
    const [purpose, setPurpose] = useState('');
    const [availableItems, setAvailableItems] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const [reqItems, setReqItems] = useState([
        { item_id: '', item_name: '', category_name: '', requested_qty: 1, unit_type: 'Piece', purpose_remarks: '' }
    ]);

    useEffect(() => {
        inventoryAPI.getItems({ limit: 100 }).then(res => {
            setAvailableItems(res.data.data || res.data || []);
        }).catch(() => {});
    }, []);

    const handleItemChange = (idx, field, value) => {
        const updated = [...reqItems];
        updated[idx][field] = value;

        // Auto-fill category & unit_type if item_id selected
        if (field === 'item_id' && value) {
            const found = availableItems.find(i => String(i.id) === String(value));
            if (found) {
                updated[idx].item_name = found.name;
                updated[idx].category_name = found.category_name || '';
                updated[idx].unit_type = found.unit_type || 'Piece';
            }
        }

        setReqItems(updated);
    };

    const addRow = () => {
        setReqItems(prev => [...prev, { item_id: '', item_name: '', category_name: '', requested_qty: 1, unit_type: 'Piece', purpose_remarks: '' }]);
    };

    const removeRow = (idx) => {
        if (reqItems.length === 1) return;
        setReqItems(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSave = async (submitImmediately = false) => {
        setErrorMsg('');
        const validItems = reqItems.filter(i => i.item_name.trim());
        if (validItems.length === 0) {
            setErrorMsg('At least one valid item is required');
            return;
        }

        setSubmitting(true);
        try {
            await inventoryAPI.createRequisition({
                department,
                priority,
                required_date: requiredDate || undefined,
                purpose,
                items: validItems,
                submit_immediately: submitImmediately
            });
            onSuccess();
        } catch (err) {
            setErrorMsg(err.response?.data?.error || err.message || 'Failed to save requisition');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal title="Create Multi-Item Requisition" onClose={onClose}>
            <div className="space-y-6">
                {errorMsg && (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-xs font-bold uppercase tracking-wider">
                        {errorMsg}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <SelectField label="Department Sector" value={department} onChange={e => setDepartment(e.target.value)}>
                        <option value="Beauty Therapy">Beauty Therapy</option>
                        <option value="Hairdressing">Hairdressing</option>
                        <option value="ICT Department">ICT Sector</option>
                        <option value="Administration">Administration</option>
                        <option value="Barbering">Barbering</option>
                    </SelectField>

                    <SelectField label="Priority Level" value={priority} onChange={e => setPriority(e.target.value)}>
                        <option value="Normal">Normal Priority</option>
                        <option value="Urgent">Urgent Priority</option>
                    </SelectField>

                    <InputField label="Required By Date" type="date" value={requiredDate} onChange={e => setRequiredDate(e.target.value)} />
                </div>

                <div>
                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Overall Purpose / Notes</label>
                    <input
                        type="text"
                        placeholder="e.g. Practical examination supplies for Term 2..."
                        value={purpose}
                        onChange={e => setPurpose(e.target.value)}
                        className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-[11px] font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-maroon/20 transition-all"
                    />
                </div>

                {/* Line Items Builder Table */}
                <div className="border border-gray-100 dark:border-white/5 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50/50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                        <p className="text-[10px] font-black text-maroon dark:text-gold uppercase tracking-widest">Requisition Line Items ({reqItems.length})</p>
                        <button type="button" onClick={addRow} className="text-[9px] font-black text-maroon dark:text-gold uppercase tracking-widest hover:underline flex items-center gap-1">
                            <Plus className="w-3.5 h-3.5" /> Add Item Row
                        </button>
                    </div>

                    <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto no-scrollbar">
                        {reqItems.map((item, idx) => (
                            <div key={idx} className="flex flex-col md:flex-row gap-3 p-3 bg-gray-50/30 dark:bg-white/[0.01] rounded-xl border border-gray-100 dark:border-white/5 items-stretch md:items-center">
                                <div className="flex-1">
                                    <select
                                        value={item.item_id}
                                        onChange={e => handleItemChange(idx, 'item_id', e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl text-[10px] font-bold text-gray-900 dark:text-white"
                                    >
                                        <option value="">Select Stock Item (or type manually)...</option>
                                        {availableItems.map(inv => (
                                            <option key={inv.id} value={inv.id}>
                                                {inv.name.toUpperCase()} (Available: {inv.quantity} {inv.unit_type})
                                            </option>
                                        ))}
                                    </select>
                                    {!item.item_id && (
                                        <input
                                            type="text"
                                            placeholder="Or custom item name..."
                                            value={item.item_name}
                                            onChange={e => handleItemChange(idx, 'item_name', e.target.value)}
                                            className="w-full mt-2 px-3 py-1.5 bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl text-[10px] font-bold"
                                        />
                                    )}
                                </div>

                                <div className="w-24">
                                    <input
                                        type="number"
                                        min="1"
                                        placeholder="Qty"
                                        value={item.requested_qty}
                                        onChange={e => handleItemChange(idx, 'requested_qty', parseInt(e.target.value) || 1)}
                                        className="w-full px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl text-[10px] font-bold text-center"
                                    />
                                </div>

                                <div className="w-28">
                                    <input
                                        type="text"
                                        placeholder="Unit (Piece)"
                                        value={item.unit_type}
                                        onChange={e => handleItemChange(idx, 'unit_type', e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl text-[10px] font-bold"
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={() => removeRow(idx)}
                                    disabled={reqItems.length === 1}
                                    className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl disabled:opacity-20 transition-all self-end md:self-center"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100 dark:border-white/5">
                    <button
                        type="button"
                        disabled={submitting}
                        onClick={() => handleSave(false)}
                        className="flex-1 px-6 py-4 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                    >
                        Save Draft
                    </button>
                    <button
                        type="button"
                        disabled={submitting}
                        onClick={() => handleSave(true)}
                        className="flex-1 px-6 py-4 bg-gradient-to-r from-maroon to-[#800000] text-gold rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-105 transition-all"
                    >
                        {submitting ? 'Submitting...' : 'Submit Requisition'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

/**
 * Requisition Detail & Approval Action Modal
 */
function RequisitionDetailModal({ requisitionId, onClose, onRefresh, onOpenIssueModal, showToast }) {
    const { user } = useAuth();
    const isAdmin = ['admin', 'superadmin'].includes((user?.role || '').toLowerCase());
    const userEmail = String(user?.email || '').toLowerCase();

    const [req, setReq] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionNotes, setActionNotes] = useState('');
    const [approvedQtyMap, setApprovedQtyMap] = useState({});
    const [processing, setProcessing] = useState(false);

    const loadDetail = useCallback(() => {
        setLoading(true);
        inventoryAPI.getRequisition(requisitionId)
            .then(res => {
                setReq(res.data);
                // Initialize approved qty map
                const map = {};
                (res.data.items || []).forEach(i => {
                    map[i.id] = i.approved_qty > 0 ? i.approved_qty : i.requested_qty;
                });
                setApprovedQtyMap(map);
            })
            .catch(err => {
                console.error(err);
                showToast('FAILED TO LOAD DETAILS', 'error');
            })
            .finally(() => setLoading(false));
    }, [requisitionId]);

    useEffect(() => { loadDetail(); }, [loadDetail]);

    if (loading || !req) {
        return (
            <Modal title="Requisition Intelligence" onClose={onClose}>
                <div className="py-16 flex flex-col items-center justify-center gap-4">
                    <div className="w-10 h-10 border-4 border-maroon border-t-gold rounded-xl animate-spin" />
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Loading Detail...</p>
                </div>
            </Modal>
        );
    }

    const isRequester = String(req.requester_email).toLowerCase() === userEmail;

    // Handler for admin approve
    const handleApprove = async () => {
        setProcessing(true);
        try {
            const itemsPayload = (req.items || []).map(i => ({
                requisition_item_id: i.id,
                approved_qty: parseInt(approvedQtyMap[i.id]) || 0
            }));

            await inventoryAPI.approveRequisition(req.id, {
                items: itemsPayload,
                approval_comments: actionNotes
            });
            showToast('REQUISITION APPROVED');
            loadDetail();
            onRefresh();
        } catch (err) {
            showToast(err.response?.data?.error || 'APPROVE FAILED', 'error');
        } finally {
            setProcessing(false);
        }
    };

    // Handler for admin reject
    const handleReject = async () => {
        if (!actionNotes.trim()) {
            showToast('REJECTION REASON REQUIRED', 'error');
            return;
        }
        setProcessing(true);
        try {
            await inventoryAPI.rejectRequisition(req.id, { rejection_reason: actionNotes });
            showToast('REQUISITION REJECTED');
            loadDetail();
            onRefresh();
        } catch (err) {
            showToast(err.response?.data?.error || 'REJECT FAILED', 'error');
        } finally {
            setProcessing(false);
        }
    };

    // Handler for admin request modification
    const handleRequestModification = async () => {
        if (!actionNotes.trim()) {
            showToast('MODIFICATION NOTE REQUIRED', 'error');
            return;
        }
        setProcessing(true);
        try {
            await inventoryAPI.requestModification(req.id, { modification_note: actionNotes });
            showToast('MODIFICATION REQUEST SENT');
            loadDetail();
            onRefresh();
        } catch (err) {
            showToast(err.response?.data?.error || 'ACTION FAILED', 'error');
        } finally {
            setProcessing(false);
        }
    };

    // Handler for submit draft
    const handleSubmitDraft = async () => {
        setProcessing(true);
        try {
            await inventoryAPI.submitRequisition(req.id);
            showToast('REQUISITION SUBMITTED');
            loadDetail();
            onRefresh();
        } catch (err) {
            showToast(err.response?.data?.error || 'SUBMIT FAILED', 'error');
        } finally {
            setProcessing(false);
        }
    };

    // Handler for confirm collection
    const handleConfirmCollection = async () => {
        setProcessing(true);
        try {
            await inventoryAPI.confirmCollection(req.id);
            showToast('COLLECTION CONFIRMED — COMPLETED');
            loadDetail();
            onRefresh();
        } catch (err) {
            showToast(err.response?.data?.error || 'CONFIRMATION FAILED', 'error');
        } finally {
            setProcessing(false);
        }
    };

    // Handler for cancel
    const handleCancel = async () => {
        if (!window.confirm('Cancel this requisition?')) return;
        setProcessing(true);
        try {
            await inventoryAPI.cancelRequisition(req.id);
            showToast('REQUISITION CANCELLED');
            loadDetail();
            onRefresh();
        } catch (err) {
            showToast(err.response?.data?.error || 'CANCEL FAILED', 'error');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <Modal title={`Requisition ${req.requisition_number}`} onClose={onClose}>
            <div className="space-y-6">
                {/* Header Summary */}
                <div className="p-4 bg-gray-50 dark:bg-white/[0.02] rounded-2xl border border-gray-100 dark:border-white/5 flex flex-wrap justify-between gap-4">
                    <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Requester</p>
                        <p className="text-[13px] font-black text-gray-900 dark:text-white uppercase mt-0.5">{req.requester_name}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase">{req.department} ({req.requester_email})</p>
                    </div>

                    <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Priority & Date</p>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2.5 py-0.5 rounded text-[8px] font-black uppercase ${req.priority === 'Urgent' ? 'bg-rose-500/10 text-rose-600' : 'bg-gray-200 dark:bg-white/10 text-gray-700'}`}>
                                {req.priority}
                            </span>
                            <span className="text-[9px] font-bold text-gray-500">Required: {req.required_date || 'N/A'}</span>
                        </div>
                    </div>

                    <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
                        <StatusBadge status={req.status} />
                    </div>
                </div>

                {req.purpose && (
                    <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                        <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">Purpose / Notes</p>
                        <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300 italic">"{req.purpose}"</p>
                    </div>
                )}

                {/* Status Lifecycle Stepper */}
                <div className="py-2">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">Requisition Lifecycle</p>
                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { label: 'Submitted', active: ['PENDING', 'APPROVED', 'MODIFICATION_REQUIRED', 'PARTIALLY_ISSUED', 'ISSUED', 'COMPLETED'].includes(req.status) },
                            { label: 'Approved', active: ['APPROVED', 'PARTIALLY_ISSUED', 'ISSUED', 'COMPLETED'].includes(req.status) },
                            { label: 'Issued', active: ['PARTIALLY_ISSUED', 'ISSUED', 'COMPLETED'].includes(req.status) },
                            { label: 'Completed', active: req.status === 'COMPLETED' }
                        ].map((step, idx) => (
                            <div key={idx} className={`p-2.5 rounded-xl border text-center transition-all ${
                                step.active 
                                    ? 'bg-maroon/10 border-maroon/30 text-maroon dark:text-gold font-black' 
                                    : 'bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/5 text-gray-400'
                            }`}>
                                <p className="text-[8px] uppercase tracking-widest font-black">Step 0{idx + 1}</p>
                                <p className="text-[10px] uppercase font-bold">{step.label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Items Table */}
                <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Requested Line Items ({req.items?.length || 0})</p>
                    <div className="border border-gray-100 dark:border-white/5 rounded-2xl overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50/50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5">
                                    <th className="px-4 py-2.5 text-left text-[9px] font-black text-gray-400 uppercase">Item Name</th>
                                    <th className="px-3 py-2.5 text-center text-[9px] font-black text-gray-400 uppercase">Req Qty</th>
                                    <th className="px-3 py-2.5 text-center text-[9px] font-black text-gray-400 uppercase">Appr Qty</th>
                                    <th className="px-3 py-2.5 text-center text-[9px] font-black text-gray-400 uppercase">Iss Qty</th>
                                    <th className="px-3 py-2.5 text-center text-[9px] font-black text-gray-400 uppercase">Stock Avail</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                                {(req.items || []).map(item => (
                                    <tr key={item.id} className="hover:bg-gray-50/30 dark:hover:bg-white/[0.01]">
                                        <td className="px-4 py-3">
                                            <p className="text-[11px] font-black text-gray-900 dark:text-white uppercase leading-tight">{item.item_name}</p>
                                            <p className="text-[8px] text-gray-400 uppercase mt-0.5">{item.category_name || 'General'}</p>
                                        </td>

                                        <td className="px-3 py-3 text-center text-[11px] font-black text-gray-700 dark:text-gray-300">
                                            {item.requested_qty} {item.unit_type}
                                        </td>

                                        <td className="px-3 py-3 text-center">
                                            {req.status === 'PENDING' && isAdmin && !isRequester ? (
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={approvedQtyMap[item.id] || 0}
                                                    onChange={e => setApprovedQtyMap({ ...approvedQtyMap, [item.id]: e.target.value })}
                                                    className="w-16 px-2 py-1 bg-white dark:bg-black border border-maroon/20 rounded text-center text-[10px] font-bold"
                                                />
                                            ) : (
                                                <span className="text-[11px] font-black text-emerald-600">{item.approved_qty}</span>
                                            )}
                                        </td>

                                        <td className="px-3 py-3 text-center text-[11px] font-black text-blue-600">
                                            {item.issued_qty}
                                        </td>

                                        <td className="px-3 py-3 text-center">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                                                (item.available_stock_qty || 0) < item.requested_qty 
                                                    ? 'bg-rose-500/10 text-rose-600' 
                                                    : 'bg-emerald-500/10 text-emerald-600'
                                            }`}>
                                                {item.available_stock_qty !== undefined ? `${item.available_stock_qty} on hand` : 'N/A'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Actions & Decision Notes Panel */}
                <div className="p-4 bg-gray-50/50 dark:bg-white/[0.02] rounded-2xl border border-gray-100 dark:border-white/5 space-y-4">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Workflow Actions</p>

                    {(isAdmin || isRequester) && (
                        <textarea
                            placeholder="Approval comments / Rejection reason / Modification notes..."
                            value={actionNotes}
                            onChange={e => setActionNotes(e.target.value)}
                            className="w-full px-4 py-3 bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl text-[10px] font-bold focus:outline-none"
                        />
                    )}

                    <div className="flex flex-wrap gap-2">
                        {/* Admin Pending Actions */}
                        {req.status === 'PENDING' && isAdmin && !isRequester && (
                            <>
                                <button
                                    disabled={processing}
                                    onClick={handleApprove}
                                    className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-md"
                                >
                                    Approve Requisition
                                </button>
                                <button
                                    disabled={processing}
                                    onClick={handleRequestModification}
                                    className="px-5 py-2.5 bg-orange-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-orange-600 transition-all shadow-md"
                                >
                                    Request Modification
                                </button>
                                <button
                                    disabled={processing}
                                    onClick={handleReject}
                                    className="px-5 py-2.5 bg-rose-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-500 transition-all shadow-md"
                                >
                                    Reject Requisition
                                </button>
                            </>
                        )}

                        {/* Admin Issue Stock Action */}
                        {['APPROVED', 'PARTIALLY_ISSUED'].includes(req.status) && isAdmin && (
                            <button
                                disabled={processing}
                                onClick={onOpenIssueModal}
                                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-md flex items-center gap-2"
                            >
                                <Box className="w-4 h-4" /> Issue Stock Items
                            </button>
                        )}

                        {/* Trainer Confirm Collection */}
                        {['ISSUED', 'PARTIALLY_ISSUED'].includes(req.status) && (
                            <button
                                disabled={processing}
                                onClick={handleConfirmCollection}
                                className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-md flex items-center gap-2"
                            >
                                <CheckCircle2 className="w-4 h-4" /> Confirm Collection
                            </button>
                        )}

                        {/* Trainer Submit Draft */}
                        {req.status === 'DRAFT' && isRequester && (
                            <button
                                disabled={processing}
                                onClick={handleSubmitDraft}
                                className="px-5 py-2.5 bg-maroon text-gold rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-md"
                            >
                                Submit Requisition
                            </button>
                        )}

                        {/* Cancel Button */}
                        {!['COMPLETED', 'CANCELLED'].includes(req.status) && (isAdmin || isRequester) && (
                            <button
                                disabled={processing}
                                onClick={handleCancel}
                                className="px-4 py-2.5 bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all ml-auto"
                            >
                                Cancel Requisition
                            </button>
                        )}
                    </div>
                </div>

                {/* Audit Timeline */}
                {req.timeline && req.timeline.length > 0 && (
                    <ApprovalTimeline timeline={req.timeline} />
                )}
            </div>
        </Modal>
    );
}

/**
 * Issue Items Modal for Admins
 */
function IssueItemsModal({ requisitionId, onClose, onSuccess }) {
    const [req, setReq] = useState(null);
    const [loading, setLoading] = useState(true);
    const [issueQtyMap, setIssueQtyMap] = useState({});
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        inventoryAPI.getRequisition(requisitionId).then(res => {
            setReq(res.data);
            const map = {};
            (res.data.items || []).forEach(i => {
                const remaining = Math.max(0, (i.approved_qty > 0 ? i.approved_qty : i.requested_qty) - (i.issued_qty || 0));
                map[i.id] = remaining;
            });
            setIssueQtyMap(map);
        }).finally(() => setLoading(false));
    }, [requisitionId]);

    const handleIssueSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        const itemsPayload = Object.entries(issueQtyMap)
            .map(([reqItemId, qty]) => ({ requisition_item_id: parseInt(reqItemId), issue_qty: parseInt(qty) || 0 }))
            .filter(i => i.issue_qty > 0);

        if (itemsPayload.length === 0) {
            setErrorMsg('Specify at least one item with issue_qty > 0');
            return;
        }

        setSubmitting(true);
        try {
            await inventoryAPI.issueItems(requisitionId, {
                items: itemsPayload,
                notes
            });
            onSuccess();
        } catch (err) {
            setErrorMsg(err.response?.data?.error || err.response?.data?.details?.[0] || 'Issue stock failed');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading || !req) {
        return (
            <Modal title="Issue Stock" onClose={onClose}>
                <div className="py-12 text-center text-xs font-bold">Loading requisition data...</div>
            </Modal>
        );
    }

    return (
        <Modal title={`Issue Stock for REQ ${req.requisition_number}`} onClose={onClose}>
            <form onSubmit={handleIssueSubmit} className="space-y-6">
                {errorMsg && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-xs font-bold">
                        {errorMsg}
                    </div>
                )}

                <div className="border border-gray-100 dark:border-white/5 rounded-2xl overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5">
                                <th className="px-4 py-2.5 text-left text-[9px] font-black text-gray-400 uppercase">Item</th>
                                <th className="px-3 py-2.5 text-center text-[9px] font-black text-gray-400 uppercase">Approved Qty</th>
                                <th className="px-3 py-2.5 text-center text-[9px] font-black text-gray-400 uppercase">Issued So Far</th>
                                <th className="px-3 py-2.5 text-center text-[9px] font-black text-gray-400 uppercase">Available Stock</th>
                                <th className="px-3 py-2.5 text-center text-[9px] font-black text-gray-400 uppercase">Issue Now</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                            {(req.items || []).map(item => {
                                const avail = item.available_stock_qty !== undefined ? item.available_stock_qty : (item.current_stock_qty || 0);
                                const issueQty = issueQtyMap[item.id] || 0;
                                const isOverStock = issueQty > avail;

                                return (
                                    <tr key={item.id} className="hover:bg-gray-50/30">
                                        <td className="px-4 py-3">
                                            <p className="text-[11px] font-black uppercase text-gray-900 dark:text-white">{item.item_name}</p>
                                        </td>
                                        <td className="px-3 py-3 text-center text-[11px] font-black">{item.approved_qty}</td>
                                        <td className="px-3 py-3 text-center text-[11px] font-black text-blue-600">{item.issued_qty}</td>
                                        <td className="px-3 py-3 text-center text-[11px] font-black">
                                            <span className={avail < issueQty ? 'text-rose-500 font-bold' : 'text-emerald-600'}>
                                                {avail}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            <input
                                                type="number"
                                                min="0"
                                                max={avail}
                                                value={issueQtyMap[item.id] || 0}
                                                onChange={e => setIssueQtyMap({ ...issueQtyMap, [item.id]: parseInt(e.target.value) || 0 })}
                                                className={`w-20 px-2 py-1 bg-white dark:bg-black border rounded text-center text-[10px] font-bold ${
                                                    isOverStock ? 'border-rose-500 text-rose-500 ring-2 ring-rose-500/20' : 'border-gray-200 dark:border-white/10'
                                                }`}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div>
                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Issue Transaction Notes</label>
                    <input
                        type="text"
                        placeholder="e.g. Issued batch #4829 from main store..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-black border border-gray-100 dark:border-white/5 rounded-xl text-[10px] font-bold"
                    />
                </div>

                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
                >
                    {submitting ? 'Processing Issue...' : 'Authorize Stock Issue & Deduct Inventory'}
                </button>
            </form>
        </Modal>
    );
}

/**
 * Audit Trail Timeline Component
 */
function ApprovalTimeline({ timeline }) {
    return (
        <div className="p-4 bg-gray-50/50 dark:bg-white/[0.01] rounded-2xl border border-gray-100 dark:border-white/5">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-4">Audit Trail & History</p>
            <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200 dark:before:bg-white/10">
                {timeline.map((event, idx) => (
                    <div key={idx} className="relative">
                        <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-maroon border-2 border-white dark:border-black" />
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-gray-900 dark:text-white uppercase">{event.action?.replace(/_/g, ' ')}</span>
                                <span className="text-[8px] font-bold text-gray-400">• {new Date(event.timestamp).toLocaleString()}</span>
                            </div>
                            <p className="text-[9px] font-bold text-gray-500 uppercase">By {event.user_name || event.user_email}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ProcurementTab() {
    const { user } = useAuth();
    const isAdmin = ['admin', 'superadmin'].includes((user?.role || '').toLowerCase());
    const [wishlist, setWishlist] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [toast, setToast] = useState(null);
    const [formData, setFormData] = useState({ 
        item_name: '', 
        description: '', 
        quantity: 1, 
        estimated_unit_price: 0, 
        priority: 'Medium', 
        department: 'Beauty Therapy', 
        notes: '' 
    });

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    const loadData = useCallback(() => {
        setLoading(true);
        inventoryAPI.getWishlist()
            .then(res => setWishlist(res.data))
            .catch(err => {
                showToast('WISHLIST SYNC FAILED', 'error');
                console.error(err);
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await inventoryAPI.createWishlist(formData);
            showToast('WISHLIST ITEM SECURED');
            setShowModal(false);
            loadData();
            setFormData({ item_name: '', description: '', quantity: 1, estimated_unit_price: 0, priority: 'Medium', department: 'Beauty Therapy', notes: '' });
        } catch (err) {
            showToast(err.response?.data?.error || 'FAILED TO SUBMIT', 'error');
        }
    };

    const handleStatusUpdate = async (id, status, reason = '') => {
        try {
            await inventoryAPI.updateWishlist(id, { status, rejection_reason: reason });
            showToast(`ITEM ${status.toUpperCase()}`);
            loadData();
        } catch (err) {
            showToast('UPDATE FAILED', 'error');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('ABORT WISHLIST ITEM?')) return;
        try {
            await inventoryAPI.deleteWishlist(id);
            showToast('ITEM REMOVED FROM WISHLIST');
            loadData();
        } catch (err) {
            showToast('DELETE FAILED', 'error');
        }
    };

    const PriorityBadge = ({ priority }) => {
        const colors = {
            Low: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
            Medium: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
            High: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
            Critical: 'bg-rose-500/10 text-rose-500 border-rose-500/20 animate-pulse'
        };
        return (
            <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${colors[priority]}`}>
                {priority} Priority
            </span>
        );
    };

    return (
        <div className="space-y-10 animate-in slide-in-from-bottom-8 duration-700">
            <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-[-0.05em] mb-1">Procurement Wishlist</h2>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-maroon animate-pulse" />
                        Logistics Acquisition Registry
                    </p>
                </div>
                <button 
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-4 bg-maroon hover:bg-maroon/90 text-gold px-8 py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-maroon/20 active:scale-95 transition-all border border-white/10 group"
                >
                    <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform stroke-[3]" /> Request New Item
                </button>
            </div>

            {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

            <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-100 dark:border-white/5 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.08)] overflow-hidden ring-1 ring-black/5 min-h-[500px]">
                <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-50/20 dark:bg-white/[0.01] border-b border-gray-100 dark:border-white/5">
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em]">Requested Item</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em]">Priority & Dept</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em]">Volume & Cost</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em]">Status</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em]">Intelligence</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50/50 dark:divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-6">
                                            <div className="w-12 h-12 border-4 border-maroon border-t-transparent rounded-[1.5rem] animate-spin shadow-2xl"></div>
                                            <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.5em] animate-pulse">Scanning Procurement Lattices...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : wishlist.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="py-24 text-center">
                                        <div className="w-20 h-20 bg-gray-50/50 dark:bg-white/[0.02] rounded-3xl flex items-center justify-center mx-auto mb-6 border border-dashed border-gray-200 dark:border-white/10">
                                            <ShoppingCart className="w-10 h-10 text-gray-200" />
                                        </div>
                                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.4em]">No external acquisition requests logged</p>
                                    </td>
                                </tr>
                            ) : wishlist.map(item => (
                                <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.015] transition-all duration-300 group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-6">
                                            <div className="w-12 h-12 bg-maroon/5 rounded-2xl flex items-center justify-center border border-maroon/10 group-hover:scale-110 transition-transform">
                                                <Package className="w-6 h-6 text-maroon" />
                                            </div>
                                            <div>
                                                <p className="text-[12px] font-black text-gray-900 dark:text-white uppercase tracking-tight group-hover:text-maroon transition-colors">{item.item_name}</p>
                                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1 opacity-70 italic max-w-xs truncate">{item.description || 'No detailed intel available'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-2">
                                            <PriorityBadge priority={item.priority} />
                                            <div className="flex items-center gap-2">
                                                <MapPin className="w-3 h-3 text-gray-400" />
                                                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{item.department}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <p className="text-[13px] font-black text-gray-800 dark:text-white leading-none">{item.quantity} <span className="text-[9px] text-gray-400">UNITS</span></p>
                                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-tight">KSh {Number(item.estimated_unit_price || 0).toLocaleString()}/ea</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <StatusBadge status={item.status} />
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {isAdmin && item.status === 'Pending' ? (
                                            <div className="flex items-center justify-end gap-2">
                                                <button 
                                                    onClick={() => handleStatusUpdate(item.id, 'Approved')}
                                                    className="p-3 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-xl transition-all border border-emerald-500/20"
                                                    title="Authorize Acquisition"
                                                >
                                                    <CheckCircle2 className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        const r = window.prompt('Mission Rejection Reason?');
                                                        if(r) handleStatusUpdate(item.id, 'Rejected', r);
                                                    }}
                                                    className="p-3 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl transition-all border border-rose-500/20"
                                                    title="Abort Mission"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : isAdmin && item.status === 'Approved' ? (
                                            <button 
                                                onClick={() => handleStatusUpdate(item.id, 'Purchased')}
                                                className="px-4 py-2 bg-blue-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20"
                                            >
                                                Confirm Purchase
                                            </button>
                                        ) : (
                                            <div className="flex flex-col items-end opacity-40">
                                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">{item.requested_by_name}</p>
                                                <p className="text-[7px] font-bold text-gray-400 uppercase tracking-widest">{new Date(item.created_at).toLocaleDateString()}</p>
                                            </div>
                                        )}
                                        {(!isAdmin || item.status === 'Pending') && item.requested_by === user.email && (
                                            <button 
                                                onClick={() => handleDelete(item.id)}
                                                className="mt-2 p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                                                title="Retract Request"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <Modal title="Logistics Wishlist Entry" onClose={() => setShowModal(false)}>
                    <form onSubmit={handleSubmit} className="space-y-8 py-4">
                        <InputField 
                            label="Target Asset Nomenclature" 
                            name="item_name" 
                            required 
                            value={formData.item_name}
                            onChange={e => setFormData({...formData, item_name: e.target.value})}
                            placeholder="WHAT IS REQUIRED?"
                        />
                        
                        <div className="relative">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3 block px-1">Functional Description</label>
                            <textarea 
                                className="w-full px-6 py-4 bg-gray-50 dark:bg-black border border-gray-100 dark:border-white/5 rounded-2xl text-[11px] font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-maroon/5 transition-all min-h-[80px]"
                                value={formData.description}
                                onChange={e => setFormData({...formData, description: e.target.value})}
                                placeholder="DETAIL MISSION NECESSITY..."
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <InputField 
                                label="Volume Required" 
                                type="number" 
                                value={formData.quantity}
                                onChange={e => setFormData({...formData, quantity: Number(e.target.value)})}
                                required 
                            />
                            <InputField 
                                label="Est. Unit Price (KSh)" 
                                type="number" 
                                value={formData.estimated_unit_price}
                                onChange={e => setFormData({...formData, estimated_unit_price: Number(e.target.value)})}
                            />
                            <SelectField 
                                label="Mission Priority" 
                                value={formData.priority}
                                onChange={e => setFormData({...formData, priority: e.target.value})}
                            >
                                <option value="Low">LOW PRIORITY</option>
                                <option value="Medium">STANDARD MISSION</option>
                                <option value="High">HIGH PRIORITY</option>
                                <option value="Critical">CRITICAL ASSET</option>
                            </SelectField>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <SelectField 
                                label="Requesting Sector" 
                                value={formData.department}
                                onChange={e => setFormData({...formData, department: e.target.value})}
                                required
                            >
                                <option value="Beauty Therapy">BEAUTY THERAPY</option>
                                <option value="Hairdressing">HAIRDRESSING</option>
                                <option value="ICT Department">ICT SECTOR</option>
                                <option value="Administration">CENTRAL ADMIN</option>
                                <option value="Barbering">BARBERING</option>
                            </SelectField>
                            <InputField 
                                label="Tactical Notes" 
                                value={formData.notes}
                                onChange={e => setFormData({...formData, notes: e.target.value})}
                                placeholder="RESTOCK REASONING..."
                            />
                        </div>

                        <button type="submit" className="w-full bg-gradient-to-r from-maroon to-[#800000] text-gold h-16 rounded-2xl text-[12px] font-black uppercase tracking-[0.3em] shadow-[0_20px_50px_-10px_rgba(128,0,0,0.4)] active:scale-95 transition-all mt-6 border border-white/10">
                            TRANSMIT REQUEST TO LOGISTICS HUB
                        </button>
                    </form>
                </Modal>
            )}
        </div>
    );
}

function StockMovementTab() {
    const [inLogs, setInLogs] = useState([]);
    const [outLogs, setOutLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('in'); // 'in' or 'out'
    const [showInModal, setShowInModal] = useState(false);
    const [showOutModal, setShowOutModal] = useState(false);
    const [items, setItems] = useState([]);
    const [suppliers, setSuppliers] = useState([]);

    const loadData = useCallback(() => {
        setLoading(true);
        Promise.all([
            inventoryAPI.getStockIn(),
            inventoryAPI.getStockOut(),
            inventoryAPI.getItems(),
            inventoryAPI.getSuppliers()
        ]).then(([si, so, i, s]) => {
            setInLogs(si.data);
            setOutLogs(so.data);
            setItems(i.data);
            setSuppliers(s.data);
        }).finally(() => setLoading(false));
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleStockIn = async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        try {
            await inventoryAPI.createStockIn(data);
            setShowInModal(false);
            loadData();
        } catch (e) { alert('Stock In failed'); }
    };

    const handleStockOut = async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        try {
            await inventoryAPI.createStockOut(data);
            setShowOutModal(false);
            loadData();
        } catch (e) { alert(e.response?.data?.error || 'Stock Out failed'); }
    };

    return (
        <div className="space-y-10 animate-in slide-in-from-right-8 duration-700">
            {/* Tactical Switcher */}
            <div className="flex bg-white dark:bg-[#111] p-2 rounded-2xl border border-gray-100 dark:border-white/5 w-fit mx-auto shadow-[0_20px_50px_-15px_rgba(0,0,0,0.05)] ring-1 ring-black/5 mb-12">
                <button 
                    onClick={() => setView('in')} 
                    className={`flex items-center gap-3 px-6 py-4 rounded-[1.8rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${
                        view === 'in' ? 'bg-maroon text-gold shadow-xl shadow-maroon/20 scale-100' : 'text-gray-400 hover:text-maroon'
                    }`}
                >
                    <ArrowDownToLine className={`w-4 h-4 ${view === 'in' ? 'stroke-[3]' : 'stroke-[2]'}`} />
                    Stock Intake
                </button>
                <button 
                    onClick={() => setView('out')} 
                    className={`flex items-center gap-3 px-6 py-4 rounded-[1.8rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${
                        view === 'out' ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-600/20 scale-100' : 'text-gray-400 hover:text-emerald-600'
                    }`}
                >
                    <ArrowUpFromLine className={`w-4 h-4 ${view === 'out' ? 'stroke-[3]' : 'stroke-[2]'}`} />
                    Stock Issued
                </button>
            </div>

            <div className="flex justify-between items-end mb-8 animate-in fade-in duration-500">
                <div>
                    <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-[-0.03em] mb-1">
                        {view === 'in' ? 'Logistics Inbound' : 'Logistics Outbound'}
                    </h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${view === 'in' ? 'bg-maroon' : 'bg-emerald-500'}`} />
                        Historical Operational Records
                    </p>
                </div>
                {view === 'in' ? (
                    <button onClick={() => setShowInModal(true)} className="flex items-center gap-4 bg-maroon hover:bg-maroon/90 text-gold px-6 py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-[0_20px_50px_-10px_rgba(128,0,0,0.3)] transition-all active:scale-95 border border-white/10 group">
                        <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform stroke-[3]" /> Record intake
                    </button>
                ) : (
                    <button onClick={() => setShowOutModal(true)} className="flex items-center gap-4 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-[0_20px_50px_-10px_rgba(5,150,105,0.3)] transition-all active:scale-95 border border-white/10 group">
                        <ArrowUpFromLine className="w-5 h-5 group-hover:-translate-y-1 transition-transform stroke-[3]" /> Distribute assets
                    </button>
                )}
            </div>

            <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-100 dark:border-white/5 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.08)] overflow-hidden ring-1 ring-black/5 min-h-[500px] relative">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-gray-100 dark:via-white/5 to-transparent" />
                {loading ? (
                    <div className="py-16 flex flex-col items-center justify-center gap-6">
                        <div className={`w-12 h-12 border-4 ${view === 'in' ? 'border-maroon' : 'border-emerald-500'} border-t-transparent rounded-[1.5rem] animate-spin shadow-2xl transition-colors`}></div>
                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.5em] animate-pulse">Syncing Journal Segments...</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto no-scrollbar">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-gray-50/20 dark:bg-white/[0.01] border-b border-gray-100 dark:border-white/5">
                                    <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em]">Log Date</th>
                                    <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em]">Operational Unit</th>
                                    <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em]">Flow Volume</th>
                                    <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em]">{view === 'in' ? 'Supply Source' : 'Sector Destination'}</th>
                                    <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em]">{view === 'in' ? 'Receiver' : 'Issuer'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50/50 dark:divide-white/5">
                                {(view === 'in' ? inLogs : outLogs).length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="py-16 text-center text-gray-300 font-black italic uppercase tracking-[0.4em] opacity-30">Null sector entrylogs</td>
                                    </tr>
                                ) : (view === 'in' ? inLogs : outLogs).map(log => (
                                    <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.015] transition-all duration-300 group">
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <p className="text-[12px] font-black text-gray-900 dark:text-white leading-none mb-1">{new Date(log.created_at).toLocaleDateString()}</p>
                                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border border-black/5 dark:border-white/5 ${view === 'in' ? 'bg-maroon/5 text-maroon' : 'bg-emerald-500/5 text-emerald-500'}`}>
                                                    <Box className="w-5 h-5" />
                                                </div>
                                                <p className="text-[11px] font-black text-gray-800 dark:text-gray-200 uppercase tracking-tight group-hover:text-maroon dark:group-hover:text-gold transition-colors">{log.item_name}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className={`inline-flex items-center px-4 py-2 rounded-2xl text-[12px] font-black border ${
                                                view === 'in' 
                                                ? 'bg-maroon/5 text-maroon border-maroon/10' 
                                                : 'bg-emerald-500/5 text-emerald-500 border-emerald-500/10'
                                            } transition-all group-hover:scale-110`}>
                                                {view === 'in' ? '+' : '-'}{view === 'in' ? log.quantity_received : log.quantity_issued}
                                                <span className="text-[8px] ml-2 opacity-60 uppercase">{log.unit_type?.split(' ')[0]}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-gray-200 dark:bg-gray-800" />
                                                <p className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">{view === 'in' ? log.supplier_name : log.department}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <p className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest leading-none mb-1">{view === 'in' ? log.received_by_name : log.issued_to}</p>
                                            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Authorized Signature</p>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showInModal && (
                <Modal title="Logistics Reception Entry" onClose={() => setShowInModal(false)}>
                    <form onSubmit={handleStockIn} className="space-y-8 py-4">
                        <SelectField label="Asset Target" name="item_id" required>
                            <option value="">Query Inventory Lattice...</option>
                            {items.map(i => <option key={i.id} value={i.id}>{i.name.toUpperCase()} (CURRENT VOL: {i.quantity})</option>)}
                        </SelectField>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <InputField label="Flow Volume Received" name="quantity_received" type="number" required />
                            <SelectField label="Supply Source (Vendor)" name="supplier_id">
                                <option value="">Select Resource Origin...</option>
                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()} [{s.company}]</option>)}
                            </SelectField>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <InputField label="Unit Acquisition Cost (KSh)" name="unit_cost" type="number" step="0.01" />
                            <InputField label="Operational Expiry Date" name="expiry_date" type="date" />
                        </div>
                        
                        <InputField label="Batch ID / Manifest Invoice" name="batch_number" />
                        
                        <button type="submit" className="w-full bg-gradient-to-r from-maroon to-[#800000] text-gold h-16 rounded-2xl text-[12px] font-black uppercase tracking-[0.3em] shadow-[0_20px_50px_-10px_rgba(128,0,0,0.4)] active:scale-95 transition-all mt-6 border border-white/10">
                            AUTHORIZE INTAKE & SYNC VAULT
                        </button>
                    </form>
                </Modal>
            )}

            {showOutModal && (
                <Modal title="Initialize Asset Distribution" onClose={() => setShowOutModal(false)}>
                    <form onSubmit={handleStockOut} className="space-y-8 py-4">
                        <SelectField label="Source Asset Class" name="item_id" required>
                            <option value="">Choose item for transfer...</option>
                            {items.filter(i => i.quantity > 0).map(i => <option key={i.id} value={i.id}>{i.name.toUpperCase()} - CAPACITY: {i.quantity} {i.unit_type}</option>)}
                        </SelectField>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <InputField label="Operational Volume to Issue" name="quantity_issued" type="number" required />
                            <SelectField label="Target Department Section" name="department" required>
                                <option value="Beauty Therapy">BEAUTY THERAPY</option>
                                <option value="Hairdressing">HAIRDRESSING</option>
                                <option value="ICT Department">ICT SECTOR</option>
                                <option value="Administration">CENTRAL ADMIN</option>
                                <option value="Barbering">BARBERING</option>
                            </SelectField>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <InputField label="Recipient Officer (Trainer)" name="issued_to" required />
                            <InputField label="Authorization Officer" name="approved_by" />
                        </div>
                        
                        <div className="relative">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block px-1">Operational Purpose / Comment</label>
                            <textarea 
                                name="purpose"
                                className="w-full px-6 py-5 bg-gray-50 dark:bg-black border border-gray-100 dark:border-white/5 rounded-[1.5rem] text-[11px] font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-maroon/5 transition-all min-h-[100px]"
                                placeholder="DETAIL MISSION REQUIREMENT..."
                            />
                        </div>
                        
                        <button type="submit" className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 text-white h-16 rounded-2xl text-[12px] font-black uppercase tracking-[0.3em] shadow-[0_20px_50px_-10px_rgba(5,150,105,0.4)] active:scale-95 transition-all mt-6 border border-white/10">
                            AUTHORIZE DISTRIBUTION & UPDATE LOGS
                        </button>
                    </form>
                </Modal>
            )}
        </div>
    );
}

function MyStockTab() {
    const [myStock, setMyStock] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        inventoryAPI.getStockOut()
            .then(res => setMyStock(res.data))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="space-y-10 animate-in slide-in-from-bottom-8 duration-700">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-[-0.05em] mb-1">Personal Asset Portal</h2>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
                        Custodial Possession Journal
                    </p>
                </div>
            </div>

            <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-100 dark:border-white/5 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.08)] overflow-hidden ring-1 ring-black/5 min-h-[500px]">
                <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-50/20 dark:bg-white/[0.01] border-b border-gray-100 dark:border-white/5">
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em]">Entrusted Asset</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em]">Operational Volume</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em]">Issuance Date</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em]">Mission Focus</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50/50 dark:divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="py-16 text-center">
                                        <div className="flex flex-col items-center gap-6 font-black text-gray-200 uppercase tracking-[0.5em] animate-pulse">
                                            <div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-[1.5rem] animate-spin shadow-2xl"></div>
                                            Syncing Custodial Vault...
                                        </div>
                                    </td>
                                </tr>
                            ) : myStock.length > 0 ? myStock.map(item => (
                                <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.015] transition-all duration-300 group">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-6">
                                            <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-black flex items-center justify-center border border-black/5 dark:border-white/5 shadow-inner group-hover:scale-110 transition-transform">
                                                <Boxes className="w-7 h-7 text-gold" />
                                            </div>
                                            <div>
                                                <p className="text-[13px] font-black text-gray-900 dark:text-white uppercase tracking-tight leading-tight group-hover:text-maroon dark:group-hover:text-gold transition-colors">{item.item_name}</p>
                                                <p className="text-[9px] text-gray-400 font-black tracking-[0.2em] mt-1.5 uppercase opacity-60">Inventory Controlled</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-end gap-2">
                                            <span className="text-base font-black text-emerald-600 leading-none">{item.quantity_issued}</span>
                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">{item.unit_type?.split(' ')[0]}s</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <Calendar className="w-4 h-4 text-gray-300" />
                                            <p className="text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.05em]">
                                                {new Date(item.date_issued).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-start gap-3 max-w-xs">
                                            <div className="w-1.5 h-1.5 rounded-full bg-gold/40 mt-1.5 shrink-0" />
                                            <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase leading-relaxed tracking-wider italic">" {item.purpose || 'Ongoing Operational Utility'} "</p>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="4" className="py-16 text-center">
                                        <div className="w-16 h-16 bg-gray-50/50 dark:bg-white/[0.02] rounded-2xl flex items-center justify-center mx-auto mb-6 relative group">
                                            <div className="absolute inset-0 bg-gold/10 rounded-2xl blur-2xl group-hover:bg-gold/20 transition-all" />
                                            <PackageOpen className="w-10 h-10 text-gray-300 relative z-10" />
                                        </div>
                                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.5em] max-w-xs mx-auto leading-loose">No custodial asset records found in current sector</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
