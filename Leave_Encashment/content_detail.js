// FCI Leave Encashment Assistant - Request Detail Page Script v1.0
// Runs on the request detail page (opened by clicking the square button).
// Automatically clicks the "Add Reviewer" button to navigate to the Add Reviewer page.

(function () {

  const LOG = '[FCI Leave Encashment Assistant]';

  // Check if this navigation was triggered by the extension
  const triggered = sessionStorage.getItem('fci_leave_detail_triggered');
  if (triggered !== 'yes') {
    console.log(LOG + ' Detail page opened manually — extension will NOT auto-click Add Reviewer.');
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

  // Look for the "Add Reviewer" button
  function clickAddReviewerButton(attempts) {
    attempts = attempts || 0;

    let addReviewerBtn = null;
    const allElements = document.querySelectorAll('a, button, input[type="button"]');
    
    for (let el of allElements) {
      const text = el.textContent ? el.textContent.trim() : '';
      const value = el.value ? el.value.trim() : '';
      if (text === 'Add Reviewer' || value === 'Add Reviewer') {
        addReviewerBtn = el;
        break;
      }
    }

    // Also try by class or id
    if (!addReviewerBtn) {
      addReviewerBtn = document.querySelector('.btn-add-reviewer, #add-reviewer, .add-reviewer');
    }

    if (addReviewerBtn) {
      console.log(LOG + ' Found "Add Reviewer" button. Clicking automatically...');
      
      // Set flag for the Add Reviewer page
      sessionStorage.setItem('fci_leave_triggered', 'yes');
      
      addReviewerBtn.click();
    } else if (attempts < 20) {
      console.log(LOG + ' Waiting for "Add Reviewer" button... (attempt ' + (attempts + 1) + '/20)');
      setTimeout(function() { clickAddReviewerButton(attempts + 1); }, 500);
    } else {
      console.warn(LOG + ' "Add Reviewer" button not found after 20 attempts.');
    }
  }

  // Wait a moment for the page to fully load, then look for the button
  setTimeout(function() {
    clickAddReviewerButton();
  }, 2000);

})();