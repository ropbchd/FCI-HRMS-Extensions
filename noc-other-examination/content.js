// FCI NOC Assistant - Content Script
// Runs on every NOC review page.
// Checks action history and routes to the correct next step.

(function () {

  // --- CONFIGURATION ---

  // STAGE 1 trigger: Last Dispatched = MAYURESH KUMAR, next = AMIT KUMAR SINGH (Pending Review, N/A)
  // Action: Add Reviewer = ABHIMANYU SWAMI (276695)
  const STAGE1_DISPATCHER_NAME  = 'MAYURESH KUMAR';
  const STAGE1_NEXT_NAME        = 'AMIT KUMAR SINGH';
  const STAGE1_NEXT_ACTION      = 'Pending Review';
  const STAGE1_NEXT_REMARK      = 'N/A';

  // STAGE 2 trigger: Last Reviewed = ABHIMANYU SWAMI (276695), next = AMIT KUMAR SINGH (Pending Review, N/A)
  // Action: Add Reviewer = one of three assistants based on Cadre + Office
  const STAGE2_LAST_REVIEWER_NAME   = 'ABHIMANYU SWAMI';
  const STAGE2_LAST_REVIEWER_NUMBER = '276695';
  const STAGE2_NEXT_NAME            = 'AMIT KUMAR SINGH';
  const STAGE2_NEXT_ACTION          = 'Pending Review';
  const STAGE2_NEXT_REMARK          = 'N/A';

  // Assistant routing for Stage 2
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

  const ASSISTANT_REMARK = 'Kindly review for admin. clearance and check for the details.';
  const PERFORMA_REMARK   = 'Kindly provide the details as per the performa provided by the FCI, Zonal Office (N).';
  const STAGE1C_REMARK = 'With respect to the application made by the employee, kindly provide the vigilance clearance for the purpose of NOC for other exam.';
  const STAGE1C_TARGET_NAME   = 'ABHIMANYU SWAMI';
  const STAGE1C_TARGET_NUMBER = '276695';

  // STAGE 3: Last Reviewed = one of the three assistants, next = AMIT KUMAR SINGH (Pending Review, N/A)
  // AND that last reviewed remark contains the key sentence → fill Reviewer Remarks directly on this page
  const STAGE3_KEY_SENTENCE = 'the said request has been found to be in order and in accordance with the applicable policies, circulars, and advisories presently in';

  const STAGE3_REMARK_NON_RO = 'With reference to the application for a No Objection Certificate (NOC) to appear in another examination, it is respectfully submitted that the employee is clear from the vigilance perspective at the Divisional Office and Regional Office, and the administrative clearances from the Divisional and Regional Offices are also in place. The request is in compliance with the previously issued advisory on such matters. In view of the above, and considering that all requisite clearances have been duly obtained, if agreed, the NOC for appearing in the said examination may kindly be approved.';

  const STAGE3_REMARK_RO = 'With reference to the application for a No Objection Certificate (NOC) to appear in another examination, it is respectfully submitted that the employee is clear from the vigilance  and administrative perspective at  Regional Office, level. The request is in compliance with the previously issued advisory on such matters. In view of the above, and considering that all requisite clearances have been duly obtained, if agreed, the NOC for appearing in the said examination may kindly be approved.';

  // STAGE 3B / 3C: Designation landmark used to find the DO Manager (person of interest)
  // The DO Manager = entry immediately before the AGM entry that has a non-N/A remark
  const AGM_DESIGNATION = 'Assistant General Manager';

  // Stage 1D: Technical Error Handler
  // Pattern: Technical error entry (BALJIT SINGH or similar) → ABHIMANYU SWAMI (Reviewed) → AMIT KUMAR SINGH (Pending Review, N/A)
  const STAGE1D_TECHNICAL_ERROR_KEYWORDS = [
    'attachments submitted with the request are not accessible',
    'technical error',
    'cannot be reviewed',
    'not accessible for viewing or downloading'
  ];

  // Stage 3E: Pending Vigilance Case Handler
  // Pattern: Assistant reviewed → AMIT KUMAR SINGH (Pending Review, N/A)
  //          AND BALJIT SINGH's last entry contains "PENDING" or "INVOLVED"
  const STAGE3E_VIGILANCE_KEYWORDS = ['PENDING', 'INVOLVED'];

  // Office Type values on the Add Reviewer page
  const OFFICE_TYPE_RO = '4';   // value="4" = RO (confirmed)
  const OFFICE_TYPE_DO = '5';   // value="5" = DO (confirmed from portal inspector)
  // ----------------------

  // Helper: Check if a remark contains technical error keywords
  function hasTechnicalError(remark) {
    const lowerRemark = remark.toLowerCase();
    return STAGE1D_TECHNICAL_ERROR_KEYWORDS.some(function(keyword) {
      return lowerRemark.includes(keyword);
    });
  }

  // Helper: Check if a remark contains vigilance keywords (PENDING or INVOLVED)
  function hasVigilanceIssue(remark) {
    const upperRemark = remark.toUpperCase();
    return STAGE3E_VIGILANCE_KEYWORDS.some(function(keyword) {
      return upperRemark.includes(keyword);
    });
  }

  // Helper: Find the last BALJIT SINGH entry
  function getLastBaljitEntry(entries) {
    let lastBaljitIndex = -1;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].employeeName.toUpperCase().includes('BALJIT SINGH')) {
        lastBaljitIndex = i;
      }
    }
    return lastBaljitIndex !== -1 ? entries[lastBaljitIndex] : null;
  }

  // Helper: Get ordinal suffix for a number (1st, 2nd, 3rd, 4th, 11th, 12th, 13th...)
  function getOrdinal(n) {
    if (n === 0) return '0th';
    const lastDigit = n % 10;
    const lastTwoDigits = n % 100;
    if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
      return n + 'th';
    }
    switch (lastDigit) {
      case 1: return n + 'st';
      case 2: return n + 'nd';
      case 3: return n + 'rd';
      default: return n + 'th';
    }
  }

  // Helper: Find the requesting employee (S.No. 1 - Initiated entry)
  function getRequestingEmployee(entries) {
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].actionTaken === 'Initiated') {
        return {
          name: entries[i].employeeName,
          office: entries[i].actionOffice || entries[i].office || null,
          empNo: entries[i].employeeNumber || null
        };
      }
    }
    return null;
  }

  // Helper: Read a specific field value from the page by its label's "for" attribute
  function getFieldValue(fieldName) {
    const listItems = document.querySelectorAll('li');
    for (let li of listItems) {
      const label = li.querySelector('label');
      const span  = li.querySelector('span');
      if (!label || !span) continue;
      if (label.getAttribute('for') === fieldName) {
        return span.textContent.trim();
      }
    }
    return '';
  }

  // STEP 1: Click View Action History
  function clickViewActionHistory() {
    let btn = document.querySelector('a.view-action-history');
    if (!btn) {
      const allLinks = document.querySelectorAll('a, button');
      for (let el of allLinks) {
        if (el.textContent.trim() === 'View Action History') { btn = el; break; }
      }
    }
    if (btn) {
      console.log('[FCI NOC Assistant] Step 1: Clicking "View Action History"...');
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      waitForTableAndCheck();
    } else {
      console.warn('[FCI NOC Assistant] "View Action History" button not found. Retrying in 2s...');
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

        // Scroll the action history table into view so it is visible on screen
        const table = document.querySelector('#custom-action-history-tbl');
        if (table) {
          table.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        console.log('[FCI NOC Assistant] Step 2: Table populated. Checking conditions...');
        checkConditionsAndAct(tbody);
      } else if (attempts >= 20) {
        clearInterval(interval);
        console.warn('[FCI NOC Assistant] Table did not load in time.');
      }
    }, 500);
  }

  // Helper: Check if ABHIMANYU SWAMI has already reviewed in the action history
  function isAbhimanyuInHistory(entries) {
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].actionTaken === 'Reviewed'
          && entries[i].employeeName.toUpperCase().includes('ABHIMANYU SWAMI')) {
        return true;
      }
    }
    return false;
  }

  // Helper: Read Cadre and Office from the page
  function getCadreAndOffice() {
    const cadreValue = getFieldValue('cadre');
    const officeValue = getFieldValue('office');
    const isRoChandigarh = officeValue.trim().replace(/\s+/g, ' ').toUpperCase() === 'RO CHANDIGARH';
    return { cadreValue, officeValue, isRoChandigarh };
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
          slNo:         cells[0].textContent.trim(),   // S.No. — used in Stage 3B remark
          actionTaken:  cells[3].textContent.trim(),
          employeeName: cells[4].textContent.trim(),
          designation:  cells[5].textContent.trim(),   // needed for AGM landmark detection
          actionOffice: cells[2] ? cells[2].textContent.trim() : '', // Action Office
          employeeNumber: cells[4].textContent.match(/\d{6}/) ? cells[4].textContent.match(/\d{6}/)[0] : '',
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

    // --- READ CADRE AND OFFICE FIRST (before any stage checks) ---
    const { cadreValue, officeValue, isRoChandigarh } = getCadreAndOffice();
    console.log('[FCI NOC Assistant] Office read from page: "' + officeValue + '"');
    console.log('[FCI NOC Assistant] Cadre read from page:  "' + cadreValue + '"');
    console.log('[FCI NOC Assistant] isRoChandigarh: ' + isRoChandigarh);

    // --- Find the DO Manager (entry just before the AGM with non-N/A remark) ---
    // Used by Stage 3B, 3C, and Stage 1D (Non-RO)
    let agmIndex = -1;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].designation.trim() === AGM_DESIGNATION
          && entries[i].remark.trim() !== 'N/A'
          && entries[i].remark.trim() !== '') {
        agmIndex = i;
        break;  // there is only one such AGM entry — stop at first match
      }
    }
    const doManagerEntry = agmIndex > 0 ? entries[agmIndex - 1] : null;

    // --- Check STAGE 2 first (more specific) ---
    // Last "Reviewed" entry = ABHIMANYU SWAMI
    let lastReviewedIndex = -1;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].actionTaken === 'Reviewed') lastReviewedIndex = i;
    }
    const lastReviewed = lastReviewedIndex !== -1 ? entries[lastReviewedIndex] : null;
    const afterReviewed = lastReviewed ? entries[lastReviewedIndex + 1] || null : null;

    const stage2 = lastReviewed
      && lastReviewed.employeeName.toUpperCase().includes(STAGE2_LAST_REVIEWER_NAME)
      && afterReviewed
      && afterReviewed.employeeName.toUpperCase().includes(STAGE2_NEXT_NAME)
      && afterReviewed.actionTaken.trim() === STAGE2_NEXT_ACTION
      && afterReviewed.remark.trim() === STAGE2_NEXT_REMARK;

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

    // --- Find the last assistant reviewed entry (used by Stage 3, 3B, 3C, 3E) ---
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

    // --- Stage 3 key sentence check (negative-safe) ---
    // Ensures "not been found to be in order" does NOT trigger Stage 3
    const stage3KeyPresent = lastAssistantReviewed && (function() {
      const remark = lastAssistantReviewed.remark.toLowerCase();
      const idx = remark.indexOf(STAGE3_KEY_SENTENCE);
      if (idx === -1) return false;
      // Check the 25 characters immediately before the key sentence for negation
      const preceding = remark.substring(Math.max(0, idx - 25), idx);
      return !(/\bnot\b/.test(preceding));
    })();

    // --- Check STAGE 3 (assistant confirmed in order) ---
    const stage3 = stage3KeyPresent
      && afterAssistantReviewed
      && afterAssistantReviewed.employeeName.toUpperCase().includes(STAGE2_NEXT_NAME)
      && afterAssistantReviewed.actionTaken.trim() === STAGE2_NEXT_ACTION
      && afterAssistantReviewed.remark.trim() === STAGE2_NEXT_REMARK;

    // --- Check STAGE 3E (Pending Vigilance Case) ---
    // Conditions:
    // 1. Last Reviewed = Assistant
    // 2. Assistant's remark does NOT contain "in order" key sentence
    // 3. Next = AMIT KUMAR SINGH (Pending Review, N/A)
    // 4. Last BALJIT SINGH entry contains "PENDING" or "INVOLVED"
    const lastBaljit = getLastBaljitEntry(entries);
    const baljitHasVigilance = lastBaljit && hasVigilanceIssue(lastBaljit.remark);

    const stage3e = lastAssistantReviewed
      && !stage3KeyPresent   // key sentence absent OR negated
      && afterAssistantReviewed
      && afterAssistantReviewed.employeeName.toUpperCase().includes(STAGE2_NEXT_NAME)
      && afterAssistantReviewed.actionTaken.trim() === STAGE2_NEXT_ACTION
      && afterAssistantReviewed.remark.trim() === STAGE2_NEXT_REMARK
      && baljitHasVigilance;  // BALJIT SINGH's last entry has PENDING/INVOLVED

    // --- Check STAGE 3B (assistant found issue → send back to DO) ---
    // Trigger: last assistant reviewed + remark NOT in order
    //          + next = AMIT KUMAR SINGH (Pending Review, N/A)
    //          + office is NOT RO CHANDIGARH
    //          + NOT Stage 3E (Stage 3E takes priority)
    const stage3bAssistantIssue = lastAssistantReviewed
      && !stage3KeyPresent   // key sentence absent OR negated
      && lastAssistantReviewed.remark.trim() !== ''   // assistant did leave a substantive remark
      && afterAssistantReviewed
      && afterAssistantReviewed.employeeName.toUpperCase().includes(STAGE2_NEXT_NAME)
      && afterAssistantReviewed.actionTaken.trim() === STAGE2_NEXT_ACTION
      && afterAssistantReviewed.remark.trim() === STAGE2_NEXT_REMARK
      && !stage3e;  // Stage 3E takes priority over Stage 3B

    // --- Check STAGE 3C (DO has reprocessed → send to assistant again) ---
    // Trigger: last substantive entry before AMIT KUMAR SINGH (Pending Review, N/A)
    //          is the DO Manager identified above (same person we sent 3B to)
    // Find the last entry before the final AMIT Pending Review + N/A block
    let lastAmitPendingIndex = -1;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].employeeName.toUpperCase().includes(STAGE2_NEXT_NAME)
          && entries[i].actionTaken.trim() === STAGE2_NEXT_ACTION
          && entries[i].remark.trim() === STAGE2_NEXT_REMARK) {
        lastAmitPendingIndex = i;
      }
    }
    const entryBeforeAmitPending = lastAmitPendingIndex > 0 ? entries[lastAmitPendingIndex - 1] : null;

    const stage3c = doManagerEntry
      && entryBeforeAmitPending
      && entryBeforeAmitPending.employeeName.toUpperCase().trim()
           === doManagerEntry.employeeName.toUpperCase().trim()
      && lastAmitPendingIndex !== -1
      // Make sure we are not in Stage 2, Stage 3, Stage 3E, or Stage 3B already (those take priority)
      && !stage2
      && !stage3
      && !stage3e
      && !stage3bAssistantIssue;

    // --- STAGE 1D: Technical Error Handler ---
    // Pattern: Technical error entry (BALJIT SINGH) → ABHIMANYU SWAMI (Reviewed) → AMIT KUMAR SINGH (Pending Review, N/A)
    let technicalErrorIndex = -1;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].actionTaken === 'Reviewed' && hasTechnicalError(entries[i].remark)) {
        technicalErrorIndex = i;
        break; // Use the first/only one
      }
    }

    const techErrorEntry = technicalErrorIndex !== -1 ? entries[technicalErrorIndex] : null;
    const afterTechError = technicalErrorIndex !== -1 && technicalErrorIndex + 1 < entries.length 
      ? entries[technicalErrorIndex + 1] : null;
    const afterTechError2 = technicalErrorIndex !== -1 && technicalErrorIndex + 2 < entries.length 
      ? entries[technicalErrorIndex + 2] : null;

    const stage1d = techErrorEntry
      && afterTechError
      && afterTechError.actionTaken === 'Reviewed'
      && afterTechError.employeeName.toUpperCase().includes('ABHIMANYU SWAMI')
      && afterTechError2
      && afterTechError2.employeeName.toUpperCase().includes(STAGE2_NEXT_NAME)
      && afterTechError2.actionTaken.trim() === STAGE2_NEXT_ACTION
      && afterTechError2.remark.trim() === STAGE2_NEXT_REMARK;

    // --- Check STAGE 1C (assistant completed performa, send to ABHIMANYU SWAMI) ---
    // Trigger: Last Reviewed = assistant, NO ABHIMANYU SWAMI in history yet, Office = RO CHANDIGARH
    const abhimanyuPresent = isAbhimanyuInHistory(entries);
    const stage1c = lastAssistantReviewed
      && !abhimanyuPresent
      && isRoChandigarh
      && afterAssistantReviewed
      && afterAssistantReviewed.employeeName.toUpperCase().includes(STAGE2_NEXT_NAME)
      && afterAssistantReviewed.actionTaken.trim() === STAGE2_NEXT_ACTION
      && afterAssistantReviewed.remark.trim() === STAGE2_NEXT_REMARK;

    // Stage 3B only applies when office is NOT RO CHANDIGARH
    const stage3b = stage3bAssistantIssue && !isRoChandigarh;

    console.log('[FCI NOC Assistant] Stage 3  (Fill Reviewer Remarks - Approval): ' + (stage3  ? 'MATCH' : 'no match'));
    console.log('[FCI NOC Assistant] Stage 3E (Fill Reviewer Remarks - Pending Vigilance): ' + (stage3e ? 'MATCH' : 'no match'));
    console.log('[FCI NOC Assistant] Stage 3B (Send back to DO):             ' + (stage3b ? 'MATCH' : 'no match'));
    console.log('[FCI NOC Assistant] Stage 3C (Re-send to assistant):        ' + (stage3c ? 'MATCH' : 'no match'));
    console.log('[FCI NOC Assistant] Stage 1D (Technical Error Handler):     ' + (stage1d ? 'MATCH' : 'no match'));
    console.log('[FCI NOC Assistant] Stage 2  (Send to Assistant):           ' + (stage2  ? 'MATCH' : 'no match'));
    console.log('[FCI NOC Assistant] Stage 1  (Send to ABHIMANYU SWAMI):     ' + (stage1  ? 'MATCH' : 'no match'));
    console.log('[FCI NOC Assistant] Stage 1C (Send to ABHIMANYU after performa): ' + (stage1c ? 'MATCH' : 'no match'));
    if (doManagerEntry) {
      console.log('[FCI NOC Assistant] DO Manager identified: "' + doManagerEntry.employeeName + '" (S.No. ' + doManagerEntry.slNo + ')');
    }

    // --- Stage priority: 3 → 3E → 3B → 3C → 1D → 2 → 1C → 1B → 1 ---

    if (stage3) {
      // Stage 3: Assistant has confirmed request is in order → fill Reviewer Remarks directly
      const assistantName = lastAssistantReviewed ? lastAssistantReviewed.employeeName : 'Assistant';
      console.log('[FCI NOC Assistant] Stage 3: Key sentence found in remark by ' + assistantName + '. Filling Reviewer Remarks...');
      highlightTriggerRow(tbody, assistantName, 'Reviewed');
      const remarkToFill = isRoChandigarh ? STAGE3_REMARK_RO : STAGE3_REMARK_NON_RO;
      setTimeout(function() { fillReviewerRemarks(remarkToFill, false); }, 2000);

    } else if (stage3e) {
      // Stage 3E: Pending Vigilance Case detected → Fill proposal remark directly on Review Page
      const assistantName = lastAssistantReviewed ? lastAssistantReviewed.employeeName : 'Assistant';
      console.log('[FCI NOC Assistant] Stage 3E: Pending vigilance case detected by ' + assistantName + '. Filling proposal remark...');
      highlightTriggerRow(tbody, assistantName, 'Reviewed');
      
      // Read fields from the page using the correct for attribute values
      const employeeName = getFieldValue('employee_name') || 'the official';
      const designation = getFieldValue('designation') || '';
      const cadre = getFieldValue('cadre') || '';
      const examName = getFieldValue('examination_name') || 'the examination';
      const nocApprovedStr = getFieldValue('nNOCApproved') || '0';
      const nocCount = parseInt(nocApprovedStr, 10) || 0;
      const ordinalCount = getOrdinal(nocCount + 1);
      
      // Build the dynamic remark with HTML formatting for bold text
      const stage3eRemark = 'Sh. ' + employeeName + ', ' + designation + ' (' + cadre + '), has requested issuance of an NOC to appear in the ' + examName + '. While the official is clear from the administrative and vigilance angles at DO level and administrative angle at RO level, the official is not clear from the vigilance angle at RO level as there is a <b>vigilance case pending</b> against the official. This is the ' + ordinalCount + ' NOC request of the official for the current calendar year. As per FCI HQ Circular No. 01-2019-05 dated 17.01.2019 read with DoPT O.M. dated 23.12.2013, applications of officials with pending vigilance/prosecution issues cannot be forwarded or considered. In view of the above, the present request for issuance of NOC for appearing in the ' + examName + ' may be <b>rejected/reverted</b> in accordance with the said circular, for kind consideration and further necessary directions please.';
      
      console.log('[FCI NOC Assistant] Stage 3E: Filling remark: ' + stage3eRemark);
      setTimeout(function() { fillReviewerRemarks(stage3eRemark, true); }, 2000);

    } else if (stage3b) {
      // Stage 3B: Assistant found issue → send request back to DO Manager
      if (!doManagerEntry) {
        console.warn('[FCI NOC Assistant] Stage 3B: Could not identify DO Manager. No action taken.');
        return;
      }
      const assistantSlNo   = lastAssistantReviewed.slNo;
      const assistantName   = lastAssistantReviewed.employeeName;
      const doManagerName   = doManagerEntry.employeeName;
      const stage3bRemark   = 'Reference may be made to the observations recorded during examination of the request at Sl. No. ' + assistantSlNo + '. Required necessary clarifications and/or supporting documents, as indicated, may kindly be furnished for further processing.';

      console.log('[FCI NOC Assistant] Stage 3B: Issue found by ' + assistantName + ' (S.No. ' + assistantSlNo + '). Sending back to DO Manager: ' + doManagerName);
      highlightTriggerRow(tbody, assistantName, 'Reviewed');

      sessionStorage.setItem('fci_noc_stage', '3b');
      sessionStorage.setItem('fci_noc_office_type', OFFICE_TYPE_DO);
      sessionStorage.setItem('fci_noc_target_office', officeValue.trim().replace(/\s+/g, ' ').toUpperCase());
      sessionStorage.setItem('fci_noc_target_employee_name', doManagerName);
      sessionStorage.setItem('fci_noc_assistant_remark', stage3bRemark);
      // Clear assistant emp fields — Stage 3B selects by name search, not emp number
      sessionStorage.removeItem('fci_noc_assistant_emp');
      sessionStorage.removeItem('fci_noc_assistant_name');
      setTimeout(clickAddReviewer, 2000);

    } else if (stage3c) {
      // Stage 3C: DO has reprocessed and sent back → re-send to assistant for rechecking
      const assistant = decideAssistant(cadreValue, officeValue);
      if (!assistant) return;
      console.log('[FCI NOC Assistant] Stage 3C: DO Manager "' + doManagerEntry.employeeName + '" has sent back. Re-routing to ' + assistant.name + '...');
      highlightTriggerRow(tbody, doManagerEntry.employeeName, entryBeforeAmitPending.actionTaken);

      sessionStorage.setItem('fci_noc_stage', '3c');
      sessionStorage.setItem('fci_noc_office_type', OFFICE_TYPE_RO);
      sessionStorage.setItem('fci_noc_assistant_emp', assistant.empNo);
      sessionStorage.setItem('fci_noc_assistant_name', assistant.name);
      sessionStorage.setItem('fci_noc_assistant_remark', ASSISTANT_REMARK);
      sessionStorage.removeItem('fci_noc_target_office');
      sessionStorage.removeItem('fci_noc_target_employee_name');
      setTimeout(clickAddReviewer, 2000);

    } else if (stage1d) {
      // Stage 1D: Technical error detected
      console.log('[FCI NOC Assistant] Stage 1D: Technical error detected in remark by ' + techErrorEntry.employeeName);
      
      if (isRoChandigarh) {
        // Office = RO CHANDIGARH → send back to requesting employee (S.No. 1)
        const requestingEmployee = getRequestingEmployee(entries);
        if (!requestingEmployee) {
          console.warn('[FCI NOC Assistant] Stage 1D (RO): Could not identify requesting employee. No action taken.');
          return;
        }
        
        const technicalRemark = 'The attachments submitted with the request are not accessible for viewing or downloading due to a technical error. Kindly re-submit the required documents/attachments for further processing.';
        
        // For RO CHANDIGARH: Office Type = RO (value "4"), Office = RO CHANDIGARH
        const targetOffice = 'RO CHANDIGARH';
        
        console.log('[FCI NOC Assistant] Stage 1D (RO): Sending back to requesting employee: ' + requestingEmployee.name + ' at ' + targetOffice);
        highlightTriggerRow(tbody, techErrorEntry.employeeName, 'Reviewed');
        
        sessionStorage.setItem('fci_noc_stage', '1d-ro');
        sessionStorage.setItem('fci_noc_office_type', OFFICE_TYPE_RO);
        sessionStorage.setItem('fci_noc_target_office', targetOffice);
        sessionStorage.setItem('fci_noc_target_employee_name', requestingEmployee.name);
        sessionStorage.setItem('fci_noc_assistant_remark', technicalRemark);
        sessionStorage.removeItem('fci_noc_assistant_emp');
        sessionStorage.removeItem('fci_noc_assistant_name');
        setTimeout(clickAddReviewer, 2000);
        
      } else {
        // Office ≠ RO CHANDIGARH → send back to DO Manager (same as Stage 3B)
        if (!doManagerEntry) {
          console.warn('[FCI NOC Assistant] Stage 1D (Non-RO): Could not identify DO Manager. No action taken.');
          return;
        }
        
        const technicalRemark = 'Due to an inadvertent technical issue, the documents earlier uploaded for processing the request are not accessible, as the attachments are not opening. It is therefore requested to kindly upload the requisite documents again and resubmit the request for further processing.';
        
        console.log('[FCI NOC Assistant] Stage 1D (Non-RO): Sending back to DO Manager: ' + doManagerEntry.employeeName);
        highlightTriggerRow(tbody, techErrorEntry.employeeName, 'Reviewed');
        
        sessionStorage.setItem('fci_noc_stage', '1d-do');
        sessionStorage.setItem('fci_noc_office_type', OFFICE_TYPE_DO);
        sessionStorage.setItem('fci_noc_target_office', officeValue.trim().replace(/\s+/g, ' ').toUpperCase());
        sessionStorage.setItem('fci_noc_target_employee_name', doManagerEntry.employeeName);
        sessionStorage.setItem('fci_noc_assistant_remark', technicalRemark);
        sessionStorage.removeItem('fci_noc_assistant_emp');
        sessionStorage.removeItem('fci_noc_assistant_name');
        setTimeout(clickAddReviewer, 2000);
      }

    } else if (stage2) {
      // Stage 2: Last Reviewed = ABHIMANYU SWAMI, next = AMIT KUMAR SINGH (Pending Review, N/A)
      const assistant = decideAssistant(cadreValue, officeValue);
      if (assistant) {
        console.log('[FCI NOC Assistant] Stage 2: Routing to ' + assistant.name + ' (' + assistant.empNo + ')');
        highlightTriggerRow(tbody, 'ABHIMANYU SWAMI', 'Reviewed');
        sessionStorage.setItem('fci_noc_stage', '2');
        sessionStorage.setItem('fci_noc_office_type', OFFICE_TYPE_RO);
        sessionStorage.setItem('fci_noc_assistant_emp', assistant.empNo);
        sessionStorage.setItem('fci_noc_assistant_name', assistant.name);
        sessionStorage.setItem('fci_noc_assistant_remark', ASSISTANT_REMARK);
        sessionStorage.removeItem('fci_noc_target_office');
        sessionStorage.removeItem('fci_noc_target_employee_name');
        setTimeout(clickAddReviewer, 2000);
      }

    } else if (stage1c) {
      // Stage 1C: Assistant has completed performa attachment → send to ABHIMANYU SWAMI for vigilance clearance
      console.log('[FCI NOC Assistant] Stage 1C: Assistant "' + lastAssistantReviewed.employeeName + '" has completed performa. ABHIMANYU SWAMI not in history yet. Sending to ABHIMANYU SWAMI for vigilance clearance...');
      highlightTriggerRow(tbody, lastAssistantReviewed.employeeName, 'Reviewed');

      sessionStorage.setItem('fci_noc_stage', '1c');
      sessionStorage.setItem('fci_noc_office_type', OFFICE_TYPE_RO);
      sessionStorage.setItem('fci_noc_assistant_emp', STAGE1C_TARGET_NUMBER);
      sessionStorage.setItem('fci_noc_assistant_name', STAGE1C_TARGET_NAME);
      sessionStorage.setItem('fci_noc_assistant_remark', STAGE1C_REMARK);
      sessionStorage.removeItem('fci_noc_target_office');
      sessionStorage.removeItem('fci_noc_target_employee_name');
      setTimeout(clickAddReviewer, 2000);

    } else if (stage1 && isRoChandigarh) {
      // Stage 1B: Same trigger as Stage 1 but Office = RO CHANDIGARH
      const assistant = decideAssistant(cadreValue, officeValue);
      if (assistant) {
        console.log('[FCI NOC Assistant] Stage 1B (RO CHANDIGARH): Routing to ' + assistant.name + ' (' + assistant.empNo + ')');
        highlightTriggerRow(tbody, 'MAYURESH KUMAR', 'Dispatched');
        sessionStorage.setItem('fci_noc_stage', '1b');
        sessionStorage.setItem('fci_noc_office_type', OFFICE_TYPE_RO);
        sessionStorage.setItem('fci_noc_assistant_emp', assistant.empNo);
        sessionStorage.setItem('fci_noc_assistant_name', assistant.name);
        sessionStorage.setItem('fci_noc_assistant_remark', PERFORMA_REMARK);
        sessionStorage.removeItem('fci_noc_target_office');
        sessionStorage.removeItem('fci_noc_target_employee_name');
        setTimeout(clickAddReviewer, 2000);
      }

    } else if (stage1) {
      // Stage 1: Office is not RO CHANDIGARH — send to ABHIMANYU SWAMI for vigilance clearance
      console.log('[FCI NOC Assistant] Stage 1: Routing to ABHIMANYU SWAMI...');
      highlightTriggerRow(tbody, 'MAYURESH KUMAR', 'Dispatched');
      sessionStorage.setItem('fci_noc_stage', '1');
      sessionStorage.setItem('fci_noc_office_type', OFFICE_TYPE_RO);
      sessionStorage.removeItem('fci_noc_assistant_emp');
      sessionStorage.removeItem('fci_noc_assistant_name');
      sessionStorage.removeItem('fci_noc_assistant_remark');
      sessionStorage.removeItem('fci_noc_target_office');
      sessionStorage.removeItem('fci_noc_target_employee_name');
      setTimeout(clickAddReviewer, 2000);

    } else {
      console.log('[FCI NOC Assistant] No matching stage found. No action taken.');
    }
  }

  // Highlight the trigger row with a flashing yellow effect and scroll it into view
  function highlightTriggerRow(tbody, targetName, targetAction) {
    const allRows = tbody.querySelectorAll('tr');
    let targetRow = null;

    for (let row of allRows) {
      const cells = row.querySelectorAll('td');
      if (cells.length === 8) {
        const action = cells[3].textContent.trim();
        const name   = cells[4].textContent.trim().toUpperCase();
        if (action === targetAction && name.includes(targetName.toUpperCase())) {
          targetRow = row; // keep looping to find the last match
        }
      }
    }

    if (!targetRow) {
      console.warn('[FCI NOC Assistant] Trigger row not found for highlighting.');
      return;
    }

    // Scroll the row into view
    targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Flash the row 3 times between yellow and normal
    const originalBg = targetRow.style.backgroundColor;
    let flashCount = 0;
    const flashInterval = setInterval(function () {
      flashCount++;
      targetRow.style.backgroundColor = (flashCount % 2 === 1) ? '#fff3cd' : '';
      if (flashCount >= 6) { // 3 flashes = 6 toggles
        clearInterval(flashInterval);
        targetRow.style.backgroundColor = '#fff3cd'; // leave highlighted
        // Remove highlight after 2 seconds (just before navigation)
        setTimeout(function () {
          targetRow.style.backgroundColor = originalBg;
        }, 1800);
      }
    }, 300); // flash every 300ms
  }

  // Read Cadre and Office from the page and return the correct assistant
  function decideAssistant(cadre, office) {
    const cadreValue  = cadre.trim().replace(/\s+/g, ' ').toUpperCase();
    const officeValue = office.trim().replace(/\s+/g, ' ').toUpperCase();

    console.log('[FCI NOC Assistant] Cadre: "' + cadreValue + '" | Office: "' + officeValue + '"');

    if (cadreValue === 'GENERAL') {
      return ASSISTANT_GENERAL;
    } else if (cadreValue === 'DEPOT') {
      if (DIVYA_OFFICES.map(o => o.trim().replace(/\s+/g, ' ').toUpperCase()).includes(officeValue)) {
        return ASSISTANT_DIVYA;
      } else if (VISHALI_OFFICES.map(o => o.trim().replace(/\s+/g, ' ').toUpperCase()).includes(officeValue)) {
        return ASSISTANT_VISHALI;
      } else {
        console.warn('[FCI NOC Assistant] Cadre is Depot but Office "' + officeValue + '" is not in any known group. No action taken.');
        return null;
      }
    } else {
      console.warn('[FCI NOC Assistant] Unrecognised Cadre: "' + cadreValue + '". No action taken.');
      return null;
    }
  }

  // STAGE 3 & 3E: Fill the Reviewer Remarks box directly on the review page (no navigation needed)
  function fillReviewerRemarks(remarkText, useHtml) {
    // The editor is a contenteditable div; there is also a hidden textarea that syncs to it
    const editor = document.getElementById('editor');
    const textarea = document.getElementById('dop_member_comment');

    if (!editor) {
      console.warn('[FCI NOC Assistant] Stage 3/3E: Reviewer Remarks editor (#editor) not found. Retrying...');
      setTimeout(function() { fillReviewerRemarks(remarkText, useHtml); }, 1500);
      return;
    }

    // Scroll the editor into view so it is visible
    editor.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Use innerHTML if HTML formatting is needed, otherwise use innerText
    if (useHtml) {
      editor.innerHTML = remarkText;
    } else {
      editor.innerText = remarkText;
    }

    // Sync to the hidden textarea (strip HTML tags for plain text storage)
    if (textarea) {
      // Create a temporary element to strip HTML tags for the textarea
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = remarkText;
      textarea.value = tempDiv.textContent || tempDiv.innerText || '';
    }

    // Fire input event so the page's character counter and validation update
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.dispatchEvent(new Event('blur',  { bubbles: true }));

    console.log('[FCI NOC Assistant] Stage 3/3E: Reviewer Remarks filled successfully.');
    console.log('[FCI NOC Assistant] *** Please review the remark and click the Review/Submit button yourself. ***');
  }

  // Click the Add Reviewer button
  function clickAddReviewer() {
    let addReviewerBtn = null;
    const allLinks = document.querySelectorAll('a, button');
    for (let el of allLinks) {
      if (el.textContent.trim() === 'Add Reviewer') { addReviewerBtn = el; break; }
    }
    if (addReviewerBtn) {
      // Set a flag so content_add_reviewer.js knows THIS navigation was triggered by the extension
      sessionStorage.setItem('fci_noc_triggered', 'yes');
      console.log('[FCI NOC Assistant] Clicking "Add Reviewer"...');
      addReviewerBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    } else {
      console.warn('[FCI NOC Assistant] "Add Reviewer" button not found.');
    }
  }

  // --- START ---

  // SAFETY CHECK: Only activate for NOC For Other Examination requests.
  // The Request ID is shown on the page and always begins with NOE for this request type.
  function getRequestId() {
    const allLabels = document.querySelectorAll('p, span, div, td, h1, h2, h3, h4, h5');
    for (let el of allLabels) {
      const text = el.textContent.trim();
      if (/^NOE\d+$/i.test(text)) return text.toUpperCase();
    }
    // Fallback: check page text broadly
    const bodyText = document.body.innerText || '';
    const match = bodyText.match(/\bNOE\d+\b/i);
    return match ? match[0].toUpperCase() : null;
  }

  const requestId = getRequestId();
  if (!requestId || !requestId.startsWith('NOE')) {
    console.log('[FCI NOC Assistant] Request ID not found or does not start with NOE ("' + (requestId || 'none') + '"). Extension will NOT activate on this page.');
  } else {
    console.log('[FCI NOC Assistant] Request ID confirmed: ' + requestId + '. Activating...');
    setTimeout(clickViewActionHistory, 2000);
  }

})();
