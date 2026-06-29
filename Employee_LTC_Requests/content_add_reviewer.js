// FCI LTC Assistant - Add Reviewer Page Script v1.1
// Based on working NOC/Higher Studies Assistant pattern

(function () {

  const LOG = '[FCI LTC Assistant]';
  const TARGET_RO_OFFICE = 'RO CHANDIGARH';

  // SAFETY CHECK: Only activate for LTC requests (ID starts with LBD)
  function getRequestId() {
    const bodyText = document.body.innerText || '';
    const match = bodyText.match(/\bLBD\d+\b/i);
    return match ? match[0].toUpperCase() : null;
  }

  const requestId = getRequestId();
  if (!requestId || !requestId.startsWith('LBD')) {
    console.log(LOG + ' Not an LBD request. Extension will NOT activate.');
    return;
  }
  console.log(LOG + ' Request ID confirmed on Add Reviewer page: ' + requestId);

  // Check if this navigation was triggered by the extension
  const triggered = sessionStorage.getItem('fci_ltc_triggered');
  if (triggered !== 'yes') {
    console.log(LOG + ' Manual navigation — auto-fill disabled.');
    return;
  }

  // Clear the flag immediately
  sessionStorage.removeItem('fci_ltc_triggered');

  // Read routing decision from sessionStorage
  const stage              = sessionStorage.getItem('fci_ltc_stage') || '1';
  const officeTypeValue    = sessionStorage.getItem('fci_ltc_office_type') || '4';
  const empNumber          = sessionStorage.getItem('fci_ltc_assistant_emp');
  const assistantName      = sessionStorage.getItem('fci_ltc_assistant_name') || '';
  const reasonText         = sessionStorage.getItem('fci_ltc_assistant_remark') || '';
  const targetOfficeName   = sessionStorage.getItem('fci_ltc_target_office') || TARGET_RO_OFFICE;
  const targetEmployeeName = sessionStorage.getItem('fci_ltc_target_employee_name') || '';

  const isStage3B    = (stage === '3b');
  const isStage3BRO  = (stage === '3b-ro');
  const isStage3BAny = isStage3B || isStage3BRO;

  console.log(LOG + ' Stage: ' + stage);
  if (isStage3BAny) {
    console.log(LOG + ' Stage 3B: Office: ' + targetOfficeName + ', Employee: ' + targetEmployeeName);
  } else {
    console.log(LOG + ' Routing to: ' + assistantName + ' (' + empNumber + ')');
  }
  console.log(LOG + ' Reason: ' + reasonText);

  // Navigate to last page of action history table first
  setTimeout(goToLastPage, 2500);
  // Stage 3B gets longer delay because DO office list loads slower
  setTimeout(startAutomation, isStage3BAny ? 6000 : 4000);

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
          highestNum = num;
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

    const officeTypeLabel = document.querySelector('label[for="filter_office_type"]');
    if (officeTypeLabel) officeTypeLabel.scrollIntoView({ behavior: 'smooth', block: 'center' });

    console.log(LOG + ' Step 1: Selecting Office Type (value=' + officeTypeValue + ')...');
    officeTypeSelect.value = officeTypeValue;
    triggerSelect2(officeTypeSelect, officeTypeValue);
    officeTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));

    console.log(LOG + ' Step 1 done. Waiting for Office dropdown to populate...');

    if (isStage3BAny) {
      // Stage 3B / 3B-RO: select target office by name, then target employee by name
      setTimeout(function () {
        console.log(LOG + ' Step 2 (Stage 3B): Polling for office "' + targetOfficeName + '"...');
        waitForDropdownAndSelect('filter_office', targetOfficeName, function () {
          console.log(LOG + ' Step 2 (Stage 3B): Office selected. Waiting for Employee list...');
          waitForDropdownAndSelect('filter_employee', targetEmployeeName, function (employeeValue) {
            console.log(LOG + ' Step 3 (Stage 3B): Employee selected.');
            const employeeSelect = document.getElementById('filter_employee');
            triggerSelect2(employeeSelect, employeeValue);
            setTimeout(fillReason, 1000);
          });
        });
      }, 2000);
    } else {
      // Stage 1 / 3C: select RO CHANDIGARH, then select assistant by emp number
      waitForDropdownAndSelect('filter_office', TARGET_RO_OFFICE, function (officeValue) {
        console.log(LOG + ' Step 2: Office selected. Waiting for Employee list...');
        waitForDropdownAndSelect('filter_employee', empNumber, function (employeeValue) {
          console.log(LOG + ' Step 3: Employee selected.');
          const employeeSelect = document.getElementById('filter_employee');
          triggerSelect2(employeeSelect, employeeValue);
          setTimeout(fillReason, 1000);
        });
      });
    }
  }

  function fillReason() {
    console.log(LOG + ' Step 4: Filling Reason field...');
    const editor = document.getElementById('editor');
    const commentsTextarea = document.getElementById('comments');
    if (!editor || !commentsTextarea) {
      console.warn(LOG + ' Reason editor not found.');
      return;
    }
    editor.innerText = reasonText;
    commentsTextarea.value = reasonText;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    console.log(LOG + ' Step 4 done. All fields filled.');
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

  // Wait for dropdown to populate then select by option text containing targetValue
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
        console.log(LOG + ' Selected "' + targetValue + '" in #' + selectId);
        callback(value);
      } else if (attempts >= 40) {
        clearInterval(interval);
        console.warn(LOG + ' Could not find "' + targetValue + '" in #' + selectId + ' after 20 seconds.');
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