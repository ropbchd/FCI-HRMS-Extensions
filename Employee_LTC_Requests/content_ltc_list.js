// FCI LTC Assistant - LTC List Page Script v1.1
// Runs on the LTC Bharat Darshan/Home Town/Encashment listing page.
// Auto-clicks the first row's Review button.

(function () {

  const LOG = '[FCI LTC Assistant]';
  const PREFIX = 'LBD';

  console.log(LOG + ' LTC list page detected. Looking for first row Review button...');

  function clickFirstReviewButton() {
    // Try common DataTable selectors. The exact ID may vary.
    let firstRow = document.querySelector('#ltcTable tbody tr:first-child');
    if (!firstRow) {
      firstRow = document.querySelector('table.data-table-main-in tbody tr:first-child');
    }
    if (!firstRow) {
      firstRow = document.querySelector('table.dataTable tbody tr:first-child');
    }
    if (!firstRow) {
      // Fallback: any table tbody first row
      const tables = document.querySelectorAll('table');
      for (let table of tables) {
        const tbody = table.querySelector('tbody');
        if (tbody) {
          const row = tbody.querySelector('tr:first-child');
          if (row) { firstRow = row; break; }
        }
      }
    }

    if (!firstRow) {
      console.warn(LOG + ' No rows found in any table. Nothing to process.');
      return;
    }

    // Read the Request ID from the second cell for logging and safety check
    const allCells = firstRow.querySelectorAll('td');
    const requestId = allCells[1] ? allCells[1].textContent.trim() : 'Unknown';

    // SAFETY CHECK: Only process LTC requests (ID starts with LBD)
    if (!requestId.toUpperCase().startsWith(PREFIX)) {
      console.warn(LOG + ' Request ID "' + requestId + '" does not start with ' + PREFIX + ' — this is not an LTC request. Extension will NOT activate.');
      return;
    }

    // Improvement C: Find the review link by href pattern, not by position
    // The review link contains /workflow/review/ in its href
    const allLinks = firstRow.querySelectorAll('a');
    let reviewLink = null;
    for (let link of allLinks) {
      const href = link.href || '';
      if (href.includes('/workflow/review/')) {
        reviewLink = link;
        break;
      }
    }

    // Fallback: if no href match, try the second link (first is usually View, second is Review)
    if (!reviewLink && allLinks.length >= 2) {
      reviewLink = allLinks[1];
    }
    // Final fallback: first link
    if (!reviewLink && allLinks.length >= 1) {
      reviewLink = allLinks[0];
    }

    if (!reviewLink) {
      console.warn(LOG + ' Review button not found in first row.');
      return;
    }

    console.log(LOG + ' Opening review for Request ID: ' + requestId + ' via ' + reviewLink.href);

    // Navigate to the review page by following the href
    window.location.href = reviewLink.href;
  }

  // Wait 2 seconds for the table to fully render, then click
  setTimeout(clickFirstReviewButton, 2000);

})();