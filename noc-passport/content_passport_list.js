// FCI NOC Passport Assistant - Passport List Page Script
// This script runs on the NOC Passport list page.
// It automatically clicks the Review button of the first row in the table.
// After you handle that request and click OK, the page returns here and the
// extension automatically opens the next first row — creating a loop.

(function () {

  console.log('[FCI NOC Passport Assistant] NOC Passport list page detected. Looking for first row Review button...');

  function clickFirstReviewButton() {

    // The table tbody contains rows. Each row's first cell (td.sorting_1)
    // has two links: first = Review (fa-retweet icon), second = View (fa-eye icon).
    // We want the FIRST link (Review) of the FIRST row only.

    // NOTE: The table ID for NOC Passport must be confirmed by inspecting the listing page.
    // If the extension does not activate, inspect the page and update '#passportTable' below.
    const firstRow = document.querySelector('#passportTable tbody tr:first-child');

    if (!firstRow) {
      console.warn('[FCI NOC Passport Assistant] No rows found in the NOC Passport table. Nothing to process.');
      return;
    }

    // Read the Request ID from the second cell for logging and safety check
    const allCells = firstRow.querySelectorAll('td');
    const requestId = allCells[1] ? allCells[1].textContent.trim() : 'Unknown';

    // SAFETY CHECK: Only process NOC Passport requests (ID starts with NOCPASS)
    if (!requestId.toUpperCase().startsWith('NOCPASS')) {
      console.warn('[FCI NOC Passport Assistant] Request ID "' + requestId + '" does not start with NOCPASS — this is not a NOC Passport request. Extension will NOT activate.');
      return;
    }

    // Get the first <a> tag in the first row's first cell — that is the Review button
    const firstCell = firstRow.querySelector('td.sorting_1');
    const reviewLink = firstCell ? firstCell.querySelector('a:first-child') : null;

    if (!reviewLink) {
      console.warn('[FCI NOC Passport Assistant] Review button not found in first row.');
      return;
    }

    console.log('[FCI NOC Passport Assistant] Opening review for Request ID: ' + requestId);

    // Navigate to the review page by following the href
    window.location.href = reviewLink.href;
  }

  // Wait 2 seconds for the table to fully render, then click
  setTimeout(clickFirstReviewButton, 2000);

})();
