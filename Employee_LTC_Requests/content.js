// FCI LTC Assistant - Content Script v1.4
// Runs on the LTC review page.
// Detects stages and either routes to Add Reviewer or shows floating panel for Stage 3.
//
// Fixes applied in v1.3:
//   C-4  : scrapeBlockYearFromPage() — when Is Extended=Yes, return hardcoded '2026-2029'
//   M-1  : decideAssistant() — RO CHANDIGARH added back to DIVYA_OFFICES (Depot cadre)
//   M-2  : scrapeLeaveFieldsFromPage() — destination regex anchored to "for the block" terminator
//   D-2  : openAllAttachments() — removed duplicate second scan of historySection
//
// Fixes applied in v1.4:
//   UX-1 : Approve dialog (#ltc-dialog-box) is now draggable via its header
//   UX-2 : user-select:none added to dialog box to prevent text selection while dragging
//   UX-3 : buildDynamicRemark() — years of service calculated dynamically from DOJ

(function () {

  const PREFIX = 'LBD';
  const LOG    = '[FCI LTC Assistant]';

  // --- CONFIGURATION ---

  const DISPATCHER_NAME = 'MAYURESH KUMAR';
  const MANAGER_NAME    = 'AMIT KUMAR SINGH';

  const ASSISTANT_GENERAL = { name: 'MADHU DHAKA',     empNo: '313284' };
  const ASSISTANT_DIVYA   = { name: 'DIVYA KORNU',     empNo: '315172' };
  const ASSISTANT_VISHALI = { name: 'VISHALI MARWAHA', empNo: '308235' };

  // RO CHANDIGARH included — Depot cadre at RO goes to DIVYA KORNU
  const DIVYA_OFFICES = [
    'RO CHANDIGARH',
    'DO PATIALA', 'DO LUDHIANA', 'DO JALANDHAR',
    'DO FARIDKOT', 'DO HOSHIARPUR', 'DO AMRITSAR'
  ];
  const VISHALI_OFFICES = [
    'DO KAPURTHALA', 'DO FEROZEPUR', 'DO CHANDIGARH', 'DO BHATINDA',
    'DO MOGA', 'DO GURDASPUR', 'DO SANGRUR'
  ];

  const STAGE1_REMARK  = 'Kindly peruse the request and check for the eligibility of the requesting official.';
  const STAGE3C_REMARK = 'Kindly re-examine the request and check for the eligibility of the requesting official.';
  const STAGE3B_REMARK_TEMPLATE = 'Reference may be made to the observations recorded during examination of the request at Sl. No. {SLNO}. Required necessary clarifications and/or supporting documents, as indicated, may kindly be furnished for further processing.';
  const STAGE3B_LEAVE_NOT_APPROVED_REMARK = 'Kindly attach the leave sanction orders for the concerned dates.';

  // Confirmed from portal inspection:
  // value="4" → RO  |  value="5" → DO  |  value="6" → Depot
  const OFFICE_TYPE_RO = '4';
  const OFFICE_TYPE_DO = '5';

  const AGM_DESIGNATION = 'Assistant General Manager';

  // Present LTC block year (hardcoded per spec)
  const CURRENT_BLOCK_YEAR = '2026-2029';

  // --- SAFETY CHECK ---
  function getRequestId() {
    const allEls = document.querySelectorAll('p, span, div, td, h1, h2, h3, h4, h5');
    for (let el of allEls) {
      const text = el.textContent.trim();
      if (/^LBD\d+$/i.test(text)) return text.toUpperCase();
    }
    const bodyText = document.body.innerText || '';
    const match = bodyText.match(/\bLBD\d+\b/i);
    return match ? match[0].toUpperCase() : null;
  }

  const requestId = getRequestId();
  if (!requestId || !requestId.startsWith(PREFIX)) {
    console.log(LOG + ' Not an LBD request. Extension will NOT activate.');
  } else {
    console.log(LOG + ' Request ID confirmed: ' + requestId + '. Activating...');
    setTimeout(clickViewActionHistory, 2000);
  }

  // --- STEP 1: Click View Action History ---
  function clickViewActionHistory() {
    let btn = document.querySelector('a.view-action-history');
    if (!btn) {
      const allLinks = document.querySelectorAll('a, button');
      for (let el of allLinks) {
        if (el.textContent.trim() === 'View Action History') { btn = el; break; }
      }
    }
    if (btn) {
      console.log(LOG + ' Step 1: Clicking "View Action History"...');
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      waitForTableAndCheck();
    } else {
      console.warn(LOG + ' "View Action History" button not found. Retrying in 2s...');
      setTimeout(clickViewActionHistory, 2000);
    }
  }

  // --- STEP 2: Wait for table to populate ---
  function waitForTableAndCheck() {
    let attempts = 0;
    const interval = setInterval(function () {
      attempts++;
      const tbody = document.querySelector('#custom-action-history-tbl tbody');
      if (tbody && tbody.querySelectorAll('tr').length > 0) {
        clearInterval(interval);
        const table = document.querySelector('#custom-action-history-tbl');
        if (table) table.scrollIntoView({ behavior: 'smooth', block: 'start' });
        console.log(LOG + ' Step 2: Table populated. Checking conditions...');
        checkConditionsAndAct(tbody);
      } else if (attempts >= 20) {
        clearInterval(interval);
        console.warn(LOG + ' Table did not load in time.');
      }
    }, 500);
  }

  // --- STEP 3: Parse table and decide stage ---
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
          designation:  cells[5].textContent.trim(),
          remark:       ''
        };
        entries.push(currentEntry);
      } else if (cells.length >= 1) {
        // Dual detection for remark rows — colSpan OR text prefix
        const isRemarkRow = (cells.length === 1 && cells[0].colSpan === 8) ||
                            (cells[0] && cells[0].textContent.trim().startsWith('REMARKS:'));
        if (isRemarkRow && currentEntry) {
          const fullText = cells[0].textContent.trim();
          currentEntry.remark = fullText.replace('REMARKS:', '').trim();
        }
      }
    }

    // Read page fields
    const cadreValue     = getFieldValue('cadre');
    const officeValue    = getFieldValue('office');
    const isRoChandigarh = officeValue.trim().replace(/\s+/g, ' ').toUpperCase() === 'RO CHANDIGARH';

    console.log(LOG + ' Office: "' + officeValue + '" | Cadre: "' + cadreValue + '" | isRoChandigarh: ' + isRoChandigarh);

    // Find last Dispatched
    let lastDispatchedIndex = -1;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].actionTaken === 'Dispatched') lastDispatchedIndex = i;
    }
    const lastDispatched  = lastDispatchedIndex !== -1 ? entries[lastDispatchedIndex] : null;
    const afterDispatched = lastDispatched ? entries[lastDispatchedIndex + 1] || null : null;

    // Find last Assistant Reviewed
    const ASSISTANT_NAMES = ['MADHU DHAKA', 'DIVYA KORNU', 'VISHALI MARWAHA'];
    let lastAssistantReviewedIndex = -1;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].actionTaken === 'Reviewed') {
        const nameUpper = entries[i].employeeName.toUpperCase();
        if (ASSISTANT_NAMES.some(function (n) { return nameUpper.includes(n); })) {
          lastAssistantReviewedIndex = i;
        }
      }
    }
    const lastAssistantReviewed  = lastAssistantReviewedIndex !== -1 ? entries[lastAssistantReviewedIndex] : null;
    const afterAssistantReviewed = lastAssistantReviewed ? entries[lastAssistantReviewedIndex + 1] || null : null;

    // Stage 1: Last Dispatched = MAYURESH, next = AMIT (Pending Review, N/A remark)
    const stage1 = lastDispatched
      && lastDispatched.employeeName.toUpperCase().includes(DISPATCHER_NAME)
      && afterDispatched
      && afterDispatched.employeeName.toUpperCase().includes(MANAGER_NAME)
      && afterDispatched.actionTaken.trim() === 'Pending Review'
      && afterDispatched.remark.trim() === 'N/A';

    // Stage 3 trigger: Assistant reviewed with non-empty remark, next = AMIT Pending Review
    const stage3Trigger = lastAssistantReviewed
      && lastAssistantReviewed.remark.trim() !== ''
      && lastAssistantReviewed.remark.trim() !== 'N/A'
      && afterAssistantReviewed
      && afterAssistantReviewed.employeeName.toUpperCase().includes(MANAGER_NAME)
      && afterAssistantReviewed.actionTaken.trim() === 'Pending Review'
      && afterAssistantReviewed.remark.trim() === 'N/A';

    // Find LAST AGM entry (no break — keep overwriting agmIndex)
    let agmIndex = -1;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].designation.trim() === AGM_DESIGNATION
          && entries[i].remark.trim() !== 'N/A'
          && entries[i].remark.trim() !== '') {
        agmIndex = i;
      }
    }
    const doManagerEntry = agmIndex > 0 ? entries[agmIndex - 1] : null;

    // Stage 3C detection
    let lastAmitPendingIndex = -1;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].employeeName.toUpperCase().includes(MANAGER_NAME)
          && entries[i].actionTaken.trim() === 'Pending Review'
          && entries[i].remark.trim() === 'N/A') {
        lastAmitPendingIndex = i;
      }
    }
    const entryBeforeAmitPending = lastAmitPendingIndex > 0 ? entries[lastAmitPendingIndex - 1] : null;

    // Stage 3C guard — require prior Stage 3B dispatch cycle
    let hasPrior3BCycle = false;
    if (lastAssistantReviewedIndex !== -1) {
      for (let i = lastAssistantReviewedIndex + 1; i < entries.length; i++) {
        if (entries[i].actionTaken === 'Dispatched' &&
            entries[i].employeeName.toUpperCase().includes(MANAGER_NAME)) {
          hasPrior3BCycle = true;
          break;
        }
      }
    }

    const isAssistant = function (name) {
      return ASSISTANT_NAMES.some(function (n) { return name.toUpperCase().includes(n); });
    };

    const stage3c = entryBeforeAmitPending
      && entryBeforeAmitPending.actionTaken === 'Reviewed'
      && !isAssistant(entryBeforeAmitPending.employeeName)
      && !entryBeforeAmitPending.employeeName.toUpperCase().includes(DISPATCHER_NAME)
      && !entryBeforeAmitPending.employeeName.toUpperCase().includes(MANAGER_NAME)
      && lastAmitPendingIndex !== -1
      && !stage3Trigger
      && hasPrior3BCycle;

    console.log(LOG + ' Stage 1:  ' + (stage1 ? 'MATCH' : 'no match'));
    console.log(LOG + ' Stage 3 trigger: ' + (stage3Trigger ? 'MATCH' : 'no match'));
    console.log(LOG + ' Stage 3C: ' + (stage3c ? 'MATCH' : 'no match'));
    if (doManagerEntry) {
      console.log(LOG + ' DO Manager identified: "' + doManagerEntry.employeeName + '" (S.No. ' + doManagerEntry.slNo + ')');
    }

    // --- Stage priority: 3 → 3C → 1 ---

    if (stage3Trigger) {
      const assistantName = lastAssistantReviewed.employeeName;
      console.log(LOG + ' Stage 3: "' + assistantName + '" has reviewed. Showing floating panel...');
      highlightTriggerRow(tbody, assistantName, 'Reviewed');
      setTimeout(function () {
        injectFloatingPanel(lastAssistantReviewed, entries, cadreValue, officeValue, isRoChandigarh);
      }, 1500);

    } else if (stage3c) {
      const assistant = decideAssistant(cadreValue, officeValue);
      if (!assistant) return;
      console.log(LOG + ' Stage 3C: Re-routing to ' + assistant.name + '...');
      highlightTriggerRow(tbody, entryBeforeAmitPending.employeeName, 'Reviewed');

      sessionStorage.setItem('fci_ltc_stage', '3c');
      sessionStorage.setItem('fci_ltc_office_type', OFFICE_TYPE_RO);
      sessionStorage.setItem('fci_ltc_assistant_emp', assistant.empNo);
      sessionStorage.setItem('fci_ltc_assistant_name', assistant.name);
      sessionStorage.setItem('fci_ltc_assistant_remark', STAGE3C_REMARK);
      sessionStorage.setItem('fci_ltc_triggered', 'yes');
      setTimeout(clickAddReviewer, 2000);

    } else if (stage1) {
      const assistant = decideAssistant(cadreValue, officeValue);
      if (assistant) {
        console.log(LOG + ' Stage 1: Routing to ' + assistant.name + ' (' + assistant.empNo + ')');
        highlightTriggerRow(tbody, DISPATCHER_NAME, 'Dispatched');
        sessionStorage.setItem('fci_ltc_stage', '1');
        sessionStorage.setItem('fci_ltc_office_type', OFFICE_TYPE_RO);
        sessionStorage.setItem('fci_ltc_assistant_emp', assistant.empNo);
        sessionStorage.setItem('fci_ltc_assistant_name', assistant.name);
        sessionStorage.setItem('fci_ltc_assistant_remark', STAGE1_REMARK);
        sessionStorage.setItem('fci_ltc_triggered', 'yes');
        setTimeout(clickAddReviewer, 2000);
      }

    } else {
      console.log(LOG + ' No matching stage found. No action taken.');
    }
  }

  // --- FLOATING PANEL for Stage 3 ---
  function injectFloatingPanel(lastAssistantReviewed, entries, cadreValue, officeValue, isRoChandigarh) {
    if (document.getElementById('ltc-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'ltc-panel';
    panel.innerHTML = buildPanelHTML();
    applyPanelStyles(panel);
    document.body.appendChild(panel);
    makeDraggable(panel);

    panel.querySelector('#ltc-approve-btn').addEventListener('click', function () {
      panel.remove();
      showApproveDialog(lastAssistantReviewed, entries, cadreValue, officeValue, isRoChandigarh);
    });

    panel.querySelector('#ltc-sendback-btn').addEventListener('click', function () {
      panel.remove();
      handleSendBack(lastAssistantReviewed, entries, officeValue, isRoChandigarh);
    });

    console.log(LOG + ' Floating panel injected.');
  }

  function buildPanelHTML() {
    return '' +
      '<div id="ltc-header">' +
        '<span id="ltc-title">&#9992; LTC Assistant &nbsp;<small style="font-weight:400;font-size:11px;color:#888;">Stage 3</small></span>' +
        '<span id="ltc-drag-hint" title="Drag to reposition">&#8801;</span>' +
      '</div>' +
      '<div style="font-size:12px;color:#555;margin:8px 0;line-height:1.5;">' +
        'Assistant has reviewed the request.<br>Choose the next action:' +
      '</div>' +
      '<button id="ltc-approve-btn" class="ltc-btn ltc-approve">&#10003; Approve — Generate Remark</button>' +
      '<button id="ltc-sendback-btn" class="ltc-btn ltc-sendback">&#10007; Send Back (3B)</button>';
  }

  function applyPanelStyles(panel) {
    if (!document.getElementById('ltc-style')) {
      const style = document.createElement('style');
      style.id = 'ltc-style';
      style.textContent = `
        #ltc-panel {
          position: fixed;
          top: 80px;
          right: 20px;
          width: 320px;
          background: #fff;
          border: 1px solid #d0d0d0;
          border-radius: 10px;
          padding: 12px 14px;
          z-index: 99999;
          font-family: Arial, sans-serif;
          font-size: 13px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.13);
          user-select: none;
        }
        #ltc-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
          cursor: move;
        }
        #ltc-title { font-weight: 600; font-size: 13px; color: #333; }
        #ltc-drag-hint { color: #aaa; font-size: 18px; cursor: move; line-height: 1; }
        .ltc-btn {
          display: block; width: 100%; text-align: left;
          border: 1px solid; border-radius: 6px;
          padding: 8px 10px; margin-bottom: 8px;
          font-size: 12px; cursor: pointer;
          line-height: 1.45; transition: border-color 0.15s, background 0.15s, filter 0.15s;
        }
        .ltc-approve {
          background: #E1F5EE; border-color: #0F6E56; color: #085041;
        }
        .ltc-approve:hover { filter: brightness(0.95); }
        .ltc-sendback {
          background: #FAECE7; border-color: #993C1D; color: #4A1B0C;
        }
        .ltc-sendback:hover { filter: brightness(0.95); }
      `;
      document.head.appendChild(style);
    }
  }

  // Draggable — for the small floating panel (uses right/top positioning)
  function makeDraggable(el) {
    let startX, startY, startLeft, startTop;
    const header = el.querySelector('#ltc-header');
    header.addEventListener('mousedown', function (e) {
      startX = e.clientX; startY = e.clientY;
      const rect = el.getBoundingClientRect();
      startLeft = rect.left; startTop = rect.top;
      function onMove(e) {
        el.style.right = 'auto';
        el.style.left  = (startLeft + e.clientX - startX) + 'px';
        el.style.top   = (startTop  + e.clientY - startY) + 'px';
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    });
  }

  // UX-1: Draggable — for the approve dialog box (clears transform on first drag)
  function makeDraggableDialog(el) {
    const dialogBox = el.querySelector('#ltc-dialog-box');
    const header    = el.querySelector('#ltc-dialog-header');
    if (!dialogBox || !header) return;
    header.style.cursor = 'move';
    let startX, startY, startLeft, startTop;
    header.addEventListener('mousedown', function (e) {
      // Do not drag if the close button was clicked
      if (e.target.id === 'ltc-dialog-close') return;
      const rect = dialogBox.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY;
      startLeft = rect.left; startTop = rect.top;
      // Clear transform so left/top positioning takes over cleanly
      dialogBox.style.transform = 'none';
      dialogBox.style.left = startLeft + 'px';
      dialogBox.style.top  = startTop  + 'px';
      function onMove(e) {
        dialogBox.style.left = (startLeft + e.clientX - startX) + 'px';
        dialogBox.style.top  = (startTop  + e.clientY - startY) + 'px';
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    });
  }

  // --- APPROVE DIALOG ---
  function showApproveDialog(lastAssistantReviewed, entries, cadreValue, officeValue, isRoChandigarh) {

    const dateOfJoining = getLabelledField('Date Of Joining FCI');
    const blockYear     = scrapeBlockYearFromPage();
    const employeeName  = getEmployeeNameFromHistory(entries);
    const designation   = getDesignationFromHistory(entries);
    const inferredCadre = inferCadreFromAssistant(lastAssistantReviewed);
    const finalCadre    = cadreValue || inferredCadre;
    const scraped       = scrapeLeaveFieldsFromPage();

    console.log(LOG + ' Scraped fields:', {
      dateOfJoining, blockYear, employeeName, designation, finalCadre, scraped
    });

    const dialog = document.createElement('div');
    dialog.id = 'ltc-approve-dialog';
    dialog.innerHTML = buildApproveDialogHTML(
      dateOfJoining, blockYear, employeeName, designation, finalCadre, scraped
    );
    applyDialogStyles(dialog);
    document.body.appendChild(dialog);

    // UX-1: Make the dialog draggable
    makeDraggableDialog(dialog);

    // Spouse letter show/hide
    const spouseWorkingSelect = dialog.querySelector('#dg-spouse-working');
    const spouseLetterRow     = dialog.querySelector('#dg-spouse-letter-row');

    function toggleSpouseLetter() {
      if (spouseWorkingSelect.value === 'Yes') {
        spouseLetterRow.style.display = 'flex';
      } else {
        spouseLetterRow.style.display = 'none';
        dialog.querySelector('#dg-spouse-letter').value = 'No';
      }
    }
    spouseWorkingSelect.addEventListener('change', toggleSpouseLetter);
    toggleSpouseLetter();

    dialog.querySelector('#ltc-dialog-close').addEventListener('click', function () {
      dialog.remove();
    });

    dialog.querySelector('#ltc-generate-btn').addEventListener('click', function () {
      if (!validateDialogFields(dialog)) return;

      const leaveApproved = dialog.querySelector('#dg-leave-approved').value;

      if (leaveApproved === 'No') {
        dialog.remove();
        console.log(LOG + ' Leave not approved — triggering Stage 3B send-back.');
        handleSendBackFromDialog(lastAssistantReviewed, entries, officeValue, isRoChandigarh);
        return;
      }

      const remark = buildDynamicRemark(dialog);
      if (remark) {
        dialog.remove();
        fillReviewerRemarks(remark);
        openAllAttachments();
      }
    });
  }

  // --- BLOCK YEAR SCRAPER ---
  function scrapeBlockYearFromPage() {
    const bodyText = document.body.innerText || '';
    const match = bodyText.match(/BLOCK OF YEAR\s+(\d{4}-\d{4})/i);
    if (match) {
      const extendedMatch = bodyText.match(/Is Extended\s+(Yes|No)/i);
      if (extendedMatch && extendedMatch[1].toLowerCase() === 'yes') {
        return CURRENT_BLOCK_YEAR;
      }
      return match[1];
    }
    return '';
  }

  // --- HISTORY HELPERS ---
  function getEmployeeNameFromHistory(entries) {
    if (entries && entries.length > 0) return entries[0].employeeName;
    return '';
  }

  function getDesignationFromHistory(entries) {
    if (entries && entries.length > 0) return entries[0].designation;
    return '';
  }

  function inferCadreFromAssistant(lastAssistantReviewed) {
    if (!lastAssistantReviewed) return '';
    const name = lastAssistantReviewed.employeeName.toUpperCase();
    if (name.includes('MADHU DHAKA'))     return 'General';
    if (name.includes('DIVYA KORNU'))     return 'Depot Group 1';
    if (name.includes('VISHALI MARWAHA')) return 'Depot Group 2';
    return '';
  }

  // --- LEAVE FIELDS SCRAPER ---
  function scrapeLeaveFieldsFromPage() {
    const bodyText = document.body.innerText || '';
    const result   = { leaveDays: '', leaveType: '', leaveFrom: '', leaveTo: '', destination: '' };

    // Primary: anchor to "for the block" — handles multi-word town names
    const destMatch = bodyText.match(/for location\s+([A-Za-z\s]+?)\s+for the block/i);
    if (destMatch) {
      result.destination = destMatch[1].trim().replace(/\s+/g, ' ');
    } else {
      // Fallback: "in lieu of <location> for location"
      const destFallback = bodyText.match(/in lieu of\s+([A-Za-z\s]+?)\s+for location/i);
      if (destFallback) {
        result.destination = destFallback[1].trim().replace(/\s+/g, ' ');
      }
    }

    // Leave details
    const leaveMatch = bodyText.match(
      /applied for\s+(\d+)\s+days?\s+([A-Za-z\s]+?)\s+from\s+(\d{2}\/\d{2}\/\d{4})\s+to\s+(\d{2}\/\d{2}\/\d{4})/i
    );
    if (leaveMatch) {
      result.leaveDays = leaveMatch[1];
      result.leaveType = leaveMatch[2].trim().replace(/\s+/g, ' ').replace(/^leave\s+/i, '');
      result.leaveFrom = leaveMatch[3];
      result.leaveTo   = leaveMatch[4];
    }

    // Fallback: "N days <Type> leave"
    if (!result.leaveDays) {
      const fallback = bodyText.match(/(\d+)\s+days?\s+([A-Za-z\s]+?)\s+leave/i);
      if (fallback) {
        result.leaveDays = fallback[1];
        result.leaveType = fallback[2].trim().replace(/\s+/g, ' ');
      }
    }

    // Fallback: any date range
    if (!result.leaveFrom) {
      const dateRange = bodyText.match(/(\d{2}\/\d{2}\/\d{4})\s+to\s+(\d{2}\/\d{2}\/\d{4})/);
      if (dateRange) {
        result.leaveFrom = dateRange[1];
        result.leaveTo   = dateRange[2];
      }
    }

    return result;
  }

  // --- DIALOG HTML ---
  function buildApproveDialogHTML(dateOfJoining, blockYear, employeeName, designation, cadre, scraped) {
    return '' +
      '<div id="ltc-dialog-overlay"></div>' +
      '<div id="ltc-dialog-box">' +
        '<div id="ltc-dialog-header">' +
          '<span>Generate LTC Approval Remark</span>' +
          '<button id="ltc-dialog-close">&times;</button>' +
        '</div>' +
        '<div id="ltc-dialog-body">' +

          '<div class="ltc-dg-row">' +
            '<label>Date of Joining FCI</label>' +
            '<input type="text" id="dg-doj" value="' + escAttr(dateOfJoining) + '">' +
          '</div>' +
          '<div class="ltc-dg-row">' +
            '<label>Block Year</label>' +
            '<input type="text" id="dg-block-year" value="' + escAttr(blockYear) + '">' +
          '</div>' +
          '<div class="ltc-dg-row">' +
            '<label>Employee Name</label>' +
            '<input type="text" id="dg-emp-name" value="' + escAttr(employeeName) + '" readonly style="background:#f5f5f5;">' +
          '</div>' +
          '<div class="ltc-dg-row">' +
            '<label>Designation</label>' +
            '<input type="text" id="dg-designation" value="' + escAttr(designation) + '" readonly style="background:#f5f5f5;">' +
          '</div>' +
          '<div class="ltc-dg-row">' +
            '<label>Cadre</label>' +
            '<input type="text" id="dg-cadre" value="' + escAttr(cadre) + '" readonly style="background:#f5f5f5;">' +
          '</div>' +

          '<div class="ltc-dg-section">LTC AVAILED IN 2024</div>' +
          '<div class="ltc-dg-row">' +
            '<select id="dg-ltc-2024">' +
              '<option value="">Not Availed</option>' +
              '<option>Bharat Darshan</option>' +
              '<option>Hometown</option>' +
              '<option>Hometown Conversion</option>' +
              '<option>Encashment</option>' +
            '</select>' +
          '</div>' +

          '<div class="ltc-dg-section">LTC AVAILED IN 2025</div>' +
          '<div class="ltc-dg-row">' +
            '<select id="dg-ltc-2025">' +
              '<option value="">Not Availed</option>' +
              '<option>Bharat Darshan</option>' +
              '<option>Hometown</option>' +
              '<option>Hometown Conversion</option>' +
              '<option>Encashment</option>' +
            '</select>' +
          '</div>' +

          '<div class="ltc-dg-row">' +
            '<label>Spouse Working?</label>' +
            '<select id="dg-spouse-working"><option value="No">No</option><option value="Yes">Yes</option></select>' +
          '</div>' +
          '<div class="ltc-dg-row" id="dg-spouse-letter-row">' +
            '<label>Spouse Letter Provided?</label>' +
            '<select id="dg-spouse-letter"><option value="No">No</option><option value="Yes">Yes</option></select>' +
          '</div>' +

          '<div class="ltc-dg-row">' +
            '<label>Leave Days Applied</label>' +
            '<input type="text" id="dg-leave-days" value="' + escAttr(scraped.leaveDays) + '" placeholder="e.g. 15">' +
          '</div>' +
          '<div class="ltc-dg-row">' +
            '<label>Leave Type</label>' +
            '<input type="text" id="dg-leave-type" value="' + escAttr(scraped.leaveType) + '" placeholder="e.g. Paternity Leave">' +
          '</div>' +
          '<div class="ltc-dg-row">' +
            '<label>Leave From Date</label>' +
            '<input type="text" id="dg-leave-from" value="' + escAttr(scraped.leaveFrom) + '" placeholder="DD/MM/YYYY">' +
          '</div>' +
          '<div class="ltc-dg-row">' +
            '<label>Leave To Date</label>' +
            '<input type="text" id="dg-leave-to" value="' + escAttr(scraped.leaveTo) + '" placeholder="DD/MM/YYYY">' +
          '</div>' +
          '<div class="ltc-dg-row">' +
            '<label>Destination (Home Town)</label>' +
            '<input type="text" id="dg-destination" value="' + escAttr(scraped.destination) + '" placeholder="e.g. Deoghar">' +
          '</div>' +
          '<div class="ltc-dg-row">' +
            '<label>Leave Approved?</label>' +
            '<select id="dg-leave-approved"><option value="Yes">Yes</option><option value="No">No</option></select>' +
          '</div>' +

        '</div>' +
        '<div id="ltc-dialog-footer">' +
          '<button id="ltc-generate-btn">Generate Remark</button>' +
        '</div>' +
      '</div>';
  }

  function applyDialogStyles(dialog) {
    if (!document.getElementById('ltc-dialog-style')) {
      const style = document.createElement('style');
      style.id = 'ltc-dialog-style';
      style.textContent = `
        #ltc-dialog-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.4); z-index: 99998;
        }
        #ltc-dialog-box {
          position: fixed; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 420px; max-height: 85vh;
          background: #fff; border-radius: 10px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.2);
          z-index: 99999; display: flex; flex-direction: column;
          font-family: Arial, sans-serif; font-size: 13px;
          user-select: none;
        }
        #ltc-dialog-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 12px 16px; border-bottom: 1px solid #eee;
          font-weight: 600; font-size: 14px; color: #333;
          cursor: move;
        }
        #ltc-dialog-close {
          background: none; border: none; font-size: 20px; color: #999;
          cursor: pointer; line-height: 1; user-select: none;
        }
        #ltc-dialog-close:hover { color: #333; }
        #ltc-dialog-body {
          padding: 12px 16px; overflow-y: auto; flex: 1;
          user-select: text;
        }
        .ltc-dg-row {
          display: flex; align-items: center; margin-bottom: 8px;
        }
        .ltc-dg-row label {
          width: 165px; font-size: 12px; color: #555; flex-shrink: 0;
        }
        .ltc-dg-row input, .ltc-dg-row select {
          flex: 1; padding: 5px 8px; border: 1px solid #ccc;
          border-radius: 4px; font-size: 12px;
        }
        .ltc-dg-row input.ltc-invalid {
          border-color: #e74c3c;
          background: #fdf2f2;
        }
        .ltc-dg-section {
          font-weight: 600; font-size: 11px; color: #0F6E56;
          margin: 10px 0 4px; text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        #ltc-dialog-footer {
          padding: 10px 16px; border-top: 1px solid #eee;
          text-align: right;
        }
        #ltc-generate-btn {
          background: #1D9E75; color: #fff; border: none;
          padding: 8px 18px; border-radius: 6px; font-size: 13px;
          font-weight: 600; cursor: pointer;
        }
        #ltc-generate-btn:hover { filter: brightness(0.92); }
      `;
      document.head.appendChild(style);
    }
  }

  // --- VALIDATION ---
  // dg-emp-name, dg-designation, dg-cadre are read-only context fields — excluded
  function validateDialogFields(dialog) {
    const requiredFields = [
      { id: 'dg-doj',         label: 'Date of Joining FCI' },
      { id: 'dg-block-year',  label: 'Block Year' },
      { id: 'dg-leave-days',  label: 'Leave Days Applied' },
      { id: 'dg-leave-type',  label: 'Leave Type' },
      { id: 'dg-leave-from',  label: 'Leave From Date' },
      { id: 'dg-leave-to',    label: 'Leave To Date' },
      { id: 'dg-destination', label: 'Destination' }
    ];

    let allValid = true;
    for (let field of requiredFields) {
      const el = dialog.querySelector('#' + field.id);
      if (!el || !el.value.trim()) {
        el.classList.add('ltc-invalid');
        allValid = false;
        setTimeout(function () { el.classList.remove('ltc-invalid'); }, 3000);
      } else {
        el.classList.remove('ltc-invalid');
      }
    }
    if (!allValid) console.warn(LOG + ' Validation failed: some required fields are empty.');
    return allValid;
  }

  // --- HELPER: Calculate years of service ---
  function calcYearsOfService(dojStr) {
    // dojStr is in DD/MM/YYYY format
    const parts = dojStr.split('/');
    if (parts.length !== 3) return 'one year';
    const doj  = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    const today = new Date();
    let years = today.getFullYear() - doj.getFullYear();
    const monthDiff = today.getMonth() - doj.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < doj.getDate())) years--;
    if (years <= 0) return 'one year';
    return years + ' years';
  }

  // --- REMARK BUILDER ---
  function buildDynamicRemark(dialog) {
    const doj           = dialog.querySelector('#dg-doj').value.trim();
    const blockYear     = dialog.querySelector('#dg-block-year').value.trim();
    const ltc2024       = dialog.querySelector('#dg-ltc-2024').value;
    const ltc2025       = dialog.querySelector('#dg-ltc-2025').value;
    const spouseWork    = dialog.querySelector('#dg-spouse-working').value;
    const spouseLetter  = dialog.querySelector('#dg-spouse-letter').value;
    const leaveDays     = dialog.querySelector('#dg-leave-days').value.trim();
    const leaveType     = dialog.querySelector('#dg-leave-type').value.trim().replace(/\s+/g, ' ');
    const leaveFrom     = dialog.querySelector('#dg-leave-from').value.trim();
    const leaveTo       = dialog.querySelector('#dg-leave-to').value.trim();
    const destination   = dialog.querySelector('#dg-destination').value.trim();
    const leaveApproved = dialog.querySelector('#dg-leave-approved').value;

    // Calculate years of service
    const yearsOfService = calcYearsOfService(doj);

    // LTC availed sentence
    const ltc2024Text = ltc2024 ? ltc2024.toLowerCase() : '';
    const ltc2025Text = ltc2025 ? ltc2025.toLowerCase() : '';
    let ltcAvailedText = '';
    if (ltc2024 && ltc2025) {
      ltcAvailedText = 'The official has availed the ' + ltc2024Text + ' LTC in year 2024 and ' + ltc2025Text + ' LTC in year 2025. ';
    } else if (ltc2024) {
      ltcAvailedText = 'The official has availed the ' + ltc2024Text + ' LTC in year 2024 and has not availed the Home Town LTC in year 2025. ';
    } else if (ltc2025) {
      ltcAvailedText = 'The official has not availed the Home Town LTC in year 2024 and has availed the ' + ltc2025Text + ' LTC in year 2025. ';
    } else {
      ltcAvailedText = 'The official has not availed the Home Town LTC in year 2024 and 2025. ';
    }

    // Spouse sentence
    let spouseText = '';
    if (spouseWork === 'Yes') {
      spouseText = "The employee's spouse is working";
      if (spouseLetter === 'Yes') {
        spouseText += ", and has provided the letter issued from the spouse's organization regarding the LTC facility not being claimed from other organization. ";
      } else {
        spouseText += ". ";
      }
    } else {
      spouseText = "The employee's spouse is not working. ";
    }

    // Leave sentence
    let leaveText = '';
    if (leaveDays && leaveType && leaveFrom && leaveTo) {
      leaveText = 'The official has separately applied for ' + leaveDays + ' days ' + leaveType +
        ' from ' + leaveFrom + ' to ' + leaveTo +
        ' to undertake the journey on LTC \u2013 Home Town to ' + destination +
        ', which has been ' + (leaveApproved === 'Yes' ? 'approved' : 'not approved') +
        ' by the authority. ';
    }

    const yearOfLeave = leaveFrom ? leaveFrom.split('/')[2] : '';

    return 'With respect to the current request under consideration, the salient points are as follows:- ' +
      'The official joined the service of the corporation on ' + doj +
      ', and as the official has served for more than ' + yearsOfService + ' in the corporation, the official is presently eligible for LTC. ' +
      ltcAvailedText +
      spouseText +
      leaveText +
      'In view of this, LTC \u2013 Home Town for block year ' + blockYear +
      ' may please be sanctioned to the official for the year ' + yearOfLeave + '.';
  }

  // --- SEND BACK HANDLERS ---
  function handleSendBack(lastAssistantReviewed, entries, officeValue, isRoChandigarh) {
    const remark = STAGE3B_REMARK_TEMPLATE.replace('{SLNO}', lastAssistantReviewed.slNo);
    routeSendBack(entries, officeValue, isRoChandigarh, remark, '3b');
  }

  function handleSendBackFromDialog(lastAssistantReviewed, entries, officeValue, isRoChandigarh) {
    routeSendBack(entries, officeValue, isRoChandigarh, STAGE3B_LEAVE_NOT_APPROVED_REMARK, '3b-leave');
  }

  // --- SHARED SEND BACK ROUTING ---
  function routeSendBack(entries, officeValue, isRoChandigarh, remark, stageKey) {
    if (isRoChandigarh) {
      const initiatorEntry = entries.find(function (e) { return e.actionTaken === 'Initiated'; });
      if (!initiatorEntry) {
        console.warn(LOG + ' Stage 3B-RO: Could not find initiator entry.');
        alert('Could not identify the request initiating employee. Please handle manually.');
        return;
      }
      console.log(LOG + ' Stage 3B-RO: Sending back to: ' + initiatorEntry.employeeName);
      sessionStorage.setItem('fci_ltc_stage', stageKey + '-ro');
      sessionStorage.setItem('fci_ltc_office_type', OFFICE_TYPE_RO);
      sessionStorage.setItem('fci_ltc_target_office', 'RO CHANDIGARH');
      sessionStorage.setItem('fci_ltc_target_employee_name', initiatorEntry.employeeName);
      sessionStorage.setItem('fci_ltc_assistant_remark', remark);
      sessionStorage.setItem('fci_ltc_triggered', 'yes');
      setTimeout(clickAddReviewer, 2000);

    } else {
      let agmIndex = -1;
      for (let i = 0; i < entries.length; i++) {
        if (entries[i].designation.trim() === AGM_DESIGNATION
            && entries[i].remark.trim() !== 'N/A'
            && entries[i].remark.trim() !== '') {
          agmIndex = i;
        }
      }
      const doManagerEntry = agmIndex > 0 ? entries[agmIndex - 1] : null;
      if (!doManagerEntry) {
        console.warn(LOG + ' Stage 3B: Could not identify DO Manager.');
        alert('Could not identify DO Manager. Please handle manually.');
        return;
      }
      console.log(LOG + ' Stage 3B: Sending back to DO Manager: ' + doManagerEntry.employeeName);
      sessionStorage.setItem('fci_ltc_stage', stageKey);
      sessionStorage.setItem('fci_ltc_office_type', OFFICE_TYPE_DO);
      sessionStorage.setItem('fci_ltc_target_office', officeValue.trim().replace(/\s+/g, ' ').toUpperCase());
      sessionStorage.setItem('fci_ltc_target_employee_name', doManagerEntry.employeeName);
      sessionStorage.setItem('fci_ltc_assistant_remark', remark);
      sessionStorage.setItem('fci_ltc_triggered', 'yes');
      setTimeout(clickAddReviewer, 2000);
    }
  }

  // --- OPEN ATTACHMENTS ---
  function openAllAttachments() {
    console.log(LOG + ' Scanning for attachments...');
    const allLinks = document.querySelectorAll('a');
    let openedCount = 0;
    for (let link of allLinks) {
      const href      = link.href || '';
      const hrefLower = href.toLowerCase();
      const isFileResource = /\/(uploads|documents|files)\//i.test(href) ||
                             /\.(pdf|jpg|jpeg|png|doc|docx)$/i.test(href);
      if (isFileResource && href && !hrefLower.includes('javascript') && !hrefLower.includes('#')) {
        chrome.runtime.sendMessage({ action: 'openTabInBackground', url: href });
        openedCount++;
      }
    }
    console.log(LOG + ' Opened ' + openedCount + ' attachment(s) in background tabs.');
  }

  // --- HELPERS ---

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
      console.warn(LOG + ' Trigger row not found for highlighting.');
      return;
    }
    targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    let flashCount = 0;
    const originalBg = targetRow.style.backgroundColor;
    const flashInterval = setInterval(function () {
      flashCount++;
      targetRow.style.backgroundColor = (flashCount % 2 === 1) ? '#fff3cd' : '';
      if (flashCount >= 6) {
        clearInterval(flashInterval);
        targetRow.style.backgroundColor = '#fff3cd';
        setTimeout(function () { targetRow.style.backgroundColor = originalBg; }, 1800);
      }
    }, 300);
  }

  function decideAssistant(cadreRaw, officeRaw) {
    const cadre  = (cadreRaw  || '').trim().replace(/\s+/g, ' ').toUpperCase();
    const office = (officeRaw || '').trim().replace(/\s+/g, ' ').toUpperCase();
    console.log(LOG + ' decideAssistant: Cadre="' + cadre + '" Office="' + office + '"');

    if (cadre.includes('GENERAL')) {
      return ASSISTANT_GENERAL;
    } else if (cadre.includes('DEPOT')) {
      const divyaNorm   = DIVYA_OFFICES.map(function (o) { return o.trim().replace(/\s+/g, ' ').toUpperCase(); });
      const vishaliNorm = VISHALI_OFFICES.map(function (o) { return o.trim().replace(/\s+/g, ' ').toUpperCase(); });
      if (divyaNorm.includes(office))   return ASSISTANT_DIVYA;
      if (vishaliNorm.includes(office)) return ASSISTANT_VISHALI;
      console.warn(LOG + ' Depot cadre — Office "' + office + '" not in any known group. No action taken.');
      return null;
    } else {
      console.warn(LOG + ' Unrecognised Cadre: "' + cadre + '". No action taken.');
      return null;
    }
  }

  function clickAddReviewer() {
    const allLinks = document.querySelectorAll('a, button');
    for (let el of allLinks) {
      if (el.textContent.trim() === 'Add Reviewer') {
        console.log(LOG + ' Clicking "Add Reviewer"...');
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        return;
      }
    }
    console.warn(LOG + ' "Add Reviewer" button not found.');
  }

  function fillReviewerRemarks(remarkText) {
    const editor   = document.getElementById('editor');
    const textarea = document.getElementById('comments');
    if (!editor) {
      console.warn(LOG + ' Reviewer Remarks editor (#editor) not found. Retrying...');
      setTimeout(function () { fillReviewerRemarks(remarkText); }, 1500);
      return;
    }
    editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
    editor.innerText = remarkText;
    if (textarea) textarea.value = remarkText;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.dispatchEvent(new Event('blur',  { bubbles: true }));
    console.log(LOG + ' Reviewer Remarks filled.');
    console.log(LOG + ' *** Please verify the remark and attachments, then click Review yourself. ***');
  }

  function getFieldValue(fieldName) {
    const listItems = document.querySelectorAll('li');
    for (let li of listItems) {
      const label = li.querySelector('label');
      const span  = li.querySelector('span');
      if (!label || !span) continue;
      if (label.getAttribute('for') === fieldName) return span.textContent.trim();
      const labelText  = label.textContent.trim().toLowerCase().replace(/\s+/g, ' ');
      const targetText = fieldName.toLowerCase().replace(/_/g, ' ').trim();
      if (labelText === targetText || labelText.includes(targetText)) return span.textContent.trim();
    }
    return '';
  }

  function getLabelledField(labelText) {
    const bodyText = document.body.innerText || '';
    const lines = bodyText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().toLowerCase() === labelText.toLowerCase()) {
        for (let j = i + 1; j < lines.length; j++) {
          const value = lines[j].trim();
          if (value && value.toLowerCase() !== labelText.toLowerCase()) {
            return value;
          }
        }
      }
    }
    return '';
  }

  function escAttr(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

})();