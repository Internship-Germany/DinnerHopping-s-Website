// Deprecated entry kept for backward compatibility.
// Use public/js/core/includes.js instead.
(function(){
  if (typeof document === 'undefined') return;
  const warnKey = '__dh_includes_migrated';
  if (!window[warnKey]) {
    window[warnKey] = true;
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn('[DinnerHopping] public/js/includes.js has moved to public/js/core/includes.js');
    }
  }
  const src = 'js/core/includes.js';
  const existing = document.querySelector(`script[data-proxy-src="${src}"]`);
  if (existing) return;
  const script = document.createElement('script');
  script.src = src;
  script.async = false;
  script.defer = true;
  script.dataset.proxySrc = src;
  document.head.appendChild(script);
})();
