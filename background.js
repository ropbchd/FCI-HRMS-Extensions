// FCI Employee Profile Update Assistant - Background Service Worker
// Handles tab management messages from content scripts.

let lastOpenedTabId = null;

// Track newly created tabs
chrome.tabs.onCreated.addListener(function (tab) {
  lastOpenedTabId = tab.id;
});

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {

  if (message.action === 'getLastTabId') {
    // Return the most recently opened tab (the attachment)
    sendResponse({ tabId: lastOpenedTabId });
    return true;
  }

  if (message.action === 'closeTab') {
    const tabId = message.tabId;
    if (tabId) {
      chrome.tabs.remove(tabId, function () {
        if (chrome.runtime.lastError) {
          console.warn('[FCI EPU BG] Could not close tab ' + tabId + ': ' + chrome.runtime.lastError.message);
          sendResponse({ success: false });
        } else {
          console.log('[FCI EPU BG] Tab ' + tabId + ' closed.');
          sendResponse({ success: true });
        }
      });
    } else {
      sendResponse({ success: false });
    }
    return true; // keep message channel open for async response
  }

});
