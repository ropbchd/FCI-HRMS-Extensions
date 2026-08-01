// FCI NOC Passport Assistant - Add Reviewer Page Script
// Reads the precomputed routing payload (Floating Window Framework, fp.* namespace)
// and fills the Add Reviewer form accordingly.
// v2 — Office Type / Office / Employee are now read dynamically per fp.chosen,
// instead of the old hardcoded RO CHANDIGARH constants. Also exposes a small
// window.FCIWorkflow so the floating panel (same page, MAIN world) can switch
// which precomputed payload is applied, without a page reload.

(function () {

  const LOG = '[FCI NOC Passport Assistant]';

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

  // --- Read a precomputed payload from the fp.* namespace ---
  function readPayload(key) {
    const officeType = sessionStorage.getItem('fp.route.' + key + '.officeType');
    const office      = sessionStorage.getItem('fp.route.' + key + '.office');
    const name        = sessionStorage.getItem('fp.route.' + key + '.name');
    const emp         = sessionStorage.getItem('fp.route.' + key + '.emp'); // may be null
    const remark      = sessionStorage.getItem('fp.remark.' + key) || '';

    if (!officeType || !office || !name) return null;
    return { officeType, office, name, emp, remark };
  }

  function chosenLabel(key) {
    if (key === 'reexamine') return 'Re-examine';
    if (key === 'returnprevious') return 'Return to Previous Level';
    return 'the recommended routing';
  }

  let chosen = sessionStorage.getItem('fp.chosen') || 'recommended';
  let payload = readPayload(chosen);

  if (!payload) {
    console.warn(LOG + ' Precomputed payload for "' + chosen + '" is missing or incomplete. No action taken.');
    return;
  }

  console.log(LOG + ' Add Reviewer page — chosen payload: ' + chosen);
  console.log(LOG + ' Routing to: ' + payload.name + ' @ ' + payload.office + ' (Office Type ' + payload.officeType + ')');
  console.log(LOG + ' Reason: ' + payload.remark);

  // Navigate to last page of action history table first
  setTimeout(goToLastPage, 2500);

  // Start filling the form after last page has loaded
  setTimeout(function () { fillForm(payload); }, 4000);

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

  // --- Fill Office Type → Office → Employee → Reason, from a given payload ---
  function fillForm(activePayload) {
    const officeTypeSelect = document.getElementById('filter_office_type');
    if (!officeTypeSelect) {
      console.warn(LOG + ' Office Type dropdown not found. Retrying...');
      setTimeout(function () { fillForm(activePayload); }, 1500);
      return;
    }

    // Scroll form into view
    const officeTypeLabel = document.querySelector('label[for="filter_office_type"]');
    if (officeTypeLabel) officeTypeLabel.scrollIntoView({ behavior: 'smooth', block: 'center' });

    console.log(LOG + ' Step 1: Selecting Office Type = "' + activePayload.officeType + '"...');
    officeTypeSelect.value = activePayload.officeType;
    triggerSelect2(officeTypeSelect, activePayload.officeType);
    officeTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));

    waitForDropdownAndSelect('filter_office', activePayload.office, function () {
      console.log(LOG + ' Step 2: Office selected. Waiting for Employee list...');

      const employeeMatchTarget = activePayload.emp || activePayload.name;
      waitForDropdownAndSelect('filter_employee', employeeMatchTarget, function (employeeValue) {
        console.log(LOG + ' Step 3: Employee selected.');
        const employeeSelect = document.getElementById('filter_employee');
        triggerSelect2(employeeSelect, employeeValue);
        setTimeout(function () { fillReason(activePayload.remark); }, 1000);
      });
    });
  }

  function fillReason(reasonText) {
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

  // ---------------------------------------------------------------------
  // Normalize dropdown text before comparison.
  //
  // Handles:
  //   • Multiple spaces
  //   • Tabs
  //   • Non-breaking spaces (NBSP)
  //   • Mixed case
  //   • Leading/trailing spaces
  // ---------------------------------------------------------------------
  function normalizeText(text) {
    return (text || '')
      .replace(/\u00A0/g, ' ')      // Convert NBSP to normal space
      .replace(/\s+/g, ' ')         // Collapse consecutive whitespace
      .trim()
      .toUpperCase();
  }

  // ---------------------------------------------------------------------
  // Wait for a dropdown to populate, then select the required option.
  //
  // Matching strategy:
  //   1. Exact normalized match (preferred)
  //   2. Normalized "contains" match (fallback)
  //
  // This makes the script resilient to HRMS inconsistencies such as:
  //   DO JALANDHAR
  //   DO  JALANDHAR
  //   DO     JALANDHAR
  //   RO CHANDIGARH
  //   RO  CHANDIGARH
  // ---------------------------------------------------------------------
  function waitForDropdownAndSelect(selectId, targetValue, callback) {

    let attempts = 0;

    const targetNormalized = normalizeText(targetValue);

    const interval = setInterval(function () {

      attempts++;

      const selectEl = document.getElementById(selectId);

      if (!selectEl) {

        if (attempts >= 30) {
          clearInterval(interval);
          console.warn(LOG + ' Dropdown #' + selectId + ' not found.');
        }

        return;
      }

      const options = Array.from(selectEl.querySelectorAll('option'));

      let matchedOption = null;

      // -------------------------------------------------------------
      // Pass 1 : Exact normalized match
      // -------------------------------------------------------------
      for (const opt of options) {

        const optionText = normalizeText(opt.textContent);

        if (optionText === targetNormalized) {
          matchedOption = opt;
          break;
        }
      }

      // -------------------------------------------------------------
      // Pass 2 : Partial normalized match (fallback)
      // -------------------------------------------------------------
      if (!matchedOption) {

        for (const opt of options) {

          const optionText = normalizeText(opt.textContent);

          if (optionText.includes(targetNormalized)) {
            matchedOption = opt;
            break;
          }
        }
      }

      // -------------------------------------------------------------
      // Option found
      // -------------------------------------------------------------
      if (matchedOption) {

        clearInterval(interval);

        const value = matchedOption.value;

        selectEl.value = value;

        triggerSelect2(selectEl, value);

        selectEl.dispatchEvent(
          new Event('change', { bubbles: true })
        );

        console.log(
          LOG +
          ' Selected "' +
          matchedOption.textContent.trim() +
          '" in #' +
          selectId
        );

        callback(value);

        return;
      }

      // -------------------------------------------------------------
      // Timeout
      // -------------------------------------------------------------
      if (attempts >= 30) {

        clearInterval(interval);

        console.warn(
          LOG +
          ' Could not find "' +
          targetValue +
          '" in #' +
          selectId +
          ' after 15 seconds.'
        );

        console.warn(
          LOG +
          ' Normalized target : "' +
          targetNormalized +
          '"'
        );

        console.warn(
          LOG +
          ' Available options:'
        );

        options.forEach(function (opt) {

          console.warn(
            '  "' +
            normalizeText(opt.textContent) +
            '"'
          );

        });

      }

    }, 500);
  }

  // === Floating Window Bridge (Add Reviewer page variant) ===
  // No routing decisions here — the three payloads already exist in
  // sessionStorage from the Review page. This bridge only switches which one
  // is applied and re-runs the (already-generic) fill routine. It shares the
  // same method names as content.js's Review-page bridge so floating_window.js
  // needs zero page-specific branching.
  window.FCIWorkflow = {
    getWorkflowContext() {
      return {
        requestId: requestId,
        hasRecommendation: true,
        recommendedSummary: 'Currently filling as: ' + chosenLabel(chosen) + ' \u2014 routing to ' + payload.name
      };
    },

    executeReExamine() {
      switchPayload('reexamine');
    },

    executeReturnPrevious() {
      switchPayload('returnprevious');
    }
  };

  function switchPayload(key) {
    const newPayload = readPayload(key);
    if (!newPayload) {
      console.warn(LOG + ' Cannot switch to "' + key + '" — payload not precomputed or incomplete.');
      return;
    }
    chosen  = key;
    payload = newPayload;
    sessionStorage.setItem('fp.chosen', key);
    console.log(LOG + ' Switching filled payload to: ' + key);
    fillForm(payload);
  }

  // Panel is injected here too (Part 6) — bridge is ready immediately, since
  // all three payloads were already computed on the Review page.
  if (window.FloatingWindow && typeof window.FloatingWindow.render === 'function') {
    window.FloatingWindow.render();
  } else {
    console.warn(LOG + ' FloatingWindow.render() not found — floating_window.js may not have loaded.');
  }

})();