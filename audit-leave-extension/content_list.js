// FCI Audit Leave Assistant - List Page Script v1.2
// Runs on: /lta/leave-audit/list
// Auto-changes to 100 entries, captures data, opens first actionable request

(function () {

  const LOG = '[FCI AL Assistant - List]';

  console.log(LOG + ' Script loaded on: ' + window.location.href);

  // ─── SAFETY CHECK ───────────────────────────────────────────────────────────

  function isAuditLeaveListing() {
    const url = window.location.href.toLowerCase();
    if (url.includes('leave-audit') && url.includes('list')) {
      return true;
    }

    const heading = document.querySelector('h1, h2, h3, .page-title, .heading, .panel-title');
    if (heading) {
      const text = heading.textContent.trim().toLowerCase();
      if (text.includes('leave audit') || text.includes('audit leave')) {
        return true;
      }
    }

    const bodyText = (document.body.innerText || '').toLowerCase();
    if (bodyText.includes('leave audit') && bodyText.includes('request id')) {
      return true;
    }

    return false;
  }

  if (!isAuditLeaveListing()) {
    console.log(LOG + ' Not an Audit Leave listing page. Skipping.');
    return;
  }

  console.log(LOG + ' Audit Leave listing page confirmed.');

  // ─── CLOSE ATTACHMENT TAB IF RETURNED FROM REVIEW ─────────────────────────

  const storedTabId = sessionStorage.getItem('ala_attachment_tab_id');
  if (storedTabId) {
    console.log(LOG + ' Closing attachment tab ID: ' + storedTabId);
    chrome.runtime.sendMessage({ action: 'closeTab', tabId: parseInt(storedTabId) }, function (response) {
      if (chrome.runtime.lastError) {
        console.warn(LOG + ' Could not close attachment tab: ' + chrome.runtime.lastError.message);
      } else {
        console.log(LOG + ' Attachment tab closed.');
      }
    });
    sessionStorage.removeItem('ala_attachment_tab_id');
  }

  // ─── STEP 1: CHANGE SHOW TO 100 ────────────────────────────────────────────

  function changeShowTo100() {
    const selectors = [
      'select[name="leave_audit_tbl_length"]',
      'select[name*="length"]',
      '.dataTables_length select',
      'select.form-control.input-sm'
    ];

    let showSelect = null;
    for (let sel of selectors) {
      showSelect = document.querySelector(sel);
      if (showSelect) break;
    }

    if (!showSelect) {
      console.warn(LOG + ' Show entries dropdown not found.');
      return false;
    }

    const currentValue = showSelect.value;
    if (currentValue === '100') {
      console.log(LOG + ' Already showing 100 entries.');
      return true;
    }

    const option100 = showSelect.querySelector('option[value="100"]');
    if (!option100) {
      console.warn(LOG + ' Option "100" not found in dropdown. Available: ' +
        Array.from(showSelect.options).map(function(o) { return o.value; }).join(', '));
      return false;
    }

    console.log(LOG + ' Changing Show from ' + currentValue + ' to 100...');
    showSelect.value = '100';
    showSelect.dispatchEvent(new Event('change', { bubbles: true }));

    // Also try jQuery trigger via script injection (for DataTables)
    const script = document.createElement('script');
    script.textContent = "(function() {" +
      "var el = document.querySelector(\"select[name='leave_audit_tbl_length'], .dataTables_length select\");" +
      "if (el && typeof $ !== 'undefined') {" +
        "$(el).trigger('change');" +
      "}" +
    "})();";
    document.head.appendChild(script);
    script.remove();

    return true;
  }

  // ─── STEP 2: SCAN ROWS AND FIND ACTIONABLE REQUESTS ──────────────────────

  function findActionableRequests() {
    const tableSelectors = [
      '#leave_audit_tbl',
      '#leaveAuditTable',
      '#auditLeaveTable',
      '.dataTable'
    ];

    let table = null;
    for (let sel of tableSelectors) {
      table = document.querySelector(sel);
      if (table) break;
    }

    if (!table) {
      console.warn(LOG + ' Table not found. Tried selectors: ' + tableSelectors.join(', '));
      return [];
    }

    const tbody = table.querySelector('tbody');
    if (!tbody) {
      console.warn(LOG + ' Table body not found.');
      return [];
    }

    const rows = tbody.querySelectorAll('tr');
    const actionable = [];

    console.log(LOG + ' Scanning ' + rows.length + ' rows...');

    for (let row of rows) {
      const cells = row.querySelectorAll('td');
      if (cells.length < 5) continue;

      const actionCell = cells[0];
      let eyeLink = actionCell ? actionCell.querySelector('a[href*="workflow/review"]') : null;

      if (!eyeLink) {
        const anyLink = actionCell ? actionCell.querySelector('a') : null;
        if (anyLink && anyLink.href && anyLink.href.includes('workflow/review')) {
          eyeLink = anyLink;
        } else {
          continue;
        }
      }

      const reviewLink = eyeLink.href;

      // Columns from screenshot: ACTION, REQUEST ID, LEAVE AUDIT STATUS, REQUEST DATE, YEAR, 
      // EMPLOYEE NUMBER, EMPLOYEE NAME, DESIGNATION, CATEGORY, CADRE, DIVISION, OFFICE
      const data = {
        requestId: cells[1] ? cells[1].textContent.trim() : '',
        status: cells[2] ? cells[2].textContent.trim() : '',
        requestDate: cells[3] ? cells[3].textContent.trim() : '',
        year: cells[4] ? cells[4].textContent.trim() : '',
        employeeNumber: cells[5] ? cells[5].textContent.trim() : '',
        employeeName: cells[6] ? cells[6].textContent.trim() : '',
        designation: cells[7] ? cells[7].textContent.trim() : '',
        category: cells[8] ? cells[8].textContent.trim() : '',
        cadre: cells[9] ? cells[9].textContent.trim() : '',
        division: cells[10] ? cells[10].textContent.trim() : '',
        office: cells[11] ? cells[11].textContent.trim() : '',
        reviewLink: reviewLink
      };

      const statusLower = data.status.toLowerCase();
      if (statusLower.includes('approved') || statusLower.includes('completed') || statusLower.includes('closed')) {
        console.log(LOG + ' Skipping completed request: ' + data.requestId);
        continue;
      }

      console.log(LOG + ' Found actionable: ' + data.employeeName + ' (' + data.requestId + ')');
      actionable.push(data);
    }

    return actionable;
  }

  // ─── STEP 3: STORE DATA AND OPEN FIRST REQUEST ───────────────────────────

  function processFirstRequest(actionable) {
    if (actionable.length === 0) {
      console.log(LOG + ' No actionable requests found.');
      return;
    }

    const first = actionable[0];
    console.log(LOG + ' Processing: ' + first.employeeName + ' (' + first.requestId + ')');

    sessionStorage.setItem('ala_emp_name', first.employeeName);
    sessionStorage.setItem('ala_emp_number', first.employeeNumber);
    sessionStorage.setItem('ala_designation', first.designation);
    sessionStorage.setItem('ala_category', first.category);
    sessionStorage.setItem('ala_cadre', first.cadre);
    sessionStorage.setItem('ala_office', first.office);
    sessionStorage.setItem('ala_division', first.division);
    sessionStorage.setItem('ala_request_id', first.requestId);
    sessionStorage.setItem('ala_review_url', first.reviewLink);

    console.log(LOG + ' Stored name: ' + sessionStorage.getItem('ala_emp_name'));
    console.log(LOG + ' Stored cadre: ' + sessionStorage.getItem('ala_cadre'));
    console.log(LOG + ' Stored office: ' + sessionStorage.getItem('ala_office'));

    console.log(LOG + ' Navigating to: ' + first.reviewLink);
    window.location.href = first.reviewLink;
  }

  // ─── MAIN SEQUENCE ─────────────────────────────────────────────────────────

  function startAutomation() {
    const changed = changeShowTo100();

    const waitTime = changed ? 3000 : 1500;
    setTimeout(function () {
      const actionable = findActionableRequests();
      console.log(LOG + ' Found ' + actionable.length + ' actionable requests.');
      processFirstRequest(actionable);
    }, waitTime);
  }

  setTimeout(startAutomation, 2000);

})();