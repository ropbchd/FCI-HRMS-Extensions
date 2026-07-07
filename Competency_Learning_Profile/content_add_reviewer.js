// FCI CALP Assistant - Add Reviewer Page Script v1.0
// Reads routing decision from sessionStorage (set by content_approve.js)
// and fills the Add Reviewer form accordingly.

(function () {

  const LOG = '[FCI CALP Assistant]';
  const TARGET_RO_OFFICE = 'RO CHANDIGARH';

  // ─── SAFETY CHECK ───────────────────────────────────────────────────────────
  function getRequestId() {
    const bodyText = document.body.innerText || '';
    const match = bodyText.match(/\bCALP\d+\b/i);
    return match ? match[0].toUpperCase() : null;
  }

  const requestId = getRequestId();
  if (!requestId || !requestId.startsWith('CALP')) {
    console.log(LOG + ' Request ID not found or does not start with CALP ("' + (requestId || 'none') + '"). Extension will NOT activate.');
    return;
  }
  console.log(LOG + ' Request ID confirmed on Add Reviewer page: ' + requestId);

  // Check extension triggered this navigation
  const triggered = sessionStorage.getItem('calp_triggered');
  if (triggered !== 'yes') {
    console.log(LOG + ' Manual navigation — auto-fill disabled.');
    return;
  }
  sessionStorage.removeItem('calp_triggered');

  // Read routing data
  const officeTypeValue = sessionStorage.getItem('calp_office_type')      || '4';
  const empNumber       = sessionStorage.getItem('calp_assistant_emp')    || '';
  const assistantName   = sessionStorage.getItem('calp_assistant_name')   || '';
  const reasonText      = sessionStorage.getItem('calp_assistant_remark') || '';

  console.log(LOG + ' Routing to: ' + assistantName + ' (' + empNumber + ')');
  console.log(LOG + ' Reason: ' + reasonText);

  // Navigate to last page of action history table, then fill form
  setTimeout(goToLastPage,    2500);
  setTimeout(startAutomation, 4000);

  // ─── NAVIGATE TO LAST PAGE OF ACTION HISTORY ─────────────────────────────
  function goToLastPage() {
    let attempts = 0;
    const interval = setInterval(function () {
      attempts++;
      const paginateDivs = document.querySelectorAll('[id$="_paginate"], .dataTables_paginate, .pagination');
      let paginateDiv = null;
      for (let div of paginateDivs) {
        if (div.querySelectorAll('a, span').length > 0) { paginateDiv = div; break; }
      }
      if (!paginateDiv) { if (attempts >= 20) clearInterval(interval); return; }

      const pageLinks = paginateDiv.querySelectorAll('a, span');
      let highestNum = 0, highestLink = null;
      for (let link of pageLinks) {
        const text = link.textContent.trim();
        const num  = parseInt(text);
        if (!isNaN(num) && text === String(num) && num > highestNum) {
          highestNum = num; highestLink = link;
        }
      }
      if (highestLink && highestNum > 1) {
        clearInterval(interval);
        if (!highestLink.classList.contains('current') && !highestLink.classList.contains('active')) {
          console.log(LOG + ' Clicking last page (' + highestNum + ')...');
          highestLink.click();
        }
      } else if (highestNum <= 1 || attempts >= 20) {
        clearInterval(interval);
      }
    }, 500);
  }

  // ─── FILL FORM ────────────────────────────────────────────────────────────
  function startAutomation() {
    const officeTypeSelect = document.getElementById('filter_office_type');
    if (!officeTypeSelect) {
      console.warn(LOG + ' Office Type dropdown not found. Retrying...');
      setTimeout(startAutomation, 1500);
      return;
    }

    const officeTypeLabel = document.querySelector('label[for="filter_office_type"]');
    if (officeTypeLabel) officeTypeLabel.scrollIntoView({ behavior: 'smooth', block: 'center' });

    console.log(LOG + ' Step 1: Selecting Office Type = RO (value=' + officeTypeValue + ')...');
    officeTypeSelect.value = officeTypeValue;
    triggerSelect2(officeTypeSelect, officeTypeValue);
    officeTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));

    waitForDropdownAndSelect('filter_office', TARGET_RO_OFFICE, function () {
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
    console.log(LOG + ' All fields filled. *** Please review and click "Add" yourself. ***');
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────
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
        if (optText.includes(targetNormalised)) { matchedOption = opt; break; }
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
        console.warn(LOG + ' Could not find "' + targetValue + '" in #' + selectId + ' after 20s.');
      }
    }, 500);
  }

})();
