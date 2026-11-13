/*
  Light / dark theme.
  - First visit: follows the OS setting (prefers-color-scheme) through CSS alone.
  - Toggle: sets <html data-theme> and saves the choice in localStorage ("theme").
  - The saved choice is applied before first paint by the inline snippet in each page's <head>:
      <script>try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}</script>
  - Print ignores the theme entirely (print.css).
*/
(function () {
  'use strict';
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function current() {
    var set = document.documentElement.dataset.theme;
    if (set === 'light' || set === 'dark') return set;
    return mq && mq.matches ? 'dark' : 'light';
  }

  function label(btn) {
    btn.setAttribute('aria-label', current() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }

  document.querySelectorAll('.theme-toggle').forEach(function (btn) {
    label(btn);
    btn.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) { /* private mode: theme lasts for this page only */ }
      label(btn);
    });
    if (mq && mq.addEventListener) mq.addEventListener('change', function () { label(btn); });
  });
})();
