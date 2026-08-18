// FCI Workflow Assistant — Learning Layer Entry Point
// Loads storage, page-type-scorer, patterns, and exposes unified API.

(function() {
  'use strict';

  // Load order: storage → page-type-scorer → patterns → patterns-ui → audit-log
  // Each module registers on window.FCILearning*

  const SCRIPTS = [
    'learning/storage.js',
    'learning/page-type-scorer.js',
    'learning/patterns.js'
    // patterns-ui.js and audit-log.js will be added in Phase 2/3
  ];

  let loadedCount = 0;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => { loadedCount++; resolve(); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function initLearningLayer() {
    console.log('[Learning Layer] Initializing...');

    // Load all scripts
    for (const src of SCRIPTS) {
      try {
        await loadScript(src);
      } catch (e) {
        console.error('[Learning Layer] Failed to load', src, e);
      }
    }

    // Wait for APIs to be ready
    let attempts = 0;
    while (attempts < 50) {
      if (window.FCILearningStorage &&
          window.FCILearningPageScorer &&
          window.FCILearningPatterns) {
        break;
      }
      await new Promise(r => setTimeout(r, 100));
      attempts++;
    }

    // Initialize storage
    try {
      await window.FCILearningStorage.init();
    } catch (e) {
      console.error('[Learning Layer] Storage init failed:', e);
    }

    console.log('[Learning Layer] Ready');
  }

  // Auto-init if in content script context
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLearningLayer);
  } else {
    initLearningLayer();
  }

  // Unified API
  window.FCILearning = {
    storage: () => window.FCILearningStorage,
    scorer: () => window.FCILearningPageScorer,
    patterns: () => window.FCILearningPatterns,
    init: initLearningLayer
  };

})();