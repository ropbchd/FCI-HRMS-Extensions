// FCI Workflow Assistant — Learning Layer Entry Point
// Loads learning modules via manifest.json content_scripts (same pattern as content.js).
// No dynamic script injection — avoids world-crossing and path-resolution bugs.

(function() {
  'use strict';

  // Learning modules are loaded by the manifest's content_scripts entry.
  // They register on window.* as they execute. No manual loading needed here.
  // This file exists as a placeholder entry point; the actual ordering is
  // enforced by the sequence of scripts in manifest.json.

  // --- Public API (no-op until modules are loaded via manifest) ---
  window.FCILearning = {
    init: async () => { console.log('[Learning Layer] Modules loaded via manifest'); },
    storage: () => window.FCILearningStorage,
    scorer: () => window.FCILearningPageScorer,
    patterns: () => window.FCILearningPatterns
  };

})();