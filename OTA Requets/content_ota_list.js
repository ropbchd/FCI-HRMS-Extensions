// FCI OTA Request Assistant - OTA List Page Script
// This script runs on the OTA Request Review Landing page.
// It automatically clicks the Review (retweet) button of the first row in the table.
// After you handle that request and click OK, the page returns here and the
// extension automatically opens the next first row — creating a loop.

(function () {

  const LOG = '[FCI OTA Assistant]';

  console.log(LOG + ' OTA list page detected. Looking for first row Review button...');

  function clickFirstReviewButton() {

    // The table contains rows. Each row's first cell has two links:
    // first = Review (fa-retweet icon), second = View (fa-eye icon).
    // We want the FIRST link (Review) of the FIRST row only.

    // NOTE: The table ID must be confirmed by inspecting the listing page.
    // If the extension does not activate, inspect the page and update the
    // selector below (commonly '#otaTable' or similar DataTables ID).
    let firstRow = document.querySelector('table.data-table-main-in tbody tr:first-child');
    if (!firstRow) {
      firstRow = document.querySelector('table.dataTable tbody tr:first-child');
    }

    if (!firstRow) {
      console.warn(LOG + ' No rows found in the OTA Request table. Nothing to process.');
      return;
    }

    // Read the Request ID from the second cell for logging and safety check
    const allCells = firstRow.querySelectorAll('td');
    const requestId = allCells[1] ? allCells[1].textContent.trim() : 'Unknown';

    // SAFETY CHECK: Only process OTA requests (ID starts with CBO)
    if (!requestId.toUpperCase().startsWith('CBO')) {
      console.warn(LOG + ' Request ID "' + requestId + '" does not start with CBO — this is not an OTA request. Extension will NOT activate.');
      return;
    }

    // Get the first <a> tag in the first row's first cell — that is the Review button
    const firstCell = firstRow.querySelector('td');
    const reviewLink = firstCell ? firstCell.querySelector('a:first-child') : null;

    if (!reviewLink) {
      console.warn(LOG + ' Review button not found in first row.');
      return;
    }

    console.log(LOG + ' Opening review for Request ID: ' + requestId);

    // Navigate to the review page by following the href
    window.location.href = reviewLink.href;
  }

  // Wait 2 seconds for the table to fully render, then click
  setTimeout(clickFirstReviewButton, 2000);

})();
