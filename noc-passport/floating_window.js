// FCI Workflow Assistant — Floating Window Framework
// SHARED, UNMODIFIED across every workflow extension (Passport, Other Exam,
// Audit Leave, and future extensions). Contains zero business logic — it only
// calls window.FCIWorkflow methods and renders whatever they return.
//
// This same file is injected on both the Review page and the Add Reviewer
// page (see manifest.json). It does not know or care which page it is on, or
// which world (ISOLATED vs MAIN) it is running in — that is decided entirely
// by the manifest, per page, so that it always lands in the same JS context
// as whichever script defines window.FCIWorkflow on that page.

(function () {

  const LOG = '[Floating Window]';
  const POSITION_STORAGE_KEY = 'fci_floating_panel_pos'; // shared across all workflows for v1 (see project notes)

  let panelInjected = false;

  window.FloatingWindow = {
    render: render
  };

  function render() {
    if (panelInjected) {
      console.log(LOG + ' Panel already injected on this page — skipping duplicate render() call.');
      return;
    }
    if (!window.FCIWorkflow || typeof window.FCIWorkflow.getWorkflowContext !== 'function') {
      console.warn(LOG + ' getWorkflowContext() not found — this page\'s content script hasn\'t implemented the floating window bridge yet.');
      return;
    }

    const context = window.FCIWorkflow.getWorkflowContext();
    injectPanel(context);
    panelInjected = true;
  }

  function injectPanel(context) {
    const panel = document.createElement('div');
    panel.id = 'fci-floating-window';
    panel.innerHTML = buildPanelHTML(context);
    document.body.appendChild(panel);

    wireDrag(panel);
    wireButtons(panel);
    restorePosition(panel);
    playLoadAnimation(panel);
  }

  function buildPanelHTML(context) {
    const requestId = context.requestId || 'Unknown';
    const recommendedHTML = context.hasRecommendation
      ? escapeHTML(context.recommendedSummary || '')
      : '<span class="fci-fp-muted">No recommendation detected</span>';

    return (
      '<div class="fci-fp-header">' +
        '<span class="fci-fp-title">FCI Workflow Assistant</span>' +
        '<span class="fci-fp-drag-handle" title="Drag to move">&#9776;</span>' +
      '</div>' +
      '<div class="fci-fp-info-block">' +
        '<div class="fci-fp-info-primary">Request</div>' +
        '<div class="fci-fp-info-secondary">' + escapeHTML(requestId) + '</div>' +
      '</div>' +
      '<div class="fci-fp-section-label">Recommended Action</div>' +
      '<div class="fci-fp-recommended">' + recommendedHTML + '</div>' +
      '<div class="fci-fp-section-label">Alternative Actions</div>' +
      '<div class="fci-fp-actions">' +
        '<button type="button" class="fci-fp-btn fci-fp-btn-reexamine" data-action="reexamine">Re-examine</button>' +
        '<button type="button" class="fci-fp-btn fci-fp-btn-returnprevious" data-action="returnprevious">Return to Previous Level</button>' +
      '</div>' +
      '<div class="fci-fp-section-label">Status</div>' +
      '<div class="fci-fp-status" id="fci-fp-status">Ready</div>'
    );
  }

  function wireButtons(panel) {
    const buttons = panel.querySelectorAll('.fci-fp-btn');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const action = btn.getAttribute('data-action');
        setStatus(panel, 'Working\u2026');
        if (action === 'reexamine') {
          callBridgeMethod('executeReExamine');
        } else if (action === 'returnprevious') {
          callBridgeMethod('executeReturnPrevious');
        }
        setTimeout(function () { setStatus(panel, 'Ready'); }, 1500);
      });
    });
  }

  function callBridgeMethod(methodName) {
    if (!window.FCIWorkflow || typeof window.FCIWorkflow[methodName] !== 'function') {
      console.warn(LOG + ' ' + methodName + '() not found \u2014 this page\'s content script hasn\'t implemented the floating window bridge yet.');
      return;
    }
    window.FCIWorkflow[methodName]();
  }

  function setStatus(panel, text) {
    const statusEl = panel.querySelector('#fci-fp-status');
    if (statusEl) statusEl.textContent = text;
  }

  // --- Drag to reposition ---
  function wireDrag(panel) {
    // Drag the entire header strip
    const handle = panel.querySelector('.fci-fp-header');
    let dragging = false;
    let offsetX = 0, offsetY = 0;

    handle.addEventListener('mousedown', function (e) {
      dragging = true;
      const rect = panel.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      panel.style.right = 'auto';
      e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      panel.style.left = (e.clientX - offsetX) + 'px';
      panel.style.top  = (e.clientY - offsetY) + 'px';
    });

    document.addEventListener('mouseup', function () {
      if (!dragging) return;
      dragging = false;
      savePosition(panel);
    });
  }

  function savePosition(panel) {
    try {
      const rect = panel.getBoundingClientRect();
      localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify({ left: rect.left, top: rect.top }));
    } catch (e) { /* localStorage unavailable — non-critical, ignore */ }
  }

  function restorePosition(panel) {
    try {
      const saved = localStorage.getItem(POSITION_STORAGE_KEY);
      if (!saved) return;
      const pos = JSON.parse(saved);
      panel.style.right = 'auto';
      panel.style.left  = pos.left + 'px';
      panel.style.top   = pos.top + 'px';
    } catch (e) { /* corrupt or missing — fall back to default CSS position */ }
  }

  function playLoadAnimation(panel) {
    panel.classList.add('fci-fp-loaded');
    setTimeout(function () {
      panel.classList.remove('fci-fp-loaded');
    }, 800);
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

})();