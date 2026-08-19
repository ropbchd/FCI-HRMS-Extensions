// FCI Workflow Assistant — Floating Window Framework v3
// Workflow-agnostic UI panel. Runs in the same JS world as the bridge-defining script.
// Never contains workflow-specific business logic.

(function() {
  'use strict';

  const PANEL_ID = 'fci-workflow-panel';
  const STORAGE_KEY = 'fci_workflow_panel_position';

  // --- Helpers ---

  function clampPanelPosition(panel, left, top) {
    const rect = panel.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const visibleX = 60;   // keep 60px visible horizontally
    const visibleY = 35;   // keep header visible vertically

    const clampedLeft = Math.max(
      -(rect.width - visibleX),
      Math.min(left, vw - visibleX)
    );
    const clampedTop = Math.max(
      0,
      Math.min(top, vh - visibleY)
    );

    return { left: clampedLeft, top: clampedTop };
  }

  // --- Panel Lifecycle ---

  function init() {
    if (document.getElementById(PANEL_ID)) return; // already injected

    const panel = createPanel();
    document.body.appendChild(panel);

    // Restore saved position (with clamping)
    restorePanelPosition(panel);

    // Loading animation
    panel.classList.add('fci-panel-loading');
    setTimeout(function() {
      panel.classList.remove('fci-panel-loading');
    }, 800);

    // Drag support
    makeDraggable(panel);

    // Initial render
    render();

    console.log('[FCI Workflow Assistant] Panel injected.');
  }

  function createPanel() {
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML =
      '<div class="fci-panel-header" id="fci-panel-header">' +
        '<div class="fci-panel-title">🌾 FCI Workflow Assistant</div>' +
        '<div class="fci-panel-drag">≡</div>' +
      '</div>' +
      '<div class="fci-panel-body" id="fci-panel-body">' +
        '<div class="fci-info-block">' +
          '<div class="fci-info-primary" id="fci-request-id">Loading...</div>' +
          '<div class="fci-info-secondary" id="fci-request-type">Detecting...</div>' +
        '</div>' +
        '<div class="fci-section-label">Recommended Action</div>' +
        '<div class="fci-recommended" id="fci-recommended">Detecting...</div>' +
        '<div class="fci-section-label">Alternative Actions</div>' +
        '<div class="fci-actions">' +
          '<button class="fci-btn fci-btn-reexamine" id="fci-btn-reexamine">Re-examine</button>' +
          '<button class="fci-btn fci-btn-return" id="fci-btn-return">Return to Previous Level</button>' +
        '</div>' +
        '<div class="fci-status">' +
          '<span class="fci-status-dot" id="fci-status-dot"></span>' +
          '<span id="fci-status-text">Ready</span>' +
        '</div>' +
      '</div>';

    // Do NOT restore position here – we do it in init() after the panel is in the DOM
    return panel;
  }

  function restorePanelPosition(panel) {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const pos = JSON.parse(saved);
      if (pos.left == null || pos.top == null) return;

      const { left, top } = clampPanelPosition(panel, pos.left, pos.top);
      panel.style.left = left + 'px';
      panel.style.top = top + 'px';
      panel.style.right = 'auto';
    } catch (e) {
      // ignore
    }
  }

  // --- Drag Support ---

  function makeDraggable(panel) {
    const header = panel.querySelector('#fci-panel-header');
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    header.addEventListener('mousedown', function(e) {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      panel.style.transition = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', function(e) {
      if (!isDragging) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      let newLeft = startLeft + dx;
      let newTop = startTop + dy;

      // --- Allow partial off‑screen (keep 60px horizontally, 35px vertically) ---
      const { left, top } = clampPanelPosition(panel, newLeft, newTop);
      newLeft = left;
      newTop = top;
      // ----------------------------------------------------------------------

      panel.style.left = newLeft + 'px';
      panel.style.top = newTop + 'px';
      panel.style.right = 'auto';
    });

    document.addEventListener('mouseup', function() {
      if (!isDragging) return;
      isDragging = false;
      panel.style.transition = '';
      const rect = panel.getBoundingClientRect();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        left: rect.left,
        top: rect.top
      }));
    });
  }

  // --- Rendering ---

  function render() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    // Bridge guard
    if (!window.FCIWorkflow || typeof window.FCIWorkflow.getWorkflowContext !== 'function') {
      console.warn('[Floating Window] getWorkflowContext() not found — this page\'s bridge script hasn\'t implemented the floating window bridge yet.');
      setRecommendedText('Bridge not available — check console.', false);
      return;
    }

    const ctx = window.FCIWorkflow.getWorkflowContext();

    // Request ID
    const reqEl = document.getElementById('fci-request-id');
    if (reqEl) reqEl.textContent = ctx.requestId || 'Unknown Request';

    // Request Type Label
    const typeEl = document.getElementById('fci-request-type');
    if (typeEl) typeEl.textContent = ctx.requestTypeLabel || 'Detecting...';

    // Recommended action
    if (ctx.hasRecommendation) {
      setRecommendedText(ctx.recommendedSummary || 'Recommended action detected.', true);
    } else {
      setRecommendedText('No recommendation detected', false);
    }

    // Wire buttons
    wireButton('fci-btn-reexamine', 'executeReExamine', 'Re-examine');
    wireButton('fci-btn-return', 'executeReturnPrevious', 'Return to Previous Level');
  }

  function setRecommendedText(text, active) {
    const el = document.getElementById('fci-recommended');
    if (!el) return;
    el.textContent = text;
    if (active) {
      el.className = 'fci-recommended';
    } else {
      el.className = 'fci-recommended-muted';
    }
  }

  function wireButton(btnId, methodName, label) {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    // Remove old listeners by cloning
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', function() {
      if (!window.FCIWorkflow || typeof window.FCIWorkflow[methodName] !== 'function') {
        console.warn('[Floating Window] ' + methodName + '() not found — bridge not implemented on this page.');
        return;
      }
      console.log('[Floating Window] User clicked: ' + label);
      window.FCIWorkflow[methodName]();
    });
  }

  // --- Public API: content.js calls this once the bridge is ready ---

  window.FloatingWindow = {
    render: function() {
      // If panel already exists, just refresh the content;
      // otherwise, inject and render.
      const panel = document.getElementById(PANEL_ID);
      if (panel) {
        render();
      } else {
        init();
      }
    }
  };

})();