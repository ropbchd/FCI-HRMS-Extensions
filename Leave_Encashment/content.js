// FCI Leave Encashment Assistant - Content Script v1.4
// Runs on the Leave Encashment review page.
// Detects the stage and either routes to assistant or fills final approval remark.

(function () {

  // --- CONFIGURATION ---

  // STAGE 1 trigger: Last Dispatched = MAYURESH KUMAR, next = AMIT KUMAR SINGH (Pending Review, N/A)
  const STAGE1_DISPATCHER_NAME  = 'MAYURESH KUMAR';
  const STAGE1_NEXT_NAME        = 'AMIT KUMAR SINGH';
  const STAGE1_NEXT_ACTION      = 'Pending Review';
  const STAGE1_NEXT_REMARK      = 'N/A';

  // STAGE 2 trigger: Last Reviewed = Assistant, next = AMIT KUMAR SINGH (Pending Review, N/A)
  const STAGE2_NEXT_NAME        = 'AMIT KUMAR SINGH';
  const STAGE2_NEXT_ACTION      = 'Pending Review';
  const STAGE2_NEXT_REMARK      = 'N/A';

  const ASSISTANT_GENERAL = { name: 'MADHU DHAKA',     empNo: '313284' };
  const ASSISTANT_DIVYA   = { name: 'DIVYA KORNU',     empNo: '315172' };
  const ASSISTANT_VISHALI = { name: 'VISHALI MARWAHA', empNo: '308235' };

  const DIVYA_OFFICES = [
    'RO CHANDIGARH', 'DO PATIALA', 'DO LUDHIANA', 'DO JALANDHAR',
    'DO FARIDKOT', 'DO HOSHIARPUR', 'DO AMRITSAR'
  ];
  const VISHALI_OFFICES = [
    'DO KAPURTHALA', 'DO FEROZEPUR', 'DO CHANDIGARH', 'DO BHATINDA',
    'DO MOGA', 'DO GURDASPUR', 'DO SANGRUR'
  ];

  const STAGE1_REMARK = 'Kindly check the eligibility of the request and verify the details.';

  // Office Type values on the Add Reviewer page
  const OFFICE_TYPE_RO = '4';

  // --- Google Sheets register write-back ---
  const LEAVE_SHEET_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxA_1KrovubuQofFquTnBxS0Lz9o_I5lj9pVYlmjLbMqzCvZqmkQ4SA_gmTqvPpljOj/exec';

  // ----------------------

  // Helper: Convert ALL-CAPS name to Proper Case (e.g., "RISHIKESH MISHRA" → "Rishikesh Mishra")
  function toProperCase(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .split(' ')
      .map(function(word) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  }

  // Helper: Read a specific field value from the page by its label text
  function getFieldValue(labelText) {
    const bodyText = document.body.innerText || '';
    const lines = bodyText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().toLowerCase() === labelText.toLowerCase()) {
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const value = lines[j].trim();
          if (value && value.toLowerCase() !== labelText.toLowerCase()) {
            return value;
          }
        }
      }
    }
    return '';
  }

  // Helper: Read field value by label's "for" attribute
  function getFieldValueByFor(forAttribute) {
    const listItems = document.querySelectorAll('li');
    for (let li of listItems) {
      const label = li.querySelector('label');
      const span  = li.querySelector('span');
      if (!label || !span) continue;
      if (label.getAttribute('for') === forAttribute) {
        return span.textContent.trim();
      }
    }
    return '';
  }

  // Helper: Read Cadre from the page
  function getCadre() {
    return getFieldValueByFor('cadre') || getFieldValue('Cadre');
  }

  // Helper: Read Office from the Competent Authority section on the review page (fallback)
  function getOfficeFromReviewPage() {
    const tables = document.querySelectorAll('table');
    for (let table of tables) {
      const headers = table.querySelectorAll('th');
      let officeIndex = -1;
      for (let i = 0; i < headers.length; i++) {
        if (headers[i].textContent.trim().toUpperCase() === 'OFFICE') {
          officeIndex = i;
          break;
        }
      }
      if (officeIndex !== -1) {
        const rows = table.querySelectorAll('tbody tr');
        for (let row of rows) {
          const cells = row.querySelectorAll('td');
          if (cells.length > officeIndex) {
            const office = cells[officeIndex].textContent.trim();
            if (office) {
              return office;
            }
          }
        }
      }
    }

    const officeLabel = document.querySelector('label[for="office"]');
    if (officeLabel) {
      const span = officeLabel.parentElement.querySelector('span');
      if (span) {
        return span.textContent.trim();
      }
    }
    
    return '';
  }

  // STEP 1: Click View Action History (only if not already visible)
  function clickViewActionHistory() {
    const existingTable = document.querySelector('#custom-action-history-tbl tbody');
    if (existingTable && existingTable.querySelectorAll('tr').length > 0) {
      console.log('[FCI Leave Encashment Assistant] Action history table already visible on page. Parsing directly...');
      setTimeout(function() {
        checkConditionsAndAct(existingTable);
      }, 1000);
      return;
    }

    let btn = document.querySelector('a.view-action-history');
    if (!btn) {
      const allLinks = document.querySelectorAll('a, button');
      for (let el of allLinks) {
        if (el.textContent.trim() === 'View Action History') { btn = el; break; }
      }
    }
    if (btn) {
      console.log('[FCI Leave Encashment Assistant] Step 1: Clicking "View Action History"...');
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      waitForTableAndCheck();
    } else {
      console.warn('[FCI Leave Encashment Assistant] "View Action History" button not found. Retrying in 2s...');
      setTimeout(clickViewActionHistory, 2000);
    }
  }

  // STEP 2: Wait for table to populate
  function waitForTableAndCheck() {
    let attempts = 0;
    const interval = setInterval(function () {
      attempts++;
      const tbody = document.querySelector('#custom-action-history-tbl tbody');
      if (tbody && tbody.querySelectorAll('tr').length > 0) {
        clearInterval(interval);

        const table = document.querySelector('#custom-action-history-tbl');
        if (table) {
          table.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        console.log('[FCI Leave Encashment Assistant] Step 2: Table populated. Checking conditions...');
        checkConditionsAndAct(tbody);
      } else if (attempts >= 20) {
        clearInterval(interval);
        console.warn('[FCI Leave Encashment Assistant] Table did not load in time.');
      }
    }, 500);
  }

  // STEP 3: Parse table and decide which stage we are in
  function checkConditionsAndAct(tbody) {
    const allRows = tbody.querySelectorAll('tr');
    const entries = [];
    let currentEntry = null;

    for (let row of allRows) {
      const cells = row.querySelectorAll('td');
      if (cells.length === 8) {
        currentEntry = {
          slNo:         cells[0].textContent.trim(),
          actionTaken:  cells[3].textContent.trim(),
          employeeName: cells[4].textContent.trim(),
          remark:       ''
        };
        entries.push(currentEntry);
      } else if (cells.length === 1 && cells[0].colSpan === 8) {
        const fullText = cells[0].textContent.trim();
        if (fullText.startsWith('REMARKS:') && currentEntry) {
          currentEntry.remark = fullText.replace('REMARKS:', '').trim();
        }
      }
    }

    // --- READ CADRE FROM PAGE ---
    const cadre = getCadre();
    console.log('[FCI Leave Encashment Assistant] Cadre: "' + cadre + '"');

    // --- READ OFFICE ---
    let office = sessionStorage.getItem('fci_leave_office') || '';

    if (!office) {
      office = getOfficeFromReviewPage();
      console.log('[FCI Leave Encashment Assistant] Office (from review page fallback): "' + office + '"');
    }

    console.log('[FCI Leave Encashment Assistant] Office (final): "' + office + '"');

    // --- Check STAGE 1 ---
    let lastDispatchedIndex = -1;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].actionTaken === 'Dispatched') lastDispatchedIndex = i;
    }
    const lastDispatched = lastDispatchedIndex !== -1 ? entries[lastDispatchedIndex] : null;
    const afterDispatched = lastDispatched ? entries[lastDispatchedIndex + 1] || null : null;

    const stage1 = lastDispatched
      && lastDispatched.employeeName.toUpperCase().includes(STAGE1_DISPATCHER_NAME)
      && afterDispatched
      && afterDispatched.employeeName.toUpperCase().includes(STAGE1_NEXT_NAME)
      && afterDispatched.actionTaken.trim() === STAGE1_NEXT_ACTION
      && afterDispatched.remark.trim() === STAGE1_NEXT_REMARK;

    // --- Check STAGE 2 ---
    const ASSISTANT_NAMES = ['MADHU DHAKA', 'DIVYA KORNU', 'VISHALI MARWAHA'];

    let lastAssistantReviewedIndex = -1;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].actionTaken === 'Reviewed') {
        const nameUpper = entries[i].employeeName.toUpperCase();
        if (ASSISTANT_NAMES.some(function(n) { return nameUpper.includes(n); })) {
          lastAssistantReviewedIndex = i;
        }
      }
    }
    const lastAssistantReviewed = lastAssistantReviewedIndex !== -1 ? entries[lastAssistantReviewedIndex] : null;
    const afterAssistantReviewed = lastAssistantReviewed ? entries[lastAssistantReviewedIndex + 1] || null : null;

    const stage2 = lastAssistantReviewed
      && afterAssistantReviewed
      && afterAssistantReviewed.employeeName.toUpperCase().includes(STAGE2_NEXT_NAME)
      && afterAssistantReviewed.actionTaken.trim() === STAGE2_NEXT_ACTION
      && afterAssistantReviewed.remark.trim() === STAGE2_NEXT_REMARK;

    console.log('[FCI Leave Encashment Assistant] Stage 1 (Send to Assistant): ' + (stage1 ? 'MATCH' : 'no match'));
    console.log('[FCI Leave Encashment Assistant] Stage 2 (Final Approval): ' + (stage2 ? 'MATCH' : 'no match'));

    // --- Stage priority: Stage 2 → Stage 1 ---

    if (stage2) {
      const assistantName = lastAssistantReviewed ? lastAssistantReviewed.employeeName : 'Assistant';
      console.log('[FCI Leave Encashment Assistant] Stage 2: Assistant "' + assistantName + '" has reviewed. Filling final approval remark...');
      highlightTriggerRow(tbody, assistantName, 'Reviewed');
      setTimeout(function() { fillFinalApprovalRemark(); }, 2000);

    } else if (stage1) {
      const assistant = decideAssistant(cadre, office);
      if (assistant) {
        console.log('[FCI Leave Encashment Assistant] Stage 1: Routing to ' + assistant.name + ' (' + assistant.empNo + ')');
        highlightTriggerRow(tbody, 'MAYURESH KUMAR', 'Dispatched');
        sessionStorage.setItem('fci_leave_stage', '1');
        sessionStorage.setItem('fci_leave_office_type', OFFICE_TYPE_RO);
        sessionStorage.setItem('fci_leave_assistant_emp', assistant.empNo);
        sessionStorage.setItem('fci_leave_assistant_name', assistant.name);
        sessionStorage.setItem('fci_leave_assistant_remark', STAGE1_REMARK);
        sessionStorage.removeItem('fci_leave_target_office');
        sessionStorage.removeItem('fci_leave_target_employee_name');
        setTimeout(clickAddReviewer, 2000);
      }

    } else {
      console.log('[FCI Leave Encashment Assistant] No matching stage found. No action taken.');
    }
  }

  // Highlight the trigger row with a flashing yellow effect
  function highlightTriggerRow(tbody, targetName, targetAction) {
    const allRows = tbody.querySelectorAll('tr');
    let targetRow = null;

    for (let row of allRows) {
      const cells = row.querySelectorAll('td');
      if (cells.length === 8) {
        const action = cells[3].textContent.trim();
        const name   = cells[4].textContent.trim().toUpperCase();
        if (action === targetAction && name.includes(targetName.toUpperCase())) {
          targetRow = row;
        }
      }
    }

    if (!targetRow) {
      console.warn('[FCI Leave Encashment Assistant] Trigger row not found for highlighting.');
      return;
    }

    targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const originalBg = targetRow.style.backgroundColor;
    let flashCount = 0;
    const flashInterval = setInterval(function () {
      flashCount++;
      targetRow.style.backgroundColor = (flashCount % 2 === 1) ? '#fff3cd' : '';
      if (flashCount >= 6) {
        clearInterval(flashInterval);
        targetRow.style.backgroundColor = '#fff3cd';
        setTimeout(function () {
          targetRow.style.backgroundColor = originalBg;
        }, 1800);
      }
    }, 300);
  }

  // Read Cadre and Office and return the correct assistant
  function decideAssistant(cadre, office) {
    const cadreValue  = cadre.trim().replace(/\s+/g, ' ').toUpperCase();
    const officeValue = office.trim().replace(/\s+/g, ' ').toUpperCase();

    console.log('[FCI Leave Encashment Assistant] Cadre: "' + cadreValue + '" | Office: "' + officeValue + '"');

    if (cadreValue === 'GENERAL') {
      return ASSISTANT_GENERAL;
    } else if (cadreValue === 'DEPOT') {
      if (DIVYA_OFFICES.map(o => o.trim().replace(/\s+/g, ' ').toUpperCase()).includes(officeValue)) {
        return ASSISTANT_DIVYA;
      } else if (VISHALI_OFFICES.map(o => o.trim().replace(/\s+/g, ' ').toUpperCase()).includes(officeValue)) {
        return ASSISTANT_VISHALI;
      } else {
        console.warn('[FCI Leave Encashment Assistant] Cadre is Depot but Office "' + officeValue + '" is not in any known group. No action taken.');
        return null;
      }
    } else {
      console.warn('[FCI Leave Encashment Assistant] Unrecognised Cadre: "' + cadreValue + '". No action taken.');
      return null;
    }
  }

  // --- STAGE 2: Fill Final Approval Remark ---
  function fillFinalApprovalRemark(attempts) {
    attempts = attempts || 0;

    // Read values from the page
    const empNameRaw = getFieldValue('Employee Name');
    const empName = toProperCase(empNameRaw);
    const designation = getFieldValue('Designation');
    const balanceLeaveStr = getFieldValue('Before Balance');
    
    // Read Cadre from the page
    const cadre = getCadre();
    const fullDesignation = designation + ' (' + cadre + ')';

    // Read Encashment from sessionStorage (set by listing page)
    const encashmentStr = sessionStorage.getItem('fci_leave_encashment') || '';

    if (!empName || !designation || !balanceLeaveStr || !encashmentStr) {
      if (attempts >= 10) {
        console.warn('[FCI Leave Encashment Assistant] Could not read all required fields. Remark NOT filled.');
        console.warn('[FCI Leave Encashment Assistant] empName: "' + empName + '", designation: "' + designation + '", balanceLeave: "' + balanceLeaveStr + '", encashment: "' + encashmentStr + '"');
        return;
      }
      setTimeout(function() { fillFinalApprovalRemark(attempts + 1); }, 500);
      return;
    }

    // Calculate values
    const D = parseFloat(balanceLeaveStr);
    const F = parseFloat(encashmentStr);
    const E = (D - 30) / 2;  // exact value: 38.5

    console.log('[FCI Leave Encashment Assistant] Balance Leave (D): ' + D);
    console.log('[FCI Leave Encashment Assistant] Encashment Requested (F): ' + F);
    console.log('[FCI Leave Encashment Assistant] Max Encashable (E): ' + E);
    console.log('[FCI Leave Encashment Assistant] Cadre: ' + cadre);
    console.log('[FCI Leave Encashment Assistant] Full Designation: ' + fullDesignation);

    let remarkText = '';

    // VALIDATION CHECK: F <= E
    const isValid = F <= E;

    console.log('[FCI Leave Encashment Assistant] Validation (F <= E): ' + (isValid ? 'PASSED' : 'FAILED'));

    if (isValid) {
      remarkText = 'Kind attention is drawn towards the leave encashment application under consideration, in this regard following points are noteworthy:- ' +
        empName + ', ' + fullDesignation + ' has earlier not applied for the leave encashment for the calendar year 2026. ' +
        'The employee has ' + D + ' days earned leave available in a leave account against which the maximum number of leave encashment that could be sanctioned is ' + E + ' days. ' +
        'Hence, if agreed, as per the employee request the leave encashment application of ' + F + ' days may please be approved.';
    } else {
      remarkText = 'Kindly re-check the requested no. of leaves to be encashed.';
    }

    console.log('[FCI Leave Encashment Assistant] Final remark: ' + remarkText);

    const editor = document.getElementById('editor');
    const textarea = document.getElementById('dop_member_comment');

    if (!editor) {
      console.warn('[FCI Leave Encashment Assistant] Reviewer Remarks editor (#editor) not found. Retrying...');
      setTimeout(function() { fillFinalApprovalRemark(attempts + 1); }, 1500);
      return;
    }

    editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
    editor.innerText = remarkText;
    if (textarea) textarea.value = remarkText;

    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.dispatchEvent(new Event('blur', { bubbles: true }));

    // --- Send to Google Sheet (non-blocking) ---
    sendToLeaveSheet(remarkText, empName, fullDesignation, D, E, F);

    console.log('[FCI Leave Encashment Assistant] Final approval remark filled successfully.');
    console.log('[FCI Leave Encashment Assistant] *** Please review the remark and click the Review/Submit button yourself. ***');
  }

  // --- Send data to Google Sheet ---
  function sendToLeaveSheet(remarkText, empName, fullDesignation, D, E, F) {
    if (!LEAVE_SHEET_WEBAPP_URL || LEAVE_SHEET_WEBAPP_URL.indexOf('PASTE_YOUR') === 0) {
      console.log('[FCI Leave Encashment Assistant] Google Sheet Web App URL not configured. Skipping register write-back.');
      return;
    }

    console.log('[FCI Leave Encashment Assistant] Attempting to send data to Google Sheet...');

    setTimeout(function() {
      const office = sessionStorage.getItem('fci_leave_office') || '';
      const requestId = sessionStorage.getItem('fci_leave_request_id') || '';

      const payloadObj = {
        fromHRMS: empName,
        designation: fullDesignation,
        elAvailable: D,
        encashable: E,  // exact decimal: 38.5
        leaveRequested: F,
        review: office || '',
        finalRemark: remarkText
      };

      console.log('[FCI Leave Encashment Assistant] Payload:', JSON.stringify(payloadObj));

      const controller = new AbortController();
      const timeoutId = setTimeout(function() { controller.abort(); }, 10000);

      fetch(LEAVE_SHEET_WEBAPP_URL, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          payload: JSON.stringify(payloadObj)
        }),
        signal: controller.signal
      })
      .then(function(response) {
        clearTimeout(timeoutId);
        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }
        return response.text();
      })
      .then(function(text) {
        console.log('[FCI Leave Encashment Assistant] ✅ Register write-back succeeded:', text);
      })
      .catch(function(err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          console.warn('[FCI Leave Encashment Assistant] ⏱️ Register write-back timed out (10s)');
        } else {
          console.warn('[FCI Leave Encashment Assistant] ⚠️ Register write-back failed:', err.message);
        }
        showLeaveRegisterWarning(err.message);
      });
    }, 100);
  }

  // --- Show warning banner on the page if write-back fails ---
  function showLeaveRegisterWarning(reason) {
    if (document.getElementById('leave-register-warning')) return;

    const banner = document.createElement('div');
    banner.id = 'leave-register-warning';
    banner.textContent = '⚠ Could not log this entry to the Leave Encashment register — please add manually. (' + reason + ')';
    banner.style.position = 'fixed';
    banner.style.top = '12px';
    banner.style.left = '50%';
    banner.style.transform = 'translateX(-50%)';
    banner.style.background = '#fff3cd';
    banner.style.color = '#664d03';
    banner.style.border = '1px solid #ffe69c';
    banner.style.borderRadius = '6px';
    banner.style.padding = '10px 16px';
    banner.style.fontFamily = 'Arial, sans-serif';
    banner.style.fontSize = '13px';
    banner.style.fontWeight = '600';
    banner.style.zIndex = '999999';
    banner.style.boxShadow = '0 4px 14px rgba(0,0,0,0.15)';
    banner.style.cursor = 'pointer';
    banner.title = 'Click to dismiss';
    banner.addEventListener('click', function() { banner.remove(); });

    document.body.appendChild(banner);
  }

  // Click the Add Reviewer button
  function clickAddReviewer() {
    let addReviewerBtn = null;
    const allLinks = document.querySelectorAll('a, button');
    for (let el of allLinks) {
      if (el.textContent.trim() === 'Add Reviewer') { addReviewerBtn = el; break; }
    }
    if (addReviewerBtn) {
      sessionStorage.setItem('fci_leave_triggered', 'yes');
      console.log('[FCI Leave Encashment Assistant] Clicking "Add Reviewer"...');
      addReviewerBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    } else {
      console.warn('[FCI Leave Encashment Assistant] "Add Reviewer" button not found.');
    }
  }

  // --- START ---

  // SAFETY CHECK: Only activate for Leave Encashment requests (Request ID starts with CH)
  function getRequestId() {
    const allLabels = document.querySelectorAll('p, span, div, td, h1, h2, h3, h4, h5');
    for (let el of allLabels) {
      const text = el.textContent.trim();
      if (/^CH\d+$/i.test(text)) return text.toUpperCase();
    }
    const bodyText = document.body.innerText || '';
    const match = bodyText.match(/\bCH\d+\b/i);
    return match ? match[0].toUpperCase() : null;
  }

  const requestId = getRequestId();
  if (!requestId || !requestId.startsWith('CH')) {
    console.log('[FCI Leave Encashment Assistant] Request ID not found or does not start with CH ("' + (requestId || 'none') + '"). Extension will NOT activate on this page.');
  } else {
    console.log('[FCI Leave Encashment Assistant] Request ID confirmed: ' + requestId + '. Activating...');
    
    const existingTable = document.querySelector('#custom-action-history-tbl tbody');
    if (existingTable && existingTable.querySelectorAll('tr').length > 0) {
      console.log('[FCI Leave Encashment Assistant] Action history table already visible on page. Parsing directly...');
      setTimeout(function() {
        checkConditionsAndAct(existingTable);
      }, 1000);
    } else {
      console.log('[FCI Leave Encashment Assistant] Action history table not found. Clicking "View Action History"...');
      setTimeout(clickViewActionHistory, 2000);
    }
  }

})();