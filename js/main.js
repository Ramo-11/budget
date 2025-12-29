// js/main.js - Main App Controller and Event Handlers

// Load saved data on startup
window.addEventListener('DOMContentLoaded', () => {
    if (!window.merchantRules) {
        window.merchantRules = {};
    }

    loadSavedData();

    // Check if there's any data
    if (monthlyData.size > 0) {
        updateMonthSelector();
        document.getElementById('monthDropdown').value = 'ALL_DATA';
        switchToMonth('ALL_DATA');
    } else {
        // Show empty state if no data
        showDashboardEmptyState();
    }
});

// Handle file upload
async function handleFileUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    document.getElementById('loading').style.display = 'block';

    try {
        const allTransactions = [];

        for (const file of files) {
            const text = await file.text();
            const result = Papa.parse(text, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
            });

            if (result.errors.length > 0) {
                console.warn('CSV parsing warnings:', result.errors);
            }

            allTransactions.push(...result.data);
        }

        if (allTransactions.length === 0) {
            throw new Error('No valid transactions found in files');
        }

        // Check if we can detect the bank format
        const headers = Object.keys(allTransactions[0]);
        const detectedFormat = window.detectBankFormat ? window.detectBankFormat(headers) : null;

        if (detectedFormat) {
            // Known format detected - process normally or with custom mapping
            let transactionsToProcess = allTransactions;

            if (detectedFormat.type === 'custom') {
                // Use saved custom mapping
                const mapping = {
                    dateColumn: detectedFormat.mapping.dateColumn,
                    descriptionColumn: detectedFormat.mapping.descriptionColumn,
                    amountColumn: detectedFormat.mapping.amountColumn,
                    negativeIsExpense: detectedFormat.mapping.negativeIsExpense
                };

                // Normalize transactions using custom mapping
                transactionsToProcess = [];
                allTransactions.forEach(row => {
                    const dateValue = row[mapping.dateColumn];
                    const descValue = row[mapping.descriptionColumn];
                    let amountValue = parseFloat(row[mapping.amountColumn]) || 0;

                    if (!dateValue || !descValue) return;

                    if (mapping.negativeIsExpense) {
                        if (amountValue >= 0) return;
                    } else {
                        if (amountValue <= 0) return;
                        amountValue = -Math.abs(amountValue);
                    }

                    transactionsToProcess.push({
                        'Transaction Date': dateValue,
                        Description: String(descValue).toUpperCase(),
                        Amount: amountValue,
                        _originalFormat: 'CustomMapping'
                    });
                });
            }

            // Process transactions
            const processResult = splitByMonth(transactionsToProcess);
            saveData();

            // Show detailed upload result
            let message = `Processed ${transactionsToProcess.length} transactions`;
            if (detectedFormat.name) {
                message = `${detectedFormat.name} format detected. ` + message;
            }
            if (processResult.rulesApplied > 0) {
                message += ` (${processResult.rulesApplied} removed by custom rules)`;
            }
            if (processResult.skipped > 0) {
                message += ` (${processResult.skipped} income/credits skipped)`;
            }
            if (processResult.duplicates > 0) {
                message += ` (${processResult.duplicates} duplicates skipped)`;
            }
            if (processResult.added > 0) {
                message += ` - ${processResult.added} new expenses added`;
            }
            showNotification(message, 'success');

            // Reload the page after a short delay
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } else {
            // Unknown format - show column mapping UI
            if (window.showColumnMappingModal) {
                window.showColumnMappingModal(allTransactions, files);
            } else {
                // Fallback if column mapping not loaded
                throw new Error('Unknown CSV format. Please ensure your CSV has Date, Description, and Amount columns.');
            }
        }
    } catch (error) {
        console.error('Upload error:', error);
        showNotification('Error processing files: ' + error.message, 'error');
        document.getElementById('loading').style.display = 'none';
        event.target.value = ''; // Reset file input
    }
}
// Switch view
function switchView(viewName) {
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));

    document.getElementById(viewName + 'View').classList.add('active');
    event.target.classList.add('active');

    if (viewName === 'settings') {
        // Filter out ALL_DATA option for settings view
        const dropdown = document.getElementById('monthDropdown');
        const currentValue = dropdown.value;

        // Temporarily remove ALL_DATA option
        const allDataOption = dropdown.querySelector('option[value="ALL_DATA"]');
        if (allDataOption) {
            allDataOption.style.display = 'none';
        }

        // If currently on ALL_DATA, switch to most recent month
        if (currentMonth === 'ALL_DATA') {
            const months = Array.from(monthlyData.keys()).sort().reverse();
            if (months.length > 0) {
                dropdown.value = months[0];
                switchToMonth(months[0]);
            }
        } else if (currentMonth) {
            const monthData = monthlyData.get(currentMonth);
            if (monthData) {
                const analyzer = analyzeTransactions(monthData.transactions);
                updateBudgetView(analyzer);
            }
        }
        updateMerchantRulesDisplay();
    } else {
        // Show ALL_DATA option for other views
        const dropdown = document.getElementById('monthDropdown');
        const allDataOption = dropdown.querySelector('option[value="ALL_DATA"]');
        if (allDataOption) {
            allDataOption.style.display = '';
        }
    }
}

// Apply merchant rules to all data when viewing "All Data"
function applyMerchantRulesToAllData() {
    if (!window.merchantRules || Object.keys(window.merchantRules).length === 0) return;

    let rulesApplied = 0;

    monthlyData.forEach((monthData, monthKey) => {
        monthData.transactions.forEach((transaction) => {
            // Skip if already has an override
            if (
                window.transactionOverrides &&
                window.transactionOverrides[monthKey] &&
                window.transactionOverrides[monthKey][transaction._id]
            ) {
                return;
            }

            const description = (
                transaction.Description ||
                transaction.description ||
                ''
            ).toUpperCase();

            // Check if any merchant rule applies
            for (const [merchant, category] of Object.entries(window.merchantRules)) {
                if (description.includes(merchant)) {
                    rulesApplied++;
                    break;
                }
            }
        });
    });

    if (rulesApplied > 0) {
        console.log(`Applied merchant rules to ${rulesApplied} transactions`);
    }
}

// Dashboard Search Functionality
function handleDashboardSearch(event) {
    const query = event.target.value.trim();

    // If Enter key pressed or query is at least 2 characters
    if (event.key === 'Enter' || query.length >= 2) {
        searchDashboardTransactions(query);
    } else if (query.length === 0) {
        // Clear search - show normal dashboard view
        clearDashboardSearch();
    }
}

function searchDashboardTransactions(query) {
    if (!query || query.length < 2) {
        clearDashboardSearch();
        return;
    }

    const searchTerm = query.toLowerCase();
    const results = [];

    // Search through all monthly data
    monthlyData.forEach((monthData, monthKey) => {
        monthData.transactions.forEach((transaction) => {
            const description = (
                transaction.Description ||
                transaction.description ||
                ''
            ).toLowerCase();
            const amount = Math.abs(parseFloat(transaction.Amount) || 0).toString();

            if (description.includes(searchTerm) || amount.includes(searchTerm)) {
                results.push({
                    ...transaction,
                    monthKey: monthKey,
                    monthName: monthData.monthName,
                    parsedAmount: Math.abs(parseFloat(transaction.Amount) || 0),
                    parsedDate: new Date(
                        transaction['Transaction Date'] ||
                        transaction['Posting Date'] ||
                        transaction['Post Date'] ||
                        transaction.Date ||
                        transaction.date ||
                        transaction['Trans Date'] ||
                        transaction['Trans. Date'] ||
                        transaction['Posted Date']
                    ),
                });
            }
        });
    });

    displayDashboardSearchResults(results, searchTerm);
}

function displayDashboardSearchResults(results, searchTerm) {
    const categoryDetails = document.getElementById('categoryDetails');
    const summaryCards = document.getElementById('summaryCards');
    const chartsContainer = document.querySelector('.charts-container');
    const sectionHeader = document.querySelector('.section-header');

    // Hide normal dashboard elements
    if (summaryCards) summaryCards.style.display = 'none';
    if (chartsContainer) chartsContainer.style.display = 'none';
    if (sectionHeader) sectionHeader.style.display = 'none';

    if (results.length === 0) {
        categoryDetails.innerHTML = `
            <div class="search-results-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <h3>No transactions found</h3>
                <p>No transactions match "${highlightSearchText(searchTerm, searchTerm)}"</p>
            </div>
        `;
        return;
    }

    // Sort by date descending
    results.sort((a, b) => b.parsedDate - a.parsedDate);

    const totalAmount = results.reduce((sum, tx) => sum + tx.parsedAmount, 0);

    categoryDetails.innerHTML = `
        <div class="search-results-container">
            <div class="search-results-header-bar">
                <div class="search-results-info">
                    <h3>Found ${results.length} transaction${results.length === 1 ? '' : 's'}</h3>
                    <span class="search-results-total">Total: $${totalAmount.toFixed(2)}</span>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="clearDashboardSearch()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    Clear Search
                </button>
            </div>
            <div class="search-results-list">
                ${results.map((transaction) => {
                    const description = transaction.Description || transaction.description || '';
                    const highlightedDesc = highlightSearchText(description, searchTerm);
                    const date = transaction['Transaction Date'] ||
                                 transaction['Posting Date'] ||
                                 transaction.Date ||
                                 transaction.date;
                    const category = categorizeTransaction(description, transaction._id, transaction.monthKey);
                    const categoryInfo = categoryConfig[category] || { icon: '', color: 'var(--gray)' };

                    return `
                        <div class="search-result-row">
                            <div class="search-result-category" style="background: ${categoryInfo.color}20; color: ${categoryInfo.color}">
                                ${category}
                            </div>
                            <div class="search-result-date">${new Date(date).toLocaleDateString()}</div>
                            <div class="search-result-description" title="${description}">${highlightedDesc}</div>
                            <div class="search-result-month">${transaction.monthName}</div>
                            <div class="search-result-amount">$${transaction.parsedAmount.toFixed(2)}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function highlightSearchText(text, searchTerm) {
    if (!searchTerm) return text;
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="search-highlight">$1</mark>');
}

function clearDashboardSearch() {
    const searchInput = document.getElementById('dashboardSearch');
    if (searchInput) searchInput.value = '';

    const summaryCards = document.getElementById('summaryCards');
    const chartsContainer = document.querySelector('.charts-container');
    const sectionHeader = document.querySelector('.section-header');

    // Show normal dashboard elements
    if (summaryCards) summaryCards.style.display = '';
    if (chartsContainer) chartsContainer.style.display = '';
    if (sectionHeader) sectionHeader.style.display = '';

    // Re-render the current view
    if (currentMonth) {
        switchToMonth(currentMonth);
    }
}
