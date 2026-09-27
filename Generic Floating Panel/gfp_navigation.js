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