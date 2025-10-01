// js/sample-data.js - Sample Data Management

let isInSampleMode = false;
let backupData = null;

// Load sample data
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

        if (!response.ok) {
            throw new Error(`Failed to fetch sample data: ${response.status}`);
        }

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

        // Show success message
        showNotification('Sample data loaded! Redirecting to dashboard...', 'success');

        // Always redirect/reload to dashboard
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 500);
    } catch (error) {
        console.error('Error loading sample data:', error);
        showNotification('Error loading sample data: ' + error.message, 'error');
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
                        <h3>Exit Sample Mode</h3>
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

        // Hide the sample data card if in sample mode
        const sampleDataCard = document.querySelector('.sample-data-card');
        if (sampleDataCard) {
            sampleDataCard.style.display = 'none';
        }

        // Adjust grid and make tutorial card more compact
        const gettingStartedGrid = document.querySelector('.getting-started-grid');
        if (gettingStartedGrid) {
            gettingStartedGrid.style.gridTemplateColumns = '1fr';
        }

        const tutorialCard = document.querySelector('.tutorial-card');
        if (tutorialCard) {
            tutorialCard.style.maxWidth = 'none';
            tutorialCard.style.margin = '0 auto';
        }

        const videoWrapper = document.getElementById('videoWrapper');
        if (videoWrapper) {
            videoWrapper.style.paddingBottom = '100%';
        }
    } else if (monthlyData && monthlyData.size > 0) {
        // User has their own data (not sample mode) - hide sample data card
        const sampleDataCard = document.querySelector('.sample-data-card');
        if (sampleDataCard) {
            sampleDataCard.style.display = 'none';
        }

        // Adjust grid to single column
        const gettingStartedGrid = document.querySelector('.getting-started-grid');
        if (gettingStartedGrid) {
            gettingStartedGrid.style.gridTemplateColumns = '1fr';
        }

        const tutorialCard = document.querySelector('.tutorial-card');
        if (tutorialCard) {
            tutorialCard.style.maxWidth = 'none';
            tutorialCard.style.margin = '0 auto';
        }

        const videoWrapper = document.getElementById('videoWrapper');
        if (videoWrapper) {
            videoWrapper.style.paddingBottom = '50%';
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
