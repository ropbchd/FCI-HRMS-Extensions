// FCI Higher Studies Distance Assistant - Content Script v1.2
// Uses line-by-line parser to read Cadre and Office from page

(function () {

  const PREFIX = 'HISTUDIES';
  const LOG    = '[FCI HS Assistant]';

  const DISPATCHER_NAME         = 'MAYURESH KUMAR';
  const MANAGER_NAME            = 'AMIT KUMAR SINGH';
  const VIGILANCE_REVIEWER_NAME = 'ABHIMANYU SWAMI';

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

  const STAGE1_REMARK  = 'With respect to the application made by the employee, kindly provide the vigilance clearance for the purpose of pursuing Higher Studies Distance.';
  const STAGE1B_REMARK = 'Kindly provide the details as per the latest performa dt. 16.01.2025 provided by the ZO(N).';
  const STAGE2_REMARK  = 'Kindly review the submitted request for admin. clearance and check the eligibility with reference to the applicable circulars, rules, and policies of the Corporation to assess their alignment with the prescribed provisions.';
  const STAGE3C_REMARK = 'Kindly re-examine the submitted request for admin. clearance and check the eligibility with reference to the applicable circulars, rules, and policies of the Corporation to assess their alignment with the prescribed provisions.';

  const OFFICE_TYPE_RO = '4';
  const OFFICE_TYPE_DO = '5';
  const AGM_DESIGNATION = 'Assistant General Manager';

  // --- LINE-BY-LINE FIELD PARSER (reads from page text) ---
  function getFieldValue(fieldName) {
    const bodyText = document.body.innerText;
    const lines = bodyText.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.toLowerCase() === fieldName.toLowerCase()) {
        if (i + 1 < lines.length) {
          const value = lines[i + 1].trim();
          if (value && value !== '') {
            return value;
          }
        }
      }
    }
    return '';
  }

  function getRequestId() {
    const bodyText = document.body.innerText || '';
    const match = bodyText.match(/\bHISTUDIES\d+\b/i);
    return match ? match[0].toUpperCase() : null;
  }

  const requestId = getRequestId();
  if (!requestId || !requestId.startsWith(PREFIX)) {
    console.log(LOG + ' Not a HISTUDIES request. Extension will NOT activate.');
  } else {
    console.log(LOG + ' Request ID confirmed: ' + requestId + '. Activating...');
    setTimeout(clickViewActionHistory, 2000);
  }

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

  function waitForTableAndCheck() {
    let attempts = 0;
    const interval = setInterval(function () {
      attempts++;
      const tbody = document.querySelector('#custom-action-history-tbl tbody');
      if (tbody && tbody.querySelectorAll('tr').length > 0) {
        clearInterval(interval);
        console.log(LOG + ' Step 2: Table populated. Checking conditions...');
        checkConditionsAndAct(tbody);
      } else if (attempts >= 20) {
        clearInterval(interval);
        console.warn(LOG + ' Table did not load in time.');
      }
    }, 500);
  }

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
      } else if (cells.length === 1 && cells[0].colSpan === 8) {
        const fullText = cells[0].textContent.trim();
        if (fullText.startsWith('REMARKS:') && currentEntry) {
          currentEntry.remark = fullText.replace('REMARKS:', '').trim();
        }
      }
    }

    // Read page fields using line-by-line parser
    const cadreValue       = getFieldValue('Cadre');
    const officeValue      = getFieldValue('Office');
    const courseName       = getFieldValue('Name of Course');
    const university       = getFieldValue('Name of the University/Institution');
    const fromDate         = getFieldValue('From Date');
    const toDate           = getFieldValue('To Date');
    const type             = getFieldValue('Type');
    const duration         = getFieldValue('Duration of the Course');
    const isRoChandigarh   = officeValue.trim().replace(/\s+/g, ' ').toUpperCase() === 'RO CHANDIGARH';

    console.log(LOG + ' Office: "' + officeValue + '" | Cadre: "' + cadreValue + '" | isRoChandigarh: ' + isRoChandigarh);
    console.log(LOG + ' Course: "' + courseName + '" | Duration: "' + duration + '"');

    // Find last Dispatched
    let lastDispatchedIndex = -1;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].actionTaken === 'Dispatched') lastDispatchedIndex = i;
    }
    const lastDispatched  = lastDispatchedIndex !== -1 ? entries[lastDispatchedIndex] : null;
    const afterDispatched = lastDispatched ? entries[lastDispatchedIndex + 1] || null : null;

    // Find last Reviewed
    let lastReviewedIndex = -1;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].actionTaken === 'Reviewed') lastReviewedIndex = i;
    }
    const lastReviewed  = lastReviewedIndex !== -1 ? entries[lastReviewedIndex] : null;
    const afterReviewed = lastReviewed ? entries[lastReviewedIndex + 1] || null : null;

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

    let abhimanyuReviewed = false;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].actionTaken === 'Reviewed' && entries[i].employeeName.toUpperCase().includes('ABHIMANYU SWAMI')) {
        abhimanyuReviewed = true;
        break;
      }
    }

    const stage1Base = lastDispatched
      && lastDispatched.employeeName.toUpperCase().includes(DISPATCHER_NAME)
      && afterDispatched
      && afterDispatched.employeeName.toUpperCase().includes(MANAGER_NAME)
      && afterDispatched.actionTaken.trim() === 'Pending Review'
      && afterDispatched.remark.trim() === 'N/A';

    const stage2 = lastReviewed
      && lastReviewed.employeeName.toUpperCase().includes(VIGILANCE_REVIEWER_NAME)
      && afterReviewed
      && afterReviewed.employeeName.toUpperCase().includes(MANAGER_NAME)
      && afterReviewed.actionTaken.trim() === 'Pending Review'
      && afterReviewed.remark.trim() === 'N/A';

    const stage1C = lastAssistantReviewed
      && !abhimanyuReviewed
      && isRoChandigarh
      && afterAssistantReviewed
      && afterAssistantReviewed.employeeName.toUpperCase().includes(MANAGER_NAME)
      && afterAssistantReviewed.actionTaken.trim() === 'Pending Review'
      && afterAssistantReviewed.remark.trim() === 'N/A';

    let agmIndex = -1;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].designation.trim() === AGM_DESIGNATION
          && entries[i].remark.trim() !== 'N/A'
          && entries[i].remark.trim() !== '') {
        agmIndex = i;
        break;
      }
    }
    const doManagerEntry = agmIndex > 0 ? entries[agmIndex - 1] : null;

    const stage3bAssistantIssue = lastAssistantReviewed
      && lastAssistantReviewed.remark.trim() !== ''
      && lastAssistantReviewed.remark.trim() !== 'N/A'
      && afterAssistantReviewed
      && afterAssistantReviewed.employeeName.toUpperCase().includes(MANAGER_NAME)
      && afterAssistantReviewed.actionTaken.trim() === 'Pending Review'
      && afterAssistantReviewed.remark.trim() === 'N/A';

    const stage3b = stage3bAssistantIssue && !isRoChandigarh;

    let lastAmitPendingIndex = -1;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].employeeName.toUpperCase().includes(MANAGER_NAME)
          && entries[i].actionTaken.trim() === 'Pending Review'
          && entries[i].remark.trim() === 'N/A') {
        lastAmitPendingIndex = i;
      }
    }
    const entryBeforeAmitPending = lastAmitPendingIndex > 0 ? entries[lastAmitPendingIndex - 1] : null;

    const stage3c = doManagerEntry
      && entryBeforeAmitPending
      && entryBeforeAmitPending.employeeName.toUpperCase().trim()
           === doManagerEntry.employeeName.toUpperCase().trim()
      && lastAmitPendingIndex !== -1
      && !stage2
      && !stage3b;

    console.log(LOG + ' Stage 2: ' + (stage2 ? 'MATCH' : 'no match'));
    console.log(LOG + ' Stage 3B: ' + (stage3b ? 'MATCH' : 'no match'));
    console.log(LOG + ' Stage 3C: ' + (stage3c ? 'MATCH' : 'no match'));

    if (stage3b && doManagerEntry) {
      const assistantSlNo = lastAssistantReviewed.slNo;
      const doManagerName = doManagerEntry.employeeName;
      const stage3bRemark = 'Reference may be made to the observations recorded during examination of the request at Sl. No. ' + assistantSlNo + '. Required necessary clarifications and/or supporting documents, as indicated, may kindly be furnished for further processing.';

      console.log(LOG + ' Stage 3B: Sending back to DO Manager: ' + doManagerName);
      highlightTriggerRow(tbody, lastAssistantReviewed.employeeName, 'Reviewed');

      sessionStorage.setItem('fci_hs_stage', '3b');
      sessionStorage.setItem('fci_hs_office_type', OFFICE_TYPE_DO);
      sessionStorage.setItem('fci_hs_target_office', officeValue);
      sessionStorage.setItem('fci_hs_target_employee_name', doManagerName);
      sessionStorage.setItem('fci_hs_assistant_remark', stage3bRemark);
      sessionStorage.setItem('fci_hs_triggered', 'yes');
      setTimeout(clickAddReviewer, 2000);

    } else if (stage3c) {
      const assistant = decideAssistant(cadreValue, officeValue);
      if (assistant) {
        console.log(LOG + ' Stage 3C: Re-routing to ' + assistant.name);
        highlightTriggerRow(tbody, doManagerEntry.employeeName, 'Reviewed');
        sessionStorage.setItem('fci_hs_stage', '3c');
        sessionStorage.setItem('fci_hs_office_type', OFFICE_TYPE_RO);
        sessionStorage.setItem('fci_hs_assistant_emp', assistant.empNo);
        sessionStorage.setItem('fci_hs_assistant_name', assistant.name);
        sessionStorage.setItem('fci_hs_assistant_remark', STAGE3C_REMARK);
        sessionStorage.setItem('fci_hs_triggered', 'yes');
        setTimeout(clickAddReviewer, 2000);
      }

    } else if (stage2) {
      const assistant = decideAssistant(cadreValue, officeValue);
      if (assistant) {
        console.log(LOG + ' Stage 2: Routing to ' + assistant.name);
        highlightTriggerRow(tbody, VIGILANCE_REVIEWER_NAME, 'Reviewed');
        sessionStorage.setItem('fci_hs_stage', '2');
        sessionStorage.setItem('fci_hs_office_type', OFFICE_TYPE_RO);
        sessionStorage.setItem('fci_hs_assistant_emp', assistant.empNo);
        sessionStorage.setItem('fci_hs_assistant_name', assistant.name);
        sessionStorage.setItem('fci_hs_assistant_remark', STAGE2_REMARK);
        sessionStorage.setItem('fci_hs_triggered', 'yes');
        setTimeout(clickAddReviewer, 2000);
      }

    } else if (stage1C) {
      console.log(LOG + ' Stage 1C: Routing to ABHIMANYU SWAMI');
      highlightTriggerRow(tbody, lastAssistantReviewed.employeeName, 'Reviewed');
      sessionStorage.setItem('fci_hs_stage', '1c');
      sessionStorage.setItem('fci_hs_office_type', OFFICE_TYPE_RO);
      sessionStorage.setItem('fci_hs_assistant_emp', '276695');
      sessionStorage.setItem('fci_hs_assistant_name', 'ABHIMANYU SWAMI');
      sessionStorage.setItem('fci_hs_assistant_remark', STAGE1_REMARK);
      sessionStorage.setItem('fci_hs_triggered', 'yes');
      setTimeout(clickAddReviewer, 2000);

    } else if (stage1Base && isRoChandigarh) {
      const assistant = decideAssistant(cadreValue, officeValue);
      if (assistant) {
        console.log(LOG + ' Stage 1B: Routing to ' + assistant.name);
        highlightTriggerRow(tbody, DISPATCHER_NAME, 'Dispatched');
        sessionStorage.setItem('fci_hs_stage', '1b');
        sessionStorage.setItem('fci_hs_office_type', OFFICE_TYPE_RO);
        sessionStorage.setItem('fci_hs_assistant_emp', assistant.empNo);
        sessionStorage.setItem('fci_hs_assistant_name', assistant.name);
        sessionStorage.setItem('fci_hs_assistant_remark', STAGE1B_REMARK);
        sessionStorage.setItem('fci_hs_triggered', 'yes');
        setTimeout(clickAddReviewer, 2000);
      }

    } else if (stage1Base) {
      console.log(LOG + ' Stage 1: Routing to ABHIMANYU SWAMI');
      highlightTriggerRow(tbody, DISPATCHER_NAME, 'Dispatched');
      sessionStorage.setItem('fci_hs_stage', '1');
      sessionStorage.setItem('fci_hs_office_type', OFFICE_TYPE_RO);
      sessionStorage.setItem('fci_hs_assistant_emp', '276695');
      sessionStorage.setItem('fci_hs_assistant_name', 'ABHIMANYU SWAMI');
      sessionStorage.setItem('fci_hs_assistant_remark', STAGE1_REMARK);
      sessionStorage.setItem('fci_hs_triggered', 'yes');
      setTimeout(clickAddReviewer, 2000);

    } else {
      console.log(LOG + ' No automated stage matched. Manual Stage 3.');
    }
  }

  function highlightTriggerRow(tbody, targetName, targetAction) {
    const rows = tbody.querySelectorAll('tr');
    for (let row of rows) {
      const cells = row.querySelectorAll('td');
      if (cells.length === 8) {
        const action = cells[3].textContent.trim();
        const name = cells[4].textContent.trim().toUpperCase();
        if (action === targetAction && name.includes(targetName.toUpperCase())) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          row.style.backgroundColor = '#fff3cd';
          setTimeout(function() { row.style.backgroundColor = ''; }, 3000);
          break;
        }
      }
    }
  }

  function decideAssistant(cadreRaw, officeRaw) {
    const cadre = cadreRaw.trim().replace(/\s+/g, ' ').toUpperCase();
    const office = officeRaw.trim().replace(/\s+/g, ' ').toUpperCase();
    console.log(LOG + ' decideAssistant: Cadre="' + cadre + '" Office="' + office + '"');

    if (cadre === 'GENERAL') {
      return ASSISTANT_GENERAL;
    } else if (cadre === 'DEPOT') {
      if (DIVYA_OFFICES.map(o => o.toUpperCase()).includes(office)) {
        return ASSISTANT_DIVYA;
      } else if (VISHALI_OFFICES.map(o => o.toUpperCase()).includes(office)) {
        return ASSISTANT_VISHALI;
      } else {
        console.warn(LOG + ' Depot cadre but office not in known groups: ' + office);
        return null;
      }
    } else {
      console.warn(LOG + ' Unrecognised cadre: ' + cadre);
      return null;
    }
  }

  function clickAddReviewer() {
    let btn = null;
    const allLinks = document.querySelectorAll('a, button');
    for (let el of allLinks) {
      if (el.textContent.trim() === 'Add Reviewer') { btn = el; break; }
    }
    if (btn) {
      console.log(LOG + ' Clicking "Add Reviewer"...');
      btn.click();
    } else {
      console.warn(LOG + ' "Add Reviewer" button not found.');
    }
  }

})();