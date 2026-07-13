// FCI Leave Encashment Assistant - List Page Script v1.1
// Runs on the Leave Encashment Approval/Reviewer Landing page.
// Reads Office and Encashment from the first row, stores them in sessionStorage,
// then clicks the square button to open the request detail page.

(function () {

  const LOG = '[FCI Leave Encashment Assistant]';

  console.log(LOG + ' Leave Encashment list page detected. Looking for first row...');

  function processFirstRow() {

    const firstRow = document.querySelector('#DataTables_Table_0 tbody tr:first-child');

    if (!firstRow) {
      console.warn(LOG + ' No rows found in the Leave Encashment table. Nothing to process.');
      return;
    }

    const allCells = firstRow.querySelectorAll('td');
    
    // Log all cells to debug column indices
    console.log(LOG + ' All cells in first row:');
    for (let i = 0; i < allCells.length; i++) {
      console.log(LOG + '  Cell ' + i + ': "' + allCells[i].textContent.trim() + '"');
    }

    // Column indices (based on screenshot):
    // 0: ACTION (square button + review button)
    // 1: REQUEST ID
    // 2: OFFICE (place of posting)
    // 3: DATE
    // 4: EMPLOYEE NUMBER
    // 5: EMPLOYEE NAME
    // 6: CATEGORY
    // 7: CADRE
    // 8: DIVISION
    // 9: LEAVE TYPE
    // 10: ENCASHMENT
    // 11: STATUS

    const requestId = allCells[1] ? allCells[1].textContent.trim() : 'Unknown';
    const office = allCells[2] ? allCells[2].textContent.trim() : '';
    const encashment = allCells[10] ? allCells[10].textContent.trim() : '';

    // SAFETY CHECK: Only process Leave Encashment requests (ID starts with CH)
    if (!requestId.toUpperCase().startsWith('CH')) {
      console.warn(LOG + ' Request ID "' + requestId + '" does not start with CH — this is not a Leave Encashment request. Extension will NOT activate.');
      return;
    }

    console.log(LOG + ' Request ID: ' + requestId);
    console.log(LOG + ' Office (place of posting): "' + office + '"');
    console.log(LOG + ' Encashment (No. of Leave to be Encashed): "' + encashment + '"');

    // Store values in sessionStorage
    sessionStorage.setItem('fci_leave_request_id', requestId);
    sessionStorage.setItem('fci_leave_office', office);
    sessionStorage.setItem('fci_leave_encashment', encashment);

    // Verify storage
    console.log(LOG + ' Stored in sessionStorage:');
    console.log(LOG + '  fci_leave_office: "' + sessionStorage.getItem('fci_leave_office') + '"');
    console.log(LOG + '  fci_leave_encashment: "' + sessionStorage.getItem('fci_leave_encashment') + '"');

    // Find the square button in the first cell (ACTION column)
    const firstCell = allCells[0];
    let squareButton = null;

    const allLinks = firstCell ? firstCell.querySelectorAll('a, button') : [];
    console.log(LOG + ' Found ' + allLinks.length + ' links/buttons in ACTION column');

    for (let el of allLinks) {
      const icon = el.querySelector('i');
      if (icon) {
        const iconClass = icon.className || '';
        console.log(LOG + '  Icon class: "' + iconClass + '"');
        if (iconClass.includes('fa-square') || 
            iconClass.includes('fa-th') || 
            iconClass.includes('fa-window-maximize') ||
            iconClass.includes('fa-chevron-right') ||
            iconClass.includes('fa-eye')) {
          squareButton = el;
          console.log(LOG + '  Found square button by icon');
          break;
        }
      }
      const title = el.getAttribute('title') || el.getAttribute('aria-label') || '';
      if (title.toLowerCase().includes('view') || 
          title.toLowerCase().includes('detail') ||
          title.toLowerCase().includes('open')) {
        squareButton = el;
        console.log(LOG + '  Found square button by title: "' + title + '"');
        break;
      }
    }

    // Fallback: if no square button found, try the second button in the cell
    if (!squareButton && allLinks.length >= 2) {
      squareButton = allLinks[1];
      console.log(LOG + '  Using fallback: second button in cell');
    }

    if (!squareButton) {
      console.warn(LOG + ' Square button not found in first row.');
      return;
    }

    console.log(LOG + ' Clicking square button to open request details for: ' + requestId);
    
    // Set flag so the detail page script knows this was triggered by the extension
    sessionStorage.setItem('fci_leave_detail_triggered', 'yes');
    
    // Use window.location.href instead of click() for more reliable navigation
    const href = squareButton.href || squareButton.getAttribute('href');
    if (href) {
      window.location.href = href;
    } else {
      squareButton.click();
    }

  }

  // Wait for the table to fully render, then process
  let attempts = 0;
  const maxAttempts = 10;

  function tryProcess() {
    attempts++;
    const table = document.querySelector('#DataTables_Table_0 tbody');
    if (table && table.querySelectorAll('tr').length > 0) {
      processFirstRow();
    } else if (attempts < maxAttempts) {
      console.log(LOG + ' Waiting for table to load... (attempt ' + attempts + '/' + maxAttempts + ')');
      setTimeout(tryProcess, 1000);
    } else {
      console.warn(LOG + ' Table not found after ' + maxAttempts + ' attempts. Please refresh and try again.');
    }
  }

  tryProcess();

})();