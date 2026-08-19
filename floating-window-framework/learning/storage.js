// FCI Workflow Assistant — Learning Layer Storage (Dexie wrapper)
// IndexedDB schema for patterns, audit log, and URL pattern rules.
// Dexie is loaded as a local script via manifest.json (no CDN, no network).

(function() {
  'use strict';

  // --- Dexie Database Definition ---
  const DB_NAME = 'FCIWorkflowLearning';
  const DB_VERSION = 1;

  let db;

  async function initDB() {
    if (!window.Dexie) {
      throw new Error('Dexie not loaded. Ensure dexie.min.js is in manifest content_scripts before storage.js');
    }

    db = new Dexie(DB_NAME);
    db.version(DB_VERSION).stores({
      patterns: '++id, &key, requestType, pageSignature, status, flowId, sequenceIndex, updatedAt, consecutiveSuccesses',
      auditLog: '++id, timestamp, requestType, pageSignature, patternId, outcome',
      urlPatternRules: '++id, &urlPattern, requestType, confidence, learnedFrom'
    });

    await db.open();
    console.log('[Learning Storage] IndexedDB initialized:', DB_NAME);
    return db;
  }

  // --- Pattern Operations ---

  /**
   * Generate composite key: `${requestType}::${pageSignature}`
   */
  function makePatternKey(requestType, pageSignature) {
    return `${requestType}::${pageSignature}`;
  }

  /**
   * Get pattern by requestType + pageSignature
   */
  async function getPattern(requestType, pageSignature) {
    if (!db) await initDB();
    const key = makePatternKey(requestType, pageSignature);
    return await db.patterns.where('key').equals(key).first();
  }

  /**
   * Get all patterns for a requestType (ordered by sequenceIndex)
   */
  async function getPatternsByRequestType(requestType) {
    if (!db) await initDB();
    return await db.patterns
      .where('requestType')
      .equals(requestType)
      .sortBy('sequenceIndex');
  }

  /**
   * Get all trusted patterns for a requestType (for promotion)
   */
  async function getTrustedPatternsByRequestType(requestType) {
    if (!db) await initDB();
    return await db.patterns
      .where('requestType')
      .equals(requestType)
      .and(p => p.status === 'trusted' || p.status === 'promoted')
      .sortBy('sequenceIndex');
  }

  /**
   * Upsert pattern (insert or update)
   * Preserves createdAt on updates
   */
  async function upsertPattern(pattern) {
    if (!db) await initDB();
    const key = makePatternKey(pattern.requestType, pattern.pageSignature);
    const now = new Date().toISOString();
    const existing = await db.patterns.where('key').equals(key).first();

    const record = {
      key,
      requestType: pattern.requestType,
      pageSignature: pattern.pageSignature,
      flowId: pattern.flowId || null,
      sequenceIndex: pattern.sequenceIndex ?? 0,
      selectors: pattern.selectors || {},
      actions: pattern.actions || [],
      status: pattern.status || 'learning', // 'learning' | 'trusted' | 'promoted'
      confidence: pattern.confidence ?? 0,
      executionCount: pattern.executionCount ?? 0,
      consecutiveSuccesses: pattern.consecutiveSuccesses ?? 0,
      lastVerified: pattern.lastVerified || now,
      updatedAt: now,
      createdAt: existing?.createdAt || pattern.createdAt || now,
      // Extended fields
      urlPatterns: pattern.urlPatterns || [],
      anchorFingerprint: pattern.anchorFingerprint || '',
      metadata: pattern.metadata || {}
    };

    // Try modify first (update existing), fall back to add (insert new)
    const modified = await db.patterns.where('key').equals(key).modify(record);
    if (modified === 0) {
      await db.patterns.add(record);
    }
    console.log('[Learning Storage] Pattern upserted:', key);
    return record;
  }

  /**
   * Update pattern fields (partial update)
   */
  async function updatePattern(requestType, pageSignature, updates) {
    if (!db) await initDB();
    const key = makePatternKey(requestType, pageSignature);
    const modified = await db.patterns.where('key').equals(key).modify({
      ...updates,
      updatedAt: new Date().toISOString()
    });
    if (modified === 0) return null;
    return await getPattern(requestType, pageSignature);
  }

  /**
   * Increment execution count and update confidence/lastVerified
   * - Success: confidence boost + consecutiveSuccesses++
   * - Failure: confidence penalty (-0.15), consecutiveSuccesses = 0
   * - Promotion: requires 5+ consecutive successes AND confidence >= 0.8
   */
  async function recordExecution(requestType, pageSignature, outcome, selectorsUsed) {
    if (!db) await initDB();
    const key = makePatternKey(requestType, pageSignature);
    const existing = await getPattern(requestType, pageSignature);
    if (!existing) return;

    const count = (existing.executionCount || 0) + 1;
    const isSuccess = outcome === 'success';

    let newConfidence = existing.confidence || 0;
    let newConsecutiveSuccesses = existing.consecutiveSuccesses || 0;

    if (isSuccess) {
      const boost = Math.min(0.02 * Math.log10(count + 1), 0.05);
      newConfidence = Math.min(newConfidence + boost, 0.95);
      newConsecutiveSuccesses += 1;
    } else {
      newConfidence = Math.max(newConfidence - 0.15, 0);
      newConsecutiveSuccesses = 0;
    }

    const newStatus = existing.status === 'learning' 
      && newConsecutiveSuccesses >= 5 
      && newConfidence >= 0.8 
      ? 'trusted' 
      : existing.status;

    await db.patterns.where('key').equals(key).modify({
      executionCount: count,
      confidence: newConfidence,
      consecutiveSuccesses: newConsecutiveSuccesses,
      lastVerified: new Date().toISOString(),
      status: newStatus,
      updatedAt: new Date().toISOString()
    });

    // Also log to audit
    await addAuditLog({
      requestType,
      pageSignature,
      patternId: key,
      selectorsUsed,
      outcome: isSuccess ? 'success' : 'failure',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Mark pattern as promoted (retires from runtime execution)
   */
  async function promotePattern(requestType, pageSignature) {
    if (!db) await initDB();
    const key = makePatternKey(requestType, pageSignature);
    const modified = await db.patterns.where('key').equals(key).modify({
      status: 'promoted',
      updatedAt: new Date().toISOString()
    });
    if (modified > 0) {
      console.log('[Learning Storage] Pattern promoted:', key);
    }
  }

  /**
   * Delete pattern (e.g., on discard)
   */
  async function deletePattern(requestType, pageSignature) {
    if (!db) await initDB();
    const key = makePatternKey(requestType, pageSignature);
    const deleted = await db.patterns.where('key').equals(key).delete();
    if (deleted > 0) {
      console.log('[Learning Storage] Pattern deleted:', key);
    }
  }

  // --- Audit Log Operations ---

  async function addAuditLog(entry) {
    if (!db) await initDB();
    await db.auditLog.add({
      timestamp: entry.timestamp,
      requestType: entry.requestType,
      pageSignature: entry.pageSignature,
      patternId: entry.patternId,
      selectorsUsed: entry.selectorsUsed || {},
      outcome: entry.outcome || 'unknown',
      durationMs: entry.durationMs || 0,
      error: entry.error || null
    });
  }

  async function getAuditLog(filters = {}) {
    if (!db) await initDB();
    let collection = db.auditLog.orderBy('timestamp').reverse();

    if (filters.requestType) {
      collection = collection.filter(log => log.requestType === filters.requestType);
    }
    if (filters.pageSignature) {
      collection = collection.filter(log => log.pageSignature === filters.pageSignature);
    }
    if (filters.outcome) {
      collection = collection.filter(log => log.outcome === filters.outcome);
    }
    if (filters.since) {
      collection = collection.filter(log => log.timestamp >= filters.since);
    }
    if (filters.limit) {
      collection = collection.limit(filters.limit);
    }

    return await collection.toArray();
  }

  // --- URL Pattern Rules Operations ---

  async function addUrlPatternRule(urlPattern, requestType, confidence, learnedFrom) {
    if (!db) await initDB();
    await db.urlPatternRules.put({
      urlPattern,
      requestType,
      confidence: confidence ?? 0.8,
      learnedFrom: learnedFrom || 'heuristic',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  async function getUrlPatternRules() {
    if (!db) await initDB();
    return await db.urlPatternRules.toArray();
  }

  async function findRequestTypeByUrl(url) {
    if (!db) await initDB();
    const rules = await db.urlPatternRules.toArray();
    for (const rule of rules) {
      try {
        const regex = new RegExp(rule.urlPattern);
        if (regex.test(url)) {
          return { requestType: rule.requestType, confidence: rule.confidence };
        }
      } catch (e) {
        // Invalid regex, skip
      }
    }
    return null;
  }

  // --- Export / Import ---

  async function exportAllData() {
    if (!db) await initDB();
    const [patterns, auditLog, urlPatternRules] = await Promise.all([
      db.patterns.toArray(),
      db.auditLog.toArray(),
      db.urlPatternRules.toArray()
    ]);

    return {
      version: DB_VERSION,
      exportedAt: new Date().toISOString(),
      patterns,
      auditLog,
      urlPatternRules
    };
  }

  async function importData(data) {
    if (!db) await initDB();
    if (!data || data.version !== DB_VERSION) {
      throw new Error('Incompatible data version');
    }

    await db.transaction('rw', [db.patterns, db.auditLog, db.urlPatternRules], async () => {
      if (data.patterns) {
        await db.patterns.bulkPut(data.patterns);
      }
      if (data.auditLog) {
        await db.auditLog.bulkPut(data.auditLog);
      }
      if (data.urlPatternRules) {
        await db.urlPatternRules.bulkPut(data.urlPatternRules);
      }
    });
    console.log('[Learning Storage] Data imported successfully');
  }

  async function downloadExport() {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fci-learning-export-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importFromFile(file) {
    const text = await file.text();
    const data = JSON.parse(text);
    await importData(data);
  }

  // --- Public API ---

  window.FCILearningStorage = {
    init: initDB,
    getPattern,
    getPatternsByRequestType,
    getTrustedPatternsByRequestType,
    upsertPattern,
    updatePattern,
    recordExecution,
    promotePattern,
    deletePattern,
    addAuditLog,
    getAuditLog,
    addUrlPatternRule,
    getUrlPatternRules,
    findRequestTypeByUrl,
    exportAllData,
    importData,
    downloadExport,
    importFromFile,
    makePatternKey
  };

})();