(function(){
  if (typeof window === 'undefined') return;
  const registry = window.dhAdminDashboard = window.dhAdminDashboard || {};
  const helpers = registry.helpers = registry.helpers || {};

  const apiFetch = (window.dh && window.dh.apiFetch) || window.apiFetch;
  helpers.apiFetch = apiFetch;

  helpers.$ = (sel, root)=> (root||document).querySelector(sel);
  helpers.$$ = (sel, root)=> Array.from((root||document).querySelectorAll(sel));
  helpers.fmtDate = (s)=> s ? new Date(s).toLocaleString() : '';
  helpers.toast = (msg, opts)=> (window.dh && window.dh.toast) ? window.dh.toast(msg, opts||{}) : null;
  helpers.toastLoading = (msg)=> (window.dh && window.dh.toastLoading) ? window.dh.toastLoading(msg) : { update(){}, close(){} };

  helpers.getDialog = function(){
    return (window.dh && window.dh.dialog) || null;
  };

  helpers.showDialogAlert = function(message, options){
    const dlg = helpers.getDialog();
    if (dlg && typeof dlg.alert === 'function'){
      return dlg.alert(message, Object.assign({ title: 'Notification', tone: 'info' }, options || {}));
    }
    window.alert(message);
    return Promise.resolve();
  };

  helpers.showDialogConfirm = function(message, options){
    const dlg = helpers.getDialog();
    if (dlg && typeof dlg.confirm === 'function'){
      return dlg.confirm(message, Object.assign({ tone: 'warning', confirmLabel: 'Continue', cancelLabel: 'Cancel' }, options || {}));
    }
    return Promise.resolve(window.confirm(message));
  };

  const ESCAPE_LOOKUP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const ESCAPE_REGEX = /[&<>"']/g;
  helpers.escapeHtml = function(value){
    if (value === null || value === undefined) return '';
    return String(value).replace(ESCAPE_REGEX, (ch)=> ESCAPE_LOOKUP[ch] || ch);
  };
})();
