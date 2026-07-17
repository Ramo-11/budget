// js/daterange.js - Custom date range modal
// All date parsing goes through window.parseLocalDate so date-only strings
// stay in local time, and the end date is inclusive (end of day).

let dateRangeBounds = null;

// Local YYYY-MM-DD (no UTC shift, unlike toISOString).
function dateRangeToISO(date) {
    return (
        date.getFullYear() +
        '-' +
        String(date.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(date.getDate()).padStart(2, '0')
    );
}

// Read and validate the two inputs. Returns null when incomplete/invalid.
function getSelectedDateRange() {
    const startValue = document.getElementById('customStartDate')?.value;
    const endValue = document.getElementById('customEndDate')?.value;
    if (!startValue || !endValue) return null;

    const start = window.parseLocalDate(startValue);
    const end = window.parseLocalDate(endValue);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

    const endOfDay = new Date(end);
    endOfDay.setHours(23, 59, 59, 999);

    return { start, end, endOfDay, startValue, endValue };
}

// Open date range selector
function openDateRangeSelector() {
    const modal = document.getElementById('dateRangeModal');

    // Min and max dates from data (local time)
    const allDates = [];
    monthlyData.forEach((data) => {
        data.transactions.forEach((t) => {
            const raw = t['Transaction Date'] || t.Date || t.date;
            if (!raw) return;
            const parsed = window.parseLocalDate(raw);
            if (!isNaN(parsed.getTime())) allDates.push(parsed.getTime());
        });
    });

    if (allDates.length === 0) {
        showNotification('No transaction data available', 'error');
        return;
    }

    const minDate = new Date(Math.min(...allDates));
    const maxDate = new Date(Math.max(...allDates));
    dateRangeBounds = { min: minDate, max: maxDate };

    const minISO = dateRangeToISO(minDate);
    const maxISO = dateRangeToISO(maxDate);

    modal.innerHTML = `
        <div class="modal-content" style="width: 560px;">
            <div class="modal-header">
                <h2>Date Range</h2>
                <button class="close-btn" onclick="closeModal('dateRangeModal')" aria-label="Close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="date-range-selector-modal">
                    <div class="date-input-group">
                        <label for="customStartDate">Start</label>
                        <input type="date" id="customStartDate"
                               min="${minISO}" max="${maxISO}" value="${minISO}">
                    </div>
                    <div class="date-input-group">
                        <label for="customEndDate">End</label>
                        <input type="date" id="customEndDate"
                               min="${minISO}" max="${maxISO}" value="${maxISO}">
                    </div>
                </div>

                <div class="quick-range-buttons">
                    <button class="btn btn-secondary" onclick="setQuickRange(7)">7 days</button>
                    <button class="btn btn-secondary" onclick="setQuickRange(30)">30 days</button>
                    <button class="btn btn-secondary" onclick="setQuickRange(90)">90 days</button>
                    <button class="btn btn-secondary" onclick="setQuickRange(365)">1 year</button>
                    <button class="btn btn-secondary" onclick="setQuickRangeYTD()">Year to date</button>
                </div>

                <div id="dateRangePreview"></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal('dateRangeModal')">Cancel</button>
                <button class="btn btn-primary" onclick="applyCustomDateRange()">Apply Range</button>
            </div>
        </div>
    `;

    modal.classList.add('show');
    modal.onclick = (event) => {
        if (event.target === modal) closeModal('dateRangeModal');
    };

    // Keep the preview live while dates change
    document.getElementById('customStartDate').addEventListener('change', updateDateRangePreview);
    document.getElementById('customEndDate').addEventListener('change', updateDateRangePreview);

    updateDateRangePreview();
}

// Quick range: an inclusive window of exactly `days` days, clamped to the
// dates that actually have data.
function setQuickRange(days) {
    if (!dateRangeBounds) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let end = today;
    if (end > dateRangeBounds.max) end = new Date(dateRangeBounds.max);
    if (end < dateRangeBounds.min) end = new Date(dateRangeBounds.min);

    let start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    if (start < dateRangeBounds.min) start = new Date(dateRangeBounds.min);

    document.getElementById('customStartDate').value = dateRangeToISO(start);
    document.getElementById('customEndDate').value = dateRangeToISO(end);

    updateDateRangePreview();
}

// Year to date (clamped to available data)
function setQuickRangeYTD() {
    if (!dateRangeBounds) return;

    let end = new Date();
    end.setHours(0, 0, 0, 0);
    if (end > dateRangeBounds.max) end = new Date(dateRangeBounds.max);
    if (end < dateRangeBounds.min) end = new Date(dateRangeBounds.min);

    let start = new Date(end.getFullYear(), 0, 1);
    if (start < dateRangeBounds.min) start = new Date(dateRangeBounds.min);

    document.getElementById('customStartDate').value = dateRangeToISO(start);
    document.getElementById('customEndDate').value = dateRangeToISO(end);

    updateDateRangePreview();
}

// Update preview
function updateDateRangePreview() {
    const preview = document.getElementById('dateRangePreview');
    if (!preview) return;

    const range = getSelectedDateRange();
    if (!range) {
        preview.innerHTML = '<p class="range-hint">Pick a start and end date.</p>';
        return;
    }
    if (range.start > range.end) {
        preview.innerHTML = '<p class="range-hint danger">Start date is after end date.</p>';
        return;
    }

    // Transactions in range (end date inclusive)
    const transactionsInRange = [];
    monthlyData.forEach((data) => {
        data.transactions.forEach((t) => {
            const date = window.parseLocalDate(t['Transaction Date'] || t.Date || t.date);
            if (!isNaN(date.getTime()) && date >= range.start && date <= range.endOfDay) {
                transactionsInRange.push(t);
            }
        });
    });

    const summary = window.computeSpendingSummary(transactionsInRange);
    const days = Math.round((range.end - range.start) / (1000 * 60 * 60 * 24)) + 1;

    preview.innerHTML = `
        <div class="range-preview">
            <div class="preview-stats">
                <div class="preview-stat">
                    <span>Days</span>
                    <strong>${days}</strong>
                </div>
                <div class="preview-stat">
                    <span>Transactions</span>
                    <strong>${transactionsInRange.length}</strong>
                </div>
                <div class="preview-stat">
                    <span>Spent</span>
                    <strong>${formatMoney(summary.total)}</strong>
                </div>
                <div class="preview-stat">
                    <span>Daily average</span>
                    <strong>${formatMoney(days > 0 ? summary.total / days : 0)}</strong>
                </div>
            </div>
        </div>
    `;
}

// Apply custom date range
function applyCustomDateRange() {
    const range = getSelectedDateRange();
    if (!range) {
        showNotification('Pick a start and end date', 'error');
        return;
    }
    if (range.start > range.end) {
        showNotification('Start date must be before end date', 'error');
        return;
    }

    // Store as local date strings; consumers parse with parseLocalDate.
    window.customDateRange = {
        start: range.startValue,
        end: range.endValue,
        active: true,
    };

    // Add custom range option to month dropdown
    const dropdown = document.getElementById('monthDropdown');
    let customOption = dropdown.querySelector('option[value="CUSTOM_RANGE"]');

    if (!customOption) {
        customOption = document.createElement('option');
        customOption.value = 'CUSTOM_RANGE';
        dropdown.insertBefore(customOption, dropdown.firstChild);
    }

    const format = { month: 'short', day: 'numeric', year: 'numeric' };
    const startStr = range.start.toLocaleDateString('en-US', format);
    const endStr = range.end.toLocaleDateString('en-US', format);
    customOption.textContent = `Custom: ${startStr} to ${endStr}`;

    dropdown.value = 'CUSTOM_RANGE';
    switchToMonth('CUSTOM_RANGE');

    closeModal('dateRangeModal');
    showNotification('Custom date range applied', 'success');
}
