// FCI NOC Assistant — Add Reviewer Page Script
// Runs on workflow/add-reviewer/*
// Reads sessionStorage handoff from content.js and fills the Add Reviewer form.
// v4.4 — BALJIT-Centric Two-Factor Vigilance Gate + 3Mismatch Handler
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
  // Only run if content.js explicitly triggered the navigation
  const triggered = sessionStorage.getItem('fci_noc_triggered');
  if (triggered !== 'yes') {
    console.log('[FCI NOC Assistant] Add Reviewer: Not triggered by content.js (fci_noc_triggered !== "yes"). No action taken.');
    return;
  }
  // Consume the flag so a manual refresh does not re-fire
  sessionStorage.removeItem('fci_noc_triggered');

  // --- READ SESSION STORAGE HANDOFF ---
  const stage               = sessionStorage.getItem('fci_noc_stage');
  const officeType          = sessionStorage.getItem('fci_noc_office_type');
  const targetOffice        = sessionStorage.getItem('fci_noc_target_office');
  const targetEmployeeName  = sessionStorage.getItem('fci_noc_target_employee_name');
  const assistantEmp        = sessionStorage.getItem('fci_noc_assistant_emp');
  const assistantName       = sessionStorage.getItem('fci_noc_assistant_name');
  const assistantRemark     = sessionStorage.getItem('fci_noc_assistant_remark');

  if (!stage) {
    console.log('[FCI NOC Assistant] Add Reviewer: No stage set in sessionStorage. No action taken.');
    return;
  }

  console.log('[FCI NOC Assistant] Add Reviewer: Stage = ' + stage);
  console.log('[FCI NOC Assistant] Add Reviewer: Office Type = ' + officeType);
  console.log('[FCI NOC Assistant] Add Reviewer: Target Office = ' + targetOffice);
  console.log('[FCI NOC Assistant] Add Reviewer: Target Employee Name = ' + targetEmployeeName);
  console.log('[FCI NOC Assistant] Add Reviewer: Assistant Emp = ' + assistantEmp);
  console.log('[FCI NOC Assistant] Add Reviewer: Assistant Name = ' + assistantName);
  console.log('[FCI NOC Assistant] Add Reviewer: Remark = ' + assistantRemark);

  // --- STAGE FLAGS ---
  const isStage1       = (stage === '1');
  const isStage1B      = (stage === '1b');
  const isStage1C      = (stage === '1c');
  const isStage1D_RO   = (stage === '1d-ro');
  const isStage1D_DO   = (stage === '1d-do');
  const isStage2       = (stage === '2');
  const isStage3B      = (stage === '3b');
  const isStage3C      = (stage === '3c');
  const isStage3D      = (stage === '3d');
  const isStage3Mismatch = (stage === '3mismatch');

  // Name-based selection: 3B (DO Manager), 3D (Initiating Official), 3Mismatch (Assistant)
  const isNameBasedSelection = isStage3B || isStage3D || isStage3Mismatch;
  // Emp-based selection: 1, 1B, 1C, 1D, 2, 3C
  const isEmpBasedSelection    = isStage1 || isStage1B || isStage1C || isStage1D_RO || isStage1D_DO || isStage2 || isStage3C;

  // --- SELECT2 HELPERS ---
  // Because world: "MAIN", we have direct access to the page's jQuery and Select2

  function triggerSelect2(selector, value) {
    const $el = window.jQuery ? window.jQuery(selector) : null;
    if (!$el || !$el.length) {
      console.warn('[FCI NOC Assistant] Add Reviewer: jQuery/Select2 element not found: ' + selector);
      return false;
    }
    // For Select2 v4: set value then trigger change
    $el.val(value).trigger('change');
    // Also trigger select2:select for robustness
    $el.trigger({ type: 'select2:select', params: { data: { id: value } } });
    console.log('[FCI NOC Assistant] Add Reviewer: Select2 set ' + selector + ' = ' + value);
    return true;
  }

  function waitForDropdownAndSelect(selector, valueOrMatcher, isMatchByText, callback, maxAttempts) {
    maxAttempts = maxAttempts || 30;
    let attempts = 0;

    function trySelect() {
      attempts++;
      const $el = window.jQuery ? window.jQuery(selector) : null;
      if (!$el || !$el.length) {
        if (attempts < maxAttempts) {
          setTimeout(trySelect, 500);
          return;
        }
        console.warn('[FCI NOC Assistant] Add Reviewer: Dropdown ' + selector + ' not found after ' + maxAttempts + ' attempts.');
        callback(false);
        return;
      }

      // Check if options are loaded
      const options = $el.find('option');
      if (options.length <= 1) {
        // Only placeholder/default option — wait for AJAX load
        if (attempts < maxAttempts) {
          setTimeout(trySelect, 500);
          return;
        }
        console.warn('[FCI NOC Assistant] Add Reviewer: Dropdown ' + selector + ' options never loaded.');
        callback(false);
        return;
      }

      let foundValue = null;

      if (isMatchByText) {
        // Match by text content (for employee names)
        const targetNorm = valueOrMatcher.toString().trim().replace(/\s+/g, ' ').toUpperCase();
        options.each(function() {
          const optText = window.jQuery(this).text().trim().replace(/\s+/g, ' ').toUpperCase();
          const optVal  = window.jQuery(this).val();
          if (optText.includes(targetNorm) || targetNorm.includes(optText)) {
            foundValue = optVal;
            return false; // break
          }
        });
      } else {
        // Match by value (for empNo or office type code)
        options.each(function() {
          const optVal = window.jQuery(this).val();
          if (optVal === valueOrMatcher) {
            foundValue = optVal;
            return false; // break
          }
        });
      }

      if (foundValue !== null) {
        triggerSelect2(selector, foundValue);
        callback(true);
      } else if (attempts < maxAttempts) {
        setTimeout(trySelect, 500);
      } else {
        console.warn('[FCI NOC Assistant] Add Reviewer: Could not find match in ' + selector + ' for: ' + valueOrMatcher);
        callback(false);
      }
    }

    trySelect();
  }

  // --- FORM FILLING FUNCTIONS ---

  function fillOfficeType(callback) {
    // Office Type selector: #filter_office_type
    const success = triggerSelect2('#filter_office_type', officeType);
    if (success) {
      console.log('[FCI NOC Assistant] Add Reviewer: Office Type set to ' + officeType);
      // Give Select2 time to fire its change handler before next step
      setTimeout(function() { callback(true); }, 800);
    } else {
      // Fallback: try standard select
      const el = document.querySelector('#filter_office_type, select[name="officeType"], select[name="office_type"]');
      if (el) {
        el.value = officeType;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('[FCI NOC Assistant] Add Reviewer: Office Type set (fallback) to ' + officeType);
        setTimeout(function() { callback(true); }, 800);
      } else {
        console.warn('[FCI NOC Assistant] Add Reviewer: Office Type element not found.');
        callback(false);
      }
    }
  }

  function fillOffice(callback) {
    if (!targetOffice) {
      console.log('[FCI NOC Assistant] Add Reviewer: No target office required for this stage.');
      callback(true);
      return;
    }
    // Office selector: #filter_office — loaded via AJAX after office type change
    waitForDropdownAndSelect('#filter_office', targetOffice, true, function(success) {
      if (success) {
        console.log('[FCI NOC Assistant] Add Reviewer: Office set to ' + targetOffice);
      } else {
        console.warn('[FCI NOC Assistant] Add Reviewer: Could not set Office to ' + targetOffice);
      }
      callback(success);
    }, 30);
  }

  // FIXED: fillReason() now targets the contenteditable editor and hidden comments field
  function fillReason() {
    const editor   = document.getElementById('editor');
    const comments = document.getElementById('comments');

    if (!editor) {
      console.warn('[FCI NOC Assistant] Add Reviewer: Reason editor (#editor) not found.');
      return false;
    }
    if (!assistantRemark) {
      console.warn('[FCI NOC Assistant] Add Reviewer: No remark text to fill.');
      return false;
    }

    editor.innerText = assistantRemark;
    if (comments) comments.value = assistantRemark;
    editor.dispatchEvent(new Event('input',  { bubbles: true }));
    editor.dispatchEvent(new Event('blur',   { bubbles: true }));

    console.log('[FCI NOC Assistant] Add Reviewer: Reason/Remark filled.');
    return true;
  }

  function selectEmployeeByEmpNo(empNo, callback) {
    // Employee selector: #filter_employee — loaded via AJAX after office change
    waitForDropdownAndSelect('#filter_employee', empNo, false, function(success) {
      if (success) {
        console.log('[FCI NOC Assistant] Add Reviewer: Employee selected by empNo: ' + empNo);
      } else {
        console.warn('[FCI NOC Assistant] Add Reviewer: Could not select employee by empNo: ' + empNo);
      }
      callback(success);
    }, 30);
  }

  function selectEmployeeByName(name, callback) {
    // Employee selector: #filter_employee — match by text
    waitForDropdownAndSelect('#filter_employee', name, true, function(success) {
      if (success) {
        console.log('[FCI NOC Assistant] Add Reviewer: Employee selected by name: ' + name);
      } else {
        console.warn('[FCI NOC Assistant] Add Reviewer: Could not select employee by name: ' + name);
      }
      callback(success);
    }, 30);
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

      // Step 2: Fill Office (waits for AJAX load)
      fillOffice(function(officeOk) {
        if (!officeOk && targetOffice) {
          console.warn('[FCI NOC Assistant] Add Reviewer: Office fill failed. Continuing anyway...');
        }

        // Step 3: Fill Reason/Remark
        fillReason();

        // Step 4: Select Employee
        if (isEmpBasedSelection && assistantEmp) {
          selectEmployeeByEmpNo(assistantEmp, function(success) {
            console.log('[FCI NOC Assistant] Add Reviewer: Form filling complete. Please review and submit.');
          });
        } else if (isNameBasedSelection && targetEmployeeName) {
          selectEmployeeByName(targetEmployeeName, function(success) {
            console.log('[FCI NOC Assistant] Add Reviewer: Form filling complete. Please review and submit.');
          });
        } else {
          console.log('[FCI NOC Assistant] Add Reviewer: No employee selection required for this stage.');
          console.log('[FCI NOC Assistant] Add Reviewer: Form filling complete. Please review and submit.');
        }
      });
    });
  }

  // Wait for page jQuery and Select2 to be ready
  function waitForJQuery(callback) {
    let attempts = 0;
    const maxAttempts = 20;

    function check() {
      attempts++;
      if (window.jQuery && window.jQuery.fn.select2) {
        console.log('[FCI NOC Assistant] Add Reviewer: jQuery and Select2 detected.');
        callback();
      } else if (attempts < maxAttempts) {
        setTimeout(check, 500);
      } else {
        console.warn('[FCI NOC Assistant] Add Reviewer: jQuery/Select2 not detected after ' + maxAttempts + ' attempts. Proceeding with fallbacks...');
        callback();
      }
    }

    check();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    waitForJQuery(function() { setTimeout(execute, 500); });
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      waitForJQuery(function() { setTimeout(execute, 500); });
    });
  }

})();