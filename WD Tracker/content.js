// HRMS Content Script: Direct DOM Scraper targeting .pending-request-tbl

console.log('HRMS Tracker: Content script loaded for MSS Dashboard.');

function isDashboardPage() {
  return window.location.pathname.toLowerCase().includes('/mss/dashboard');
}

function scrapeHRMSPanel() {
  const data = {};

  if (!isDashboardPage()) return data;

  // Direct, stable hook based on exact panel markup
  const rows = document.querySelectorAll('div[data-name="To-Do-List"] table.pending-request-tbl tbody tr');

  if (rows.length === 0) {
    // Fallback hook in case data-name attribute varies slightly
    const fallbackRows = document.querySelectorAll('table.pending-request-tbl tbody tr');
    if (fallbackRows.length > 0) {
      parseTableRows(fallbackRows, data);
    } else {
      console.warn('HRMS Tracker: pending-request-tbl table not found on page.');
    }
  } else {
    parseTableRows(rows, data);
  }

  return data;
}

function parseTableRows(rows, data) {
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 2) {
      // First td contains <a> with category name
      const categoryAnchor = cells[0].querySelector('a') || cells[0];
      const categoryName = categoryAnchor.innerText ? categoryAnchor.innerText.trim() : '';

      // Second td contains the pending count
      const countText = cells[1].innerText ? cells[1].innerText.trim() : '';
      const countNum = parseInt(countText, 10);

      if (categoryName && !isNaN(countNum)) {
        data[categoryName] = countNum;
      }
    }
  });
}

function injectFloatingButton() {
  if (document.getElementById('hrms-tracker-fab')) return;
  if (!isDashboardPage()) return;
  
  // Only inject if the To-Do-List panel is present
  if (!document.querySelector('table.pending-request-tbl')) return;

  const btn = document.createElement('div');
  btn.id = 'hrms-tracker-fab';
  btn.innerHTML = '📊 Capture Snapshot';
  btn.style.cssText = `
    position: fixed !important;
    bottom: 30px !important;
    right: 30px !important;
    z-index: 2147483647 !important;
    background-color: #1a73e8 !important;
    color: #ffffff !important;
    padding: 12px 20px !important;
    border-radius: 30px !important;
    cursor: pointer !important;
    font-family: Arial, sans-serif !important;
    font-size: 14px !important;
    font-weight: bold !important;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4) !important;
    display: block !important;
  `;
  
  btn.onmouseover = () => btn.style.backgroundColor = '#1557b0';
  btn.onmouseout = () => btn.style.backgroundColor = '#1a73e8';
  
  btn.onclick = () => {
    const categories = scrapeHRMSPanel();
    const catCount = Object.keys(categories).length;

    if (catCount === 0) {
      alert('HRMS Tracker: Could not extract categories. Please ensure the panel is loaded.');
      return;
    }
    
    btn.innerText = 'Sending...';
    chrome.runtime.sendMessage({ action: 'manualCapture', categories }, (response) => {
      if (chrome.runtime.lastError) {
        btn.innerText = '❌ Reload Page';
        setTimeout(() => btn.innerText = '📊 Capture Snapshot', 3000);
        alert('HRMS Tracker error: Please reload the browser tab.');
        return;
      }
      
      if (response && response.success) {
        btn.innerText = `✓ Captured (${catCount} items)`;
        setTimeout(() => btn.innerText = '📊 Capture Snapshot', 3000);
      } else {
        btn.innerText = '❌ Failed';
        setTimeout(() => btn.innerText = '📊 Capture Snapshot', 3000);
        alert('HRMS Tracker error: ' + (response?.error || 'Unknown error'));
      }
    });
  };
  
  (document.body || document.documentElement).appendChild(btn);
}

// Check every 1.5s to handle SPA rendering
setInterval(injectFloatingButton, 1500);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrape') {
    const categories = scrapeHRMSPanel();
    sendResponse({ categories });
  }
});