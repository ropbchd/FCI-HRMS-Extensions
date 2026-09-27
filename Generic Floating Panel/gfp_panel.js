const GFPPanel = {
  render: () => {
    const existing = document.getElementById('fci-gfp-panel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'fci-gfp-panel';
    panel.innerHTML = `
      <div id="fci-gfp-header">
        <strong class="fci-gfp-title">HRMS Quick Actions</strong>
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="color:rgba(255,255,255,0.7); font-size:14px; cursor:move;" title="Drag panel">⋮⋮</span>
          <button id="fci-gfp-close" style="background:none; border:none; font-size:18px; cursor:pointer; line-height:1; color:#fff; opacity:0.8; padding:0;">×</button>
        </div>
      </div>
      <div class="fci-gfp-body">
        <div class="fci-gfp-actions">
          <button id="fci-gfp-reexamine" class="fci-gfp-btn fci-gfp-btn-reexamine">Re-examine</button>
          <button id="fci-gfp-returnprevious" class="fci-gfp-btn fci-gfp-btn-return">Return to Previous Stage</button>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    GFPPanel.makeDraggable(panel, document.getElementById('fci-gfp-header'));

    document.getElementById('fci-gfp-close').addEventListener('click', () => panel.remove());
    
    document.getElementById('fci-gfp-reexamine').addEventListener('click', () => {
      GFPPanel.executeAction('reexamine');
    });

    document.getElementById('fci-gfp-returnprevious').addEventListener('click', () => {
      GFPPanel.executeAction('returnprevious');
    });
  },

  makeDraggable: (element, handle) => {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    handle.onmousedown = (e) => {
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = () => { document.onmouseup = null; document.onmousemove = null; };
      document.onmousemove = (ev) => {
        ev.preventDefault();
        pos1 = pos3 - ev.clientX;
        pos2 = pos4 - ev.clientY;
        pos3 = ev.clientX;
        pos4 = ev.clientY;
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
        element.style.right = "auto";
      };
    };
  },

  executeAction: (actionType) => {
    const payload = GFPPayload._cache[actionType];
    if (!payload) {
      GFPLogger.error(`Cannot execute ${actionType}: Payload is null or invalid.`);
      alert(`Error: Cannot determine routing target for ${actionType}. Required page fields or action history are missing.`);
      return;
    }

    GFPStorage.set('chosen', actionType);
    GFPStorage.set(`route.${actionType}.name`, payload.target.name);
    GFPStorage.set(`route.${actionType}.emp`, payload.target.employeeNumber);
    GFPStorage.set(`route.${actionType}.office`, payload.target.office);
    GFPStorage.set(`route.${actionType}.officeType`, payload.target.officeType);
    GFPStorage.set(`remark.${actionType}`, payload.remark);

    GFPNavigation.clickAddReviewer();
  }
};