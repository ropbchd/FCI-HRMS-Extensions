// FCI Audit Leave Assistant - Background Service Worker v1.0

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {

  // Open a URL in a background tab (active: false = no focus steal)
  if (message.action === 'openTabInBackground') {
    chrome.tabs.create({ url: message.url, active: false }, function (tab) {
      if (chrome.runtime.lastError) {
        console.warn('[FCI AL BG] Could not open tab: ' + chrome.runtime.lastError.message);
        sendResponse({ tabId: null });
      } else {
        console.log('[FCI AL BG] Opened background tab ID: ' + tab.id);
        sendResponse({ tabId: tab.id });
      }
    });
    return true; // keep channel open for async response
  }

  // Close a tab by ID
  if (message.action === 'closeTab') {
    chrome.tabs.remove(message.tabId, function () {
      if (chrome.runtime.lastError) {
        console.warn('[FCI AL BG] Could not close tab ' + message.tabId + ': ' + chrome.runtime.lastError.message);
        sendResponse({ success: false });
      } else {
        console.log('[FCI AL BG] Closed tab ' + message.tabId);
        sendResponse({ success: true });
      }
    });
    return true;
  }

});