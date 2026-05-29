// FCI Employee Profile Update Assistant - Approve Page Script v1.2
// Runs on: /corehr/transaction/profile-request/approve/*
//
// Key facts about the page (from HTML analysis):
//   - Clicking .change-tab does window.location.href = url (full page reload, NOT ajax)
//   - All tabs navigate to the same base URL with ?tab=<tab_name> appended
//   - Update tab = ?tab=req_history
//   - So: if URL already has ?tab=req_history → do nothing (already on correct tab)
//         if URL has any other ?tab= → navigate once to ?tab=req_history
//   - window.open() always steals focus in Chrome; background script must open attachment

(function () {

  const LOG    = '[FCI EPU Assistant]';
  const PREFIX = 'RHR';

  // ─── REMARKS ────────────────────────────────────────────────────────────────

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
    const listItems = document.querySelectorAll('li');
    for (let li of listItems) {
      const label = li.querySelector('label');
      const span  = li.querySelector('span');
      if (!label || !span) continue;
      if (label.textContent.trim().toLowerCase().includes('request id')) {
        return span.textContent.trim().toUpperCase();
      }
    }
    const match = (document.body.innerText || '').match(/\bRHR\d+\b/i);
    return match ? match[0].toUpperCase() : null;
  }

  const requestId = getRequestId();

  if (!requestId || !requestId.startsWith(PREFIX)) {
    console.log(LOG + ' Request ID not found or does not start with ' + PREFIX +
      ' ("' + (requestId || 'none') + '"). Extension will NOT activate.');
    return;
  }

  console.log(LOG + ' Request ID confirmed: ' + requestId + '. Activating...');

  // ─── STEP 1: ENSURE WE ARE ON THE UPDATE TAB ────────────────────────────────
  // The tab system does a full page reload per tab (window.location.href).
  // Strategy: check current URL. If ?tab=req_history is present → already correct, do nothing.
  // Otherwise → navigate once to the correct URL.

  function ensureUpdateTab() {
    const currentUrl = window.location.href;
    const tabParam   = new URL(currentUrl).searchParams.get('tab');

    if (tabParam === 'req_history') {
      console.log(LOG + ' Already on Update tab (?tab=req_history). No navigation needed.');
      return; // correct tab, nothing to do
    }

    // Build the correct URL: same path, replace/add ?tab=req_history
    const baseUrl  = currentUrl.split('?')[0];
    const targetUrl = baseUrl + '?tab=req_history';
    console.log(LOG + ' Navigating to Update tab: ' + targetUrl);
    window.location.href = targetUrl;
    // Script will re-run after reload; on reload tabParam will be req_history → skip
  }

  // ─── STEP 2: OPEN ATTACHMENT IN BACKGROUND VIA BACKGROUND SCRIPT ────────────
  // window.open() steals focus in Chrome regardless of window.focus() calls.
  // Solution: ask background.js to create the tab with active:false (opens silently).
  // Guard: sessionStorage flag per requestId so it only opens once.

  function openAttachment() {
    const flagKey = 'epu_attachment_opened_' + requestId;
    if (sessionStorage.getItem(flagKey)) {
      console.log(LOG + ' Attachment already opened for ' + requestId + '. Skipping.');
      return;
    }

    const listItems = document.querySelectorAll('li');
    for (let li of listItems) {
      const label = li.querySelector('label');
      if (!label) continue;
      if (label.textContent.trim().toLowerCase().startsWith('attachment')) {
        const link = li.querySelector('a');
        if (link && link.href) {
          console.log(LOG + ' Requesting background script to open attachment: ' + link.href);

          // Ask background.js to open tab in background (active: false)
          chrome.runtime.sendMessage(
            { action: 'openTabInBackground', url: link.href },
            function (response) {
              if (response && response.tabId) {
                sessionStorage.setItem('epu_attachment_tab_id', response.tabId);
                console.log(LOG + ' Attachment tab ID stored: ' + response.tabId);
              }
            }
          );

          // Mark as opened so tab switches don't re-trigger this
          sessionStorage.setItem(flagKey, '1');
          return;
        }
      }
    }
    console.warn(LOG + ' Attachment "view" link not found.');
  }

  // ─── STEP 3: INJECT FLOATING PANEL ──────────────────────────────────────────

  function injectPanel() {
    if (document.getElementById('epu-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'epu-panel';
    panel.innerHTML = buildPanelHTML();
    applyPanelStyles(panel);
    document.body.appendChild(panel);

    makeDraggable(panel);

    panel.querySelectorAll('.epu-remark-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        panel.querySelectorAll('.epu-remark-btn').forEach(function (b) {
          b.classList.remove('epu-selected-approve', 'epu-selected-reject');
        });
        btn.classList.add(btn.dataset.type === 'approve' ? 'epu-selected-approve' : 'epu-selected-reject');

        panel.querySelector('#epu-preview').textContent = btn.dataset.full;
        panel.querySelector('#epu-preview').style.color = '#1a1a1a';

        const fillBtn = panel.querySelector('#epu-fill-btn');
        fillBtn.disabled = false;
        fillBtn.style.opacity = '1';
        fillBtn.style.background = btn.dataset.type === 'approve' ? '#1D9E75' : '#D85A30';
        fillBtn.dataset.remark = btn.dataset.full;
        fillBtn.dataset.type   = btn.dataset.type;
      });
    });

    panel.querySelector('#epu-fill-btn').addEventListener('click', function () {
      const remarkText = this.dataset.remark;
      if (!remarkText) return;
      fillRemark(remarkText);
    });

    console.log(LOG + ' Floating panel injected.');
  }

  function buildPanelHTML() {
    let approveHTML = '';
    APPROVE_REMARKS.forEach(function (r) {
      approveHTML += '<button class="epu-remark-btn epu-approve-btn" ' +
        'data-type="approve" data-full="' + escAttr(r.full) + '">' +
        escHTML(r.label) + '</button>';
    });

    let rejectHTML = '';
    REJECT_REMARKS.forEach(function (r) {
      rejectHTML += '<button class="epu-remark-btn epu-reject-btn" ' +
        'data-type="reject" data-full="' + escAttr(r.full) + '">' +
        escHTML(r.label) + '</button>';
    });

    return '' +
      '<div id="epu-header">' +
        '<span id="epu-title">&#9998; EPU Assistant &nbsp;<small style="font-weight:400;font-size:11px;color:#888;">' + escHTML(requestId) + '</small></span>' +
        '<span id="epu-drag-hint" title="Drag to reposition">&#8801;</span>' +
      '</div>' +
      '<div class="epu-section-label epu-approve-label">&#10003; Approve remarks</div>' +
      approveHTML +
      '<hr class="epu-divider">' +
      '<div class="epu-section-label epu-reject-label">&#10007; Reject remarks</div>' +
      rejectHTML +
      '<hr class="epu-divider">' +
      '<div id="epu-preview">No remark selected</div>' +
      '<button id="epu-fill-btn" disabled>Fill remark</button>';
  }

  function applyPanelStyles(panel) {
    if (!document.getElementById('epu-style')) {
      const style = document.createElement('style');
      style.id = 'epu-style';
      style.textContent = `
        #epu-panel {
          position: fixed;
          top: 80px;
          right: 20px;
          width: 300px;
          background: #fff;
          border: 1px solid #d0d0d0;
          border-radius: 10px;
          padding: 12px 14px;
          z-index: 99999;
          font-family: Arial, sans-serif;
          font-size: 13px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.13);
          user-select: none;
        }
        #epu-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
          cursor: move;
        }
        #epu-title { font-weight: 600; font-size: 13px; color: #333; }
        #epu-drag-hint { color: #aaa; font-size: 18px; cursor: move; line-height: 1; }
        .epu-section-label {
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.04em; margin: 8px 0 5px;
          text-transform: uppercase;
        }
        .epu-approve-label { color: #0F6E56; }
        .epu-reject-label  { color: #993C1D; }
        .epu-remark-btn {
          display: block; width: 100%; text-align: left;
          background: #f7f7f7; border: 1px solid #e0e0e0;
          border-radius: 6px; padding: 6px 9px; margin-bottom: 5px;
          font-size: 12px; color: #333; cursor: pointer;
          line-height: 1.45; transition: border-color 0.15s, background 0.15s;
        }
        .epu-approve-btn:hover  { border-color: #0F6E56; background: #E1F5EE; color: #085041; }
        .epu-reject-btn:hover   { border-color: #993C1D; background: #FAECE7; color: #4A1B0C; }
        .epu-selected-approve   { border-color: #0F6E56 !important; background: #E1F5EE !important; color: #085041 !important; }
        .epu-selected-reject    { border-color: #993C1D !important; background: #FAECE7 !important; color: #4A1B0C !important; }
        .epu-divider { border: none; border-top: 1px solid #eee; margin: 10px 0; }
        #epu-preview {
          background: #f7f7f7; border-radius: 6px;
          padding: 7px 9px; font-size: 12px; color: #aaa;
          min-height: 40px; line-height: 1.5; margin-bottom: 9px;
        }
        #epu-fill-btn {
          width: 100%; padding: 8px 0; border: none;
          border-radius: 6px; font-size: 13px; font-weight: 600;
          cursor: pointer; background: #1D9E75; color: #fff;
          opacity: 0.4; transition: opacity 0.15s, background 0.15s;
        }
        #epu-fill-btn:not([disabled]):hover { filter: brightness(0.9); }
      `;
      document.head.appendChild(style);
    }
  }

  // ─── FILL REMARK ────────────────────────────────────────────────────────────

  function fillRemark(remarkText) {
    const textarea = document.getElementById('dop_member_comment');
    if (!textarea) {
      window.scrollTo(0, document.body.scrollHeight);
      setTimeout(function () { fillRemark(remarkText); }, 1000);
      return;
    }
    textarea.value = remarkText;
    textarea.dispatchEvent(new Event('input',  { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    console.log(LOG + ' Approver Remarks filled.');
  }

  // ─── DRAG HELPER ────────────────────────────────────────────────────────────

  function makeDraggable(el) {
    let startX, startY, startLeft, startTop;
    const header = el.querySelector('#epu-header');
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

  // ─── UTILITY ────────────────────────────────────────────────────────────────

  function escHTML(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escAttr(str) {
    return str.replace(/"/g, '&quot;');
  }

  // ─── MAIN SEQUENCE ──────────────────────────────────────────────────────────
  // Step 1 runs immediately — if tab is wrong it navigates and page reloads.
  // On reload, tab is correct so step 1 is skipped and steps 2+3 run normally.

  ensureUpdateTab();             // immediate — navigates if needed, no-op if already correct

  setTimeout(function () { openAttachment(); }, 1500);   // after page settled
  setTimeout(function () { injectPanel();    }, 2000);   // after attachment opened

})();
