/*
  "Keep screen on" switch using the Screen Wake Lock API.
  Markup: <button class="switch-btn" role="switch" aria-checked="false" data-wake-lock>...</button>
  - Hidden when the browser has no navigator.wakeLock.
  - The browser releases the lock when the tab is hidden; we re-request it when the
    tab becomes visible again, as long as the switch is still on.
  - If the device revokes the lock (low battery, etc.) the switch turns itself off.
  - Off by default on every page load (not remembered). See SPEC.md open questions.
*/
(function () {
  'use strict';
  var btn = document.querySelector('[data-wake-lock]');
  if (!btn) return;
  var note = document.getElementById('wake-note');
  var hint = btn.querySelector('.switch-hint');

  if (!('wakeLock' in navigator)) { btn.hidden = true; return; }

  var lock = null;
  var wanted = false;

  function show(on) {
    btn.setAttribute('aria-checked', String(on));
    if (note) note.hidden = !on;
    if (hint) hint.textContent = on ? 'Your screen will not sleep on this page' : 'Stops your screen sleeping while you cook';
  }

  function acquire() {
    return navigator.wakeLock.request('screen').then(function (l) {
      lock = l;
      show(true);
      lock.addEventListener('release', function () {
        lock = null;
        // Released because the tab was hidden: keep "wanted" so it comes back on return.
        if (document.visibilityState === 'visible') { wanted = false; show(false); }
      });
    }).catch(function () {
      wanted = false;
      show(false);
    });
  }

  btn.addEventListener('click', function () {
    if (wanted) {
      wanted = false;
      if (lock) lock.release();
      show(false);
    } else {
      wanted = true;
      acquire();
    }
  });

  document.addEventListener('visibilitychange', function () {
    if (wanted && !lock && document.visibilityState === 'visible') acquire();
  });
})();
