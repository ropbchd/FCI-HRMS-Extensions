// FCI NOC Assistant — Add Reviewer Page Script
// Runs on workflow/add-reviewer/*
// Reads sessionStorage handoff from content.js and fills the Add Reviewer form.
// v5.0 — Floating Window Framework: fp.chosen support + bridge implementation
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

  // --- READ FP.CHOSEN AND PAYLOAD ---
  let chosen = sessionStorage.getItem('fp.chosen') || 'recommended';
  let payload = readPayload(chosen);

  if (!payload) {
    console.warn('[FCI NOC Assistant] Add Reviewer: No payload found for fp.chosen="' + chosen + '". Falling back to legacy sessionStorage keys.');
    payload = readLegacyPayload();
    if (!payload) {
      console.warn('[FCI NOC Assistant] Add Reviewer: No payload available. No action taken.');
      return;
    }
  }

  console.log('[FCI NOC Assistant] Add Reviewer: Chosen payload = ' + chosen);
  console.log('[FCI NOC Assistant] Add Reviewer: Payload name = ' + (payload.name || 'N/A'));
  console.log('[FCI NOC Assistant] Add Reviewer: Payload office = ' + (payload.office || 'N/A'));
  console.log('[FCI NOC Assistant] Add Reviewer: Payload remark = ' + (payload.remark || 'N/A'));

  // --- PAYLOAD READERS ---

  function readPayload(key) {
    const name      = sessionStorage.getItem('fp.route.' + key + '.name');
    const emp       = sessionStorage.getItem('fp.route.' + key + '.emp');
    const office    = sessionStorage.getItem('fp.route.' + key + '.office');
    const officeType = sessionStorage.getItem('fp.route.' + key + '.officeType');
    const remark    = sessionStorage.getItem('fp.remark.' + key);
    if (!name && !emp) return null;
    return { name: name, emp: emp, office: office, officeType: officeType, remark: remark };
  }

  function readLegacyPayload() {
    // Fallback: read old-style keys for backward compatibility
    const name      = sessionStorage.getItem('fci_noc_assistant_name')
                     || sessionStorage.getItem('fci_noc_target_employee_name');
    const emp       = sessionStorage.getItem('fci_noc_assistant_emp');
    const office    = sessionStorage.getItem('fci_noc_target_office');
    const officeType = sessionStorage.getItem('fci_noc_office_type');
    const remark    = sessionStorage.getItem('fci_noc_assistant_remark');
    if (!name && !emp) return null;
    return { name: name, emp: emp, office: office, officeType: officeType, remark: remark };
  }

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
    // --- FIX: NBSP-aware normalization (collapse all whitespace including NBSP) ---
    const targetNorm = matchValue.toString().trim().replace(/[\s\xa0]+/g, ' ').toUpperCase();

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

      // Phase 1: exact match (normalized)
      let matchedValue = null;
      for (let opt of options) {
        // --- FIX: NBSP-aware normalization for option text ---
        const optText = opt.textContent.trim().replace(/[\s\xa0]+/g, ' ').toUpperCase();
        if (optText === targetNorm) {
          matchedValue = opt.value;
          break;
        }
      }

      // Phase 2: substring match (fallback)
      if (matchedValue === null) {
        for (let opt of options) {
          const optText = opt.textContent.trim().replace(/[\s\xa0]+/g, ' ').toUpperCase();
          if (optText.includes(targetNorm)) {
            matchedValue = opt.value;
            break;
          }
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

    const ot = payload.officeType || sessionStorage.getItem('fci_noc_office_type') || '4';
    selectEl.value = ot;
    triggerSelect2('filter_office_type', ot);
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    console.log('[FCI NOC Assistant] Add Reviewer: Office Type set to ' + ot);
    setTimeout(function() { callback(true); }, 800);
  }

  function fillOffice(callback) {
    const office = payload.office;
    if (!office) {
      console.log('[FCI NOC Assistant] Add Reviewer: No target office — skipping office selection.');
      callback(true);
      return;
    }
    waitForDropdownAndSelectByText('filter_office', office, function(success) {
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
    const remark = payload.remark;
    if (!remark) {
      console.warn('[FCI NOC Assistant] Add Reviewer: No remark text to fill.');
      return false;
    }

    editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
    editor.innerText = remark;
    if (comments) comments.value = remark;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.dispatchEvent(new Event('blur',  { bubbles: true }));

    console.log('[FCI NOC Assistant] Add Reviewer: Reason/Remark filled.');
    return true;
  }

  function selectEmployee(callback) {
    const emp  = payload.emp;
    const name = payload.name;

    if (emp && name) {
      console.warn('[FCI NOC Assistant] Add Reviewer: ⚠️ Both emp and name are set. Using emp as primary. Check content.js routing.');
    }

    if (emp) {
      console.log('[FCI NOC Assistant] Add Reviewer: Selecting employee by empNo: ' + emp);
      waitForDropdownAndSelectByText('filter_employee', emp, function(success) {
        if (success) {
          console.log('[FCI NOC Assistant] Add Reviewer: Employee selected by empNo.');
          callback(true);
        } else if (name) {
          console.log('[FCI NOC Assistant] Add Reviewer: empNo not found. Trying name fallback: ' + name);
          waitForDropdownAndSelectByText('filter_employee', name, function(nameSuccess) {
            if (!nameSuccess) {
              console.warn('[FCI NOC Assistant] Add Reviewer: Employee not found by empNo or name. Please select manually.');
            }
            callback(nameSuccess);
          }, 20);
        } else {
          console.warn('[FCI NOC Assistant] Add Reviewer: Employee not found by empNo and no name fallback.');
          callback(false);
        }
      }, 30);
    } else if (name) {
      console.log('[FCI NOC Assistant] Add Reviewer: Selecting employee by name: ' + name);
      waitForDropdownAndSelectByText('filter_employee', name, function(success) {
        if (!success) {
          console.warn('[FCI NOC Assistant] Add Reviewer: Employee "' + name + '" not found. Please select manually.');
        }
        callback(success);
      }, 30);
    } else {
      console.log('[FCI NOC Assistant] Add Reviewer: No employee identifier — skipping.');
      callback(true);
    }
  }

  // --- MAIN FILL ROUTINE ---

  function fillForm(currentPayload, callback) {
    // Update global payload reference for this fill
    payload = currentPayload;

    console.log('[FCI NOC Assistant] Add Reviewer: Starting form fill sequence...');

    fillOfficeType(function(officeTypeOk) {
      if (!officeTypeOk) {
        console.warn('[FCI NOC Assistant] Add Reviewer: Office Type failed. Aborting.');
        if (callback) callback(false);
        return;
      }

      fillOffice(function(officeOk) {
        if (!officeOk && payload.office) {
          console.warn('[FCI NOC Assistant] Add Reviewer: Office fill failed. Continuing...');
        }

        fillReason();

        selectEmployee(function(empOk) {
          console.log('[FCI NOC Assistant] Add Reviewer: Form filling complete. Please review and click Add yourself.');
          if (callback) callback(true);
        });
      });
    });
  }

  // --- PAYLOAD SWITCHER (for in-place override on Add Reviewer page) ---

  function switchPayload(key) {
    const newPayload = readPayload(key);
    if (!newPayload) {
      console.warn('[FCI Workflow Assistant] Cannot switch to "' + key + '" — payload not precomputed or incomplete.');
      return;
    }
    chosen = key;
    sessionStorage.setItem('fp.chosen', key);
    console.log('[FCI Workflow Assistant] Switching to payload: ' + key);
    fillForm(newPayload, function(success) {
      if (success) {
        console.log('[FCI Workflow Assistant] Form re-filled with "' + key + '" payload.');
      }
    });
  }

  function chosenLabel(key) {
    if (key === 'recommended') return 'Recommended';
    if (key === 'reexamine') return 'Re-examine';
    if (key === 'returnprevious') return 'Return to Previous';
    return key;
  }

  // --- BRIDGE (Add Reviewer page variant) ---

  window.FCIWorkflow = {
    getWorkflowContext: function() {
      return {
        requestId: noeMatch[0],
        hasRecommendation: true,
        recommendedSummary: 'Currently filling as: ' + chosenLabel(chosen) + ' — routing to ' + (payload.name || 'N/A')
      };
    },
    executeReExamine: function() {
      switchPayload('reexamine');
    },
    executeReturnPrevious: function() {
      switchPayload('returnprevious');
    }
  };

  // --- NAVIGATE TO LAST PAGE OF ACTION HISTORY ---
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

  // --- WAIT FOR JQUERY & SELECT2 ---
  function waitForJQuery(callback) {
    let attempts = 0;
    const maxAttempts = 20;

    function check() {
      attempts++;
      console.log(
        '[FCI NOC Assistant] Attempt', attempts,
        '| typeof jQuery =', typeof window.jQuery,
        '| typeof $ =', typeof window.$,
        '| select2 =',
        window.jQuery && window.jQuery.fn
          ? typeof window.jQuery.fn.select2
          : 'jQuery not available'
      );

      if (window.jQuery && window.jQuery.fn.select2) {
        console.log('[FCI NOC Assistant] Add Reviewer: jQuery and Select2 detected.');
        callback();
      } else if (attempts < maxAttempts) {
        setTimeout(check, 500);
      } else {
        console.warn('[FCI NOC Assistant] Add Reviewer: jQuery/Select2 not detected after ' + maxAttempts + ' attempts.');
        callback();
      }
    }

    check();
  }

  // --- STARTUP ---
  function startup() {
    waitForJQuery(function() {
      setTimeout(function() {
        goToLastPage(function() {
          setTimeout(function() {
            fillForm(payload, function() {
              // Render floating panel after form is filled
              if (window.FloatingWindow && typeof window.FloatingWindow.render === 'function') {
                window.FloatingWindow.render();
              }
            });
          }, 1000);
        });
      }, 500);
    });
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    startup();
  } else {
    document.addEventListener('DOMContentLoaded', startup);
  }

})();