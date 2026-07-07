// FCI CALP Assistant - Approve Page Script v1.0
// Runs on: /workflow/review/*
//
// Stage 1: Last Dispatched = MAYURESH KUMAR, next = AMIT KUMAR SINGH (Pending Review, N/A)
//          → Add Reviewer → assistant per cadre/office routing
//          → Remark: "For examination and review remark plz."
//
// Stage 2: Last Reviewed = assistant (MADHU DHAKA / DIVYA KORNU / VISHALI MARWAHA),
//          next = AMIT KUMAR SINGH (Pending Review, N/A)
//          → Inject floating panel + open attachment in background tab
//          → Officer selects remark, clicks Approve/Reject manually

(function () {

  const LOG    = '[FCI CALP Assistant]';
  const PREFIX = 'CALP';

  // ─── KEY PEOPLE ─────────────────────────────────────────────────────────────
  const DISPATCHER_NAME = 'MAYURESH KUMAR';
  const MANAGER_NAME    = 'AMIT KUMAR SINGH';

  const ASSISTANT_NAMES = ['MADHU DHAKA', 'DIVYA KORNU', 'VISHALI MARWAHA'];

  const ASSISTANT_GENERAL = { name: 'MADHU DHAKA',     empNo: '313284' };
  const ASSISTANT_DIVYA   = { name: 'DIVYA KORNU',     empNo: '315172' };
  const ASSISTANT_VISHALI = { name: 'VISHALI MARWAHA', empNo: '308235' };

  const DIVYA_OFFICES = [
    'RO CHANDIGARH', 'DO PATIALA', 'DO LUDHIANA', 'DO JALANDHAR',
    'DO FARIDKOT', 'DO HOSHIARPUR', 'DO AMRITSAR'
  ];
  const VISHALI_OFFICES = [
    'DO KAPURTHALA', 'DO FEROZEPUR', 'DO CHANDIGARH', 'DO BHATINDA',
    'DO MOGA', 'DO GURDASPUR', 'DO SANGRUR'
  ];

  const STAGE1_REMARK = 'For examination and review remark plz.';
  const OFFICE_TYPE_RO = '4';

  // ─── FLOATING PANEL REMARKS ──────────────────────────────────────────────────
  const APPROVE_REMARKS = [
    {
      label: 'Approved — record updated based on supporting document.',
      full:  'Approved and record updated based on the supporting document provided.'
    },
    {
      label: 'Approved — record updated as per request.',
      full:  'Approved and record updated as per request.'
    },
    {
      label: 'Approved — record updated as per personal file documents.',
      full:  'Approved and record updated as per request based on the documents available in the personal file of the officer concerned.'
    }
  ];

  const REJECT_REMARKS = [
    {
      label: 'Apply through appropriate channel/module.',
      full:  'Kindly apply though appropriate channel/module as this information cannot be updated through the employee profile module.'
    },
    {
      label: 'Apply through appropriate channel — module cannot process this.',
      full:  'The officer may be asked to apply though appropriate channel as this request cannot be processed by this module.'
    },
    {
      label: 'Kindly provide supporting documents.',
      full:  'Kindly provide the supporting documents for substantiating the request made.'
    }
  ];

  // ─── SAFETY CHECK ───────────────────────────────────────────────────────────
  function getRequestId() {
    const allEls = document.querySelectorAll('p, span, div, td, h1, h2, h3, h4, h5');
    for (let el of allEls) {
      const text = el.textContent.trim();
      if (/^CALP\d+$/i.test(text)) return text.toUpperCase();
    }
    const match = (document.body.innerText || '').match(/\bCALP\d+\b/i);
    return match ? match[0].toUpperCase() : null;
  }

  const requestId = getRequestId();
  if (!requestId || !requestId.startsWith(PREFIX)) {
    console.log(LOG + ' Request ID not found or does not start with ' + PREFIX +
      ' ("' + (requestId || 'none') + '"). Extension will NOT activate.');
    return;
  }

  console.log(LOG + ' Request ID confirmed: ' + requestId + '. Activating...');
  setTimeout(clickViewActionHistory, 2000);

  // ─── STEP 1: Click View Action History ──────────────────────────────────────
  // On /workflow/approve/* the table may already be visible on page load.
  // Check first; only click the button if the table is not yet populated.
  function clickViewActionHistory() {
    const tbody = document.querySelector('#custom-action-history-tbl tbody');
    if (tbody && tbody.querySelectorAll('tr').length > 0) {
      console.log(LOG + ' Action history table already visible. Proceeding directly.');
      waitForTableAndCheck();
      return;
    }
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
      waitForTableAndCheck();
    } else {
      console.warn(LOG + ' "View Action History" not found. Retrying...');
      setTimeout(clickViewActionHistory, 2000);
    }
  }

  // ─── STEP 2: Wait for action history table ───────────────────────────────────
  function waitForTableAndCheck() {
    let attempts = 0;
    const interval = setInterval(function () {
      attempts++;
      const tbody = document.querySelector('#custom-action-history-tbl tbody');
      if (tbody && tbody.querySelectorAll('tr').length > 0) {
        clearInterval(interval);
        const table = document.querySelector('#custom-action-history-tbl');
        if (table) table.scrollIntoView({ behavior: 'smooth', block: 'start' });
        console.log(LOG + ' Table populated. Checking stage...');
        checkConditionsAndAct(tbody);
      } else if (attempts >= 20) {
        clearInterval(interval);
        console.warn(LOG + ' Table did not load in time.');
      }
    }, 500);
  }

  // ─── STEP 3: Parse table and detect stage ────────────────────────────────────
  function checkConditionsAndAct(tbody) {
    const allRows = tbody.querySelectorAll('tr');
    const entries = [];
    let currentEntry = null;

    for (let row of allRows) {
      const cells = row.querySelectorAll('td');
      const n = cells.length;
      if (n === 8 || n === 6) {
        currentEntry = {
          slNo:         cells[0].textContent.trim(),
          actionTaken:  cells[n - 5].textContent.trim(),
          employeeName: cells[n - 4].textContent.trim(),
          remark:       ''
        };
        entries.push(currentEntry);
      } else if (n === 1 && currentEntry) {
        const fullText = cells[0].textContent.trim();
        if (fullText.toUpperCase().startsWith('REMARKS:')) {
          currentEntry.remark = fullText.replace(/REMARKS:/i, '').trim();
        }
      }
    }

    // Read cadre and office from page
    // CALP page: 'Cadre' field may not exist — fall back to reading 'Office' field
    // and 'Office Type'. Full office name may be in a separate field.
    let cadreValue  = getFieldValue('cadre');
    let officeValue = getFieldValue('office');

    // CALP-specific fallbacks: try alternate field names
    if (!cadreValue) cadreValue = getFieldValue('Cadre');
    if (!officeValue || officeValue.toUpperCase() === 'RO' || officeValue.length < 4) {
      // 'RO' alone is the Office Type, not the Office name — try reading the full office
      const fullOffice = getFieldValue('Office') || getFieldValue('office name') || '';
      if (fullOffice.length > 2) officeValue = fullOffice;
    }

    // If cadre still empty, read from page text near "Cadre" label
    if (!cadreValue) {
      const bodyLines = (document.body.innerText || '').split('\n');
      for (let i = 0; i < bodyLines.length; i++) {
        if (bodyLines[i].trim().toLowerCase() === 'cadre') {
          cadreValue = (bodyLines[i+1] || '').trim();
          break;
        }
      }
    }
    // If office still just 'RO', read full office name from page text
    if (!officeValue || officeValue.toUpperCase() === 'RO') {
      const bodyLines = (document.body.innerText || '').split('\n');
      for (let i = 0; i < bodyLines.length; i++) {
        if (bodyLines[i].trim().toLowerCase() === 'office') {
          const val = (bodyLines[i+1] || '').trim();
          if (val.length > 2) { officeValue = val; break; }
        }
      }
    }

    console.log(LOG + ' Cadre: "' + cadreValue + '" | Office: "' + officeValue + '"');

    // Find last Dispatched entry
    let lastDispatchedIndex = -1;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].actionTaken === 'Dispatched') lastDispatchedIndex = i;
    }
    const lastDispatched  = lastDispatchedIndex !== -1 ? entries[lastDispatchedIndex] : null;
    const afterDispatched = lastDispatched ? entries[lastDispatchedIndex + 1] || null : null;

    // Find last Reviewed by assistant
    let lastAssistantReviewedIndex = -1;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].actionTaken === 'Reviewed') {
        const nameUpper = entries[i].employeeName.toUpperCase();
        if (ASSISTANT_NAMES.some(function (n) { return nameUpper.includes(n); })) {
          lastAssistantReviewedIndex = i;
        }
      }
    }
    const lastAssistantReviewed  = lastAssistantReviewedIndex !== -1 ? entries[lastAssistantReviewedIndex] : null;
    const afterAssistantReviewed = lastAssistantReviewed ? entries[lastAssistantReviewedIndex + 1] || null : null;

    // Stage 1: Dispatched by MAYURESH → AMIT pending
    const stage1 = lastDispatched
      && lastDispatched.employeeName.toUpperCase().includes(DISPATCHER_NAME)
      && afterDispatched
      && afterDispatched.employeeName.toUpperCase().includes(MANAGER_NAME)
      && (afterDispatched.actionTaken.trim() === 'Pending Review' || afterDispatched.actionTaken.trim() === 'New Reviewer Added')
      && afterDispatched.remark.trim() === 'N/A';

    // Stage 2: Assistant reviewed → AMIT pending
    const stage2 = lastAssistantReviewed
      && afterAssistantReviewed
      && afterAssistantReviewed.employeeName.toUpperCase().includes(MANAGER_NAME)
      && (afterAssistantReviewed.actionTaken.trim() === 'Pending Review' || afterAssistantReviewed.actionTaken.trim() === 'Pending Approval')
      && afterAssistantReviewed.remark.trim() === 'N/A';

    console.log(LOG + ' Stage 2 (floating panel + open attachment): ' + (stage2 ? 'MATCH' : 'no match'));
    console.log(LOG + ' Stage 1 (send to assistant):                ' + (stage1 ? 'MATCH' : 'no match'));

    // Priority: Stage 2 first, then Stage 1
    if (stage2) {
      console.log(LOG + ' Stage 2: "' + lastAssistantReviewed.employeeName + '" reviewed. Injecting panel + opening attachment...');
      highlightTriggerRow(tbody, lastAssistantReviewed.employeeName, 'Reviewed');
      setTimeout(openAttachment, 1000);
      setTimeout(injectPanel,    1500);

    } else if (stage1) {
      const assistant = decideAssistant(cadreValue, officeValue);
      if (assistant) {
        console.log(LOG + ' Stage 1: Routing to ' + assistant.name + ' (' + assistant.empNo + ')');
        highlightTriggerRow(tbody, DISPATCHER_NAME, 'Dispatched');
        sessionStorage.setItem('calp_triggered',        'yes');
        sessionStorage.setItem('calp_stage',            '1');
        sessionStorage.setItem('calp_office_type',      OFFICE_TYPE_RO);
        sessionStorage.setItem('calp_assistant_emp',    assistant.empNo);
        sessionStorage.setItem('calp_assistant_name',   assistant.name);
        sessionStorage.setItem('calp_assistant_remark', STAGE1_REMARK);
        setTimeout(clickAddReviewer, 2000);
      }

    } else {
      console.log(LOG + ' No matching stage. No action taken.');
    }
  }

  // ─── OPEN ATTACHMENT IN BACKGROUND ──────────────────────────────────────────
  function openAttachment() {
    const flagKey = 'calp_attachment_opened_' + requestId;
    if (sessionStorage.getItem(flagKey)) {
      console.log(LOG + ' Attachment already opened for ' + requestId + '. Skipping.');
      return;
    }

    // Look for "Attachment" link in the Supported Documents section
    const allLinks = document.querySelectorAll('a');
    for (let link of allLinks) {
      if (link.textContent.trim().toLowerCase() === 'attachment' && link.href) {
        console.log(LOG + ' Opening attachment in background tab: ' + link.href);
        chrome.runtime.sendMessage(
          { action: 'openTabInBackground', url: link.href },
          function (response) {
            if (response && response.tabId) {
              sessionStorage.setItem('calp_attachment_tab_id', response.tabId);
              console.log(LOG + ' Attachment tab ID stored: ' + response.tabId);
            }
          }
        );
        sessionStorage.setItem(flagKey, '1');
        return;
      }
    }
    console.warn(LOG + ' Attachment link not found.');
  }

  // ─── INJECT FLOATING PANEL ──────────────────────────────────────────────────
  function injectPanel() {
    if (document.getElementById('calp-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'calp-panel';
    panel.innerHTML = buildPanelHTML();
    applyPanelStyles(panel);
    document.body.appendChild(panel);
    makeDraggable(panel);

    panel.querySelectorAll('.calp-remark-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        panel.querySelectorAll('.calp-remark-btn').forEach(function (b) {
          b.classList.remove('calp-selected-approve', 'calp-selected-reject');
        });
        btn.classList.add(btn.dataset.type === 'approve' ? 'calp-selected-approve' : 'calp-selected-reject');
        panel.querySelector('#calp-preview').textContent = btn.dataset.full;
        panel.querySelector('#calp-preview').style.color = '#1a1a1a';
        const fillBtn = panel.querySelector('#calp-fill-btn');
        fillBtn.disabled = false;
        fillBtn.style.opacity = '1';
        fillBtn.style.background = btn.dataset.type === 'approve' ? '#1D9E75' : '#D85A30';
        fillBtn.dataset.remark = btn.dataset.full;
        fillBtn.dataset.type   = btn.dataset.type;
      });
    });

    panel.querySelector('#calp-fill-btn').addEventListener('click', function () {
      const remarkText = this.dataset.remark;
      if (!remarkText) return;
      fillRemark(remarkText);
    });

    console.log(LOG + ' Floating panel injected.');
  }

  function buildPanelHTML() {
    let approveHTML = '';
    APPROVE_REMARKS.forEach(function (r) {
      approveHTML += '<button class="calp-remark-btn calp-approve-btn" ' +
        'data-type="approve" data-full="' + escAttr(r.full) + '">' +
        escHTML(r.label) + '</button>';
    });
    let rejectHTML = '';
    REJECT_REMARKS.forEach(function (r) {
      rejectHTML += '<button class="calp-remark-btn calp-reject-btn" ' +
        'data-type="reject" data-full="' + escAttr(r.full) + '">' +
        escHTML(r.label) + '</button>';
    });
    return '' +
      '<div id="calp-header">' +
        '<span id="calp-title">&#9998; CALP Assistant &nbsp;<small style="font-weight:400;font-size:11px;color:#888;">' + escHTML(requestId) + '</small></span>' +
        '<span id="calp-drag-hint" title="Drag to reposition">&#8801;</span>' +
      '</div>' +
      '<div class="calp-section-label calp-approve-label">&#10003; Approve remarks</div>' +
      approveHTML +
      '<hr class="calp-divider">' +
      '<div class="calp-section-label calp-reject-label">&#10007; Reject remarks</div>' +
      rejectHTML +
      '<hr class="calp-divider">' +
      '<div id="calp-preview">No remark selected</div>' +
      '<button id="calp-fill-btn" disabled>Fill remark</button>';
  }

  function applyPanelStyles(panel) {
    if (!document.getElementById('calp-style')) {
      const style = document.createElement('style');
      style.id = 'calp-style';
      style.textContent = `
        #calp-panel {
          position: fixed; top: 80px; right: 20px; width: 300px;
          background: #fff; border: 1px solid #d0d0d0; border-radius: 10px;
          padding: 12px 14px; z-index: 99999; font-family: Arial, sans-serif;
          font-size: 13px; box-shadow: 0 4px 16px rgba(0,0,0,0.13); user-select: none;
        }
        #calp-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; cursor: move; }
        #calp-title { font-weight: 600; font-size: 13px; color: #333; }
        #calp-drag-hint { color: #aaa; font-size: 18px; cursor: move; line-height: 1; }
        .calp-section-label { font-size: 11px; font-weight: 600; letter-spacing: 0.04em; margin: 8px 0 5px; text-transform: uppercase; }
        .calp-approve-label { color: #0F6E56; }
        .calp-reject-label  { color: #993C1D; }
        .calp-remark-btn {
          display: block; width: 100%; text-align: left; background: #f7f7f7;
          border: 1px solid #e0e0e0; border-radius: 6px; padding: 6px 9px;
          margin-bottom: 5px; font-size: 12px; color: #333; cursor: pointer;
          line-height: 1.45; transition: border-color 0.15s, background 0.15s;
        }
        .calp-approve-btn:hover  { border-color: #0F6E56; background: #E1F5EE; color: #085041; }
        .calp-reject-btn:hover   { border-color: #993C1D; background: #FAECE7; color: #4A1B0C; }
        .calp-selected-approve   { border-color: #0F6E56 !important; background: #E1F5EE !important; color: #085041 !important; }
        .calp-selected-reject    { border-color: #993C1D !important; background: #FAECE7 !important; color: #4A1B0C !important; }
        .calp-divider { border: none; border-top: 1px solid #eee; margin: 10px 0; }
        #calp-preview { background: #f7f7f7; border-radius: 6px; padding: 7px 9px; font-size: 12px; color: #aaa; min-height: 40px; line-height: 1.5; margin-bottom: 9px; }
        #calp-fill-btn {
          width: 100%; padding: 8px 0; border: none; border-radius: 6px;
          font-size: 13px; font-weight: 600; cursor: pointer; background: #1D9E75;
          color: #fff; opacity: 0.4; transition: opacity 0.15s, background 0.15s;
        }
        #calp-fill-btn:not([disabled]):hover { filter: brightness(0.9); }
      `;
      document.head.appendChild(style);
    }
  }

  // ─── FILL REMARK ────────────────────────────────────────────────────────────
  // The Approver Remarks box is a rich text editor — fill the contenteditable div
  // and also sync to the hidden textarea if present.
  function fillRemark(remarkText) {
    // Try contenteditable div first (rich text editor)
    const editor = document.getElementById('editor');
    const textarea = document.getElementById('dop_member_comment');

    if (editor) {
      editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
      editor.innerText = remarkText;
      editor.dispatchEvent(new Event('input',  { bubbles: true }));
      editor.dispatchEvent(new Event('blur',   { bubbles: true }));
      if (textarea) textarea.value = remarkText;
      console.log(LOG + ' Approver Remarks filled via #editor.');
      return;
    }

    if (textarea) {
      textarea.value = remarkText;
      textarea.dispatchEvent(new Event('input',  { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
      console.log(LOG + ' Approver Remarks filled via #dop_member_comment.');
      return;
    }

    console.warn(LOG + ' Remarks editor not found. Retrying...');
    setTimeout(function () { fillRemark(remarkText); }, 1000);
  }

  // ─── CLICK ADD REVIEWER ──────────────────────────────────────────────────────
  function clickAddReviewer() {
    let btn = null;
    const allLinks = document.querySelectorAll('a, button');
    for (let el of allLinks) {
      if (el.textContent.trim() === 'Add Reviewer') { btn = el; break; }
    }
    if (btn) {
      sessionStorage.setItem('calp_triggered', 'yes');
      console.log(LOG + ' Clicking "Add Reviewer"...');
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    } else {
      console.warn(LOG + ' "Add Reviewer" button not found.');
    }
  }

  // ─── HIGHLIGHT TRIGGER ROW ───────────────────────────────────────────────────
  function highlightTriggerRow(tbody, targetName, targetAction) {
    const allRows = tbody.querySelectorAll('tr');
    let targetRow = null;
    for (let row of allRows) {
      const cells = row.querySelectorAll('td');
      const n = cells.length;
      if (n === 8 || n === 6) {
        const action = cells[n - 5].textContent.trim();
        const name   = cells[n - 4].textContent.trim().toUpperCase();
        if (action === targetAction && name.includes(targetName.toUpperCase())) {
          targetRow = row;
        }
      }
    }
    if (!targetRow) return;
    targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    let flashCount = 0;
    const flashInterval = setInterval(function () {
      flashCount++;
      targetRow.style.backgroundColor = (flashCount % 2 === 1) ? '#fff3cd' : '';
      if (flashCount >= 6) {
        clearInterval(flashInterval);
        targetRow.style.backgroundColor = '#fff3cd';
        setTimeout(function () { targetRow.style.backgroundColor = ''; }, 1800);
      }
    }, 300);
  }

  // ─── READ FIELD VALUE FROM PAGE ──────────────────────────────────────────────
  function getFieldValue(fieldName) {
    // Method 1: label[for] attribute
    const listItems = document.querySelectorAll('li');
    for (let li of listItems) {
      const label = li.querySelector('label');
      const span  = li.querySelector('span');
      if (!label || !span) continue;
      if (label.getAttribute('for') === fieldName) return span.textContent.trim();
      const labelText = label.textContent.trim().toLowerCase().replace(/\s+/g, ' ');
      const target    = fieldName.toLowerCase().replace(/_/g, ' ').trim();
      if (labelText === target || labelText.includes(target)) return span.textContent.trim();
    }
    // Method 2: line-by-line body text parser
    const lines = (document.body.innerText || '').split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().toLowerCase() === fieldName.toLowerCase()) {
        for (let j = i + 1; j < lines.length; j++) {
          const val = lines[j].trim();
          if (val && val.toLowerCase() !== fieldName.toLowerCase()) return val;
        }
      }
    }
    return '';
  }

  // ─── DECIDE ASSISTANT ────────────────────────────────────────────────────────
  function decideAssistant(cadreRaw, officeRaw) {
    const cadre  = cadreRaw.trim().replace(/\s+/g, ' ').toUpperCase();
    const office = officeRaw.trim().replace(/\s+/g, ' ').toUpperCase();
    console.log(LOG + ' decideAssistant: Cadre="' + cadre + '" Office="' + office + '"');

    if (cadre === 'GENERAL') {
      return ASSISTANT_GENERAL;
    } else if (cadre === 'DEPOT') {
      if (DIVYA_OFFICES.map(o => o.toUpperCase()).includes(office)) return ASSISTANT_DIVYA;
      if (VISHALI_OFFICES.map(o => o.toUpperCase()).includes(office)) return ASSISTANT_VISHALI;
      console.warn(LOG + ' Depot cadre but office "' + office + '" not in any known group.');
      return null;
    } else {
      console.warn(LOG + ' Unrecognised cadre: "' + cadre + '".');
      return null;
    }
  }

  // ─── UTILITY ────────────────────────────────────────────────────────────────
  function escHTML(str) { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function escAttr(str) { return str.replace(/"/g, '&quot;'); }

  // ─── DRAG ────────────────────────────────────────────────────────────────────
  function makeDraggable(el) {
    let startX, startY, startLeft, startTop;
    const header = el.querySelector('#calp-header');
    header.addEventListener('mousedown', function (e) {
      startX = e.clientX; startY = e.clientY;
      const rect = el.getBoundingClientRect();
      startLeft = rect.left; startTop = rect.top;
      function onMove(e) {
        el.style.right = 'auto';
        el.style.left  = (startLeft + e.clientX - startX) + 'px';
        el.style.top   = (startTop  + e.clientY - startY) + 'px';
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    });
  }

})();
