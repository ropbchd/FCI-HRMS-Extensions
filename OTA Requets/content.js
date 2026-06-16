// FCI OTA Request Assistant - Content Script v1.0
// Runs on the OTA Request review page.
// Detects the trigger condition, then fills the Multiplication Factor,
// prerequisite checkboxes, and Reviewer Remarks directly on this page.
// Does NOT navigate or auto-submit — officer reviews and clicks Review manually.

(function () {

  const PREFIX = 'CBO';
  const LOG    = '[FCI OTA Assistant]';

  const DISPATCHER_NAME = 'MAYURESH KUMAR';
  const MANAGER_NAME    = 'AMIT KUMAR SINGH';

  // --- Employee -> Cadre lookup (only two officials currently apply for OTA) ---
  const CADRE_LOOKUP = {
    '286357': 'General',   // RISHIKESH MISHRA
    '315595': 'Depot'       // SAMYAK NILKANTH MESHRAM
  };

  const MULTIPLICATION_FACTOR_VALUE = '1.1';

  // --- SAFETY CHECK: Only activate for OTA requests (Request ID starts with CBO) ---
  function getRequestId() {
    const bodyText = document.body.innerText || '';
    const match = bodyText.match(/\bCBO\d+\b/i);
    return match ? match[0].toUpperCase() : null;
  }

  const requestId = getRequestId();
  if (!requestId || !requestId.startsWith(PREFIX)) {
    console.log(LOG + ' Not a CBO (OTA) request. Extension will NOT activate.');
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
      // Rows can have 8 cells (S.No, Date, Version, Action, Name, Designation, Division, Authority)
      // or 6 cells when Date/Version are omitted (e.g. some "Dispatched" rows).
      // The last 5 cells are consistently: Action Taken, Employee Name, Designation, Division, Authority.
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

    // --- Find last "Dispatched" entry ---
    let lastDispatchedIndex = -1;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].actionTaken === 'Dispatched') lastDispatchedIndex = i;
    }
    const lastDispatched  = lastDispatchedIndex !== -1 ? entries[lastDispatchedIndex] : null;
    const afterDispatched = lastDispatched ? entries[lastDispatchedIndex + 1] || null : null;

    // --- Trigger condition ---
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

    // --- Read Employee Number from page ---
    const employeeNumber = getEmployeeNumber();
    const cadre = CADRE_LOOKUP[employeeNumber];

    if (!cadre) {
      console.warn(LOG + ' Employee Number "' + employeeNumber + '" not found in cadre lookup table. No action taken.');
      return;
    }

    console.log(LOG + ' Employee Number: ' + employeeNumber + ' | Cadre: ' + cadre);

    // Highlight the trigger row before acting
    highlightTriggerRow(tbody, DISPATCHER_NAME, 'Dispatched');

    // Proceed with filling the form
    setTimeout(function () {
      fillMultiplicationFactor();
      checkPrerequisiteCheckboxes();
      fillReviewerRemarks(cadre);
    }, 1500);
  }

  // --- Read Employee Number from the page info block ---
  function getEmployeeNumber() {
    // Try line-by-line text parsing similar to Higher Studies assistant
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
    // Look for an input/field near the "Admissible OTA Hours" label
    const labels = document.querySelectorAll('label, span, div, p');
    for (let el of labels) {
      if (el.textContent.trim().toLowerCase() === 'admissible ota hours') {
        // Search siblings / nearby inputs for the value
        let container = el.closest('div') || el.parentElement;
        if (container) {
          const input = container.querySelector('input, span.value, div.value');
          if (input) {
            const val = (input.value !== undefined ? input.value : input.textContent).trim();
            if (val) return val;
          }
          // Try next sibling element
          let sibling = container.nextElementSibling;
          if (sibling) {
            const val2 = sibling.textContent.trim();
            if (val2) return val2;
          }
        }
      }
    }

    // Fallback: line-by-line text parser
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

  // --- Fill Multiplication Factor: set row 1 to 1.1, then click header checkbox to propagate ---
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

    // After setting row 1, click the header checkbox to propagate to all rows
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

  // --- Check the three prerequisite checkboxes above Admissible OTA Hours ---
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
          // Find the checkbox associated with this label/text element
          let checkbox = null;

          // Case 1: el itself is/contains the checkbox's label with a "for" attribute
          if (el.tagName === 'LABEL' && el.getAttribute('for')) {
            checkbox = document.getElementById(el.getAttribute('for'));
          }

          // Case 2: checkbox is a sibling or inside a common container
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

    const employeeName  = getEmployeeName();
    const designation    = getDesignation();
    const admissibleHrs  = getAdmissibleOtaHours();

    if (!employeeName || !designation || !admissibleHrs) {
      if (attempts >= 10) {
        console.warn(LOG + ' Could not read all required fields for the remark (Name: "' + employeeName + '", Designation: "' + designation + '", Admissible Hours: "' + admissibleHrs + '"). Remark NOT filled.');
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
  }

  // --- Check whether a supporting document is attached (Upload Document field) ---
  function isDocumentAttached() {
    // Look for the "Upload Document" label, then check whether its associated
    // value area contains a link/icon (attached) or is empty (no attachment).
    const allEls = document.querySelectorAll('label, span, div, p');
    for (let el of allEls) {
      if (el.textContent.trim().toLowerCase() === 'upload document') {
        const container = el.closest('div') || el.parentElement;
        if (container) {
          // Attached: an <a> link or an icon (e.g. <i> paperclip) is present
          const link = container.querySelector('a, i.fa-paperclip, i[class*="paperclip"], img');
          if (link) return true;

          // Check the next sibling element too
          let sibling = container.nextElementSibling;
          if (sibling) {
            const sibLink = sibling.querySelector('a, i.fa-paperclip, i[class*="paperclip"], img');
            if (sibLink) return true;
            const sibText = sibling.textContent.trim();
            if (sibText && sibText !== '-' && sibText.toLowerCase() !== 'no') return true;
          }
        }
        // No link/icon found near the label -> treat as not attached
        return false;
      }
    }
    // Label not found at all -> assume not attached (safer default)
    console.warn(LOG + ' "Upload Document" field not found on page. Assuming no document attached.');
    return false;
  }

  // --- Build the OTA remark text (document attached variant) ---
  function buildOtaRemarkWithDocument(employeeName, designation, cadre, admissibleHrs) {
    return 'Sir, kindly find the reference to the supporting document attached by the requesting employee, the OTA claimed has also been verified by the D.G.M (R). Details of the OTA claim have been recorded separately. With regard to the Multiplication Factor, it is submitted that, as per Section 03 of The Punjab Shops and Commercial Establishments Act, 1958 (copy enclosed), the provisions of the said Act are not applicable to offices of or under the Central or State Governments, (except in the case of commercial undertakings), also accordingly, as per the relevant FCI OTA Circular (copy enclosed), the multiplication factor of 1.1 times of the hourly normal wage is applicable at exempted locations. In view of above, OTA claim of Sh. ' + employeeName + ', ' + designation + ' (' + cadre + '), calculated with a multiplication factor of 1.1 for the verified ' + admissibleHrs + ' hours, may please be sanctioned.';
  }

  // --- Build the OTA remark text (no document attached variant) ---
  function buildOtaRemarkNoDocument(employeeName, designation, cadre, admissibleHrs) {
    return 'Sir, the details of the OTA claim have been recorded separately. With regard to the Multiplication Factor, it is submitted that, as per Section 03 of The Punjab Shops and Commercial Establishments Act, 1958 (copy enclosed), the provisions of the said Act are not applicable to offices of or under the Central or State Governments, (except in the case of commercial undertakings), also accordingly, as per the relevant FCI OTA Circular (copy enclosed), the multiplication factor of 1.1 times of the hourly normal wage is applicable at exempted locations. In view of above, if agreed, with the details of the OTA timings submitted by the requesting official, the OTA claim of Sh. ' + employeeName + ', ' + designation + ' (' + cadre + '), calculated with a multiplication factor of 1.1 for the verified ' + admissibleHrs + ' hours, may please be sanctioned.';
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