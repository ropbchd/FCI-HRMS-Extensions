// FCI NOC Passport Assistant - Add Reviewer Page Script
// Reads routing decision stored by content.js via sessionStorage
// and fills the Add Reviewer form accordingly.

(function () {

  const LOG = '[FCI NOC Passport Assistant]';

  // Fixed form values — all routing goes through RO CHANDIGARH
  const OFFICE_TYPE_VALUE  = '4';
  const TARGET_OFFICE_NAME = 'RO CHANDIGARH';

  // SAFETY CHECK: Only activate for NOC Passport requests (ID starts with NOCPASS)
  function getRequestId() {
    const bodyText = document.body.innerText || '';
    const match = bodyText.match(/\bNOCPASS\d+\b/i);
    return match ? match[0].toUpperCase() : null;
  }

  const requestId = getRequestId();
  if (!requestId || !requestId.startsWith('NOCPASS')) {
    console.log(LOG + ' Request ID not found or does not start with NOCPASS ("' + (requestId || 'none') + '"). Extension will NOT activate on this Add Reviewer page.');
    return;
  }
  console.log(LOG + ' Request ID confirmed on Add Reviewer page: ' + requestId);

  // Check if this navigation was triggered by the extension
  const triggered = sessionStorage.getItem('fci_noc_triggered');
  if (triggered !== 'yes') {
    console.log(LOG + ' Add Reviewer page opened manually — extension will NOT auto-fill.');
    return;
  }

  // Clear the flag immediately
  sessionStorage.removeItem('fci_noc_triggered');

  // Read routing decision from sessionStorage
  const stage         = sessionStorage.getItem('fci_noc_stage') || '1';
  const empNumber     = sessionStorage.getItem('fci_noc_assistant_emp')    || '276695';
  const assistantName = sessionStorage.getItem('fci_noc_assistant_name')   || 'ABHIMANYU SWAMI';
  const reasonText    = sessionStorage.getItem('fci_noc_assistant_remark') || '';

  console.log(LOG + ' Add Reviewer page — Stage: ' + stage);
  console.log(LOG + ' Routing to: ' + assistantName + ' (' + empNumber + ')');
  console.log(LOG + ' Reason: ' + reasonText);

  // Navigate to last page of action history table first
  setTimeout(goToLastPage, 2500);

  // Start filling the form after last page has loaded
  setTimeout(startAutomation, 4000);

  // Navigate to the last page of the action history table
  function goToLastPage() {
    let attempts = 0;
    const interval = setInterval(function () {
      attempts++;
      const paginateDivs = document.querySelectorAll('[id$="_paginate"], .dataTables_paginate, .pagination');
      let paginateDiv = null;
      for (let div of paginateDivs) {
        if (div.querySelectorAll('a, span').length > 0) { paginateDiv = div; break; }
      }

      if (!paginateDiv) {
        if (attempts >= 20) clearInterval(interval);
        return;
      }

      const pageLinks = paginateDiv.querySelectorAll('a, span');
      let highestNum = 0;
      let highestLink = null;
      for (let link of pageLinks) {
        const text = link.textContent.trim();
        const num  = parseInt(text);
        if (!isNaN(num) && text === String(num) && num > highestNum) {
          highestNum  = num;
          highestLink = link;
        }
      }

      if (highestLink && highestNum > 1) {
        clearInterval(interval);
        if (!highestLink.classList.contains('current') && !highestLink.classList.contains('active')) {
          console.log(LOG + ' Clicking last page (' + highestNum + ')...');
          highestLink.click();
        }
      } else if (highestNum <= 1) {
        clearInterval(interval);
        console.log(LOG + ' Only one page — no navigation needed.');
      } else if (attempts >= 20) {
        clearInterval(interval);
        console.warn(LOG + ' Could not find last page link.');
      }
    }, 500);
  }

  function startAutomation() {
    const officeTypeSelect = document.getElementById('filter_office_type');
    if (!officeTypeSelect) {
      console.warn(LOG + ' Office Type dropdown not found. Retrying...');
      setTimeout(startAutomation, 1500);
      return;
    }

    // Scroll form into view
    const officeTypeLabel = document.querySelector('label[for="filter_office_type"]');
    if (officeTypeLabel) officeTypeLabel.scrollIntoView({ behavior: 'smooth', block: 'center' });

    console.log(LOG + ' Step 1: Selecting Office Type = "RO"...');
    officeTypeSelect.value = OFFICE_TYPE_VALUE;
    triggerSelect2(officeTypeSelect, OFFICE_TYPE_VALUE);
    officeTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));

    waitForDropdownAndSelect('filter_office', TARGET_OFFICE_NAME, function (officeValue) {
      console.log(LOG + ' Step 2: Office selected. Waiting for Employee list...');

      waitForDropdownAndSelect('filter_employee', empNumber, function (employeeValue) {
        console.log(LOG + ' Step 3: Employee selected.');
        const employeeSelect = document.getElementById('filter_employee');
        triggerSelect2(employeeSelect, employeeValue);
        setTimeout(fillReason, 1000);
      });
    });
  }

  function fillReason() {
    console.log(LOG + ' Step 4: Filling Reason field...');

    const editor   = document.getElementById('editor');
    const comments = document.getElementById('comments');

    if (!editor || !comments) {
      console.warn(LOG + ' Reason editor not found.');
      return;
    }

    editor.innerText  = reasonText;
    comments.value    = reasonText;
    editor.dispatchEvent(new Event('input', { bubbles: true }));

    console.log(LOG + ' All fields filled.');
    console.log(LOG + ' *** Please review and click the "Add" button yourself. ***');
  }

  // Trigger Select2 via page context jQuery
  function triggerSelect2(selectEl, value) {
    const id = selectEl.id;
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        var el = document.getElementById('${id}');
        if (el && typeof $ !== 'undefined') {
          $(el).trigger({ type: 'select2:select', params: { data: { id: '${value}' } } });
        }
      })();
    `;
    document.head.appendChild(script);
    script.remove();
  }

  // Wait for dropdown to populate then select by matching text containing targetValue
  function waitForDropdownAndSelect(selectId, targetValue, callback) {
    let attempts = 0;
    const interval = setInterval(function () {
      attempts++;
      const selectEl = document.getElementById(selectId);
      const options  = selectEl ? selectEl.querySelectorAll('option') : [];

      let matchedOption = null;
      for (let opt of options) {
        if (opt.textContent.trim().includes(targetValue)) { matchedOption = opt; break; }
      }

      if (matchedOption) {
        clearInterval(interval);
        const value = matchedOption.value;
        selectEl.value = value;
        triggerSelect2(selectEl, value);
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        console.log(LOG + ' Selected "' + targetValue + '" in #' + selectId);
        callback(value);

      } else if (attempts >= 30) {
        clearInterval(interval);
        console.warn(LOG + ' Could not find "' + targetValue + '" in #' + selectId + ' after 15 seconds.');
        const selectEl2 = document.getElementById(selectId);
        if (selectEl2) {
          selectEl2.querySelectorAll('option').forEach(o => {
            console.warn('  "' + o.textContent.trim() + '"');
          });
        }
      }
    }, 500);
  }

})();
