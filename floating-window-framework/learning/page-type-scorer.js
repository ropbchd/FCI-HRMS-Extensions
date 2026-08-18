// FCI Workflow Assistant — Page Type Scorer
// Heuristic classifier: derives requestType + pageSignature from URL + DOM anchors.
// No ML, no external deps. Fallback to Teach Mode if confidence < 0.75.

(function() {
  'use strict';

  // --- HRMS Request Type Definitions ---
  // Each request type defines URL patterns and DOM anchor fingerprints.
  // Anchors are semantic: form fields, table headers, button texts that are stable across HRMS deployments.

  const REQUEST_TYPE_DEFINITIONS = {
    'NOC_Other_Exam': {
      urlPatterns: [
        /\/workflow\/add-reviewer/,
        /\/noc-other-exam/i,
        /noc.*other.*exam/i
      ],
      anchors: {
        'action-history': {
          // Action History page (content.js runs here)
          required: ['#custom-action-history-tbl', '.view-action-history', 'View Action History'],
          strong: ['S.No.', 'Date of Action', 'Action Taken', 'Employee Name', 'Designation', 'REMARKS:'],
          weight: 1.0
        },
        'add-reviewer': {
          // Add Reviewer page (content_add_reviewer.js runs here)
          required: ['#filter_office_type', '#filter_office', '#filter_employee', '#editor', '#comments'],
          strong: ['Show entries', 'Office Type', 'Office', 'Employee', 'Reason', 'Add Reviewer'],
          weight: 1.0
        },
        'list-view': {
          // NOC request list
          required: ['#noc-request-table', '.noc-list'],
          strong: ['NOE', 'Request ID', 'Employee', 'Status', 'Action'],
          weight: 0.8
        }
      },
      pageSignatures: ['action-history', 'add-reviewer', 'list-view']
    },

    'LTC': {
      urlPatterns: [
        /\/ltc/i,
        /leave.*travel/i
      ],
      anchors: {
        'application-form': {
          required: ['#ltc-form', '#destination', '#travel-mode'],
          strong: ['LTC', 'Leave Travel', 'Home Town', 'Anywhere India', 'Block Year'],
          weight: 1.0
        },
        'approval-chain': {
          required: ['#approver-list', '.approval-stage'],
          strong: ['Sanctioning Authority', 'Controlling Officer', 'Recommendation'],
          weight: 0.9
        }
      },
      pageSignatures: ['application-form', 'approval-chain']
    },

    'Gratuity': {
      urlPatterns: [
        /\/gratuity/i
      ],
      anchors: {
        'calculation-form': {
          required: ['#gratuity-calc', '#service-years', '#last-salary'],
          strong: ['Gratuity', '15 days salary', 'Completed years', 'Death gratuity'],
          weight: 1.0
        }
      },
      pageSignatures: ['calculation-form']
    },

    'HS_Cascade': {
      urlPatterns: [
        /\/higher.*study/i,
        /\/distance.*education/i
      ],
      anchors: {
        'application-form': {
          required: ['#course-name', '#university', '#duration'],
          strong: ['Higher Study', 'Distance Education', 'Performa', 'Study Leave', 'Bond'],
          weight: 1.0
        }
      },
      pageSignatures: ['application-form']
    },

    'Leave_Encashment': {
      urlPatterns: [
        /\/leave.*encash/i,
        /encashment/i
      ],
      anchors: {
        'encashment-form': {
          required: ['#leave-balance', '#encash-days', '#encash-amount'],
          strong: ['Leave Encashment', 'Earned Leave', 'Half Pay Leave', 'Encashment Amount'],
          weight: 1.0
        }
      },
      pageSignatures: ['encashment-form']
    },

    'OTA_Requests': {
      urlPatterns: [
        /\/ota/i,
        /overtime/i
      ],
      anchors: {
        'ota-form': {
          required: ['#ota-date', '#ota-hours', '#ota-reason'],
          strong: ['Overtime', 'OTA', 'Extra Hours', 'Compensatory'],
          weight: 1.0
        }
      },
      pageSignatures: ['ota-form']
    },

    'Employee_Profile_Update': {
      urlPatterns: [
        /\/profile.*update/i,
        /\/employee.*profile/i
      ],
      anchors: {
        'profile-form': {
          required: ['#emp-name', '#emp-id', '#designation', '#office'],
          strong: ['Profile Update', 'Employee Details', 'Personal Information', 'Contact Details'],
          weight: 1.0
        }
      },
      pageSignatures: ['profile-form']
    }
  };

  // --- Generic Fallback Anchors (for unknown request types) ---
  const GENERIC_ANCHORS = {
    'form-view': {
      required: ['form', 'input', 'select', 'button[type="submit"]'],
      strong: ['Submit', 'Save', 'Cancel', 'Reset'],
      weight: 0.5
    },
    'list-view': {
      required: ['table', 'thead', 'tbody', 'tr', 'td'],
      strong: ['S.No.', 'Action', 'Status', 'Date', 'Name'],
      weight: 0.5
    },
    'detail-view': {
      required: ['.detail', '.card', 'dl', 'dt', 'dd'],
      strong: ['Details', 'View', 'Edit', 'Back'],
      weight: 0.5
    }
  };

  // --- Scoring Functions ---

  /**
   * Normalize text for comparison: trim, collapse whitespace, lowercase
   */
  function normalizeText(text) {
    return (text || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  /**
   * Check if element exists in DOM (by selector or text content)
   */
  function elementExists(selectorOrText) {
    // Try as CSS selector first
    try {
      if (document.querySelector(selectorOrText)) return true;
    } catch (e) {
      // Not a valid selector, treat as text search
    }

    // Search in text content of body
    const bodyText = normalizeText(document.body.innerText || '');
    const searchText = normalizeText(selectorOrText);
    return bodyText.includes(searchText);
  }

  /**
   * Score a single anchor set against current page
   * @returns {Object} { score, matchedRequired, matchedStrong, totalRequired, totalStrong }
   */
  function scoreAnchors(anchors) {
    let matchedRequired = 0;
    let matchedStrong = 0;

    for (const req of anchors.required) {
      if (elementExists(req)) matchedRequired++;
    }
    for (const str of anchors.strong) {
      if (elementExists(str)) matchedStrong++;
    }

    const totalRequired = anchors.required.length;
    const totalStrong = anchors.strong.length;

    // Required anchors are mandatory; if any missing, heavy penalty
    const requiredRatio = totalRequired > 0 ? matchedRequired / totalRequired : 1;
    const strongRatio = totalStrong > 0 ? matchedStrong / totalStrong : 0;

    // Weight: required 70%, strong 30%
    const score = (requiredRatio * 0.7) + (strongRatio * 0.3);

    return {
      score: Math.max(0, Math.min(1, score)),
      matchedRequired,
      matchedStrong,
      totalRequired,
      totalStrong,
      requiredRatio,
      strongRatio
    };
  }

  /**
   * Score URL patterns
   */
  function scoreUrlPatterns(urlPatterns, currentUrl) {
    for (const pattern of urlPatterns) {
      try {
        if (pattern instanceof RegExp) {
          if (pattern.test(currentUrl)) return 1.0;
        } else if (typeof pattern === 'string') {
          if (currentUrl.includes(pattern)) return 0.9;
        }
      } catch (e) {
        // ignore
      }
    }
    return 0;
  }

  /**
   * Generate DOM fingerprint for a page (used as pageSignature anchor)
   */
  function generateAnchorFingerprint() {
    const parts = [];

    // Form fields (by name/id)
    document.querySelectorAll('input[name], select[name], textarea[name]').forEach(el => {
      parts.push(`field:${el.name}:${el.type || el.tagName.toLowerCase()}`);
    });

    // Table headers
    document.querySelectorAll('th').forEach(el => {
      const text = normalizeText(el.textContent);
      if (text) parts.push(`th:${text}`);
    });

    // Button texts
    document.querySelectorAll('button, input[type="button"], input[type="submit"]').forEach(el => {
      const text = normalizeText(el.value || el.textContent);
      if (text) parts.push(`btn:${text}`);
    });

    // Distinctive labels
    document.querySelectorAll('label').forEach(el => {
      const text = normalizeText(el.textContent);
      if (text && text.length > 3) parts.push(`lbl:${text}`);
    });

    return parts.sort().join('|');
  }

  // --- Main Classification Function ---

  const CONFIDENCE_THRESHOLD = 0.75; // Below this → Teach Mode

  /**
   * Classify current page
   * @returns {Object} { requestType, pageSignature, confidence, scores, fallback, anchorFingerprint }
   */
  async function classifyPage() {
    const currentUrl = window.location.href;
    const anchorFingerprint = generateAnchorFingerprint();

    let bestMatch = {
      requestType: 'UNKNOWN',
      pageSignature: 'unknown',
      confidence: 0,
      scores: {},
      anchorFingerprint
    };

    // Score each request type
    for (const [requestType, def] of Object.entries(REQUEST_TYPE_DEFINITIONS)) {
      // URL score (fast filter)
      const urlScore = scoreUrlPatterns(def.urlPatterns, currentUrl);

      // If URL doesn't match at all, still check anchors (some pages share URLs)
      // but deprioritize
      const urlWeight = urlScore > 0 ? 1.0 : 0.3;

      // Anchor score per pageSignature
      for (const pageSignature of def.pageSignatures) {
        const anchors = def.anchors[pageSignature];
        if (!anchors) continue;

        const anchorResult = scoreAnchors(anchors);
        const combinedScore = (urlScore * 0.4) + (anchorResult.score * 0.6 * urlWeight);

        if (combinedScore > bestMatch.confidence) {
          bestMatch = {
            requestType,
            pageSignature,
            confidence: combinedScore,
            scores: {
              url: urlScore,
              anchors: anchorResult
            },
            anchorFingerprint
          };
        }
      }
    }

    // If no known request type matches well, try generic anchors
    if (bestMatch.confidence < CONFIDENCE_THRESHOLD) {
      for (const [pageSig, anchors] of Object.entries(GENERIC_ANCHORS)) {
        const anchorResult = scoreAnchors(anchors);
        if (anchorResult.score > bestMatch.confidence) {
          bestMatch = {
            requestType: 'UNKNOWN',
            pageSignature: pageSig,
            confidence: anchorResult.score * 0.5, // Penalize unknown
            scores: { anchors: anchorResult },
            anchorFingerprint,
            fallback: true
          };
        }
      }
    }

    bestMatch.fallback = bestMatch.confidence < CONFIDENCE_THRESHOLD;

    console.log('[Page Scorer] Classification:', {
      requestType: bestMatch.requestType,
      pageSignature: bestMatch.pageSignature,
      confidence: bestMatch.confidence.toFixed(3),
      fallback: bestMatch.fallback
    });

    return bestMatch;
  }

  /**
   * Register a new request type definition (for Teach Mode to extend)
   */
  function registerRequestType(requestType, definition) {
    REQUEST_TYPE_DEFINITIONS[requestType] = definition;
    console.log('[Page Scorer] Registered new request type:', requestType);
  }

  // --- Public API ---

  window.FCILearningPageScorer = {
    classifyPage,
    registerRequestType,
    CONFIDENCE_THRESHOLD,
    REQUEST_TYPE_DEFINITIONS,
    generateAnchorFingerprint
  };

})();