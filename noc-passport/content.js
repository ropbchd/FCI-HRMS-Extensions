// FCI NOC Passport Assistant - Content Script
// Runs on every NOC workflow review page.
// Checks action history and routes to the correct next step for NOC Passport requests.

(function () {

  // --- CONFIGURATION ---

  const PREFIX = 'NOCPASS';
  const LOG    = '[FCI NOC Passport Assistant]';

  // Key people
  const DISPATCHER_NAME         = 'MAYURESH KUMAR';
  const MANAGER_NAME            = 'AMIT KUMAR SINGH';
  const VIGILANCE_REVIEWER_NAME = 'ABHIMANYU SWAMI';

  // Assistant routing (same as NOC Other Exam)
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

  // Stage 1 remarks — driven by Passport Application type
  const STAGE1_REMARK_NEW     = 'With respect to the application made by the employee, kindly provide the vigilance clearance for the purpose of NOC for preparation of passport.';
  const STAGE1_REMARK_RENEWAL = 'With respect to the application made by the employee, kindly provide the vigilance clearance for the purpose of NOC for renewal of passport.';

  // Stage 1B remark (RO CHANDIGARH variant)
  const STAGE1B_REMARK = 'Kindly provide the details as per the performa provided by the FCI, Zonal Office (N).';

  // Stage 2 remarks — driven by Passport Application type
  const STAGE2_REMARK_NEW     = 'With respect to the application made by the employee, kindly provide the admin clearance for the purpose of NOC for preparation of passport and for the eligibility for the further processing of the request.';
  const STAGE2_REMARK_RENEWAL = 'With respect to the application made by the employee, kindly provide the admin clearance for the purpose of NOC for renewal of passport and for the eligibility for the further processing of the request.';

  // Stage 3 remark is built dynamically — see buildStage3Remark()

  // ----------------------

  // --- SAFETY CHECK ---
  function getRequestId() {
    const allEls = document.querySelectorAll('p, span, div, td, h1, h2, h3, h4, h5');
    for (let el of allEls) {
      const text = el.textContent.trim();
      if (/^NOCPASS\d+$/i.test(text)) return text.toUpperCase();
    }
    const bodyText = document.body.innerText || '';
    const match = bodyText.match(/\bNOCPASS\d+\b/i);
    return match ? match[0].toUpperCase() : null;
  }

  const requestId = getRequestId();
  if (!requestId || !requestId.startsWith(PREFIX)) {
    console.log(LOG + ' Request ID not found or does not start with ' + PREFIX + ' ("' + (requestId || 'none') + '"). Extension will NOT activate on this page.');
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

  // --- STEP 2: Wait for action history table to populate ---
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

  // --- STEP 3: Parse table and decide which stage ---
  function checkConditionsAndAct(tbody) {
    const allRows = tbody.querySelectorAll('tr');
    const entries = [];
    let currentEntry = null;

    for (let row of allRows) {
      const cells = row.querySelectorAll('td');
      if (cells.length === 8) {
        currentEntry = {
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

    // Read page fields
    const cadreValue       = getFieldValue('cadre');
    const officeValue      = getFieldValue('office');
    const employeeName     = getEmployeeNameFromPage();
    const designationValue = getFieldValue('designation');
    const passportAppType  = getPassportApplicationType();
    const isNewApplication = passportAppType.toLowerCase().includes('new');
    const isRoChandigarh   = officeValue.trim().replace(/\s+/g, ' ').toUpperCase() === 'RO CHANDIGARH';

    console.log(LOG + ' Office: "' + officeValue + '" | Cadre: "' + cadreValue + '" | isRoChandigarh: ' + isRoChandigarh);
    console.log(LOG + ' Passport Application: "' + passportAppType + '" | isNew: ' + isNewApplication);
    console.log(LOG + ' Employee: "' + employeeName + '" | Designation: "' + designationValue + '"');

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

    // Find last Reviewed by one of the three assistants
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

    // Stage conditions
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

    const stage3 = lastAssistantReviewed
      && afterAssistantReviewed
      && afterAssistantReviewed.employeeName.toUpperCase().includes(MANAGER_NAME)
      && afterAssistantReviewed.actionTaken.trim() === 'Pending Review'
      && afterAssistantReviewed.remark.trim() === 'N/A';

    console.log(LOG + ' Stage 3 (Fill Remarks + Open Annexure H): ' + (stage3 ? 'MATCH' : 'no match'));
    console.log(LOG + ' Stage 2 (Send to Assistant):              ' + (stage2 ? 'MATCH' : 'no match'));
    console.log(LOG + ' Stage 1 base trigger:                     ' + (stage1Base ? 'MATCH' : 'no match'));

    // Priority order: Stage 3 → Stage 2 → Stage 1B → Stage 1
    if (stage3) {
      const assistantName = lastAssistantReviewed.employeeName;
      console.log(LOG + ' Stage 3: Last assistant reviewer: ' + assistantName + '. Building remark...');
      highlightTriggerRow(tbody, assistantName, 'Reviewed');
      const stage3Remark = buildStage3Remark(employeeName, designationValue, cadreValue, officeValue, isNewApplication, isRoChandigarh);
      setTimeout(function () {
        fillReviewerRemarks(stage3Remark);
        openAnnexureH();
      }, 2000);

    } else if (stage2) {
      const assistant = decideAssistant(cadreValue, officeValue);
      if (assistant) {
        const stage2Remark = isNewApplication ? STAGE2_REMARK_NEW : STAGE2_REMARK_RENEWAL;
        console.log(LOG + ' Stage 2: Routing to ' + assistant.name);
        highlightTriggerRow(tbody, VIGILANCE_REVIEWER_NAME, 'Reviewed');
        sessionStorage.setItem('fci_noc_triggered',        'yes');
        sessionStorage.setItem('fci_noc_stage',            '2');
        sessionStorage.setItem('fci_noc_assistant_emp',    assistant.empNo);
        sessionStorage.setItem('fci_noc_assistant_name',   assistant.name);
        sessionStorage.setItem('fci_noc_assistant_remark', stage2Remark);
        setTimeout(clickAddReviewer, 2000);
      }

    } else if (stage1Base && isRoChandigarh) {
      const assistant = decideAssistant(cadreValue, officeValue);
      if (assistant) {
        console.log(LOG + ' Stage 1B (RO CHANDIGARH): Routing to ' + assistant.name);
        highlightTriggerRow(tbody, DISPATCHER_NAME, 'Dispatched');
        sessionStorage.setItem('fci_noc_triggered',        'yes');
        sessionStorage.setItem('fci_noc_stage',            '1b');
        sessionStorage.setItem('fci_noc_assistant_emp',    assistant.empNo);
        sessionStorage.setItem('fci_noc_assistant_name',   assistant.name);
        sessionStorage.setItem('fci_noc_assistant_remark', STAGE1B_REMARK);
        setTimeout(clickAddReviewer, 2000);
      }

    } else if (stage1Base) {
      const stage1Remark = isNewApplication ? STAGE1_REMARK_NEW : STAGE1_REMARK_RENEWAL;
      console.log(LOG + ' Stage 1: Routing to ABHIMANYU SWAMI for vigilance clearance...');
      highlightTriggerRow(tbody, DISPATCHER_NAME, 'Dispatched');
      sessionStorage.setItem('fci_noc_triggered',        'yes');
      sessionStorage.setItem('fci_noc_stage',            '1');
      sessionStorage.setItem('fci_noc_assistant_emp',    '276695');
      sessionStorage.setItem('fci_noc_assistant_name',   'ABHIMANYU SWAMI');
      sessionStorage.setItem('fci_noc_assistant_remark', stage1Remark);
      setTimeout(clickAddReviewer, 2000);

    } else {
      console.log(LOG + ' No matching stage found. No action taken.');
    }
  }

  // --- Build Stage 3 remark dynamically ---
  function buildStage3Remark(employeeName, designation, cadre, office, isNew, isRoChandigarh) {
    const purposePhrase   = isNew ? 'preparation of passport' : 'renewal of passport';
    const cadreDisplay    = cadre.trim();

    // Format: "DO LUDHIANA" → "FCI, DO - LUDHIANA"
    // Split on first space only to handle "DO LUDHIANA" → ["DO", "LUDHIANA"]
    const officeNormalised = office.trim().replace(/\s+/g, ' ').toUpperCase();
    const spaceIdx         = officeNormalised.indexOf(' ');
    const officeFormatted  = spaceIdx !== -1
      ? 'FCI, ' + officeNormalised.substring(0, spaceIdx) + ' - ' + officeNormalised.substring(spaceIdx + 1)
      : 'FCI, ' + officeNormalised;

    if (isRoChandigarh) {
      return 'With respect to the request made by the official ' + employeeName + ', ' + designation + ' (' + cadreDisplay + '), the following points are mention worthy, concerned employee has provided Annexure \u2013 H (duly signed by Asst. Genl. Manager \u2013 Personal attached along with the application). The requisite administrative and vigilance clearance from the Regional Office level has been obtained, and there is no case pending against the requesting official. Therefore, if agreed, the application may please be forwarded to the competent authority for approval of ' + purposePhrase + '.';
    } else {
      return 'With respect to the request made by the official ' + employeeName + ', ' + designation + ' (' + cadreDisplay + '), the following points are mention worthy, concerned employee has provided Annexure \u2013 H (duly signed by Divisional Manager, ' + officeFormatted + ' attached along with the application). The requisite administrative and vigilance clearance from the concerned Divisional Office and Regional Office level has been obtained, and there is no case pending against the requesting employee. Therefore, if agreed, the application may please be forwarded to the competent authority for approval of ' + purposePhrase + '.';
    }
  }

  // --- Open Annexure H (or all attachments if not found by name) ---
  function openAnnexureH() {
    console.log(LOG + ' Scanning for Annexure H attachment...');

    const allLinks = document.querySelectorAll('a');
    const annexureLinks = [];

    for (let link of allLinks) {
      const text = (link.textContent || '').trim().toUpperCase();
      const href = (link.href || '').toUpperCase();
      if (text.includes('ANNEX') || href.includes('ANNEX')) {
        annexureLinks.push(link);
      }
    }

    if (annexureLinks.length > 0) {
      console.log(LOG + ' Annexure H link found. Opening...');
      window.open(annexureLinks[0].href, '_blank');
    } else {
      // No Annexure H found by name — open all attachments
      console.log(LOG + ' No Annexure H found by name. Opening all attachments...');

      // Top-level Document "Attachment" link first
      const docLink = findDocumentAttachmentLink();
      if (docLink) {
        console.log(LOG + ' Opening Document attachment...');
        window.open(docLink.href, '_blank');
      }

      // All attachment links in the action history section
      const historySection = document.querySelector('#action-history-details-div') || document.querySelector('#custom-action-history-tbl');
      if (historySection) {
        const historyLinks = historySection.querySelectorAll('a');
        for (let link of historyLinks) {
          const href = link.href || '';
          const text = (link.textContent || '').trim();
          if (href && !href.toLowerCase().includes('javascript') && text !== '') {
            console.log(LOG + ' Opening history attachment: ' + text);
            window.open(href, '_blank');
          }
        }
      }

      if (!docLink && !historySection) {
        console.warn(LOG + ' No attachments found to open.');
      }
    }
  }

  // Find the top-level "Attachment" link in the Document field
  function findDocumentAttachmentLink() {
    const allLinks = document.querySelectorAll('a');
    for (let link of allLinks) {
      if (link.textContent.trim().toLowerCase() === 'attachment') {
        return link;
      }
    }
    return null;
  }

  // --- Read Passport Application type from Review page ---
  function getPassportApplicationType() {
    // Try label[for] pattern
    let val = getFieldValue('passport_application');
    if (val) return val;

    // Fallback: scan page text
    const bodyText = document.body.innerText || '';
    const match = bodyText.match(/Passport Application[\s\S]{0,80}?(New Application|Renewal Application)/i);
    if (match) return match[1];

    console.warn(LOG + ' Could not read Passport Application type. Defaulting to New Application.');
    return 'New Application';
  }

  // --- Read Employee Name from Review page ---
  function getEmployeeNameFromPage() {
    // Try label[for="employee_name"]
    let val = getFieldValue('employee_name');
    if (val) return val;
    // Fallback: label text match
    const listItems = document.querySelectorAll('li');
    for (let li of listItems) {
      const label = li.querySelector('label');
      const span  = li.querySelector('span');
      if (!label || !span) continue;
      if (label.textContent.trim().toLowerCase().includes('employee name')) {
        return span.textContent.trim();
      }
    }
    return '';
  }

  // --- Read field value by label for-attribute ---
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

  // --- Decide assistant based on Cadre + Office ---
  function decideAssistant(cadreRaw, officeRaw) {
    const cadre  = cadreRaw.trim().replace(/\s+/g, ' ').toUpperCase();
    const office = officeRaw.trim().replace(/\s+/g, ' ').toUpperCase();

    if (cadre === 'GENERAL') {
      return ASSISTANT_GENERAL;
    } else if (cadre === 'DEPOT') {
      if (DIVYA_OFFICES.map(o => o.trim().replace(/\s+/g, ' ').toUpperCase()).includes(office)) {
        return ASSISTANT_DIVYA;
      } else if (VISHALI_OFFICES.map(o => o.trim().replace(/\s+/g, ' ').toUpperCase()).includes(office)) {
        return ASSISTANT_VISHALI;
      } else {
        console.warn(LOG + ' Depot cadre but Office "' + office + '" not in any known group. No action taken.');
        return null;
      }
    } else {
      console.warn(LOG + ' Unrecognised Cadre: "' + cadre + '". No action taken.');
      return null;
    }
  }

  // --- Fill Reviewer Remarks directly on Review page ---
  function fillReviewerRemarks(remarkText) {
    const editor   = document.getElementById('editor');
    const textarea = document.getElementById('dop_member_comment');

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

    console.log(LOG + ' Stage 3: Reviewer Remarks filled.');
    console.log(LOG + ' *** Please verify the remark and Annexure H, then click Review yourself. ***');
  }

  // --- Click Add Reviewer button ---
  function clickAddReviewer() {
    let btn = null;
    const allLinks = document.querySelectorAll('a, button');
    for (let el of allLinks) {
      if (el.textContent.trim() === 'Add Reviewer') { btn = el; break; }
    }
    if (btn) {
      console.log(LOG + ' Clicking "Add Reviewer"...');
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    } else {
      console.warn(LOG + ' "Add Reviewer" button not found.');
    }
  }

  // --- Highlight the trigger row ---
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

    const originalBg = targetRow.style.backgroundColor;
    let flashCount = 0;
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

})();
