const GFPLogger = {
  info: (msg) => console.log('[FCI GFP] ' + msg),
  warn: (msg) => console.warn('[FCI GFP] ' + msg),
  error: (msg) => console.error('[FCI GFP] ' + msg)
};

const GFPStorage = {
  set: (key, value) => {
    if (value === null || value === undefined) {
      sessionStorage.removeItem('gfp.' + key);
    } else {
      sessionStorage.setItem('gfp.' + key, String(value));
    }
  },
  get: (key) => sessionStorage.getItem('gfp.' + key),
  remove: (key) => sessionStorage.removeItem('gfp.' + key),
  clearAll: () => {
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith('gfp.')) {
        sessionStorage.removeItem(key);
      }
    });
  }
};

const GFPSelect2 = {
  normalizeText: (value) => {
    return String(value ?? '').trim().replace(/[\s\xa0]+/g, ' ').toUpperCase();
  },

  triggerSelect2: (selectId, value) => {
    // PRECONDITION: This function must only be called from code running in
    // world: "MAIN" (currently content_add_reviewer.js). In MAIN world, the
    // page's own window.jQuery is directly accessible. If this function is
    // ever called from an ISOLATED-world context, direct jQuery access will
    // fail and script injection would be required instead.
    const el = document.getElementById(selectId);
    if (el && window.jQuery) {
      window.jQuery(el).val(value).trigger('change');
      window.jQuery(el).trigger({ type: 'select2:select', params: { data: { id: value } } });
    }
  },

  waitForDropdownAndSelectByText: (selectId, matchValue, callback, maxAttempts = 40) => {
    let attempts = 0;
    const targetNorm = GFPSelect2.normalizeText(matchValue);
    
    const interval = setInterval(() => {
      attempts++;
      const selectEl = document.getElementById(selectId);
      const options = selectEl ? selectEl.querySelectorAll('option') : [];
      
      if (options.length <= 1) {
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          GFPLogger.warn(`Dropdown #${selectId} options never loaded.`);
          callback(false);
        }
        return;
      }

      let matchedValue = null;
      for (let opt of options) {
        const optText = GFPSelect2.normalizeText(opt.textContent);
        if (optText === targetNorm) {
          matchedValue = opt.value;
          break;
        }
      }

      if (matchedValue === null) {
        for (let opt of options) {
          const optText = GFPSelect2.normalizeText(opt.textContent);
          if (optText.includes(targetNorm)) {
            matchedValue = opt.value;
            break;
          }
        }
      }

      if (matchedValue !== null) {
        clearInterval(interval);
        selectEl.value = matchedValue;
        GFPSelect2.triggerSelect2(selectId, matchedValue);
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        GFPLogger.info(`Selected "${matchValue}" in #${selectId}`);
        callback(true);
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        GFPLogger.warn(`Could not find "${matchValue}" in #${selectId} after ${maxAttempts} attempts.`);
        callback(false);
      }
    }, 500);
  }
};

const GFPNavigation = {
  clickAddReviewer: () => {
    const allLinks = document.querySelectorAll('a, button');
    for (const el of allLinks) {
      if (el.textContent.trim() === 'Add Reviewer') {
        GFPLogger.info('Clicking "Add Reviewer"...');
        GFPStorage.set('triggered', 'yes');
        // transactionId is a Date.now() timestamp. The Add Reviewer page
        // validates its age against a 15-second expiry window. Transactions
        // older than 15 seconds are treated as stale (e.g., from a failed
        // navigation that never reached Add Reviewer) and silently discarded.
        GFPStorage.set('transactionId', Date.now().toString());
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        return true;
      }
    }
    GFPLogger.error('ADD_REVIEWER_NOT_FOUND');
    return false;
  }
};

(function () {
  // 1. Qualifying-page detection
  const path = window.location.pathname.toLowerCase();
  if (!path.includes('add-reviewer')) {
    return;
  }

  // 2. Transaction guard with expiry validation.
  //    The transactionId written by gfp_navigation.js is a Date.now() timestamp.
  //    Transactions older than TRANSACTION_MAX_AGE_MS are considered stale
  //    (e.g., from a failed navigation that never reached Add Reviewer)
  //    and silently discarded. This prevents the panel from acting on an
  //    unrelated manual visit to Add Reviewer after a failed trigger.
  const TRANSACTION_MAX_AGE_MS = 15000;
  const triggered = GFPStorage.get('triggered');
  const transactionId = parseInt(GFPStorage.get('transactionId') || '0', 10);

  if (triggered !== 'yes' || !transactionId) {
    GFPLogger.info('Add Reviewer: Not triggered by Generic Panel. Silent exit.');
    return;
  }

  if ((Date.now() - transactionId) > TRANSACTION_MAX_AGE_MS) {
    GFPLogger.warn('Add Reviewer: Transaction expired (age: ' + (Date.now() - transactionId) + 'ms > ' + TRANSACTION_MAX_AGE_MS + 'ms). Silent exit.');
    GFPStorage.remove('triggered');
    GFPStorage.remove('transactionId');
    return;
  }

  // Transaction is valid and fresh. Clear markers immediately.
  GFPStorage.remove('triggered');
  GFPStorage.remove('transactionId');

  // 3. Read payload
  const chosen = GFPStorage.get('chosen') || 'reexamine';
  const name = GFPStorage.get(`route.${chosen}.name`);
  const emp = GFPStorage.get(`route.${chosen}.emp`);
  const office = GFPStorage.get(`route.${chosen}.office`);
  const officeType = GFPStorage.get(`route.${chosen}.officeType`);
  const remark = GFPStorage.get(`remark.${chosen}`);

  if (!name && !emp) {
    GFPLogger.error('PAYLOAD_MISSING: No valid gfp.* payload found. Silent exit.');
    return;
  }

  GFPLogger.info(`Add Reviewer: Executing ${chosen} payload for ${name || emp}`);

  // 4. Form filling sequence
  const fillSequence = () => {
    // Step 1: Office Type
    const otEl = document.getElementById('filter_office_type');
    if (otEl && officeType) {
      otEl.value = officeType;
      GFPSelect2.triggerSelect2('filter_office_type', officeType);
      otEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Step 2: Office
    if (office) {
      GFPSelect2.waitForDropdownAndSelectByText('filter_office', office, () => {
        // Step 3: Remark
        const editor = document.getElementById('editor');
        const comments = document.getElementById('comments');
        if (editor && remark) {
          editor.innerText = remark;
          if (comments) comments.value = remark;
          editor.dispatchEvent(new Event('input', { bubbles: true }));
          editor.dispatchEvent(new Event('blur', { bubbles: true }));
        }

        // Step 4: Employee
        if (emp) {
          GFPSelect2.waitForDropdownAndSelectByText('filter_employee', emp, (success) => {
            if (!success && name) {
              GFPSelect2.waitForDropdownAndSelectByText('filter_employee', name, () => {
                GFPLogger.info('Form filling complete. Awaiting manual review/submission.');
              }, 30);
            } else {
              GFPLogger.info('Form filling complete. Awaiting manual review/submission.');
            }
          }, 30);
        } else if (name) {
          GFPSelect2.waitForDropdownAndSelectByText('filter_employee', name, () => {
            GFPLogger.info('Form filling complete. Awaiting manual review/submission.');
          }, 30);
        }
      }, 40);
    }
  };

  // Wait for jQuery/Select2 readiness before filling
  let attempts = 0;
  const waitForJQuery = () => {
    attempts++;
    if (window.jQuery && window.jQuery.fn && window.jQuery.fn.select2) {
      GFPLogger.info('jQuery and Select2 detected. Starting fill sequence.');
      setTimeout(fillSequence, 500);
    } else if (attempts < 40) {
      setTimeout(waitForJQuery, 500);
    } else {
      GFPLogger.error('SELECT2_NOT_READY: jQuery/Select2 not detected. Aborting fill.');
    }
  };

  waitForJQuery();
})();