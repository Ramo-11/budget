// js/sample-data.js - Sample Data Management

let isInSampleMode = false;
let backupData = null;

// Load sample data
// Load sample data from JSON backup file
async function loadSampleData() {
    try {
        // Backup current data if exists
        if (monthlyData.size > 0) {
            backupData = {
                monthlyData: new Map(monthlyData),
                budgets: { ...budgets },
                categoryConfig: { ...categoryConfig },
                transactionOverrides: { ...window.transactionOverrides },
                unifiedRules: [...(window.unifiedRules || [])],
            };
        }

        // Fetch the sample JSON file
        const response = await fetch('sample_data.json');
        const importData = await response.json();

        // Validate the backup structure
        if (!importData.version || !importData.monthlyData) {
            throw new Error('Invalid sample data format');
        }

        // Replace all data with sample data
        monthlyData = new Map(importData.monthlyData);
        categoryConfig = importData.categoryConfig || categoryConfig;
        budgets = importData.budgets || {};
        window.transactionOverrides = importData.transactionOverrides || {};
        window.unifiedRules = importData.unifiedRules || [];

        // Save data
        saveData();

        // Set sample mode flag
        isInSampleMode = true;
        localStorage.setItem('sahabBudget_sampleMode', 'true');

        // Update UI elements
        const sampleIndicator = document.getElementById('sampleModeIndicator');
        const sampleBanner = document.getElementById('sampleModeBanner');
        const gettingStarted = document.getElementById('gettingStartedSection');

        if (sampleIndicator) sampleIndicator.style.display = 'block';
        if (sampleBanner) sampleBanner.style.display = 'block';
        if (gettingStarted) gettingStarted.classList.add('collapsed');

        // Update the appropriate month selector
        if (typeof updateMonthSelector === 'function' && document.getElementById('monthDropdown')) {
            updateMonthSelector();
            document.getElementById('monthDropdown').value = 'ALL_DATA';
            switchToMonth('ALL_DATA');
        } else if (
            typeof updateSettingsMonthSelector === 'function' &&
            document.getElementById('settingsMonthDropdown')
        ) {
            updateSettingsMonthSelector();
            const months = Array.from(monthlyData.keys()).sort().reverse();
            if (months.length > 0) {
                document.getElementById('settingsMonthDropdown').value = months[0];
                switchSettingsMonth(months[0]);
            }
        }

        // Update storage stats if on settings page
        if (typeof updateStorageStats === 'function') {
            updateStorageStats();
        }

        // Show success message
        showNotification(
            'Sample data loaded! Feel free to explore all features. Your original data is safely backed up.',
            'success'
        );

        // Redirect to dashboard if not already there
        if (
            !window.location.pathname.includes('index.html') &&
            window.location.pathname !== '/' &&
            window.location.pathname !== ''
        ) {
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        }
    } catch (error) {
        console.error('Error loading sample data:', error);
        showNotification(
            'Error loading sample data. Please ensure sample-data.json exists.',
            'error'
        );
    }
}

// Exit sample mode
function exitSampleMode() {
    // Check both the flag and localStorage
    if (!isInSampleMode && localStorage.getItem('sahabBudget_sampleMode') !== 'true') {
        showNotification('Not currently in sample mode', 'info');
        return;
    }

    if (
        !confirm(
            'Exit sample mode and clear all data? This will remove the sample data completely.'
        )
    ) {
        return;
    }

    // Clear everything
    localStorage.removeItem('sahabBudget_data');
    localStorage.removeItem('sahabBudget_sampleMode');
    localStorage.removeItem('sahabBudget_hideGettingStarted');

    // Reset all in-memory data
    if (typeof monthlyData !== 'undefined') monthlyData.clear();
    if (typeof budgets !== 'undefined') budgets = {};
    if (typeof window.transactionOverrides !== 'undefined') window.transactionOverrides = {};
    if (typeof window.unifiedRules !== 'undefined') window.unifiedRules = [];

    isInSampleMode = false;

    // Reload the page to reset everything
    location.reload();
}

// Show getting started section - UPDATE THIS
function showGettingStarted() {
    const section = document.getElementById('gettingStartedSection');

    // Only proceed if the element exists (we're on dashboard)
    if (!section) {
        // If not on dashboard, redirect
        goToDashboardGettingStarted();
        return;
    }

    section.classList.remove('collapsed');
    localStorage.removeItem('sahabBudget_hideGettingStarted');

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
// Toggle getting started section
function toggleGettingStarted() {
    const section = document.getElementById('gettingStartedSection');
    if (!section) return;

    section.classList.toggle('collapsed');

    // Save the state to localStorage
    if (section.classList.contains('collapsed')) {
        localStorage.setItem('sahabBudget_hideGettingStarted', 'true');
    } else {
        localStorage.removeItem('sahabBudget_hideGettingStarted');
    }
}

// Show help modal
function showHelp() {
    const modal = document.createElement('div');
    modal.className = 'help-modal';

    const isOnDashboard =
        window.location.pathname.includes('index.html') ||
        window.location.pathname === '/' ||
        window.location.pathname === '';

    modal.innerHTML = `
        <div class="help-modal-content">
            <div class="help-modal-header">
                <h2>Help & Resources</h2>
                <button class="help-close-btn" onclick="this.closest('.help-modal').remove()">×</button>
            </div>
            
            <div class="help-options">
                <div class="help-option-card" onclick="${
                    isOnDashboard ? 'showGettingStarted()' : 'goToDashboardGettingStarted()'
                }; this.closest('.help-modal').remove();">
                    <h3>Watch Tutorial</h3>
                    <p>Learn the basics in our quick video guide</p>
                    <button class="btn btn-primary">Watch Now</button>
                </div>
                
                <div class="help-option-card" onclick="loadSampleData(); this.closest('.help-modal').remove();">
                    <h3>Try Sample Data</h3>
                    <p>Explore features with demo transactions</p>
                    <button class="btn btn-primary">Load Sample</button>
                </div>
                
                <div class="help-option-card" onclick="window.location.href='about.html'; this.closest('.help-modal').remove();">
                    <h3>User Guide</h3>
                    <p>Detailed instructions and tips</p>
                    <button class="btn btn-secondary">View Guide</button>
                </div>
                
                ${
                    localStorage.getItem('sahabBudget_sampleMode') === 'true'
                        ? `
                    <div class="help-option-card" onclick="exitSampleMode(); this.closest('.help-modal').remove();">
                        <h3>🚪 Exit Sample Mode</h3>
                        <p>Clear sample data and start fresh</p>
                        <button class="btn btn-danger">Exit Sample Mode</button>
                    </div>
                `
                        : ''
                }
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Navigate to dashboard and show getting started
function goToDashboardGettingStarted() {
    // Set a flag to show getting started when dashboard loads
    localStorage.setItem('sahabBudget_showGettingStarted', 'true');
    window.location.href = 'index.html';
}

// Watch tutorial
function watchTutorial() {
    // If not on dashboard, go to dashboard first
    if (
        !window.location.pathname.includes('index.html') &&
        window.location.pathname !== '/' &&
        window.location.pathname !== ''
    ) {
        // Set flag to show tutorial when dashboard loads
        localStorage.setItem('sahabBudget_showTutorial', 'true');
        window.location.href = 'index.html';
    } else {
        showGettingStarted();
        // Scroll to video
        setTimeout(() => {
            const videoWrapper = document.getElementById('videoWrapper');
            if (videoWrapper) {
                videoWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 300);
    }
}

// Show getting started section
function showGettingStarted() {
    const section = document.getElementById('gettingStartedSection');

    // Only proceed if the element exists (we're on dashboard)
    if (!section) {
        // If not on dashboard, redirect
        goToDashboardGettingStarted();
        return;
    }

    section.classList.remove('collapsed');
    localStorage.removeItem('sahabBudget_hideGettingStarted');

    const btn = section.querySelector('.collapse-btn');
    if (btn) {
        btn.textContent = 'Hide Getting Started ↑';
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Check for saved preferences on load
window.addEventListener('DOMContentLoaded', () => {
    // Check if in sample mode from localStorage
    if (localStorage.getItem('sahabBudget_sampleMode') === 'true') {
        isInSampleMode = true;
        const sampleBanner = document.getElementById('sampleModeBanner');
        if (sampleBanner) {
            sampleBanner.style.display = 'block';
        }
    }

    // Check if getting started should be hidden (user preference)
    if (localStorage.getItem('sahabBudget_hideGettingStarted') === 'true') {
        const section = document.getElementById('gettingStartedSection');
        if (section) {
            section.classList.add('collapsed');
        }
    }

    // Check if we should show getting started (from navigation)
    if (localStorage.getItem('sahabBudget_showGettingStarted') === 'true') {
        localStorage.removeItem('sahabBudget_showGettingStarted');
        const section = document.getElementById('gettingStartedSection');
        if (section) {
            section.classList.remove('collapsed');
            localStorage.removeItem('sahabBudget_hideGettingStarted');
        }
    }

    // Check if we should show tutorial (from navigation)
    if (localStorage.getItem('sahabBudget_showTutorial') === 'true') {
        localStorage.removeItem('sahabBudget_showTutorial');
        const section = document.getElementById('gettingStartedSection');
        if (section) {
            section.classList.remove('collapsed');
            localStorage.removeItem('sahabBudget_hideGettingStarted');
            setTimeout(() => {
                const videoWrapper = document.getElementById('videoWrapper');
                if (videoWrapper) {
                    videoWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 500);
        }
    }
});
