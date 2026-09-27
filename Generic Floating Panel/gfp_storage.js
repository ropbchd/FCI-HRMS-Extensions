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