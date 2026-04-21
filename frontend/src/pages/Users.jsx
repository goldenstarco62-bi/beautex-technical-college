import { useState, useEffect } from 'react';
import { usersAPI, authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
    Shield, User, Mail, Trash2, CheckCircle, XCircle,
    Key, Lock, Unlock, FileText, EyeOff,
    Printer, Download, Eye, Clock, UserPlus, DollarSign,
    ChevronLeft, ChevronRight, AlertCircle, Plus
} from 'lucide-react';

export default function Users() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('All Users');
    const [selectedUser, setSelectedUser] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Create User Modal state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState({ email: '', password: '', role: 'student' });
    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState('');
    const [showCreatePassword, setShowCreatePassword] = useState(false);

    const tabs = [
        'All Users', 'Students', 'Trainers', 'Admins', 'Suspended', 'Pending Approval'
    ];

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const response = await usersAPI.getAll();
            setUsers(response.data);
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
        // Auto-refresh every 30 seconds so presence stays current
        const interval = setInterval(fetchUsers, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setCreateError('');

        // Client-side validation matching backend rules
        if (!createForm.email || !createForm.password || !createForm.role) {
            setCreateError('All fields are required.');
            return;
        }
        if (createForm.password.length < 8) {
            setCreateError('Password must be at least 8 characters long.');
            return;
        }
        if (!/\d/.test(createForm.password)) {
            setCreateError('Password must contain at least one number.');
            return;
        }
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(createForm.password)) {
            setCreateError('Password must contain at least one special character.');
            return;
        }

        setCreateLoading(true);
        try {
            await authAPI.register(createForm.email, createForm.password, createForm.role);
            toast.success(`✅ Account created for ${createForm.email}`);
            setShowCreateModal(false);
            setCreateForm({ email: '', password: '', role: 'student' });
            setCreateError('');
            fetchUsers();
        } catch (err) {
            const status = err.response?.status;
            const msg = err.response?.data?.error || err.message || 'Failed to create account.';
            if (status === 409) {
                setCreateError(`⚠️ ${msg}`);
            } else if (status === 400) {
                setCreateError(`Validation: ${msg}`);
            } else {
                setCreateError(msg);
            }
        } finally {
            setCreateLoading(false);
        }
    };

    const handleRoleChange = async (userId, newRole) => {
        if (!window.confirm(`Formal Authorization: Confirm role transition to ${newRole}?`)) return;
        try {
            await usersAPI.updateRole(userId, newRole);
            fetchUsers();
            toast.success(`Role updated to ${newRole}`);
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to update role');
        }
    };

    const handleStatusUpdate = async (userId, newStatus) => {
        const msg = newStatus === 'Suspended'
            ? 'Account Lock: Are you sure you want to SUSPEND this account?'
            : `Administrative Action: Set status to ${newStatus}?`;

        if (!window.confirm(msg)) return;
        try {
            await usersAPI.updateStatus(userId, newStatus);
            fetchUsers();
            if (selectedUser?.id === userId) {
                setSelectedUser(prev => ({ ...prev, status: newStatus }));
            }
            toast.success(`Account status set to ${newStatus}`);
        } catch (error) {
            toast.error(error.response?.data?.error || 'Status update failed');
        }
    };

    const handleResetPassword = async (userId, userEmail) => {
        if (!window.confirm(`Security Reset: Generate temporary credentials for ${userEmail}?`)) return;
        try {
            await usersAPI.resetPassword(userId);
            toast.success(`Temporary credentials dispatched to ${userEmail}.`, { duration: 5000 });
        } catch (error) {
            toast.error(error.response?.data?.error || 'Password reset failed');
        }
    };

    const handleDelete = async (userId, userEmail) => {
        if (userId === currentUser.id) {
            toast.error('Access Denied: Cannot revoke active administrative session.');
            return;
        }
        if (!window.confirm(`PERMANENT DISMISSAL: Are you sure you want to remove ${userEmail}? This action is IRREVERSIBLE.`)) return;
        try {
            await usersAPI.delete(userId);
            fetchUsers();
            if (showDetailModal) setShowDetailModal(false);
            toast.success(`Account ${userEmail} permanently removed.`);
        } catch (error) {
            toast.error(error.response?.data?.error || 'Dismissal failed');
        }
    };

    const handleFinancePermission = async (userId, currentFlag) => {
        const msg = currentFlag
            ? 'Revoke finance editing rights from this admin?'
            : 'Grant finance editing rights to this admin? They will be able to add, edit and delete payment records.';
        if (!window.confirm(msg)) return;
        try {
            await usersAPI.updateFinancePermission(userId, !currentFlag);
            fetchUsers();
            if (selectedUser?.id === userId) {
                setSelectedUser(prev => ({ ...prev, can_edit_finance: !currentFlag }));
            }
            toast.success(`Finance editing ${!currentFlag ? 'granted' : 'revoked'} successfully.`);
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to update finance permission');
        }
    };

    const handleStudentPermission = async (userId, currentFlag) => {
        const msg = currentFlag
            ? 'Revoke student registry management rights from this admin?'
            : 'Grant student registry management rights to this admin? They will be able to reset student passwords and update enrollment statuses.';
        if (!window.confirm(msg)) return;
        try {
            await usersAPI.updateStudentPermission(userId, !currentFlag);
            fetchUsers();
            if (selectedUser?.id === userId) {
                setSelectedUser(prev => ({ ...prev, can_edit_students: !currentFlag }));
            }
            toast.success(`Student registry permission ${!currentFlag ? 'granted' : 'revoked'} successfully.`);
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to update student permission');
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleDownload = () => {
        const csvContent = "data:text/csv;charset=utf-8,"
            + ["ID,Email,Role,Status,Joined"].join(",") + "\n"
            + filteredUsers.map(u => `${u.id},${u.email},${u.role},${u.status},${new Date(u.created_at).toLocaleDateString()}`).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `user_report_${activeTab.toLowerCase().replace(' ', '_')}.csv`);
        document.body.appendChild(link);
        link.click();
    };

    const getFilteredUsers = () => {
        let filtered = users;

        switch (activeTab) {
            case 'Students': filtered = users.filter(u => u.role === 'student'); break;
            case 'Trainers': filtered = users.filter(u => u.role === 'teacher'); break;
            case 'Admins': filtered = users.filter(u => u.role === 'admin' || u.role === 'superadmin'); break;
            case 'Suspended': filtered = users.filter(u => u.status === 'Suspended' || u.status === 'Inactive'); break;
            case 'Pending Approval': filtered = users.filter(u => u.status === 'Pending Approval'); break;
            default: filtered = users;
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(u =>
                (u.email || '').toLowerCase().includes(q) ||
                (u.name || '').toLowerCase().includes(q) ||
                String(u.id).includes(q)
            );
        }
        return filtered;
    };

    const filteredUsers = getFilteredUsers();

    // Presence badge component
    const PresenceBadge = ({ onlineStatus }) => {
        if (onlineStatus === 'Online') return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-green-500/15 text-green-600 border border-green-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping absolute"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 relative"></span>
                Online
            </span>
        );
        if (onlineStatus === 'Away') return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-500/15 text-amber-600 border border-amber-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                Away
            </span>
        );
        if (onlineStatus === 'Never') return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-blue-500/15 text-blue-600 border border-blue-500/20 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                Pending First Login
            </span>
        );
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-gray-200/60 text-gray-400 border border-gray-200 dark:bg-white/5 dark:border-white/10">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                Offline
            </span>
        );
    };

    const UserDetailModal = ({ user, onClose }) => {
        if (!user) return null;
        return (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col max-h-[90vh]">
                    <div className="bg-maroon p-8 text-white flex justify-between items-center">
                        <div className="flex items-center gap-6">
                            <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center text-3xl font-black">
                                {user.photo ? <img src={user.photo} className="w-full h-full object-cover rounded-2xl" /> : (user.email?.[0] || 'U').toUpperCase()}
                            </div>
                            <div>
                                <h2 className="text-2xl font-black uppercase tracking-tight">{user.name || 'User Profile'}</h2>
                                <p className="text-white/60 font-medium tracking-wide">{user.email}</p>
                                <div className="mt-2"><PresenceBadge onlineStatus={user.online_status} /></div>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-2xl transition-all">
                            <XCircle className="w-8 h-8" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Personal Info */}
                        <section className="space-y-4">
                            <h3 className="text-maroon font-black uppercase text-xs tracking-widest border-b border-maroon/10 pb-2">Institutional Identification</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div><p className="text-[10px] text-gray-400 uppercase font-black">System ID</p><p className="text-sm font-bold">#{user.id}</p></div>
                                <div><p className="text-[10px] text-gray-400 uppercase font-black">Account Role</p><p className="text-sm font-bold uppercase text-gold">{user.role}</p></div>
                                <div><p className="text-[10px] text-gray-400 uppercase font-black">Current Status</p>
                                    <p className={`text-sm font-bold uppercase ${user.status === 'Active' ? 'text-green-500' : 'text-red-500'}`}>{user.status}</p>
                                    <div className="mt-1"><PresenceBadge onlineStatus={user.online_status} /></div>
                                </div>
                                <div><p className="text-[10px] text-gray-400 uppercase font-black">Join Date</p><p className="text-sm font-bold">{new Date(user.created_at).toLocaleDateString()}</p></div>
                            </div>
                        </section>

                        {/* Contact Info */}
                        <section className="space-y-4">
                            <h3 className="text-maroon font-black uppercase text-xs tracking-widest border-b border-maroon/10 pb-2">Contact Details</h3>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3"><Mail className="w-4 h-4 text-maroon/40" /><span className="text-sm font-medium">{user.email}</span></div>
                                <div className="flex items-center gap-3"><User className="w-4 h-4 text-maroon/40" /><span className="text-sm font-medium">{user.phone || 'N/A'}</span></div>
                                <div className="flex items-center gap-3"><FileText className="w-4 h-4 text-maroon/40" /><span className="text-sm font-medium">{user.address || 'N/A'}</span></div>
                            </div>
                        </section>

                        {/* Role Management */}
                        <section className="space-y-4">
                            <h3 className="text-maroon font-black uppercase text-xs tracking-widest border-b border-maroon/10 pb-2">Role Management</h3>
                            <div className="space-y-2">
                                <p className="text-[10px] text-gray-400 uppercase font-black">Assign System Role</p>
                                <select
                                    value={user.role}
                                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                    className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-maroon transition-all cursor-pointer"
                                >
                                    <option value="student">Student Account</option>
                                    <option value="teacher">Faculty Member</option>
                                    <option value="admin">Administrator</option>
                                    <option value="superadmin">Superadmin</option>
                                </select>
                            </div>
                            {/* Administrative Permissions — only superadmin can grant, only to admins */}
                            {currentUser.role === 'superadmin' && user.role === 'admin' && (
                                <div className="mt-4 space-y-4">
                                    <div className="p-4 rounded-2xl border-2 border-dashed border-gold/40 bg-gold/5">
                                        <p className="text-[10px] text-gray-400 uppercase font-black mb-3 flex items-center gap-2">
                                            <DollarSign className="w-3 h-3 text-gold" />
                                            Finance Editor Access
                                        </p>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                                    {user.can_edit_finance ? '✅ Finance Editing: GRANTED' : '🔒 Finance Editing: RESTRICTED'}
                                                </p>
                                                <p className="text-[9px] text-gray-400 mt-0.5">
                                                    {user.can_edit_finance
                                                        ? 'This admin can record, edit and delete payments.'
                                                        : 'This admin can only view financial records.'}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleFinancePermission(user.id, !!user.can_edit_finance)}
                                                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${user.can_edit_finance
                                                        ? 'bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white border border-red-500/20'
                                                        : 'bg-gold/20 text-gold hover:bg-gold hover:text-maroon border border-gold/40'
                                                    }`}
                                            >
                                                {user.can_edit_finance ? 'Revoke' : 'Grant'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-2xl border-2 border-dashed border-maroon/40 bg-maroon/5">
                                        <p className="text-[10px] text-gray-400 uppercase font-black mb-3 flex items-center gap-2">
                                            <Shield className="w-3 h-3 text-maroon" />
                                            Student Registry Access
                                        </p>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                                    {user.can_edit_students ? '✅ Registry Access: GRANTED' : '🔒 Registry Access: RESTRICTED'}
                                                </p>
                                                <p className="text-[9px] text-gray-400 mt-0.5">
                                                    {user.can_edit_students
                                                        ? 'This admin can reset student passwords and update statuses.'
                                                        : 'This admin can only view student records.'}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleStudentPermission(user.id, !!user.can_edit_students)}
                                                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${user.can_edit_students
                                                        ? 'bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white border border-red-500/20'
                                                        : 'bg-maroon/20 text-maroon hover:bg-maroon hover:text-white border border-maroon/40'
                                                    }`}
                                            >
                                                {user.can_edit_students ? 'Revoke' : 'Grant'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* Administrative Controls */}
                        <section className="md:col-span-2 space-y-4 pt-4">
                            <h3 className="text-maroon font-black uppercase text-xs tracking-widest border-b border-maroon/10 pb-2">System Control Panel</h3>
                            <div className="flex flex-wrap gap-4">
                                {user.status === 'Pending Approval' && (
                                    <button onClick={() => handleStatusUpdate(user.id, 'Active')} className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-green-500 text-white hover:bg-green-600 transition-all font-black uppercase text-[10px] tracking-widest shadow-lg">
                                        <CheckCircle className="w-4 h-4" /> Approve Account
                                    </button>
                                )}
                                <button onClick={() => handleStatusUpdate(user.id, user.status === 'Active' ? 'Suspended' : 'Active')} className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-maroon hover:text-white transition-all font-black uppercase text-[10px] tracking-widest shadow-sm">
                                    {user.status === 'Active' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                    {user.status === 'Active' ? 'Suspend Account' : 'Reactivate Account'}
                                </button>
                                <button onClick={() => handleResetPassword(user.id, user.email)} className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-gold hover:text-maroon transition-all font-black uppercase text-[10px] tracking-widest shadow-sm">
                                    <Key className="w-4 h-4" /> Reset Credentials
                                </button>
                                <button onClick={() => handleDelete(user.id, user.email)} className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all font-black uppercase text-[10px] tracking-widest shadow-sm">
                                    <Trash2 className="w-4 h-4" /> Permanent Removal
                                </button>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen space-y-6 pb-20">
            {/* Header Area */}
            <div className="bg-maroon p-6 rounded-[2rem] text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 -rotate-45 translate-x-32 -translate-y-32"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Shield className="w-4 h-4 text-gold" />
                            <span className="text-[8px] font-black uppercase tracking-[0.4em] text-white/40">Administrative Command</span>
                        </div>
                        <h1 className="text-2xl font-black uppercase tracking-tight leading-none mb-1">Central Registry</h1>
                        <p className="text-[11px] text-white/60 font-medium tracking-wide">Governance and Identity Management System</p>
                    </div>
                    <div className="flex gap-3">
                        {currentUser?.role === 'superadmin' && (
                            <button
                                onClick={() => { setShowCreateModal(true); setCreateError(''); setCreateForm({ email: '', password: '', role: 'student' }); }}
                                className="flex items-center gap-2 px-4 py-3 bg-gold text-maroon font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-gold/90 transition-all shadow-lg border border-gold/20 group"
                            >
                                <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                New User
                            </button>
                        )}
                        <button onClick={handlePrint} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all shadow-lg backdrop-blur-md border border-white/5 group">
                            <Printer className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        </button>
                        <button onClick={handleDownload} className="p-4 bg-white/10 hover:bg-white/20 rounded-xl transition-all shadow-lg backdrop-blur-md border border-white/5 group">
                            <Download className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Dashboard Search & Filter */}
            <div className="flex flex-col xl:flex-row gap-6 items-stretch xl:items-center justify-between">
                <div className="flex-1 bg-white dark:bg-zinc-900 rounded-2xl p-1.5 border border-gray-100 dark:border-white/5 shadow-lg flex flex-wrap gap-1">
                    {tabs.map(tab => (
                        <button
                            key={tab}
                            onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
                            className={`px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === tab
                                ? 'bg-maroon text-white shadow-md'
                                : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
                <div className="w-full xl:w-80 relative">
                    <input
                        type="text"
                        placeholder="SEARCH REGISTRY..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        className="w-full bg-white dark:bg-zinc-900 border border-gray-100 dark:border-white/5 rounded-2xl px-6 py-4 text-[9px] font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-maroon/5 focus:border-maroon transition-all shadow-lg"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-maroon/5 rounded-lg">
                        <User className="w-3.5 h-3.5 text-maroon" />
                    </div>
                </div>
            </div>

            {/* Structured Table Layout */}
            <div className="bg-white dark:bg-zinc-900 rounded-[1.5rem] shadow-xl border border-gray-100 dark:border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-white/5 border-b border-gray-100 dark:border-white/5">
                                <th className="px-6 py-4 text-[10px] font-black text-maroon dark:text-gold uppercase tracking-[0.2em]">Institutional Identity</th>
                                <th className="px-6 py-4 text-[10px] font-black text-maroon dark:text-gold uppercase tracking-[0.2em]">Security Class</th>
                                <th className="px-6 py-4 text-[10px] font-black text-maroon dark:text-gold uppercase tracking-[0.2em]">Registry Date</th>
                                <th className="px-6 py-4 text-[10px] font-black text-maroon dark:text-gold uppercase tracking-[0.2em]">Status</th>
                                <th className="px-6 py-4 text-[10px] font-black text-maroon dark:text-gold uppercase tracking-[0.2em] text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-10 py-20 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-12 h-12 border-4 border-maroon border-t-transparent rounded-full animate-spin"></div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-maroon/40 animate-pulse">Syncing Registry Database...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-10 py-20 text-center">
                                        <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">NO RECORDS FOUND IN "{activeTab.toUpperCase()}"</p>
                                    </td>
                                </tr>
                            ) : filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((u) => (
                                <tr key={u.id} className="group hover:bg-maroon/[0.02] transition-all">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-inner overflow-hidden ${u.role === 'superadmin' ? 'bg-gold text-maroon' : 'bg-gray-100 dark:bg-white/5 text-gray-400'
                                                }`}>
                                                {u.photo ? (
                                                    <img src={u.photo} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    (u.email?.[0] || 'U').toUpperCase()
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-sm font-black tracking-tight text-gray-900 dark:text-white uppercase">{u.name || (u.email?.split('@')[0] || 'Unknown User')}</p>
                                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{u.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-[0.2em] border ${u.role === 'superadmin' ? 'bg-gold/10 border-gold/20 text-gold' : 'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500'
                                            }`}>
                                            {u.role === 'teacher' ? 'FACULTY' : u.role}
                                        </span>
                                        {/* Finance Editor badge */}
                                        {u.can_edit_finance && u.role === 'admin' && (
                                            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest bg-gold/10 text-gold border border-gold/20">
                                                <DollarSign className="w-2 h-2" /> Finance
                                            </span>
                                        )}
                                        {/* Student Editor badge */}
                                        {u.can_edit_students && u.role === 'admin' && (
                                            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest bg-maroon/10 text-maroon border border-maroon/20">
                                                <Shield className="w-2 h-2" /> Registry
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-gray-400 font-bold tracking-tight">
                                            <Clock className="w-3.5 h-3.5" />
                                            <span className="text-[10px] uppercase">{new Date(u.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            {/* Account status (admin-set) */}
                                            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest border w-fit ${u.status === 'Active'
                                                ? 'bg-green-500/10 border-green-500/20 text-green-600'
                                                : u.status === 'Suspended' || u.status === 'Inactive'
                                                    ? 'bg-red-500/10 border-red-500/20 text-red-600'
                                                    : 'bg-gold/10 border-gold/20 text-gold'
                                                }`}>
                                                <div className={`w-1 h-1 rounded-full ${u.status === 'Active' ? 'bg-green-500' : u.status === 'Suspended' ? 'bg-red-500' : 'bg-gold'
                                                    }`}></div>
                                                {u.status}
                                            </div>
                                            {/* Real-time presence (only meaningful if account is Active) */}
                                            {u.status === 'Active' && <PresenceBadge onlineStatus={u.online_status} />}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center gap-2">
                                            <button
                                                onClick={() => { setSelectedUser(u); setShowDetailModal(true); }}
                                                className="p-2.5 bg-blue-500/10 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all shadow-sm group border border-blue-500/10"
                                                title="View Registry"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleResetPassword(u.id, u.email)}
                                                className="p-2.5 bg-gold/10 text-gold hover:bg-gold hover:text-white rounded-lg transition-all shadow-sm group border border-gold/5"
                                                title="Reset Credentials"
                                            >
                                                <Key className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleStatusUpdate(u.id, u.status === 'Active' ? 'Suspended' : 'Active')}
                                                className={`p-2.5 rounded-lg transition-all shadow-sm group border ${u.status === 'Active'
                                                    ? 'bg-red-500/10 text-red-600 hover:bg-red-600 hover:text-white border-red-500/5'
                                                    : 'bg-green-500/10 text-green-600 hover:bg-green-600 hover:text-white border-green-500/5'
                                                    }`}
                                                title={u.status === 'Active' ? 'Lock Account' : 'Activate Account'}
                                            >
                                                {u.status === 'Active' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(u.id, u.email)}
                                                className="p-2.5 bg-red-500/5 text-red-400 hover:bg-red-600 hover:text-white rounded-lg transition-all shadow-sm group border border-red-500/5"
                                                title="Dismiss Record"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="bg-gray-50 dark:bg-white/5 px-6 py-4 border-t border-gray-100 dark:border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">
                        Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredUsers.length)} of {filteredUsers.length} records
                    </div>

                    {filteredUsers.length > itemsPerPage && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-lg border border-maroon/10 hover:bg-maroon hover:text-white transition-all disabled:opacity-30"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            {[...Array(Math.ceil(filteredUsers.length / itemsPerPage))].map((_, i) => (
                                <button
                                    key={i + 1}
                                    onClick={() => setCurrentPage(i + 1)}
                                    className={`w-7 h-7 rounded-lg text-[9px] font-black uppercase transition-all ${
                                        currentPage === i + 1 
                                            ? 'bg-maroon text-white shadow-md' 
                                            : 'border border-maroon/10 text-maroon hover:bg-maroon/5'
                                    }`}
                                >
                                    {i + 1}
                                </button>
                            )).slice(Math.max(0, currentPage - 3), Math.min(Math.ceil(filteredUsers.length / itemsPerPage), currentPage + 2))}
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredUsers.length / itemsPerPage), prev + 1))}
                                disabled={currentPage === Math.ceil(filteredUsers.length / itemsPerPage)}
                                className="p-2 rounded-lg border border-maroon/10 hover:bg-maroon hover:text-white transition-all disabled:opacity-30"
                            >
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}

                    <div className="flex gap-4 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">
                        <span>Authorized: {users.filter(u => u.status === 'Active').length}</span>
                        <span className="text-green-500 flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-green-500 animate-ping inline-block"></span>
                            Online: {users.filter(u => u.online_status === 'Online').length}
                        </span>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showDetailModal && <UserDetailModal user={selectedUser} onClose={() => setShowDetailModal(false)} />}

            {/* Create User Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-white/10" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="bg-maroon p-6 text-white flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">
                                    <UserPlus className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-base font-black uppercase tracking-tight">Create New Account</h2>
                                    <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Institutional Registry</p>
                                </div>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleCreateUser} className="p-6 space-y-5">
                            {/* Error Banner */}
                            {createError && (
                                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700">
                                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                    <p className="text-xs font-bold">{createError}</p>
                                </div>
                            )}

                            {/* Email */}
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Email Address <span className="text-red-500">*</span></label>
                                <input
                                    type="email"
                                    value={createForm.email}
                                    onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-maroon/20 focus:border-maroon/40 transition-all"
                                    placeholder="name@institution.edu"
                                    required
                                    autoComplete="off"
                                />
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Password <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <input
                                        type={showCreatePassword ? 'text' : 'password'}
                                        value={createForm.password}
                                        onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                                        className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-maroon/20 focus:border-maroon/40 transition-all pr-11"
                                        placeholder="Min 8 chars, number & symbol"
                                        required
                                        autoComplete="new-password"
                                    />
                                    <button type="button" onClick={() => setShowCreatePassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-maroon transition-colors">
                                        {showCreatePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {/* Live password strength hints */}
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {[
                                        { label: '8+ chars', pass: createForm.password.length >= 8 },
                                        { label: 'Number', pass: /\d/.test(createForm.password) },
                                        { label: 'Special char', pass: /[!@#$%^&*(),.?":{}|<>]/.test(createForm.password) },
                                    ].map(({ label, pass }) => (
                                        <span key={label} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide border transition-all ${
                                            createForm.password
                                                ? pass
                                                    ? 'bg-green-50 text-green-600 border-green-200'
                                                    : 'bg-red-50 text-red-500 border-red-200'
                                                : 'bg-gray-50 text-gray-400 border-gray-200'
                                        }`}>
                                            {pass ? '✓' : '✗'} {label}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Role */}
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">System Role <span className="text-red-500">*</span></label>
                                <select
                                    value={createForm.role}
                                    onChange={e => setCreateForm({ ...createForm, role: e.target.value })}
                                    className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-maroon/20 focus:border-maroon/40 transition-all"
                                >
                                    <option value="student">Student</option>
                                    <option value="teacher">Faculty / Trainer</option>
                                    <option value="admin">Administrator</option>
                                    <option value="superadmin">Superadmin</option>
                                </select>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowCreateModal(false)}
                                    className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-500 font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all">
                                    Cancel
                                </button>
                                <button type="submit" disabled={createLoading}
                                    className="flex-1 py-3 rounded-2xl bg-maroon text-gold font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-maroon/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                    {createLoading ? 'Creating...' : 'Create Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <footer className="text-center pb-10">
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.8em]">Institutional Registry Services &copy; 2026</p>
            </footer>
        </div>
    );
}
