import React from 'react';
import { Download, HardDrive, RefreshCw } from 'lucide-react';
import { FieldRow, GOLD, Inp, Sel } from './atoms';

export default function TabBackup(ctx) {
    const { settings, set, restoring, handleBackup, handleRestore } = ctx;
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100/50 dark:border-rose-950/30 rounded-3xl space-y-4 text-left flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="space-y-2">
                        <HardDrive className="w-8 h-8 text-maroon dark:text-gold" />
                        <h4 className="text-xs font-black uppercase text-maroon dark:text-gold tracking-wider leading-none">Download Full Database Backup</h4>
                        <p className="text-[9.5px] text-zinc-400 font-semibold leading-relaxed">Download a complete snapshot of every database table — JSON on Postgres deployments, raw SQLite file otherwise.</p>
                    </div>
                    <button onClick={handleBackup} className="w-full flex items-center justify-center gap-2 text-white py-3 rounded-xl font-black text-[9px] uppercase tracking-widest hover:opacity-90 transition-all shadow-md mt-4"
                        style={{ backgroundColor: settings.sidebar_colors || '#7a0000', border: `1px solid ${GOLD}40` }}>
                        <Download className="w-3.5 h-3.5 text-yellow-300 animate-bounce" /> Download Database Backup
                    </button>
                </div>
                <div className="p-6 bg-zinc-50/50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/10 rounded-3xl space-y-4 text-left flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="space-y-2">
                        <RefreshCw className={`w-8 h-8 text-zinc-500 ${restoring?'animate-spin':''}`} />
                        <h4 className="text-xs font-black uppercase text-zinc-700 dark:text-zinc-200 tracking-wider leading-none">Restore Last Safe State Snapshot</h4>
                        <p className="text-[9.5px] text-zinc-400 font-semibold leading-relaxed">Overwrite current active table records and restore the database state to the last verified safe snapshot point.</p>
                    </div>
                    <button onClick={handleRestore} disabled={restoring} className="w-full flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-800 text-white py-3 rounded-xl font-black text-[9px] uppercase tracking-widest disabled:opacity-50 transition-all shadow-md mt-4">
                        <RefreshCw className="w-3.5 h-3.5" /> {restoring?'Restoring snapshot state...':'Trigger Restoration Sequence'}
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm text-left">
                <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Auto Backup Scheduler</h4>
                    <p className="text-[9px] text-zinc-400 font-semibold mt-1">Configure cron task triggers for background database backups.</p>
                </div>
                <FieldRow label="Auto-Backup Schedule Frequency">
                    <Sel value={settings.backup_interval} onChange={e=>set('backup_interval',e.target.value)}>
                        <option value="daily">Daily Cron Backup (1:00 AM)</option>
                        <option value="weekly">Weekly Cron Backup (Sunday 2:00 AM)</option>
                        <option value="monthly">Monthly Cron Backup (1st of month)</option>
                        <option value="manual">Manual Backup Triggers Only</option>
                    </Sel>
                </FieldRow>
                <FieldRow label="Included Target Snapshots" description="Comma-separated catalogs to pack into backups."><Inp value={settings.backup_types} onChange={e=>set('backup_types',e.target.value)} mono /></FieldRow>
            </div>
        </div>
    );
}
