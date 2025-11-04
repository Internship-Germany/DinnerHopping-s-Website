// Deprecated since the admin scripts were reorganized.
// The new module lives at public/js/pages/admin/alerts.js
// This proxy keeps backward compatibility while pointing developers to the new entry point.
(function(){
  if (typeof window === 'undefined') return;
  const warnOnceKey = '__dh_admin_alerts_migrated';
  if (!window[warnOnceKey]) {
    window[warnOnceKey] = true;
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn('[DinnerHopping] public/js/admin-alerts.js has moved to public/js/pages/admin/alerts.js');
    }
  }
  const src = 'js/pages/admin/alerts.js';
  const existing = document.querySelector(`script[data-proxy-src="${src}"]`);
  if (existing) return;
  const script = document.createElement('script');
  script.src = src;
  script.async = false;
  script.dataset.proxySrc = src;
  document.head.appendChild(script);
})();
