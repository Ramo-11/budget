window.escapeHtml = function (value) {
    if (value == null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};
window.escapeAttr = window.escapeHtml;

function csvCell(value) {
    let text = String(value == null ? '' : value);
    if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = "'" + text;
    if (/[",\n\r]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
    return text;
}

function exportTransactionsCSV(monthKey) {
    if (typeof Store === 'undefined') return { ok: false, error: 'Your transactions are not ready yet. Try again in a moment.' };
    const list = monthKey && monthKey !== 'all' ? Store.transactions({ monthKey: monthKey, includeTransfers: true }) : Store.transactions({ includeTransfers: true });
    if (!list.length) return { ok: false, error: 'There are no transactions to export yet.' };

    const rows = [['Date', 'Merchant', 'Description', 'Amount', 'Category', 'Type', 'Note']];
    list
        .slice()
        .sort((a, b) => a.date - b.date)
        .forEach((t) => {
            let type = t.isIncome ? 'Income' : t.isRefund ? 'Refund' : 'Expense';
            if (t.isTransfer) type = 'Transfer';
            rows.push([t.dateKey, t.merchant, t.description, t.amount.toFixed(2), t.category, type, t.note]);
        });

    const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
    const today = Store.isoDate(new Date());
    const label = monthKey && monthKey !== 'all' ? monthKey : 'all';
    downloadFile('﻿' + csv, `sahab-budget-${label}-${today}.csv`, 'text/csv;charset=utf-8');
    return { ok: true, count: list.length };
}

window.csvCell = csvCell;
window.exportTransactionsCSV = exportTransactionsCSV;
