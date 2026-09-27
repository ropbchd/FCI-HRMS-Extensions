(function () {
  // 1. Qualifying-page detection
  const path = window.location.pathname.toLowerCase();
  if (!path.includes('review') || path.includes('add-reviewer')) {
    return; // Not a Work Review page
  }

  GFPLogger.info('Work Review page detected. Initializing Generic Panel...');

  // Helper to click View Action History (idempotent, as empirically confirmed)
  const clickViewActionHistory = () => {
    const btn = document.querySelector('a.view-action-history') || 
                Array.from(document.querySelectorAll('a, button')).find(el => el.textContent.trim() === 'View Action History');
    if (btn) {
      GFPLogger.info('Clicking "View Action History" to ensure population...');
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      return true;
    }
    return false;
  };

  // Deterministic initialization sequence
  const initPanel = (attempts = 0) => {
    if (attempts > 40) {
      GFPLogger.error('Action History did not populate in time (20s timeout). Panel will not render.');
      return;
    }

    const tbody = document.querySelector('#custom-action-history-tbl tbody');
    // Wait until tbody exists AND has meaningful data rows
    if (tbody && tbody.querySelectorAll('tr').length >= 2) {
      GFPLogger.info('Action History populated on current page. Collecting all pages...');
      
      const cadre = GFPPayload.getFieldValue('cadre');
      const office = GFPPayload.getFieldValue('office');
      
      // CRITICAL: Collect all entries across all pagination pages before computing payloads
      GFPPayload.collectAllEntries((allEntries) => {
        GFPLogger.info('Total entries collected across all pages: ' + allEntries.length);
        GFPPayload.computeAll(cadre, office, allEntries);
        GFPPanel.render();
      });
    } else {
      if (attempts === 0) {
        clickViewActionHistory();
      }
      setTimeout(() => initPanel(attempts + 1), 500);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initPanel(0));
  } else {
    initPanel(0);
  }
})();