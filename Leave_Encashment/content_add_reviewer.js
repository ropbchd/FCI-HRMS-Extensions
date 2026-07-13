// FCI Leave Encashment Assistant - Add Reviewer Page Script
// Reads routing decision stored by content.js via sessionStorage
// and fills the Add Reviewer form accordingly.

(function () {

  const TARGET_RO_OFFICE = 'RO CHANDIGARH';

  // SAFETY CHECK: Only activate for Leave Encashment requests (Request ID starts with CH)
  function getRequestId() {
    const bodyText = document.body.innerText || '';
    const match = bodyText.match(/\bCH\d+\b/i);
    return match ? match[0].toUpperCase() : null;
  }

  const requestId = getRequestId();
  if (!requestId || !requestId.startsWith('CH')) {
    console.log('[FCI Leave Encashment Assistant] Request ID not found or does not start with CH ("' + (requestId || 'none') + '"). Extension will NOT activate on this Add Reviewer page.');
    return;
  }
  console.log('[FCI Leave Encashment Assistant] Request ID confirmed on Add Reviewer page: ' + requestId);

  // Check if this navigation was triggered by the extension
  const triggered = sessionStorage.getItem('fci_leave_triggered');
  if (triggered !== 'yes') {
    console.log('[FCI Leave Encashment Assistant] Add Reviewer page opened manually — extension will NOT auto-fill.');
    return;
  }

  // Clear the flag immediately
  sessionStorage.removeItem('fci_leave_triggered');

  // Read routing decision from sessionStorage
  const stage              = sessionStorage.getItem('fci_leave_stage') || '1';
  const officeTypeValue    = sessionStorage.getItem('fci_leave_office_type') || '4';  // default RO
  const empNumber          = sessionStorage.getItem('fci_leave_assistant_emp') || '';
  const assistantName      = sessionStorage.getItem('fci_leave_assistant_name') || '';
  const reasonText         = sessionStorage.getItem('fci_leave_assistant_remark') || '';

  console.log('[FCI Leave Encashment Assistant] Add Reviewer page — Stage: ' + stage);
  console.log('[FCI Leave Encashment Assistant] Routing to: ' + assistantName + ' (' + empNumber + ')');
  console.log('[FCI Leave Encashment Assistant] Reason: ' + reasonText);

  // Navigate to last page of action history table first
  setTimeout(goToLastPage, 2500);
  setTimeout(startAutomation, 4000);

  function goToLastPage() {
    let attempts = 0;
    const interval = setInterval(function () {
      attempts++;

      const paginateDivs = document.querySelectorAll('[id$="_paginate"], .dataTables_paginate, .pagination');
      let paginateDiv = null;
      for (let div of paginateDivs) {
        if (div.querySelectorAll('a, span').length > 0) {
          paginateDiv = div;
          break;
        }
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
        const num = parseInt(text);
        if (!isNaN(num) && text === String(num) && num > highestNum) {
          highestNum = num;
          highestLink = link;
        }
      }

      if (highestLink && highestNum > 1) {
        clearInterval(interval);
        if (!highestLink.classList.contains('current') && !highestLink.classList.contains('active')) {
          highestLink.click();
        }
      } else if (highestNum <= 1) {
        clearInterval(interval);
      } else if (attempts >= 20) {
        clearInterval(interval);
      }
    }, 500);
  }

  function startAutomation() {
    const officeTypeSelect = document.getElementById('filter_office_type');
    if (!officeTypeSelect) {
      console.warn('[FCI Leave Encashment Assistant] Office Type dropdown not found. Retrying...');
      setTimeout(startAutomation, 1500);
      return;
    }

    const officeTypeLabel = document.querySelector('label[for="filter_office_type"]');
    if (officeTypeLabel) {
      officeTypeLabel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    console.log('[FCI Leave Encashment Assistant] Step 1: Selecting Office Type (value=' + officeTypeValue + ')...');
    officeTypeSelect.value = officeTypeValue;
    triggerSelect2(officeTypeSelect, officeTypeValue);
    officeTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));

    console.log('[FCI Leave Encashment Assistant] Step 1 done. Waiting for Office dropdown to populate...');

    // Select RO CHANDIGARH, then employee by emp number
    waitForDropdownAndSelect('filter_office', TARGET_RO_OFFICE, function (officeValue) {
      console.log('[FCI Leave Encashment Assistant] Step 2: Office selected. Waiting for Employee list...');
      waitForDropdownAndSelect('filter_employee', empNumber, function (employeeValue) {
        console.log('[FCI Leave Encashment Assistant] Step 3: Employee selected.');
        const employeeSelect = document.getElementById('filter_employee');
        triggerSelect2(employeeSelect, employeeValue);
        setTimeout(fillReason, 1000);
      });
    });
  }

  function fillReason() {
    console.log('[FCI Leave Encashment Assistant] Step 4: Filling in the Reason field...');

    const editor = document.getElementById('editor');
    const commentsTextarea = document.getElementById('comments');

    if (!editor || !commentsTextarea) {
      console.warn('[FCI Leave Encashment Assistant] Reason editor not found.');
      return;
    }

    editor.innerText = reasonText;
    commentsTextarea.value = reasonText;
    editor.dispatchEvent(new Event('input', { bubbles: true }));

    console.log('[FCI Leave Encashment Assistant] Step 4 done. All fields filled.');
    console.log('[FCI Leave Encashment Assistant] *** Please review and click the "Add" button yourself. ***');
  }

  // --- HELPER: Trigger Select2 via page context jQuery ---
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

  // --- HELPER: Wait for dropdown to populate then select by option text containing targetValue ---
  function waitForDropdownAndSelect(selectId, targetValue, callback) {
    let attempts = 0;
    const interval = setInterval(function () {
      attempts++;
      const selectEl = document.getElementById(selectId);
      const options  = selectEl ? selectEl.querySelectorAll('option') : [];

      const targetNormalised = targetValue.trim().replace(/\s+/g, ' ');
      let matchedOption = null;
      for (let opt of options) {
        const optText = opt.textContent.trim().replace(/\s+/g, ' ');
        if (optText.includes(targetNormalised)) {
          matchedOption = opt;
          break;
        }
      }

      if (matchedOption) {
        clearInterval(interval);
        const value = matchedOption.value;
        selectEl.value = value;
        triggerSelect2(selectEl, value);
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('[FCI Leave Encashment Assistant] Selected "' + targetValue + '" in #' + selectId);
        callback(value);

      } else if (attempts >= 40) {
        clearInterval(interval);
        console.warn('[FCI Leave Encashment Assistant] Could not find "' + targetValue + '" in #' + selectId + ' after 20 seconds.');
      }
    }, 500);
  }

})();