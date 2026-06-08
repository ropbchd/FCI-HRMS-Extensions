// FCI Higher Studies Distance Assistant - List Page Script
// Runs on the Higher Studies listing page.
// Closes the attachment tab (if one was opened) when we return here after disposal.

(function () {

  const LOG = '[FCI HS Assistant]';

  console.log(LOG + ' Listing page detected.');

  // If an attachment tab ID was stored, close it now
  const storedTabId = sessionStorage.getItem('hs_attachment_tab_id');
  if (storedTabId) {
    console.log(LOG + ' Closing attachment tab ID: ' + storedTabId);
    chrome.runtime.sendMessage({ action: 'closeTab', tabId: parseInt(storedTabId) }, function (response) {
      if (chrome.runtime.lastError) {
        console.warn(LOG + ' Could not close attachment tab: ' + chrome.runtime.lastError.message);
      } else {
        console.log(LOG + ' Attachment tab closed.');
      }
    });
    sessionStorage.removeItem('hs_attachment_tab_id');
  }

})();