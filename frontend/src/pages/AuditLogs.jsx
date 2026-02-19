import { useEffect, useState } from 'react';
import api from '../services/api';
import { History, User, Terminal, Calendar, ShieldCheck } from 'lucide-react';

export default function AuditLogs() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        try {
            const res = await api.get('/audit-logs');
            setLogs(res.data);
        } catch (error) {
            console.error('Error fetching audit logs:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-12 h-12 border-4 border-maroon/10 border-t-maroon rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">System Audit Trail</h1>
                    <p className="text-sm text-gray-400 font-medium">Security & Operational History Tracking</p>
                </div>
                <div className="bg-green-50 text-green-600 px-4 py-2 rounded-xl flex items-center gap-2 border border-green-100">
                    <ShieldCheck className="w-5 h-5" />
                    <span className="text-[10px] font-black uppercase tracking-widest">System Monitored</span>
                </div>
            </div>

            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50">
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">Timestamp</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">User</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">Action</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">Resource</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {logs.map((log) => (
                                <tr key={log.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-3 h-3 text-gray-300" />
                                            <span className="text-[11px] font-bold text-gray-500">
                                                {new Date(log.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-maroon/10 rounded-full flex items-center justify-center">
                                                <User className="w-3 h-3 text-maroon" />
                                            </div>
                                            <span className="text-xs font-black text-gray-800">{log.user_email || 'System'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${log.action.includes('CREATE') ? 'bg-green-100 text-green-600' :
                                                log.action.includes('DELETE') ? 'bg-red-100 text-red-600' :
                                                    log.action.includes('UPDATE') ? 'bg-blue-100 text-blue-600' :
                                                        'bg-gray-100 text-gray-600'
                                            }`}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1">
                                            <Terminal className="w-3 h-3 text-gray-400" />
                                            <span className="text-xs text-gray-600 font-bold uppercase tracking-tight">{log.resource} {log.resource_id ? `#${log.resource_id}` : ''}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">
                                        <span className="text-[10px] font-medium text-gray-400 font-mono">{log.details || '-'}</span>
                                    </td>
                                </tr>
                            ))}
                            {logs.length === 0 && !loading && (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <History className="w-12 h-12 text-gray-100" />
                                            <p className="text-sm font-black text-gray-300 uppercase tracking-widest">No activity recorded yet</p>
                                        </div>
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
