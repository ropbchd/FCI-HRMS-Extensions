// FCI Audit Leave Assistant - Review Page Script v1.2
// Runs on: /workflow/review/*
// Detects Audit Leave page by Leave Account Table, shows floating panel

(function () {

  const LOG = '[FCI AL Assistant]';

  // ─── SAFETY CHECK: IS THIS AN AUDIT LEAVE PAGE? ──────────────────────────

  function isAuditLeavePage() {
    const tables = document.querySelectorAll('table');
    for (let table of tables) {
      const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim().toLowerCase());
      const hasLeaveType = headers.some(h => h.includes('leave type'));
      const hasCarriedForward = headers.some(h => h.includes('carried forward'));
      const hasAccrued = headers.some(h => h.includes('accrued'));
      const hasLeaveAudit = headers.some(h => h.includes('leave audit') || h.includes('audit balance'));

      if (hasLeaveType && (hasCarriedForward || hasAccrued) && hasLeaveAudit) {
        return true;
      }
    }

    const pageTitle = document.title.toLowerCase();
    if (pageTitle.includes('audit leave') || pageTitle.includes('leave audit')) return true;

    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, .heading, .section-title');
    for (let h of headings) {
      const text = h.textContent.trim().toLowerCase();
      if (text.includes('leave account') || text.includes('audit leave')) return true;
    }

    return false;
  }

  if (!isAuditLeavePage()) {
    console.log(LOG + ' Not an Audit Leave page. Extension will NOT activate.');
    return;
  }

  console.log(LOG + ' Audit Leave page detected. Activating...');

  // ─── READ RETAINED DATA FROM LISTING PAGE ─────────────────────────────────

  const empName = sessionStorage.getItem('ala_emp_name') || 'Unknown';
  const empNumber = sessionStorage.getItem('ala_emp_number') || '';
  const designation = sessionStorage.getItem('ala_designation') || '';
  const cadre = sessionStorage.getItem('ala_cadre') || '';
  const office = sessionStorage.getItem('ala_office') || '';
  const requestId = sessionStorage.getItem('ala_request_id') || '';

  console.log(LOG + ' Employee: ' + empName + ' (' + empNumber + ')');
  console.log(LOG + ' Office: ' + office + ' | Cadre: ' + cadre);

  // ─── REMARKS TEMPLATES ────────────────────────────────────────────────────

  const SEND_BACK_REMARK_TEMPLATE = 'Kindly find the reference to remark no. _____ and accordingly as per the direction provided review along with desired information.';
  const FORWARD_REMARK_TEMPLATE = 'In accordance with the remark mentioned at Sl. No. _____, the requisite information is placed at Sl. No. _____. Herein, the request is forwarded for information and further necessary action please.';

  // ─── ASSISTANT ROUTING ────────────────────────────────────────────────────

  const GENERAL = { name: 'MADHU DHAKA', empNo: '313284' };
  const DIVYA = { name: 'DIVYA KORNU', empNo: '315172' };
  const VISHALI = { name: 'VISHALI MARWAHA', empNo: '308235' };

  const DIVYA_OFFICES = [
    'RO CHANDIGARH', 'DO PATIALA', 'DO LUDHIANA', 'DO JALANDHAR',
    'DO FARIDKOT', 'DO HOSHIARPUR', 'DO AMRITSAR'
  ];
  const VISHALI_OFFICES = [
    'DO KAPURTHALA', 'DO FEROZEPUR', 'DO CHANDIGARH', 'DO BHATINDA',
    'DO MOGA', 'DO GURDASPUR', 'DO SANGRUR'
  ];

  function decideAssistant(cadreRaw, officeRaw) {
    const cadreInput = (cadreRaw || '').trim().replace(/\s+/g, ' ').toUpperCase();
    const officeInput = (officeRaw || '').trim().replace(/\s+/g, ' ').toUpperCase();

    console.log(LOG + ' decideAssistant raw input: Cadre="' + cadreInput + '" Office="' + officeInput + '"');

    // Map CAT codes to General/Depot
    let cadre = '';
    if (cadreInput.includes('GENERAL') || cadreInput === 'CAT-II' || cadreInput === 'CAT-2') {
      cadre = 'GENERAL';
    } else if (cadreInput.includes('DEPOT') || cadreInput === 'CAT-III' || cadreInput === 'CAT-3') {
      cadre = 'DEPOT';
    } else if (cadreInput.includes('CAT')) {
      // Unknown CAT code - try to infer from office
      console.warn(LOG + ' Unknown CAT code: ' + cadreInput + '. Trying to infer from office...');
      cadre = 'DEPOT'; // Default to depot
    } else {
      cadre = cadreInput; // Pass through for further checking
    }

    console.log(LOG + ' decideAssistant mapped: Cadre="' + cadre + '" Office="' + officeInput + '"');

    if (cadre === 'GENERAL') {
      return GENERAL;
    } else if (cadre === 'DEPOT') {
      const divyaOffices = DIVYA_OFFICES.map(o => o.toUpperCase());
      const vishaliOffices = VISHALI_OFFICES.map(o => o.toUpperCase());

      if (divyaOffices.includes(officeInput)) {
        return DIVYA;
      } else if (vishaliOffices.includes(officeInput)) {
        return VISHALI;
      } else {
        // Try partial match
        for (let o of divyaOffices) {
          if (officeInput.includes(o) || o.includes(officeInput)) return DIVYA;
        }
        for (let o of vishaliOffices) {
          if (officeInput.includes(o) || o.includes(officeInput)) return VISHALI;
        }
        console.warn(LOG + ' Depot cadre but office not in known groups: ' + officeInput);
        return null;
      }
    } else {
      console.warn(LOG + ' Unrecognised cadre: ' + cadre);
      return null;
    }
  }

  function isAssistant(name) {
    const assistants = ['MADHU DHAKA', 'DIVYA KORNU', 'VISHALI MARWAHA'];
    const upperName = name.toUpperCase();
    return assistants.some(function(a) { return upperName.includes(a); });
  }

  // ─── STEP 1: CLICK VIEW ACTION HISTORY ────────────────────────────────────

  function clickViewActionHistory() {
    let btn = document.querySelector('a.view-action-history');
    if (!btn) {
      const allLinks = document.querySelectorAll('a, button');
      for (let el of allLinks) {
        if (el.textContent.trim() === 'View Action History') { btn = el; break; }
      }
    }
    if (btn) {
      console.log(LOG + ' Clicking "View Action History"...');
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      waitForTableAndProcess();
    } else {
      console.warn(LOG + ' "View Action History" button not found. Retrying in 2s...');
      setTimeout(clickViewActionHistory, 2000);
    }
  }

  // ─── STEP 2: WAIT FOR TABLE AND PROCESS ──────────────────────────────────

  function waitForTableAndProcess() {
    let attempts = 0;
    const interval = setInterval(function () {
      attempts++;
      const tbody = document.querySelector('#custom-action-history-tbl tbody');
      if (tbody && tbody.querySelectorAll('tr').length > 0) {
        clearInterval(interval);
        console.log(LOG + ' Action history table populated.');

        // ─── SCROLL TO THE ACTION HISTORY TABLE ─────────────────────────────
        // The table is dynamically loaded below the fold — scroll to it
        const tableContainer = document.querySelector('#action-history-details-div');
        if (tableContainer) {
          tableContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
          console.log(LOG + ' Scrolled to action history section.');
        } else {
          // Fallback: scroll to the table itself
          const table = document.querySelector('#custom-action-history-tbl');
          if (table) {
            table.scrollIntoView({ behavior: 'smooth', block: 'start' });
            console.log(LOG + ' Scrolled to action history table.');
          }
        }

        const parsedData = parseActionHistory(tbody);
        injectPanel(parsedData);
      } else if (attempts >= 20) {
        clearInterval(interval);
        console.warn(LOG + ' Action history table did not load in time.');
        injectPanel({ shobhaRemarkNo: null, assistantRemarkNo: null, lastActor: null });
      }
    }, 500);
  }

  // ─── STEP 3: PARSE ACTION HISTORY ──────────────────────────────────────

  function parseActionHistory(tbody) {
    const allRows = tbody.querySelectorAll('tr');
    const entries = [];
    let currentEntry = null;

    for (let row of allRows) {
      const cells = row.querySelectorAll('td');
      if (cells.length === 8) {
        currentEntry = {
          slNo: cells[0].textContent.trim(),
          date: cells[1].textContent.trim(),
          version: cells[2].textContent.trim(),
          action: cells[3].textContent.trim(),
          employee: cells[4].textContent.trim(),
          designation: cells[5].textContent.trim(),
          division: cells[6].textContent.trim(),
          authority: cells[7].textContent.trim(),
          remark: ''
        };
        entries.push(currentEntry);
      } else if (cells.length === 1 && cells[0].colSpan === 8) {
        const fullText = cells[0].textContent.trim();
        if (fullText.startsWith('REMARKS:') && currentEntry) {
          currentEntry.remark = fullText.replace('REMARKS:', '').trim();
        }
      }
    }

    console.log(LOG + ' Parsed ' + entries.length + ' action history entries.');

    // ─── FIND KEY ENTRIES ─────────────────────────────────────────────────

    let shobhaEntry = null;
    let assistantEntry = null;

    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];

      // Find last POOJA SINDHU entry with a substantive remark (not N/A)
      if (!shobhaEntry && e.employee.toUpperCase().includes('POOJA SINDHU') && e.remark && e.remark.trim() !== 'N/A' && e.remark.trim() !== '') {
        shobhaEntry = e;
      }

      // Find last assistant entry (MADHU DHAKA / DIVYA KORNU / VISHALI MARWAHA)
      if (!assistantEntry && isAssistant(e.employee) && e.remark && e.remark.trim() !== 'N/A' && e.remark.trim() !== '') {
        assistantEntry = e;
      }
    }

    const shobhaRemarkNo = shobhaEntry ? shobhaEntry.slNo : null;
    const assistantRemarkNo = assistantEntry ? assistantEntry.slNo : null;

    console.log(LOG + ' Shobha remark Sl.No: ' + shobhaRemarkNo);
    console.log(LOG + ' Assistant remark Sl.No: ' + assistantRemarkNo);

    return {
      shobhaRemarkNo: shobhaRemarkNo,
      assistantRemarkNo: assistantRemarkNo,
      entries: entries
    };
  }

  // ─── GET FIELD VALUE FROM PAGE (with multiple fallback strategies) ─────────

  function getFieldValueFromPage(fieldName) {
    // Strategy 1: Exact label match in li elements
    const listItems = document.querySelectorAll('li');
    for (let li of listItems) {
      const label = li.querySelector('label');
      const span = li.querySelector('span');
      if (!label || !span) continue;

      const labelText = label.textContent.trim().toLowerCase();
      const searchText = fieldName.toLowerCase();

      if (labelText === searchText || labelText.includes(searchText)) {
        return span.textContent.trim();
      }
    }

    // Strategy 2: Look in Competent Authority table
    const compAuthSelectors = [
      '.competent-authority',
      '[class*="competent"]',
      '[class*="authority"]',
      '.panel-body table'
    ];
    for (let sel of compAuthSelectors) {
      const compAuth = document.querySelector(sel);
      if (compAuth) {
        const rows = compAuth.querySelectorAll('tr');
        for (let row of rows) {
          const cells = row.querySelectorAll('td, th');
          for (let i = 0; i < cells.length - 1; i++) {
            if (cells[i].textContent.trim().toLowerCase().includes(fieldName.toLowerCase())) {
              return cells[i + 1].textContent.trim();
            }
          }
        }
      }
    }

    // Strategy 3: Search all labels on page
    const allLabels = document.querySelectorAll('label, td, th, .field-label, .col-sm-3, .col-md-3');
    for (let lbl of allLabels) {
      const text = lbl.textContent.trim().toLowerCase();
      if (text.includes(fieldName.toLowerCase()) && text.length < 50) {
        // Try to find a nearby value element
        const parent = lbl.closest('tr, li, .form-group, .row, .col-sm-12');
        if (parent) {
          const valueEl = parent.querySelector('span:not(label), .field-value, td:last-child, .col-sm-9, .col-md-9');
          if (valueEl && valueEl !== lbl) {
            const value = valueEl.textContent.trim();
            if (value && value !== '') return value;
          }
          // Try next sibling
          const nextSibling = lbl.nextElementSibling;
          if (nextSibling) {
            const value = nextSibling.textContent.trim();
            if (value && value !== '') return value;
          }
        }
      }
    }

    return '';
  }

  // ─── CLICK ADD REVIEWER BUTTON ──────────────────────────────────────────

  function clickAddReviewerButton() {
    let btn = null;
    const allLinks = document.querySelectorAll('a, button');
    for (let el of allLinks) {
      if (el.textContent.trim() === 'Add Reviewer') {
        btn = el;
        break;
      }
    }

    if (btn) {
      console.log(LOG + ' Clicking "Add Reviewer" button...');
      // Visual feedback
      btn.style.outline = '3px solid #D85A30';
      btn.style.outlineOffset = '2px';
      setTimeout(function () {
        btn.style.outline = '';
        btn.style.outlineOffset = '';
      }, 1000);

      // Use dispatchEvent to ensure proper click handling
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    } else {
      console.error(LOG + ' CRITICAL: "Add Reviewer" button not found!');
      alert('Add Reviewer button not found. Please click it manually.');
    }
  }

  // ─── FILL REMARK (FORWARD ACTION - stays on review page) ──────────────

  function fillRemarkOnReviewPage(remarkText) {
    const editor = document.getElementById('editor');
    const textarea = document.getElementById('dop_member_comment');

    if (editor) {
      editor.innerText = remarkText;
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      editor.dispatchEvent(new Event('blur', { bubbles: true }));
      editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    if (textarea) {
      textarea.value = remarkText;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    }

    console.log(LOG + ' Remark filled on Review Page (Forward action).');
  }

  // ─── PREPARE AND NAVIGATE TO ADD REVIEWER (SEND BACK ACTION) ─────────────

  function prepareAndNavigateToAddReviewer(remarkText) {
    // ─── PRIORITY 1: Use sessionStorage data (captured from listing page) ───
    // This data is the most reliable because it comes directly from the table
    let cadreValue = sessionStorage.getItem('ala_cadre') || sessionStorage.getItem('ala_category') || '';
    let officeValue = sessionStorage.getItem('ala_office') || '';

    console.log(LOG + ' [Priority 1] sessionStorage cadre: "' + cadreValue + '"');
    console.log(LOG + ' [Priority 1] sessionStorage office: "' + officeValue + '"');

    // ─── PRIORITY 2: Fallback to page scraping ONLY if sessionStorage is empty ───
    // This handles cases where user navigated directly to Review Page (rare)
    if (!cadreValue) {
      cadreValue = getFieldValueFromPage('Cadre') || getFieldValueFromPage('Category') || getFieldValueFromPage('CATEGORY');
      console.log(LOG + ' [Priority 2] Fallback page cadre: "' + cadreValue + '"');
    }
    if (!officeValue) {
      officeValue = getFieldValueFromPage('Office') || getFieldValueFromPage('OFFICE');
      console.log(LOG + ' [Priority 2] Fallback page office: "' + officeValue + '"');
    }

    console.log(LOG + ' Final Cadre: "' + cadreValue + '" | Office: "' + officeValue + '"');

    // ─── VALIDATE ─────────────────────────────────────────────────────────────
    // These values from the Competent Authority table are NOT Cadre/Office
    const invalidLabels = ['section', 'division', 'mss-hrms', 'internal audit', 'manager', 'rtl', 'hindi', 'accounts', 'personnel', 'administration'];

    // If we got a suspicious value, clear it and try sessionStorage again
    if (cadreValue && invalidLabels.includes(cadreValue.toLowerCase())) {
      console.warn(LOG + ' Cadre value "' + cadreValue + '" looks like a label, not a value. Using sessionStorage.');
      cadreValue = sessionStorage.getItem('ala_cadre') || sessionStorage.getItem('ala_category') || '';
    }
    if (officeValue && invalidLabels.includes(officeValue.toLowerCase())) {
      console.warn(LOG + ' Office value "' + officeValue + '" looks like a label, not a value. Using sessionStorage.');
      officeValue = sessionStorage.getItem('ala_office') || '';
    }

    console.log(LOG + ' Validated Cadre: "' + cadreValue + '" | Office: "' + officeValue + '"');

    if (!cadreValue || !officeValue) {
      console.error(LOG + ' CRITICAL: Cadre or Office is empty!');
      alert('Could not determine assistant for this request.\n\n' +
            'Cadre: "' + cadreValue + '"\n' +
            'Office: "' + officeValue + '"\n\n' +
            'Please navigate from the listing page so employee data is captured.');
      return;
    }

    const assistant = decideAssistant(cadreValue, officeValue);
    if (!assistant) {
      console.warn(LOG + ' Could not determine assistant from Cadre="' + cadreValue + '" Office="' + officeValue + '"');
      alert('Could not determine assistant for this request.\n\n' +
            'Cadre: ' + cadreValue + '\n' +
            'Office: ' + officeValue + '\n\n' +
            'Please check Cadre and Office fields.');
      return;
    }

    console.log(LOG + ' Send Back: Routing to ' + assistant.name + ' (' + assistant.empNo + ')');

    // ─── STORE ALL ROUTING DATA ─────────────────────────────────────────────
    sessionStorage.setItem('ala_triggered', 'yes');
    sessionStorage.setItem('ala_stage', 'send_back');
    sessionStorage.setItem('ala_office_type', '4');
    sessionStorage.setItem('ala_target_emp', assistant.empNo);
    sessionStorage.setItem('ala_target_name', assistant.name);
    sessionStorage.setItem('ala_remark', remarkText);
    sessionStorage.setItem('ala_target_office', 'RO CHANDIGARH');
    sessionStorage.setItem('ala_emp_name', empName);
    sessionStorage.setItem('ala_emp_number', empNumber);
    sessionStorage.setItem('ala_designation', designation);
    sessionStorage.setItem('ala_cadre', cadreValue);
    sessionStorage.setItem('ala_office', officeValue);

    const verify = sessionStorage.getItem('ala_triggered');
    console.log(LOG + ' sessionStorage ala_triggered = ' + verify);

    if (verify !== 'yes') {
      console.error(LOG + ' CRITICAL: sessionStorage write failed!');
      return;
    }

    setTimeout(function () {
      clickAddReviewerButton();
    }, 500);
  }

  // ─── HELPER: UPDATE PANEL FOR SELECTED ACTION ────────────────────────────

  function updatePanelForAction(panel, remark, action, btnBg, btnBorder, btnBgHover, btnText) {
    // Update preview
    panel.querySelector('#ala-preview').textContent = remark;
    panel.querySelector('#ala-preview').style.color = '#1a1a1a';

    // Update fill button
    const fillBtn = panel.querySelector('#ala-fill-btn');
    fillBtn.dataset.remark = remark;
    fillBtn.dataset.action = action;
    fillBtn.disabled = false;
    fillBtn.style.opacity = '1';
    fillBtn.style.background = btnBg;
    fillBtn.textContent = btnText;

    // Reset both action buttons
    const sendBtn = panel.querySelector('#ala-send-back-btn');
    const fwdBtn = panel.querySelector('#ala-forward-btn');
    sendBtn.style.borderColor = '#e0e0e0';
    sendBtn.style.background = '#f7f7f7';
    fwdBtn.style.borderColor = '#e0e0e0';
    fwdBtn.style.background = '#f7f7f7';

    // Highlight the selected action button
    const selectedBtn = action === 'send_back' ? sendBtn : fwdBtn;
    selectedBtn.style.borderColor = btnBorder;
    selectedBtn.style.background = btnBgHover;
  }

  // ─── INJECT FLOATING PANEL ───────────────────────────────────────────────

  function injectPanel(parsedData) {
    if (document.getElementById('ala-panel')) return;

    const shobhaRemarkNo = parsedData.shobhaRemarkNo || '___';
    const assistantRemarkNo = parsedData.assistantRemarkNo || '___';

    const panel = document.createElement('div');
    panel.id = 'ala-panel';
    panel.innerHTML = buildPanelHTML(empName, empNumber, designation, cadre, office, shobhaRemarkNo, assistantRemarkNo);
    applyPanelStyles(panel);
    document.body.appendChild(panel);

    makeDraggable(panel);

    // ── Send Back button ──
    const sendBackBtn = panel.querySelector('#ala-send-back-btn');
    if (sendBackBtn) {
      sendBackBtn.addEventListener('click', function () {
        const remark = SEND_BACK_REMARK_TEMPLATE.replace('_____', shobhaRemarkNo);
        updatePanelForAction(panel, remark, 'send_back', '#D85A30', '#993C1D', '#FAECE7', '↩ Send Back (Navigate to Add Reviewer)');
      });
    }

    // ── Forward button ──
    const forwardBtn = panel.querySelector('#ala-forward-btn');
    if (forwardBtn) {
      forwardBtn.addEventListener('click', function () {
        const remark = FORWARD_REMARK_TEMPLATE
          .replace('_____', shobhaRemarkNo)
          .replace('_____', assistantRemarkNo);
        updatePanelForAction(panel, remark, 'forward', '#1D9E75', '#0F6E56', '#E1F5EE', '✓ Fill Remark on Review Page');
      });
    }

    // ── Fill remark button ──
    panel.querySelector('#ala-fill-btn').addEventListener('click', function () {
      const remarkText = this.dataset.remark;
      const action = this.dataset.action;
      if (!remarkText) return;

      if (action === 'send_back') {
        prepareAndNavigateToAddReviewer(remarkText);
      } else if (action === 'forward') {
        fillRemarkOnReviewPage(remarkText);
      }
    });

    openAttachment();

    // ─── DRAW ATTENTION TO THE PANEL ────────────────────────────────────────
    // Subtle animation to signal the panel is ready
    panel.style.transition = 'border-color 0.3s, box-shadow 0.3s';
    panel.style.borderColor = '#1D9E75';
    panel.style.boxShadow = '0 8px 32px rgba(29, 158, 117, 0.25)';
    setTimeout(function () {
      panel.style.borderColor = '#d0d0d0';
      panel.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
    }, 800);

    console.log(LOG + ' Floating panel injected.');
  }

  // ─── BUILD PANEL HTML ─────────────────────────────────────────────────────

  function buildPanelHTML(name, number, desig, cadre, office, shobhaNo, assistantNo) {
    const shobhaDisplay = shobhaNo !== '___' ? 'Sl. No. ' + shobhaNo : 'Not found';
    const assistantDisplay = assistantNo !== '___' ? 'Sl. No. ' + assistantNo : 'Not found';

    return '' +
      '<div id="ala-header">' +
        '<span id="ala-title">📋 Audit Leave Assistant</span>' +
        '<span id="ala-drag-hint" title="Drag to reposition">≡</span>' +
      '</div>' +
      '<div id="ala-employee-info">' +
        '<strong>' + escHTML(name) + '</strong> ' +
        '(' + escHTML(number) + ')' +
        '<br><span style="font-size:11px;color:#666;">' +
        escHTML(desig) + ' | ' + escHTML(cadre) + ' | ' + escHTML(office) +
        '</span>' +
      '</div>' +
      '<div style="font-size:11px;color:#555;margin:4px 0 8px;background:#f0f4f8;padding:4px 8px;border-radius:4px;">' +
        '🔍 Shobha remark: ' + shobhaDisplay +
        ' &nbsp;|&nbsp; Assistant remark: ' + assistantDisplay +
      '</div>' +
      '<hr class="ala-divider">' +
      '<div class="ala-action-section">' +
        '<div style="font-size:11px;font-weight:600;color:#666;margin-bottom:4px;">Choose an action:</div>' +
        '<button id="ala-send-back-btn" class="ala-action-btn ala-send-btn">' +
          '↩ Send Back to Assistant (Add Reviewer →)' +
        '</button>' +
        '<button id="ala-forward-btn" class="ala-action-btn ala-forward-btn">' +
          '✓ Forward for Approval (Fill on this page)' +
        '</button>' +
      '</div>' +
      '<hr class="ala-divider">' +
      '<div id="ala-preview" style="background:#f7f7f7;border-radius:6px;padding:6px 8px;font-size:12px;color:#aaa;min-height:30px;line-height:1.5;margin-bottom:6px;">' +
        'Select an action above to preview the remark' +
      '</div>' +
      '<button id="ala-fill-btn" disabled style="width:100%;padding:7px 0;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;background:#ccc;color:#fff;opacity:0.4;transition:opacity 0.15s;">' +
        'Select an action first' +
      '</button>' +
      '<div style="font-size:10px;color:#999;margin-top:6px;text-align:center;">' +
        '⚠️ Officer must click Review/Add/OK manually after filling' +
      '</div>';
  }

  // ─── APPLY PANEL STYLES ──────────────────────────────────────────────────

  function applyPanelStyles(panel) {
    if (!document.getElementById('ala-style')) {
      const style = document.createElement('style');
      style.id = 'ala-style';
      style.textContent = `
        #ala-panel {
          position: fixed;
          top: 80px;
          right: 20px;
          width: 340px;
          max-height: calc(100vh - 100px);
          overflow-y: auto;
          background: #fff;
          border: 1px solid #d0d0d0;
          border-radius: 10px;
          padding: 12px 14px;
          z-index: 99999;
          font-family: Arial, sans-serif;
          font-size: 13px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.15);
          user-select: none;
        }
        #ala-panel::-webkit-scrollbar { width: 4px; }
        #ala-panel::-webkit-scrollbar-thumb { background: #ccc; border-radius: 4px; }

        #ala-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6px;
          cursor: move;
        }
        #ala-title { font-weight: 600; font-size: 13px; color: #333; }
        #ala-drag-hint { color: #aaa; font-size: 18px; cursor: move; line-height: 1; }

        #ala-employee-info {
          background: #f7f9fc;
          border-radius: 6px;
          padding: 6px 8px;
          font-size: 12px;
          margin-bottom: 4px;
          border-left: 3px solid #1D9E75;
        }

        .ala-action-section {
          margin: 4px 0;
        }

        .ala-action-btn {
          display: block;
          width: 100%;
          text-align: left;
          padding: 8px 12px;
          border: 2px solid #e0e0e0;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          margin-bottom: 4px;
          transition: all 0.15s;
          background: #f7f7f7;
          color: #333;
        }

        .ala-send-btn {
          border-color: #D85A30;
        }
        .ala-send-btn:hover {
          background: #FAECE7;
          border-color: #993C1D;
        }

        .ala-forward-btn {
          border-color: #1D9E75;
        }
        .ala-forward-btn:hover {
          background: #E1F5EE;
          border-color: #0F6E56;
        }

        .ala-divider { border: none; border-top: 1px solid #eee; margin: 6px 0; }

        #ala-preview {
          background: #f7f7f7;
          border-radius: 6px;
          padding: 6px 8px;
          font-size: 12px;
          color: #aaa;
          min-height: 30px;
          line-height: 1.5;
          margin-bottom: 6px;
        }

        #ala-fill-btn {
          width: 100%;
          padding: 7px 0;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          background: #ccc;
          color: #fff;
          opacity: 0.4;
          transition: opacity 0.15s, background 0.15s;
        }
        #ala-fill-btn:not([disabled]):hover { filter: brightness(0.9); }
      `;
      document.head.appendChild(style);
    }
  }

  // ─── OPEN ATTACHMENT ──────────────────────────────────────────────────────

  function openAttachment() {
    const flagKey = 'ala_attachment_opened_' + (requestId || Date.now());
    if (sessionStorage.getItem(flagKey)) {
      console.log(LOG + ' Attachment already opened. Skipping.');
      return;
    }

    const listItems = document.querySelectorAll('li');
    for (let li of listItems) {
      const label = li.querySelector('label');
      if (!label) continue;
      if (label.textContent.trim().toLowerCase().startsWith('attachment')) {
        const link = li.querySelector('a');
        if (link && link.href) {
          console.log(LOG + ' Opening attachment in background tab...');
          chrome.runtime.sendMessage(
            { action: 'openTabInBackground', url: link.href },
            function (response) {
              if (response && response.tabId) {
                sessionStorage.setItem('ala_attachment_tab_id', response.tabId);
                console.log(LOG + ' Attachment tab ID stored: ' + response.tabId);
              }
            }
          );
          sessionStorage.setItem(flagKey, '1');
          return;
        }
      }
    }
  }

  // ─── DRAG HELPER ──────────────────────────────────────────────────────────

  function makeDraggable(el) {
    let startX, startY, startLeft, startTop;
    const header = el.querySelector('#ala-header');

    const savedPos = localStorage.getItem('ala_panel_pos');
    if (savedPos) {
      try {
        const pos = JSON.parse(savedPos);
        el.style.left = pos.left + 'px';
        el.style.top = pos.top + 'px';
        el.style.right = 'auto';
      } catch (e) {}
    }

    header.addEventListener('mousedown', function (e) {
      startX = e.clientX;
      startY = e.clientY;
      const rect = el.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;

      function onMove(e) {
        const newLeft = startLeft + e.clientX - startX;
        const newTop = startTop + e.clientY - startY;
        el.style.right = 'auto';
        el.style.left = newLeft + 'px';
        el.style.top = newTop + 'px';
      }

      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        const rect = el.getBoundingClientRect();
        localStorage.setItem('ala_panel_pos', JSON.stringify({ left: rect.left, top: rect.top }));
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  // ─── UTILITY ──────────────────────────────────────────────────────────────

  function escHTML(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escAttr(str) {
    return str.replace(/"/g, '&quot;');
  }

  // ─── MAIN ──────────────────────────────────────────────────────────────────

  setTimeout(clickViewActionHistory, 2000);

})();