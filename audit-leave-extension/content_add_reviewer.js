// FCI Audit Leave Assistant - Add Reviewer Page Script v1.2
// Runs on: /workflow/add-reviewer/*
// Must run in world: "MAIN" for jQuery/Select2 access
//
// This script auto-fills the Add Reviewer form when the extension
// has navigated here from the Review Page via "Send Back" action.

(function () {

  const LOG = '[FCI AL Assistant - Add Reviewer]';

  // ─── SAFETY CHECK 1: IS THIS AN AUDIT LEAVE ADD REVIEWER PAGE? ──────────

  function isAuditLeaveAddReviewer() {
    const bodyText = document.body.innerText || '';
    return bodyText.toLowerCase().includes('audit leave') ||
           bodyText.toLowerCase().includes('leave audit');
  }

  if (!isAuditLeaveAddReviewer()) {
    console.log(LOG + ' Not an Audit Leave Add Reviewer page. Skipping.');
    return;
  }

  console.log(LOG + ' Audit Leave Add Reviewer page detected.');

  // ─── RETRY MECHANISM FOR SESSIONSTORAGE TRIGGER FLAG ────────────────────
  // The flag might not be immediately available due to race condition
  // between page navigation and storage commit.

  let triggered = sessionStorage.getItem('ala_triggered');
  let attempts = 0;
  const MAX_ATTEMPTS = 5;

  function checkTriggerAndStart() {
    triggered = sessionStorage.getItem('ala_triggered');

    if (triggered === 'yes') {
      // Found it! Proceed.
      console.log(LOG + ' Trigger flag confirmed (after ' + attempts + ' checks). Starting automation...');
      // Clear immediately so it doesn't fire again on refresh
      sessionStorage.removeItem('ala_triggered');
      startAutomation();
      return;
    }

    attempts++;
    if (attempts < MAX_ATTEMPTS) {
      // Retry after 200ms — storage might not be ready yet
      console.log(LOG + ' Trigger flag not found (attempt ' + attempts + '). Retrying in 200ms...');
      setTimeout(checkTriggerAndStart, 200);
    } else {
      // Give up after MAX_ATTEMPTS attempts
      console.log(LOG + ' Not triggered by extension (flag=' + triggered + '). Will NOT auto-fill.');
      // Show a helpful message in the console
      console.log(LOG + ' If you navigated here manually, please fill the form yourself.');
      console.log(LOG + ' If the extension should have triggered, check sessionStorage:');
      console.log(LOG + '   sessionStorage.getItem("ala_triggered") = ' + triggered);
      return;
    }
  }

  // ─── START AUTOMATION ─────────────────────────────────────────────────────

  function startAutomation() {
    // ─── READ ALL ROUTING DATA FROM SESSIONSTORAGE ──────────────────────────

    const stage = sessionStorage.getItem('ala_stage') || 'unknown';
    const officeTypeValue = sessionStorage.getItem('ala_office_type') || '4';
    const targetEmpNo = sessionStorage.getItem('ala_target_emp');
    const targetName = sessionStorage.getItem('ala_target_name');
    const remarkText = sessionStorage.getItem('ala_remark') || '';
    const targetOffice = sessionStorage.getItem('ala_target_office') || 'RO CHANDIGARH';

    // Employee data for display
    const empName = sessionStorage.getItem('ala_emp_name') || 'Unknown';
    const empNumber = sessionStorage.getItem('ala_emp_number') || '';
    const designation = sessionStorage.getItem('ala_designation') || '';
    const cadre = sessionStorage.getItem('ala_cadre') || '';
    const office = sessionStorage.getItem('ala_office') || '';

    console.log(LOG + ' Stage: ' + stage);
    console.log(LOG + ' Target: ' + targetName + ' (' + targetEmpNo + ')');
    console.log(LOG + ' Office Type: ' + officeTypeValue + ' | Office: ' + targetOffice);
    console.log(LOG + ' Remark: ' + remarkText.substring(0, 50) + '...');

    // ─── INJECT STATUS PANEL ───────────────────────────────────────────────

    function injectStatusPanel() {
      if (document.getElementById('ala-ar-panel')) return;

      const panel = document.createElement('div');
      panel.id = 'ala-ar-panel';
      panel.innerHTML = '' +
        '<div style="font-weight:600;font-size:13px;color:#333;margin-bottom:4px;">' +
          '📋 Audit Leave Assistant — Add Reviewer' +
        '</div>' +
        '<div style="font-size:11px;color:#666;margin-bottom:4px;">' +
          '<strong>' + escHTML(empName) + '</strong> (' + escHTML(empNumber) + ')<br>' +
          escHTML(designation) + ' | ' + escHTML(cadre) + ' | ' + escHTML(office) +
        '</div>' +
        '<div style="font-size:11px;color:#555;background:#f0f4f8;padding:4px 8px;border-radius:4px;margin-bottom:4px;">' +
          'Routing to: <strong>' + escHTML(targetName) + '</strong> (' + escHTML(targetEmpNo) + ')' +
        '</div>' +
        '<div style="font-size:10px;color:#999;">' +
          '⏳ Auto-filling form... Please wait.' +
        '</div>';

      panel.style.cssText = 'position:fixed;top:80px;right:20px;width:300px;background:#fff;border:1px solid #d0d0d0;border-radius:10px;padding:12px 14px;z-index:99999;font-family:Arial,sans-serif;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,0.15);';

      document.body.appendChild(panel);
      console.log(LOG + ' Status panel injected.');
    }

    // ─── GO TO LAST PAGE OF ACTION HISTORY ───────────────────────────────────

    function goToLastPage(callback) {
      setTimeout(function () {
        const paginateDivs = document.querySelectorAll('[id$="_paginate"], .dataTables_paginate');
        let clicked = false;

        for (let paginateDiv of paginateDivs) {
          const pageLinks = paginateDiv.querySelectorAll('a, span');
          let highestNum = 0, highestLink = null;

          for (let link of pageLinks) {
            const num = parseInt(link.textContent.trim());
            if (!isNaN(num) && num > highestNum) {
              highestNum = num;
              highestLink = link;
            }
          }

          if (highestLink && highestNum > 1) {
            console.log(LOG + ' Navigating to last page (' + highestNum + ') of action history...');
            highestLink.click();
            clicked = true;
            break;
          }
        }

        if (!clicked) {
          console.log(LOG + ' Only one page of action history. No navigation needed.');
        }

        // Wait for page to settle
        setTimeout(callback, 1500);
      }, 2500);
    }

    // ─── FILL CASCADING DROPDOWNS ────────────────────────────────────────────

    function startFillingForm() {
      console.log(LOG + ' Starting form fill sequence...');

      // Step 1: Select Office Type
      waitForDropdownAndSelect('filter_office_type', officeTypeValue, function () {
        console.log(LOG + ' Office Type selected: ' + officeTypeValue);

        // Step 2: Wait for Office dropdown to populate, then select Office
        waitForDropdownAndSelect('filter_office', targetOffice, function () {
          console.log(LOG + ' Office selected: ' + targetOffice);

          // Step 3: Wait for Employee dropdown to populate, then select Employee
          waitForDropdownAndSelectByName('filter_employee', targetEmpNo, function () {
            console.log(LOG + ' Employee selected: ' + targetName + ' (' + targetEmpNo + ')');

            // Step 4: Fill Reason field
            setTimeout(function () {
              fillReasonField(remarkText);
            }, 1000);
          });
        });
      });
    }

    // ─── WAIT FOR DROPDOWN AND SELECT BY VALUE ───────────────────────────────

    function waitForDropdownAndSelect(selectId, targetValue, callback) {
      let attempts = 0;
      const maxAttempts = 30; // 15 seconds max

      const interval = setInterval(function () {
        attempts++;
        const selectEl = document.getElementById(selectId);

        if (!selectEl) {
          if (attempts >= maxAttempts) {
            clearInterval(interval);
            console.warn(LOG + ' Dropdown #' + selectId + ' not found after timeout.');
          }
          return;
        }

        const options = selectEl.querySelectorAll('option');

        // For Office Type, match by value directly
        if (selectId === 'filter_office_type') {
          for (let opt of options) {
            if (opt.value === targetValue) {
              clearInterval(interval);
              selectEl.value = targetValue;
              triggerSelect2(selectEl, targetValue);
              selectEl.dispatchEvent(new Event('change', { bubbles: true }));
              callback(targetValue);
              return;
            }
          }
        }
        // For Office, match by text content
        else if (selectId === 'filter_office') {
          const targetUpper = targetValue.toUpperCase();
          for (let opt of options) {
            const optText = opt.textContent.trim().toUpperCase();
            if (optText === targetUpper || optText.includes(targetUpper)) {
              clearInterval(interval);
              selectEl.value = opt.value;
              triggerSelect2(selectEl, opt.value);
              selectEl.dispatchEvent(new Event('change', { bubbles: true }));
              callback(opt.value);
              return;
            }
          }
        }

        if (attempts >= maxAttempts) {
          clearInterval(interval);
          console.warn(LOG + ' Option not found in #' + selectId + ' for: ' + targetValue);
          console.warn(LOG + ' Available options: ' + Array.from(options).map(o => o.textContent.trim()).join(', '));
        }
      }, 500);
    }

    // ─── WAIT FOR EMPLOYEE DROPDOWN AND SELECT BY EMPLOYEE NUMBER ────────────

    function waitForDropdownAndSelectByName(selectId, targetEmpNo, callback) {
      let attempts = 0;
      const maxAttempts = 30;

      const interval = setInterval(function () {
        attempts++;
        const selectEl = document.getElementById(selectId);

        if (!selectEl) {
          if (attempts >= maxAttempts) {
            clearInterval(interval);
            console.warn(LOG + ' Employee dropdown not found after timeout.');
          }
          return;
        }

        const options = selectEl.querySelectorAll('option');
        let matchedOption = null;

        for (let opt of options) {
          const optText = opt.textContent.trim();
          // Match by employee number appearing in option text
          if (optText.includes(targetEmpNo)) {
            matchedOption = opt;
            break;
          }
        }

        if (matchedOption) {
          clearInterval(interval);
          selectEl.value = matchedOption.value;
          triggerSelect2(selectEl, matchedOption.value);
          selectEl.dispatchEvent(new Event('change', { bubbles: true }));
          callback(matchedOption.value);
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          console.warn(LOG + ' Employee with number ' + targetEmpNo + ' not found in dropdown.');
          console.warn(LOG + ' Available options: ' + Array.from(options).map(o => o.textContent.trim()).join(', '));
        }
      }, 500);
    }

    // ─── TRIGGER SELECT2 (REQUIRED FOR jQuery/Select2 DROPDOWNS) ───────────

    function triggerSelect2(selectEl, value) {
      const id = selectEl.id;
      const script = document.createElement('script');
      script.textContent = '(function() {' +
        'var el = document.getElementById("' + id + '");' +
        'if (el && typeof $ !== "undefined") {' +
          '$(el).trigger({ type: "select2:select", params: { data: { id: "' + value + '" } } });' +
        '}' +
      '})();';
      document.head.appendChild(script);
      script.remove();
      console.log(LOG + ' Select2 triggered for #' + id + ' with value: ' + value);
    }

    // ─── FILL REASON FIELD ───────────────────────────────────────────────────

    function fillReasonField(remarkText) {
      const editor = document.getElementById('editor');
      const textarea = document.getElementById('dop_member_comment');

      if (editor) {
        editor.innerText = remarkText;
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        editor.dispatchEvent(new Event('blur', { bubbles: true }));
      }

      if (textarea) {
        textarea.value = remarkText;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      }

      console.log(LOG + ' Reason field filled.');

      // Update status panel
      const statusPanel = document.getElementById('ala-ar-panel');
      if (statusPanel) {
        statusPanel.innerHTML = '' +
          '<div style="font-weight:600;font-size:13px;color:#333;margin-bottom:4px;">' +
            '✅ Audit Leave Assistant — Ready' +
          '</div>' +
          '<div style="font-size:11px;color:#666;margin-bottom:4px;">' +
            '<strong>' + escHTML(empName) + '</strong> (' + escHTML(empNumber) + ')<br>' +
            escHTML(designation) + ' | ' + escHTML(cadre) + ' | ' + escHTML(office) +
          '</div>' +
          '<div style="font-size:11px;color:#0F6E56;background:#E1F5EE;padding:4px 8px;border-radius:4px;margin-bottom:4px;">' +
            '✓ Form auto-filled for: <strong>' + escHTML(targetName) + '</strong>' +
          '</div>' +
          '<div style="font-size:10px;color:#D85A30;font-weight:600;">' +
            '⚠️ Please review and click "Add" → "OK" manually' +
          '</div>';
      }

      // Scroll to the Add button area
      const addBtn = document.querySelector('button[type="submit"], input[type="submit"], .btn-primary');
      if (addBtn) {
        addBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    // ─── UTILITY ──────────────────────────────────────────────────────────────

    function escHTML(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ─── MAIN SEQUENCE ─────────────────────────────────────────────────────────

    console.log(LOG + ' Script loaded on: ' + window.location.href);

    // Inject status panel immediately
    injectStatusPanel();

    // Start the fill sequence after page settles
    goToLastPage(startFillingForm);
  }

  // ─── START THE TRIGGER CHECK ─────────────────────────────────────────────

  // Begin checking for the trigger flag with retry mechanism
  checkTriggerAndStart();

})();