// js/sample-data.js - Sample Data Management

let isInSampleMode = false;
let backupData = null;

// Load sample data into a dedicated "Sample Data" account. Real accounts are
// never modified, so exiting sample mode can never lose the user's own data.
async function loadSampleData() {
    try {
        const response = await fetch('sample_data.json');
        if (!response.ok) {
            throw new Error(`Failed to fetch sample data: ${response.status}`);
        }
        const importData = await response.json();
        if (!importData.version || !importData.monthlyData) {
            throw new Error('Invalid sample data format');
        }

        const payload = {
            monthlyData: importData.monthlyData,
            categoryConfig: importData.categoryConfig || {},
            budgets: importData.budgets || {},
            transactionOverrides: importData.transactionOverrides || {},
            unifiedRules: importData.unifiedRules || [],
        };
        if (importData.incomeSettings) payload.incomeSettings = importData.incomeSettings;

        beginSampleMode(payload);
        isInSampleMode = true;

        showNotification('Sample data loaded! Redirecting to dashboard...', 'success');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 500);
    } catch (error) {
        console.error('Error loading sample data:', error);
        showNotification('Error loading sample data: ' + error.message, 'error');
    }
}

// Exit sample mode: removes only the sample account and returns to the
// account that was active before sample mode was entered.
function exitSampleMode() {
    if (!isInSampleMode && localStorage.getItem('sahabBudget_sampleMode') !== 'true') {
        showNotification('Not currently in sample mode', 'info');
        return;
    }

    endSampleMode();
    isInSampleMode = false;
    location.reload();
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

// Load the tutorial video on demand (click-to-load facade).
// The video player is a third-party embed; we only inject it after an
// explicit user action so its controls are not present until requested.
function loadTutorialVideo() {
    const wrapper = document.getElementById('videoWrapper');
    if (!wrapper) return;

    const iframe = document.createElement('iframe');
    iframe.title = 'Sahab Budget tutorial video';
    iframe.src = 'https://embed.app.guidde.com/playbooks/gBx67acerFe4SV2D78jUn9?mode=videoOnly&autoplay=true';
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
    iframe.allowFullscreen = true;

    wrapper.innerHTML = '';
    wrapper.appendChild(iframe);
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
                <button class="help-close-btn" onclick="this.closest('.help-modal').remove()" aria-label="Close"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
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
        btn.textContent = 'Hide Getting Started';
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Check for saved preferences on load
window.addEventListener('DOMContentLoaded', () => {
    // Remove the early-hide class so normal CSS/JS takes over
    document.documentElement.classList.remove('tutorial-hidden');
    // Sample mode is only truly active when the dedicated sample account is the
    // active one. Switching to a real account clears the stale banner + flag.
    const flagSet = localStorage.getItem('sahabBudget_sampleMode') === 'true';
    const onSampleAccount = (typeof window.isSampleAccount !== 'function') || window.isSampleAccount();
    if (flagSet && !onSampleAccount) {
        localStorage.removeItem('sahabBudget_sampleMode');
    }
    const inSample = flagSet && onSampleAccount;
    if (inSample) {
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
        // User has their own data, so auto-hide the whole onboarding section.
        // Tutorial remains accessible via Help icon -> "Watch Tutorial".
        const section = document.getElementById('gettingStartedSection');
        if (section) {
            section.classList.add('collapsed');
        }
        localStorage.setItem('sahabBudget_hideGettingStarted', 'true');

        // Also collapse the sample-data card for when user re-opens via Help.
        const sampleDataCard = document.querySelector('.sample-data-card');
        if (sampleDataCard) {
            sampleDataCard.style.display = 'none';
        }
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

    // Check if we need to temporarily show tutorial (from help modal navigation)
    const showGettingStarted = localStorage.getItem('sahabBudget_showGettingStarted') === 'true';
    const showTutorial = localStorage.getItem('sahabBudget_showTutorial') === 'true';
    const showFromHelp = showGettingStarted || showTutorial;

    // Clean up the navigation flags
    localStorage.removeItem('sahabBudget_showGettingStarted');
    localStorage.removeItem('sahabBudget_showTutorial');

    const section = document.getElementById('gettingStartedSection');

    if (showFromHelp && section) {
        // User explicitly requested to see tutorial from help modal - show it temporarily
        section.classList.remove('collapsed');

        // Scroll to video if that was the request
        if (showTutorial) {
            setTimeout(() => {
                const videoWrapper = document.getElementById('videoWrapper');
                if (videoWrapper) {
                    videoWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 500);
        }
    } else if (localStorage.getItem('sahabBudget_hideGettingStarted') === 'true') {
        // User previously chose to hide - keep it hidden
        if (section) {
            section.classList.add('collapsed');
        }
    }
});
