// FCI Leave Encashment Assistant - Action History Page Script v1.0
// Runs on the Action History page (/workflow/action-history/*).
// Detects Stage 1 (Dispatched by MAYURESH KUMAR -> Pending Review AMIT KUMAR SINGH, N/A)
// and automatically clicks the "Add Reviewer" button.

(function () {

  const LOG = '[FCI Leave Encashment Assistant]';

  // SAFETY CHECK: Only activate for Leave Encashment requests (Request ID starts with CH)
  function getRequestId() {
    const bodyText = document.body.innerText || '';
    const match = bodyText.match(/\bCH\d+\b/i);
    return match ? match[0].toUpperCase() : null;
  }

  const requestId = getRequestId();
  if (!requestId || !requestId.startsWith('CH')) {
    console.log(LOG + ' Request ID not found or does not start with CH ("' + (requestId || 'none') + '"). Extension will NOT activate on this Action History page.');
    return;
  }

  console.log(LOG + ' Action History page detected for: ' + requestId);

  // --- CONFIGURATION ---
  const DISPATCHER_NAME = 'MAYURESH KUMAR';
  const NEXT_NAME       = 'AMIT KUMAR SINGH';
  const NEXT_ACTION     = 'Pending Review';
  const NEXT_REMARK     = 'N/A';

  // --- Helper: Parse action history table ---
  function parseActionHistory() {
    // Look for the action history table
    const tables = document.querySelectorAll('table');
    let targetTable = null;

    for (let table of tables) {
      const headers = table.querySelectorAll('th');
      let hasActionTaken = false;
      let hasEmployeeName = false;
      let hasRemarks = false;

      for (let th of headers) {
        const text = th.textContent.trim().toUpperCase();
        if (text.includes('ACTION TAKEN') || text.includes('STATUS')) hasActionTaken = true;
        if (text.includes('EMPLOYEE NAME')) hasEmployeeName = true;
        if (text.includes('REMARKS')) hasRemarks = true;
      }

      if (hasActionTaken && hasEmployeeName) {
        targetTable = table;
        break;
      }
    }

    if (!targetTable) {
      console.warn(LOG + ' Action history table not found.');
      return null;
    }

    const rows = targetTable.querySelectorAll('tbody tr');
    const entries = [];

    for (let row of rows) {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 5) {
        // Try to find which column is which
        const headers = targetTable.querySelectorAll('th');
        let actionIdx = -1;
        let nameIdx = -1;
        let remarkIdx = -1;

        for (let i = 0; i < headers.length; i++) {
          const text = headers[i].textContent.trim().toUpperCase();
          if (text.includes('ACTION TAKEN') || text.includes('STATUS')) actionIdx = i;
          if (text.includes('EMPLOYEE NAME')) nameIdx = i;
          if (text.includes('REMARKS')) remarkIdx = i;
        }

        if (actionIdx !== -1 && nameIdx !== -1) {
          const action = actionIdx < cells.length ? cells[actionIdx].textContent.trim() : '';
          const name = nameIdx < cells.length ? cells[nameIdx].textContent.trim() : '';
          const remark = remarkIdx !== -1 && remarkIdx < cells.length ? cells[remarkIdx].textContent.trim() : '';

          entries.push({
            actionTaken: action,
            employeeName: name,
            remark: remark
          });
        }
      }
    }

    return entries;
  }

  // --- Check for Stage 1 ---
  function checkStage1(entries) {
    if (!entries || entries.length < 2) return false;

    let lastDispatchedIndex = -1;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].actionTaken === 'Dispatched') {
        lastDispatchedIndex = i;
      }
    }

    if (lastDispatchedIndex === -1) return false;

    const lastDispatched = entries[lastDispatchedIndex];
    const afterDispatched = lastDispatchedIndex + 1 < entries.length ? entries[lastDispatchedIndex + 1] : null;

    const isMatch = lastDispatched
      && lastDispatched.employeeName.toUpperCase().includes(DISPATCHER_NAME)
      && afterDispatched
      && afterDispatched.employeeName.toUpperCase().includes(NEXT_NAME)
      && afterDispatched.actionTaken.trim() === NEXT_ACTION
      && afterDispatched.remark.trim() === NEXT_REMARK;

    console.log(LOG + ' Stage 1 (Send to Assistant): ' + (isMatch ? 'MATCH' : 'no match'));
    return isMatch;
  }

  // --- Click Add Reviewer button ---
  function clickAddReviewer() {
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

    if (!addReviewerBtn) {
      // Try by class or id
      addReviewerBtn = document.querySelector('.btn-add-reviewer, #add-reviewer, .add-reviewer');
    }

    if (addReviewerBtn) {
      console.log(LOG + ' Found "Add Reviewer" button. Clicking automatically...');
      
      // Get the employee number and office from sessionStorage
      const empNumber = sessionStorage.getItem('fci_leave_assistant_emp') || '';
      const office = sessionStorage.getItem('fci_leave_office') || '';
      const remark = sessionStorage.getItem('fci_leave_assistant_remark') || 'Kindly check the eligibility of the request and verify the details.';
      
      // Set flag for the Add Reviewer page
      sessionStorage.setItem('fci_leave_triggered', 'yes');
      sessionStorage.setItem('fci_leave_stage', '1');
      sessionStorage.setItem('fci_leave_office_type', '4'); // RO
      sessionStorage.setItem('fci_leave_assistant_emp', empNumber);
      sessionStorage.setItem('fci_leave_assistant_remark', remark);
      
      addReviewerBtn.click();
    } else {
      console.warn(LOG + ' "Add Reviewer" button not found.');
    }
  }

  // --- Read Cadre from the detail page (stored in sessionStorage or from page) ---
  function getCadre() {
    // Try to find Cadre on the page
    const bodyText = document.body.innerText || '';
    const lines = bodyText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().toLowerCase() === 'cadre') {
        if (i + 1 < lines.length) {
          const value = lines[i + 1].trim();
          if (value) return value;
        }
      }
    }
    return sessionStorage.getItem('fci_leave_cadre') || '';
  }

  // --- Determine assistant based on Cadre and Office ---
  function decideAssistant(cadre, office) {
    const ASSISTANT_GENERAL = { name: 'MADHU DHAKA', empNo: '313284' };
    const ASSISTANT_DIVYA   = { name: 'DIVYA KORNU', empNo: '315172' };
    const ASSISTANT_VISHALI = { name: 'VISHALI MARWAHA', empNo: '308235' };

    const DIVYA_OFFICES = [
      'RO CHANDIGARH', 'DO PATIALA', 'DO LUDHIANA', 'DO JALANDHAR',
      'DO FARIDKOT', 'DO HOSHIARPUR', 'DO AMRITSAR'
    ];
    const VISHALI_OFFICES = [
      'DO KAPURTHALA', 'DO FEROZEPUR', 'DO CHANDIGARH', 'DO BHATINDA',
      'DO MOGA', 'DO GURDASPUR', 'DO SANGRUR'
    ];

    const cadreValue  = cadre.trim().replace(/\s+/g, ' ').toUpperCase();
    const officeValue = office.trim().replace(/\s+/g, ' ').toUpperCase();

    console.log(LOG + ' Cadre: "' + cadreValue + '" | Office: "' + officeValue + '"');

    if (cadreValue === 'GENERAL') {
      return ASSISTANT_GENERAL;
    } else if (cadreValue === 'DEPOT') {
      if (DIVYA_OFFICES.map(o => o.trim().replace(/\s+/g, ' ').toUpperCase()).includes(officeValue)) {
        return ASSISTANT_DIVYA;
      } else if (VISHALI_OFFICES.map(o => o.trim().replace(/\s+/g, ' ').toUpperCase()).includes(officeValue)) {
        return ASSISTANT_VISHALI;
      } else {
        console.warn(LOG + ' Cadre is Depot but Office "' + officeValue + '" is not in any known group.');
        return null;
      }
    } else {
      console.warn(LOG + ' Unrecognised Cadre: "' + cadreValue + '"');
      return null;
    }
  }

  // --- Main execution ---
  function processActionHistory() {
    const entries = parseActionHistory();
    if (!entries) {
      console.warn(LOG + ' Could not parse action history.');
      return;
    }

    console.log(LOG + ' Parsed ' + entries.length + ' entries from action history.');

    if (checkStage1(entries)) {
      // Read Cadre from page
      const cadre = getCadre();
      console.log(LOG + ' Cadre from page: "' + cadre + '"');
      
      // Read Office from sessionStorage (set by listing page)
      const office = sessionStorage.getItem('fci_leave_office') || '';
      console.log(LOG + ' Office from sessionStorage: "' + office + '"');

      // Store Cadre in sessionStorage for later use
      sessionStorage.setItem('fci_leave_cadre', cadre);

      // Determine which assistant to route to
      const assistant = decideAssistant(cadre, office);
      if (assistant) {
        console.log(LOG + ' Routing to: ' + assistant.name + ' (' + assistant.empNo + ')');
        sessionStorage.setItem('fci_leave_assistant_emp', assistant.empNo);
        sessionStorage.setItem('fci_leave_assistant_name', assistant.name);
        sessionStorage.setItem('fci_leave_assistant_remark', 'Kindly check the eligibility of the request and verify the details.');
        
        // Click Add Reviewer after a short delay
        setTimeout(clickAddReviewer, 1500);
      } else {
        console.warn(LOG + ' Could not determine assistant. No action taken.');
      }
    } else {
      console.log(LOG + ' Stage 1 not matched. No action taken.');
    }
  }

  // Wait for the page to fully load, then process
  setTimeout(processActionHistory, 2000);

})();