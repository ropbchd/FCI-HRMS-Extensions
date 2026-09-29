// FCI HPL / Medical Leave Assistant — Add Reviewer Page Script v1.0
// Runs in the page's own JS world (manifest "world": "MAIN"), so window.jQuery is called directly
// (no inline <script> injection -> no CSP violation).
//
// Fills Office Type -> Office -> Employee -> Reason from the fp.* payload written by content.js.
// It never presses "Add": the manager reviews and clicks Add himself.
(function () {
  'use strict';

  const LOG = '[FCI Leave Assistant]';
  const TRIGGER_KEY = 'fci_lv_triggered';
  const REQUEST_KEY = 'fci_lv_request_id';
  const TRIGGER_MAX_AGE_MS = 60000;

  // Only act when the leave review page triggered this navigation (fresh flag)
  const stamp = parseInt(sessionStorage.getItem(TRIGGER_KEY) || '0', 10);
  if (!stamp || (Date.now() - stamp) > TRIGGER_MAX_AGE_MS) {
    console.log(LOG + ' Not triggered by the leave extension — auto-fill disabled.');
    return;
  }
  sessionStorage.removeItem(TRIGGER_KEY);

  // ---- payload readers (no fp.chosen check, so the bridge can switch payloads in place)
  function readPayload(key) {
    if (!key) return null;
    const name = sessionStorage.getItem('fp.route.' + key + '.name');
    if (!name) return null;
    return {
      name: name,
      emp: sessionStorage.getItem('fp.route.' + key + '.emp'),
      office: sessionStorage.getItem('fp.route.' + key + '.office'),
      officeType: sessionStorage.getItem('fp.route.' + key + '.officeType'),
      remark: sessionStorage.getItem('fp.remark.' + key) || ''
    };
  }

  let chosenKey = sessionStorage.getItem('fp.chosen');
  let payload = readPayload(chosenKey);
  if (!payload) {
    console.warn(LOG + ' No valid payload found. Aborting.');
    return;
  }
  console.log(LOG + ' Using payload "' + chosenKey + '": ' + payload.name +
    (payload.emp ? ' (' + payload.emp + ')' : '') + ', ' + payload.office + ', type ' + payload.officeType);

  // ---- helpers
  function normalizeForMatching(text) {
    if (!text) return '';
    return text.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Direct jQuery call in page context (replaces the old inline-script injection)
  function triggerSelect2(selectEl, value) {
    const jq = window.jQuery || window.$;
    if (!jq || !selectEl) return;
    try {
      jq(selectEl).trigger({ type: 'select2:select', params: { data: { id: value } } });
    } catch (e) {
      console.warn(LOG + ' select2 trigger failed: ' + e.message);
    }
  }

  function whenJQueryReady(cb) {
    let tries = 0;
    const t = setInterval(function () {
      tries++;
      const jq = window.jQuery || window.$;
      if (jq && jq.fn && jq.fn.select2) {
        clearInterval(t);
        cb();
      } else if (tries >= 40) {
        clearInterval(t);
        console.warn(LOG + ' jQuery/Select2 not ready after 10s — continuing anyway.');
        cb();
      }
    }, 250);
  }

  function goToLastPage() {
    let attempts = 0;
    const interval = setInterval(function () {
      attempts++;
      const divs = document.querySelectorAll('[id$="_paginate"], .dataTables_paginate, .pagination');
      let paginateDiv = null;
      for (let i = 0; i < divs.length; i++) {
        if (divs[i].querySelectorAll('a, span').length > 0) { paginateDiv = divs[i]; break; }
      }
      if (!paginateDiv) {
        if (attempts >= 20) clearInterval(interval);
        return;
      }
      const links = paginateDiv.querySelectorAll('a, span');
      let highestNum = 0, highestLink = null;
      for (let i = 0; i < links.length; i++) {
        const text = links[i].textContent.trim();
        const num = parseInt(text, 10);
        if (!isNaN(num) && text === String(num) && num > highestNum) {
          highestNum = num; highestLink = links[i];
        }
      }
      if (highestLink && highestNum > 1) {
        clearInterval(interval);
        if (!highestLink.classList.contains('current') && !highestLink.classList.contains('active')) {
          console.log(LOG + ' Clicking last page (' + highestNum + ')...');
          highestLink.click();
        }
      } else if (attempts >= 20) {
        clearInterval(interval);
      }
    }, 500);
  }

  function waitForDropdownAndSelect(selectId, targetValue, callback) {
    let attempts = 0;
    const interval = setInterval(function () {
      attempts++;
      const selectEl = document.getElementById(selectId);
      const options = selectEl ? selectEl.querySelectorAll('option') : [];
      const target = normalizeForMatching(targetValue);
      let matched = null;
      for (let i = 0; i < options.length; i++) {
        if (normalizeForMatching(options[i].textContent) === target) { matched = options[i]; break; }
      }
      if (!matched) {
        for (let i = 0; i < options.length; i++) {
          if (normalizeForMatching(options[i].textContent).indexOf(target) !== -1) { matched = options[i]; break; }
        }
      }
      if (matched) {
        clearInterval(interval);
        const value = matched.value;
        selectEl.value = value;
        triggerSelect2(selectEl, value);
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        console.log(LOG + ' Selected "' + targetValue + '" in #' + selectId);
        callback(value);
      } else if (attempts >= 40) {
        clearInterval(interval);
        console.warn(LOG + ' Could not find "' + targetValue + '" in #' + selectId + ' after 20 seconds. Available options:');
        if (selectEl) {
          selectEl.querySelectorAll('option').forEach(function (o) {
            console.warn('  "' + o.textContent.trim() + '"');
          });
        }
      }
    }, 500);
  }

  function fillReason() {
    const editor = document.getElementById('editor');
    const comments = document.getElementById('comments');
    if (!editor || !comments) {
      console.warn(LOG + ' Reason editor not found.');
      return;
    }
    editor.innerText = payload.remark;
    comments.value = payload.remark;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    console.log(LOG + ' All fields filled. *** Please review and click "Add" yourself. ***');
  }

  // Office Type -> Office -> Employee -> Reason, for the current payload
  function runFill() {
    const officeTypeSelect = document.getElementById('filter_office_type');
    if (!officeTypeSelect) {
      console.warn(LOG + ' Office Type dropdown not found. Retrying...');
      setTimeout(runFill, 1500);
      return;
    }
    const label = document.querySelector('label[for="filter_office_type"]');
    if (label) label.scrollIntoView({ behavior: 'smooth', block: 'center' });

    officeTypeSelect.value = payload.officeType;
    triggerSelect2(officeTypeSelect, payload.officeType);
    officeTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));

    const employeeTarget = payload.emp || payload.name;
    waitForDropdownAndSelect('filter_office', payload.office, function () {
      waitForDropdownAndSelect('filter_employee', employeeTarget, function (employeeValue) {
        triggerSelect2(document.getElementById('filter_employee'), employeeValue);
        setTimeout(fillReason, 1000);
      });
    });
  }

  // ---- bridge (Layer 2 panel on this page): switch payload in place, no navigation
  function switchTo(key) {
    const p = readPayload(key);
    if (!p) {
      console.warn(LOG + ' Bridge: no payload for "' + key + '".');
      return;
    }
    chosenKey = key;
    payload = p;
    sessionStorage.setItem('fp.chosen', key);
    console.log(LOG + ' Bridge: switched to "' + key + '" -> ' + p.name);
    runFill();
    if (typeof window.FloatingWindow !== 'undefined') window.FloatingWindow.render();
  }

  window.FCIWorkflow = {
    getWorkflowContext: function () {
      return {
        requestId: sessionStorage.getItem(REQUEST_KEY) || 'Unknown Request',
        hasRecommendation: !!payload,
        recommendedSummary: payload ? ('Target: ' + payload.name + ' (' + payload.office + ')') : 'No payload',
        workflowName: 'HPL / Medical Leave'
      };
    },
    executeReExamine: function () { switchTo('reexamine'); },
    executeReturnPrevious: function () { switchTo('returnprevious'); }
  };

  // ---- start
  setTimeout(goToLastPage, 2500);
  setTimeout(function () { whenJQueryReady(runFill); }, 3500);
  if (typeof window.FloatingWindow !== 'undefined') window.FloatingWindow.render();
})();
