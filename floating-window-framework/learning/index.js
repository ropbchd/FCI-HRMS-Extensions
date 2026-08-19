// FCI Workflow Assistant — Learning Layer Orchestrator
// Real pipeline that runs on page load, classifies, and executes learned patterns.

(function() {
  'use strict';

  // --- State ---
  let initialized = false;
  let running = false;

  // --- Main Pipeline ---

  /**
   * Run the full learning layer pipeline on current page.
   * Returns execution result or null if not applicable.
   */
  async function run() {
    if (running) {
      console.log('[Learning Orchestrator] Already running, skipping');
      return null;
    }
    running = true;

    try {
      // 1. Classify page
      console.log('[Learning Orchestrator] Classifying page...');
      const scorer = window.FCILearningPageScorer;
      if (!scorer || typeof scorer.classifyPage !== 'function') {
        console.warn('[Learning Orchestrator] Page scorer not available');
        return null;
      }

      const classification = await scorer.classifyPage();
      console.log('[Learning Orchestrator] Classification:', classification);

      // 2. Handle fallback (low confidence)
      if (classification.fallback) {
        console.log('[Learning Orchestrator] Low confidence page — Teach Mode hook point');
        // Teach Mode hook for Phase 2
        surfaceState('unrecognized-page', {
          classification,
          message: 'Page not recognized (confidence < 0.75). Teach Mode available in Phase 2.'
        });
        return { state: 'unrecognized-page', classification };
      }

      // 3. Look up pattern
      const storage = window.FCILearningStorage;
      if (!storage || typeof storage.getPattern !== 'function') {
        console.warn('[Learning Orchestrator] Storage not available');
        return null;
      }

      const pattern = await storage.getPattern(classification.requestType, classification.pageSignature);
      if (!pattern) {
        console.log('[Learning Orchestrator] No learned pattern for:', classification.requestType, classification.pageSignature);
        surfaceState('no-pattern', {
          classification,
          message: 'No learned pattern yet for this page type.'
        });
        return { state: 'no-pattern', classification };
      }

      console.log('[Learning Orchestrator] Found pattern:', pattern.key || makePatternKey(classification.requestType, classification.pageSignature));

      // 4. Validate pattern
      const patterns = window.FCILearningPatterns;
      if (!patterns || typeof patterns.validatePattern !== 'function') {
        console.warn('[Learning Orchestrator] Patterns module not available');
        return null;
      }

      const validation = patterns.validatePattern(pattern);
      console.log('[Learning Orchestrator] Validation:', validation);

      if (!validation.valid) {
        console.warn('[Learning Orchestrator] Pattern validation failed:', validation.failures);
        surfaceState('validation-failed', {
          classification,
          pattern,
          validation,
          message: 'Pattern selectors stale or broken — do not execute.'
        });
        return { state: 'validation-failed', classification, pattern, validation };
      }

      // 5. Handle confirm-required (action-selector ties)
      if (validation.confirmRequired && validation.actionTies && validation.actionTies.length > 0) {
        console.log('[Learning Orchestrator] Action-selector ties detected, awaiting user confirmation');
        surfaceState('confirm-required', {
          classification,
          pattern,
          validation,
          actionTies: validation.actionTies,
          message: 'Action-selector ties require user confirmation before execution.'
        });
        // Wait for explicit user confirmation (Phase 2 UI will trigger continuation)
        return { state: 'confirm-required', classification, pattern, validation };
      }

      // 6. Execute pattern
      console.log('[Learning Orchestrator] Executing pattern...');
      const execResult = await patterns.executePattern(pattern, { dryRun: false });
      console.log('[Learning Orchestrator] Execution result:', execResult);

      // 7. Record execution
      await storage.recordExecution(
        classification.requestType,
        classification.pageSignature,
        execResult.success ? 'success' : 'failure',
        extractSelectorsUsed(pattern, execResult)
      );

      surfaceState('executed', {
        classification,
        pattern,
        execResult,
        message: execResult.success ? 'Pattern executed successfully' : 'Pattern execution failed'
      });

      return { state: 'executed', classification, pattern, execResult };

    } catch (e) {
      console.error('[Learning Orchestrator] Pipeline error:', e);
      surfaceState('error', { error: e.message });
      return { state: 'error', error: e.message };
    } finally {
      running = false;
    }
  }

  /**
   * Surface state to content.js / floating window via custom event
   */
  function surfaceState(state, data) {
    const event = new CustomEvent('fci-learning-state', {
      detail: { state, ...data, timestamp: new Date().toISOString() }
    });
    window.dispatchEvent(event);
    console.log('[Learning Orchestrator] State:', state, data);
  }

  /**
   * Extract selectors used from execution result
   */
  function extractSelectorsUsed(pattern, execResult) {
    const used = {};
    if (execResult.results) {
      for (const result of execResult.results) {
        const selectorDef = pattern.selectors[result.selector];
        if (selectorDef) {
          used[result.selector] = {
            strategies: selectorDef.strategies,
            matchedElement: result.element
          };
        }
      }
    }
    return used;
  }

  /**
   * Generate pattern key
   */
  function makePatternKey(requestType, pageSignature) {
    return `${requestType}::${pageSignature}`;
  }

  // --- Auto-run on DOM ready ---
  function tryRun() {
    if (initialized) return;
    
    // Wait for all modules to be available
    const requiredModules = [
      'FCILearningPageScorer',
      'FCILearningStorage', 
      'FCILearningPatterns'
    ];
    
    const allReady = requiredModules.every(name => window[name]);
    if (!allReady) {
      // Retry after short delay
      setTimeout(tryRun, 100);
      return;
    }

    initialized = true;
    console.log('[Learning Orchestrator] All modules ready, running pipeline...');
    run();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryRun);
  } else {
    tryRun();
  }

  // --- Public API ---
  window.FCILearning = {
    run,
    // Allow manual trigger for testing
    runManual: run
  };

})();