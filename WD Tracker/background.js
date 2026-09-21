// HRMS Tracker: Background Service Worker (Hourly Alarm & Manual Trigger Only)

const ALARM_NAME = 'hrmsHourlyScrape';
const TARGET_URL_KEYWORD = 'hrmsfci.in/mss/dashboard';

// IMPORTANT: verify this is your CURRENT deployed Web App URL (Apps Script editor ->
// Deploy -> Manage deployments -> copy the "Web app" URL). This is the URL that was
// confirmed working before — if you redeployed as a NEW deployment (not a new version
// of the same one) since then, replace this with the fresh URL instead.
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxFS2uJ4eEpQ7B_GCcKIz9jWIBScefasxyGVYIYlTmIm5PbTSZ0EFeVw4DdreVkQqKD8w/exec';
const SHARED_SECRET = 'HRMS_SECRET_2026_XYZ';
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1i577TIu7q44f5WAaEqPu1Ltj_KtHI3IW8nwSGbGIrEs/edit?gid=0#gid=0';
const SHEET_ID_FOR_MATCH = '1i577TIu7q44f5WAaEqPu1Ltj_KtHI3IW8nwSGbGIrEs';

// 1. Initialize Hourly Alarm on Extension Startup / Install
chrome.runtime.onInstalled.addListener(() => {
  console.log('HRMS Tracker: Extension installed. Setting up hourly alarm...');
  setupHourlyAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('HRMS Tracker: Extension started. Ensuring alarm active...');
  setupHourlyAlarm();
});

function setupHourlyAlarm() {
  chrome.alarms.get(ALARM_NAME, (existingAlarm) => {
    if (!existingAlarm) {
      chrome.alarms.create(ALARM_NAME, {
        periodInMinutes: 60
      });
      console.log('HRMS Tracker: Hourly alarm created (fires every 60 mins).');
    }
  });
}

// 2. Alarm Trigger Handler (Fires once every 60 minutes) — the ONLY automatic trigger
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    console.log('HRMS Tracker: Hourly alarm fired. Searching for active HRMS tab...');
    findAndScrapeHRMSTab();
  }
});

function findAndScrapeHRMSTab() {
  chrome.tabs.query({}, (tabs) => {
    const hrmsTab = tabs.find(tab => tab.url && tab.url.toLowerCase().includes(TARGET_URL_KEYWORD));

    if (hrmsTab) {
      console.log(`HRMS Tracker: Found active dashboard tab (ID: ${hrmsTab.id}). Reloading before scrape...`);
      reloadThenScrape(hrmsTab.id);
    } else {
      console.log('HRMS Tracker: No active HRMS dashboard tab open. Skipping hourly scrape.');
    }
  });
}

// Reloads the dashboard tab first (hourly path only) so the hourly capture reflects
// live data rather than an hour-stale in-memory page, then scrapes once loading settles.
function reloadThenScrape(tabId) {
  let settled = false;

  const onUpdatedListener = (updatedTabId, changeInfo) => {
    if (updatedTabId !== tabId || changeInfo.status !== 'complete') return;
    if (settled) return;
    settled = true;
    chrome.tabs.onUpdated.removeListener(onUpdatedListener);

    // Extra buffer: Kendo's AJAX-driven grid can still be populating after the
    // browser reports the page load as 'complete'.
    setTimeout(() => {
      performScrapeAndPost(tabId);
    }, 3000);
  };

  chrome.tabs.onUpdated.addListener(onUpdatedListener);

  // Safety net: if 'complete' never fires (e.g. tab closed mid-reload), don't leak the listener forever.
  setTimeout(() => {
    if (!settled) {
      settled = true;
      chrome.tabs.onUpdated.removeListener(onUpdatedListener);
      console.warn('HRMS Tracker: Reload did not complete within timeout; skipping this hourly capture.');
    }
  }, 15000);

  chrome.tabs.reload(tabId);
}

function performScrapeAndPost(tabId) {
  chrome.tabs.sendMessage(tabId, { action: 'scrape' }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('HRMS Tracker: Could not contact content script:', chrome.runtime.lastError.message);
      return;
    }

    if (response && response.categories && Object.keys(response.categories).length > 0) {
      sendToAppsScript(response.categories).catch(err => console.error('HRMS Tracker Post Error:', err));
    } else {
      console.warn('HRMS Tracker: Received empty category data from content script.');
    }
  });
}

// 3. Manual Button Click Listener (From FAB in content.js) — always fires immediately, no gating
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'manualCapture') {
    console.log('HRMS Tracker: Manual capture requested.');

    sendToAppsScript(request.categories)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.toString() }));

    return true; // Keep channel open for async response
  }
});

// 4. Send Scraped Data to Google Apps Script Web App
async function sendToAppsScript(categories) {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('YOUR_') ) {
    throw new Error('Apps Script Web App URL is not configured in background.js');
  }

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const payload = {
    token: SHARED_SECRET,
    date: dateStr,
    timestamp: now.toISOString(),
    categories: categories
  };

  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Apps Script returned failure.');
  }

  ensureSheetTabOpen();
  return result;
}

// 5. Open the tracker Sheet in the background if it isn't already open (once per session, effectively)
function ensureSheetTabOpen() {
  chrome.tabs.query({ url: `*://docs.google.com/spreadsheets/d/${SHEET_ID_FOR_MATCH}/*` }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      chrome.tabs.create({ url: SHEET_URL, active: false });
    }
  });
}
