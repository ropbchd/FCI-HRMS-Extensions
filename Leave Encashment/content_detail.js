// FCI Leave Encashment Assistant - Request Detail Page Script v1.1
// Runs on the request detail page (opened by clicking the square button).
// Reads Cadre from the detail page and stores it in sessionStorage,
// then automatically clicks the "View Action History" button.

(function () {

  const LOG = '[FCI Leave Encashment Assistant]';

  // Check if this navigation was triggered by the extension
  const triggered = sessionStorage.getItem('fci_leave_detail_triggered');
  if (triggered !== 'yes') {
    console.log(LOG + ' Detail page opened manually — extension will NOT auto-click.');
    return;
  }

  // Clear the flag immediately
  sessionStorage.removeItem('fci_leave_detail_triggered');

  // SAFETY CHECK: Only activate for Leave Encashment requests
  function getRequestId() {
    const bodyText = document.body.innerText || '';
    const match = bodyText.match(/\bCH\d+\b/i);
    return match ? match[0].toUpperCase() : null;
  }

  const requestId = getRequestId();
  if (!requestId || !requestId.startsWith('CH')) {
    console.log(LOG + ' Request ID not found or does not start with CH ("' + (requestId || 'none') + '"). Extension will NOT activate on this detail page.');
    return;
  }

  console.log(LOG + ' Request detail page detected for: ' + requestId);

  // --- Read Cadre from the detail page ---
  function getCadreFromPage() {
    const bodyText = document.body.innerText || '';
    const lines = bodyText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().toLowerCase() === 'cadre') {
        if (i + 1 < lines.length) {
          const value = lines[i + 1].trim();
          if (value) {
            console.log(LOG + ' Cadre read from detail page: "' + value + '"');
            return value;
          }
        }
      }
    }
    return '';
  }

  const cadre = getCadreFromPage();
  if (cadre) {
    sessionStorage.setItem('fci_leave_cadre', cadre);
    console.log(LOG + ' Cadre stored in sessionStorage: "' + cadre + '"');
  }

  // --- Look for and click "View Action History" button ---
  function clickViewActionHistory(attempts) {
    attempts = attempts || 0;

    let viewActionBtn = null;
    const allElements = document.querySelectorAll('a, button, input[type="button"]');
    
    for (let el of allElements) {
      const text = el.textContent ? el.textContent.trim() : '';
      const value = el.value ? el.value.trim() : '';
      if (text === 'View Action History' || value === 'View Action History') {
        viewActionBtn = el;
        break;
      }
    }

    // Also try by class or id
    if (!viewActionBtn) {
      viewActionBtn = document.querySelector('.view-action-history, #view-action-history');
    }

    if (viewActionBtn) {
      console.log(LOG + ' Found "View Action History" button. Clicking automatically...');
      viewActionBtn.click();
    } else if (attempts < 20) {
      console.log(LOG + ' Waiting for "View Action History" button... (attempt ' + (attempts + 1) + '/20)');
      setTimeout(function() { clickViewActionHistory(attempts + 1); }, 500);
    } else {
      console.warn(LOG + ' "View Action History" button not found after 20 attempts.');
    }
  }

  // Wait a moment for the page to fully load, then click View Action History
  setTimeout(function() {
    clickViewActionHistory();
  }, 2000);

})();