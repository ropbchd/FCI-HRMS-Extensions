// FCI NOC Assistant — Add Reviewer Page Script
// Runs on workflow/add-reviewer/*
// Reads sessionStorage handoff from content.js and fills the Add Reviewer form.
// v4.5 — Data-driven form filling, no stage-specific business logic
// world: "MAIN" — runs in page context to access jQuery/Select2

(function () {

  // --- NOE GUARD ---
  const bodyText = document.body.innerText || '';
  const noeMatch = bodyText.match(/\bNOE\d+\b/i);
  if (!noeMatch) {
    console.log('[FCI NOC Assistant] Add Reviewer: NOE request ID not found. Extension will NOT activate.');
    return;
  }
  console.log('[FCI NOC Assistant] Add Reviewer: Request ID ' + noeMatch[0] + ' confirmed.');

  // --- TRIGGER GUARD ---
  const triggered = sessionStorage.getItem('fci_noc_triggered');
  if (triggered !== 'yes') {
    console.log('[FCI NOC Assistant] Add Reviewer: Not triggered by content.js. No action taken.');
    return;
  }
  sessionStorage.removeItem('fci_noc_triggered');

  // --- READ SESSION STORAGE HANDOFF ---
  const stage              = sessionStorage.getItem('fci_noc_stage');
  const officeType         = sessionStorage.getItem('fci_noc_office_type');
  const targetOffice       = sessionStorage.getItem('fci_noc_target_office');
  const targetEmployeeName = sessionStorage.getItem('fci_noc_target_employee_name');
  const assistantEmp       = sessionStorage.getItem('fci_noc_assistant_emp');
  const assistantName      = sessionStorage.getItem('fci_noc_assistant_name');
  const assistantRemark    = sessionStorage.getItem('fci_noc_assistant_remark');

  if (!stage) {
    console.log('[FCI NOC Assistant] Add Reviewer: No stage in sessionStorage. No action taken.');
    return;
  }

  console.log('[FCI NOC Assistant] Add Reviewer: Stage = ' + stage);
  console.log('[FCI NOC Assistant] Add Reviewer: Office Type = ' + officeType);
  console.log('[FCI NOC Assistant] Add Reviewer: Target Office = ' + targetOffice);
  console.log('[FCI NOC Assistant] Add Reviewer: Target Employee Name = ' + targetEmployeeName);
  console.log('[FCI NOC Assistant] Add Reviewer: Assistant Emp = ' + assistantEmp);
  console.log('[FCI NOC Assistant] Add Reviewer: Assistant Name = ' + assistantName);
  console.log('[FCI NOC Assistant] Add Reviewer: Remark = ' + assistantRemark);

  // --- SELECT2 HELPERS (script-tag injection — required for world: MAIN) ---

  function triggerSelect2(selectId, value) {
    const script = document.createElement('script');
    script.textContent = '(function() {' +
      'var el = document.getElementById("' + selectId + '");' +
      'if (el && typeof $ !== "undefined") {' +
        '$(el).val("' + value + '").trigger("change");' +
        '$(el).trigger({ type: "select2:select", params: { data: { id: "' + value + '" } } });' +
      '}' +
    '})();';
    document.head.appendChild(script);
    script.remove();
    console.log('[FCI NOC Assistant] Add Reviewer: Select2 triggered for #' + selectId + ' = ' + value);
  }

  // Wait for dropdown options to load, then find and select by text match
  // matchValue: string to search for in option text (normalised, uppercase)
  function waitForDropdownAndSelectByText(selectId, matchValue, callback, maxAttempts) {
    maxAttempts = maxAttempts || 40;
    let attempts = 0;
    const targetNorm = matchValue.toString().trim().replace(/\s+/g, ' ').toUpperCase();

    const interval = setInterval(function () {
      attempts++;
      const selectEl = document.getElementById(selectId);
      const options  = selectEl ? selectEl.querySelectorAll('option') : [];

      if (options.length <= 1) {
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          console.warn('[FCI NOC Assistant] Add Reviewer: Dropdown #' + selectId + ' options never loaded.');
          callback(false);
        }
        return;
      }

      let matchedValue = null;
      for (let opt of options) {
        const optText = opt.textContent.trim().replace(/\s+/g, ' ').toUpperCase();
        if (optText.includes(targetNorm)) {
          matchedValue = opt.value;
          break;
        }
      }

      if (matchedValue !== null) {
        clearInterval(interval);
        selectEl.value = matchedValue;
        triggerSelect2(selectId, matchedValue);
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('[FCI NOC Assistant] Add Reviewer: Selected "' + matchValue + '" in #' + selectId);
        callback(true);
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        console.warn('[FCI NOC Assistant] Add Reviewer: Could not find "' + matchValue + '" in #' + selectId + ' after ' + maxAttempts + ' attempts.');
        if (selectEl) {
          selectEl.querySelectorAll('option').forEach(function(o) {
            console.warn('  Available: "' + o.textContent.trim() + '"');
          });
        }
        callback(false);
      }
    }, 500);
  }

  // --- FORM FILLING FUNCTIONS ---

  function fillOfficeType(callback) {
    const selectEl = document.getElementById('filter_office_type');
    if (!selectEl) {
      console.warn('[FCI NOC Assistant] Add Reviewer: #filter_office_type not found. Retrying...');
      setTimeout(function() { fillOfficeType(callback); }, 1000);
      return;
    }

    selectEl.value = officeType;
    triggerSelect2('filter_office_type', officeType);
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    console.log('[FCI NOC Assistant] Add Reviewer: Office Type set to ' + officeType);
    // Allow Select2 change handler to fire before next step
    setTimeout(function() { callback(true); }, 800);
  }

  function fillOffice(callback) {
    // Purely data-driven: if targetOffice is set, select it; otherwise skip
    if (!targetOffice) {
      console.log('[FCI NOC Assistant] Add Reviewer: No target office — skipping office selection.');
      callback(true);
      return;
    }
    waitForDropdownAndSelectByText('filter_office', targetOffice, function(success) {
      if (!success) {
        console.warn('[FCI NOC Assistant] Add Reviewer: Office selection failed. Continuing anyway...');
      }
      callback(success);
    }, 40);
  }

  function fillReason() {
    const editor   = document.getElementById('editor');
    const comments = document.getElementById('comments');

    if (!editor) {
      console.warn('[FCI NOC Assistant] Add Reviewer: #editor not found.');
      return false;
    }
    if (!assistantRemark) {
      console.warn('[FCI NOC Assistant] Add Reviewer: No remark text to fill.');
      return false;
    }

    editor.innerText = assistantRemark;
    if (comments) comments.value = assistantRemark;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.dispatchEvent(new Event('blur',  { bubbles: true }));

    console.log('[FCI NOC Assistant] Add Reviewer: Reason/Remark filled.');
    return true;
  }

  // Single employee selection function — data-driven, no stage flags
  // Priority: assistantEmp in option text → assistantName in option text → targetEmployeeName in option text
  function selectEmployee(callback) {

    // Validation: warn if both identifiers are set (should never happen with clean content.js)
    if (assistantEmp && targetEmployeeName) {
      console.warn('[FCI NOC Assistant] Add Reviewer: ⚠️ Both assistantEmp and targetEmployeeName are set. Using assistantEmp as primary. Check content.js routing for stage "' + stage + '".');
    }

    if (assistantEmp) {
      // Primary: search option text for emp number, fallback to name
      console.log('[FCI NOC Assistant] Add Reviewer: Selecting employee by empNo: ' + assistantEmp);
      waitForDropdownAndSelectByText('filter_employee', assistantEmp, function(success) {
        if (success) {
          console.log('[FCI NOC Assistant] Add Reviewer: Employee selected by empNo.');
          callback(true);
        } else if (assistantName) {
          // Fallback: try matching by name
          console.log('[FCI NOC Assistant] Add Reviewer: empNo not found in text. Trying name fallback: ' + assistantName);
          waitForDropdownAndSelectByText('filter_employee', assistantName, function(nameSuccess) {
            if (!nameSuccess) {
              console.warn('[FCI NOC Assistant] Add Reviewer: Employee not found by empNo or name. Please select manually.');
            }
            callback(nameSuccess);
          }, 20);
        } else {
          console.warn('[FCI NOC Assistant] Add Reviewer: Employee not found by empNo and no name fallback available.');
          callback(false);
        }
      }, 30);

    } else if (targetEmployeeName) {
      // Name-based selection (for stages 3B, 3D, 3Mismatch, 1D variants)
      console.log('[FCI NOC Assistant] Add Reviewer: Selecting employee by name: ' + targetEmployeeName);
      waitForDropdownAndSelectByText('filter_employee', targetEmployeeName, function(success) {
        if (!success) {
          console.warn('[FCI NOC Assistant] Add Reviewer: Employee "' + targetEmployeeName + '" not found. Please select manually.');
        }
        callback(success);
      }, 30);

    } else {
      console.log('[FCI NOC Assistant] Add Reviewer: No employee identifier provided — skipping employee selection.');
      callback(true);
    }
  }

  // --- MAIN EXECUTION FLOW ---

  function execute() {
    console.log('[FCI NOC Assistant] Add Reviewer: Starting form fill sequence...');

    // Step 1: Fill Office Type
    fillOfficeType(function(officeTypeOk) {
      if (!officeTypeOk) {
        console.warn('[FCI NOC Assistant] Add Reviewer: Office Type failed. Aborting.');
        return;
      }

      // Step 2: Fill Office
      fillOffice(function(officeOk) {
        if (!officeOk && targetOffice) {
          console.warn('[FCI NOC Assistant] Add Reviewer: Office fill failed. Continuing anyway...');
        }

        // Step 3: Fill Reason/Remark
        fillReason();

        // Step 4: Select Employee (data-driven, no stage flags)
        selectEmployee(function(empOk) {
          console.log('[FCI NOC Assistant] Add Reviewer: Form filling complete. Please review and click Add yourself.');
        });
      });
    });
  }

  // --- NAVIGATE TO LAST PAGE OF ACTION HISTORY BEFORE FILLING FORM ---
  function goToLastPage(callback) {
    let attempts = 0;
    const interval = setInterval(function () {
      attempts++;
      const paginateDivs = document.querySelectorAll('[id$="_paginate"], .dataTables_paginate, .pagination');
      let paginateDiv = null;
      for (let div of paginateDivs) {
        if (div.querySelectorAll('a, span').length > 0) { paginateDiv = div; break; }
      }
      if (!paginateDiv) {
        if (attempts >= 20) { clearInterval(interval); callback(); }
        return;
      }
      const pageLinks = paginateDiv.querySelectorAll('a, span');
      let highestNum = 0;
      let highestLink = null;
      for (let link of pageLinks) {
        const text = link.textContent.trim();
        const num = parseInt(text);
        if (!isNaN(num) && text === String(num) && num > highestNum) {
          highestNum = num; highestLink = link;
        }
      }
      if (highestLink && highestNum > 1) {
        clearInterval(interval);
        if (!highestLink.classList.contains('current') && !highestLink.classList.contains('active')) {
          console.log('[FCI NOC Assistant] Add Reviewer: Navigating to last page (' + highestNum + ')...');
          highestLink.click();
        } else {
          console.log('[FCI NOC Assistant] Add Reviewer: Already on last page (' + highestNum + ').');
        }
        setTimeout(callback, 1000);
      } else if (highestNum <= 1) {
        clearInterval(interval);
        console.log('[FCI NOC Assistant] Add Reviewer: Single page — no navigation needed.');
        callback();
      } else if (attempts >= 20) {
        clearInterval(interval);
        console.warn('[FCI NOC Assistant] Add Reviewer: Could not find last page link.');
        callback();
      }
    }, 500);
  }

  // --- STARTUP ---
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(function() { goToLastPage(function() { setTimeout(execute, 1000); }); }, 500);
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(function() { goToLastPage(function() { setTimeout(execute, 1000); }); }, 500);
    });
  }

})();
