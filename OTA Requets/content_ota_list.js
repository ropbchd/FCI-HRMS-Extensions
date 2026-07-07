// FCI OTA Request Assistant - OTA List Page Script v1.1
// This script runs on the OTA Request Review Landing page.
// It automatically clicks the Review (retweet) button of the first row in the table.

(function () {

  const LOG = '[FCI OTA Assistant]';

  console.log(LOG + ' OTA list page detected. Looking for first row Review button...');

  function clickFirstReviewButton() {
    let firstRow = document.querySelector('table.data-table-main-in tbody tr:first-child');
    if (!firstRow) {
      firstRow = document.querySelector('table.dataTable tbody tr:first-child');
    }

    if (!firstRow) {
      console.warn(LOG + ' No rows found in the OTA Request table. Nothing to process.');
      return;
    }

    const allCells = firstRow.querySelectorAll('td');
    const requestId = allCells[1] ? allCells[1].textContent.trim() : 'Unknown';

    if (!requestId.toUpperCase().startsWith('CBO')) {
      console.warn(LOG + ' Request ID "' + requestId + '" does not start with CBO — this is not an OTA request. Extension will NOT activate.');
      return;
    }

    const firstCell = firstRow.querySelector('td');
    let reviewLink = firstCell ? firstCell.querySelector('a:first-child') : null;

    // Fallback: try to find by icon
    if (!reviewLink) {
      const retweetIcon = firstCell ? firstCell.querySelector('.fa-retweet') : null;
      if (retweetIcon) {
        reviewLink = retweetIcon.closest('a');
      }
    }

    if (!reviewLink) {
      console.warn(LOG + ' Review button not found in first row.');
      return;
    }

    console.log(LOG + ' Opening review for Request ID: ' + requestId);
    window.location.href = reviewLink.href;
  }

  // Wait for the table to load with retries
  let attempts = 0;
  const maxAttempts = 10;

  function tryClick() {
    attempts++;
    const table = document.querySelector('table.data-table-main-in tbody, table.dataTable tbody');
    if (table && table.querySelectorAll('tr').length > 0) {
      clickFirstReviewButton();
    } else if (attempts < maxAttempts) {
      console.log(LOG + ' Waiting for table to load... (attempt ' + attempts + '/' + maxAttempts + ')');
      setTimeout(tryClick, 1000);
    } else {
      console.warn(LOG + ' Table not found after ' + maxAttempts + ' attempts. Please refresh and try again.');
    }
  }

  // Start the process
  tryClick();

})();