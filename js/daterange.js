// js/daterange.js - Custom Date Range Module

// Open date range selector
function openDateRangeSelector() {
    const modal = document.getElementById('dateRangeModal');

    // Get min and max dates from data
    const allDates = [];
    monthlyData.forEach((data) => {
        data.transactions.forEach((t) => {
            const date = t['Transaction Date'] || t.Date || t.date;
            if (date) allDates.push(new Date(date));
        });
    });

    if (allDates.length === 0) {
        showNotification('No transaction data available', 'error');
        return;
    }

    const minDate = new Date(Math.min(...allDates));
    const maxDate = new Date(Math.max(...allDates));

    modal.innerHTML = `
        <div class="modal-content" style="width: 600px;">
            <div class="modal-header">
                <h2>Custom Date Range</h2>
                <button class="close-btn" onclick="closeModal('dateRangeModal')">&times;</button>
            </div>
            <div class="modal-body">
                <div class="date-range-selector-modal">
                    <div class="date-input-group">
                        <label>Start Date:</label>
                        <input type="date" id="customStartDate" 
                               min="${minDate.toISOString().split('T')[0]}"
                               max="${maxDate.toISOString().split('T')[0]}"
                               value="${minDate.toISOString().split('T')[0]}">
                    </div>
                    <div class="date-input-group">
                        <label>End Date:</label>
                        <input type="date" id="customEndDate"
                               min="${minDate.toISOString().split('T')[0]}"
                               max="${maxDate.toISOString().split('T')[0]}"
                               value="${maxDate.toISOString().split('T')[0]}">
                    </div>
                </div>
                
                <div class="quick-ranges">
                    <h4>Quick Select:</h4>
                    <div class="quick-range-buttons">
                        <button class="btn btn-secondary" onclick="setQuickRange(7)">Last 7 days</button>
                        <button class="btn btn-secondary" onclick="setQuickRange(30)">Last 30 days</button>
                        <button class="btn btn-secondary" onclick="setQuickRange(90)">Last 90 days</button>
                        <button class="btn btn-secondary" onclick="setQuickRange(365)">Last year</button>
                        <button class="btn btn-secondary" onclick="setQuickRangeYTD()">Year to date</button>
                    </div>
                </div>
                
                <div id="dateRangePreview"></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal('dateRangeModal')">Cancel</button>
                <button class="btn btn-primary" onclick="applyCustomDateRange()">View Range</button>
            </div>
        </div>
    `;

    modal.classList.add('show');
    updateDateRangePreview();
}

// Set quick range
function setQuickRange(days) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);

    document.getElementById('customStartDate').value = start.toISOString().split('T')[0];
    document.getElementById('customEndDate').value = end.toISOString().split('T')[0];

    updateDateRangePreview();
}

// Set year to date
function setQuickRangeYTD() {
    const end = new Date();
    const start = new Date(end.getFullYear(), 0, 1);

    document.getElementById('customStartDate').value = start.toISOString().split('T')[0];
    document.getElementById('customEndDate').value = end.toISOString().split('T')[0];

    updateDateRangePreview();
}

// Update preview
function updateDateRangePreview() {
    const start = new Date(document.getElementById('customStartDate').value);
    const end = new Date(document.getElementById('customEndDate').value);

    // Filter transactions in range
    const transactionsInRange = [];
    monthlyData.forEach((data) => {
        data.transactions.forEach((t) => {
            const date = new Date(t['Transaction Date'] || t.Date || t.date);
            if (date >= start && date <= end) {
                transactionsInRange.push(t);
            }
        });
    });

    const analyzer = analyzeTransactions(transactionsInRange);
    const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;

    document.getElementById('dateRangePreview').innerHTML = `
        <div class="range-preview">
            <h4>Preview:</h4>
            <div class="preview-stats">
                <div class="preview-stat">
                    <span>Days:</span>
                    <strong>${days}</strong>
                </div>
                <div class="preview-stat">
                    <span>Transactions:</span>
                    <strong>${transactionsInRange.length}</strong>
                </div>
                <div class="preview-stat">
                    <span>Total Spending:</span>
                    <strong>$${analyzer.totalExpenses.toFixed(2)}</strong>
                </div>
                <div class="preview-stat">
                    <span>Daily Average:</span>
                    <strong>$${(analyzer.totalExpenses / days).toFixed(2)}</strong>
                </div>
            </div>
        </div>
    `;
}

// Apply custom date range
function applyCustomDateRange() {
    const start = new Date(document.getElementById('customStartDate').value);
    const end = new Date(document.getElementById('customEndDate').value);

    if (start > end) {
        showNotification('Start date must be before end date', 'error');
        return;
    }

    // Store custom range in global state
    window.customDateRange = {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
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

    const startStr = start.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
    const endStr = end.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
    customOption.textContent = `📅 Custom: ${startStr} - ${endStr}`;

    dropdown.value = 'CUSTOM_RANGE';
    switchToMonth('CUSTOM_RANGE');

    closeModal('dateRangeModal');
    showNotification('Custom date range applied', 'success');
}
