import { useState, useEffect } from 'react';
import { usersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Shield, User, Mail, Trash2, Edit, CheckCircle, XCircle, MoreVertical, Key } from 'lucide-react';

export default function Users() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('All');

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
        try {
            await usersAPI.updateRole(userId, newRole);
            fetchUsers();
            alert('Security access updated.');
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to update role');
        }
    };

    const handleStatusToggle = async (userId, currentStatus) => {
        const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
        try {
            await usersAPI.updateStatus(userId, newStatus);
            fetchUsers();
        } catch (error) {
            alert('Failed to update status');
        }
    };

    const handleResetPassword = async (userId, userEmail) => {
        const newPassword = prompt(`Enter new password for ${userEmail}:`, 'password123');
        if (!newPassword) return;

        if (newPassword.length < 6) {
            alert('Password must be at least 6 characters long.');
            return;
        }

        try {
            await usersAPI.resetPassword(userId, newPassword);
            alert(`Password for ${userEmail} has been reset successfully.`);
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to reset password');
        }
    };

    const handleDelete = async (userId) => {
        if (userId === currentUser.id) {
            alert('Security Protocol: You cannot terminate your own administrative access.');
            return;
        }
        if (!window.confirm('Are you sure you want to permanently revoke this users access?')) return;

        try {
            await usersAPI.delete(userId);
            fetchUsers();
        } catch (error) {
            alert('Failed to delete user');
        }
    };

    const filteredUsers = filter === 'All' ? users : users.filter(u => u.role === filter.toLowerCase());

    if (loading) return <div className="text-white font-black p-10 tracking-widest animate-pulse">AUTHORIZING ACCESS...</div>;

    return (
        <div className="space-y-8 text-white">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tight text-maroon">User Control Center</h1>
                    <p className="text-sm text-gray-400 font-medium mt-1">Manage system-wide permissions and account statuses</p>
                </div>
                <div className="bg-maroon/10 p-1 rounded-xl border border-maroon/20 flex gap-2">
                    {['All', 'Superadmin', 'Admin', 'Teacher', 'Student'].map(r => (
                        <button
                            key={r}
                            onClick={() => setFilter(r)}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filter === r
                                ? 'bg-gold text-maroon shadow-lg'
                                : 'text-maroon/40 hover:text-maroon hover:bg-maroon/5'
                                }`}
                        >
                            {r}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Total Accounts', value: users.length, icon: User, color: 'text-maroon' },
                    { label: 'Privileged', value: users.filter(u => ['superadmin', 'admin'].includes(u.role)).length, icon: Shield, color: 'text-gold' },
                    { label: 'Active', value: users.filter(u => u.status === 'Active').length, icon: CheckCircle, color: 'text-green-500' },
                    { label: 'Restricted', value: users.filter(u => u.status === 'Inactive').length, icon: XCircle, color: 'text-red-500' },
                ].map((stat, i) => (
                    <div key={i} className="card-elite border border-white/5 p-6 space-y-2">
                        <div className="flex justify-between items-start">
                            <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">{stat.label}</p>
                            <stat.icon className={`w-4 h-4 ${stat.color} opacity-60`} />
                        </div>
                        <p className="text-3xl font-black">{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="card-elite border border-gold/10 overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-white/5 border-b border-white/5">
                            {['Operator Identity', 'Security Class', 'Last Verification', 'Status', 'Actions'].map(h => (
                                <th key={h} className="px-8 py-6 text-[11px] font-black text-gold/40 uppercase tracking-widest">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filteredUsers.map((u) => (
                            <tr key={u.id} className="group hover:bg-white/5 transition-all">
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shadow-inner ${u.role === 'superadmin' ? 'bg-gold text-maroon' : 'bg-white/10 text-white/40'
                                            }`}>
                                            {(u.email?.[0] || 'U').toUpperCase()}
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="text-sm font-black tracking-tight">{u.email || 'No Email'}</p>
                                            <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">ID: #{u.id}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-6">
                                    <select
                                        value={u.role}
                                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                        className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-gold outline-none focus:ring-2 focus:ring-gold/20 appearance-none cursor-pointer hover:border-gold/40 transition-all"
                                    >
                                        <option value="superadmin">Superadmin</option>
                                        <option value="admin">Administrator</option>
                                        <option value="teacher">Faculty Member</option>
                                        <option value="student">Student Account</option>
                                    </select>
                                </td>
                                <td className="px-8 py-6">
                                    <p className="text-[11px] font-bold text-white/40 uppercase tracking-tight">
                                        {new Date(u.created_at).toLocaleDateString()}
                                    </p>
                                </td>
                                <td className="px-8 py-6">
                                    <button
                                        onClick={() => handleStatusToggle(u.id, u.status)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${u.status === 'Active'
                                            ? 'bg-green-500/10 border-green-500/20 text-green-500'
                                            : 'bg-red-500/10 border-red-500/20 text-red-500'
                                            }`}
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full ${u.status === 'Active' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                                        {u.status}
                                    </button>
                                </td>
                                <td className="px-8 py-6">
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => handleResetPassword(u.id, u.email)}
                                            className="p-3 bg-gold/10 hover:bg-gold text-gold hover:text-maroon border border-gold/20 rounded-xl transition-all shadow-lg"
                                            title="Reset Password"
                                        >
                                            <Key className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(u.id)}
                                            className="p-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-xl transition-all shadow-lg"
                                            title="Revoke Access"
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

            <p className="text-[10px] text-center font-black text-white/10 uppercase tracking-[0.5em] pt-8">
                Beautex Internal Security Controls v1.0
            </p>
        </div>
    );
}
