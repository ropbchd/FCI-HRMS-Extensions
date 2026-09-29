// FCI HPL / Medical Leave Assistant — Review Page Script v1.0
//
// Layer 1 (this file, request-specific): reads the action history, detects the step,
//   auto-routes to the assistant (step 3) or shows the final-review panel (step 6).
// Layer 2 (floating_window.js, always present): Re-examine / Return to Previous Level,
//   driven through the window.FCIWorkflow bridge defined below.
//
// Flow (Manager Admin. = MANAGER_NAME):
//   Step 3: request reaches the manager (no assistant / employee review before it)
//           -> auto Add Reviewer to the assistant (cadre/office routing), fixed remark.
//   Step 6: request returns after a review by the assistant OR by the initiating employee
//           -> final-review panel; remark is filled into the editor, the manager presses Review.
(function () {
  'use strict';

  // ------------------------------------------------------------------ CONFIG
  const LOG = '[FCI Leave Assistant]';
  const MANAGER_NAME = 'AMIT KUMAR SINGH';
  const LEAVE_TYPE_TEXT = 'HPL/MEDICAL LEAVE';
  const DEFAULT_OFFICE = 'RO CHANDIGARH';   // office is not shown on leave pages -> assumed
  const OFFICE_TYPE_RO = '4';
  const OFFICE_TYPE_DO = '5';               // reserved for when the office becomes known
  const TRIGGER_KEY = 'fci_lv_triggered';
  const REQUEST_KEY = 'fci_lv_request_id';
  const AUTO_ROUTE_DELAY_MS = 2500;

  const ASSISTANT_GENERAL = { name: 'MADHU DHAKA', empNo: '313284' };
  const ASSISTANT_DIVYA = { name: 'DIVYA KORNU', empNo: '315172' };
  const ASSISTANT_VISHALI = { name: 'VISHALI MARWAHA', empNo: '308235' };
  const ASSISTANT_NAMES = ['MADHU DHAKA', 'DIVYA KORNU', 'VISHALI MARWAHA'];
  const DIVYA_OFFICES = [
    'RO CHANDIGARH', 'DO PATIALA', 'DO LUDHIANA', 'DO JALANDHAR',
    'DO FARIDKOT', 'DO HOSHIARPUR', 'DO AMRITSAR'
  ];
  const VISHALI_OFFICES = [
    'DO KAPURTHALA', 'DO FEROZEPUR', 'DO CHANDIGARH', 'DO BHATINDA',
    'DO MOGA', 'DO GURDASPUR', 'DO SANGRUR'
  ];

  // Fixed remarks
  const ROUTE_TO_ASSISTANT_REMARK =
    'Kindly examine the request for the eligibility of the leaves applied.';
  const REEXAMINE_REMARK =
    'Kindly re-examine the request in light of the applicable rules and circulars of the Corporation.';
  const RETAIN_RESUBMIT_REMARK =
    'As per the Leave Rules, submission of a medical fitness certificate is mandatory prior to resumption of duty following medical leave. ' +
    'Accordingly, it is advised that the leave request be retained until the proposed date of resumption of duty, and thereafter re-submitted along with the appropriate medical and fitness certificate. ' +
    'Consideration for sanction of the leave shall be taken up upon receipt of the said certificate, in accordance with the applicable rules.';
  const BACKWARD_REVIEW_REMARK =
    'Kindly attach the medical certificate / fitness certificate in the appropriate format for the further processing.';

  const SALUTATIONS = ['Shri', 'Smt.', 'Ms.'];
  const DOC_TYPES = ['Discharge Summary', 'Prescription', 'Form 4', 'Form 4 & 5'];

  // ------------------------------------------------------------------ STATE
  const cache = {
    leaveId: null,
    entries: null,
    cadre: '',
    payloadRecommended: null,
    payloadReexamine: null,
    payloadReturnPrevious: null,
    hasRecommendation: false,
    recommendedSummary: 'Detecting...',
    autoTimer: null
  };

  // ------------------------------------------------------------------ HELPERS
  function norm(text) {
    return (text || '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function upper(text) { return norm(text).toUpperCase(); }
  function esc(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Line-by-line field parser: label on one line, value on the next (same as Higher Studies)
  function getFieldValue(fieldName) {
    const lines = (document.body.innerText || '').split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().toLowerCase() === fieldName.toLowerCase()) {
        for (let j = i + 1; j < lines.length; j++) {
          const value = lines[j].trim();
          if (value) return value;
        }
      }
    }
    return '';
  }

  function getLeaveId() {
    const v = getFieldValue('Leave ID');
    if (/^LA\d+$/i.test(v)) return v.toUpperCase();
    const m = (document.body.innerText || '').match(/\bLA\d{5,}\b/);
    return m ? m[0].toUpperCase() : null;
  }

  function waitFor(conditionFn, timeoutMs, cb) {
    const started = Date.now();
    (function poll() {
      const result = conditionFn();
      if (result) return cb(result);
      if (Date.now() - started >= timeoutMs) return cb(null);
      setTimeout(poll, 250);
    })();
  }

  function findButton(text) {
    const els = document.querySelectorAll('a, button');
    for (let i = 0; i < els.length; i++) {
      if (els[i].textContent.trim() === text) return els[i];
    }
    return null;
  }

  // dd/mm/yyyy helpers
  function parseDMY(s) {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((s || '').trim());
    if (!m) return null;
    const d = new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
    return isNaN(d.getTime()) ? null : d;
  }
  function isoToDMY(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
  }
  function todayMidnight() {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }
  function inclusiveDays(fromD, toD) {
    if (!fromD || !toD) return NaN;
    return Math.round((toD.getTime() - fromD.getTime()) / 86400000) + 1;
  }
  function fmtNum(n) {
    return String(parseFloat(Number(n).toFixed(2)));
  }
  function toTitleCase(s) {
    return norm(s).toLowerCase().replace(/(^|[\s.\-'])([a-z])/g, function (m, p, c) {
      return p + c.toUpperCase();
    });
  }
  function shortDesignation(d) {
    return norm(d).replace(/assistant\s+grade/i, 'A.G');
  }
  function shortCadre(c) {
    const u = upper(c);
    if (u === 'GENERAL') return 'Genl.';
    if (u === 'DEPOT') return 'Depot';
    return norm(c);
  }

  // ------------------------------------------------------------------ PAGE FIELDS
  function readLeaveFields() {
    const f = {
      leaveId: cache.leaveId,
      empNo: getFieldValue('Employee Number'),
      empName: norm(getFieldValue('Employee Name')),
      designation: norm(getFieldValue('Designation')),
      cadre: norm(getFieldValue('Cadre')),
      fromDate: getFieldValue('From Date'),
      toDate: getFieldValue('To Date'),
      session: getFieldValue('Session'),
      isMedical: getFieldValue('Is Medical'),
      duration: parseFloat(getFieldValue('Duration')),
      balance: parseFloat(getFieldValue('Current Balance'))
    };
    f.fromD = parseDMY(f.fromDate);
    f.toD = parseDMY(f.toDate);
    return f;
  }

  // Leave period is "over" only when today is AFTER the leave end date
  function isLeavePeriodOver(leave) {
    if (!leave.toD) return false;
    return todayMidnight().getTime() > leave.toD.getTime();
  }

  function readDeclaration() {
    const boxes = document.querySelectorAll('input[type="checkbox"]');
    for (let i = 0; i < boxes.length; i++) {
      let node = boxes[i];
      for (let up = 0; up < 4 && node; up++) {
        node = node.parentElement;
        const txt = node ? (node.textContent || '') : '';
        if (node && txt.length < 600 && /hereby declare/i.test(txt)) {
          return { found: true, checked: boxes[i].checked };
        }
      }
    }
    return { found: false, checked: false };
  }

  function hasAttachment() {
    const els = document.querySelectorAll('a, button');
    for (let i = 0; i < els.length; i++) {
      if (/view attachment/i.test(els[i].textContent)) return true;
    }
    return false;
  }

  function countLinkOfficers() {
    const tables = document.querySelectorAll('table');
    for (let i = 0; i < tables.length; i++) {
      const txt = (tables[i].textContent || '').toUpperCase();
      if (txt.indexOf('EMPLOYEE CODE') !== -1 && txt.indexOf('EMPLOYEE NAME') !== -1 &&
          txt.indexOf('ACTION TAKEN') === -1) {
        let n = 0;
        tables[i].querySelectorAll('tbody tr').forEach(function (tr) {
          if (!tr.querySelectorAll('td').length) return;
          if (tr.querySelector('.dataTables_empty')) return;
          const t = (tr.textContent || '').toUpperCase();
          if (t.indexOf('EMPLOYEE CODE') !== -1 || !t.trim()) return;
          n++;
        });
        return n;
      }
    }
    return 0;
  }

  // ------------------------------------------------------------------ ROUTING RULES
  function decideAssistant(cadreRaw, officeRaw) {
    const cadre = upper(cadreRaw);
    const office = upper(officeRaw);
    if (cadre === 'GENERAL') return ASSISTANT_GENERAL;
    if (cadre === 'DEPOT') {
      if (DIVYA_OFFICES.indexOf(office) !== -1) return ASSISTANT_DIVYA;
      if (VISHALI_OFFICES.indexOf(office) !== -1) return ASSISTANT_VISHALI;
      console.warn(LOG + ' Depot cadre but office not in known groups: ' + office);
      return null;
    }
    console.warn(LOG + ' Unrecognised cadre: ' + cadre);
    return null;
  }

  function isAssistantName(name) {
    const u = upper(name);
    return ASSISTANT_NAMES.some(function (n) { return u.indexOf(n) !== -1; });
  }

  // ------------------------------------------------------------------ SESSION PAYLOADS
  function persistPayload(key, p) {
    sessionStorage.setItem('fp.route.' + key + '.name', p.name);
    sessionStorage.setItem('fp.route.' + key + '.office', p.office);
    sessionStorage.setItem('fp.route.' + key + '.officeType', p.officeType);
    sessionStorage.setItem('fp.remark.' + key, p.remark);
    if (p.emp) sessionStorage.setItem('fp.route.' + key + '.emp', p.emp);
    else sessionStorage.removeItem('fp.route.' + key + '.emp');
  }

  function payloadFor(key) {
    if (key === 'recommended') return cache.payloadRecommended;
    if (key === 'reexamine') return cache.payloadReexamine;
    if (key === 'returnprevious') return cache.payloadReturnPrevious;
    return null;
  }

  function buildAlternativePayloads(leave, initiator) {
    const assistant = decideAssistant(cache.cadre, DEFAULT_OFFICE);
    if (assistant) {
      cache.payloadReexamine = {
        name: assistant.name, emp: assistant.empNo,
        office: DEFAULT_OFFICE, officeType: OFFICE_TYPE_RO, remark: REEXAMINE_REMARK
      };
      persistPayload('reexamine', cache.payloadReexamine);
    }
    const empName = initiator ? initiator.employeeName : leave.empName;
    if (empName && leave.empNo) {
      cache.payloadReturnPrevious = {
        name: empName, emp: leave.empNo,
        office: DEFAULT_OFFICE, officeType: OFFICE_TYPE_RO,
        remark: isLeavePeriodOver(leave) ? BACKWARD_REVIEW_REMARK : RETAIN_RESUBMIT_REMARK
      };
      persistPayload('returnprevious', cache.payloadReturnPrevious);
    }
  }

  function goToAddReviewer(key) {
    const p = payloadFor(key);
    if (!p) {
      console.warn(LOG + ' No payload available for "' + key + '".');
      return false;
    }
    if (cache.autoTimer) { clearTimeout(cache.autoTimer); cache.autoTimer = null; }
    const btn = findButton('Add Reviewer');
    if (!btn) {
      console.warn(LOG + ' "Add Reviewer" button not found.');
      return false;
    }
    sessionStorage.setItem('fp.chosen', key);
    sessionStorage.setItem(TRIGGER_KEY, String(Date.now()));
    sessionStorage.setItem(REQUEST_KEY, cache.leaveId || '');
    console.log(LOG + ' Add Reviewer -> ' + p.name + ' [' + key + ']');
    btn.click();
    return true;
  }

  // ------------------------------------------------------------------ BRIDGE (Layer 2)
  function defineBridge() {
    window.FCIWorkflow = {
      getWorkflowContext: function () {
        return {
          requestId: cache.leaveId,
          hasRecommendation: cache.hasRecommendation,
          recommendedSummary: cache.recommendedSummary,
          workflowName: 'HPL / Medical Leave'
        };
      },
      executeReExamine: function () { goToAddReviewer('reexamine'); },
      executeReturnPrevious: function () { goToAddReviewer('returnprevious'); }
    };
  }

  function renderFramework() {
    if (typeof window.FloatingWindow !== 'undefined') window.FloatingWindow.render();
  }

  // ------------------------------------------------------------------ ACTION HISTORY
  function findHistoryTbody() {
    const known = document.querySelector('#custom-action-history-tbl tbody');
    if (known && known.querySelectorAll('tr').length) return known;
    const tables = document.querySelectorAll('table');
    for (let i = 0; i < tables.length; i++) {
      const head = tables[i].rows && tables[i].rows[0] ? tables[i].rows[0].textContent : '';
      if (head.toUpperCase().indexOf('ACTION TAKEN') !== -1) {
        const b = tables[i].querySelector('tbody');
        if (b && b.querySelectorAll('tr').length) return b;
      }
    }
    return null;
  }

  // Columns: 0 S.No | 1 Date | 2 Version | 3 Action Taken | 4 Employee | 5 Designation | 6 Division | 7 Authority
  function parseEntries(tbody) {
    const entries = [];
    let cur = null;
    tbody.querySelectorAll('tr').forEach(function (row) {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 7) {
        cur = {
          slNo: norm(cells[0].textContent),
          date: norm(cells[1].textContent),
          actionTaken: norm(cells[3].textContent),
          employeeName: norm(cells[4].textContent),
          designation: norm(cells[5].textContent),
          remark: '',
          row: row
        };
        entries.push(cur);
      } else if (cells.length === 1 && cur) {
        const txt = cells[0].textContent.trim();
        if (/^REMARKS:/i.test(txt)) cur.remark = txt.replace(/^REMARKS:/i, '').trim();
      }
    });
    return entries;
  }

  function clickViewActionHistory(attempt) {
    let btn = document.querySelector('a.view-action-history') || findButton('View Action History');
    if (btn) {
      console.log(LOG + ' Clicking "View Action History"...');
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      waitFor(findHistoryTbody, 12000, function (tbody) {
        if (!tbody) { console.warn(LOG + ' Action history did not load.'); return; }
        analyse(tbody);
      });
    } else if ((attempt || 0) < 10) {
      setTimeout(function () { clickViewActionHistory((attempt || 0) + 1); }, 1500);
    } else {
      console.warn(LOG + ' "View Action History" button not found.');
    }
  }

  // ------------------------------------------------------------------ STEP DETECTION
  function analyse(tbody) {
    const entries = parseEntries(tbody);
    cache.entries = entries;
    cache.cadre = upper(getFieldValue('Cadre'));
    const leave = readLeaveFields();

    let pendingIdx = -1;
    entries.forEach(function (e, i) {
      if (upper(e.employeeName).indexOf(MANAGER_NAME) !== -1 && e.actionTaken === 'Pending Review') {
        pendingIdx = i;
      }
    });
    if (pendingIdx === -1) {
      console.log(LOG + ' Request is not pending review with ' + MANAGER_NAME + '. No action, no panel.');
      return;
    }

    const initiator = entries.filter(function (e) { return e.actionTaken === 'Initiated'; })[0] || null;
    buildAlternativePayloads(leave, initiator);

    const prev = pendingIdx > 0 ? entries[pendingIdx - 1] : null;
    const returnedToManager = !!prev && prev.actionTaken === 'Reviewed' && (
      isAssistantName(prev.employeeName) ||
      (initiator && upper(prev.employeeName) === upper(initiator.employeeName))
    );

    if (returnedToManager) {
      console.log(LOG + ' Step 6 detected (returned by ' + prev.employeeName + ').');
      startStep6(leave, prev);
    } else {
      console.log(LOG + ' Step 3 detected.');
      startStep3(prev);
    }
  }

  function highlightEntry(entry) {
    if (entry && entry.row) entry.row.style.outline = '3px solid #029456';
  }

  // ------------------------------------------------------------------ STEP 3: route to assistant
  function startStep3(prev) {
    const assistant = decideAssistant(cache.cadre, DEFAULT_OFFICE);
    if (assistant) {
      cache.payloadRecommended = {
        name: assistant.name, emp: assistant.empNo,
        office: DEFAULT_OFFICE, officeType: OFFICE_TYPE_RO, remark: ROUTE_TO_ASSISTANT_REMARK
      };
      persistPayload('recommended', cache.payloadRecommended);
      cache.hasRecommendation = true;
      cache.recommendedSummary = 'Step 3: routing to ' + assistant.name +
        ' for examination (office assumed: ' + DEFAULT_OFFICE + ')';
      highlightEntry(prev);
      cache.autoTimer = setTimeout(function () { goToAddReviewer('recommended'); }, AUTO_ROUTE_DELAY_MS);
    } else {
      cache.hasRecommendation = false;
      cache.recommendedSummary = 'No assistant mapping for cadre "' + cache.cadre +
        '" — use Re-examine / Return to Previous Level or add the reviewer manually';
    }
    renderFramework();
  }

  // ------------------------------------------------------------------ STEP 6: final review panel
  function buildFinalRemark(f) {
    let r = 'Kindly refer to the leave request submitted by ' + f.salutation + ' ' + f.name + ', ' +
      f.designation + ' (' + f.cadre + '), wherein the official has applied for commuted medical leave for the period from ' +
      f.fromDate + ' to ' + f.toDate + '. ';
    r += 'In support of the application, the following documents have been submitted: ';
    const period = 'for the period from ' + f.fromDate + ' to ' + f.toDate + '. ';
    if (f.docType === 'Discharge Summary') {
      r += 'A Discharge Summary dated ' + f.docDate + ', confirming hospitalization during the period from ' +
        f.fromDate + ' to ' + f.toDate + '. ';
    } else if (f.docType === 'Prescription') {
      r += 'A Prescription dated ' + f.docDate + ', confirming the inability of the official in attending the office ' + period;
    } else if (f.docType === 'Form 4') {
      r += 'A Form 4 in the prescribed format and signed by the authorized practitioner, dated ' + f.docDate +
        ', confirming the inability of the official in attending the office ' + period;
    } else if (f.docType === 'Form 4 & 5') {
      r += 'A Form 4 & 5 in the prescribed format and signed by the authorized practitioner, dated ' + f.docDate +
        ', confirming the inability of the official in attending the office ' + period;
    }
    r += 'A fitness certificate dated ' + f.fitCertDate + ' states that the officer is fit to resume duty with effect from ' +
      f.fitDate + '. ';
    r += 'As per records, the employee has ' + f.balance + ' days of Half Pay Leave (HPL) available in the leave account. ';
    // HPL debited (portal Duration) first, then the commuted-leave days
    r += 'Accordingly, and in line with applicable leave rules, if approved, ' + f.hplDebit +
      ' days of HPL may be commuted to ' + f.leaveDays + ' days of Commuted Leave for the aforementioned period.';
    return r;
  }

  function fillRemark(text) {
    let editor = document.getElementById('editor') || document.querySelector('[contenteditable="true"]');
    const comments = document.getElementById('comments');
    if (!editor && !comments) return false;
    if (editor) {
      editor.innerText = text;
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (comments) {
      comments.value = text;
      comments.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (editor) editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  }

  function makeDraggable(panel, handle) {
    let dragging = false, sx = 0, sy = 0, sl = 0, st = 0;
    handle.addEventListener('mousedown', function (e) {
      if (e.target.closest('button')) return;
      dragging = true;
      sx = e.clientX; sy = e.clientY;
      const r = panel.getBoundingClientRect();
      sl = r.left; st = r.top;
      e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      const left = Math.max(-(panel.offsetWidth - 100), Math.min(sl + e.clientX - sx, window.innerWidth - 100));
      const top = Math.max(10, Math.min(st + e.clientY - sy, window.innerHeight - 50));
      panel.style.left = left + 'px';
      panel.style.top = top + 'px';
      panel.style.right = 'auto';
    });
    document.addEventListener('mouseup', function () { dragging = false; });
  }

  function checkRow(state, text) {
    const icon = state === 'ok' ? '✓' : (state === 'warn' ? '⚠' : '•');
    const color = state === 'ok' ? '#2e7d32' : (state === 'warn' ? '#e65100' : '#777');
    return '<div style="display:flex;gap:6px;margin-bottom:3px;font-size:12px;">' +
      '<span style="color:' + color + ';font-weight:bold;width:14px;">' + icon + '</span>' +
      '<span>' + esc(text) + '</span></div>';
  }

  function startStep6(leave, prev) {
    const over = isLeavePeriodOver(leave);
    const daysByDates = inclusiveDays(leave.fromD, leave.toD);
    const durOk = !isNaN(leave.duration);
    const balOk = !isNaN(leave.balance);

    // ---- automatic checks (verification only — none of these go into the remark)
    const checks = [];
    checks.push(over
      ? checkRow('ok', 'Leave period is over (ended ' + leave.toDate + ')')
      : checkRow('warn', 'Leave period not yet over — ends ' + leave.toDate));
    if (durOk && balOk) {
      checks.push(leave.balance >= leave.duration
        ? checkRow('ok', 'HPL balance ' + fmtNum(leave.balance) + ' covers ' + fmtNum(leave.duration) + ' required')
        : checkRow('warn', 'HPL balance ' + fmtNum(leave.balance) + ' is LESS than ' + fmtNum(leave.duration) + ' required'));
    } else {
      checks.push(checkRow('warn', 'Could not read Duration / Current Balance from the page'));
    }
    if (durOk && !isNaN(daysByDates)) {
      checks.push(Math.abs(leave.duration - 2 * daysByDates) < 0.001
        ? checkRow('ok', 'Duration ' + fmtNum(leave.duration) + ' = 2 × ' + daysByDates + ' day(s) between the dates')
        : checkRow('warn', 'Duration ' + fmtNum(leave.duration) + ' ≠ 2 × ' + daysByDates + ' day(s) between the dates — check session'));
    }
    const decl = readDeclaration();
    checks.push(!decl.found ? checkRow('info', 'Declaration checkbox not found on the page')
      : (decl.checked ? checkRow('ok', 'Declaration box is ticked') : checkRow('warn', 'Declaration box is NOT ticked')));
    checks.push(hasAttachment() ? checkRow('ok', 'Attachment is present (content not checked)')
      : checkRow('warn', 'No attachment link found'));
    checks.push(countLinkOfficers() > 0 ? checkRow('ok', 'Link Officer in Absence is listed')
      : checkRow('warn', 'No Link Officer in Absence listed'));
    checks.push(checkRow('info', 'Office assumed: ' + DEFAULT_OFFICE));

    const suggestion = over
      ? 'Leave period is over: if the documents are in order, generate the final remark below. If they are missing or improper, use "Return to Previous Level" (Backward Review remark).'
      : 'Leave period is not over: use "Return to Previous Level" (retain & resubmit remark).';

    cache.hasRecommendation = true;
    cache.recommendedSummary = over
      ? 'Step 6: leave period over — generate final remark, or return to employee if documents are missing'
      : 'Step 6: leave period not over — return to employee (retain & resubmit)';

    // ---- panel
    const old = document.getElementById('fci-lv-final-panel');
    if (old) old.remove();
    const panel = document.createElement('div');
    panel.id = 'fci-lv-final-panel';
    panel.style.cssText =
      'position:fixed;top:120px;right:400px;z-index:2147483646;width:430px;' +
      'background:#ffffff;border-radius:10px;font-family:Arial,sans-serif;font-size:13px;line-height:1.5;' +
      'box-shadow:0 8px 32px rgba(0,0,0,0.2);overflow:hidden;box-sizing:border-box;border:1px solid #d0d0d0;';
    const inputStyle = 'width:100%;padding:6px 8px;border:1px solid #ccc;border-radius:4px;font-size:12px;box-sizing:border-box;';
    const labelStyle = 'display:block;font-weight:bold;margin-bottom:4px;font-size:12px;';
    panel.innerHTML =
      '<div id="fci-lv-header" style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#029456;user-select:none;cursor:move;">' +
        '<strong style="font-size:13px;color:#fff;">Step 6 — HPL / Medical Leave Final Review</strong>' +
        '<button id="fci-lv-close" style="background:none;border:none;font-size:18px;cursor:pointer;line-height:1;color:#fff;opacity:0.8;padding:0;width:28px;height:28px;">&times;</button>' +
      '</div>' +
      '<div style="padding:14px;max-height:calc(100vh - 180px);overflow-y:auto;">' +
        '<div style="background:#f7f9fc;padding:10px;border-radius:6px;margin-bottom:12px;font-size:12px;">' +
          '<strong>Employee:</strong> ' + esc(leave.empName) + ' (' + esc(leave.empNo) + ')<br>' +
          '<strong>Leave:</strong> ' + esc(leave.fromDate) + ' to ' + esc(leave.toDate) +
            ' · Duration ' + esc(isNaN(leave.duration) ? 'N/A' : fmtNum(leave.duration)) +
            ' · Balance ' + esc(isNaN(leave.balance) ? 'N/A' : fmtNum(leave.balance)) +
        '</div>' +
        '<div style="margin-bottom:12px;padding:10px;background:#fff8e1;border:1px solid #ffe082;border-radius:6px;">' +
          '<div style="font-weight:bold;margin-bottom:6px;color:#f57f17;">Checks</div>' + checks.join('') +
          '<div style="margin-top:8px;font-size:12px;color:#444;">' + esc(suggestion) + '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">' +
          '<div><label style="' + labelStyle + '">Salutation</label>' +
            '<select id="lv-sal" style="' + inputStyle + '"><option value="">— select —</option>' +
            SALUTATIONS.map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + '</option>'; }).join('') + '</select></div>' +
          '<div><label style="' + labelStyle + '">Medical document</label>' +
            '<select id="lv-doc" style="' + inputStyle + '"><option value="">— select —</option>' +
            DOC_TYPES.map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + '</option>'; }).join('') + '</select></div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px;">' +
          '<div><label style="' + labelStyle + '">Document date</label><input type="date" id="lv-docdate" style="' + inputStyle + '"></div>' +
          '<div><label style="' + labelStyle + '">Fitness cert. date</label><input type="date" id="lv-fitcert" style="' + inputStyle + '"></div>' +
          '<div><label style="' + labelStyle + '">Fit to resume from</label><input type="date" id="lv-fitdate" style="' + inputStyle + '"></div>' +
        '</div>' +
        '<label style="display:flex;align-items:center;gap:6px;margin-bottom:12px;cursor:pointer;font-size:12px;">' +
          '<input type="checkbox" id="lv-docs-ok" style="width:16px;height:16px;"> Documents checked — proper format and in order</label>' +
        '<div style="display:flex;gap:8px;margin-bottom:12px;">' +
          '<button id="lv-generate" style="flex:1;padding:10px;background:#029456;color:#fff;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">Generate Final Remark</button>' +
          '<button id="lv-clear" style="padding:10px 16px;background:#fff;color:#333;border:1px solid #ccc;border-radius:6px;font-weight:bold;cursor:pointer;">Clear</button>' +
        '</div>' +
        '<label style="' + labelStyle + '">Preview</label>' +
        '<textarea id="lv-preview" readonly style="width:100%;min-height:130px;padding:8px;border:1px solid #ccc;border-radius:4px;font-family:monospace;font-size:11px;box-sizing:border-box;background:#fafafa;margin-bottom:10px;"></textarea>' +
        '<button id="lv-fill" style="width:100%;padding:10px;background:#029456;color:#fff;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">Fill Remark into Editor</button>' +
        '<div style="margin-top:8px;font-size:11px;color:#777;">Amend the remark in the editor if needed, then press Review yourself.</div>' +
      '</div>';
    document.body.appendChild(panel);
    makeDraggable(panel, panel.querySelector('#fci-lv-header'));
    panel.querySelector('#fci-lv-close').addEventListener('click', function () { panel.remove(); });

    const $ = function (id) { return panel.querySelector(id); };

    $('#lv-clear').addEventListener('click', function () {
      $('#lv-sal').value = ''; $('#lv-doc').value = '';
      $('#lv-docdate').value = ''; $('#lv-fitcert').value = ''; $('#lv-fitdate').value = '';
      $('#lv-docs-ok').checked = false; $('#lv-preview').value = '';
    });

    $('#lv-generate').addEventListener('click', function () {
      const sal = $('#lv-sal').value, docType = $('#lv-doc').value;
      const docDate = isoToDMY($('#lv-docdate').value);
      const fitCertDate = isoToDMY($('#lv-fitcert').value);
      const fitDate = isoToDMY($('#lv-fitdate').value);
      const missing = [];
      if (!sal) missing.push('Salutation');
      if (!docType) missing.push('Medical document');
      if (!docDate) missing.push('Document date');
      if (!fitCertDate) missing.push('Fitness certificate date');
      if (!fitDate) missing.push('Fit to resume from');
      if (missing.length) { alert('Please fill: ' + missing.join(', ')); return; }
      if (!durOk || !balOk) { alert('Duration / Current Balance could not be read from the page.'); return; }
      if (!$('#lv-docs-ok').checked &&
          !confirm('"Documents checked" is not ticked. Continue anyway?')) return;
      if (!over && !confirm('The leave period has not ended yet. Generate the final remark anyway?')) return;
      const fitD = parseDMY(fitDate);
      if (fitD && leave.toD && fitD.getTime() <= leave.toD.getTime() &&
          !confirm('Fit-to-resume date is on or before the leave end date. Continue anyway?')) return;

      $('#lv-preview').value = buildFinalRemark({
        salutation: sal,
        name: toTitleCase(leave.empName),
        designation: shortDesignation(leave.designation),
        cadre: shortCadre(leave.cadre),
        fromDate: leave.fromDate, toDate: leave.toDate,
        docType: docType, docDate: docDate,
        fitCertDate: fitCertDate, fitDate: fitDate,
        balance: fmtNum(leave.balance),
        hplDebit: fmtNum(leave.duration),
        leaveDays: fmtNum(leave.duration / 2)
      });
    });

    $('#lv-fill').addEventListener('click', function () {
      const remark = $('#lv-preview').value;
      if (!remark.trim()) { alert('Please generate the remark first.'); return; }
      if (!fillRemark(remark)) { alert('Reviewer Remarks editor not found on this page.'); return; }
      cache.recommendedSummary = 'Remark filled — review it in the editor, then press Review';
      renderFramework();
    });

    highlightEntry(prev);
    renderFramework();
  }

  // ------------------------------------------------------------------ START
  waitFor(getLeaveId, 12000, function (leaveId) {
    if (!leaveId) {
      console.log(LOG + ' No leave ID found. Extension will NOT activate.');
      return;
    }
    if (upper(getFieldValue('Leave Type')).indexOf(LEAVE_TYPE_TEXT) === -1) {
      console.log(LOG + ' Not an HPL/Medical Leave request. Extension will NOT activate.');
      return;
    }
    cache.leaveId = leaveId;
    sessionStorage.setItem(REQUEST_KEY, leaveId);
    console.log(LOG + ' Leave ID confirmed: ' + leaveId + '. Activating...');
    defineBridge();
    setTimeout(function () { clickViewActionHistory(0); }, 1500);
  });
})();
