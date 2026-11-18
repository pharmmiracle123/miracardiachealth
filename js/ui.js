/* MiracardiacHealth shared UI helpers (classic script, no imports).
   - non-blocking toasts instead of alert()
   - friendly message for any unhandled Firebase/network error
   - offline / back-online banner
   - __e(): safe HTML escaping for values placed inside innerHTML templates
   - service worker registration (installable app + faster repeat loads) */
(function () {
  if (window.__mhUI) return;
  window.__mhUI = true;

  window.__e = function (v) {
    return String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var box;
  function ensureBox() {
    if (box && document.body && document.body.contains(box)) return box;
    box = document.createElement('div');
    box.setAttribute('role', 'status');
    box.style.cssText = 'position:fixed;left:50%;bottom:max(24px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:2147483000;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;max-width:92vw';
    (document.body || document.documentElement).appendChild(box);
    return box;
  }
  function toast(msg, kind) {
    try {
      var b = ensureBox(), t = document.createElement('div');
      t.textContent = String(msg);
      var bg = kind === 'err' ? '#b91c1c' : kind === 'ok' ? '#0f766e' : '#1e293b';
      t.style.cssText = 'background:' + bg + ';color:#fff;padding:10px 16px;border-radius:12px;font:500 13px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.28);pointer-events:auto;max-width:92vw;word-break:break-word';
      b.appendChild(t);
      setTimeout(function () { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 320); }, 3600);
    } catch (e) { /* ignore */ }
  }
  window.mhToast = toast;
  window.alert = function (m) {
    var s = String(m);
    toast(s, /fail|error|denied|required|could not|invalid|not /i.test(s) ? 'err' : 'ok');
  };

  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason || {}, c = r.code || r.message || String(r);
    if (/redirect|abort|cancel/i.test(c)) return;
    var msg = /permission-denied/.test(c) ? 'You do not have permission to do that (or Firestore rules are not published).'
      : /unavailable|network|failed to fetch/i.test(c) ? 'Network problem. Check your connection and try again.'
      : 'Something went wrong: ' + c;
    toast(msg, 'err');
  });

  var off;
  function banner(show) {
    if (!document.body) return;
    if (show && !off) {
      off = document.createElement('div');
      off.textContent = 'You are offline. Changes will sync when you reconnect.';
      off.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483001;background:#b45309;color:#fff;text-align:center;font:600 12px system-ui,sans-serif;padding:6px 10px;padding-top:max(6px,env(safe-area-inset-top))';
      document.body.appendChild(off);
    } else if (!show && off) { off.remove(); off = null; toast('Back online', 'ok'); }
  }
  window.addEventListener('offline', function () { banner(true); });
  window.addEventListener('online', function () { banner(false); });
  document.addEventListener('DOMContentLoaded', function () { if (navigator.onLine === false) banner(true); });

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
