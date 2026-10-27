import React from 'react';
import { FieldRow, Inp, StatusBadge, TagInputList, Toggle } from './atoms';

export default function TabFinance(ctx) {
    const { settings, set } = ctx;
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm">
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Finance Ledger Configuration</h4>
                        <p className="text-[9px] text-zinc-400 font-semibold mt-1">Set invoice billing items and payment methods.</p>
                    </div>
                    <FieldRow label="Fee Invoice Items" description="The official catalog of items billed on student invoices.">
                        <TagInputList value={settings.fee_categories} onChange={val=>set('fee_categories',val)} placeholder="e.g. Tuition Fee" />
                    </FieldRow>
                    <FieldRow label="Acceptable Payment Options" description="Channels approved for student fee payments.">
                        <TagInputList value={settings.payment_methods} onChange={val=>set('payment_methods',val)} placeholder="e.g. M-Pesa" />
                    </FieldRow>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm">
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Scholarships & Installment Policies</h4>
                        <p className="text-[9px] text-zinc-400 font-semibold mt-1">Configure interest penalties, early payment discounts and scholarship categories.</p>
                    </div>
                    <FieldRow label="Penalty Rate (%)" description="Late penalty fees interest rate."><Inp type="number" value={settings.finance_penalty_rate} onChange={e=>set('finance_penalty_rate',e.target.value)} /></FieldRow>
                    <FieldRow label="Discount Rate (%)" description="Early payments discount rate."><Inp type="number" value={settings.finance_discount_rate} onChange={e=>set('finance_discount_rate',e.target.value)} /></FieldRow>
                    <FieldRow label="Scholarship Brackets" description="Categories of student scholarships.">
                        <TagInputList value={settings.finance_scholarship_types} onChange={val=>set('finance_scholarship_types',val)} placeholder="e.g. Merit-based" />
                    </FieldRow>
                    <FieldRow label="Installment Options" description="Allow students to make partial fee payments across the term.">
                        <div className="flex items-center gap-3"><Toggle value={settings.finance_installments_allowed} onChange={v=>set('finance_installments_allowed',v)} /><StatusBadge active={settings.finance_installments_allowed} labelOn="Allowed" labelOff="Disabled" /></div>
                    </FieldRow>
                </div>
            </div>
        </div>
    );
}
