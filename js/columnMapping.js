(function () {
    const STORAGE_KEY = 'sahabBudget_bankMappings';

    window.savedBankMappings = window.savedBankMappings || {};

    function loadBankMappings() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            window.savedBankMappings = saved ? JSON.parse(saved) || {} : {};
        } catch (error) {
            window.savedBankMappings = {};
        }
        return window.savedBankMappings;
    }

    function saveBankMappings() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(window.savedBankMappings));
            return true;
        } catch (error) {
            return false;
        }
    }

    function norm(h) {
        return String(h == null ? '' : h).replace(/^﻿/, '').toLowerCase().replace(/[^a-z0-9_]+/g, ' ').trim();
    }

    function hasAll(headers, names) {
        const set = headers.map(norm);
        return names.every((n) => set.includes(n));
    }

    function hasAny(headers, names) {
        const set = headers.map(norm);
        return names.some((n) => set.includes(n));
    }

    const knownBankFormats = {
        chaseChecking: {
            name: 'Chase checking',
            detect: (h) => hasAll(h, ['details', 'posting date', 'description', 'amount']),
            mapping: { date: ['Posting Date'], description: ['Description'], amount: ['Amount'] },
            negativeIsExpense: true
        },
        chase: {
            name: 'Chase',
            detect: (h) => hasAny(h, ['transaction date', 'post date']) && hasAny(h, ['description', 'original description']) && hasAll(h, ['amount']) && !hasAny(h, ['card no', 'posted date']),
            mapping: { date: ['Transaction Date', 'Post Date', 'Posting Date'], description: ['Description', 'Original Description'], amount: ['Amount'] },
            negativeIsExpense: true
        },
        capitalOne: {
            name: 'Capital One',
            detect: (h) => hasAll(h, ['transaction date', 'description', 'debit', 'credit']),
            mapping: { date: ['Transaction Date'], description: ['Description'], debit: ['Debit'], credit: ['Credit'] },
            negativeIsExpense: true
        },
        citi: {
            name: 'Citi',
            detect: (h) => hasAll(h, ['status', 'date', 'description', 'debit', 'credit']),
            mapping: { date: ['Date'], description: ['Description'], debit: ['Debit'], credit: ['Credit'] },
            negativeIsExpense: true
        },
        discover: {
            name: 'Discover',
            detect: (h) => hasAll(h, ['trans date', 'post date', 'description', 'amount']),
            mapping: { date: ['Trans. Date'], description: ['Description'], amount: ['Amount'] },
            negativeIsExpense: false
        },
        bankOfAmerica: {
            name: 'Bank of America',
            detect: (h) => hasAll(h, ['date', 'description', 'amount']) && hasAny(h, ['running bal', 'running balance']),
            mapping: { date: ['Date'], description: ['Description'], amount: ['Amount'] },
            negativeIsExpense: true
        },
        americanExpress: {
            name: 'American Express',
            detect: (h) => hasAll(h, ['date', 'description', 'amount']) && hasAny(h, ['card member', 'account', 'account number', 'extended details', 'appears on your statement as']),
            mapping: { date: ['Date'], description: ['Description'], amount: ['Amount'] },
            negativeIsExpense: false
        },
        usBank: {
            name: 'U.S. Bank',
            detect: (h) => hasAll(h, ['date', 'transaction', 'name', 'memo', 'amount']),
            mapping: { date: ['Date'], description: ['Name', 'Memo'], amount: ['Amount'] },
            negativeIsExpense: true
        },
        firstFinancial: {
            name: 'First Financial',
            detect: (h) => hasAll(h, ['posted_at', 'amount']) && hasAny(h, ['nickname', 'original_name']),
            mapping: { date: ['posted_at'], description: ['nickname', 'original_name'], amount: ['amount'] },
            negativeIsExpense: false,
            passthrough: true
        }
    };

    function cleanHeaders(headers) {
        return (headers || [])
            .map((h) => String(h == null ? '' : h).replace(/^﻿/, '').trim())
            .filter((h) => h && !h.startsWith('__parsed'));
    }

    function arraysEqual(a, b) {
        return a.length === b.length && a.every((v, i) => v === b[i]);
    }

    function findColumn(headers, possibleNames) {
        for (const name of possibleNames || []) {
            const target = norm(name);
            const found = headers.find((h) => norm(h) === target);
            if (found) return found;
        }
        return null;
    }

    function detectBankFormat(headers) {
        if (!headers || !headers.length) return null;
        const clean = cleanHeaders(headers);
        loadBankMappings();
        for (const mapping of Object.values(window.savedBankMappings)) {
            if (mapping && Array.isArray(mapping.headers) && arraysEqual(cleanHeaders(mapping.headers).sort(), clean.slice().sort())) {
                return { type: 'custom', name: mapping.bankName, mapping };
            }
        }
        for (const format of Object.values(knownBankFormats)) {
            if (format.detect(clean)) {
                return {
                    type: 'known',
                    name: format.name,
                    mapping: format.mapping,
                    negativeIsExpense: format.negativeIsExpense,
                    passthrough: !!format.passthrough
                };
            }
        }
        return null;
    }

    function resolveMapping(detected, headers) {
        if (!detected) return null;
        const clean = cleanHeaders(headers);
        if (detected.type === 'custom') {
            const m = detected.mapping;
            return {
                dateColumn: m.dateColumn,
                descriptionColumn: m.descriptionColumn,
                amountColumn: m.amountColumn || null,
                debitColumn: m.debitColumn || null,
                creditColumn: m.creditColumn || null,
                negativeIsExpense: m.negativeIsExpense !== false,
                passthrough: false
            };
        }
        const m = detected.mapping;
        return {
            dateColumn: findColumn(clean, m.date),
            descriptionColumn: findColumn(clean, m.description),
            amountColumn: m.amount ? findColumn(clean, m.amount) : null,
            debitColumn: m.debit ? findColumn(clean, m.debit) : null,
            creditColumn: m.credit ? findColumn(clean, m.credit) : null,
            negativeIsExpense: detected.negativeIsExpense !== false,
            passthrough: !!detected.passthrough
        };
    }

    function pickColumn(clean, exact, contains, exclude) {
        const skip = exclude || [];
        const byExact = findColumn(clean, exact);
        if (byExact && !skip.includes(byExact)) return byExact;
        for (const part of contains || []) {
            const found = clean.find((h) => !skip.includes(h) && norm(h).includes(part));
            if (found) return found;
        }
        return null;
    }

    function guessMapping(headers, rows) {
        const clean = cleanHeaders(headers);
        const dateColumn = pickColumn(clean, ['transaction date', 'trans date', 'date', 'posting date', 'posted date', 'post date', 'posted at', 'posted_at'], ['date', 'posted', 'time']);
        const used = [dateColumn];
        const descriptionColumn = pickColumn(clean, ['description', 'original description', 'payee', 'merchant', 'name', 'transaction', 'memo', 'details'], ['descri', 'merchant', 'payee', 'name', 'memo', 'detail', 'narrat', 'reference'], used);
        used.push(descriptionColumn);
        const amountColumn = pickColumn(clean, ['amount', 'transaction amount', 'value'], ['amount', 'sum', 'total', 'value'], used);
        const debitColumn = pickColumn(clean, ['debit', 'withdrawal', 'withdrawals', 'money out', 'paid out'], ['debit', 'withdraw', 'money out', 'paid out', 'charge'], used);
        const creditColumn = pickColumn(clean, ['credit', 'deposit', 'deposits', 'money in', 'paid in'], ['credit', 'deposit', 'money in', 'paid in'], used);
        const split = !amountColumn && !!debitColumn && !!creditColumn && debitColumn !== creditColumn;
        let negativeIsExpense = true;
        if (amountColumn && rows && rows.length) {
            let neg = 0;
            let pos = 0;
            rows.slice(0, 300).forEach((row) => {
                const v = parseCsvAmount(row[amountColumn]);
                if (isNaN(v) || v === 0) return;
                if (v < 0) neg++;
                else pos++;
            });
            negativeIsExpense = neg > pos || (neg > 0 && neg >= pos * 0.6);
            if (neg === 0 && pos > 0) negativeIsExpense = false;
        }
        return {
            dateColumn,
            descriptionColumn,
            amountColumn: split ? null : amountColumn || debitColumn || null,
            debitColumn: split ? debitColumn : null,
            creditColumn: split ? creditColumn : null,
            amountMode: split ? 'split' : 'single',
            negativeIsExpense
        };
    }

    function parseCsvAmount(value) {
        if (typeof value === 'number') return isFinite(value) ? value : NaN;
        if (value == null) return NaN;
        let s = String(value).trim();
        if (!s) return NaN;
        let negative = false;
        if (/^\(.*\)$/.test(s)) {
            negative = true;
            s = s.slice(1, -1);
        }
        if (s.startsWith('-')) {
            negative = true;
            s = s.slice(1);
        }
        if (s.endsWith('-')) {
            negative = true;
            s = s.slice(0, -1);
        }
        s = s.replace(/[^0-9.,]/g, '');
        if (!s) return NaN;
        const hasComma = s.includes(',');
        const hasDot = s.includes('.');
        if (hasComma && hasDot) {
            if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
            else s = s.replace(/,/g, '');
        } else if (hasComma) {
            const parts = s.split(',');
            if (parts.length === 2 && parts[1].length !== 3) s = parts.join('.');
            else s = parts.join('');
        }
        const parsed = parseFloat(s);
        if (!isFinite(parsed)) return NaN;
        return negative ? -parsed : parsed;
    }

    function isMappingUsable(mapping) {
        if (!mapping || !mapping.dateColumn || !mapping.descriptionColumn) return false;
        return !!mapping.amountColumn || (!!mapping.debitColumn && !!mapping.creditColumn);
    }

    function processTransactionsWithMapping(rows, mapping) {
        const out = [];
        const stats = { total: 0, missing: 0, unreadableAmounts: 0, unreadableDates: 0, zero: 0 };
        if (!isMappingUsable(mapping)) return { rows: out, stats };
        const split = !mapping.amountColumn && mapping.debitColumn && mapping.creditColumn;
        (rows || []).forEach((row) => {
            stats.total++;
            const dateValue = row[mapping.dateColumn];
            const descValue = row[mapping.descriptionColumn];
            if (dateValue == null || String(dateValue).trim() === '' || descValue == null || String(descValue).trim() === '') {
                stats.missing++;
                return;
            }
            const date = typeof parseLocalDate === 'function' ? parseLocalDate(dateValue) : new Date(dateValue);
            if (isNaN(date.getTime())) {
                stats.unreadableDates++;
                return;
            }
            let amount;
            if (split) {
                const debit = parseCsvAmount(row[mapping.debitColumn]);
                const credit = parseCsvAmount(row[mapping.creditColumn]);
                if (!isNaN(debit) && debit !== 0) amount = -Math.abs(debit);
                else if (!isNaN(credit) && credit !== 0) amount = Math.abs(credit);
                else if (isNaN(debit) && isNaN(credit)) {
                    stats.unreadableAmounts++;
                    return;
                } else {
                    stats.zero++;
                    return;
                }
            } else {
                amount = parseCsvAmount(row[mapping.amountColumn]);
                if (isNaN(amount)) {
                    stats.unreadableAmounts++;
                    return;
                }
                if (amount === 0) {
                    stats.zero++;
                    return;
                }
                if (mapping.negativeIsExpense === false) amount = -amount;
            }
            out.push({
                'Transaction Date': String(dateValue).trim(),
                Description: String(descValue).trim().toUpperCase(),
                Amount: amount,
                _originalFormat: 'CustomMapping',
                _rawCsvData: Object.assign({}, row),
                _date: date
            });
        });
        return { rows: out, stats };
    }

    function saveBankMapping(bankName, headers, mapping) {
        const name = String(bankName || '').trim();
        if (!name || !isMappingUsable(mapping)) return false;
        loadBankMappings();
        const id = name.toLowerCase().replace(/\s+/g, '_');
        window.savedBankMappings[id] = {
            bankName: name,
            headers: cleanHeaders(headers),
            dateColumn: mapping.dateColumn,
            descriptionColumn: mapping.descriptionColumn,
            amountColumn: mapping.amountColumn || '',
            debitColumn: mapping.debitColumn || '',
            creditColumn: mapping.creditColumn || '',
            negativeIsExpense: mapping.negativeIsExpense !== false
        };
        return saveBankMappings();
    }

    window.addEventListener('DOMContentLoaded', loadBankMappings);

    window.detectBankFormat = detectBankFormat;
    window.findColumn = findColumn;
    window.parseCsvAmount = parseCsvAmount;
    window.cleanCsvHeaders = cleanHeaders;
    window.resolveBankMapping = resolveMapping;
    window.guessColumnMapping = guessMapping;
    window.isBankMappingUsable = isMappingUsable;
    window.processTransactionsWithMapping = processTransactionsWithMapping;
    window.saveBankMapping = saveBankMapping;
    window.loadBankMappings = loadBankMappings;
})();
