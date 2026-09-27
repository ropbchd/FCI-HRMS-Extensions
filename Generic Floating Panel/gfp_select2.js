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