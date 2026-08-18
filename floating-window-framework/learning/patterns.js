// FCI Workflow Assistant — Patterns Engine
// Core matcher: multi-strategy selectors, scored tie-break, staleness check, confidence tracking.

(function() {
  'use strict';

  // --- Selector Strategy Types ---
  const STRATEGY_TYPES = {
    ID: 'id',
    NAME: 'name',
    ARIA_LABEL: 'aria-label',
    TEXT_CONTENT: 'text-content',
    TABLE_POSITION: 'table-position',
    CSS_SELECTOR: 'css-selector',
    XPATH: 'xpath'
  };

  // --- Selector Matcher ---

  /**
   * Normalize text for comparison
   */
  function normalizeText(text) {
    return (text || '').trim().replace(/[\s\xa0]+/g, ' ').toUpperCase();
  }

  /**
   * Try to match a single strategy
   * @returns {Element|null}
   */
  function matchStrategy(strategy) {
    const { type, value, context } = strategy;
    const root = context ? document.querySelector(context) : document;

    if (!root) return null;

    try {
      switch (type) {
        case STRATEGY_TYPES.ID:
          return document.getElementById(value);

        case STRATEGY_TYPES.NAME:
          return root.querySelector(`[name="${value}"]`);

        case STRATEGY_TYPES.ARIA_LABEL:
          return root.querySelector(`[aria-label="${value}"]`);

        case STRATEGY_TYPES.TEXT_CONTENT:
          // Find element containing this text (button, option, label, td)
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
          const targetNorm = normalizeText(value);
          let node;
          while (node = walker.nextNode()) {
            const parent = node.parentElement;
            if (parent && normalizeText(node.textContent).includes(targetNorm)) {
              // Return interactive parent (button, a, option, select, input) or the element itself
              const interactive = parent.closest('button, a, option, select, input, [role="button"]');
              return interactive || parent;
            }
          }
          return null;

        case STRATEGY_TYPES.TABLE_POSITION:
          // value = { tableSelector, rowIndex, colIndex } or { tableSelector, headerText, rowIndex }
          const table = root.querySelector(value.tableSelector);
          if (!table) return null;
          const rows = table.querySelectorAll('tbody tr');
          if (value.rowIndex >= rows.length) return null;
          const row = rows[value.rowIndex];
          if (typeof value.colIndex === 'number') {
            const cells = row.querySelectorAll('td');
            return cells[value.colIndex] || null;
          }
          if (value.headerText) {
            // Find column by header text
            const headers = table.querySelectorAll('thead th');
            let colIndex = -1;
            headers.forEach((th, i) => {
              if (normalizeText(th.textContent).includes(normalizeText(value.headerText))) {
                colIndex = i;
              }
            });
            if (colIndex >= 0) {
              const cells = row.querySelectorAll('td');
              return cells[colIndex] || null;
            }
          }
          return null;

        case STRATEGY_TYPES.CSS_SELECTOR:
          return root.querySelector(value);

        case STRATEGY_TYPES.XPATH:
          // Simple XPath support via document.evaluate
          const result = document.evaluate(value, root, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          return result.singleNodeValue;

        default:
          console.warn('[Patterns] Unknown strategy type:', type);
          return null;
      }
    } catch (e) {
      console.warn('[Patterns] Strategy match error:', e);
      return null;
    }
  }

  /**
   * Match multi-strategy selector
   * @param {Object} selectorDef - { strategies: [{type, value, score, context?}, ...] }
   * @returns {Object} { element, matchedStrategy, tie }
   */
  function matchSelector(selectorDef) {
    if (!selectorDef || !selectorDef.strategies || !selectorDef.strategies.length) {
      return { element: null, matchedStrategy: null, tie: false };
    }

    // Sort strategies by score descending
    const sorted = [...selectorDef.strategies].sort((a, b) => (b.score || 0) - (a.score || 0));

    let bestElement = null;
    let bestStrategy = null;
    let tie = false;

    for (const strategy of sorted) {
      const element = matchStrategy(strategy);
      if (element) {
        if (!bestElement) {
          bestElement = element;
          bestStrategy = strategy;
        } else {
          // Tie: multiple strategies matched different elements
          if (element !== bestElement) {
            tie = true;
            console.warn('[Patterns] Selector tie detected:', {
              strategy1: bestStrategy,
              strategy2: strategy,
              element1: bestElement.tagName + (bestElement.id ? '#' + bestElement.id : ''),
              element2: element.tagName + (element.id ? '#' + element.id : '')
            });
            // Tie-break: keep highest-score strategy's element
            // (already sorted by score, so bestStrategy wins)
          }
        }
      }
    }

    return { element: bestElement, matchedStrategy: bestStrategy, tie };
  }

  // --- Staleness Check ---

  /**
   * Verify all selectors in a pattern still resolve to exactly one element each
   * @returns {Object} { valid: boolean, failures: Array, warnings: Array, confirmRequired: boolean }
   */
  function validatePattern(pattern) {
    const failures = [];
    const warnings = [];
    let confirmRequired = false;

    for (const [selectorName, selectorDef] of Object.entries(pattern.selectors || {})) {
      const result = matchSelector(selectorDef);

      if (!result.element) {
        failures.push({
          selector: selectorName,
          reason: 'No element matched any strategy',
          strategies: selectorDef.strategies
        });
      } else if (result.tie) {
        // Check if this selector feeds an action
        const isActionSelector = pattern.actions?.some(a => a.selector === selectorName);
        if (isActionSelector) {
          // Action-selector tie: route to confirmRequired instead of failures
          // so executePattern can surface the confirm prompt
          confirmRequired = true;
        } else {
          warnings.push({
            selector: selectorName,
            reason: 'Tie on informational selector (proceeding with highest-score)',
            matchedStrategy: result.matchedStrategy
          });
        }
      }
    }

    return {
      valid: failures.length === 0,
      failures,
      warnings,
      confirmRequired
    };
  }

  // --- Pattern Execution ---

  /**
   * Execute a pattern's actions on the page
   * @param {Object} pattern - { selectors, actions }
   * @param {Object} options - { dryRun: boolean, confirm: boolean }
   * @returns {Promise<Object>} { success, results, errors, confirmRequired }
   */
  async function executePattern(pattern, options = {}) {
    const { dryRun = false, confirm = false } = options;

    // Validate first
    const validation = validatePattern(pattern);
    if (!validation.valid) {
      return {
        success: false,
        results: [],
        errors: validation.failures.map(f => `${f.selector}: ${f.reason}`),
        confirmRequired: validation.confirmRequired
      };
    }

    // Check for action-selector ties (require confirmation)
    // Note: validation.confirmRequired already captures action-selector ties
    const needsConfirmation = validation.confirmRequired || confirm;

    if (needsConfirmation) {
      return {
        success: false,
        results: [],
        errors: [],
        confirmRequired: true,
        tieDetails: validation.failures.filter(f => {
          // Filter to action-selector ties only
          return pattern.actions?.some(a => a.selector === f.selector);
        }),
        message: 'Action selector tie or explicit confirm required. Review before proceeding.'
      };
    }

    // Execute actions
    const results = [];
    const errors = [];

    for (const action of pattern.actions || []) {
      try {
        const selectorResult = matchSelector(pattern.selectors[action.selector]);
        if (!selectorResult.element) {
          errors.push(`Action '${action.type}': Selector '${action.selector}' matched no element`);
          continue;
        }

        const element = selectorResult.element;

        if (!dryRun) {
          await executeAction(element, action);
        }

        results.push({
          action: action.type,
          selector: action.selector,
          element: describeElement(element),
          value: action.value,
          dryRun
        });
      } catch (e) {
        errors.push(`Action '${action.type}': ${e.message}`);
      }
    }

    return {
      success: errors.length === 0,
      results,
      errors,
      confirmRequired: false
    };
  }

  /**
   * Execute a single action on an element
   */
  async function executeAction(element, action) {
    const { type, value } = action;

    switch (type) {
      case 'click':
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(300);
        element.click();
        break;

      case 'set-value':
        if (element.tagName === 'SELECT') {
          element.value = value;
          element.dispatchEvent(new Event('change', { bubbles: true }));
          element.dispatchEvent(new Event('input', { bubbles: true }));
          // Trigger Select2 if present
          if (window.jQuery && window.jQuery.fn.select2) {
            window.jQuery(element).trigger('change');
          }
        } else if (element.isContentEditable) {
          element.innerText = value;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('blur', { bubbles: true }));
        } else {
          element.value = value;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          element.dispatchEvent(new Event('blur', { bubbles: true }));
        }
        break;

      case 'select-option':
        // For dropdowns: click to open, then click option
        element.click();
        await sleep(200);
        const option = element.querySelector(`option[value="${value}"]`) ||
                       Array.from(element.options).find(o => normalizeText(o.textContent) === normalizeText(value));
        if (option) option.selected = true;
        element.dispatchEvent(new Event('change', { bubbles: true }));
        break;

      case 'wait-for':
        // Wait for element matching selector to appear
        await waitForSelector(value, action.timeout || 5000);
        break;

      case 'observe':
        // Just verify element exists, no mutation
        break;

      default:
        console.warn('[Patterns] Unknown action type:', type);
    }
  }

  // --- Helpers ---

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function describeElement(el) {
    return {
      tag: el.tagName,
      id: el.id || null,
      name: el.name || null,
      class: el.className || null,
      text: el.textContent ? normalizeText(el.textContent).slice(0, 50) : null
    };
  }

  async function waitForSelector(selector, timeout) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const interval = setInterval(() => {
        if (document.querySelector(selector)) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() - start > timeout) {
          clearInterval(interval);
          reject(new Error(`Timeout waiting for ${selector}`));
        }
      }, 200);
    });
  }

  // --- Confidence Update ---

  /**
   * Update pattern confidence based on execution outcome
   * @param {Object} pattern - existing pattern
   * @param {boolean} success - whether execution succeeded
   * @param {boolean} userConfirmed - whether user confirmed a prompt
   * @returns {number} new confidence (0-1)
   */
  function updateConfidence(pattern, success, userConfirmed) {
    let conf = pattern.confidence || 0;
    const count = pattern.executionCount || 0;

    if (success) {
      // Success: logarithmic boost, diminishing returns
      const boost = Math.min(0.02 * Math.log10(count + 2), 0.05);
      conf = Math.min(conf + boost, 0.98);
      if (userConfirmed) conf = Math.min(conf + 0.02, 0.98); // Extra boost for confirmed
    } else {
      // Failure: sharp penalty
      conf = Math.max(conf - 0.15, 0);
    }

    return conf;
  }

  // --- Public API ---

  window.FCILearningPatterns = {
    STRATEGY_TYPES,
    matchStrategy,
    matchSelector,
    validatePattern,
    executePattern,
    executeAction,
    updateConfidence,
    sleep,
    waitForSelector
  };

})();