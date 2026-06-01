// FCI NOC Assistant - Add Reviewer Page Script
// Reads routing decision stored by content.js via sessionStorage
// and fills the Add Reviewer form accordingly.

(function () {

  // --- STAGE 1 defaults (used when no sessionStorage override is present) ---
  const STAGE1_EMP_NUMBER = '276695';        // ABHIMANYU SWAMI
  const STAGE1_REASON     = 'With respect to the application made by the employee, kindly provide the vigilance clearance for the purpose of NOC for other exam.';
  const TARGET_RO_OFFICE  = 'RO CHANDIGARH'; // used for all RO-targeted stages
  // -------------------------------------------------------------------------

  // SAFETY CHECK: Only activate for NOC For Other Examination requests.
  function getRequestId() {
    const bodyText = document.body.innerText || '';
    const match = bodyText.match(/\bNOE\d+\b/i);
    return match ? match[0].toUpperCase() : null;
  }

  const requestId = getRequestId();
  if (!requestId || !requestId.startsWith('NOE')) {
    console.log('[FCI NOC Assistant] Request ID not found or does not start with NOE ("' + (requestId || 'none') + '"). Extension will NOT activate on this Add Reviewer page.');
    return;
  }
  console.log('[FCI NOC Assistant] Request ID confirmed on Add Reviewer page: ' + requestId);

  // Check if this navigation was triggered by the extension.
  const triggered = sessionStorage.getItem('fci_noc_triggered');
  if (triggered !== 'yes') {
    console.log('[FCI NOC Assistant] Add Reviewer page opened manually — extension will NOT auto-fill.');
    return;
  }

  // Clear the flag immediately so it does not carry over to future manual visits
  sessionStorage.removeItem('fci_noc_triggered');

  // Read routing decision from sessionStorage (set by content.js)
  const stage              = sessionStorage.getItem('fci_noc_stage') || '1';
  const officeTypeValue    = sessionStorage.getItem('fci_noc_office_type') || '4';  // default RO
  const empNumber          = sessionStorage.getItem('fci_noc_assistant_emp')    || STAGE1_EMP_NUMBER;
  const assistantName      = sessionStorage.getItem('fci_noc_assistant_name')   || 'ABHIMANYU SWAMI';
  const reasonText         = sessionStorage.getItem('fci_noc_assistant_remark') || STAGE1_REASON;

  // Stage 3B specific: target office and employee name (selected by name, not emp number)
  const targetOfficeName      = sessionStorage.getItem('fci_noc_target_office')         || TARGET_RO_OFFICE;
  const targetEmployeeName    = sessionStorage.getItem('fci_noc_target_employee_name')  || '';

  // For Stage 3B we match employee by name; for all other stages by emp number
  const isStage3B = (stage === '3b');

  console.log('[FCI NOC Assistant] Add Reviewer page — Stage: ' + stage);
  if (isStage3B) {
    console.log('[FCI NOC Assistant] Stage 3B: Routing to DO — Office: ' + targetOfficeName + ', Employee: ' + targetEmployeeName);
  } else {
    console.log('[FCI NOC Assistant] Routing to: ' + assistantName + ' (' + empNumber + ')');
  }
  console.log('[FCI NOC Assistant] Reason: ' + reasonText);

  // Navigate to last page of action history table first
  setTimeout(goToLastPage, 2500);

  // Start filling the form — delayed to allow last page to load first
  setTimeout(startAutomation, 4000);

  // Navigate to the last page of the action history table
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
        console.log('[FCI NOC Assistant] Pagination not found yet, attempt ' + attempts);
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

      console.log('[FCI NOC Assistant] Pagination found. Highest page: ' + highestNum);

      if (highestLink && highestNum > 1) {
        clearInterval(interval);
        if (!highestLink.classList.contains('current') && !highestLink.classList.contains('active')) {
          console.log('[FCI NOC Assistant] Clicking last page (' + highestNum + ')...');
          highestLink.click();
        } else {
          console.log('[FCI NOC Assistant] Already on last page (' + highestNum + ').');
        }
      } else if (highestNum <= 1) {
        clearInterval(interval);
        console.log('[FCI NOC Assistant] Only one page — no navigation needed.');
      } else if (attempts >= 20) {
        clearInterval(interval);
        console.warn('[FCI NOC Assistant] Could not find last page link after 10 seconds.');
      }
    }, 500);
  }

  function startAutomation() {
    const officeTypeSelect = document.getElementById('filter_office_type');
    if (!officeTypeSelect) {
      console.warn('[FCI NOC Assistant] Office Type dropdown not found. Retrying...');
      setTimeout(startAutomation, 1500);
      return;
    }

    // Scroll to the form fields BEFORE filling so they are visible from the start
    const officeTypeLabel = document.querySelector('label[for="filter_office_type"]');
    if (officeTypeLabel) {
      officeTypeLabel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      console.log('[FCI NOC Assistant] Scrolled form fields into view.');
    }

    console.log('[FCI NOC Assistant] Step 1: Selecting Office Type (value=' + officeTypeValue + ')...');
    officeTypeSelect.value = officeTypeValue;
    triggerSelect2(officeTypeSelect, officeTypeValue);
    officeTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));

    console.log('[FCI NOC Assistant] Step 1 done. Waiting for Office dropdown...');

    if (isStage3B) {
      // Stage 3B: Office dropdown is a live-search Select2 (AJAX-powered).
      // Options are NOT pre-loaded in the DOM — they only appear after typing in the search box.
      // Strategy: open the Select2 dropdown, simulate typing, wait for result to appear, click it.
      // Portal live-search rejects the "DO " prefix — strip it before searching.
      // e.g. "DO BHATINDA" → search "BHATINDA", result "DO BHATINDA" appears → click it.
      const officeSearchTerm = targetOfficeName.replace(/^DO\s+/i, '').trim();
      console.log('[FCI NOC Assistant] Step 2 (Stage 3B): Searching office "' + officeSearchTerm + '" (full name: ' + targetOfficeName + ')...');
      select2LiveSearch('filter_office', officeSearchTerm, function () {
        console.log('[FCI NOC Assistant] Step 2 (Stage 3B): Office selected. Waiting for Employee list...');
        // Employee list for DO also uses live-search
        select2LiveSearch('filter_employee', targetEmployeeName, function () {
          console.log('[FCI NOC Assistant] Step 3 (Stage 3B): Employee selected.');
          setTimeout(fillReason, 1000);
        });
      });
    } else {
      // All other stages: select RO CHANDIGARH as office, then select employee by emp number
      waitForDropdownAndSelect('filter_office', TARGET_RO_OFFICE, function (officeValue) {
        console.log('[FCI NOC Assistant] Step 2: Office selected. Waiting for Employee list...');
        waitForDropdownAndSelect('filter_employee', empNumber, function (employeeValue) {
          console.log('[FCI NOC Assistant] Step 3: Employee selected.');
          const employeeSelect = document.getElementById('filter_employee');
          triggerSelect2(employeeSelect, employeeValue);
          setTimeout(fillReason, 1000);
        });
      });
    }
  }

  function fillReason() {
    console.log('[FCI NOC Assistant] Step 4: Filling in the Reason field...');

    const editor = document.getElementById('editor');
    const commentsTextarea = document.getElementById('comments');

    if (!editor || !commentsTextarea) {
      console.warn('[FCI NOC Assistant] Reason editor not found.');
      return;
    }

    editor.innerText = reasonText;
    commentsTextarea.value = reasonText;
    editor.dispatchEvent(new Event('input', { bubbles: true }));

    console.log('[FCI NOC Assistant] Step 4 done. All fields filled.');
    console.log('[FCI NOC Assistant] *** Please review and click the "Add" button yourself. ***');
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

      let matchedOption = null;
      for (let opt of options) {
        if (opt.textContent.trim().includes(targetValue)) {
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
        console.log('[FCI NOC Assistant] Selected "' + targetValue + '" in #' + selectId);
        callback(value);

      } else if (attempts >= 30) {
        clearInterval(interval);
        console.warn('[FCI NOC Assistant] Could not find "' + targetValue + '" in #' + selectId + ' after 15 seconds.');
        console.warn('[FCI NOC Assistant] Available options:');
        const selectEl2 = document.getElementById(selectId);
        if (selectEl2) {
          selectEl2.querySelectorAll('option').forEach(o => {
            console.warn('  "' + o.textContent.trim() + '"');
          });
        }
      }
    }, 500);
  }

  // --- HELPER: Select2 live-search simulation (for Stage 3B DO office and employee) ---
  // Used when a Select2 dropdown is AJAX-powered (options not pre-loaded in the DOM).
  // Simulates: open dropdown → type search text → wait for result → click matching result.
  function select2LiveSearch(selectId, searchText, callback) {
    const targetUpper = searchText.trim().toUpperCase();
    const script = document.createElement('script');

    // Step 1: Open the Select2 dropdown and type in the search box via jQuery in MAIN world.
    // The script tag runs in the page context where $ is available.
    script.textContent = `
      (function() {
        var el = document.getElementById('${selectId}');
        if (!el || typeof $ === 'undefined') return;
        var s2 = $(el);
        s2.select2('open');
        // After a short delay, type the search text into the Select2 search input
        setTimeout(function() {
          var searchInput = document.querySelector('.select2-search__field');
          if (searchInput) {
            searchInput.value = '${searchText.replace(/'/g, "\\'")}';
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            searchInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
          }
        }, 400);
      })();
    `;
    document.head.appendChild(script);
    script.remove();

    // Step 2: Poll for results to appear in the Select2 dropdown list, then click the match
    let attempts = 0;
    const interval = setInterval(function () {
      attempts++;

      // Select2 renders results in a <ul class="select2-results__options"> list
      const resultItems = document.querySelectorAll('.select2-results__option');
      let matchedItem = null;
      for (let item of resultItems) {
        const text = item.textContent.trim().toUpperCase();
        if (text.includes(targetUpper)) {
          matchedItem = item;
          break;
        }
      }

      if (matchedItem) {
        clearInterval(interval);
        console.log('[FCI NOC Assistant] Live-search result found for "' + searchText + '". Clicking...');
        matchedItem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        matchedItem.click();

        // After clicking, wait briefly then call the callback
        setTimeout(function () {
          callback();
        }, 800);

      } else if (attempts >= 30) {
        clearInterval(interval);
        console.warn('[FCI NOC Assistant] Live-search: no result found for "' + searchText + '" in #' + selectId + ' after 15 seconds.');
        console.warn('[FCI NOC Assistant] Visible result items:');
        document.querySelectorAll('.select2-results__option').forEach(function(item) {
          console.warn('  "' + item.textContent.trim() + '"');
        });
      }
    }, 500);
  }

})();
