import React from 'react';
import { FieldRow, Inp, Sel, StatusBadge, Toggle } from './atoms';

export default function TabInventorySettings(ctx) {
    const { settings, set } = ctx;
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm">
                <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Inventory System Configuration</h4>
                    <p className="text-[9px] text-zinc-400 font-semibold mt-1">Configure stock alert rules and defaults for the college inventory.</p>
                </div>
                
                <FieldRow label="Low Stock Warning Limit" description="The stock level below which the system dispatches replenishment warnings.">
                    <input type="range" min="1" max="100" value={settings.inventory_low_stock_threshold || 10} onChange={e=>set('inventory_low_stock_threshold',e.target.value)} className="w-full h-1 bg-gray-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-maroon" />
                    <div className="flex justify-between items-center text-[10px] font-black text-zinc-500 uppercase mt-2">
                        <span>Min: 1 Unit</span>
                        <span className="text-maroon dark:text-gold">Threshold: {settings.inventory_low_stock_threshold || 10} Units</span>
                        <span>Max: 100 Units</span>
                    </div>
                </FieldRow>

                <FieldRow label="Auto stock Warning Alerts" description="Automatically flag items in the inventory register when they fall below the minimum threshold.">
                    <div className="flex items-center gap-3"><Toggle value={settings.inventory_auto_alert_enabled} onChange={v=>set('inventory_auto_alert_enabled',v)} /><StatusBadge active={settings.inventory_auto_alert_enabled} labelOn="Active" labelOff="Disabled" /></div>
                </FieldRow>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm">
                <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Store & Asset Policies</h4>
                    <p className="text-[9px] text-zinc-400 font-semibold mt-1">Configure accounting methods and target locations.</p>
                </div>
                <FieldRow label="Default Inventory Store" description="Default warehouse store for newly registered assets."><Inp value={settings.inventory_default_store} onChange={e=>set('inventory_default_store',e.target.value)} /></FieldRow>
                <FieldRow label="Asset Depreciation Method" description="Accounting formula used to calculate annual depreciation for registered physical assets.">
                    <Sel value={settings.inventory_depreciation_method} onChange={e=>set('inventory_depreciation_method',e.target.value)}>
                        <option value="straight_line">Straight Line Method</option>
                        <option value="double_declining">Double Declining Balance Method</option>
                        <option value="units_of_production">Units of Production Method</option>
                    </Sel>
                </FieldRow>
            </div>
        </div>
    );
}
