// FCI OTA Request Assistant - Content Script v1.1
// Runs on the OTA Request review page.
// Detects the trigger condition, then fills the Multiplication Factor,
// prerequisite checkboxes, and Reviewer Remarks directly on this page.
// Does NOT navigate or auto-submit — officer reviews and clicks Review manually.

(function () {

  const PREFIX = 'CBO';
  const LOG    = '[FCI OTA Assistant]';

  const DISPATCHER_NAME = 'MAYURESH KUMAR';
  const MANAGER_NAME    = 'AMIT KUMAR SINGH';

  // --- Employee -> Cadre lookup ---
  const CADRE_LOOKUP = {
    '286357': 'General',   // RISHIKESH MISHRA
    '315595': 'Depot',     // SAMYAK NILKANTH MESHRAM
    '316946': 'Depot',     // ANKIT MALIK
    '317485': 'General'    // JATIN - Assistant Grade - III
  };

  const MULTIPLICATION_FACTOR_VALUE = '1.1';

  // --- Google Sheets register write-back ---
  const OTA_SHEET_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxdPk85q44afaCsFvfmTcOazUUVawis-qtCRqfGqqNRw0BFO2CHc5uwkLA_BkSA0oZD-w/exec';

  // Google Sheet URL for verification (direct link to "OTA" sheet)
  const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/18TrCiKWXmobODD3C4YLZ7T3t50cmrDt9jdLaQFLyP-s/edit?gid=645230595#gid=645230595';

  // --- SAFETY CHECK: Only activate for OTA requests (Request ID starts with CBO) ---
  function getRequestId() {
    const bodyText = document.body.innerText || '';
    const match = bodyText.match(/\bCBO\d+\b/i);
    return match ? match[0].toUpperCase() : null;
  }

  const requestId = getRequestId();
  
  // Reset sheet flag for each new request so sheet opens every time
  sessionStorage.removeItem('fci_sheet_opened');

  if (!requestId || !requestId.startsWith(PREFIX)) {
    console.log(LOG + ' Not a CBO (OTA) request. Extension will NOT activate.');
  } else {
    console.log(LOG + ' Request ID confirmed: ' + requestId + '. Activating...');
    // Add "Open Sheet" button on the review page
    addOpenSheetButton();
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

  // --- STEP 2: Wait for the action history table to populate ---
  function waitForTableAndCheck() {
    let attempts = 0;
    const interval = setInterval(function () {
      attempts++;
      const tbody = document.querySelector('#custom-action-history-tbl tbody');
      if (tbody && tbody.querySelectorAll('tr').length > 0) {
        clearInterval(interval);
        console.log(LOG + ' Step 2: Action history table populated. Checking conditions...');
        checkConditionsAndAct(tbody);
      } else if (attempts >= 20) {
        clearInterval(interval);
        console.warn(LOG + ' Action history table did not load in time.');
      }
    }, 500);
  }

  // --- STEP 3: Parse action history and decide whether to act ---
  function checkConditionsAndAct(tbody) {
    const allRows = tbody.querySelectorAll('tr');
    const entries = [];
    let currentEntry = null;

    for (let row of allRows) {
      const cells = row.querySelectorAll('td');
      if (cells.length === 8 || cells.length === 6) {
        const n = cells.length;
        currentEntry = {
          actionTaken:  cells[n - 5].textContent.trim(),
          employeeName: cells[n - 4].textContent.trim(),
          remark:       ''
        };
        entries.push(currentEntry);
      } else if (cells.length === 1 && currentEntry) {
        const fullText = cells[0].textContent.trim();
        if (fullText.toUpperCase().startsWith('REMARKS:')) {
          currentEntry.remark = fullText.replace(/REMARKS:/i, '').trim();
        }
      }
    }

    let lastDispatchedIndex = -1;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].actionTaken === 'Dispatched') lastDispatchedIndex = i;
    }
    const lastDispatched  = lastDispatchedIndex !== -1 ? entries[lastDispatchedIndex] : null;
    const afterDispatched = lastDispatched ? entries[lastDispatchedIndex + 1] || null : null;

    const trigger = lastDispatched
      && lastDispatched.employeeName.toUpperCase().includes(DISPATCHER_NAME)
      && afterDispatched
      && afterDispatched.employeeName.toUpperCase().includes(MANAGER_NAME)
      && afterDispatched.actionTaken.trim() === 'Pending Review'
      && afterDispatched.remark.trim() === 'N/A';

    console.log(LOG + ' Trigger condition (Dispatched by Mayuresh Kumar -> Pending Review Amit Kumar Singh, N/A): ' + (trigger ? 'MATCH' : 'no match'));

    if (!trigger) {
      console.log(LOG + ' No matching trigger. No action taken.');
      return;
    }

    const employeeNumber = getEmployeeNumber();
    const cadre = CADRE_LOOKUP[employeeNumber];

    if (!cadre) {
      console.warn(LOG + ' Employee Number "' + employeeNumber + '" not found in cadre lookup table. No action taken.');
      return;
    }

    console.log(LOG + ' Employee Number: ' + employeeNumber + ' | Cadre: ' + cadre);

    highlightTriggerRow(tbody, DISPATCHER_NAME, 'Dispatched');

    setTimeout(function () {
      fillMultiplicationFactor();
      checkPrerequisiteCheckboxes();
      fillReviewerRemarks(cadre);
    }, 1500);
  }

  // --- Read Employee Number from the page info block ---
  function getEmployeeNumber() {
    const bodyText = document.body.innerText || '';
    const lines = bodyText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().toLowerCase() === 'employee number') {
        if (i + 1 < lines.length) {
          const value = lines[i + 1].trim();
          if (value) return value;
        }
      }
    }
    return '';
  }

  // --- Read Employee Name from the page info block ---
  function getEmployeeName() {
    const bodyText = document.body.innerText || '';
    const lines = bodyText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().toLowerCase() === 'employee name') {
        if (i + 1 < lines.length) {
          const value = lines[i + 1].trim();
          if (value) return value;
        }
      }
    }
    return '';
  }

  // --- Read Designation from the page info block ---
  function getDesignation() {
    const bodyText = document.body.innerText || '';
    const lines = bodyText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().toLowerCase() === 'designation') {
        if (i + 1 < lines.length) {
          const value = lines[i + 1].trim();
          if (value) return value;
        }
      }
    }
    return '';
  }

  // --- Read Admissible OTA Hours from the page (read-only field) ---
  function getAdmissibleOtaHours() {
    const labels = document.querySelectorAll('label, span, div, p');
    for (let el of labels) {
      if (el.textContent.trim().toLowerCase() === 'admissible ota hours') {
        let container = el.closest('div') || el.parentElement;
        if (container) {
          const input = container.querySelector('input, span.value, div.value');
          if (input) {
            const val = (input.value !== undefined ? input.value : input.textContent).trim();
            if (val) return val;
          }
          let sibling = container.nextElementSibling;
          if (sibling) {
            const val2 = sibling.textContent.trim();
            if (val2) return val2;
          }
        }
      }
    }

    const bodyText = document.body.innerText || '';
    const lines = bodyText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().toLowerCase() === 'admissible ota hours') {
        if (i + 1 < lines.length) {
          const value = lines[i + 1].trim();
          if (value) return value;
        }
      }
    }
    return '';
  }

  // --- Generic label-based field reader ---
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

  // --- Read OTA Amount from the page ---
  function getOtaAmount() {
    const input = document.getElementById('ota_amount');
    if (input && input.value) {
      return input.value.trim();
    }
    return getLabelledField('OTA Amount');
  }

  // --- Convert ALL-CAPS HRMS name to Proper Case ---
  function toProperCase(name) {
    return name
      .toLowerCase()
      .split(' ')
      .map(function (word) {
        return word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word;
      })
      .join(' ');
  }

  // --- Read From Date / To Date from the day-by-day OTA table ---
  function getFromToDateFromTable() {
    const rows = document.querySelectorAll('table.data-table-main-in tbody tr, table.dataTable tbody tr');
    const dates = [];

    for (let row of rows) {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 2) {
        const dateText = cells[1].textContent.trim();
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateText)) {
          dates.push(dateText);
        }
      }
    }

    if (dates.length === 0) return { fromDate: '', toDate: '' };
    return { fromDate: dates[0], toDate: dates[dates.length - 1] };
  }

  // --- Compute "Month - Year" register label ---
  function computeMonthLabel(dateStr) {
    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const parts = dateStr.split('/');
    if (parts.length !== 3) return '';
    const month = parseInt(parts[1], 10);
    const year  = parts[2];
    if (isNaN(month) || month < 1 || month > 12) return '';
    return MONTH_NAMES[month - 1] + ' - ' + year;
  }

  function fillMultiplicationFactor(attempts) {
    attempts = attempts || 0;

    const row1Select = document.getElementById('multiplication_factor_1');
    if (!row1Select) {
      if (attempts >= 20) {
        console.warn(LOG + ' Multiplication factor dropdown (row 1) not found after retries.');
        return;
      }
      setTimeout(function () { fillMultiplicationFactor(attempts + 1); }, 500);
      return;
    }

    console.log(LOG + ' Setting row 1 Multiplication Factor to ' + MULTIPLICATION_FACTOR_VALUE + '...');
    row1Select.value = MULTIPLICATION_FACTOR_VALUE;
    row1Select.dispatchEvent(new Event('input',  { bubbles: true }));
    row1Select.dispatchEvent(new Event('change', { bubbles: true }));

    setTimeout(function () {
      const headerCheckbox = document.querySelector('input[type="checkbox"][name="select_multiplication_factor"]');
      if (!headerCheckbox) {
        console.warn(LOG + ' "Multiplication Factor" header checkbox not found.');
        return;
      }
      if (!headerCheckbox.checked) {
        console.log(LOG + ' Clicking "Multiplication Factor" header checkbox to apply to all rows...');
        headerCheckbox.click();
        headerCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        console.log(LOG + ' "Multiplication Factor" header checkbox already checked.');
      }
    }, 500);
  }

  // --- Check the three prerequisite checkboxes ---
  function checkPrerequisiteCheckboxes() {
    const labelTexts = [
      'necessary entries have been made in the overtime allowance register maintained for the purpose',
      'the period for which ota are claimed in this bill have been checked with initial records and found correct',
      'the person from which ota are claimed in the bill have actual earned by working overtime'
    ];

    const allLabelEls = document.querySelectorAll('label, span, div, p, td');
    let checkedCount = 0;

    for (let el of allLabelEls) {
      const text = el.textContent.trim().toLowerCase();
      for (let target of labelTexts) {
        if (text === target || text.includes(target)) {
          let checkbox = null;

          if (el.tagName === 'LABEL' && el.getAttribute('for')) {
            checkbox = document.getElementById(el.getAttribute('for'));
          }

          if (!checkbox) {
            const container = el.closest('div, li, td') || el.parentElement;
            if (container) {
              checkbox = container.querySelector('input[type="checkbox"]');
              if (!checkbox && container.parentElement) {
                checkbox = container.parentElement.querySelector('input[type="checkbox"]');
              }
            }
          }

          if (checkbox && !checkbox.checked) {
            checkbox.click();
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            checkedCount++;
            console.log(LOG + ' Checked prerequisite checkbox: "' + text.substring(0, 50) + '..."');
          }
          break;
        }
      }
    }

    console.log(LOG + ' Prerequisite checkboxes checked: ' + checkedCount + ' (of 3 expected).');
    if (checkedCount < 3) {
      console.warn(LOG + ' Not all prerequisite checkboxes were found/checked. Please verify manually.');
    }
  }

  // --- Build and fill the Reviewer Remarks editor ---
  function fillReviewerRemarks(cadre, attempts) {
    attempts = attempts || 0;

    const employeeNameRaw  = getEmployeeName();
    const employeeName     = toProperCase(employeeNameRaw);
    const designation      = getDesignation();
    const admissibleHrs    = getAdmissibleOtaHours();

    if (!employeeName || !designation || !admissibleHrs) {
      if (attempts >= 10) {
        console.warn(LOG + ' Could not read all required fields for the remark. Remark NOT filled.');
        return;
      }
      setTimeout(function () { fillReviewerRemarks(cadre, attempts + 1); }, 500);
      return;
    }

    const hasDocument = isDocumentAttached();
    console.log(LOG + ' Document attached: ' + hasDocument);

    const remark = hasDocument
      ? buildOtaRemarkWithDocument(employeeName, designation, cadre, admissibleHrs)
      : buildOtaRemarkNoDocument(employeeName, designation, cadre, admissibleHrs);

    const editor   = document.getElementById('editor');
    const textarea = document.getElementById('dop_member_comment');

    if (!editor) {
      if (attempts >= 10) {
        console.warn(LOG + ' Reviewer Remarks editor (#editor) not found. Remark NOT filled.');
        return;
      }
      setTimeout(function () { fillReviewerRemarks(cadre, attempts + 1); }, 500);
      return;
    }

    editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
    editor.innerText = remark;
    if (textarea) textarea.value = remark;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.dispatchEvent(new Event('blur',  { bubbles: true }));

    console.log(LOG + ' Reviewer Remarks filled.');
    console.log(LOG + ' *** Please verify the multiplication factor, checkboxes, and remark, then click Review yourself. ***');

    // Send to register (non-blocking)
    sendToRegister({
      employeeNumberRaw: getEmployeeNumber(),
      employeeNameRaw:   employeeNameRaw,
      employeeName:      employeeName,
      designation:       designation,
      cadre:             cadre,
      remark:            remark
    });
  }

  // --- Gather remaining register fields and POST to the Apps Script Web App ---
  function sendToRegister(base) {
    // Skip if URL is not configured
    if (!OTA_SHEET_WEBAPP_URL || OTA_SHEET_WEBAPP_URL.indexOf('PASTE_YOUR') === 0) {
      console.log(LOG + ' Google Sheet Web App URL not configured. Skipping register write-back.');
      return;
    }

    // Don't block the main flow - use a timeout
    setTimeout(function() {
      const requestId            = getRequestId() || '';
      const totalHoursOfOta       = getLabelledField('Total Hours Of OTA');
      const totalSanctionedHours = getLabelledField('Total Sanctioned Hours');
      const totalNoDay            = getLabelledField('Total No. Day');
      const totalAmount           = getLabelledField('Total Approved Amount (INR)');
      const otaAmount = getOtaAmount() || getLabelledField('OTA Amount');
      const admissibleOtaHours    = getAdmissibleOtaHours();
      const { fromDate, toDate }  = getFromToDateFromTable();
      const month                 = fromDate ? computeMonthLabel(fromDate) : '';

      const payloadObj = {
        employeeNumber:        base.employeeNumberRaw,
        employeeNameRaw:       base.employeeNameRaw,
        employeeName:          base.employeeName,
        designation:           base.designation,
        cadre:                 base.cadre,
        requestId:             requestId,
        fromDate:               fromDate,
        toDate:                 toDate,
        month:                   month,
        totalHoursOfOta:        totalHoursOfOta,
        totalSanctionedHours:   totalSanctionedHours,
        totalNoDay:             totalNoDay,
        totalAmount:            totalAmount,
        admissibleOtaHours:     admissibleOtaHours,
        otaAmount:              otaAmount,
        remark:                 base.remark
      };

      console.log(LOG + ' Sending entry to OTA register sheet...', payloadObj);

      // Use fetch with timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      fetch(OTA_SHEET_WEBAPP_URL, {
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
      .then(function (response) {
        clearTimeout(timeoutId);
        if (!response.ok) {
          throw new Error('HTTP ' + response.status + ': ' + response.statusText);
        }
        return response.text();
      })
      .then(function (text) {
        console.log(LOG + ' Raw response from sheet: ' + text);
        let result;
        try {
          result = JSON.parse(text);
        } catch (e) {
          const isSuccess = text.toLowerCase().includes('success') || 
                           text.toLowerCase().includes('added') || 
                           text.toLowerCase().includes('ok');
          result = { success: isSuccess, message: text };
        }
        
        if (result && result.success) {
          console.log(LOG + ' ✅ Register write-back succeeded: ' + (result.message || 'OK'));
          // Open Google Sheet for verification (only once per request)
          openGoogleSheetForVerification();
        } else {
          const reason = (result && result.message) ? result.message : 'Unknown error';
          console.warn(LOG + ' ⚠️ Register write-back FAILED: ' + reason);
          showRegisterWarning(reason);
        }
      })
      .catch(function (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          console.warn(LOG + ' ⏱️ Register write-back timed out (5s) - skipping');
        } else {
          console.warn(LOG + ' ⚠️ Register write-back request failed: ' + err.message);
          showRegisterWarning(err.message);
        }
      });
    }, 100);
  }

  // --- Show a visible on-page warning banner if the Sheet write-back fails ---
  function showRegisterWarning(reason) {
    if (document.getElementById('ota-register-warning')) return;

    const banner = document.createElement('div');
    banner.id = 'ota-register-warning';
    banner.textContent = '⚠ Could not log this entry to the OTA register — please add manually. (' + reason + ')';
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
    banner.addEventListener('click', function () { banner.remove(); });

    document.body.appendChild(banner);
  }

  // --- Add "Open Sheet" button on the review page ---
  function addOpenSheetButton() {
    if (document.getElementById('fci-open-sheet-btn')) return;
    
    const btn = document.createElement('button');
    btn.id = 'fci-open-sheet-btn';
    btn.textContent = '📊 Open OTA Sheet';
    btn.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:99999;background:#026636;color:#fff;padding:10px 16px;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.2);';
    
    btn.addEventListener('click', function() {
      window.open(GOOGLE_SHEET_URL, '_blank');
    });
    
    document.body.appendChild(btn);
    console.log('[FCI OTA Assistant] Added "Open OTA Sheet" button.');
  }

  // --- Open Google Sheet in new tab for verification ---
  function openGoogleSheetForVerification() {
    // Check if we already opened the sheet for this request
    const sheetOpened = sessionStorage.getItem('fci_sheet_opened');
    if (sheetOpened === 'yes') {
      console.log('[FCI OTA Assistant] Google Sheet already opened for this request. Skipping.');
      return;
    }

    console.log('[FCI OTA Assistant] ✅ Write-back successful. Opening Google Sheet for verification...');

    // Open in new tab
    const newTab = window.open(GOOGLE_SHEET_URL, '_blank');

    if (newTab) {
      console.log('[FCI OTA Assistant] ✅ Google Sheet opened in new tab.');
      sessionStorage.setItem('fci_sheet_opened', 'yes');
    } else {
      console.warn('[FCI OTA Assistant] ⚠️ Could not open Google Sheet — popup blocker may be active.');
    }
  }

  // --- Check whether a supporting document is attached ---

  // --- Open Google Sheet to the specific tab ---
  function openGoogleSheet() {
    chrome.tabs.create({
      url: 'https://docs.google.com/spreadsheets/d/18TrCiKWXmobODD3C4YLZ7T3t50cmrDt9jdLaQFLyP-s/edit?gid=645230595#gid=645230595'
    });
  }

// --- Check whether a supporting document is attached ---
  function isDocumentAttached() {
    const allEls = document.querySelectorAll('label, span, div, p');
    for (let el of allEls) {
      if (el.textContent.trim().toLowerCase() === 'upload document') {
        const container = el.closest('div') || el.parentElement;
        if (container) {
          const link = container.querySelector('a, i.fa-paperclip, i[class*="paperclip"], img');
          if (link) return true;

          let sibling = container.nextElementSibling;
          if (sibling) {
            const sibLink = sibling.querySelector('a, i.fa-paperclip, i[class*="paperclip"], img');
            if (sibLink) return true;
            const sibText = sibling.textContent.trim();
            if (sibText && sibText !== '-' && sibText.toLowerCase() !== 'no') return true;
          }
        }
        return false;
      }
    }
    console.warn(LOG + ' "Upload Document" field not found on page. Assuming no document attached.');
    return false;
  }

  // --- Build the OTA remark text (document attached variant) ---
  function buildOtaRemarkWithDocument(employeeName, designation, cadre, admissibleHrs) {
    const properEmployeeName = employeeName.charAt(0).toUpperCase() + employeeName.slice(1);
    return 'Sir, kindly find the reference to the supporting document attached by the requesting employee, the OTA claimed has also been verified by the Manager (GM-Cell). Details of the OTA claim have been recorded separately. With regard to the Multiplication Factor, it is submitted that, as per Section 03 of The Punjab Shops and Commercial Establishments Act, 1958 (copy enclosed), the provisions of the said Act are not applicable to offices of or under the Central or State Governments, (except in the case of commercial undertakings), also accordingly, as per the relevant FCI OTA Circular (copy enclosed), the multiplication factor of 1.1 times of the hourly normal wage is applicable at exempted locations. In view of above, OTA claim of Sh. ' + properEmployeeName + ', ' + designation + ' (' + cadre + '), calculated with a multiplication factor of 1.1 for the verified ' + admissibleHrs + ' hours, may please be sanctioned, subject to the financial concurrence of the Finance Division, Local. Submitted please.';
  }

  // --- Build the OTA remark text (no document attached variant) ---
  function buildOtaRemarkNoDocument(employeeName, designation, cadre, admissibleHrs) {
    const properEmployeeName = employeeName.charAt(0).toUpperCase() + employeeName.slice(1);
    return 'Sir, the details of the OTA claim have been recorded separately. With regard to the Multiplication Factor, it is submitted that, as per Section 03 of The Punjab Shops and Commercial Establishments Act, 1958 (copy enclosed), the provisions of the said Act are not applicable to offices of or under the Central or State Governments, (except in the case of commercial undertakings), also accordingly, as per the relevant FCI OTA Circular (copy enclosed), the multiplication factor of 1.1 times of the hourly normal wage is applicable at exempted locations. In view of above, if agreed, with the details of the OTA timings submitted by the requesting official, the OTA claim of Sh. ' + properEmployeeName + ', ' + designation + ' (' + cadre + '), calculated with a multiplication factor of 1.1 for the verified ' + admissibleHrs + ' hours, may be sanctioned, subject to the financial concurrence of the Finance Division - Local. Submitted please.';
  }

  // --- Highlight the trigger row with a flashing yellow effect ---
  function highlightTriggerRow(tbody, targetName, targetAction) {
    const allRows = tbody.querySelectorAll('tr');
    let targetRow = null;

    for (let row of allRows) {
      const cells = row.querySelectorAll('td');
      if (cells.length === 8 || cells.length === 6) {
        const n = cells.length;
        const action = cells[n - 5].textContent.trim();
        const name   = cells[n - 4].textContent.trim().toUpperCase();
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