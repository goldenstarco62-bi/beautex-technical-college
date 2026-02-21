import { useState, useEffect } from 'react';
import { usersAPI, studentsAPI, facultyAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
    Shield, User, Mail, Trash2, CheckCircle, XCircle,
    MoreVertical, Key, Lock, Unlock, FileText,
    Printer, Download, Eye, Clock, UserPlus
} from 'lucide-react';

export default function Users() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('All Users');
    const [selectedUser, setSelectedUser] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

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
    }, []);

    const handleRoleChange = async (userId, newRole) => {
        if (!window.confirm(`Formal Authorization: Confirm role transition to ${newRole}?`)) return;
        try {
            await usersAPI.updateRole(userId, newRole);
            fetchUsers();
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to update role');
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
        } catch (error) {
            alert('Status update failed');
        }
    };

    const handleResetPassword = async (userId, userEmail) => {
        if (!window.confirm(`Security Reset: Generate temporary credentials for ${userEmail}?`)) return;
        try {
            await usersAPI.resetPassword(userId);
            alert(`Temporary credentials dispatched to ${userEmail}.`);
        } catch (error) {
            alert(error.response?.data?.error || 'Password reset failed');
        }
    };

    const handleDelete = async (userId, userEmail) => {
        if (userId === currentUser.id) {
            alert('Access Denied: Cannot revoke active administrative session.');
            return;
        }
        if (!window.confirm(`PERMANENT DISMISSAL: Are you sure you want to remove ${userEmail}? This action is IRREVERSIBLE.`)) return;
        try {
            await usersAPI.delete(userId);
            fetchUsers();
            if (showDetailModal) setShowDetailModal(false);
        } catch (error) {
            alert('Dismissal failed');
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
                                <div><p className="text-[10px] text-gray-400 uppercase font-black">Current Status</p><p className={`text-sm font-bold uppercase ${user.status === 'Active' ? 'text-green-500' : 'text-red-500'}`}>{user.status}</p></div>
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
        <div className="min-h-screen space-y-8 pb-20">
            {/* Header Area */}
            <div className="bg-maroon p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 -rotate-45 translate-x-32 -translate-y-32"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Shield className="w-6 h-6 text-gold" />
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">Administrative Command</span>
                        </div>
                        <h1 className="text-4xl font-black uppercase tracking-tight leading-none mb-1">Central Registry</h1>
                        <p className="text-white/60 font-medium tracking-wide">Governance and Identity Management System</p>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={handlePrint} className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all shadow-xl backdrop-blur-md border border-white/5 group">
                            <Printer className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        </button>
                        <button onClick={handleDownload} className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all shadow-xl backdrop-blur-md border border-white/5 group">
                            <Download className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Dashboard Search & Filter */}
            <div className="flex flex-col xl:flex-row gap-6 items-stretch xl:items-center justify-between">
                <div className="flex-1 bg-white dark:bg-zinc-900 rounded-3xl p-2 border border-gray-100 dark:border-white/5 shadow-xl flex flex-wrap gap-1">
                    {tabs.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab
                                ? 'bg-maroon text-white shadow-lg'
                                : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
                <div className="w-full xl:w-96 relative">
                    <input
                        type="text"
                        placeholder="SEARCH REGISTRY (NAME, EMAIL, ID)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-900 border border-gray-100 dark:border-white/5 rounded-3xl px-8 py-5 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-maroon/5 focus:border-maroon transition-all shadow-xl"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-maroon/5 rounded-xl">
                        <User className="w-4 h-4 text-maroon" />
                    </div>
                </div>
            </div>

            {/* Structured Table Layout */}
            <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-white/5 border-b border-gray-100 dark:border-white/5">
                                <th className="px-10 py-8 text-[11px] font-black text-maroon dark:text-gold uppercase tracking-[0.2em]">Institutional Identity</th>
                                <th className="px-10 py-8 text-[11px] font-black text-maroon dark:text-gold uppercase tracking-[0.2em]">Security Class</th>
                                <th className="px-10 py-8 text-[11px] font-black text-maroon dark:text-gold uppercase tracking-[0.2em]">Registry Date</th>
                                <th className="px-10 py-8 text-[11px] font-black text-maroon dark:text-gold uppercase tracking-[0.2em]">Status</th>
                                <th className="px-10 py-8 text-[11px] font-black text-maroon dark:text-gold uppercase tracking-[0.2em] text-center">Actions</th>
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
                            ) : filteredUsers.map((u) => (
                                <tr key={u.id} className="group hover:bg-maroon/[0.02] transition-all">
                                    <td className="px-10 py-8">
                                        <div className="flex items-center gap-6">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg shadow-inner ${u.role === 'superadmin' ? 'bg-gold text-maroon' : 'bg-gray-100 dark:bg-white/5 text-gray-400'
                                                }`}>
                                                {(u.email?.[0] || 'U').toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-base font-black tracking-tight text-gray-900 dark:text-white uppercase">{u.name || (u.email?.split('@')[0] || 'Unknown User')}</p>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{u.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-10 py-8">
                                        <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] border ${u.role === 'superadmin' ? 'bg-gold/10 border-gold/20 text-gold' : 'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500'
                                            }`}>
                                            {u.role === 'teacher' ? 'FACULTY' : u.role}
                                        </span>
                                    </td>
                                    <td className="px-10 py-8">
                                        <div className="flex items-center gap-2 text-gray-400 font-bold tracking-tight">
                                            <Clock className="w-4 h-4" />
                                            <span className="text-xs uppercase">{new Date(u.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                        </div>
                                    </td>
                                    <td className="px-10 py-8">
                                        <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm ${u.status === 'Active'
                                            ? 'bg-green-500/10 border-green-500/20 text-green-600'
                                            : u.status === 'Suspended' || u.status === 'Inactive'
                                                ? 'bg-red-500/10 border-red-500/20 text-red-600'
                                                : 'bg-gold/10 border-gold/20 text-gold'
                                            }`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${u.status === 'Active' ? 'bg-green-500 animate-pulse' : u.status === 'Suspended' ? 'bg-red-500' : 'bg-gold'
                                                }`}></div>
                                            {u.status}
                                        </div>
                                    </td>
                                    <td className="px-10 py-8">
                                        <div className="flex justify-center gap-3">
                                            <button
                                                onClick={() => { setSelectedUser(u); setShowDetailModal(true); }}
                                                className="p-3 bg-blue-500/10 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all shadow-md group border border-blue-500/10"
                                                title="View Registry"
                                            >
                                                <Eye className="w-4 h-4 group-active:scale-95" />
                                            </button>
                                            <button
                                                onClick={() => handleResetPassword(u.id, u.email)}
                                                className="p-3 bg-gold/10 text-gold hover:bg-gold hover:text-white rounded-xl transition-all shadow-md group border border-gold/5"
                                                title="Reset Credentials"
                                            >
                                                <Key className="w-4 h-4 group-active:scale-95" />
                                            </button>
                                            <button
                                                onClick={() => handleStatusUpdate(u.id, u.status === 'Active' ? 'Suspended' : 'Active')}
                                                className={`p-3 rounded-xl transition-all shadow-md group border ${u.status === 'Active'
                                                    ? 'bg-red-500/10 text-red-600 hover:bg-red-600 hover:text-white border-red-500/5'
                                                    : 'bg-green-500/10 text-green-600 hover:bg-green-600 hover:text-white border-green-500/5'
                                                    }`}
                                                title={u.status === 'Active' ? 'Lock Account' : 'Activate Account'}
                                            >
                                                {u.status === 'Active' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(u.id, u.email)}
                                                className="p-3 bg-red-500/5 text-red-400 hover:bg-red-600 hover:text-white rounded-xl transition-all shadow-sm group border border-red-500/5"
                                                title="Dismiss Record"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="bg-gray-50 dark:bg-white/5 px-10 py-6 border-t border-gray-100 dark:border-white/5 flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                    <span>Registry Version 4.0.1</span>
                    <div className="flex gap-8">
                        <span>Total Records: {users.length}</span>
                        <span>Authorized: {users.filter(u => u.status === 'Active').length}</span>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showDetailModal && <UserDetailModal user={selectedUser} onClose={() => setShowDetailModal(false)} />}

            <footer className="text-center pb-10">
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.8em]">Institutional Registry Services &copy; 2026</p>
            </footer>
        </div>
    );
}
